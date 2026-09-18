"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Tổng quan", href: "overview" },
  { label: "Tệp", href: "files" },
  { label: "Phản hồi", href: "feedback" },
  { label: "Duyệt", href: "approvals" },
  { label: "Bàn giao", href: "handover" },
] as const;

/** Điều hướng trong dự án — cùng một component cho mọi màn hình dự án. */
export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Màn hình dự án" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((tab) => {
        const href = `/projects/${projectId}/${tab.href}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors",
              active
                ? "border-brand font-medium text-ink"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
