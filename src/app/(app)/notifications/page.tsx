import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/server/auth/guard";
import { listNotifications } from "@/server/notifications";
import { markAllReadAction, markNotificationReadAction } from "@/server/actions/notifications";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Thông báo" };

export default async function NotificationsPage() {
  const ctx = await requireSession();
  const items = await listNotifications(ctx, 60);
  const unread = items.filter((item) => item.readAt === null);

  return (
    <PageBody width="readable">
      <PageHeader
        title="Thông báo"
        subtitle={unread.length > 0 ? `${unread.length} chưa đọc` : "Đã đọc hết"}
        action={
          unread.length > 0 ? (
            <form action={markAllReadAction}>
              <Button type="submit" size="sm" variant="outline">
                <CheckCheck size={13} aria-hidden /> Đánh dấu đã đọc
              </Button>
            </form>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Không có thông báo mới"
          hint="Thông báo về phiên bản, phản hồi và hạn chót sẽ ở đây."
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className={cn("px-4 py-3", item.readAt === null && "bg-brand-soft/40")}>
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    item.readAt === null ? "bg-brand" : "bg-line-strong",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  {item.link ? (
                    <Link href={item.link} className="text-[13px] font-medium text-ink hover:text-brand">
                      {item.title}
                    </Link>
                  ) : (
                    <p className="text-[13px] font-medium text-ink">{item.title}</p>
                  )}
                  {item.body ? <p className="mt-0.5 text-[12px] text-ink-3">{item.body}</p> : null}
                  <p className="mt-1 text-[11px] text-ink-3">{formatRelative(item.createdAt)}</p>
                </div>
                {item.readAt === null ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={item.id} />
                    <Button type="submit" size="xs" variant="ghost" className="text-ink-3">
                      Đã đọc
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  );
}
