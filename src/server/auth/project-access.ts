import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { project, projectMember } from "@/db/sqlite/schema";
import {
  ForbiddenError,
  mayAccessProject,
  type AuthContext,
  type ProjectAccessLevel,
} from "./access";

/**
 * Truy cập dự án — tầng IO, **không** phụ thuộc `next/headers` để service và test
 * dùng được ngoài request. Việc đọc session nằm ở `guard.ts`.
 */

export type ProjectAccess = {
  projectId: string;
  organizationId: string;
  level: ProjectAccessLevel;
  pmId: string | null;
};

export async function assertProjectAccess(
  ctx: AuthContext,
  projectId: string,
  level: ProjectAccessLevel = "read",
): Promise<ProjectAccess> {
  const rows = await db
    .select({
      id: project.id,
      organizationId: project.organizationId,
      pmId: project.pmId,
      deletedAt: project.deletedAt,
    })
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);

  const found = rows[0];
  if (!found || found.deletedAt) throw new ForbiddenError("Không tìm thấy dự án");

  const assignmentRows = await db
    .select({ access: projectMember.access })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), eq(projectMember.userId, ctx.userId)))
    .limit(1);

  const decision = mayAccessProject(
    ctx,
    {
      organizationId: found.organizationId,
      pmId: found.pmId,
      assignment: assignmentRows[0]?.access ?? null,
    },
    level,
  );

  if (!decision.allowed) {
    throw new ForbiddenError(
      decision.reason === "cross_org"
        ? "Dữ liệu thuộc công ty khác"
        : "Bạn chưa được phân công vào dự án này",
    );
  }

  return {
    projectId: found.id,
    organizationId: found.organizationId,
    level,
    pmId: found.pmId,
  };
}

/** Chặn truy cập chéo tổ chức cho dữ liệu không thuộc dự án (brand vault, growth…). */
export function requireOrgScope(ctx: AuthContext, organizationId: string): void {
  if (ctx.kind === "client" && ctx.organizationId !== organizationId) {
    throw new ForbiddenError("Dữ liệu thuộc công ty khác");
  }
}
