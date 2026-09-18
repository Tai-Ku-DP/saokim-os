import type { Metadata } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { ArrowRight, BarChart3, CheckCircle2, Circle, CircleDot } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatusBadge } from "@/components/domain/status-badge";
import { GenerateRecommendationsButton, ServiceRequestForm } from "@/components/domain/growth-forms";
import { Badge } from "@/components/ui/badge";
import { can } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { listServicePackages, listServiceRequests } from "@/server/services/growth";
import { buildRoadmap, listOpenRecommendations } from "@/server/services/retaining";
import { defaultOrganizationFor } from "@/server/services/clients";
import { formatDate } from "@/lib/format";
import { project as projectTable } from "@/db/sqlite/schema";
import { db } from "@/db";

export const metadata: Metadata = { title: "Lộ trình phát triển" };

export default async function GrowthPage() {
  const ctx = await requireSession();
  const organizationId = await defaultOrganizationFor(ctx);

  if (!organizationId) {
    return (
      <PageBody width="readable">
        <PageHeader title="Lộ trình phát triển" />
        <EmptyState
          icon={BarChart3}
          title="Chưa có khách hàng"
          hint="Lộ trình xuất hiện khi có khách hàng và dự án."
        />
      </PageBody>
    );
  }

  const [roadmap, recommendations, services, requests] = await Promise.all([
    buildRoadmap(ctx, organizationId),
    listOpenRecommendations(ctx, organizationId),
    listServicePackages(ctx),
    listServiceRequests(ctx),
  ]);

  const referenceProject = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(and(eq(projectTable.organizationId, organizationId), isNull(projectTable.deletedAt)))
    .limit(1);

  const canRequest = can(ctx, { growth: ["request"] });
  const canRecommend = can(ctx, { growth: ["recommend"] });

  return (
    <PageBody>
      <PageHeader
        title="Lộ trình phát triển"
        subtitle="Bước tiếp theo cho thương hiệu, dựa trên dự án đã hoàn thành"
        action={canRecommend ? <GenerateRecommendationsButton organizationId={organizationId} /> : undefined}
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="card overflow-hidden">
          <div className="border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">Giai đoạn</h2>
            <p className="text-[11px] text-ink-3">
              Đề xuất theo loại dự án đã xong — quy tắc cố định, không phải AI tự nghĩ
            </p>
          </div>

          <ol>
            {roadmap.stages.map((stage) => (
              <li key={stage.key} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-start gap-2.5">
                  {stage.state === "done" ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" aria-hidden />
                  ) : stage.state === "current" ? (
                    <CircleDot size={15} className="mt-0.5 shrink-0 text-brand" aria-hidden />
                  ) : (
                    <Circle size={15} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{stage.title}</p>
                    <p className="text-[11.5px] text-ink-3">{stage.description}</p>
                    {stage.serviceNames.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {stage.serviceNames.map((name) => (
                          <Badge key={name} variant="secondary" className="font-normal">
                            {name}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="shrink-0 border-line font-normal text-ink-3">
                    {stage.state === "done" ? "Đã xong" : stage.state === "current" ? "Đang làm" : "Tiếp theo"}
                  </Badge>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid content-start gap-4">
          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Dịch vụ đề xuất</h2>
            </div>
            {recommendations.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-ink-3">
                Chưa có đề xuất. Đề xuất sinh khi dự án hoàn thành.
              </p>
            ) : (
              <ul>
                {recommendations.map((item) => (
                  <li key={item.id} className="row border-b border-line px-4 py-2.5 last:border-b-0">
                    <p className="text-[12.5px] font-medium text-ink">
                      {item.serviceName ?? "Dịch vụ"}
                    </p>
                    <p className="text-[11px] text-ink-3">{item.serviceDescription ?? ""}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canRequest ? (
            <section className="card p-4">
              <h2 className="mb-2 text-[13px] font-semibold text-ink">Gửi yêu cầu mới</h2>
              <ServiceRequestForm
                services={services.map((s) => ({ id: s.id, name: s.name }))}
                projectId={referenceProject[0]?.id}
              />
            </section>
          ) : null}

          <section className="card overflow-hidden">
            <div className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Yêu cầu đã gửi</h2>
            </div>
            {requests.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-ink-3">Chưa gửi yêu cầu nào.</p>
            ) : (
              <ul>
                {requests.map((item) => (
                  <li
                    key={item.id}
                    className="row flex items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                      {item.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-3">
                      {formatDate(item.createdAt)}
                    </span>
                    <StatusBadge kind="feedback" value={item.status === "new" ? "open" : "resolved"} />
                    <ArrowRight size={12} className="shrink-0 text-ink-3" aria-hidden />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PageBody>
  );
}
