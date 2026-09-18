"use client";

import { ChevronRight, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionListCard,
  ApprovalsCard,
  CardNote,
  ConfirmCard,
  FeedbackCard,
  FilesCard,
  ProjectsCard,
  RiskListCard,
} from "@/components/ai/renderers";
import { RENDERED_TOOLS } from "@/ai/renderers-registry";
import { useAiWrite } from "@/components/ai/use-ai-write";

/**
 * Map `tool-<name>` → component. Đây là **nơi duy nhất** quyết định generative UI
 * (docs/04 §3). Tool không có renderer ⇒ không hiển thị gì.
 */

type ToolPart = {
  type: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export function ToolRenderer({ part }: { part: ToolPart }) {
  const toolName = part.type.replace(/^tool-/, "");
  const label = RENDERED_TOOLS[toolName];

  if (!label) return null;

  if (part.state === "input-streaming" || part.state === "input-available") {
    return (
      <div className="card p-3">
        <p className="mb-2 text-[11px] text-ink-3">{label}</p>
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="mt-1.5 h-3 w-1/3" />
      </div>
    );
  }

  if (part.state === "output-error") {
    return (
      <CardNote text={part.errorText ? `Không lấy được dữ liệu: ${part.errorText}` : "Không lấy được dữ liệu."} />
    );
  }

  const output = (part.output ?? {}) as Record<string, unknown>;

  switch (toolName) {
    case "showTodayActions":
      return <ActionListCard items={(output.items as never) ?? []} />;
    case "showProjects":
      return <ProjectsCard projects={(output.projects as never) ?? []} />;
    case "summarizeFeedback":
      return output.found ? (
        <FeedbackCard digest={output.digest as never} />
      ) : (
        <CardNote text="Không tìm thấy phản hồi cho dự án này." />
      );
    case "showRisks":
      return <RiskListCard risks={(output.risks as never) ?? []} />;
    case "showApprovals": {
      const approvals = (output.approvals as { id: string }[]) ?? [];
      const projectId = (part.input as { projectId?: string } | undefined)?.projectId;
      return <ApprovalsCard approvals={approvals as never} projectId={projectId} />;
    }
    case "listFiles":
      return <FilesCard files={(output.files as never) ?? []} />;
    case "createServiceRequest":
    case "createDesignRequest":
    case "requestDocument":
      return <WriteToolCard toolName={toolName} input={part.input} />;
    default:
      return null;
  }
}

/** Tool ghi: chỉ hiện card xác nhận, KHÔNG tự thực thi. */
function WriteToolCard({ toolName, input }: { toolName: string; input: unknown }) {
  const { confirm, pending, canWrite } = useAiWrite();
  const data = (input ?? {}) as { title?: string; note?: string; label?: string; reason?: string };

  const title =
    toolName === "requestDocument"
      ? `Nhắc khách nộp: ${data.label ?? "tài liệu"}`
      : (data.title ?? "Đề xuất mới");

  return (
    <ConfirmCard
      title={title}
      detail={data.note ?? data.reason}
      confirmLabel={toolName === "requestDocument" ? "Gửi nhắc" : "Tạo yêu cầu"}
      pending={pending}
      disabled={!canWrite}
      disabledHint={canWrite ? undefined : "Bạn không có quyền tạo mục này"}
      onConfirm={() => confirm(toolName, data)}
    />
  );
}

/** Nhãn cho phần "đang xử lý" khi chưa biết tool nào. */
export function ToolPending({ toolName }: { toolName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed border-line px-3 py-2 text-[12px] text-ink-3">
      <Sparkles size={12} className="text-hot" aria-hidden />
      {RENDERED_TOOLS[toolName] ?? "Đang lấy dữ liệu"}
      <ChevronRight size={12} aria-hidden className="animate-pulse" />
    </div>
  );
}
