import type { Metadata } from "next";
import { BarChart3, TrendingUp } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Progress } from "@/components/ui/progress";
import { can } from "@/server/auth/access";
import { requireStaff } from "@/server/auth/guard";
import { getDeliveryHealth } from "@/server/services/inbox";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Báo cáo" };

export default async function ReportsPage() {
  const ctx = await requireStaff();
  const health = await getDeliveryHealth(ctx);
  const canSeeRevenue = can(ctx, { report: ["read_all"] });

  return (
    <PageBody>
      <PageHeader
        title="Báo cáo"
        subtitle="Chất lượng delivery và cơ hội doanh thu"
        meta={
          canSeeRevenue ? null : (
            <span className="text-[12px] text-ink-3">
              Bạn xem được số liệu delivery; doanh thu chỉ dành cho quản lý
            </span>
          )
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Dự án đang chạy" value={String(health.activeProjects)} />
        <Metric label="Việc quá hạn" value={String(health.overdueTasks)} tone={health.overdueTasks > 0 ? "danger" : "default"} />
        <Metric label="Chờ duyệt" value={String(health.pendingApprovals)} tone={health.pendingApprovals > 0 ? "warning" : "default"} />
        <Metric label="Dự án trễ" value={String(health.openIssues)} tone={health.openIssues > 0 ? "danger" : "default"} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <BarChart3 size={14} className="text-ink-3" aria-hidden /> Onboarding
          </h2>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={health.onboardingRate} className="h-2" />
            <span className="tnum text-[13px] font-semibold text-ink">{health.onboardingRate}%</span>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">Tỷ lệ checklist onboarding đã hoàn tất</p>
        </section>

        <section className="card p-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
            <TrendingUp size={14} className="text-ink-3" aria-hidden /> Growth
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <dt className="text-[11px] text-ink-3">Yêu cầu dịch vụ</dt>
              <dd className="tnum text-[15px] font-semibold text-ink">{health.serviceRequests}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-ink-3">Khách hàng</dt>
              <dd className="tnum text-[15px] font-semibold text-ink">{health.activeClients}</dd>
            </div>
            {canSeeRevenue ? (
              <div className="col-span-2">
                <dt className="text-[11px] text-ink-3">Pipeline (signal, chốt ở Odoo)</dt>
                <dd className="tnum text-[15px] font-semibold text-ink">
                  {formatCurrency(health.pipelineValueCents, "VND", { compact: true })}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </PageBody>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger" ? "text-hot" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="card px-3.5 py-3">
      <p className={`tnum text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-3">{label}</p>
    </div>
  );
}
