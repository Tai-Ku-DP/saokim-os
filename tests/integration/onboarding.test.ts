import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  checklistItem,
  notificationOutbox,
  onboardingChecklist,
  organization,
  project,
  projectMember,
  user,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import {
  ONBOARDING_TEMPLATES,
  completeChecklist,
  createChecklistForProject,
  getChecklistView,
  reviewChecklistItem,
  saveBrandBrief,
  getBrandBrief,
  submitChecklistItem,
} from "@/server/services/onboarding";

/**
 * Acceptance criteria Onboarding (PRD §8.5):
 *   AC-ONB-001 checklist sinh tự động theo project_type
 *   AC-ONB-002 client nộp được tài liệu theo từng mục
 *   AC-ONB-003 có thông báo cho PM khi client nộp
 *   AC-ONB-004 client thấy % hoàn thành
 *   AC-ONB-005 chỉ hoàn tất khi mục bắt buộc đạt, hoặc PM override CÓ LÝ DO
 */

const ORG = "org_onb";
const PROJECT = "project_onb";

const pm: AuthContext = {
  kind: "staff",
  userId: "u_pm",
  name: "PM",
  email: "pm@saokim.vn",
  role: "pm",
};

const designer: AuthContext = {
  kind: "staff",
  userId: "u_designer",
  name: "Designer",
  email: "designer@saokim.vn",
  role: "designer",
};

const clientOwner: AuthContext = {
  kind: "client",
  userId: "u_owner",
  name: "Chủ doanh nghiệp",
  email: "owner@test.vn",
  role: "owner",
  organizationId: ORG,
};

async function reset() {
  for (const table of [
    "audit_log", "notification_outbox", "brand_brief", "document_request",
    "checklist_item", "onboarding_checklist", "project_member", "project",
    "member", "organization", "user",
  ]) {
    await db.run(sql.raw(`delete from "${table}"`));
  }

  await db.insert(user).values([
    { id: "u_pm", name: "PM", email: "pm@saokim.vn", emailVerified: true, type: "internal", role: "pm", createdAt: new Date(), updatedAt: new Date() },
    { id: "u_designer", name: "Designer", email: "designer@saokim.vn", emailVerified: true, type: "internal", role: "designer", createdAt: new Date(), updatedAt: new Date() },
    { id: "u_owner", name: "Chủ doanh nghiệp", email: "owner@test.vn", emailVerified: true, type: "client", createdAt: new Date(), updatedAt: new Date() },
  ]);

  await db.insert(organization).values({ id: ORG, name: "Công ty Onboarding", slug: "onb", createdAt: new Date() });
  await db.insert(project).values({
    id: PROJECT,
    organizationId: ORG,
    name: "Dự án Website",
    projectType: "website",
    status: "active",
    pmId: "u_pm",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(projectMember).values([
    { id: "pmb_pm", projectId: PROJECT, userId: "u_pm", side: "staff", access: "write", createdAt: new Date() },
    { id: "pmb_designer", projectId: PROJECT, userId: "u_designer", side: "staff", access: "write", createdAt: new Date() },
    { id: "pmb_owner", projectId: PROJECT, userId: "u_owner", side: "client", access: "approve", createdAt: new Date() },
  ]);
}

describe("AC-ONB-001 — sinh checklist theo project_type", () => {
  beforeEach(reset);

  it("sinh đúng số mục của template website", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    const view = await getChecklistView(pm, checklistId);

    expect(view).not.toBeNull();
    expect(view!.templateKey).toBe("website");
    expect(view!.items).toHaveLength(ONBOARDING_TEMPLATES.website.length);
    expect(view!.items.map((i) => i.key)).toEqual(
      ONBOARDING_TEMPLATES.website.map((i) => i.key),
    );
  });

  it("gọi lại không tạo checklist trùng", async () => {
    const first = await createChecklistForProject(pm, PROJECT);
    const second = await createChecklistForProject(pm, PROJECT);
    expect(second).toBe(first);
    expect(await db.select().from(onboardingChecklist)).toHaveLength(1);
  });

  it("mọi loại dự án đều có template với ít nhất một mục bắt buộc", () => {
    for (const [type, items] of Object.entries(ONBOARDING_TEMPLATES)) {
      expect(items.length, type).toBeGreaterThanOrEqual(4);
      expect(items.some((i) => i.required), type).toBe(true);
    }
  });
});

describe("AC-ONB-002/003/004 — nộp mục, thông báo, tiến độ", () => {
  beforeEach(reset);

  it("client nộp mục và PM nhận thông báo qua outbox", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    const view = await getChecklistView(pm, checklistId);
    const first = view!.items.find((i) => i.ownerSide === "client")!;

    await submitChecklistItem(clientOwner, first.id);

    const item = await db.select().from(checklistItem).where(eq(checklistItem.id, first.id));
    expect(item[0]?.status).toBe("submitted");

    const outbox = await db.select().from(notificationOutbox);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.idempotencyKey).toBe(`checklist-submitted:${first.id}`);
  });

  it("% hoàn thành chỉ tính mục BẮT BUỘC đã đạt (AC-ONB-004)", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    let view = await getChecklistView(pm, checklistId);
    expect(view!.completionRate).toBe(0);

    const required = view!.items.filter((i) => i.required);
    await submitChecklistItem(pm, required[0]!.id);
    await reviewChecklistItem(pm, { itemId: required[0]!.id, decision: "approved" });

    view = await getChecklistView(pm, checklistId);
    expect(view!.approvedRequired).toBe(1);
    expect(view!.completionRate).toBe(Math.round((1 / required.length) * 100));
  });

  it("yêu cầu bổ sung bắt buộc ghi rõ cần gì", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    const view = await getChecklistView(pm, checklistId);
    const item = view!.items[0]!;
    await submitChecklistItem(pm, item.id);

    await expect(
      reviewChecklistItem(pm, { itemId: item.id, decision: "rejected" }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });

    await reviewChecklistItem(pm, { itemId: item.id, decision: "rejected", note: "Thiếu số liệu" });
    const after = await db.select().from(checklistItem).where(eq(checklistItem.id, item.id));
    expect(after[0]?.status).toBe("rejected");
    expect(after[0]?.note).toBe("Thiếu số liệu");
  });

  it("designer không có quyền duyệt onboarding", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    const view = await getChecklistView(pm, checklistId);
    await expect(
      reviewChecklistItem(designer, { itemId: view!.items[0]!.id, decision: "approved" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});

describe("AC-ONB-005 — cổng chuyển sang hoàn tất", () => {
  beforeEach(reset);

  it("chặn khi còn mục bắt buộc chưa đạt", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    await expect(completeChecklist(pm, { checklistId })).rejects.toMatchObject({
      code: "CHECKLIST_INCOMPLETE",
    });
  });

  it("khách hàng không được override", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    await expect(
      completeChecklist(clientOwner, { checklistId, override: true, reason: "gấp" }),
    ).rejects.toMatchObject({ code: "CHECKLIST_INCOMPLETE" });
  });

  it("PM override phải có lý do, và lý do vào audit log", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);

    await expect(
      completeChecklist(pm, { checklistId, override: true }),
    ).rejects.toMatchObject({ code: "REASON_REQUIRED" });

    await completeChecklist(pm, {
      checklistId,
      override: true,
      reason: "Khách đã gửi qua email, sẽ bổ sung sau",
    });

    const checklist = await db
      .select()
      .from(onboardingChecklist)
      .where(eq(onboardingChecklist.id, checklistId));
    expect(checklist[0]?.status).toBe("completed");

    const audits = await db.select().from(auditLog);
    const completion = audits.find((a) => a.action === "onboarding.completed");
    expect(completion?.reason).toContain("email");
    expect((completion?.after as { overridden?: boolean })?.overridden).toBe(true);
  });

  it("hoàn tất bình thường khi mọi mục bắt buộc đã đạt", async () => {
    const checklistId = await createChecklistForProject(pm, PROJECT);
    let view = await getChecklistView(pm, checklistId);
    for (const item of view!.items.filter((i) => i.required)) {
      await submitChecklistItem(pm, item.id);
      await reviewChecklistItem(pm, { itemId: item.id, decision: "approved" });
    }

    view = await getChecklistView(pm, checklistId);
    expect(view!.canComplete).toBe(true);

    await completeChecklist(pm, { checklistId });
    const checklist = await db
      .select()
      .from(onboardingChecklist)
      .where(eq(onboardingChecklist.id, checklistId));
    expect(checklist[0]?.status).toBe("completed");
    expect(checklist[0]?.completionRate).toBe(100);
  });
});

describe("brand brief", () => {
  beforeEach(reset);

  it("lưu nháp rồi gửi, không nhân đôi bản ghi", async () => {
    await saveBrandBrief(pm, {
      projectId: PROJECT,
      fields: { brand: "An Phát Land" },
    });

    let brief = await getBrandBrief(pm, PROJECT);
    expect(brief?.status).toBe("draft");
    expect(brief?.fields.brand).toBe("An Phát Land");

    await saveBrandBrief(pm, {
      projectId: PROJECT,
      fields: { brand: "An Phát Land", goals: "Mở bán 2 dự án" },
      submit: true,
    });

    brief = await getBrandBrief(pm, PROJECT);
    expect(brief?.status).toBe("submitted");
    expect(brief?.fields.goals).toBe("Mở bán 2 dự án");
    expect(await db.select().from(auditLog).where(eq(auditLog.entity, "brand_brief"))).toHaveLength(0);
  });
});
