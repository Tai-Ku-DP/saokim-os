import { beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  approval,
  fileAsset,
  fileVersion,
  member,
  notification,
  notificationOutbox,
  organization,
  project,
  projectMember,
  user,
} from "@/db/sqlite/schema";
import {
  MAX_ATTEMPTS,
  nextAttemptAt,
  processDueOutbox,
} from "@/server/notifications/dispatch";
import { enqueue } from "@/server/services/outbox";

/**
 * Outbox là nền của toàn bộ notification (PRD §15): phải chứng minh được
 *  - gửi in-app đúng người nhận
 *  - retry + backoff, quá số lần thì `failed` (không kẹt vô hạn)
 *  - idempotency: một hành động chỉ sinh một thông báo
 *  - không gửi cho người không liên quan
 */

const ORG = "org_out";
const PROJECT = "proj_out";
const APPROVER = "u_approver";
const OUTSIDER = "u_outsider";

async function reset() {
  for (const table of [
    "notification", "notification_outbox", "approval", "file_version", "file_asset",
    "project_member", "project", "member", "organization", "user",
  ]) {
    await db.run(sql.raw(`delete from "${table}"`));
  }

  await db.insert(user).values([
    { id: APPROVER, name: "Người duyệt", email: "approver@x.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
    { id: "u_pm", name: "PM", email: "pm@x.vn", emailVerified: true, type: "internal", role: "pm", createdAt: new Date(), updatedAt: new Date() },
    { id: OUTSIDER, name: "Người ngoài", email: "outsider@x.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
  ]);
  await db.insert(organization).values({ id: ORG, name: "Công ty Outbox", slug: "outbox", createdAt: new Date() });
  await db.insert(member).values([
    { id: "m_ap", organizationId: ORG, userId: APPROVER, role: "owner", createdAt: new Date() },
    { id: "m_out", organizationId: ORG, userId: OUTSIDER, role: "member", createdAt: new Date() },
  ]);
  await db.insert(project).values({
    id: PROJECT, organizationId: ORG, name: "Dự án Outbox", projectType: "brand_identity",
    status: "active", pmId: "u_pm", createdAt: new Date(), updatedAt: new Date(),
  });
  await db.insert(projectMember).values([
    { id: "pmb_ap", projectId: PROJECT, userId: APPROVER, side: "client", access: "approve", createdAt: new Date() },
    { id: "pmb_pm", projectId: PROJECT, userId: "u_pm", side: "staff", access: "write", createdAt: new Date() },
    { id: "pmb_out", projectId: PROJECT, userId: OUTSIDER, side: "client", access: "read", createdAt: new Date() },
  ]);
  await db.insert(fileAsset).values({
    id: "f_out", projectId: PROJECT, name: "Logo", kind: "design", storageKey: "k",
    visibility: "client", createdAt: new Date(), updatedAt: new Date(),
  });
  await db.insert(fileVersion).values({
    id: "v_out", fileId: "f_out", versionNumber: 3, storageKey: "k3", status: "in_review", createdAt: new Date(),
  });
  await db.insert(approval).values({
    id: "ap_out", versionId: "v_out", projectId: PROJECT, approverId: APPROVER,
    status: "pending", createdAt: new Date(), updatedAt: new Date(),
  });
}

describe("outbox — gửi thông báo", () => {
  beforeEach(reset);

  it("gửi in-app cho đúng người duyệt, không gửi cho người ngoài", async () => {
    await enqueue({
      organizationId: ORG,
      channel: "inapp",
      idempotencyKey: "approval-requested:ap_out",
      payload: { kind: "approval_requested", approvalId: "ap_out", projectId: PROJECT },
    });

    const result = await processDueOutbox();
    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);

    const rows = await db.select().from(notification);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(APPROVER);
    expect(rows[0]?.link).toBe(`/projects/${PROJECT}/approvals`);
    expect(rows[0]?.title.length).toBeLessThanOrEqual(120);
  });

  it("đánh dấu sent và tăng attempts", async () => {
    await enqueue({
      organizationId: ORG,
      channel: "inapp",
      idempotencyKey: "k1",
      payload: { kind: "checklist_item_submitted", projectId: PROJECT },
    });

    await processDueOutbox();

    const rows = await db.select().from(notificationOutbox);
    expect(rows[0]?.status).toBe("sent");
    expect(rows[0]?.attempts).toBe(1);
    expect(rows[0]?.sentAt).toBeInstanceOf(Date);
  });

  it("lượt chạy sau không xử lý lại bản ghi đã gửi", async () => {
    await enqueue({
      organizationId: ORG,
      channel: "inapp",
      idempotencyKey: "k2",
      payload: { kind: "checklist_item_submitted", projectId: PROJECT },
    });

    await processDueOutbox();
    const second = await processDueOutbox();
    expect(second.processed).toBe(0);
    expect(await db.select().from(notification)).toHaveLength(1);
  });

  it("idempotencyKey trùng không tạo bản ghi thứ hai", async () => {
    const input = {
      organizationId: ORG,
      channel: "inapp" as const,
      idempotencyKey: "same-key",
      payload: { kind: "checklist_item_submitted", projectId: PROJECT },
    };
    await enqueue(input);
    await enqueue(input);

    expect(await db.select().from(notificationOutbox)).toHaveLength(1);
  });
});

describe("outbox — retry & backoff", () => {
  beforeEach(reset);

  it("webhook lỗi thì giữ pending, tăng attempts và đặt lịch thử lại", async () => {
    const original = process.env.N8N_WEBHOOK_URL;
    // Cổng đóng chắc chắn để fetch thất bại.
    process.env.N8N_WEBHOOK_URL = "http://127.0.0.1:9/webhook";

    try {
      await enqueue({
        organizationId: ORG,
        channel: "webhook",
        idempotencyKey: "wh-fail",
        payload: { kind: "service_request_created", projectId: PROJECT },
      });

      const result = await processDueOutbox();
      expect(result.failed).toBe(1);

      const rows = await db.select().from(notificationOutbox);
      expect(rows[0]?.status).toBe("pending");
      expect(rows[0]?.attempts).toBe(1);
      expect(rows[0]?.lastError).toBeTruthy();
      expect(rows[0]?.nextAttemptAt?.getTime()).toBeGreaterThan(Date.now());

      // Chưa đến hạn thử lại → lượt sau không xử lý.
      const second = await processDueOutbox();
      expect(second.processed).toBe(0);
    } finally {
      process.env.N8N_WEBHOOK_URL = original;
    }
  });

  it("quá số lần thử thì chuyển failed (không kẹt vô hạn)", async () => {
    const original = process.env.N8N_WEBHOOK_URL;
    process.env.N8N_WEBHOOK_URL = "http://127.0.0.1:9/webhook";

    try {
      await enqueue({
        organizationId: ORG,
        channel: "webhook",
        idempotencyKey: "wh-dead",
        payload: { kind: "service_request_created", projectId: PROJECT },
      });

      // Đẩy thẳng bản ghi tới lần thử cuối.
      await db
        .update(notificationOutbox)
        .set({ attempts: MAX_ATTEMPTS - 1, nextAttemptAt: new Date(Date.now() - 1000) })
        .where(eq(notificationOutbox.idempotencyKey, "wh-dead"));

      await processDueOutbox();

      const rows = await db.select().from(notificationOutbox);
      expect(rows[0]?.status).toBe("failed");
      expect(rows[0]?.attempts).toBe(MAX_ATTEMPTS);
    } finally {
      process.env.N8N_WEBHOOK_URL = original;
    }
  });

  it("backoff tăng theo số lần thử", () => {
    const now = Date.now();
    const first = nextAttemptAt(1, now);
    const third = nextAttemptAt(3, now);
    expect(first.getTime()).toBe(now + 2 * 60_000);
    expect(third.getTime()).toBe(now + 8 * 60_000);
  });
});
