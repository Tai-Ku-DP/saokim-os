import type { Metadata } from "next";
import Link from "next/link";
import { Inbox as InboxIcon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/server/auth/guard";
import { getInbox } from "@/server/services/inbox";

export const metadata: Metadata = { title: "Inbox" };

const DOT: Record<string, string> = {
  overdue: "bg-hot",
  today: "bg-warning",
  soon: "bg-line-strong",
};

export default async function InboxPage() {
  const ctx = await requireStaff();
  const groups = await getInbox(ctx);
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <PageBody>
      <PageHeader
        title="Inbox"
        subtitle={total > 0 ? `${total} việc cần xử lý` : "Không có việc tồn"}
      />

      {total === 0 ? (
        <EmptyState icon={InboxIcon} title="Không có việc tồn" hint="Việc và phản hồi mới sẽ tập trung ở đây." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map((group) => (
            <section key={group.key} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <h2 className="text-[13px] font-semibold text-ink">{group.title}</h2>
                <span className="text-[11px] text-ink-3">{group.hint}</span>
              </div>

              {group.items.length === 0 ? (
                <p className="px-4 py-5 text-center text-[12px] text-ink-3">Trống</p>
              ) : (
                <ul>
                  {group.items.map((item) => (
                    <li key={item.id} className="border-b border-line last:border-b-0">
                      <Link href={item.href} className="row block px-4 py-2.5 hover:bg-surface-2">
                        <span className="flex items-start gap-2">
                          <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", DOT[item.priority])} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium text-ink">
                              {item.title}
                            </span>
                            <span className="block truncate text-[11px] text-ink-3">{item.reason}</span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="mt-4">
        <Button asChild size="sm" variant="outline">
          <Link href="/reports">Xem báo cáo</Link>
        </Button>
      </div>
    </PageBody>
  );
}
