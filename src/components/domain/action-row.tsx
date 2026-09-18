import Link from "next/link";
import { ArrowRight, CircleAlert, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ActionItem } from "@/server/services/today";
import { cn } from "@/lib/utils";

/**
 * Một dòng trong hàng đợi "Hôm nay": trạng thái + tiêu đề ngắn + lý do 1 dòng + 1 CTA.
 * Không dùng card lớn: mật độ Linear (docs/02 §1).
 */

const CTA_LABEL: Record<ActionItem["cta"], string> = {
  approve: "Duyệt",
  upload: "Nộp",
  review: "Xem",
  open: "Mở",
  comment: "Góp ý",
};

const PRIORITY_ICON = {
  overdue: CircleAlert,
  today: Clock,
  soon: Clock,
  info: Info,
} as const;

const PRIORITY_ICON_CLASS = {
  overdue: "text-hot",
  today: "text-warning",
  soon: "text-ink-3",
  info: "text-ink-3",
} as const;

export function ActionRow({ item }: { item: ActionItem }) {
  const Icon = PRIORITY_ICON[item.priority];

  return (
    <div className="row group flex items-center gap-3 border-b border-line px-1 py-2.5 last:border-b-0">
      <Icon size={15} className={cn("shrink-0", PRIORITY_ICON_CLASS[item.priority])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{item.title}</p>
        <p className="truncate text-[12px] text-ink-3">{item.reason}</p>
      </div>
      <Button asChild size="sm" variant="ghost" className="shrink-0 text-brand">
        <Link href={item.href}>
          {CTA_LABEL[item.cta]}
          <ArrowRight size={13} aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
