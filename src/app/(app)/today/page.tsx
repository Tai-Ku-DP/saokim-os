import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ActionRow } from "@/components/domain/action-row";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/server/auth/guard";
import { getTodayActions, getTodaySummary } from "@/server/services/today";

export const metadata: Metadata = { title: "Hôm nay" };

/** BỀ MẶT 1 — trả lời đúng một câu: "Hôm nay tôi cần làm gì?" (docs/00 §3) */
export default async function TodayPage() {
  const ctx = await requireSession();
  const [actions, summary] = await Promise.all([getTodayActions(ctx), getTodaySummary(ctx)]);

  const isClient = ctx.kind === "client";

  return (
    <PageBody width="readable">
      <PageHeader
        title="Hôm nay"
        subtitle={isClient ? "Việc cần bạn xử lý" : "Việc cần bạn xử lý trong các dự án phụ trách"}
      />

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-[13px] font-semibold text-ink">
            {actions.length > 0 ? `${actions.length} việc cần xử lý` : "Không có việc tồn"}
          </h2>
          {summary.activeProjects > 0 ? (
            <Link href="/projects" className="text-[12px] text-brand hover:underline">
              {summary.activeProjects} dự án
            </Link>
          ) : null}
        </div>

        {actions.length > 0 ? (
          <div className="px-3">
            {actions.map((item) => (
              <ActionRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Chưa có việc cần làm"
            hint={isClient ? "Xem lộ trình phát triển thương hiệu" : "Xem báo cáo tiến độ"}
            className="rounded-none border-0"
            action={
              <Button asChild size="sm" variant="outline">
                <Link href={isClient ? "/growth" : "/reports"}>
                  {isClient ? "Xem lộ trình" : "Xem báo cáo"}
                </Link>
              </Button>
            }
          />
        )}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Dự án đang chạy" value={summary.activeProjects} />
        <Metric label="Chờ tôi duyệt" value={summary.pendingApprovals} />
        {isClient ? (
          <Metric label="Tài liệu cần nộp" value={summary.pendingDocuments} />
        ) : (
          <Metric label="Việc quá hạn" value={summary.overdueTasks} />
        )}
      </div>
    </PageBody>
  );
}

function Metric({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="card px-3.5 py-2.5">
      <p className={muted ? "tnum text-lg font-semibold text-ink-3" : "tnum text-lg font-semibold text-ink"}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-3">{label}</p>
    </div>
  );
}
