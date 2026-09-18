import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Trạng thái rỗng: 1 câu + 1 CTA (docs/00 §6).
 * Không dùng để "xin lỗi" — luôn nói bước tiếp theo.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? <Icon size={20} className="text-ink-3" aria-hidden /> : null}
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {hint ? <p className="max-w-sm text-[12px] text-ink-3">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
