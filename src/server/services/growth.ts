import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  growthRecommendation,
  opportunity,
  project,
  servicePackage,
  serviceRequest,
} from "@/db/sqlite/schema";
import { can, type AuthContext } from "@/server/auth/access";
import { requireOrgScope } from "@/server/auth/project-access";
import { DomainError } from "./errors";
import { enqueueInTx } from "./outbox";

/**
 * Growth Hub — phần ghi dữ liệu (PRD §10). P6 sẽ bổ sung lộ trình, đề xuất dịch vụ
 * và brand home; phần "khách gửi yêu cầu" nằm ở đây vì cả UI và AI đều dùng.
 *
 * CRM (Odoo) KHÔNG được gọi trực tiếp: portal chỉ ghi `opportunity` làm signal.
 */

export type ServiceRequestRow = {
  id: string;
  title: string;
  status: string;
  serviceName: string | null;
  createdAt: Date;
};

export async function createServiceRequest(
  ctx: AuthContext,
  input: { title: string; note?: string; serviceId?: string; projectId?: string },
): Promise<string> {
  if (!can(ctx, { growth: ["request"] })) {
    throw new DomainError("INVALID_INPUT", "Bạn không có quyền gửi yêu cầu dịch vụ");
  }

  const organizationId =
    ctx.kind === "client" ? ctx.organizationId : await organizationOfProject(input.projectId);

  if (ctx.kind === "client") requireOrgScope(ctx, organizationId);
  if (!input.title.trim()) throw new DomainError("INVALID_INPUT", "Cần tiêu đề yêu cầu");

  return db.transaction((tx) => {
    const created = tx
      .insert(serviceRequest)
      .values({
        organizationId,
        projectId: input.projectId ?? null,
        serviceId: input.serviceId ?? null,
        requestedBy: ctx.userId,
        title: input.title.trim(),
        note: input.note ?? null,
        status: "new",
      })
      .returning({ id: serviceRequest.id })
      .get();

    // Signal sang CRM — KHÔNG gọi Odoo trực tiếp (ADR-003 / PRD §16).
    tx.insert(opportunity)
      .values({
        organizationId,
        source: "service_request",
        serviceId: input.serviceId ?? null,
        stage: "new",
        ownerId: ctx.kind === "staff" ? ctx.userId : null,
        crmRef: null,
      })
      .run();

    tx.insert(auditLog)
      .values({
        organizationId,
        actorId: ctx.userId,
        action: "service_request.created",
        entity: "service_request",
        entityId: created.id,
        after: { title: input.title, source: "manual_or_ai" },
      })
      .run();

    enqueueInTx(tx, {
      organizationId,
      channel: "webhook",
      idempotencyKey: `service-request:${created.id}`,
      payload: { kind: "service_request_created", serviceRequestId: created.id, organizationId },
    });

    return created.id;
  });
}

export async function listServiceRequests(ctx: AuthContext): Promise<ServiceRequestRow[]> {
  const organizationId = ctx.kind === "client" ? ctx.organizationId : null;

  const rows = await db
    .select({
      id: serviceRequest.id,
      title: serviceRequest.title,
      status: serviceRequest.status,
      serviceName: servicePackage.name,
      createdAt: serviceRequest.createdAt,
    })
    .from(serviceRequest)
    .leftJoin(servicePackage, eq(serviceRequest.serviceId, servicePackage.id))
    .where(organizationId ? eq(serviceRequest.organizationId, organizationId) : undefined)
    .orderBy(desc(serviceRequest.createdAt))
    .limit(20);

  return rows;
}

export type RecommendationRow = {
  id: string;
  serviceName: string | null;
  priority: number;
  status: string;
  rule: string;
};

export async function listRecommendations(ctx: AuthContext): Promise<RecommendationRow[]> {
  const organizationId = ctx.kind === "client" ? ctx.organizationId : null;

  const rows = await db
    .select({
      id: growthRecommendation.id,
      serviceName: servicePackage.name,
      priority: growthRecommendation.priority,
      status: growthRecommendation.status,
      trigger: growthRecommendation.trigger,
    })
    .from(growthRecommendation)
    .leftJoin(servicePackage, eq(growthRecommendation.serviceId, servicePackage.id))
    .where(organizationId ? eq(growthRecommendation.organizationId, organizationId) : undefined)
    .orderBy(desc(growthRecommendation.priority))
    .limit(10);

  return rows.map((row) => ({
    id: row.id,
    serviceName: row.serviceName,
    priority: row.priority,
    status: row.status,
    rule: row.trigger?.rule ?? "manual",
  }));
}

export async function listServicePackages(ctx: AuthContext) {
  void ctx;
  return db
    .select({
      id: servicePackage.id,
      name: servicePackage.name,
      category: servicePackage.category,
      description: servicePackage.description,
      priceRange: servicePackage.priceRange,
    })
    .from(servicePackage)
    .where(eq(servicePackage.active, true))
    .limit(20);
}

/** Tổ chức của dự án — dùng khi nhân sự tạo yêu cầu thay khách. */
async function organizationOfProject(projectId?: string): Promise<string> {
  if (!projectId) {
    throw new DomainError("INVALID_INPUT", "Cần chọn dự án để gắn yêu cầu dịch vụ");
  }
  const rows = await db
    .select({ organizationId: project.organizationId })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  if (!rows[0]) throw new DomainError("INVALID_INPUT", "Không tìm thấy dự án");
  return rows[0].organizationId;
}
