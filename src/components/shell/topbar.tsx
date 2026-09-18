"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronsUpDown, LogOut, Monitor, Moon, Search, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/shell/command-palette";
import { AiPanel } from "@/components/ai/ai-panel";
import type { PromptKey } from "@/ai/prompts";
import { signOutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/server/auth/viewer";

function ThemeItems() {
  const { setTheme } = useTheme();
  return (
    <>
      <DropdownMenuItem onClick={() => setTheme("light")}>
        <Sun size={14} aria-hidden /> Sáng
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("dark")}>
        <Moon size={14} aria-hidden /> Tối
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setTheme("system")}>
        <Monitor size={14} aria-hidden /> Theo hệ thống
      </DropdownMenuItem>
    </>
  );
}

export function Topbar({
  viewer,
  unreadCount = 0,
  aiCanWrite = false,
  aiDemo = false,
}: {
  viewer: Viewer;
  unreadCount?: number;
  aiCanWrite?: boolean;
  aiDemo?: boolean;
}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Ngữ cảnh cho prompt: bề mặt nào + dự án nào (nếu đang trong một dự án).
  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const surface: PromptKey = pathname.startsWith("/today")
    ? "today.v1"
    : pathname.startsWith("/projects")
      ? "workroom.v1"
      : pathname.startsWith("/brand-vault") || pathname.startsWith("/growth")
        ? "brand-home.v1"
        : "general.v1";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      // "g" rồi "t/p/o/b" — điều hướng nhanh (docs/02 §8)
      if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur">
      <SidebarTrigger className="-ml-1" />

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 text-left text-[13px] text-ink-3 transition-colors hover:border-line-strong md:max-w-72"
      >
        <Search size={14} aria-hidden />
        <span className="truncate">Tìm hoặc ra lệnh…</span>
        <span className="kbd ml-auto hidden md:inline">⌘K</span>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-ink-2"
              aria-label="Trợ lý AI"
              onClick={() => setAiOpen(true)}
            >
              <Sparkles size={15} aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Trợ lý AI · ⌘K</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="relative text-ink-2" asChild>
              <Link href="/notifications" aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"}>
                <Bell size={15} aria-hidden />
                {unreadCount > 0 ? (
                  <span className="tnum absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-4 text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Thông báo</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 px-1.5 text-ink-2">
              <span className="grid size-6 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">
                {viewer.name.slice(0, 1)}
              </span>
              <span className="hidden max-w-32 truncate text-[12px] text-ink md:inline">{viewer.name}</span>
              <ChevronsUpDown size={13} aria-hidden className="hidden md:inline" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="grid gap-0.5">
              <span className="text-[13px] font-semibold text-ink">{viewer.name}</span>
              <span className={cn("text-[11px] text-ink-3")}>
                {viewer.title}
                {viewer.organizationName ? ` · ${viewer.organizationName}` : ""}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="label-xs">Giao diện</DropdownMenuLabel>
            <ThemeItems />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>Cài đặt</DropdownMenuItem>
            <form action={signOutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full cursor-pointer">
                  <LogOut size={14} aria-hidden /> Đăng xuất
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        viewerType={viewer.type}
        onAskAi={() => setAiOpen(true)}
      />

      <Sheet open={aiOpen} onOpenChange={setAiOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Trợ lý AI</SheetTitle>
          </SheetHeader>
          <AiPanel
            surface={surface}
            projectId={projectId}
            canWrite={aiCanWrite}
            demo={aiDemo}
          />
        </SheetContent>
      </Sheet>
    </header>
  );
}
