import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Tiêu đề trang: 1 tiêu đề + 1 hành động chính (docs/00 §5 nguyên tắc 1).
 * `subtitle` tối đa 1 dòng ngắn — không dùng để viết đoạn văn.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  meta,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 pb-4", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold leading-7 text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p> : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Nội dung trang: bề rộng đọc được cho văn bản, full cho bảng. */
export function PageBody({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: "wide" | "readable";
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full px-4 py-5 md:px-6", width === "readable" && "max-w-3xl", className)}>
      {children}
    </div>
  );
}
