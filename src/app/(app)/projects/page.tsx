import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { StatusBadge } from "@/components/domain/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/server/auth/guard";
import { listProjects } from "@/server/services/projects";
import { daysUntil, formatDate, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Dự án" };

export default async function ProjectsPage() {
  const ctx = await requireSession();
  const projects = await listProjects(ctx);

  return (
    <PageBody>
      <PageHeader
        title="Dự án"
        subtitle={ctx.kind === "client" ? "Dự án của công ty bạn" : "Dự án bạn phụ trách"}
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Chưa có dự án"
          hint={ctx.kind === "client" ? "Liên hệ quản lý dự án của bạn" : "Dự án sẽ hiện khi được phân công"}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11px] text-ink-3">
                <th scope="col" className="px-4 py-2 font-medium">Dự án</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Loại</th>
                <th scope="col" className="px-3 py-2 font-medium">Trạng thái</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Tiến độ</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Hạn</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Việc</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const remaining = daysUntil(project.endDate);
                return (
                  <tr key={project.id} className="row border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/projects/${project.id}/overview`}
                        className="font-medium text-ink hover:text-brand"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-0.5 truncate text-[11px] text-ink-3">
                        {project.code ? `${project.code} · ` : ""}
                        {project.pmName ?? "Chưa gán PM"}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2.5 text-ink-2 md:table-cell">{project.typeLabel}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge kind="project" value={project.status} />
                    </td>
                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Progress value={project.progress} className="h-1.5 w-16" />
                        <span className="tnum text-[11px] text-ink-3">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <span
                        className={
                          remaining !== null && remaining < 0 ? "text-hot" : "text-ink-2"
                        }
                      >
                        {project.endDate ? formatDate(project.endDate) : "—"}
                      </span>
                      {project.endDate ? (
                        <p className="text-[11px] text-ink-3">{formatRelative(project.endDate)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {project.pendingApprovals > 0 ? (
                          <Badge variant="outline" className="border-transparent bg-warning-soft font-normal text-warning">
                            {project.pendingApprovals} chờ duyệt
                          </Badge>
                        ) : null}
                        {project.overdueTasks > 0 ? (
                          <Badge variant="outline" className="border-transparent bg-danger-soft font-normal text-danger">
                            {project.overdueTasks} trễ
                          </Badge>
                        ) : null}
                        {project.pendingApprovals === 0 && project.overdueTasks === 0 ? (
                          <span className="text-[11px] text-ink-3">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageBody>
  );
}
