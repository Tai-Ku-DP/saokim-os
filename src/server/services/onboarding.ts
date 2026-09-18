import "server-only";

import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  brandBrief,
  checklistItem,
  documentRequest,
  onboardingChecklist,
  project,
  user,
} from "@/db/sqlite/schema";
import type { ChecklistItemStatus, ProjectType } from "@/db/types";
import type { AuthContext } from "@/server/auth/access";
import { assertProjectAccess } from "@/server/auth/project-access";
import { can } from "@/server/auth/access";
import { DomainError } from "./errors";
import { enqueueInTx } from "./outbox";

/**
 * Onboarding Hub (PRD §8). Bất biến quan trọng nhất:
 *   AC-ONB-001 checklist sinh tự động theo `project_type`
 *   AC-ONB-004 khách luôn thấy % hoàn thành
 *   AC-ONB-005 chỉ chuyển "hoàn tất onboarding" khi mọi mục BẮT BUỘC đã đạt,
 *              hoặc PM override và PHẢI ghi lý do (lưu audit)
 */

export type TemplateItem = {
  key: string;
  label: string;
  ownerSide: "client" | "staff";
  required: boolean;
};

/** Template theo loại dự án (PRD §9.3). */
export const ONBOARDING_TEMPLATES: Record<ProjectType, TemplateItem[]> = {
  brand_strategy: [
    { key: "company_profile", label: "Hồ sơ doanh nghiệp", ownerSide: "client", required: true },
    { key: "market_data", label: "Dữ liệu thị trường & đối thủ", ownerSide: "client", required: true },
    { key: "interviews", label: "Danh sách phỏng vấn nội bộ", ownerSide: "client", required: false },
    { key: "workshop", label: "Xác nhận lịch workshop", ownerSide: "staff", required: true },
    { key: "expectations", label: "Thống nhất kỳ vọng & phạm vi", ownerSide: "staff", required: true },
  ],
  brand_identity: [
    { key: "company_profile", label: "Hồ sơ doanh nghiệp", ownerSide: "client", required: true },
    { key: "brand_brief", label: "Brand brief", ownerSide: "client", required: true },
    { key: "brand_assets", label: "Tài sản thương hiệu hiện có", ownerSide: "client", required: true },
    { key: "competitors", label: "Danh sách đối thủ tham chiếu", ownerSide: "client", required: false },
    { key: "kickoff", label: "Xác nhận lịch kickoff", ownerSide: "staff", required: true },
  ],
  website: [
    { key: "company_profile", label: "Hồ sơ doanh nghiệp", ownerSide: "client", required: true },
    { key: "brand_assets", label: "Tài sản thương hiệu hiện có", ownerSide: "client", required: true },
    { key: "content", label: "Nội dung giới thiệu", ownerSide: "client", required: true },
    { key: "hosting", label: "Thông tin hosting & domain", ownerSide: "client", required: true },
    { key: "kickoff", label: "Xác nhận lịch kickoff", ownerSide: "staff", required: true },
  ],
  profile: [
    { key: "company_profile", label: "Hồ sơ doanh nghiệp", ownerSide: "client", required: true },
    { key: "content", label: "Nội dung & số liệu", ownerSide: "client", required: true },
    { key: "images", label: "Hình ảnh chất lượng cao", ownerSide: "client", required: true },
    { key: "print_spec", label: "Thông số in", ownerSide: "staff", required: false },
  ],
  packaging: [
    { key: "product_info", label: "Thông tin sản phẩm", ownerSide: "client", required: true },
    { key: "dieline", label: "Dieline / kích thước", ownerSide: "client", required: true },
    { key: "legal", label: "Thông tin pháp lý trên bao bì", ownerSide: "client", required: true },
    { key: "print_test", label: "Xác nhận in thử", ownerSide: "staff", required: false },
  ],
  video: [
    { key: "brief", label: "Brief nội dung video", ownerSide: "client", required: true },
    { key: "script_input", label: "Tư liệu & thông điệp chính", ownerSide: "client", required: true },
    { key: "locations", label: "Địa điểm & lịch quay", ownerSide: "staff", required: true },
    { key: "talent", label: "Danh sách nhân sự xuất hiện", ownerSide: "client", required: false },
  ],
  marcom: [
    { key: "campaign_goal", label: "Mục tiêu chiến dịch", ownerSide: "client", required: true },
    { key: "budget", label: "Ngân sách & thời gian", ownerSide: "client", required: true },
    { key: "assets", label: "Tài sản truyền thông hiện có", ownerSide: "client", required: false },
    { key: "channels", label: "Kênh triển khai", ownerSide: "staff", required: true },
  ],
  consulting: [
    { key: "context", label: "Bối cảnh & vấn đề cần tư vấn", ownerSide: "client", required: true },
    { key: "data", label: "Dữ liệu liên quan", ownerSide: "client", required: true },
    { key: "stakeholders", label: "Danh sách người tham gia", ownerSide: "client", required: false },
    { key: "schedule", label: "Lịch làm việc", ownerSide: "staff", required: true },
  ],
};

export type ChecklistView = {
  id: string;
  projectId: string;
  projectName: string;
  templateKey: string;
  status: "draft" | "in_progress" | "completed";
  completionRate: number;
  totalRequired: number;
  approvedRequired: number;
  items: {
    id: string;
    key: string;
    label: string;
    required: boolean;
    ownerSide: "client" | "staff";
    status: ChecklistItemStatus;
    note: string | null;
    dueAt: Date | null;
    orderIndex: number;
  }[];
  documents: {
    id: string;
    label: string;
    required: boolean;
    status: "pending" | "received" | "waived";
    fileId: string | null;
  }[];
  canComplete: boolean;
};

/** Sinh checklist + item theo loại dự án (AC-ONB-001). */
export async function createChecklistForProject(
  ctx: AuthContext,
  projectId: string,
): Promise<string> {
  const access = await assertProjectAccess(ctx, projectId, "write");

  const projectRows = db
    .select({ type: project.projectType })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1)
    .all();

  const projectType = projectRows[0]?.type;
  if (!projectType) throw new DomainError("INVALID_INPUT", "Không tìm thấy dự án");

  const existing = db
    .select({ id: onboardingChecklist.id })
    .from(onboardingChecklist)
    .where(eq(onboardingChecklist.projectId, projectId))
    .limit(1)
    .all();
  if (existing[0]) return existing[0].id;

  const template = ONBOARDING_TEMPLATES[projectType];

  return db.transaction((tx) => {
    const checklist = tx
      .insert(onboardingChecklist)
      .values({ projectId, templateKey: projectType, status: "in_progress" })
      .returning({ id: onboardingChecklist.id })
      .get();

    template.forEach((item, index) => {
      tx.insert(checklistItem)
        .values({
          checklistId: checklist.id,
          key: item.key,
          label: item.label,
          required: item.required,
          ownerSide: item.ownerSide,
          status: "todo",
          orderIndex: index + 1,
        })
        .run();
    });

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: "onboarding.checklist_created",
        entity: "onboarding_checklist",
        entityId: checklist.id,
        after: { templateKey: projectType, items: template.length },
      })
      .run();

    return checklist.id;
  });
}

/** Danh sách checklist người dùng được thấy (client: công ty mình; staff: dự án phụ trách). */
export async function listOnboarding(ctx: AuthContext): Promise<ChecklistView[]> {
  const projectRows = await db
    .select({
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
    })
    .from(project)
    .where(isNull(project.deletedAt));

  const scoped = projectRows.filter((row) =>
    ctx.kind === "client" ? row.organizationId === ctx.organizationId : true,
  );
  if (scoped.length === 0) return [];

  const checklists = await db
    .select()
    .from(onboardingChecklist)
    .where(inArray(onboardingChecklist.projectId, scoped.map((p) => p.id)));

  return Promise.all(
    checklists.map((checklist) => buildChecklistView(ctx, checklist.id)),
  );
}

export async function getChecklistView(
  ctx: AuthContext,
  checklistId: string,
): Promise<ChecklistView | null> {
  const rows = await db
    .select({ id: onboardingChecklist.id, projectId: onboardingChecklist.projectId })
    .from(onboardingChecklist)
    .where(eq(onboardingChecklist.id, checklistId))
    .limit(1);

  if (!rows[0]) return null;
  await assertProjectAccess(ctx, rows[0].projectId, "read");
  return buildChecklistView(ctx, checklistId);
}

async function buildChecklistView(
  ctx: AuthContext,
  checklistId: string,
): Promise<ChecklistView> {
  const checklistRows = await db
    .select()
    .from(onboardingChecklist)
    .where(eq(onboardingChecklist.id, checklistId))
    .limit(1);

  const checklist = checklistRows[0];
  if (!checklist) throw new DomainError("INVALID_INPUT", "Không tìm thấy checklist");

  const projectRows = await db
    .select({ name: project.name })
    .from(project)
    .where(eq(project.id, checklist.projectId))
    .limit(1);

  const items = await db
    .select({
      id: checklistItem.id,
      key: checklistItem.key,
      label: checklistItem.label,
      required: checklistItem.required,
      ownerSide: checklistItem.ownerSide,
      status: checklistItem.status,
      note: checklistItem.note,
      dueAt: checklistItem.dueAt,
      orderIndex: checklistItem.orderIndex,
    })
    .from(checklistItem)
    .where(eq(checklistItem.checklistId, checklistId))
    .orderBy(asc(checklistItem.orderIndex));

  const documents = await db
    .select({
      id: documentRequest.id,
      label: documentRequest.label,
      required: documentRequest.required,
      status: documentRequest.status,
      fileId: documentRequest.fileId,
    })
    .from(documentRequest)
    .where(eq(documentRequest.projectId, checklist.projectId));

  const requiredItems = items.filter((item) => item.required);
  const approvedRequired = requiredItems.filter((item) => item.status === "approved").length;

  return {
    id: checklist.id,
    projectId: checklist.projectId,
    projectName: projectRows[0]?.name ?? "",
    templateKey: checklist.templateKey,
    status: checklist.status,
    completionRate:
      requiredItems.length === 0
        ? 100
        : Math.round((approvedRequired / requiredItems.length) * 100),
    totalRequired: requiredItems.length,
    approvedRequired,
    items,
    documents,
    canComplete: approvedRequired === requiredItems.length,
  };
}

/** Khách nộp một mục (AC-ONB-002) → thông báo PM (AC-ONB-003). */
export async function submitChecklistItem(ctx: AuthContext, itemId: string): Promise<void> {
  const item = await loadItem(itemId);
  const access = await assertProjectAccess(ctx, item.projectId, "write");

  if (item.status === "approved") {
    throw new DomainError("INVALID_INPUT", "Mục này đã được duyệt");
  }

  db.transaction((tx) => {
    tx.update(checklistItem)
      .set({ status: "submitted", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(checklistItem.id, itemId))
      .run();

    tx.update(onboardingChecklist)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(onboardingChecklist.id, item.checklistId))
      .run();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "inapp",
      idempotencyKey: `checklist-submitted:${itemId}`,
      payload: { kind: "checklist_item_submitted", itemId, projectId: item.projectId },
    });
  });
}

/** PM duyệt / yêu cầu bổ sung một mục. */
export async function reviewChecklistItem(
  ctx: AuthContext,
  input: { itemId: string; decision: "approved" | "rejected"; note?: string },
): Promise<void> {
  const item = await loadItem(input.itemId);
  const access = await assertProjectAccess(ctx, item.projectId, "write");

  if (!can(ctx, { onboarding: ["review"] })) {
    throw new DomainError("INVALID_INPUT", "Bạn không có quyền duyệt onboarding");
  }
  if (input.decision === "rejected" && !input.note?.trim()) {
    throw new DomainError("REASON_REQUIRED", "Yêu cầu bổ sung phải ghi rõ cần gì");
  }

  db.transaction((tx) => {
    tx.update(checklistItem)
      .set({
        status: input.decision,
        note: input.note ?? null,
        updatedAt: new Date(),
        completedAt: input.decision === "approved" ? new Date() : null,
      })
      .where(eq(checklistItem.id, input.itemId))
      .run();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: `onboarding.item_${input.decision}`,
        entity: "checklist_item",
        entityId: input.itemId,
        after: { decision: input.decision },
        reason: input.note ?? null,
      })
      .run();
  });
}

/**
 * Kết thúc onboarding (AC-ONB-005). Thiếu mục bắt buộc → chỉ PM override được và
 * phải ghi lý do; lý do được lưu vào audit.
 */
export async function completeChecklist(
  ctx: AuthContext,
  input: { checklistId: string; override?: boolean; reason?: string },
): Promise<void> {
  const view = await getChecklistView(ctx, input.checklistId);
  if (!view) throw new DomainError("INVALID_INPUT", "Không tìm thấy checklist");

  const access = await assertProjectAccess(ctx, view.projectId, "write");
  const missing = view.items.filter((item) => item.required && item.status !== "approved");

  if (missing.length > 0) {
    // Không yêu cầu override → nói đúng vấn đề: còn mục bắt buộc chưa đạt.
    if (!input.override) {
      throw new DomainError(
        "CHECKLIST_INCOMPLETE",
        `Còn ${missing.length} mục bắt buộc chưa đạt`,
      );
    }
    if (!can(ctx, { onboarding: ["override"] })) {
      throw new DomainError(
        "CHECKLIST_INCOMPLETE",
        `Còn ${missing.length} mục bắt buộc chưa đạt và bạn không có quyền bỏ qua`,
      );
    }
    if (!input.reason?.trim()) {
      throw new DomainError("REASON_REQUIRED", "Bỏ qua mục bắt buộc phải ghi lý do");
    }
  }

  db.transaction((tx) => {
    tx.update(onboardingChecklist)
      .set({ status: "completed", completionRate: 100, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(onboardingChecklist.id, input.checklistId))
      .run();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: "onboarding.completed",
        entity: "onboarding_checklist",
        entityId: input.checklistId,
        before: { completionRate: view.completionRate },
        after: { completionRate: 100, overridden: missing.length > 0 },
        reason: input.reason ?? null,
      })
      .run();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "email",
      idempotencyKey: `onboarding-completed:${input.checklistId}`,
      payload: { kind: "onboarding_completed", projectId: view.projectId },
    });
  });
}

/* --------------------------------------------------------------- brand brief */

export type BrandBriefFields = {
  brand?: string;
  products?: string;
  audience?: string;
  competitors?: string;
  tone?: string;
  goals?: string;
};

export async function getBrandBrief(
  ctx: AuthContext,
  projectId: string,
): Promise<{ fields: BrandBriefFields; status: string } | null> {
  await assertProjectAccess(ctx, projectId, "read");

  const rows = await db
    .select({ fields: brandBrief.fields, status: brandBrief.status })
    .from(brandBrief)
    .where(eq(brandBrief.projectId, projectId))
    .limit(1);

  return rows[0] ?? null;
}

export async function saveBrandBrief(
  ctx: AuthContext,
  input: { projectId: string; fields: BrandBriefFields; submit?: boolean },
): Promise<void> {
  const access = await assertProjectAccess(ctx, input.projectId, "write");

  const existing = await db
    .select({ id: brandBrief.id })
    .from(brandBrief)
    .where(eq(brandBrief.projectId, input.projectId))
    .limit(1);

  const status = input.submit ? "submitted" : "draft";
  const aiRunId: string | undefined = undefined;

  db.transaction((tx) => {
    if (existing[0]) {
      tx.update(brandBrief)
        .set({
          fields: input.fields,
          status,
          submittedAt: input.submit ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(brandBrief.id, existing[0].id))
        .run();
    } else {
      tx.insert(brandBrief)
        .values({
          projectId: input.projectId,
          organizationId: access.organizationId,
          fields: input.fields,
          status,
          submittedBy: ctx.userId,
          submittedAt: input.submit ? new Date() : null,
          aiRunId,
        })
        .run();
    }

    if (input.submit) {
      enqueueInTx(tx, {
        organizationId: access.organizationId,
        channel: "inapp",
        idempotencyKey: `brand-brief-submitted:${input.projectId}`,
        payload: { kind: "brand_brief_submitted", projectId: input.projectId },
      });
    }
  });
}

/* --------------------------------------------------------- document request */

export async function createDocumentRequest(
  ctx: AuthContext,
  input: { projectId: string; label: string; required?: boolean },
): Promise<void> {
  const access = await assertProjectAccess(ctx, input.projectId, "write");

  db.transaction((tx) => {
    tx.insert(documentRequest)
      .values({
        projectId: input.projectId,
        label: input.label,
        required: input.required ?? true,
        status: "pending",
        requestedBy: ctx.userId,
      })
      .run();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "inapp",
      idempotencyKey: `document-requested:${input.projectId}:${input.label}`,
      payload: { kind: "document_requested", projectId: input.projectId, label: input.label },
    });
  });
}

export async function markDocumentReceived(
  ctx: AuthContext,
  input: { documentId: string; fileId?: string },
): Promise<void> {
  const rows = await db
    .select({ projectId: documentRequest.projectId })
    .from(documentRequest)
    .where(eq(documentRequest.id, input.documentId))
    .limit(1);

  if (!rows[0]) throw new DomainError("INVALID_INPUT", "Không tìm thấy yêu cầu tài liệu");
  await assertProjectAccess(ctx, rows[0].projectId, "write");

  await db
    .update(documentRequest)
    .set({
      status: "received",
      fileId: input.fileId ?? null,
      receivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(documentRequest.id, input.documentId));
}

export async function countPendingDocuments(ctx: AuthContext): Promise<number> {
  if (ctx.kind !== "client") return 0;
  const rows = await db
    .select({ total: count() })
    .from(checklistItem)
    .innerJoin(onboardingChecklist, eq(checklistItem.checklistId, onboardingChecklist.id))
    .innerJoin(project, eq(onboardingChecklist.projectId, project.id))
    .where(
      and(
        eq(project.organizationId, ctx.organizationId),
        isNull(project.deletedAt),
        inArray(checklistItem.status, ["todo", "rejected"]),
        eq(checklistItem.required, true),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

async function loadItem(itemId: string) {
  const rows = await db
    .select({
      id: checklistItem.id,
      checklistId: checklistItem.checklistId,
      status: checklistItem.status,
      ownerSide: checklistItem.ownerSide,
      projectId: onboardingChecklist.projectId,
    })
    .from(checklistItem)
    .innerJoin(onboardingChecklist, eq(checklistItem.checklistId, onboardingChecklist.id))
    .where(eq(checklistItem.id, itemId))
    .limit(1);

  const item = rows[0];
  if (!item) throw new DomainError("INVALID_INPUT", "Không tìm thấy mục checklist");
  return item;
}

/** Tên người phụ trách PM của dự án — dùng cho thông báo (P7). */
export async function projectManagerOf(projectId: string): Promise<string | null> {
  const rows = await db
    .select({ pmId: project.pmId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  if (!rows[0]?.pmId) return null;
  const names = await db.select({ name: user.name }).from(user).where(eq(user.id, rows[0].pmId)).limit(1);
  return names[0]?.name ?? null;
}
