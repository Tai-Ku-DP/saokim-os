import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { getProjectHeader } from "@/server/services/projects";

export const metadata: Metadata = { title: "Phản hồi" };

export default async function ProjectFeedbackPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectHeader(projectId);
  if (!project) notFound();

  return (
    <PageBody>
      <PageHeader title="Phản hồi" subtitle={project.name} />
      <ProjectTabs projectId={projectId} />
      <EmptyState
        title="Chưa có phản hồi"
        hint="Phản hồi luôn gắn với đúng tệp và đúng phiên bản (P3)."
      />
    </PageBody>
  );
}
