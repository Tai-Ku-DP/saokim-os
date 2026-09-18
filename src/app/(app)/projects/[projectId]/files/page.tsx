import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { getProjectHeader } from "@/server/services/projects";

export const metadata: Metadata = { title: "Tệp & phiên bản" };

export default async function ProjectFilesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectHeader(projectId);
  if (!project) notFound();

  return (
    <PageBody>
      <PageHeader title="Tệp & phiên bản" subtitle={project.name} />
      <ProjectTabs projectId={projectId} />
      <EmptyState
        title="Chưa có tệp nào"
        hint="Tệp tải lên sẽ có lịch sử phiên bản, không ghi đè (P3)."
      />
    </PageBody>
  );
}
