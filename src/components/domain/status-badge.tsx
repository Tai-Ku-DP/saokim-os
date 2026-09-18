import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Nhãn trạng thái nghiệp vụ — map màu CỐ ĐỊNH theo docs/02 §1.
 * Không nơi nào khác được tự chế màu trạng thái.
 */

type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  info: "bg-info-soft text-info border-transparent",
  success: "bg-success-soft text-success border-transparent",
  warning: "bg-warning-soft text-warning border-transparent",
  danger: "bg-danger-soft text-danger border-transparent",
};

const PROJECT_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Đang chạy", tone: "info" },
  waiting_client: { label: "Chờ khách", tone: "warning" },
  overdue: { label: "Trễ hạn", tone: "danger" },
  completed: { label: "Hoàn tất", tone: "success" },
  paused: { label: "Tạm dừng", tone: "neutral" },
};

const MILESTONE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Chưa bắt đầu", tone: "neutral" },
  in_progress: { label: "Đang làm", tone: "info" },
  done: { label: "Hoàn tất", tone: "success" },
  overdue: { label: "Trễ hạn", tone: "danger" },
};

const VERSION_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Nháp", tone: "neutral" },
  in_review: { label: "Chờ duyệt", tone: "warning" },
  changes_requested: { label: "Yêu cầu sửa", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
};

const APPROVAL_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "success" },
  rejected: { label: "Từ chối", tone: "danger" },
  changes_requested: { label: "Yêu cầu sửa", tone: "warning" },
};

const FEEDBACK_STATUS: Record<string, { label: string; tone: Tone }> = {
  open: { label: "Mới", tone: "info" },
  resolved: { label: "Đã xử lý", tone: "success" },
  wontfix: { label: "Bỏ qua", tone: "neutral" },
};

const CHECKLIST_STATUS: Record<string, { label: string; tone: Tone }> = {
  todo: { label: "Cần làm", tone: "warning" },
  submitted: { label: "Đã nộp", tone: "info" },
  approved: { label: "Đạt", tone: "success" },
  rejected: { label: "Cần bổ sung", tone: "danger" },
};

const TASK_STATUS: Record<string, { label: string; tone: Tone }> = {
  todo: { label: "Chưa làm", tone: "neutral" },
  doing: { label: "Đang làm", tone: "info" },
  review: { label: "Chờ duyệt", tone: "warning" },
  done: { label: "Xong", tone: "success" },
};

/**
 * Trạng thái "tài liệu cần cung cấp" — KHÁC checklist: pending nghĩa là CHƯA nộp.
 * (Trước đây mượn nhãn checklist nên pending bị hiện thành "Đã nộp" — sai.)
 */
const DOCUMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Cần nộp", tone: "warning" },
  received: { label: "Đã nhận", tone: "success" },
  waived: { label: "Miễn", tone: "neutral" },
};

const MAPS = {
  document: DOCUMENT_STATUS,
  project: PROJECT_STATUS,
  milestone: MILESTONE_STATUS,
  version: VERSION_STATUS,
  approval: APPROVAL_STATUS,
  feedback: FEEDBACK_STATUS,
  checklist: CHECKLIST_STATUS,
  task: TASK_STATUS,
} as const;

export type StatusKind = keyof typeof MAPS;

export function StatusBadge({
  kind,
  value,
  className,
}: {
  kind: StatusKind;
  value: string;
  className?: string;
}) {
  const entry = MAPS[kind][value] ?? { label: value, tone: "neutral" as Tone };
  return (
    <Badge variant="outline" className={cn("font-normal", TONE_CLASS[entry.tone], className)}>
      {entry.label}
    </Badge>
  );
}

export function statusLabel(kind: StatusKind, value: string): string {
  return MAPS[kind][value]?.label ?? value;
}

export function statusTone(kind: StatusKind, value: string): Tone {
  return MAPS[kind][value]?.tone ?? "neutral";
}
