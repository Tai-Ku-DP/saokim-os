import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { Badge } from "@/components/ui/badge";
import { getProjectHeader } from "@/server/services/projects";

export const metadata: Metadata = { title: "Tổng quan dự án" };

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectHeader(projectId);
  if (!project) notFound();

  return (
    <PageBody>
      <PageHeader
        title={project.name}
        subtitle={project.typeLabel}
        meta={
          <>
            <Badge variant="secondary" className="font-normal">
              {project.statusLabel}
            </Badge>
            <span className="text-[12px] text-ink-3">{project.organizationName}</span>
          </>
        }
      />
      <ProjectTabs projectId={projectId} />
      <EmptyState
        title="Tổng quan đang được hoàn thiện"
        hint="Hạng mục, tiến độ và người phụ trách sẽ hiển thị ở đây ở phase P3."
      />
    </PageBody>
  );
}
