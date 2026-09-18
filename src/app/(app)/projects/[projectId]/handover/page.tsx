import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { StatusBadge } from "@/components/domain/status-badge";
import { HandoverActions } from "@/components/domain/handover-actions";
import { can } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { getHandover } from "@/server/services/handover";
import { getProjectHeader } from "@/server/services/projects";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Bàn giao" };

export default async function ProjectHandoverPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireSession();
  const project = await getProjectHeader(ctx, projectId);
  if (!project) notFound();

  const handover = await getHandover(ctx, projectId);
  const canWrite = can(ctx, { handover: ["prepare"] });
  const canRelease = can(ctx, { handover: ["release"] });
  const released = handover.status === "released";

  return (
    <PageBody>
      <PageHeader
        title="Bàn giao"
        subtitle={project.name}
        meta={
          handover.status === "none" ? null : (
            <StatusBadge
              kind="project"
              value={released ? "completed" : "active"}
              className="border-line bg-surface-2 text-ink-2"
            />
          )
        }
        action={
          canWrite ? (
            <HandoverActions projectId={projectId} canRelease={canRelease} released={released} />
          ) : undefined
        }
      />
      <ProjectTabs projectId={projectId} />

      {handover.items.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Chưa có bộ bàn giao"
          hint={
            handover.approvedVersions.length > 0
              ? `${handover.approvedVersions.length} phiên bản đã duyệt sẵn sàng đưa vào bàn giao`
              : "Cần ít nhất một phiên bản đã được duyệt"
          }
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">Tệp bàn giao</h2>
            {released && handover.releasedAt ? (
              <span className="text-[11px] text-success">
                Đã phát hành · {formatDateTime(handover.releasedAt)}
              </span>
            ) : (
              <span className="text-[11px] text-ink-3">Chưa phát hành</span>
            )}
          </div>
          <ul>
            {handover.items.map((item) => (
              <li
                key={item.id}
                className="row flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.label}</span>
                {item.fileName ? (
                  <span className="text-[11px] text-ink-3">{item.fileName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </PageBody>
  );
}
