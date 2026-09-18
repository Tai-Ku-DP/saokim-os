import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Bell,
  Compass,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

/** P2 sẽ thay bằng type sinh từ better-auth. */
export type ViewerType = "internal" | "client";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** chỉ khớp chính xác pathname (dùng cho mục gốc của nhóm) */
  exact?: boolean;
  badge?: "unread" | "actions";
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

/** Bề mặt khách hàng — không chứa từ nội bộ (docs/03 §1). */
export const CLIENT_NAV: NavGroup[] = [
  {
    items: [
      { label: "Hôm nay", href: "/today", icon: LayoutDashboard },
      { label: "Dự án", href: "/projects", icon: FolderKanban },
      { label: "Onboarding", href: "/onboarding", icon: Compass },
      { label: "Brand Home", href: "/brand-vault", icon: Archive },
      { label: "Thông báo", href: "/notifications", icon: Bell, badge: "unread" },
    ],
  },
  {
    label: "Tài khoản",
    items: [{ label: "Cài đặt", href: "/settings", icon: Settings }],
  },
];

/** Mặt nội bộ Sao Kim. */
export const STAFF_NAV: NavGroup[] = [
  {
    items: [
      { label: "Inbox", href: "/inbox", icon: Inbox, badge: "actions" },
      { label: "Dự án", href: "/projects", icon: FolderKanban },
      { label: "Khách hàng", href: "/clients", icon: Users },
      { label: "Onboarding", href: "/onboarding", icon: Compass },
      { label: "Báo cáo", href: "/reports", icon: BarChart3 },
      { label: "Thông báo", href: "/notifications", icon: Bell, badge: "unread" },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { label: "Quản trị", href: "/admin", icon: ShieldCheck },
      { label: "Cài đặt", href: "/settings", icon: Settings },
    ],
  },
];

export function navFor(viewerType: ViewerType): NavGroup[] {
  return viewerType === "internal" ? STAFF_NAV : CLIENT_NAV;
}

/** Lối vào đầu tiên sau khi đăng nhập, theo vai trò. */
export function homeFor(viewerType: ViewerType): string {
  return viewerType === "internal" ? "/inbox" : "/today";
}

export function isActivePath(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
