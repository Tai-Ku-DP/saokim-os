import type { Metadata } from "next";
import { Archive, Palette, Type } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ServiceRequestForm } from "@/components/domain/growth-forms";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { can } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { defaultOrganizationFor } from "@/server/services/clients";
import { listServicePackages } from "@/server/services/growth";
import { getBrandHome } from "@/server/services/retaining";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Brand Home" };

const SEVERITY_LABEL: Record<string, string> = { high: "Nghiêm trọng", medium: "Cần chú ý", low: "Nhẹ" };

export default async function BrandHomePage() {
  const ctx = await requireSession();
  const organizationId = await defaultOrganizationFor(ctx);

  if (!organizationId) {
    return (
      <PageBody>
        <PageHeader title="Brand Home" />
        <EmptyState icon={Archive} title="Chưa có khách hàng" hint="Tài sản sẽ hiện theo khách hàng." />
      </PageBody>
    );
  }

  const [home, services] = await Promise.all([
    getBrandHome(ctx, organizationId),
    listServicePackages(ctx),
  ]);

  const colors = home.assets.filter((a) => a.type === "color");
  const fonts = home.assets.filter((a) => a.type === "font");
  const others = home.assets.filter((a) => a.type !== "color" && a.type !== "font");
  const canRequest = can(ctx, { growth: ["request"] });

  return (
    <PageBody>
      <PageHeader
        title="Brand Home"
        subtitle="Tài sản thương hiệu, guideline và sức khỏe thương hiệu"
        meta={
          home.healthScore !== null ? (
            <span className="text-[12px] text-ink-3">
              Điểm sức khỏe: <span className="tnum font-medium text-ink">{home.healthScore}/100</span>
            </span>
          ) : null
        }
      />

      {home.assets.length === 0 && !home.guideline ? (
        <EmptyState
          icon={Archive}
          title="Chưa có tài sản thương hiệu"
          hint="Tài sản sẽ xuất hiện sau khi dự án bàn giao."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="grid content-start gap-4">
            <section className="card p-4">
              <h2 className="text-[13px] font-semibold text-ink">Tài sản thương hiệu</h2>

              {colors.length > 0 ? (
                <div className="mt-3">
                  <p className="label-xs mb-1.5">Màu sắc</p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((asset) => (
                      <div key={asset.id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5">
                        <span
                          className="size-5 rounded border border-line"
                          style={{ background: asset.value.hex ?? "transparent" }}
                          aria-hidden
                        />
                        <span className="grid leading-tight">
                          <span className="text-[12px] text-ink">{asset.name}</span>
                          <span className="tnum text-[10.5px] text-ink-3">{asset.value.hex}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {fonts.length > 0 ? (
                <div className="mt-3">
                  <p className="label-xs mb-1.5">Typography</p>
                  <ul className="grid gap-1">
                    {fonts.map((asset) => (
                      <li key={asset.id} className="flex items-center gap-2 text-[12px]">
                        <Type size={13} className="text-ink-3" aria-hidden />
                        <span className="text-ink">{asset.name}</span>
                        <span className="text-ink-3">
                          {asset.value.family} {asset.value.weight ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {others.length > 0 ? (
                <div className="mt-3">
                  <p className="label-xs mb-1.5">Khác</p>
                  <ul className="grid gap-1">
                    {others.map((asset) => (
                      <li key={asset.id} className="flex items-center gap-2 text-[12px]">
                        <Palette size={13} className="text-ink-3" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-ink">{asset.name}</span>
                        <Badge variant="secondary" className="font-normal">
                          {asset.type}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {home.guideline ? (
              <section className="card overflow-hidden">
                <div className="border-b border-line px-4 py-2.5">
                  <h2 className="text-[13px] font-semibold text-ink">{home.guideline.title}</h2>
                </div>
                <dl className="divide-y divide-line">
                  {home.guideline.sections.map((section) => (
                    <div key={section.key} className="px-4 py-2.5">
                      <dt className="text-[12.5px] font-medium text-ink">{section.title}</dt>
                      <dd className="mt-0.5 text-[12px] leading-5 text-ink-2">{section.content}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}
          </div>

          <div className="grid content-start gap-4">
            {home.healthScore !== null ? (
              <section className="card p-4">
                <h2 className="text-[13px] font-semibold text-ink">Sức khỏe thương hiệu</h2>
                <div className="mt-3 flex items-center gap-3">
                  <Progress value={home.healthScore} className="h-2" />
                  <span className="tnum text-[13px] font-semibold text-ink">
                    {home.healthScore}
                  </span>
                </div>
                <ul className="mt-3 grid gap-2">
                  {home.healthBreakdown.map((row) => (
                    <li key={row.key} className="grid gap-1">
                      <span className="flex items-center justify-between text-[11.5px] text-ink-2">
                        {row.label}
                        <span className="tnum text-ink-3">{row.score}</span>
                      </span>
                      <Progress value={row.score} className="h-1" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {home.scan ? (
              <section className="card overflow-hidden">
                <div className="border-b border-line px-4 py-2.5">
                  <h2 className="text-[13px] font-semibold text-ink">Chẩn đoán gần nhất</h2>
                  <p className="text-[11px] text-ink-3">
                    {home.scan.scannedAt ? formatDate(home.scan.scannedAt) : ""} ·{" "}
                    {home.scan.score !== null ? `điểm ${home.scan.score}` : ""}
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {home.scan.findings.map((finding) => (
                    <li key={finding.key} className="flex items-start gap-2 px-4 py-2">
                      <span className="min-w-0 flex-1 text-[12px] text-ink-2">{finding.label}</span>
                      <Badge variant="outline" className="shrink-0 border-line font-normal text-ink-3">
                        {SEVERITY_LABEL[finding.severity] ?? finding.severity}
                      </Badge>
                    </li>
                  ))}
                </ul>
                {home.scan.recommendation.length > 0 ? (
                  <div className="border-t border-line bg-surface-2 px-4 py-2.5">
                    <p className="label-xs mb-1">Nên làm tiếp</p>
                    <ul className="grid gap-1">
                      {home.scan.recommendation.map((item, index) => (
                        <li key={index} className="text-[12px] text-ink-2">
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {canRequest ? (
              <section className="card p-4">
                <h2 className="mb-2 text-[13px] font-semibold text-ink">Gửi yêu cầu</h2>
                <ServiceRequestForm services={services.map((s) => ({ id: s.id, name: s.name }))} />
              </section>
            ) : null}
          </div>
        </div>
      )}
    </PageBody>
  );
}
