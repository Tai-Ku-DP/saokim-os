"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { isActivePath, navFor, type ViewerType } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function AppSidebar({
  viewerType,
  workspaceName,
  unreadCount = 0,
  actionCount = 0,
}: {
  viewerType: ViewerType;
  workspaceName: string;
  unreadCount?: number;
  actionCount?: number;
}) {
  const pathname = usePathname();
  const groups = navFor(viewerType);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          href={viewerType === "internal" ? "/inbox" : "/today"}
          className="flex items-center gap-2.5 px-1.5 py-1.5"
        >
          <span className="spark-gradient grid size-7 shrink-0 place-items-center rounded-md">
            <Sparkles size={15} className="text-white" aria-hidden />
          </span>
          <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-semibold text-ink">BrandCare</span>
            <span className="truncate text-[11px] text-ink-3">{workspaceName}</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group, gi) => (
          <SidebarGroup key={group.label ?? `group-${gi}`}>
            {group.label ? <SidebarGroupLabel>{group.label}</SidebarGroupLabel> : null}
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isActivePath(pathname, item);
                const count = item.badge === "unread" ? unreadCount : item.badge === "actions" ? actionCount : 0;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href} aria-current={active ? "page" : undefined}>
                        <item.icon size={16} aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    {count > 0 ? (
                      <SidebarMenuBadge className={cn("tnum", item.badge === "actions" && "bg-brand text-white")}>
                        {count > 99 ? "99+" : count}
                      </SidebarMenuBadge>
                    ) : null}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        <p className="px-1.5 py-1 text-[11px] leading-4 text-ink-3">
          Onboarding → Delivery → Growth → Brand care
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
