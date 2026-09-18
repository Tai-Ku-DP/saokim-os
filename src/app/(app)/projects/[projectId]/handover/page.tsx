import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { getProjectHeader } from "@/server/services/projects";

export const metadata: Metadata = { title: "Bàn giao" };

export default async function ProjectHandoverPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectHeader(projectId);
  if (!project) notFound();

  return (
    <PageBody>
      <PageHeader title="Bàn giao" subtitle={project.name} />
      <ProjectTabs projectId={projectId} />
      <EmptyState
        title="Chưa có bộ bàn giao"
        hint="Tệp bàn giao sẽ được chuyển vào Brand Home sau khi phát hành (P3)."
      />
    </PageBody>
  );
}
