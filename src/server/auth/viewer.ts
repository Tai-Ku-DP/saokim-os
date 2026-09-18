import "server-only";

import { getAuthContext, requireSession } from "./guard";
import type { ViewerType } from "@/lib/nav";

/**
 * Người dùng hiện tại cho tầng UI (shell, điều hướng, phân quyền hiển thị).
 *
 * Đây là lớp DUY NHẤT chuyển AuthContext (bảo mật) sang shape dùng cho giao diện.
 * Không nhánh code nào khác được suy ra quyền từ cookie hay input của client.
 */

export type StaffRole = "admin" | "pm" | "account" | "cs" | "designer" | "management";
export type ClientRole = "client_owner" | "client_member";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  type: ViewerType;
  staffRole?: StaffRole;
  clientRole?: ClientRole;
  organizationId?: string;
  organizationName?: string;
  title: string;
};

const STAFF_TITLES: Record<StaffRole, string> = {
  admin: "Quản trị hệ thống",
  pm: "Quản lý dự án",
  account: "Quản lý khách hàng",
  cs: "Chăm sóc khách hàng",
  designer: "Designer",
  management: "Ban lãnh đạo",
};

const CLIENT_TITLES: Record<ClientRole, string> = {
  client_owner: "Chủ doanh nghiệp",
  client_member: "Thành viên",
};

export async function getViewer(): Promise<Viewer> {
  const ctx = await requireSession();

  if (ctx.kind === "staff") {
    return {
      id: ctx.userId,
      name: ctx.name,
      email: ctx.email,
      type: "internal",
      staffRole: ctx.role,
      title: STAFF_TITLES[ctx.role],
    };
  }

  return {
    id: ctx.userId,
    name: ctx.name,
    email: ctx.email,
    type: "client",
    clientRole: ctx.role === "owner" ? "client_owner" : "client_member",
    organizationId: ctx.organizationId,
    organizationName: await organizationName(ctx.organizationId),
    title: CLIENT_TITLES[ctx.role === "owner" ? "client_owner" : "client_member"],
  };
}

/** Tên công ty hiển thị ở sidebar. Tách riêng để dễ cache/thay nguồn sau này. */
async function organizationName(organizationId: string): Promise<string | undefined> {
  const { db } = await import("@/db");
  const { organization } = await import("@/db/sqlite/schema");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);

  return rows[0]?.name;
}

/** Dùng ở layout/server component khi chỉ cần biết đã đăng nhập chưa (không redirect). */
export async function peekViewerType(): Promise<ViewerType | null> {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  return ctx.kind === "staff" ? "internal" : "client";
}
