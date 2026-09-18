"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CircleAlert, Clock, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Renderer cho từng tool (generative UI). Mỗi tool ⇒ một component.
 * Props do server trả về đã được validate bằng zod ở `src/ai/tools` — client KHÔNG parse lại.
 * Không renderer ⇒ không hiển thị (không bao giờ đổ JSON thô ra UI).
 */

type ActionItem = {
  id: string;
  title: string;
  reason: string;
  href: string;
  priority: "overdue" | "today" | "soon" | "info";
};

const PRIORITY_DOT: Record<ActionItem["priority"], string> = {
  overdue: "bg-hot",
  today: "bg-warning",
  soon: "bg-line-strong",
  info: "bg-line-strong",
};

export function ActionListCard({ items }: { items: ActionItem[] }) {
  if (!items?.length) return <CardNote text="Không có việc tồn." />;
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="row flex items-center gap-2.5 px-3 py-2 hover:bg-surface-2"
        >
          <span className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[item.priority])} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-ink">{item.title}</span>
            <span className="block truncate text-[11px] text-ink-3">{item.reason}</span>
          </span>
          <ArrowRight size={13} className="shrink-0 text-ink-3" aria-hidden />
        </Link>
      ))}
    </div>
  );
}

type ProjectRow = {
  id: string;
  name: string;
  statusLabel: string;
  typeLabel: string;
  progress: number;
  pendingApprovals: number;
  overdueTasks: number;
};

export function ProjectsCard({ projects }: { projects: ProjectRow[] }) {
  if (!projects?.length) return <CardNote text="Chưa có dự án." />;
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {projects.map((p) => (
        <Link key={p.id} href={`/projects/${p.id}/overview`} className="row block px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
              {p.name}
            </span>
            <Badge variant="secondary" className="font-normal">
              {p.statusLabel}
            </Badge>
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-3">
            <span>{p.typeLabel}</span>
            <span className="tnum">· {p.progress}%</span>
            {p.pendingApprovals > 0 ? (
              <span className="text-warning">· {p.pendingApprovals} chờ duyệt</span>
            ) : null}
            {p.overdueTasks > 0 ? <span className="text-hot">· {p.overdueTasks} trễ</span> : null}
          </span>
        </Link>
      ))}
    </div>
  );
}

type Digest = {
  projectName: string;
  fileName: string;
  versionNumber: number;
  openCount: number;
  resolvedCount: number;
  items: { id: string; body: string; authorSide: string; status: string }[];
};

export function FeedbackCard({ digest }: { digest: Digest }) {
  if (!digest || digest.items.length === 0)
    return <CardNote text="Chưa có phản hồi nào cần xử lý." />;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="truncate text-[12px] font-medium text-ink">
          {digest.fileName} <span className="tnum text-ink-3">v{digest.versionNumber}</span>
        </span>
        <span className="tnum text-[11px] text-warning">{digest.openCount} chưa xử lý</span>
      </div>
      <ul className="divide-y divide-line">
        {digest.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 px-3 py-2">
            {item.status === "open" ? (
              <CircleAlert size={13} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            ) : (
              <Clock size={13} className="mt-0.5 shrink-0 text-ink-3" aria-hidden />
            )}
            <span className="min-w-0 flex-1 text-[12px] text-ink-2">{item.body}</span>
            <Badge variant="secondary" className="shrink-0 font-normal">
              {item.authorSide === "client" ? "Khách" : "Sao Kim"}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

type RiskItem = {
  id: string;
  level: "high" | "medium" | "low";
  title: string;
  reason: string;
  projectId: string;
};

const RISK_TONE = {
  high: "text-hot",
  medium: "text-warning",
  low: "text-ink-3",
} as const;

export function RiskListCard({ risks }: { risks: RiskItem[] }) {
  if (!risks?.length) return <CardNote text="Không có rủi ro nào." />;
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {risks.map((risk) => (
        <Link key={risk.id} href={`/projects/${risk.projectId}/overview`} className="row block px-3 py-2">
          <span className="flex items-start gap-2">
            <AlertTriangle size={13} className={cn("mt-0.5 shrink-0", RISK_TONE[risk.level])} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-ink">{risk.title}</span>
              <span className="block text-[11px] text-ink-3">{risk.reason}</span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

type ApprovalItem = {
  id: string;
  fileName: string;
  versionNumber: number;
  requestedByName: string | null;
};

export function ApprovalsCard({
  approvals,
  projectId,
}: {
  approvals: ApprovalItem[];
  projectId?: string;
}) {
  if (!approvals?.length) return <CardNote text="Không có yêu cầu duyệt nào đang chờ." />;
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {approvals.map((item) => (
        <div key={item.id} className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
            {item.fileName} <span className="tnum text-ink-3">v{item.versionNumber}</span>
          </span>
          <span className="shrink-0 text-[11px] text-ink-3">{item.requestedByName ?? "—"}</span>
          {projectId ? (
            <Button asChild size="xs" variant="ghost" className="text-brand">
              <Link href={`/projects/${projectId}/approvals`}>Duyệt</Link>
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type FileRow = {
  id: string;
  name: string;
  latestVersionNumber: number | null;
  latestStatus: string | null;
  openFeedback: number;
};

export function FilesCard({ files }: { files: FileRow[] }) {
  if (!files?.length) return <CardNote text="Chưa có tệp nào." />;
  return (
    <div className="card divide-y divide-line overflow-hidden">
      {files.map((file) => (
        <div key={file.id} className="flex items-center gap-2 px-3 py-2">
          <FileText size={13} className="shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{file.name}</span>
          {file.latestVersionNumber ? (
            <span className="tnum shrink-0 text-[11px] text-ink-3">v{file.latestVersionNumber}</span>
          ) : null}
          {file.openFeedback > 0 ? (
            <span className="tnum shrink-0 text-[11px] text-warning">{file.openFeedback} góp ý</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/* ---------------- tool ghi: chỉ ĐỀ XUẤT, người dùng phải xác nhận ---------------- */

export function ConfirmCard({
  title,
  detail,
  confirmLabel,
  onConfirm,
  pending,
  disabled,
  disabledHint,
}: {
  title: string;
  detail?: string;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <div className="card border-dashed p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-3">
        <Sparkles size={12} className="text-hot" aria-hidden />
        Đề xuất · cần bạn xác nhận
      </p>
      <p className="mt-1 text-[12.5px] font-medium text-ink">{title}</p>
      {detail ? <p className="mt-0.5 text-[11.5px] text-ink-3">{detail}</p> : null}
      <div className="mt-2">
        <Button size="xs" onClick={onConfirm} disabled={pending || disabled}>
          {pending ? "Đang tạo…" : confirmLabel}
        </Button>
        {disabled && disabledHint ? (
          <span className="ml-2 text-[11px] text-ink-3">{disabledHint}</span>
        ) : null}
      </div>
    </div>
  );
}

type RoadmapData = {
  healthScore: number | null;
  stages: { key: string; title: string; state: string; serviceNames: string[] }[];
};

const STAGE_LABEL: Record<string, string> = {
  done: "Đã xong",
  current: "Đang làm",
  next: "Tiếp theo",
};

export function RoadmapCard({
  roadmap,
  recommendations,
}: {
  roadmap: RoadmapData;
  recommendations: { id: string; serviceName: string | null; serviceDescription: string | null }[];
}) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2">
        <p className="text-[12px] font-medium text-ink">Lộ trình phát triển</p>
        {roadmap.healthScore !== null ? (
          <p className="tnum text-[11px] text-ink-3">Điểm sức khỏe thương hiệu {roadmap.healthScore}/100</p>
        ) : null}
      </div>
      <ol>
        {roadmap.stages.map((stage) => (
          <li key={stage.key} className="border-b border-line px-3 py-2 last:border-b-0">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{stage.title}</span>
              <Badge variant="outline" className="shrink-0 border-line font-normal text-ink-3">
                {STAGE_LABEL[stage.state] ?? stage.state}
              </Badge>
            </span>
            {stage.serviceNames.length > 0 ? (
              <span className="mt-1 block text-[11px] text-ink-3">{stage.serviceNames.join(" · ")}</span>
            ) : null}
          </li>
        ))}
      </ol>
      {recommendations.length > 0 ? (
        <div className="border-t border-line bg-surface-2 px-3 py-2">
          <p className="label-xs mb-1">Dịch vụ đề xuất</p>
          <ul className="grid gap-1">
            {recommendations.map((item) => (
              <li key={item.id} className="text-[11.5px] text-ink-2">
                {item.serviceName ?? "Dịch vụ"}
                {item.serviceDescription ? (
                  <span className="text-ink-3"> · {item.serviceDescription}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type ApprovalSummary = {
  projectId: string;
  fileName: string;
  versionNumber: number;
  note: string | null;
  uploadedByName: string | null;
  requestedByName: string | null;
  openFeedbackCount: number;
  openFeedback: string[];
};

export function ApprovalSummaryCard({ summary }: { summary: ApprovalSummary }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="truncate text-[12px] font-medium text-ink">
          {summary.fileName} <span className="tnum text-ink-3">v{summary.versionNumber}</span>
        </span>
        {summary.openFeedbackCount > 0 ? (
          <span className="tnum shrink-0 text-[11px] text-warning">
            {summary.openFeedbackCount} góp ý mở
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-success">Không còn góp ý mở</span>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="text-[12px] text-ink-2">{summary.note ?? "Không có ghi chú phiên bản"}</p>
        <p className="mt-1 text-[11px] text-ink-3">
          {summary.uploadedByName ? `${summary.uploadedByName} tải lên` : ""}
          {summary.requestedByName ? ` · ${summary.requestedByName} gửi duyệt` : ""}
        </p>
        {summary.openFeedback.length > 0 ? (
          <ul className="mt-2 grid gap-1">
            {summary.openFeedback.map((text, index) => (
              <li key={index} className="text-[11.5px] text-ink-3">
                • {text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="border-t border-line px-3 py-2">
        <Button asChild size="xs">
          <Link href={`/projects/${summary.projectId}/approvals`}>Mở màn duyệt</Link>
        </Button>
      </div>
    </div>
  );
}

export function CardNote({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed border-line px-3 py-2 text-[12px] text-ink-3">{text}</p>;
}
