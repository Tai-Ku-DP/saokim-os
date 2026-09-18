import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { StatusBadge } from "@/components/domain/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/server/auth/guard";
import {
  countProjectFiles,
  getProjectHeader,
  listMilestones,
  listProjectTeam,
} from "@/server/services/projects";
import { formatDate, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tổng quan dự án" };

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireSession();
  const project = await getProjectHeader(ctx, projectId);
  if (!project) notFound();

  const [milestones, team, fileCount] = await Promise.all([
    listMilestones(ctx, projectId),
    listProjectTeam(ctx, projectId),
    countProjectFiles(ctx, projectId),
  ]);

  const done = milestones.filter((m) => m.status === "done").length;

  return (
    <PageBody>
      <PageHeader
        title={project.name}
        subtitle={`${project.typeLabel}${project.code ? ` · ${project.code}` : ""}`}
        meta={
          <>
            <StatusBadge kind="project" value={project.status} />
            <span className="text-[12px] text-ink-3">{project.organizationName}</span>
            {project.pmName ? <span className="text-[12px] text-ink-3">· PM {project.pmName}</span> : null}
          </>
        }
      />

      <ProjectTabs projectId={projectId} />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-ink">Hạng mục</h2>
            <span className="tnum text-[11px] text-ink-3">
              {done}/{milestones.length} xong
            </span>
          </div>

          {milestones.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-ink-3">Chưa có hạng mục</p>
          ) : (
            <ul>
              {milestones.map((item) => (
                <li
                  key={item.id}
                  className="row flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      item.status === "done"
                        ? "bg-success"
                        : item.isOverdue
                          ? "bg-hot"
                          : "bg-line-strong",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.name}</span>
                  <span className={cn("text-[12px]", item.isOverdue ? "text-hot" : "text-ink-3")}>
                    {item.dueDate ? formatRelative(item.dueDate) : "—"}
                  </span>
                  <StatusBadge kind="milestone" value={item.status} className="w-28 justify-center" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-4">
          <section className="card p-4">
            <h2 className="text-[13px] font-semibold text-ink">Tiến độ</h2>
            <div className="mt-3 flex items-center gap-3">
              <Progress value={project.progress} className="h-2" />
              <span className="tnum text-[13px] font-semibold text-ink">{project.progress}%</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <dt className="text-ink-3">Bắt đầu</dt>
                <dd className="text-ink-2">{formatDate(project.startDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Kết thúc</dt>
                <dd className="text-ink-2">{formatDate(project.endDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Tệp</dt>
                <dd className="tnum text-ink-2">{fileCount}</dd>
              </div>
              <div>
                <dt className="text-ink-3">Thành viên</dt>
                <dd className="tnum text-ink-2">{team.length}</dd>
              </div>
            </dl>
          </section>

          <section className="card p-4">
            <h2 className="text-[13px] font-semibold text-ink">Thành viên</h2>
            <ul className="mt-2 grid gap-1.5">
              {team.map((person) => (
                <li key={person.userId} className="flex items-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">
                    {person.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{person.name}</span>
                  <Badge variant="secondary" className="font-normal">
                    {person.side === "client" ? "Khách" : "Sao Kim"}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </PageBody>
  );
}
