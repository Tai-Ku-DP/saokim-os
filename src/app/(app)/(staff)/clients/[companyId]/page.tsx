import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { StatusBadge } from "@/components/domain/status-badge";
import { Progress } from "@/components/ui/progress";
import { requireStaff } from "@/server/auth/guard";
import { getClientDetail } from "@/server/services/inbox";
import { formatCurrency, formatDateTime, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Hồ sơ khách hàng" };

const ACTION_LABEL: Record<string, string> = {
  login: "Đăng nhập",
  view_file: "Xem tệp",
  download: "Tải tệp",
  view_service: "Xem dịch vụ",
  comment: "Bình luận",
  approve: "Duyệt",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const ctx = await requireStaff();
  const client = await getClientDetail(ctx, companyId);
  if (!client) notFound();

  const pipeline = client.opportunities.reduce((sum, o) => sum + (o.valueCents ?? 0), 0);

  return (
    <PageBody>
      <PageHeader
        title={client.name}
        subtitle={client.industry ?? undefined}
        meta={
          <>
            {client.brandStage ? (
              <span className="text-[12px] text-ink-3">Giai đoạn: {client.brandStage}</span>
            ) : null}
            {client.lastInteractionAt ? (
              <span className="text-[12px] text-ink-3">
                · Tương tác gần nhất {formatRelative(client.lastInteractionAt)}
              </span>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid content-start gap-4">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Dự án</h2>
            </div>
            {client.projects.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-ink-3">Chưa có dự án.</p>
            ) : (
              <ul>
                {client.projects.map((project) => (
                  <li key={project.id} className="row border-b border-line px-4 py-2.5 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/projects/${project.id}/overview`}
                        className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink hover:text-brand"
                      >
                        {project.name}
                      </Link>
                      <StatusBadge kind="project" value={project.status} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Progress value={project.progress} className="h-1.5 w-24" />
                      <span className="tnum text-[11px] text-ink-3">{project.progress}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Lịch sử tương tác</h2>
            </div>
            {client.interactions.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-ink-3">Chưa có tương tác.</p>
            ) : (
              <ul>
                {client.interactions.map((item) => (
                  <li
                    key={item.id}
                    className="row flex items-center gap-2 border-b border-line px-4 py-2 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                      {ACTION_LABEL[item.action] ?? item.action}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-3">{item.userName ?? "—"}</span>
                    <span className="shrink-0 text-[11px] text-ink-3">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid content-start gap-4">
          <section className="card p-4">
            <h2 className="text-[13px] font-semibold text-ink">Cơ hội (signal CRM)</h2>
            <p className="tnum mt-2 text-lg font-semibold text-ink">
              {formatCurrency(pipeline, "VND", { compact: true })}
            </p>
            <p className="text-[11px] text-ink-3">
              {client.opportunities.length} cơ hội · Odoo là nơi chốt
            </p>
            <ul className="mt-3 grid gap-1.5">
              {client.opportunities.map((item) => (
                <li key={item.id} className="flex items-center justify-between text-[12px]">
                  <span className="text-ink-2">{item.stage}</span>
                  <span className="tnum text-ink-3">
                    {item.valueCents ? formatCurrency(item.valueCents, "VND", { compact: true }) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="text-[13px] font-semibold text-ink">Liên hệ</h2>
            <p className="mt-2 text-[12px] text-ink-2">{client.website ?? "Chưa có website"}</p>
          </section>
        </div>
      </div>
    </PageBody>
  );
}
