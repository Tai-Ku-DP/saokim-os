import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { member, project, projectMember } from "@/db/sqlite/schema";
import { auth } from "./index";
import {
  can,
  mayAccessProject,
  staffRoleOf,
  type PermissionRequest,
  type ProjectAccessLevel,
} from "./access";
import type { ClientOrgRole, StaffRole } from "./permissions";

export type { PermissionRequest, ProjectAccessLevel } from "./access";

/**
 * Cửa duy nhất để biết "ai đang gọi và được làm gì" (docs/03 §4).
 *
 * - Quyết định quyền nằm ở `access.ts` (thuần, test được).
 * - `organizationId` luôn lấy từ session/membership, KHÔNG bao giờ từ input client.
 * - Tầng client chỉ ẩn/hiện UI; enforcement luôn ở đây.
 */

export type AuthContext =
  | { kind: "staff"; userId: string; name: string; email: string; role: StaffRole }
  | {
      kind: "client";
      userId: string;
      name: string;
      email: string;
      role: ClientOrgRole;
      organizationId: string;
    };

export class ForbiddenError extends Error {
  constructor(message = "Không có quyền thực hiện thao tác này") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Cần đăng nhập") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/** Đọc session + membership một lần cho mỗi request. */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = session.user as typeof session.user & { type?: string | null; role?: string | null };
  const base = { userId: user.id, name: user.name, email: user.email };

  if (user.type === "internal") {
    return { kind: "staff", ...base, role: staffRoleOf(user.role) };
  }

  /**
   * Tổ chức đang hoạt động: ưu tiên `activeOrganizationId` trên session; nếu chưa có
   * (đăng nhập thường, seed, magic link) thì resolve từ membership của chính người dùng.
   * Người dùng nhiều công ty chọn bằng `acceptInvitationAction`/org switcher.
   */
  const memberships = await db
    .select({ role: member.role, organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, user.id))
    .orderBy(member.createdAt);

  const activeOrganizationId = session.session.activeOrganizationId;
  const active =
    memberships.find((m) => m.organizationId === activeOrganizationId) ?? memberships[0];

  const role = active?.role;
  if (!active || (role !== "owner" && role !== "member")) return null;

  return { kind: "client", ...base, role, organizationId: active.organizationId };
});

/** Đánh giá quyền cho context hiện tại. */
export function authorize(ctx: AuthContext, permissions: PermissionRequest): boolean {
  return can(ctx, permissions);
}

export async function requireSession(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/sign-in");
  return ctx;
}

export async function requireStaff(): Promise<Extract<AuthContext, { kind: "staff" }>> {
  const ctx = await requireSession();
  if (ctx.kind !== "staff") throw new ForbiddenError("Khu vực dành cho nhân sự Sao Kim");
  return ctx;
}

export async function requireClientOrg(): Promise<Extract<AuthContext, { kind: "client" }>> {
  const ctx = await requireSession();
  if (ctx.kind !== "client") throw new ForbiddenError("Khu vực dành cho khách hàng");
  return ctx;
}

export async function requirePermission(permissions: PermissionRequest): Promise<AuthContext> {
  const ctx = await requireSession();
  if (!authorize(ctx, permissions)) throw new ForbiddenError();
  return ctx;
}

/** Chặn truy cập chéo tổ chức. Dùng cho mọi truy vấn chạm dữ liệu khách hàng. */
export function requireOrgScope(ctx: AuthContext, organizationId: string): void {
  if (ctx.kind === "client" && ctx.organizationId !== organizationId) {
    throw new ForbiddenError("Dữ liệu thuộc công ty khác");
  }
}

export type ProjectAccess = {
  projectId: string;
  organizationId: string;
  level: ProjectAccessLevel;
  pmId: string | null;
};

/** IO + áp quyết định thuần từ `mayAccessProject`. */
export async function requireProjectAccess(
  projectId: string,
  level: ProjectAccessLevel = "read",
): Promise<{ ctx: AuthContext; access: ProjectAccess }> {
  const ctx = await requireSession();

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
      decision.reason === "cross_org" ? "Dữ liệu thuộc công ty khác" : "Bạn chưa được phân công vào dự án này",
    );
  }

  return {
    ctx,
    access: { projectId: found.id, organizationId: found.organizationId, level, pmId: found.pmId },
  };
}
