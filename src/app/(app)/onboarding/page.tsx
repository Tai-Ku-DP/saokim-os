import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatusBadge } from "@/components/domain/status-badge";
import {
  BrandBriefForm,
  ChecklistItemActions,
  CompleteChecklist,
} from "@/components/domain/onboarding-forms";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { can } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { getBrandBrief, listOnboarding } from "@/server/services/onboarding";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Onboarding" };

export default async function OnboardingPage() {
  const ctx = await requireSession();
  const checklists = await listOnboarding(ctx);

  const isStaff = ctx.kind === "staff";
  const canOverride = can(ctx, { onboarding: ["override"] });
  const canReview = can(ctx, { onboarding: ["review"] });
  const canWrite = can(ctx, { onboarding: ["submit"] });

  const briefs = await Promise.all(
    checklists.map(async (checklist) => ({
      projectId: checklist.projectId,
      brief: await getBrandBrief(ctx, checklist.projectId),
    })),
  );
  const briefByProject = new Map(briefs.map((b) => [b.projectId, b.brief]));

  return (
    <PageBody>
      <PageHeader
        title="Onboarding"
        subtitle="Hồ sơ, brand brief, tài liệu cần nộp và tiến độ khởi động"
      />

      {checklists.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Onboarding chưa bắt đầu"
          hint="Checklist khởi động sẽ xuất hiện sau khi dự án được tạo."
        />
      ) : (
        <div className="grid gap-5">
          {checklists.map((checklist) => (
            <section key={checklist.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/projects/${checklist.projectId}/overview`}
                    className="text-[13px] font-semibold text-ink hover:text-brand"
                  >
                    {checklist.projectName}
                  </Link>
                  <p className="text-[11px] text-ink-3">
                    Template: {checklist.templateKey} · {checklist.approvedRequired}/
                    {checklist.totalRequired} mục bắt buộc đạt
                  </p>
                </div>
                <div className="flex min-w-40 items-center gap-2">
                  <Progress value={checklist.completionRate} className="h-1.5 w-24" />
                  <span className="tnum text-[12px] font-medium text-ink">
                    {checklist.completionRate}%
                  </span>
                </div>
                <StatusBadge
                  kind="project"
                  value={checklist.status === "completed" ? "completed" : "active"}
                />
              </div>

              <ul>
                {checklist.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0"
                  >
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        item.status === "approved"
                          ? "bg-success"
                          : item.status === "rejected"
                            ? "bg-hot"
                            : "bg-line-strong",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {item.label}
                      {item.required ? null : (
                        <span className="ml-1.5 text-[11px] text-ink-3">không bắt buộc</span>
                      )}
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {item.ownerSide === "client" ? "Khách" : "Sao Kim"}
                    </Badge>
                    {item.dueAt ? (
                      <span className="text-[11px] text-ink-3">{formatDate(item.dueAt)}</span>
                    ) : null}
                    <StatusBadge kind="checklist" value={item.status} />
                    {isStaff ? (
                      <ChecklistItemActions
                        itemId={item.id}
                        status={item.status}
                        ownerSide={item.ownerSide}
                        isStaff={canReview}
                      />
                    ) : canWrite && item.ownerSide === "client" ? (
                      <ChecklistItemActions
                        itemId={item.id}
                        status={item.status}
                        ownerSide={item.ownerSide}
                        isStaff={false}
                      />
                    ) : null}
                    {item.note ? (
                      <p className="w-full text-[11px] text-warning">PM yêu cầu: {item.note}</p>
                    ) : null}
                  </li>
                ))}
              </ul>

              {checklist.documents.length > 0 ? (
                <div className="border-t border-line bg-surface-2 px-4 py-2.5">
                  <p className="label-xs mb-1.5">Tài liệu yêu cầu</p>
                  <ul className="grid gap-1">
                    {checklist.documents.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2 text-[12px]">
                        <span className="min-w-0 flex-1 truncate text-ink-2">{doc.label}</span>
                        <StatusBadge
                          kind="checklist"
                          value={
                            doc.status === "received"
                              ? "approved"
                              : doc.status === "waived"
                                ? "todo"
                                : "submitted"
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {checklist.status !== "completed" && (canReview || canWrite) ? (
                <div className="border-t border-line px-4 py-3">
                  <CompleteChecklist
                    checklistId={checklist.id}
                    canComplete={checklist.canComplete}
                    canOverride={canOverride}
                  />
                </div>
              ) : null}

              {(() => {
                const brief = briefByProject.get(checklist.projectId) ?? null;
                return (
                  <details className="border-t border-line px-4 py-3">
                    <summary className="cursor-pointer text-[13px] font-medium text-ink">
                      Brand brief
                      <span className="ml-2 text-[11px] font-normal text-ink-3">
                        {brief ? `trạng thái: ${brief.status}` : "chưa có"}
                      </span>
                    </summary>
                    <div className="mt-3 max-w-2xl">
                      <BrandBriefForm projectId={checklist.projectId} initial={brief?.fields ?? null} />
                    </div>
                  </details>
                );
              })()}
            </section>
          ))}
        </div>
      )}
    </PageBody>
  );
}
