import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  approval,
  fileAsset,
  fileVersion,
  notification,
  project,
  projectMember,
  serviceRequest,
  user,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { requireOrgScope } from "@/server/auth/project-access";
import { sendMail } from "@/server/mail";
import { notificationOutbox } from "@/db/sqlite/schema";

/**
 * Thông báo (PRD §15). Luồng: hành động nghiệp vụ → ghi `notification_outbox` trong
 * cùng transaction → worker gửi (in-app / email / webhook n8n) → có retry + idempotency.
 *
 * Quy tắc nội dung: ≤ 80 ký tự, luôn có deep-link (docs/00 §6).
 */

export type OutboxPayload = {
  kind: string;
  projectId?: string;
  [key: string]: unknown;
};

export type NotificationDraft = {
  userId: string;
  organizationId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
};

/* --------------------------------------------------- phân giải người nhận */

async function projectContext(projectId: string) {
  const rows = await db
    .select({
      id: project.id,
      name: project.name,
      organizationId: project.organizationId,
      pmId: project.pmId,
    })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

async function clientUserIds(projectId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.side, "client")));
  return rows.map((r) => r.userId);
}

async function staffUserIds(projectId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.side, "staff")));
  return rows.map((r) => r.userId);
}

/**
 * Biến payload outbox thành danh sách thông báo cụ thể.
 * Không tìm thấy người nhận ⇒ trả [] (không tạo thông báo rác).
 */
export async function resolveRecipients(payload: OutboxPayload): Promise<NotificationDraft[]> {
  const drafts: NotificationDraft[] = [];
  const projectId = typeof payload.projectId === "string" ? payload.projectId : undefined;
  const context = projectId ? await projectContext(projectId) : null;
  const push = (userId: string | null | undefined, draft: Omit<NotificationDraft, "userId" | "organizationId">) => {
    if (!userId || !context) return;
    drafts.push({ ...draft, userId, organizationId: context.organizationId });
  };

  switch (payload.kind) {
    case "version_uploaded": {
      const fileName = String(payload.fileName ?? "Tệp");
      const versionNumber = Number(payload.versionNumber ?? 1);
      for (const userId of await clientUserIds(String(projectId))) {
        push(userId, {
          type: "version_uploaded",
          title: `${fileName} v${versionNumber} đã có`,
          body: context?.name,
          link: `/projects/${projectId}/files`,
        });
      }
      push(context?.pmId, {
        type: "version_uploaded",
        title: `${fileName} v${versionNumber} vừa tải lên`,
        body: context?.name,
        link: `/projects/${projectId}/files`,
      });
      break;
    }

    case "feedback_created": {
      const authorSide = String(payload.authorSide ?? "client");
      const targets = authorSide === "client" ? await staffUserIds(String(projectId)) : await clientUserIds(String(projectId));
      for (const userId of targets) {
        push(userId, {
          type: "feedback_created",
          title: "Phản hồi mới cần xử lý",
          body: context?.name,
          link: `/projects/${projectId}/feedback`,
        });
      }
      break;
    }

    case "approval_requested": {
      const approvalId = String(payload.approvalId ?? "");
      if (!approvalId) break;
      const rows = await db
        .select({ approverId: approval.approverId, fileName: fileAsset.name, versionNumber: fileVersion.versionNumber })
        .from(approval)
        .innerJoin(fileVersion, eq(approval.versionId, fileVersion.id))
        .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
        .where(eq(approval.id, approvalId))
        .limit(1);

      push(rows[0]?.approverId, {
        type: "approval_requested",
        title: `${rows[0]?.fileName ?? "Phiên bản"} v${rows[0]?.versionNumber ?? ""} chờ duyệt`,
        body: context?.name,
        link: `/projects/${projectId}/approvals`,
      });
      break;
    }

    case "approval_decided": {
      const decision = String(payload.decision ?? "");
      const label = decision === "approved" ? "đã được duyệt" : "cần chỉnh sửa";
      for (const userId of [...(await staffUserIds(String(projectId))), ...(await clientUserIds(String(projectId)))]) {
        push(userId, {
          type: "approval_decided",
          title: `Phiên bản ${label}`,
          body: context?.name,
          link: `/projects/${projectId}/approvals`,
        });
      }
      break;
    }

    case "checklist_item_submitted":
    case "brand_brief_submitted": {
      push(context?.pmId, {
        type: String(payload.kind),
        title: payload.kind === "brand_brief_submitted" ? "Brand brief đã gửi" : "Khách vừa nộp tài liệu",
        body: context?.name,
        link: "/onboarding",
      });
      break;
    }

    case "document_requested": {
      for (const userId of await clientUserIds(String(projectId))) {
        push(userId, {
          type: "document_requested",
          title: `Cần nộp: ${String(payload.label ?? "tài liệu")}`,
          body: context?.name,
          link: "/onboarding",
        });
      }
      break;
    }

    case "onboarding_completed": {
      for (const userId of await clientUserIds(String(projectId))) {
        push(userId, {
          type: "onboarding_completed",
          title: "Onboarding đã hoàn tất",
          body: context?.name,
          link: `/projects/${projectId}/overview`,
        });
      }
      break;
    }

    case "handover_released": {
      for (const userId of await clientUserIds(String(projectId))) {
        push(userId, {
          type: "handover_released",
          title: "Bộ bàn giao đã sẵn sàng",
          body: context?.name,
          link: `/projects/${projectId}/handover`,
        });
      }
      break;
    }

    case "service_request_created": {
      const serviceRequestId = String(payload.serviceRequestId ?? "");
      const rows = await db
        .select({ title: serviceRequest.title, organizationId: serviceRequest.organizationId })
        .from(serviceRequest)
        .where(eq(serviceRequest.id, serviceRequestId))
        .limit(1);

      const accountUsers = await db
        .select({ id: user.id })
        .from(user)
        .where(
          and(
            eq(user.type, "internal"),
            sql`${user.role} in ('account', 'admin')`,
          ),
        );

      for (const account of accountUsers) {
        if (!rows[0]) break;
        drafts.push({
          userId: account.id,
          organizationId: rows[0].organizationId,
          type: "service_request_created",
          title: `Yêu cầu mới: ${rows[0].title}`.slice(0, 80),
          link: "/reports",
        });
      }
      break;
    }

    default:
      break;
  }

  // Loại trùng người nhận trong cùng một payload.
  const seen = new Set<string>();
  return drafts.filter((draft) => {
    const key = `${draft.userId}:${draft.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Ghi thông báo in-app. Bỏ qua nếu đã có thông báo cùng (user, type, link) trong 1 phút. */
export async function deliverInApp(drafts: NotificationDraft[]): Promise<number> {
  if (drafts.length === 0) return 0;
  let created = 0;

  for (const draft of drafts) {
    await db.insert(notification).values({
      userId: draft.userId,
      organizationId: draft.organizationId,
      type: draft.type,
      title: draft.title.slice(0, 120),
      body: draft.body ?? null,
      link: draft.link ?? null,
    });
    created += 1;
  }

  return created;
}

/** Gửi email cho các draft (dùng ở worker). */
export async function deliverEmail(drafts: NotificationDraft[]): Promise<number> {
  let sent = 0;
  for (const draft of drafts) {
    const rows = await db.select({ email: user.email }).from(user).where(eq(user.id, draft.userId)).limit(1);
    const email = rows[0]?.email;
    if (!email) continue;
    await sendMail(email, draft.title, `${draft.title}\n${draft.body ?? ""}\n${draft.link ?? ""}`.trim());
    sent += 1;
  }
  return sent;
}

/* --------------------------------------------------------------- đọc cho UI */

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export async function listNotifications(ctx: AuthContext, limit = 50): Promise<NotificationRow[]> {
  const rows = await db
    .select({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })
    .from(notification)
    .where(
      and(
        eq(notification.userId, ctx.userId),
        ctx.kind === "client" ? eq(notification.organizationId, ctx.organizationId) : sql`1 = 1`,
      ),
    )
    .orderBy(desc(notification.createdAt))
    .limit(limit);

  return rows;
}

export async function unreadCount(ctx: AuthContext): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(notification)
    .where(and(eq(notification.userId, ctx.userId), isNull(notification.readAt)));
  return Number(rows[0]?.total ?? 0);
}

export async function markNotificationRead(ctx: AuthContext, notificationId: string): Promise<void> {
  const rows = await db
    .select({ organizationId: notification.organizationId, userId: notification.userId })
    .from(notification)
    .where(eq(notification.id, notificationId))
    .limit(1);

  const row = rows[0];
  if (!row || row.userId !== ctx.userId) return;
  if (ctx.kind === "client") requireOrgScope(ctx, row.organizationId);

  await db.update(notification).set({ readAt: new Date() }).where(eq(notification.id, notificationId));
}

export async function markAllRead(ctx: AuthContext): Promise<void> {
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, ctx.userId), isNull(notification.readAt)));
}

/** Dùng bởi worker: đếm nhanh số mục đang chờ cho log. */
export async function pendingOutboxCount(): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(notificationOutbox)
    .where(eq(notificationOutbox.status, "pending"));
  return Number(rows[0]?.total ?? 0);
}
