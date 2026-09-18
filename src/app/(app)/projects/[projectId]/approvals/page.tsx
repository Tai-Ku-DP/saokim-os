import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { StatusBadge } from "@/components/domain/status-badge";
import { ApprovalDecision } from "@/components/domain/approval-decision";
import { can } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { listProjectApprovals } from "@/server/services/files";
import { getProjectHeader } from "@/server/services/projects";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Duyệt" };

export default async function ProjectApprovalsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireSession();
  const project = await getProjectHeader(ctx, projectId);
  if (!project) notFound();

  const approvals = await listProjectApprovals(ctx, projectId);
  const pending = approvals.filter((a) => a.status === "pending");
  const decided = approvals.filter((a) => a.status !== "pending");
  const canApprove = can(ctx, { file: ["approve"] });

  return (
    <PageBody>
      <PageHeader title="Duyệt" subtitle={project.name} />
      <ProjectTabs projectId={projectId} />

      <section className="grid gap-4">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">Đang chờ duyệt</h2>
            <span className="tnum text-[11px] text-ink-3">{pending.length}</span>
          </div>

          {pending.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Không có phiên bản chờ duyệt"
              hint="Phiên bản đã duyệt sẽ bị khoá và chỉ tạo được phiên bản mới."
              className="rounded-none border-0"
            />
          ) : (
            pending.map((item) => (
              <div key={item.id} className="grid gap-3 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[1fr_320px]">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    {item.fileName} <span className="tnum text-ink-3">v{item.versionNumber}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {item.requestedByName ? `${item.requestedByName} gửi` : "—"} ·{" "}
                    {formatRelative(item.createdAt)}
                    {item.approverName ? ` · người duyệt: ${item.approverName}` : ""}
                  </p>
                  {item.reason ? (
                    <p className="mt-1 text-[12px] text-ink-2">Lý do: {item.reason}</p>
                  ) : null}
                </div>
                {canApprove ? (
                  <ApprovalDecision approvalId={item.id} />
                ) : (
                  <p className="text-[12px] text-ink-3">Chỉ chủ doanh nghiệp được duyệt.</p>
                )}
              </div>
            ))
          )}
        </div>

        {decided.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink">Đã xử lý</h2>
            </div>
            <ul>
              {decided.map((item) => (
                <li
                  key={item.id}
                  className="row flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {item.fileName} <span className="tnum text-ink-3">v{item.versionNumber}</span>
                  </span>
                  <StatusBadge kind="approval" value={item.status} />
                  <span className="text-[11px] text-ink-3">{formatRelative(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </PageBody>
  );
}
