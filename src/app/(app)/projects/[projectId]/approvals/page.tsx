import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { getProjectHeader } from "@/server/services/projects";

export const metadata: Metadata = { title: "Duyệt" };

export default async function ProjectApprovalsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectHeader(projectId);
  if (!project) notFound();

  return (
    <PageBody>
      <PageHeader title="Duyệt" subtitle={project.name} />
      <ProjectTabs projectId={projectId} />
      <EmptyState
        title="Không có phiên bản chờ duyệt"
        hint="Phiên bản đã duyệt sẽ bị khoá và chỉ tạo được phiên bản mới (P3)."
      />
    </PageBody>
  );
}
