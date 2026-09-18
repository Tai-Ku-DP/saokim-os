import "server-only";

import { and, desc, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  approval,
  fileAsset,
  fileVersion,
  feedback,
  interactionEvent,
  organization,
  project,
  task,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { assertProjectAccess } from "@/server/auth/project-access";

/**
 * Tầng intelligence (PRD §11.3): biến dữ liệu sử dụng thành tín hiệu để CS/Account
 * chăm sóc chủ động. Tất định (rule) — AI chỉ diễn giải, không quyết định (docs/04 §5).
 */

export type RiskItem = {
  id: string;
  level: "high" | "medium" | "low";
  title: string;
  reason: string;
  projectId: string;
  projectName: string;
};

export type FeedbackDigest = {
  projectId: string;
  projectName: string;
  fileName: string;
  versionId: string;
  versionNumber: number;
  openCount: number;
  resolvedCount: number;
  items: { id: string; body: string; authorSide: string; status: string }[];
};

const SILENT_DAYS = 14;
const APPROVAL_STALE_DAYS = 3;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/** Danh sách rủi ro cần chăm sóc — dùng cho CS/Account và tool `showRisks`. */
export async function getRisks(ctx: AuthContext): Promise<RiskItem[]> {
  const scope =
    ctx.kind === "client"
      ? eq(project.organizationId, ctx.organizationId)
      : sql`1 = 1`;

  const projects = await db
    .select({
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
    })
    .from(project)
    .where(and(isNull(project.deletedAt), ne(project.status, "completed"), scope));

  const risks: RiskItem[] = [];

  // 1) Khách im lặng quá lâu (không có tương tác nào gần đây).
  const orgIds = Array.from(new Set(projects.map((p) => p.organizationId)));
  if (orgIds.length > 0) {
    const recent = await db
      .select({ organizationId: interactionEvent.organizationId })
      .from(interactionEvent)
      .where(
        and(
          inArray(interactionEvent.organizationId, orgIds),
          sql`${interactionEvent.createdAt} >= ${daysAgo(SILENT_DAYS).getTime()}`,
        ),
      );
    const activeOrgs = new Set(recent.map((r) => r.organizationId));

    const names = await db
      .select({ id: organization.id, name: organization.name })
      .from(organization)
      .where(inArray(organization.id, orgIds));
    const nameById = new Map(names.map((n) => [n.id, n.name]));

    for (const orgId of orgIds) {
      if (activeOrgs.has(orgId)) continue;
      const projectOfOrg = projects.find((p) => p.organizationId === orgId);
      if (!projectOfOrg) continue;
      risks.push({
        id: `silent:${orgId}`,
        level: "high",
        title: `${nameById.get(orgId) ?? "Khách hàng"} chưa tương tác ${SILENT_DAYS} ngày`,
        reason: "Nên chủ động liên hệ chăm sóc lại",
        projectId: projectOfOrg.id,
        projectName: projectOfOrg.name,
      });
    }
  }

  // 2) Yêu cầu duyệt treo quá lâu.
  const staleApprovals = await db
    .select({
      id: approval.id,
      projectId: approval.projectId,
      projectName: project.name,
      fileName: fileAsset.name,
      versionNumber: fileVersion.versionNumber,
      createdAt: approval.createdAt,
    })
    .from(approval)
    .innerJoin(project, eq(approval.projectId, project.id))
    .innerJoin(fileVersion, eq(approval.versionId, fileVersion.id))
    .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
    .where(
      and(
        eq(approval.status, "pending"),
        lt(approval.createdAt, daysAgo(APPROVAL_STALE_DAYS)),
        isNull(project.deletedAt),
        ctx.kind === "client" ? eq(project.organizationId, ctx.organizationId) : sql`1 = 1`,
      ),
    )
    .limit(10);

  for (const item of staleApprovals) {
    risks.push({
      id: `approval:${item.id}`,
      level: "medium",
      title: `${item.fileName} v${item.versionNumber} chờ duyệt quá ${APPROVAL_STALE_DAYS} ngày`,
      reason: `${item.projectName} đang bị chậm ở bước duyệt`,
      projectId: item.projectId,
      projectName: item.projectName,
    });
  }

  // 3) Việc quá hạn.
  const overdue = await db
    .select({
      id: task.id,
      title: task.title,
      projectId: task.projectId,
      projectName: project.name,
      dueDate: task.dueDate,
    })
    .from(task)
    .innerJoin(project, eq(task.projectId, project.id))
    .where(
      and(
        ne(task.status, "done"),
        lt(task.dueDate, new Date()),
        isNull(project.deletedAt),
        ctx.kind === "client" ? eq(project.organizationId, ctx.organizationId) : sql`1 = 1`,
      ),
    )
    .orderBy(task.dueDate)
    .limit(10);

  for (const item of overdue) {
    risks.push({
      id: `task:${item.id}`,
      level: "high",
      title: `${item.title} quá hạn`,
      reason: item.projectName,
      projectId: item.projectId,
      projectName: item.projectName,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return risks.sort((a, b) => rank[a.level] - rank[b.level]).slice(0, 8);
}

/** Gộp phản hồi theo phiên bản để designer đọc một lần thay vì 40 comment. */
export async function getFeedbackDigest(
  ctx: AuthContext,
  projectId: string,
): Promise<FeedbackDigest | null> {
  await assertProjectAccess(ctx, projectId, "read");

  const projectRows = await db
    .select({ name: project.name })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const rows = await db
    .select({
      id: feedback.id,
      body: feedback.body,
      status: feedback.status,
      authorSide: feedback.authorSide,
      versionId: feedback.versionId,
      versionNumber: fileVersion.versionNumber,
      fileName: fileAsset.name,
      createdAt: feedback.createdAt,
    })
    .from(feedback)
    .innerJoin(fileVersion, eq(feedback.versionId, fileVersion.id))
    .innerJoin(fileAsset, eq(feedback.fileId, fileAsset.id))
    .where(eq(fileAsset.projectId, projectId))
    .orderBy(desc(feedback.createdAt));

  if (rows.length === 0) {
    return {
      projectId,
      projectName: projectRows[0]?.name ?? "",
      fileName: "",
      versionId: "",
      versionNumber: 0,
      openCount: 0,
      resolvedCount: 0,
      items: [],
    };
  }

  // Nhóm theo phiên bản MỚI NHẤT có phản hồi mở (đó là việc cần làm tiếp).
  const openRows = rows.filter((r) => r.status === "open");
  const target = (openRows[0] ?? rows[0])!;
  const sameVersion = rows.filter((r) => r.versionId === target.versionId);

  return {
    projectId,
    projectName: projectRows[0]?.name ?? "",
    fileName: target.fileName,
    versionId: target.versionId,
    versionNumber: target.versionNumber,
    openCount: sameVersion.filter((r) => r.status === "open").length,
    resolvedCount: sameVersion.filter((r) => r.status !== "open").length,
    items: sameVersion.slice(0, 12).map((r) => ({
      id: r.id,
      body: r.body,
      authorSide: r.authorSide,
      status: r.status,
    })),
  };
}
