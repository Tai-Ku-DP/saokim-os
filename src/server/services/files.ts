import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { db } from "@/db";
import {
  approval,
  auditLog,
  fileAsset,
  fileVersion,
  feedback,
  project,
  projectMember,
  user,
} from "@/db/sqlite/schema";
import type { ApprovalStatus, FileKind, VersionStatus } from "@/db/types";
import { assertProjectAccess } from "@/server/auth/project-access";
import type { AuthContext } from "@/server/auth/access";
import { buildStorageKey, storage } from "@/server/storage";
import { DomainError } from "./errors";
import { enqueueInTx } from "./outbox";

/**
 * Nghiệp vụ tệp & phiên bản (docs/05 §6).
 *
 * RÀNG BUỘC KỸ THUẬT: driver better-sqlite3 chỉ chạy transaction **đồng bộ**
 * (async callback ném "Transaction function cannot return a promise"). Vì vậy mọi thao
 * tác ghi nguyên tử nằm trong `db.transaction((tx) => …)` đồng bộ; kiểm tra quyền
 * (async, đọc session) và I/O storage chạy TRƯỚC đó.
 *
 * Bất biến được enforce ở đây (không ở UI):
 *   AC-DEL-002 version_number tăng liên tục, không ghi đè
 *   AC-DEL-003 phản hồi gắn đúng tệp + đúng phiên bản
 *   AC-DEL-004 phiên bản đã duyệt là bất biến
 *   §6.8        ghi outbox cùng transaction với hành động
 */

/* ------------------------------------------------------------------ kiểu trả về */

export type FileSummary = {
  id: string;
  name: string;
  kind: FileKind;
  visibility: "internal" | "client";
  versionCount: number;
  latestVersionNumber: number | null;
  latestStatus: VersionStatus | null;
  openFeedback: number;
  updatedAt: Date;
};

export type VersionRow = {
  id: string;
  versionNumber: number;
  note: string | null;
  status: VersionStatus;
  uploadedByName: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  createdAt: Date;
};

export type FeedbackRow = {
  id: string;
  versionId: string;
  versionNumber: number;
  body: string;
  status: "open" | "resolved" | "wontfix";
  authorName: string | null;
  authorSide: "client" | "staff";
  createdAt: Date;
};

export type FileDetail = {
  id: string;
  projectId: string;
  name: string;
  kind: FileKind;
  visibility: "internal" | "client";
  currentVersionId: string | null;
  versions: VersionRow[];
  feedback: FeedbackRow[];
};

export type ApprovalRow = {
  id: string;
  projectId: string;
  versionId: string;
  fileId: string;
  fileName: string;
  versionNumber: number;
  status: ApprovalStatus;
  requestedByName: string | null;
  approverName: string | null;
  reason: string | null;
  createdAt: Date;
};

export type PendingApprovalSummary = {
  id: string;
  projectId: string;
  projectName: string;
  fileName: string;
  versionNumber: number;
  createdAt: Date;
  approverId: string | null;
};

/* ------------------------------------------------------------------ đọc dữ liệu */

export async function listProjectFiles(
  ctx: AuthContext,
  projectId: string,
): Promise<FileSummary[]> {
  await assertProjectAccess(ctx, projectId, "read");

  const files = await db
    .select({
      id: fileAsset.id,
      name: fileAsset.name,
      kind: fileAsset.kind,
      visibility: fileAsset.visibility,
      updatedAt: fileAsset.updatedAt,
    })
    .from(fileAsset)
    .where(and(eq(fileAsset.projectId, projectId), isNull(fileAsset.deletedAt)))
    .orderBy(desc(fileAsset.updatedAt));

  const versions = await db
    .select({
      id: fileVersion.id,
      fileId: fileVersion.fileId,
      versionNumber: fileVersion.versionNumber,
      status: fileVersion.status,
    })
    .from(fileVersion)
    .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
    .where(eq(fileAsset.projectId, projectId));

  const openFeedback = await db
    .select({ versionId: feedback.versionId })
    .from(feedback)
    .innerJoin(fileAsset, eq(feedback.fileId, fileAsset.id))
    .where(and(eq(fileAsset.projectId, projectId), eq(feedback.status, "open")));

  const visible = ctx.kind === "client" ? files.filter((f) => f.visibility === "client") : files;

  return visible.map((file) => {
    const own = versions.filter((v) => v.fileId === file.id);
    const latest = own.reduce<null | (typeof own)[number]>(
      (acc, v) => (!acc || v.versionNumber > acc.versionNumber ? v : acc),
      null,
    );
    return {
      id: file.id,
      name: file.name,
      kind: file.kind,
      visibility: file.visibility,
      versionCount: own.length,
      latestVersionNumber: latest?.versionNumber ?? null,
      latestStatus: latest?.status ?? null,
      openFeedback: openFeedback.filter((f) => own.some((v) => v.id === f.versionId)).length,
      updatedAt: file.updatedAt,
    };
  });
}

export async function getFileDetail(ctx: AuthContext, fileId: string): Promise<FileDetail | null> {
  const fileRows = await db
    .select()
    .from(fileAsset)
    .where(and(eq(fileAsset.id, fileId), isNull(fileAsset.deletedAt)))
    .limit(1);

  const file = fileRows[0];
  if (!file) return null;

  await assertProjectAccess(ctx, file.projectId, "read");
  if (ctx.kind === "client" && file.visibility === "internal") return null;

  // Cùng bảng `user` với hai vai trò (người upload / người duyệt) → cần alias trong SQL.
  const uploadedBy = alias(user, "uploaded_by_user");
  const approvedBy = alias(user, "approved_by_user");

  const versionRows = await db
    .select({
      id: fileVersion.id,
      versionNumber: fileVersion.versionNumber,
      note: fileVersion.note,
      status: fileVersion.status,
      approvedAt: fileVersion.approvedAt,
      createdAt: fileVersion.createdAt,
      uploadedByName: uploadedBy.name,
      approvedByName: approvedBy.name,
    })
    .from(fileVersion)
    .leftJoin(uploadedBy, eq(fileVersion.uploadedBy, uploadedBy.id))
    .leftJoin(approvedBy, eq(fileVersion.approvedBy, approvedBy.id))
    .where(eq(fileVersion.fileId, fileId))
    .orderBy(desc(fileVersion.versionNumber));

  const feedbackRows = await db
    .select({
      id: feedback.id,
      versionId: feedback.versionId,
      versionNumber: fileVersion.versionNumber,
      body: feedback.body,
      status: feedback.status,
      authorSide: feedback.authorSide,
      authorName: user.name,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .innerJoin(fileVersion, eq(feedback.versionId, fileVersion.id))
    .leftJoin(user, eq(feedback.authorId, user.id))
    .where(eq(feedback.fileId, fileId))
    .orderBy(desc(feedback.createdAt));

  return {
    id: file.id,
    projectId: file.projectId,
    name: file.name,
    kind: file.kind,
    visibility: file.visibility,
    currentVersionId: file.currentVersionId,
    versions: versionRows,
    feedback: feedbackRows,
  };
}

export async function listProjectApprovals(
  ctx: AuthContext,
  projectId: string,
  onlyPending = false,
): Promise<ApprovalRow[]> {
  await assertProjectAccess(ctx, projectId, "read");

  const rows = await db
    .select({
      id: approval.id,
      projectId: approval.projectId,
      versionId: approval.versionId,
      fileId: fileVersion.fileId,
      fileName: fileAsset.name,
      versionNumber: fileVersion.versionNumber,
      status: approval.status,
      reason: approval.reason,
      createdAt: approval.createdAt,
      requestedById: approval.requestedBy,
      approverId: approval.approverId,
    })
    .from(approval)
    .innerJoin(fileVersion, eq(approval.versionId, fileVersion.id))
    .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
    .where(
      onlyPending
        ? and(eq(approval.projectId, projectId), eq(approval.status, "pending"))
        : eq(approval.projectId, projectId),
    )
    .orderBy(desc(approval.createdAt));

  const names = await nameLookup(
    rows.flatMap((r) => [r.requestedById, r.approverId]).filter((v): v is string => Boolean(v)),
  );

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    versionId: r.versionId,
    fileId: r.fileId,
    fileName: r.fileName,
    versionNumber: r.versionNumber,
    status: r.status,
    requestedByName: r.requestedById ? (names.get(r.requestedById) ?? null) : null,
    approverName: r.approverId ? (names.get(r.approverId) ?? null) : null,
    reason: r.reason,
    createdAt: r.createdAt,
  }));
}

/** Duyệt đang chờ — dùng cho bề mặt "Hôm nay" của Client Owner. */
export async function listPendingApprovalsForUser(
  ctx: AuthContext,
  limit = 5,
): Promise<PendingApprovalSummary[]> {
  const rows = await db
    .select({
      id: approval.id,
      projectId: approval.projectId,
      projectName: project.name,
      fileName: fileAsset.name,
      versionNumber: fileVersion.versionNumber,
      createdAt: approval.createdAt,
      approverId: approval.approverId,
    })
    .from(approval)
    .innerJoin(project, eq(approval.projectId, project.id))
    .innerJoin(fileVersion, eq(approval.versionId, fileVersion.id))
    .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
    .where(and(eq(approval.status, "pending"), isNull(project.deletedAt)))
    .orderBy(desc(approval.createdAt))
    .limit(limit * 4);

  const scoped =
    ctx.kind === "client"
      ? rows.filter((r) => r.approverId === ctx.userId)
      : rows.filter((r) => r.approverId === ctx.userId || ctx.role === "pm" || ctx.role === "admin");

  return scoped.slice(0, limit).map((r) => ({
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    fileName: r.fileName,
    versionNumber: r.versionNumber,
    createdAt: r.createdAt,
    approverId: r.approverId,
  }));
}

/* ------------------------------------------------------------------ ghi dữ liệu */

export async function createFile(
  ctx: AuthContext,
  input: { projectId: string; name: string; kind: FileKind; visibility: "internal" | "client" },
): Promise<string> {
  const access = await assertProjectAccess(ctx, input.projectId, "write");

  return db.transaction((tx) => {
    const row = tx
      .insert(fileAsset)
      .values({
        projectId: input.projectId,
        name: input.name,
        kind: input.kind,
        visibility: input.visibility,
        storageKey: `pending/${input.projectId}`,
        ownerId: ctx.userId,
      })
      .returning({ id: fileAsset.id })
      .get();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: "file.created",
        entity: "file_asset",
        entityId: row.id,
        after: { name: input.name, kind: input.kind },
      })
      .run();

    return row.id;
  });
}

export async function addVersion(
  ctx: AuthContext,
  input: { fileId: string; fileName: string; note?: string; data: Uint8Array },
): Promise<{ versionId: string; versionNumber: number }> {
  const fileRows = await db
    .select({ id: fileAsset.id, projectId: fileAsset.projectId, name: fileAsset.name })
    .from(fileAsset)
    .where(and(eq(fileAsset.id, input.fileId), isNull(fileAsset.deletedAt)))
    .limit(1);

  const file = fileRows[0];
  if (!file) throw new DomainError("FILE_NOT_FOUND", "Không tìm thấy tệp");

  const access = await assertProjectAccess(ctx, file.projectId, "write");

  const latest = db
    .select({ max: fileVersion.versionNumber })
    .from(fileVersion)
    .where(eq(fileVersion.fileId, file.id))
    .all()
    .reduce((acc, r) => Math.max(acc, r.max ?? 0), 0);
  const nextNumber = latest + 1;

  // I/O storage ngoài transaction; metadata ghi nguyên tử bên dưới.
  const key = buildStorageKey(file.projectId, file.id, nextNumber, input.fileName);
  const stored = await storage.put(key, input.data);

  return db.transaction((tx) => {
    const inserted = tx
      .insert(fileVersion)
      .values({
        fileId: file.id,
        versionNumber: nextNumber,
        storageKey: stored.key,
        note: input.note ?? null,
        uploadedBy: ctx.userId,
        status: "in_review",
      })
      .returning({ id: fileVersion.id, versionNumber: fileVersion.versionNumber })
      .get();

    tx.update(fileAsset)
      .set({ currentVersionId: inserted.id, sizeBytes: stored.sizeBytes, updatedAt: new Date() })
      .where(eq(fileAsset.id, file.id))
      .run();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: "file.version_added",
        entity: "file_version",
        entityId: inserted.id,
        after: { fileId: file.id, versionNumber: inserted.versionNumber },
      })
      .run();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "inapp",
      idempotencyKey: `version-uploaded:${inserted.id}`,
      payload: {
        kind: "version_uploaded",
        fileId: file.id,
        fileName: file.name,
        versionNumber: inserted.versionNumber,
        projectId: file.projectId,
      },
    });

    return { versionId: inserted.id, versionNumber: inserted.versionNumber };
  });
}

export async function addFeedback(
  ctx: AuthContext,
  input: {
    fileId: string;
    versionId: string;
    body: string;
    anchor?: { page?: number; x?: number; y?: number; section?: string };
  },
): Promise<string> {
  const rows = await db
    .select({
      fileId: fileVersion.fileId,
      projectId: fileAsset.projectId,
      status: fileVersion.status,
    })
    .from(fileVersion)
    .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
    .where(eq(fileVersion.id, input.versionId))
    .limit(1);

  const version = rows[0];
  if (!version) throw new DomainError("VERSION_NOT_FOUND", "Không tìm thấy phiên bản");
  if (version.fileId !== input.fileId) {
    throw new DomainError("FEEDBACK_MISMATCH", "Phản hồi phải gắn đúng tệp và phiên bản");
  }

  const access = await assertProjectAccess(ctx, version.projectId, "write");

  if (version.status === "approved") {
    throw new DomainError(
      "VERSION_LOCKED",
      "Phiên bản đã duyệt nên không nhận phản hồi mới. Tạo phiên bản mới để tiếp tục trao đổi.",
    );
  }

  const authorSide = ctx.kind === "client" ? "client" : "staff";

  return db.transaction((tx) => {
    const inserted = tx
      .insert(feedback)
      .values({
        fileId: input.fileId,
        versionId: input.versionId,
        authorId: ctx.userId,
        authorSide,
        body: input.body,
        anchor: input.anchor ?? {},
        status: "open",
      })
      .returning({ id: feedback.id })
      .get();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "inapp",
      idempotencyKey: `feedback-created:${inserted.id}`,
      payload: {
        kind: "feedback_created",
        fileId: input.fileId,
        versionId: input.versionId,
        projectId: version.projectId,
        authorSide,
      },
    });

    return inserted.id;
  });
}

export async function resolveFeedback(
  ctx: AuthContext,
  input: { feedbackId: string; status: "resolved" | "wontfix" },
): Promise<void> {
  const rows = await db
    .select({ id: feedback.id, projectId: fileAsset.projectId })
    .from(feedback)
    .innerJoin(fileAsset, eq(feedback.fileId, fileAsset.id))
    .where(eq(feedback.id, input.feedbackId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new DomainError("FEEDBACK_NOT_FOUND", "Không tìm thấy phản hồi");

  await assertProjectAccess(ctx, row.projectId, "write");

  db.transaction((tx) => {
    tx.update(feedback)
      .set({ status: input.status, resolvedBy: ctx.userId, resolvedAt: new Date() })
      .where(eq(feedback.id, input.feedbackId))
      .run();
  });
}

export async function requestApproval(
  ctx: AuthContext,
  input: { projectId: string; versionId: string; approverId: string; note?: string },
): Promise<string> {
  const access = await assertProjectAccess(ctx, input.projectId, "approve");

  const approver = await db
    .select({ access: projectMember.access })
    .from(projectMember)
    .where(
      and(eq(projectMember.projectId, input.projectId), eq(projectMember.userId, input.approverId)),
    )
    .limit(1);

  if (!approver[0] || approver[0].access !== "approve") {
    throw new DomainError(
      "APPROVER_NOT_ALLOWED",
      "Người được chọn không có quyền duyệt trong dự án này",
    );
  }

  return db.transaction((tx) => {
    const inserted = tx
      .insert(approval)
      .values({
        versionId: input.versionId,
        projectId: input.projectId,
        requestedBy: ctx.userId,
        approverId: input.approverId,
        status: "pending",
      })
      .returning({ id: approval.id })
      .get();

    tx.update(fileVersion)
      .set({ status: "in_review" })
      .where(eq(fileVersion.id, input.versionId))
      .run();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: "approval.requested",
        entity: "approval",
        entityId: inserted.id,
        after: { versionId: input.versionId, approverId: input.approverId },
        reason: input.note ?? null,
      })
      .run();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "email",
      idempotencyKey: `approval-requested:${inserted.id}`,
      payload: {
        kind: "approval_requested",
        approvalId: inserted.id,
        projectId: input.projectId,
        versionId: input.versionId,
      },
    });

    return inserted.id;
  });
}

export async function decideApproval(
  ctx: AuthContext,
  input: {
    approvalId: string;
    decision: "approved" | "rejected" | "changes_requested";
    reason?: string;
  },
): Promise<void> {
  const rows = await db
    .select({
      id: approval.id,
      projectId: approval.projectId,
      versionId: approval.versionId,
      approverId: approval.approverId,
      status: approval.status,
    })
    .from(approval)
    .where(eq(approval.id, input.approvalId))
    .limit(1);

  const row = rows[0];
  if (!row) throw new DomainError("APPROVAL_NOT_FOUND", "Không tìm thấy yêu cầu duyệt");
  if (row.status !== "pending") {
    throw new DomainError("APPROVAL_DECIDED", "Yêu cầu duyệt này đã được xử lý");
  }

  const access = await assertProjectAccess(ctx, row.projectId, "approve");

  const isAssignedApprover = row.approverId === ctx.userId;
  const isStaffOverride = ctx.kind === "staff";
  if (!isAssignedApprover && !isStaffOverride) {
    throw new DomainError("NOT_APPROVER", "Bạn không phải người duyệt của phiên bản này");
  }
  if (isStaffOverride && !isAssignedApprover && !input.reason?.trim()) {
    throw new DomainError("REASON_REQUIRED", "Duyệt thay khách phải ghi lý do");
  }

  const versionStatus: VersionStatus =
    input.decision === "approved" ? "approved" : "changes_requested";

  db.transaction((tx) => {
    tx.update(fileVersion)
      .set(
        input.decision === "approved"
          ? { status: "approved", approvedBy: ctx.userId, approvedAt: new Date() }
          : { status: versionStatus },
      )
      .where(eq(fileVersion.id, row.versionId))
      .run();

    tx.update(approval)
      .set({
        status: input.decision,
        decidedAt: new Date(),
        approverId: ctx.userId,
        reason: input.reason ?? null,
      })
      .where(eq(approval.id, input.approvalId))
      .run();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: `approval.${input.decision}`,
        entity: "approval",
        entityId: input.approvalId,
        before: { status: "pending" },
        after: { status: input.decision, versionId: row.versionId },
        reason: input.reason ?? null,
      })
      .run();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "email",
      idempotencyKey: `approval-decided:${input.approvalId}:${input.decision}`,
      payload: {
        kind: "approval_decided",
        approvalId: input.approvalId,
        decision: input.decision,
        projectId: row.projectId,
        versionId: row.versionId,
      },
    });
  });
}

/* -------------------------------------------------------------------- helpers */

async function nameLookup(ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db.select({ id: user.id, name: user.name }).from(user);
  for (const row of rows) if (ids.includes(row.id)) map.set(row.id, row.name);
  return map;
}
