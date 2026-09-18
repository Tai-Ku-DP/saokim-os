import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  approval,
  companyProfile,
  feedback,
  fileAsset,
  fileVersion,
  interactionEvent,
  onboardingChecklist,
  opportunity,
  organization,
  project,
  projectMember,
  serviceRequest,
  task,
  user,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { can } from "@/server/auth/access";

/**
 * Dữ liệu cho mặt nội bộ: Inbox (việc của tôi) và Báo cáo (chất lượng delivery,
 * pipeline upsell) — PRD §20.
 */

export type InboxGroup = {
  key: string;
  title: string;
  hint?: string;
  items: {
    id: string;
    title: string;
    reason: string;
    href: string;
    priority: "overdue" | "today" | "soon";
  }[];
};

export async function getInbox(ctx: AuthContext): Promise<InboxGroup[]> {
  const groups: InboxGroup[] = [];

  // 1) Việc quá hạn / đến hạn của tôi.
  const myTasks = await db
    .select({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      status: task.status,
      projectId: task.projectId,
      projectName: project.name,
    })
    .from(task)
    .innerJoin(project, eq(task.projectId, project.id))
    .where(
      and(
        eq(task.ownerId, ctx.userId),
        ne(task.status, "done"),
        isNull(project.deletedAt),
      ),
    )
    .orderBy(asc(task.dueDate))
    .limit(10);

  const now = Date.now();
  groups.push({
    key: "tasks",
    title: "Việc của tôi",
    hint: myTasks.length === 0 ? "Không có việc tồn" : `${myTasks.length} việc`,
    items: myTasks.map((item) => {
      const overdue = item.dueDate !== null && item.dueDate.getTime() < now;
      return {
        id: `task:${item.id}`,
        title: item.title,
        reason: overdue ? `${item.projectName} · quá hạn` : item.projectName,
        href: `/projects/${item.projectId}/overview`,
        priority: overdue ? "overdue" : "today",
      };
    }),
  });

  // 2) Phản hồi khách đang mở trong các dự án tôi phụ trách.
  const myProjects = await db
    .select({ projectId: projectMember.projectId })
    .from(projectMember)
    .where(and(eq(projectMember.userId, ctx.userId), eq(projectMember.side, "staff")));

  const projectIds = myProjects.map((p) => p.projectId);

  if (projectIds.length > 0) {
    const openFeedback = await db
      .select({
        id: feedback.id,
        body: feedback.body,
        projectId: fileAsset.projectId,
        fileName: fileAsset.name,
        versionNumber: fileVersion.versionNumber,
        createdAt: feedback.createdAt,
        authorSide: feedback.authorSide,
      })
      .from(feedback)
      .innerJoin(fileAsset, eq(feedback.fileId, fileAsset.id))
      .innerJoin(fileVersion, eq(feedback.versionId, fileVersion.id))
      .where(and(inArray(fileAsset.projectId, projectIds), eq(feedback.status, "open")))
      .orderBy(desc(feedback.createdAt))
      .limit(10);

    groups.push({
      key: "feedback",
      title: "Phản hồi chờ xử lý",
      hint: openFeedback.length === 0 ? "Đã xử lý hết" : `${openFeedback.length} phản hồi`,
      items: openFeedback.map((item) => ({
        id: `feedback:${item.id}`,
        title: `${item.fileName} v${item.versionNumber}`,
        reason: item.body.slice(0, 60),
        href: `/projects/${item.projectId}/feedback`,
        priority: item.authorSide === "client" ? "today" : "soon",
      })),
    });
  }

  // 3) Khách đang chờ ta phản hồi (duyệt treo).
  const waiting = await db
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
    .where(and(eq(approval.status, "pending"), isNull(project.deletedAt)))
    .orderBy(asc(approval.createdAt))
    .limit(10);

  groups.push({
    key: "waiting",
    title: "Đang chờ duyệt",
    hint: waiting.length === 0 ? "Không có" : `${waiting.length} phiên bản`,
    items: waiting.map((item) => ({
      id: `approval:${item.id}`,
      title: `${item.fileName} v${item.versionNumber}`,
      reason: `${item.projectName} · gửi ${Math.max(1, Math.round((now - item.createdAt.getTime()) / 86_400_000))} ngày trước`,
      href: `/projects/${item.projectId}/approvals`,
      priority: "soon",
    })),
  });

  return groups;
}

export type DeliveryHealth = {
  activeProjects: number;
  overdueTasks: number;
  pendingApprovals: number;
  onboardingRate: number;
  openIssues: number;
  serviceRequests: number;
  pipelineValueCents: number;
  activeClients: number;
};

/** Số liệu chất lượng delivery + pipeline (PRD §20). */
export async function getDeliveryHealth(ctx: AuthContext): Promise<DeliveryHealth> {
  if (!can(ctx, { report: ["read_all"] }) && !can(ctx, { report: ["read_own"] })) {
    return {
      activeProjects: 0,
      overdueTasks: 0,
      pendingApprovals: 0,
      onboardingRate: 0,
      openIssues: 0,
      serviceRequests: 0,
      pipelineValueCents: 0,
      activeClients: 0,
    };
  }

  const [activeProjects] = await db
    .select({ total: count() })
    .from(project)
    .where(and(isNull(project.deletedAt), ne(project.status, "completed")));

  const [overdueTasks] = await db
    .select({ total: count() })
    .from(task)
    .where(and(ne(task.status, "done"), lt(task.dueDate, new Date())));

  const [pendingApprovals] = await db
    .select({ total: count() })
    .from(approval)
    .where(eq(approval.status, "pending"));

  const checklistRows = await db
    .select({ status: onboardingChecklist.status })
    .from(onboardingChecklist);
  const onboardingRate =
    checklistRows.length === 0
      ? 0
      : Math.round(
          (checklistRows.filter((row) => row.status === "completed").length / checklistRows.length) * 100,
        );

  const [openIssues] = await db
    .select({ total: count() })
    .from(project)
    .where(and(isNull(project.deletedAt), eq(project.status, "overdue")));

  const [serviceRequests] = await db.select({ total: count() }).from(serviceRequest);
  const pipeline = await db
    .select({ value: opportunity.valueCents })
    .from(opportunity)
    .where(ne(opportunity.stage, "lost"));
  const [activeClients] = await db.select({ total: count() }).from(organization);

  return {
    activeProjects: Number(activeProjects?.total ?? 0),
    overdueTasks: Number(overdueTasks?.total ?? 0),
    pendingApprovals: Number(pendingApprovals?.total ?? 0),
    onboardingRate,
    openIssues: Number(openIssues?.total ?? 0),
    serviceRequests: Number(serviceRequests?.total ?? 0),
    pipelineValueCents: pipeline.reduce((sum, row) => sum + (row.value ?? 0), 0),
    activeClients: Number(activeClients?.total ?? 0),
  };
}

export type ClientDetail = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  brandStage: string | null;
  projects: { id: string; name: string; status: string; progress: number }[];
  interactions: { id: string; action: string; createdAt: Date; userName: string | null }[];
  lastInteractionAt: Date | null;
  opportunities: { id: string; stage: string; valueCents: number | null }[];
};

/** Hồ sơ khách hàng 360° (PRD §20 ClientDashboard/AccountDashboard). */
export async function getClientDetail(
  ctx: AuthContext,
  organizationId: string,
): Promise<ClientDetail | null> {
  if (ctx.kind === "client" && ctx.organizationId !== organizationId) return null;

  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      industry: companyProfile.industry,
      website: companyProfile.website,
      brandStage: companyProfile.brandStage,
    })
    .from(organization)
    .leftJoin(companyProfile, eq(companyProfile.organizationId, organization.id))
    .where(eq(organization.id, organizationId))
    .limit(1);

  const org = rows[0];
  if (!org) return null;

  const projects = await db
    .select({
      id: project.id,
      name: project.name,
      status: project.status,
      progress: project.progress,
    })
    .from(project)
    .where(and(eq(project.organizationId, organizationId), isNull(project.deletedAt)))
    .orderBy(desc(project.updatedAt));

  const interactions = await db
    .select({
      id: interactionEvent.id,
      action: interactionEvent.action,
      createdAt: interactionEvent.createdAt,
      userName: user.name,
    })
    .from(interactionEvent)
    .leftJoin(user, eq(interactionEvent.userId, user.id))
    .where(eq(interactionEvent.organizationId, organizationId))
    .orderBy(desc(interactionEvent.createdAt))
    .limit(15);

  const opportunities = await db
    .select({
      id: opportunity.id,
      stage: opportunity.stage,
      valueCents: opportunity.valueCents,
    })
    .from(opportunity)
    .where(eq(opportunity.organizationId, organizationId))
    .orderBy(desc(opportunity.createdAt))
    .limit(10);

  return {
    ...org,
    projects,
    interactions,
    lastInteractionAt: interactions[0]?.createdAt ?? null,
    opportunities,
  };
}


