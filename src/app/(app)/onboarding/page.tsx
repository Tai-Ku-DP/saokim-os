import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatusBadge } from "@/components/domain/status-badge";
import {
  BrandBriefForm,
  ChecklistItemPanel,
  CompleteChecklist,
  DocumentPanel,
} from "@/components/domain/onboarding-forms";
import { Progress } from "@/components/ui/progress";
import { can } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { getBrandBrief, listOnboarding } from "@/server/services/onboarding";
import { formatDate } from "@/lib/format";

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

              <div>
                {checklist.items.map((item) => (
                  <ChecklistItemPanel
                    key={item.id}
                    item={{
                      id: item.id,
                      label: item.label,
                      required: item.required,
                      ownerSide: item.ownerSide,
                      status: item.status,
                      note: item.note,
                      answer: item.answer,
                      dueAtLabel: item.dueAt ? formatDate(item.dueAt) : null,
                      attachments: item.attachments,
                    }}
                    canSubmit={isStaff ? canReview : canWrite && item.ownerSide === "client"}
                    canReview={isStaff && canReview}
                    canAttach={isStaff ? canReview : canWrite && item.ownerSide === "client"}
                    canDetachAny={isStaff && canReview}
                  />
                ))}
              </div>

              {checklist.documents.length > 0 ? (
                <div className="border-t border-line bg-surface-2/30">
                  <p className="label-xs px-4 pt-3">Tài liệu cần cung cấp</p>
                  {checklist.documents.map((doc) => (
                    <DocumentPanel
                      key={doc.id}
                      doc={{
                        id: doc.id,
                        label: doc.label,
                        required: doc.required,
                        status: doc.status,
                        answer: doc.answer,
                        attachments: doc.attachments,
                      }}
                      canWrite={isStaff ? canReview : canWrite}
                    />
                  ))}
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
