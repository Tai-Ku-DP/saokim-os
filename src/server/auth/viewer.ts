import "server-only";

import { cookies } from "next/headers";
import type { ViewerType } from "@/lib/nav";

/**
 * Người dùng hiện tại.
 *
 * ⚠️ P1 (tạm thời): chưa nối better-auth. Hàm này trả về viewer giả để shell và
 * điều hướng chạy được, và cho phép đổi vai trò khi review giao diện:
 *
 *     document.cookie = "bc-viewer=pm"            // nhân sự Sao Kim
 *     document.cookie = "bc-viewer=client_owner"  // chủ doanh nghiệp khách hàng
 *
 * P2 sẽ thay toàn bộ thân hàm này bằng `auth.api.getSession({ headers: await headers() })`
 * và bổ sung `requireStaff`, `requireClientOrg`, `requireProjectAccess` trong
 * `src/server/auth/guard.ts` (docs/03 §4). Không nhánh code nào khác được đọc cookie
 * để suy ra quyền — đây là điểm thay thế duy nhất.
 */

export type StaffRole = "admin" | "pm" | "account" | "cs" | "designer" | "management";
export type ClientRole = "client_owner" | "client_member";

export type Viewer = {
  id: string;
  name: string;
  email: string;
  type: ViewerType;
  /** type = "internal" */
  staffRole?: StaffRole;
  /** type = "client" */
  clientRole?: ClientRole;
  organizationId?: string;
  organizationName?: string;
  title: string;
};

const DEMO_VIEWERS: Record<string, Viewer> = {
  pm: {
    id: "demo-pm",
    name: "Nguyễn Minh Anh",
    email: "minhanh@saokim.vn",
    type: "internal",
    staffRole: "pm",
    title: "Quản lý dự án",
  },
  admin: {
    id: "demo-admin",
    name: "Trần Quốc Bảo",
    email: "quocbao@saokim.vn",
    type: "internal",
    staffRole: "admin",
    title: "Quản trị hệ thống",
  },
  account: {
    id: "demo-account",
    name: "Lê Thu Hà",
    email: "thuha@saokim.vn",
    type: "internal",
    staffRole: "account",
    title: "Quản lý khách hàng",
  },
  cs: {
    id: "demo-cs",
    name: "Phạm Gia Linh",
    email: "gialinh@saokim.vn",
    type: "internal",
    staffRole: "cs",
    title: "Chăm sóc khách hàng",
  },
  designer: {
    id: "demo-designer",
    name: "Đỗ Hoàng Nam",
    email: "hoangnam@saokim.vn",
    type: "internal",
    staffRole: "designer",
    title: "Designer",
  },
  client_owner: {
    id: "demo-client-owner",
    name: "Vũ Thanh Tùng",
    email: "tung.vu@anphatland.vn",
    type: "client",
    clientRole: "client_owner",
    organizationId: "demo-org-anphat",
    organizationName: "An Phát Land",
    title: "Giám đốc Marketing",
  },
  client_member: {
    id: "demo-client-member",
    name: "Ngô Khánh Vy",
    email: "vy.ngo@anphatland.vn",
    type: "client",
    clientRole: "client_member",
    organizationId: "demo-org-anphat",
    organizationName: "An Phát Land",
    title: "Chuyên viên marketing",
  },
};

export async function getViewer(): Promise<Viewer> {
  const store = await cookies();
  const requested = store.get("bc-viewer")?.value;
  const demo = requested ? DEMO_VIEWERS[requested] : undefined;
  if (demo) return demo;

  // Mặc định khi review: PM của Sao Kim.
  return DEMO_VIEWERS.pm;
}
