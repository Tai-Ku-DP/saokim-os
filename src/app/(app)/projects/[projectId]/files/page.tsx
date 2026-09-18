import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ProjectTabs } from "@/components/domain/project-tabs";
import { StatusBadge } from "@/components/domain/status-badge";
import { UploadVersionForm } from "@/components/domain/upload-version-form";
import { CommentForm } from "@/components/domain/comment-form";
import { Button } from "@/components/ui/button";
import { can, type AuthContext } from "@/server/auth/access";
import { requireSession } from "@/server/auth/guard";
import { getFileDetail, listProjectFiles } from "@/server/services/files";
import { getProjectHeader } from "@/server/services/projects";
import { formatDateTime, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Tệp & phiên bản" };

export default async function ProjectFilesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const ctx: AuthContext = await requireSession();
  const project = await getProjectHeader(ctx, projectId);
  if (!project) notFound();

  const files = await listProjectFiles(ctx, projectId);
  const details = await Promise.all(files.map((file) => getFileDetail(ctx, file.id)));

  const canWrite = can(ctx, { file: ["upload"] });
  const canApprove = can(ctx, { file: ["approve"] });

  return (
    <PageBody>
      <PageHeader title="Tệp & phiên bản" subtitle={project.name} />
      <ProjectTabs projectId={projectId} />

      {files.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có tệp nào"
          hint="Tệp tải lên sẽ có lịch sử phiên bản, không ghi đè."
        />
      ) : (
        <div className="grid gap-4">
          {details.map((file) =>
            file ? (
              <section key={file.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <div className="min-w-0">
                    <h2 className="truncate text-[13px] font-semibold text-ink">{file.name}</h2>
                    <p className="tnum text-[11px] text-ink-3">
                      {file.versions.length} phiên bản
                      {file.visibility === "internal" ? " · nội bộ" : ""}
                    </p>
                  </div>
                  {canWrite ? <UploadVersionForm fileId={file.id} /> : null}
                </div>

                <ul>
                  {file.versions.map((version) => {
                    const locked = version.status === "approved";
                    return (
                      <li key={version.id} className="border-b border-line px-4 py-3 last:border-b-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="tnum text-[13px] font-semibold text-ink">
                            v{version.versionNumber}
                          </span>
                          <StatusBadge kind="version" value={version.status} />
                          <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2">
                            {version.note ?? "—"}
                          </span>
                          <span className="text-[11px] text-ink-3">
                            {version.uploadedByName ?? "—"} · {formatRelative(version.createdAt)}
                          </span>
                          <Button asChild size="xs" variant="ghost" className="text-ink-2">
                            <a href={`/api/versions/${version.id}/download`} aria-label={`Tải v${version.versionNumber}`}>
                              <Download size={13} aria-hidden />
                              Tải
                            </a>
                          </Button>
                        </div>

                        {version.approvedAt ? (
                          <p className="mt-1 text-[11px] text-success">
                            Đã duyệt bởi {version.approvedByName ?? "—"} ·{" "}
                            {formatDateTime(version.approvedAt)}
                          </p>
                        ) : null}

                        {canWrite ? (
                          <div className="mt-2">
                            <CommentForm
                              fileId={file.id}
                              versionId={version.id}
                              disabled={locked}
                              disabledHint="Phiên bản đã duyệt nên đã khoá. Tạo phiên bản mới để trao đổi tiếp."
                            />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>

                {canApprove ? (
                  <div className="border-t border-line bg-surface-2 px-4 py-2.5">
                    <p className="text-[11px] text-ink-3">
                      Gửi phiên bản mới nhất cho khách duyệt ở màn hình <span className="text-ink-2">Duyệt</span>.
                    </p>
                  </div>
                ) : null}
              </section>
            ) : null,
          )}
        </div>
      )}
    </PageBody>
  );
}
