import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { StatusBadge } from "@/components/domain/status-badge";
import { Button } from "@/components/ui/button";
import { can } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { getFileDetail, listProjectFiles } from "@/server/services/files";
import { getProjectHeader } from "@/server/services/projects";
import { resolveFeedbackAction } from "@/server/actions/files";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Phản hồi" };

export default async function ProjectFeedbackPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx = await requireSession();
  const project = await getProjectHeader(ctx, projectId);
  if (!project) notFound();

  const files = await listProjectFiles(ctx, projectId);
  const details = await Promise.all(files.map((file) => getFileDetail(ctx, file.id)));

  const threads = details
    .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
    .flatMap((detail) =>
      detail.feedback.map((item) => ({ ...item, fileName: detail.name, fileId: detail.id })),
    )
    .sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (a.status !== "open" && b.status === "open") return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const canResolve = can(ctx, { file: ["comment"] });
  const openCount = threads.filter((t) => t.status === "open").length;

  return (
    <PageBody>
      <PageHeader
        title="Phản hồi"
        subtitle={project.name}
        meta={
          openCount > 0 ? (
            <span className="text-[12px] text-warning">{openCount} phản hồi chưa xử lý</span>
          ) : null
        }
      />
      <ProjectTabs projectId={projectId} />

      {threads.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Chưa có phản hồi"
          hint="Phản hồi luôn gắn với đúng tệp và đúng phiên bản."
        />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {threads.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] text-ink">{item.body}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
                <span className="text-ink-2">{item.authorName ?? "—"}</span>
                <span>·</span>
                <span>
                  {item.fileName} <span className="tnum">v{item.versionNumber}</span>
                </span>
                <span>·</span>
                <span>{formatDateTime(item.createdAt)}</span>
                <StatusBadge kind="feedback" value={item.status} />
                {canResolve && item.status === "open" ? (
                  <form action={resolveFeedbackAction} className="ml-auto">
                    <input type="hidden" name="feedbackId" value={item.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <Button type="submit" size="xs" variant="ghost" className="text-brand">
                      Đánh dấu đã xử lý
                    </Button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageBody>
  );
}
