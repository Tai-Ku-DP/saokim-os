import "server-only";

import { and, asc, desc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  checklistItem,
  documentRequest,
  feedback,
  fileAsset,
  fileVersion,
  onboardingChecklist,
  project,
  projectMember,
  task,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { listPendingApprovalsForUser } from "./files";
import { countPendingDocuments } from "./onboarding";

/**
 * Bề mặt HÔM NAY (docs/00 §3–§4): hàng đợi hành động, tối đa 5 việc.
 *
 * Mỗi việc phải có: tiêu đề ngắn, lý do (1 dòng), CTA, mức ưu tiên và deep-link.
 * Nguyên tắc: một màn hình một hành động chính — Today không phải dashboard.
 */

export type ActionPriority = "overdue" | "today" | "soon" | "info";

export type ActionItem = {
  id: string;
  title: string;
  reason: string;
  href: string;
  cta: "approve" | "upload" | "review" | "open" | "comment";
  priority: ActionPriority;
};

const PRIORITY_RANK: Record<ActionPriority, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  info: 3,
};

const MAX_ITEMS = 5;

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getTodayActions(ctx: AuthContext): Promise<ActionItem[]> {
  const { start, end } = dayBounds();
  const items: ActionItem[] = [];

  // 1) Chờ TÔI duyệt — ưu tiên cao nhất với Client Owner.
  const approvals = await listPendingApprovalsForUser(ctx, 3);
  for (const approval of approvals) {
    items.push({
      id: `approval:${approval.id}`,
      title: `Duyệt ${approval.fileName} v${approval.versionNumber}`,
      reason: `${approval.projectName} đang chờ bạn`,
      href: `/projects/${approval.projectId}/approvals`,
      cta: "approve",
      priority: "today",
    });
  }

  // 2) Việc quá hạn / hôm nay của tôi.
  const myTasks = await db
    .select({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      projectId: task.projectId,
      projectName: project.name,
    })
    .from(task)
    .innerJoin(project, eq(task.projectId, project.id))
    .where(
      and(
        eq(task.ownerId, ctx.userId),
        ne(task.status, "done"),
        lt(task.dueDate, end),
        isNull(project.deletedAt),
      ),
    )
    .orderBy(asc(task.dueDate))
    .limit(3);

  for (const item of myTasks) {
    const overdue = item.dueDate !== null && item.dueDate.getTime() < start.getTime();
    items.push({
      id: `task:${item.id}`,
      title: item.title,
      reason: overdue
        ? `${item.projectName} · quá hạn`
        : `${item.projectName} · đến hạn hôm nay`,
      href: `/projects/${item.projectId}/overview`,
      cta: "open",
      priority: overdue ? "overdue" : "today",
    });
  }

  // 3) Việc phía khách hàng cần nộp (onboarding).
  if (ctx.kind === "client") {
    const pendingDocs = await db
      .select({
        id: checklistItem.id,
        label: checklistItem.label,
        dueAt: checklistItem.dueAt,
        projectId: onboardingChecklist.projectId,
        projectName: project.name,
      })
      .from(checklistItem)
      .innerJoin(onboardingChecklist, eq(checklistItem.checklistId, onboardingChecklist.id))
      .innerJoin(project, eq(onboardingChecklist.projectId, project.id))
      .where(
        and(
          inArray(checklistItem.status, ["todo", "rejected"]),
          eq(checklistItem.required, true),
          eq(checklistItem.ownerSide, "client"),
          eq(project.organizationId, ctx.organizationId),
          isNull(project.deletedAt),
        ),
      )
      .orderBy(asc(checklistItem.orderIndex))
      .limit(3);

    for (const item of pendingDocs) {
      const overdue = item.dueAt !== null && item.dueAt.getTime() < start.getTime();
      items.push({
        id: `checklist:${item.id}`,
        title: `Nộp ${item.label}`,
        reason: overdue ? `${item.projectName} · quá hạn` : item.projectName,
        href: "/onboarding",
        cta: "upload",
        priority: overdue ? "overdue" : "soon",
      });
    }

    // 4) Tài liệu PM đã yêu cầu nhưng chưa nhận.
    const requested = await db
      .select({ id: documentRequest.id, label: documentRequest.label, projectId: documentRequest.projectId })
      .from(documentRequest)
      .innerJoin(project, eq(documentRequest.projectId, project.id))
      .where(
        and(
          eq(documentRequest.status, "pending"),
          eq(project.organizationId, ctx.organizationId),
          isNull(project.deletedAt),
        ),
      )
      .limit(2);

    for (const doc of requested) {
      items.push({
        id: `doc:${doc.id}`,
        title: `Cung cấp ${doc.label}`,
        reason: "Cần cho tiến độ dự án",
        href: "/onboarding",
        cta: "upload",
        priority: "soon",
      });
    }
  }

  // 5) Phản hồi mới trên dự án tôi theo dõi (staff).
  if (ctx.kind === "staff") {
    const assigned = await db
      .select({ projectId: projectMember.projectId })
      .from(projectMember)
      .where(eq(projectMember.userId, ctx.userId));

    const ids = assigned.map((a) => a.projectId);
    if (ids.length > 0) {
      const newFeedback = await db
        .select({
          id: feedback.id,
          body: feedback.body,
          projectId: fileAsset.projectId,
          fileName: fileAsset.name,
          versionNumber: fileVersion.versionNumber,
          createdAt: feedback.createdAt,
        })
        .from(feedback)
        .innerJoin(fileAsset, eq(feedback.fileId, fileAsset.id))
        .innerJoin(fileVersion, eq(feedback.versionId, fileVersion.id))
        .where(and(inArray(fileAsset.projectId, ids), eq(feedback.status, "open")))
        .orderBy(desc(feedback.createdAt))
        .limit(3);

      for (const item of newFeedback) {
        items.push({
          id: `feedback:${item.id}`,
          title: `Xử lý phản hồi ${item.fileName} v${item.versionNumber}`,
          reason: item.body.slice(0, 60),
          href: `/projects/${item.projectId}/feedback`,
          cta: "review",
          priority: "today",
        });
      }
    }
  }

  // Loại trùng theo id, sắp theo ưu tiên, tối đa 5.
  const unique = new Map(items.map((item) => [item.id, item]));
  return Array.from(unique.values())
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])
    .slice(0, MAX_ITEMS);
}

export type TodaySummary = {
  activeProjects: number;
  pendingApprovals: number;
  overdueTasks: number;
  pendingDocuments: number;
};

/** Ba con số đầu màn hình — không phải dashboard, chỉ để định hướng. */
export async function getTodaySummary(ctx: AuthContext): Promise<TodaySummary> {
  const { end } = dayBounds();

  const activeProjects = await db
    .select({ id: project.id })
    .from(project)
    .where(
      and(
        ctx.kind === "client"
          ? eq(project.organizationId, ctx.organizationId)
          : ne(project.status, "completed"),
        ne(project.status, "completed"),
        isNull(project.deletedAt),
      ),
    )
    .limit(50);

  const overdueTasks = await db
    .select({ id: task.id })
    .from(task)
    .where(and(eq(task.ownerId, ctx.userId), ne(task.status, "done"), lt(task.dueDate, end)));

  const pendingApprovals = await listPendingApprovalsForUser(ctx, 50);

  // Dùng chung logic với Onboarding Hub để tránh hai định nghĩa "tài liệu còn thiếu".
  const pendingDocuments = await countPendingDocuments(ctx);

  return {
    activeProjects: activeProjects.length,
    pendingApprovals: pendingApprovals.length,
    overdueTasks: overdueTasks.length,
    pendingDocuments,
  };
}
