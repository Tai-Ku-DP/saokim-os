import "server-only";

import { and, count, desc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  approval,
  fileAsset,
  milestone,
  organization,
  project,
  projectMember,
  task,
  user,
} from "@/db/sqlite/schema";
import type { ProjectStatus, ProjectType } from "@/db/types";
import { can, type AuthContext } from "@/server/auth/access";
import { assertProjectAccess, checkProjectAccess } from "@/server/auth/project-access";

/**
 * Truy vấn dự án — luôn scope theo quyền (docs/03 §4).
 * Client Owner thấy mọi dự án của công ty; Client Member chỉ thấy dự án được phân công;
 * staff có `project.manage_members` thấy tất cả, các vai trò khác theo phân công.
 */

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  brand_strategy: "Chiến lược thương hiệu",
  brand_identity: "Nhận diện thương hiệu",
  website: "Website",
  profile: "Profile / Brochure",
  packaging: "Bao bì",
  video: "Video",
  marcom: "Marcom",
  consulting: "Tư vấn",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Đang chạy",
  waiting_client: "Chờ khách",
  overdue: "Trễ hạn",
  completed: "Hoàn tất",
  paused: "Tạm dừng",
};

export type ProjectListItem = {
  id: string;
  code: string | null;
  name: string;
  typeLabel: string;
  status: ProjectStatus;
  statusLabel: string;
  progress: number;
  endDate: Date | null;
  pmName: string | null;
  organizationName: string;
  pendingApprovals: number;
  overdueTasks: number;
};

export type ProjectHeader = {
  id: string;
  name: string;
  code: string | null;
  typeLabel: string;
  status: ProjectStatus;
  statusLabel: string;
  progress: number;
  startDate: Date | null;
  endDate: Date | null;
  organizationName: string;
  pmName: string | null;
};

export type MilestoneRow = {
  id: string;
  name: string;
  status: string;
  dueDate: Date | null;
  isOverdue: boolean;
};

export type TeamRow = {
  userId: string;
  name: string;
  side: "client" | "staff";
  access: string;
};

/** Danh sách dự án người dùng được thấy. */
export async function listProjects(ctx: AuthContext): Promise<ProjectListItem[]> {
  const scopedIds = await visibleProjectIds(ctx);

  const rows = await db
    .select({
      id: project.id,
      code: project.code,
      name: project.name,
      projectType: project.projectType,
      status: project.status,
      progress: project.progress,
      endDate: project.endDate,
      pmName: user.name,
      organizationName: organization.name,
    })
    .from(project)
    .innerJoin(organization, eq(project.organizationId, organization.id))
    .leftJoin(user, eq(project.pmId, user.id))
    .where(
      scopedIds === "all"
        ? isNull(project.deletedAt)
        : and(isNull(project.deletedAt), inArray(project.id, scopedIds)),
    )
    .orderBy(desc(project.updatedAt));

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const now = new Date();

  const pending = await db
    .select({ projectId: approval.projectId, total: count() })
    .from(approval)
    .where(and(inArray(approval.projectId, ids), eq(approval.status, "pending")))
    .groupBy(approval.projectId);

  const overdue = await db
    .select({ projectId: task.projectId, total: count() })
    .from(task)
    .where(
      and(
        inArray(task.projectId, ids),
        lt(task.dueDate, now),
        ne(task.status, "done"),
      ),
    )
    .groupBy(task.projectId);

  const pendingMap = new Map(pending.map((p) => [p.projectId, Number(p.total)]));
  const overdueMap = new Map(overdue.map((p) => [p.projectId, Number(p.total)]));

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    typeLabel: PROJECT_TYPE_LABELS[row.projectType],
    status: row.status,
    statusLabel: PROJECT_STATUS_LABELS[row.status],
    progress: row.progress,
    endDate: row.endDate,
    pmName: row.pmName,
    organizationName: row.organizationName,
    pendingApprovals: pendingMap.get(row.id) ?? 0,
    overdueTasks: overdueMap.get(row.id) ?? 0,
  }));
}

/**
 * Header dự án cho **tầng trang**: `null` khi không có quyền hoặc dự án không tồn tại.
 *
 * Không ném `ForbiddenError` để page dịch thành `notFound()` — người dùng không bị ném
 * vào error boundary chung, và cũng không lộ dự án nào đang tồn tại (docs/03 §4).
 * Thao tác ghi vẫn luôn đi qua `assertProjectAccess` (403 có phân biệt lý do).
 */
export async function getProjectHeader(
  ctx: AuthContext,
  projectId: string,
): Promise<ProjectHeader | null> {
  const access = await checkProjectAccess(ctx, projectId, "read");
  if (!access.allowed) return null;

  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      code: project.code,
      projectType: project.projectType,
      status: project.status,
      progress: project.progress,
      startDate: project.startDate,
      endDate: project.endDate,
      pmName: user.name,
      organizationName: organization.name,
    })
    .from(project)
    .innerJoin(organization, eq(project.organizationId, organization.id))
    .leftJoin(user, eq(project.pmId, user.id))
    .where(and(eq(project.id, projectId), isNull(project.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    code: row.code,
    typeLabel: PROJECT_TYPE_LABELS[row.projectType],
    status: row.status,
    statusLabel: PROJECT_STATUS_LABELS[row.status],
    progress: row.progress,
    startDate: row.startDate,
    endDate: row.endDate,
    pmName: row.pmName,
    organizationName: row.organizationName,
  };
}

export async function listMilestones(ctx: AuthContext, projectId: string): Promise<MilestoneRow[]> {
  await assertProjectAccess(ctx, projectId, "read");

  const rows = await db
    .select({
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
      dueDate: milestone.dueDate,
    })
    .from(milestone)
    .where(eq(milestone.projectId, projectId))
    .orderBy(milestone.orderIndex);

  const now = Date.now();
  return rows.map((row) => ({
    ...row,
    isOverdue: row.dueDate !== null && row.dueDate.getTime() < now && row.status !== "done",
  }));
}

export async function listProjectTeam(ctx: AuthContext, projectId: string): Promise<TeamRow[]> {
  await assertProjectAccess(ctx, projectId, "read");

  return db
    .select({
      userId: projectMember.userId,
      name: user.name,
      side: projectMember.side,
      access: projectMember.access,
    })
    .from(projectMember)
    .innerJoin(user, eq(projectMember.userId, user.id))
    .where(eq(projectMember.projectId, projectId))
    .orderBy(projectMember.side);
}

export async function countProjectFiles(ctx: AuthContext, projectId: string): Promise<number> {
  await assertProjectAccess(ctx, projectId, "read");
  const rows = await db
    .select({ total: count() })
    .from(fileAsset)
    .where(and(eq(fileAsset.projectId, projectId), isNull(fileAsset.deletedAt)));
  return Number(rows[0]?.total ?? 0);
}

/**
 * Tập dự án người dùng được thấy.
 * `"all"` = không giới hạn (staff quản lý dự án).
 */
async function visibleProjectIds(ctx: AuthContext): Promise<string[] | "all"> {
  if (ctx.kind === "client") {
    const orgProjects = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.organizationId, ctx.organizationId), isNull(project.deletedAt)));

    if (ctx.role === "owner") return orgProjects.map((p) => p.id);

    const assigned = await db
      .select({ projectId: projectMember.projectId })
      .from(projectMember)
      .where(eq(projectMember.userId, ctx.userId));

    const assignedIds = new Set(assigned.map((a) => a.projectId));
    return orgProjects.filter((p) => assignedIds.has(p.id)).map((p) => p.id);
  }

  if (can(ctx, { project: ["manage_members"] })) return "all";

  const assigned = await db
    .select({ projectId: projectMember.projectId })
    .from(projectMember)
    .where(eq(projectMember.userId, ctx.userId));

  return assigned.map((a) => a.projectId);
}

/** Đếm dự án đang chạy — dùng ở bề mặt Hôm nay. */
export async function countActiveProjects(ctx: AuthContext): Promise<number> {
  const scoped = await visibleProjectIds(ctx);
  if (scoped !== "all" && scoped.length === 0) return 0;

  const rows = await db
    .select({ total: count() })
    .from(project)
    .where(
      scoped === "all"
        ? and(isNull(project.deletedAt), ne(project.status, "completed"))
        : and(
            inArray(project.id, scoped),
            isNull(project.deletedAt),
            ne(project.status, "completed"),
          ),
    );

  return Number(rows[0]?.total ?? 0);
}
