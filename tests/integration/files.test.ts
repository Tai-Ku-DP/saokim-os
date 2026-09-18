import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  approval,
  auditLog,
  fileAsset,
  fileVersion,
  feedback,
  member,
  notificationOutbox,
  organization,
  project,
  projectMember,
  user,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import {
  addFeedback,
  addVersion,
  createFile,
  decideApproval,
  listProjectApprovals,
  requestApproval,
} from "@/server/services/files";
import { DomainError } from "@/server/services/errors";

/**
 * Bất biến nghiệp vụ của Delivery Hub (docs/05 §6, AC-DEL-001→006).
 * Chạy trên SQLite thật với migration thật.
 */

const ORG = "org_test";
const PROJECT = "project_test";
const OTHER_PROJECT = "project_other";

const owner: AuthContext = {
  kind: "client",
  userId: "user_owner",
  name: "Chủ doanh nghiệp",
  email: "owner@test.vn",
  role: "owner",
  organizationId: ORG,
};

const memberCtx: AuthContext = {
  kind: "client",
  userId: "user_member",
  name: "Nhân viên",
  email: "member@test.vn",
  role: "member",
  organizationId: ORG,
};

const pm: AuthContext = {
  kind: "staff",
  userId: "user_pm",
  name: "PM",
  email: "pm@saokim.vn",
  role: "pm",
};

async function reset() {
  for (const table of [
    "notification_outbox", "audit_log", "feedback", "approval", "file_version", "file_asset",
    "project_member", "project", "member", "organization", "user",
  ]) {
    await db.run(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("drizzle-orm")).sql.raw(`delete from "${table}"`) as any,
    );
  }

  await db.insert(user).values([
    { id: "user_owner", name: "Chủ doanh nghiệp", email: "owner@test.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
    { id: "user_member", name: "Nhân viên", email: "member@test.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
    { id: "user_pm", name: "PM", email: "pm@saokim.vn", emailVerified: true, type: "internal", role: "pm", createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.insert(organization).values({ id: ORG, name: "Công ty Test", slug: "test", createdAt: new Date() });
  await db.insert(member).values([
    { id: "m_owner", organizationId: ORG, userId: "user_owner", role: "owner", createdAt: new Date() },
    { id: "m_member", organizationId: ORG, userId: "user_member", role: "member", createdAt: new Date() },
  ]);

  for (const [id, organizationId] of [
    [PROJECT, ORG],
    [OTHER_PROJECT, "org_other"],
  ] as const) {
    if (organizationId === "org_other") {
      await db.insert(organization).values({ id: "org_other", name: "Công ty Khác", slug: "other", createdAt: new Date() });
    }
    await db.insert(project).values({
      id,
      organizationId,
      name: `Dự án ${id}`,
      projectType: "brand_identity",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await db.insert(projectMember).values([
    { id: "pm_owner", projectId: PROJECT, userId: "user_owner", side: "client", access: "approve", createdAt: new Date() },
    { id: "pm_member", projectId: PROJECT, userId: "user_member", side: "client", access: "write", createdAt: new Date() },
    { id: "pm_pm", projectId: PROJECT, userId: "user_pm", side: "staff", access: "write", createdAt: new Date() },
  ]);
}

const bytes = (text: string) => new TextEncoder().encode(text);

describe("phiên bản tệp (AC-DEL-002, AC-DEL-004)", () => {
  beforeEach(reset);

  it("đánh số phiên bản tăng liên tục, không ghi đè", async () => {
    const fileId = await createFile(pm, {
      projectId: PROJECT,
      name: "Logo",
      kind: "design",
      visibility: "client",
    });

    const v1 = await addVersion(pm, { fileId, fileName: "logo-v1.pdf", data: bytes("v1") });
    const v2 = await addVersion(pm, { fileId, fileName: "logo-v2.pdf", data: bytes("v2") });
    const v3 = await addVersion(pm, { fileId, fileName: "logo-v3.pdf", data: bytes("v3") });

    expect([v1.versionNumber, v2.versionNumber, v3.versionNumber]).toEqual([1, 2, 3]);

    const rows = await db.select().from(fileVersion).where(eq(fileVersion.fileId, fileId));
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.storageKey)).size).toBe(3);
  });

  it("thao tác ghi đều để lại audit log và outbox trong cùng transaction", async () => {
    const fileId = await createFile(pm, { projectId: PROJECT, name: "Logo", kind: "design", visibility: "client" });
    await addVersion(pm, { fileId, fileName: "logo-v1.pdf", data: bytes("v1") });

    expect((await db.select().from(auditLog)).length).toBeGreaterThanOrEqual(2);
    expect((await db.select().from(notificationOutbox)).length).toBe(1);
  });
});

describe("phản hồi (AC-DEL-003, AC-DEL-004)", () => {
  beforeEach(reset);

  async function setupVersion() {
    const fileId = await createFile(pm, { projectId: PROJECT, name: "Logo", kind: "design", visibility: "client" });
    const version = await addVersion(pm, { fileId, fileName: "logo.pdf", data: bytes("v1") });
    return { fileId, versionId: version.versionId };
  }

  it("phản hồi sai tệp bị từ chối", async () => {
    const { versionId } = await setupVersion();
    await db.insert(fileAsset).values({
      id: "other_file",
      projectId: PROJECT,
      name: "Tệp khác",
      kind: "document",
      storageKey: "x",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      addFeedback(owner, { fileId: "other_file", versionId, body: "Sai tệp" }),
    ).rejects.toMatchObject({ code: "FEEDBACK_MISMATCH" });
  });

  it("phiên bản đã duyệt KHÔNG nhận phản hồi mới (bất biến)", async () => {
    const { fileId, versionId } = await setupVersion();

    const approvalId = await requestApproval(pm, {
      projectId: PROJECT,
      versionId,
      approverId: "user_owner",
    });
    await decideApproval(owner, { approvalId, decision: "approved" });

    const locked = await db.select().from(fileVersion).where(eq(fileVersion.id, versionId));
    expect(locked[0]?.status).toBe("approved");
    expect(locked[0]?.approvedBy).toBe("user_owner");
    expect(locked[0]?.approvedAt).toBeInstanceOf(Date);

    await expect(
      addFeedback(owner, { fileId, versionId, body: "Góp ý sau khi duyệt" }),
    ).rejects.toMatchObject({ code: "VERSION_LOCKED" });

    // Vẫn tạo được phiên bản mới — đó là đường đúng.
    const v2 = await addVersion(pm, { fileId, fileName: "logo-v2.pdf", data: bytes("v2") });
    expect(v2.versionNumber).toBe(2);
    expect((await db.select().from(feedback)).length).toBe(0);
  });
});

describe("duyệt (AC-DEL-006, PRD §14)", () => {
  beforeEach(reset);

  async function setupApproval() {
    const fileId = await createFile(pm, { projectId: PROJECT, name: "Logo", kind: "design", visibility: "client" });
    const version = await addVersion(pm, { fileId, fileName: "logo.pdf", data: bytes("v1") });
    const approvalId = await requestApproval(pm, {
      projectId: PROJECT,
      versionId: version.versionId,
      approverId: "user_owner",
    });
    return { fileId, versionId: version.versionId, approvalId };
  }

  it("client member không duyệt được (chỉ Client Owner)", async () => {
    const { approvalId } = await setupApproval();
    await expect(
      decideApproval(memberCtx, { approvalId, decision: "approved" }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("PM duyệt thay khách phải ghi lý do (AC-ONB-005 tinh thần)", async () => {
    const { approvalId } = await setupApproval();
    await expect(
      decideApproval(pm, { approvalId, decision: "approved" }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });

    await decideApproval(pm, { approvalId, decision: "approved", reason: "Khách xác nhận qua điện thoại" });
    const rows = await db.select().from(approval).where(eq(approval.id, approvalId));
    expect(rows[0]?.status).toBe("approved");
    expect(rows[0]?.reason).toContain("điện thoại");
  });

  it("không xử lý lại một yêu cầu đã quyết", async () => {
    const { approvalId } = await setupApproval();
    await decideApproval(owner, { approvalId, decision: "changes_requested", reason: "Sửa tỷ lệ" });
    await expect(
      decideApproval(owner, { approvalId, decision: "approved" }),
    ).rejects.toMatchObject({ code: "APPROVAL_DECIDED" });
  });

  it("client member không có quyền duyệt bị chặn ngay ở tầng quyền", async () => {
    const { approvalId } = await setupApproval();
    await expect(
      decideApproval(memberCtx, { approvalId, decision: "changes_requested" }),
    ).rejects.toBeInstanceOf(Error);
  });

  it("người có quyền duyệt nhưng không được chỉ định thì báo NOT_APPROVER", async () => {
    const { approvalId } = await setupApproval();

    // Một Client Owner khác của cùng công ty, có quyền duyệt nhưng không phải người được chỉ định.
    await db.insert(user).values({
      id: "user_owner_2",
      name: "Chủ doanh nghiệp 2",
      email: "owner2@test.vn",
      emailVerified: true,
      type: "client",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(projectMember).values({
      id: "pm_owner_2",
      projectId: PROJECT,
      userId: "user_owner_2",
      side: "client",
      access: "approve",
      createdAt: new Date(),
    });

    await expect(
      decideApproval(
        { ...owner, userId: "user_owner_2", email: "owner2@test.vn" },
        { approvalId, decision: "approved" },
      ),
    ).rejects.toMatchObject({ code: "NOT_APPROVER" });
  });
});

describe("cô lập tổ chức ở tầng service (NFR Privacy)", () => {
  beforeEach(reset);

  it("khách hàng công ty A không đọc được dự án công ty B", async () => {
    await expect(listProjectApprovals(owner, OTHER_PROJECT)).rejects.toBeInstanceOf(Error);
  });

  it("client member không được ghi vào dự án không được phân công", async () => {
    const otherMember: AuthContext = { ...memberCtx, userId: "user_member" };
    await db.insert(project).values({
      id: "project_no_assignment",
      organizationId: ORG,
      name: "Dự án không phân công",
      projectType: "website",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createFile(otherMember, {
        projectId: "project_no_assignment",
        name: "Tệp",
        kind: "document",
        visibility: "client",
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});

describe("DomainError có mã để map sang thông báo", () => {
  it("là Error với code", () => {
    const error = new DomainError("VERSION_LOCKED", "khoá");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("VERSION_LOCKED");
  });
});
