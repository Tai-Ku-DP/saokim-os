import "server-only";

import { asc, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companyProfile, member, organization, project } from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { requireOrgScope } from "@/server/auth/project-access";

/**
 * Danh sách khách hàng (tổ chức) — nhân sự Sao Kim dùng để chuyển ngữ cảnh.
 * P7 sẽ mở rộng thành hồ sơ 360° (lịch sử tương tác, signal, cơ hội).
 */

export type ClientOrganization = {
  id: string;
  name: string;
  industry: string | null;
  brandStage: string | null;
  activeProjects: number;
  memberCount: number;
  lastInteractionAt: Date | null;
};

export async function listClientOrganizations(ctx: AuthContext): Promise<ClientOrganization[]> {
  const rows = await db
    .select({
      id: organization.id,
      name: organization.name,
      industry: companyProfile.industry,
      brandStage: companyProfile.brandStage,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .leftJoin(companyProfile, eq(companyProfile.organizationId, organization.id))
    .orderBy(asc(organization.name));

  // Nhân sự thấy mọi khách hàng; khách hàng chỉ thấy công ty mình.
  const scoped =
    ctx.kind === "client" ? rows.filter((row) => row.id === ctx.organizationId) : rows;
  if (scoped.length === 0) return [];

  const projectCounts = await db
    .select({ organizationId: project.organizationId, total: count() })
    .from(project)
    .where(isNull(project.deletedAt))
    .groupBy(project.organizationId);

  const memberCounts = await db
    .select({ organizationId: member.organizationId, total: count() })
    .from(member)
    .groupBy(member.organizationId);

  const byOrg = (list: { organizationId: string; total: number }[], id: string) =>
    Number(list.find((row) => row.organizationId === id)?.total ?? 0);

  return scoped.map((row) => ({
    id: row.id,
    name: row.name,
    industry: row.industry,
    brandStage: row.brandStage,
    activeProjects: byOrg(projectCounts, row.id),
    memberCount: byOrg(memberCounts, row.id),
    lastInteractionAt: null,
  }));
}

/** Tổ chức mặc định khi nhân sự mở Brand Home mà chưa chọn khách hàng. */
export async function defaultOrganizationFor(ctx: AuthContext): Promise<string | null> {
  if (ctx.kind === "client") {
    requireOrgScope(ctx, ctx.organizationId);
    return ctx.organizationId;
  }

  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .orderBy(asc(organization.createdAt))
    .limit(1);

  return rows[0]?.id ?? null;
}
