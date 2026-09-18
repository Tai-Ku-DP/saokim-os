import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member } from "@/db/sqlite/schema";
import { auth } from "./index";
import {
  can,
  ForbiddenError,
  staffRoleOf,
  type AuthContext,
  type PermissionRequest,
  type ProjectAccessLevel,
} from "./access";
import { assertProjectAccess, type ProjectAccess } from "./project-access";
import type { ClientOrgRole } from "./permissions";

/**
 * Xác thực + phân quyền ở tầng request (docs/03 §4).
 *
 * Quyết định quyền nằm ở `access.ts` (thuần). Truy cập dự án nằm ở `project-access.ts`
 * (IO, không Next). File này chỉ thêm phần phụ thuộc request: session, redirect.
 */

export { ForbiddenError, UnauthenticatedError } from "./access";
export type { AuthContext, PermissionRequest, ProjectAccessLevel } from "./access";
export { assertProjectAccess, requireOrgScope, type ProjectAccess } from "./project-access";

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
   */
  const memberships = await db
    .select({ role: member.role, organizationId: member.organizationId })
    .from(member)
    .where(eq(member.userId, user.id))
    .orderBy(member.createdAt);

  const active =
    memberships.find((m) => m.organizationId === session.session.activeOrganizationId) ??
    memberships[0];

  const role = active?.role as ClientOrgRole | undefined;
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

/** Đọc session rồi kiểm tra truy cập dự án — dùng ở page/action. */
export async function requireProjectAccess(
  projectId: string,
  level: ProjectAccessLevel = "read",
): Promise<{ ctx: AuthContext; access: ProjectAccess }> {
  const ctx = await requireSession();
  const access = await assertProjectAccess(ctx, projectId, level);
  return { ctx, access };
}
