"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  Paperclip,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/domain/status-badge";
import {
  attachFilesAction,
  completeChecklistAction,
  detachAttachmentAction,
  markDocumentReceivedAction,
  reviewChecklistItemAction,
  saveBrandBriefAction,
  submitChecklistItemAction,
} from "@/server/actions/onboarding";
import type { ActionResult } from "@/server/services/errors";
import type { BrandBriefFields } from "@/server/services/onboarding";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Onboarding dạng collapse: mỗi mục mở ra có ô nhập nội dung + đính kèm nhiều tệp.
 * Tệp hiển thị dạng card (icon loại tệp, tên, dung lượng, nút tải/gỡ) theo thiết kế tham chiếu.
 */

export type AttachmentView = {
  id: string;
  fileId: string;
  versionId: string | null;
  fileName: string;
  sizeBytes: number | null;
  mime: string | null;
};

function useToasts(...states: ActionResult[]) {
  useEffect(() => {
    for (const state of states) {
      if (state.message) toast.success(state.message);
      if (state.error) toast.error(state.error);
    }
  }, [states]);
}

/* ------------------------------------------------------------------ card tệp */

type FileTone = { Icon: typeof FileIcon; className: string };

function fileTone(fileName: string): FileTone {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { Icon: FileText, className: "border-danger/40 text-danger" };
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext))
    return { Icon: FileImage, className: "border-brand/40 text-brand" };
  if (["xls", "xlsx", "csv"].includes(ext))
    return { Icon: FileSpreadsheet, className: "border-success/40 text-success" };
  if (["doc", "docx", "txt", "md"].includes(ext))
    return { Icon: FileText, className: "border-info/40 text-info" };
  return { Icon: FileIcon, className: "border-line-strong text-ink-3" };
}

/** Một dòng tệp: icon loại tệp + tên + dung lượng + tải + gỡ. */
export function AttachmentCard({
  attachment,
  canDetach,
}: {
  attachment: AttachmentView;
  canDetach: boolean;
}) {
  const { Icon, className } = fileTone(attachment.fileName);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full border bg-surface",
          className,
        )}
      >
        <Icon size={15} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">{attachment.fileName}</p>
        <p className="tnum text-[11px] text-ink-3">{formatFileSize(attachment.sizeBytes)}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {attachment.versionId ? (
          <Button asChild variant="ghost" size="icon-xs" className="bg-surface-2 text-ink-2">
            <a
              href={`/api/versions/${attachment.versionId}/download`}
              aria-label={`Tải ${attachment.fileName}`}
            >
              <Download size={14} aria-hidden />
            </a>
          </Button>
        ) : null}
        {canDetach ? (
          <DetachButton attachmentId={attachment.id} fileName={attachment.fileName} />
        ) : null}
      </div>
    </div>
  );
}

function DetachButton({ attachmentId, fileName }: { attachmentId: string; fileName: string }) {
  const [state, detach, pending] = useActionState<ActionResult, FormData>(detachAttachmentAction, {
    ok: false,
  });
  useToasts(state);

  return (
    <form action={detach}>
      <input type="hidden" name="attachmentId" value={attachmentId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon-xs"
        className="bg-surface-2 text-ink-2 hover:text-danger"
        disabled={pending}
        aria-label={`Gỡ ${fileName}`}
      >
        <Trash2 size={14} aria-hidden />
      </Button>
    </form>
  );
}

/** Khối "Tập tin (n)" + danh sách card. */
export function AttachmentList({
  attachments,
  canDetach,
}: {
  attachments: AttachmentView[];
  canDetach: boolean;
}) {
  if (attachments.length === 0) {
    return <p className="text-[11.5px] text-ink-3">Chưa đính kèm tệp nào.</p>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-[12px] font-semibold text-ink">Tập tin ({attachments.length})</p>
      <div className="grid gap-2">
        {attachments.map((file) => (
          <AttachmentCard key={file.id} attachment={file} canDetach={canDetach} />
        ))}
      </div>
    </div>
  );
}

/** Ô chọn nhiều tệp + nút đính kèm. */
export function AttachFilesForm({
  kind,
  ownerId,
}: {
  kind: "checklist_item" | "document_request";
  ownerId: string;
}) {
  const [state, attach, pending] = useActionState<ActionResult, FormData>(attachFilesAction, {
    ok: false,
  });
  const formRef = useRef<HTMLFormElement>(null);
  useToasts(state);

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={attach} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="ownerId" value={ownerId} />
      <input
        type="file"
        name="files"
        multiple
        aria-label="Chọn tệp để đính kèm"
        className="h-7 max-w-64 cursor-pointer rounded-md border border-line bg-surface px-1.5 text-[11px] file:mr-1.5 file:rounded file:border-0 file:bg-surface-2 file:px-1.5 file:py-0.5 file:text-[11px]"
      />
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        <Paperclip size={12} aria-hidden />
        {pending ? "Đang tải…" : "Đính kèm"}
      </Button>
    </form>
  );
}

/* -------------------------------------------------- mục checklist (collapse) */

export type ChecklistItemView = {
  id: string;
  label: string;
  required: boolean;
  ownerSide: "client" | "staff";
  status: string;
  note: string | null;
  answer: string | null;
  dueAtLabel: string | null;
  attachments: AttachmentView[];
};

const STATUS_DOT: Record<string, string> = {
  todo: "bg-line-strong",
  submitted: "bg-info",
  approved: "bg-success",
  rejected: "bg-hot",
};

export function ChecklistItemPanel({
  item,
  canSubmit,
  canReview,
  canAttach,
  canDetachAny,
}: {
  item: ChecklistItemView;
  canSubmit: boolean;
  canReview: boolean;
  canAttach: boolean;
  canDetachAny: boolean;
}) {
  const [submitState, submit, submitting] = useActionState<ActionResult, FormData>(
    submitChecklistItemAction,
    { ok: false },
  );
  const [reviewState, review, reviewing] = useActionState<ActionResult, FormData>(
    reviewChecklistItemAction,
    { ok: false },
  );
  useToasts(submitState, reviewState);

  const locked = item.status === "approved";
  const canSubmitThis = canSubmit && !locked;

  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 hover:bg-surface-2">
        <ChevronRight
          size={14}
          className="shrink-0 text-ink-3 transition-transform group-open:rotate-90"
          aria-hidden
        />
        <span
          className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[item.status] ?? "bg-line-strong")}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
          {item.label}
          {item.required ? null : (
            <span className="ml-1.5 text-[11px] text-ink-3">không bắt buộc</span>
          )}
        </span>

        {item.attachments.length > 0 ? (
          <span className="tnum shrink-0 text-[11px] text-ink-3">{item.attachments.length} tệp</span>
        ) : null}
        {item.answer ? <span className="shrink-0 text-[11px] text-ink-3">có nội dung</span> : null}
        {item.dueAtLabel ? (
          <span className="shrink-0 text-[11px] text-ink-3">{item.dueAtLabel}</span>
        ) : null}
        <span className="shrink-0 text-[11px] text-ink-3">
          {item.ownerSide === "client" ? "Khách" : "Sao Kim"}
        </span>
        <StatusBadge kind="checklist" value={item.status} />
      </summary>

      <div className="grid gap-3 border-t border-line bg-surface-2/40 px-4 py-3 pl-9">
        <form action={submit} className="grid gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <Label htmlFor={`answer-${item.id}`} className="label-xs">
            Nội dung trả lời
          </Label>
          <Textarea
            id={`answer-${item.id}`}
            name="answer"
            rows={2}
            defaultValue={item.answer ?? ""}
            placeholder="Nhập nội dung cần cung cấp…"
            className="text-[12.5px]"
            disabled={!canSubmitThis}
          />
          {canSubmitThis ? (
            <div>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Đang nộp…" : "Nộp"}
              </Button>
            </div>
          ) : null}
        </form>

        <div className="grid gap-2">
          <AttachmentList
            attachments={item.attachments}
            canDetach={!locked && (canDetachAny || canAttach)}
          />
          {canAttach && !locked ? (
            <AttachFilesForm kind="checklist_item" ownerId={item.id} />
          ) : null}
        </div>

        {item.note ? <p className="text-[11.5px] text-warning">PM yêu cầu: {item.note}</p> : null}

        {canReview && item.status === "submitted" ? (
          <div className="flex flex-wrap items-center gap-2">
            <form action={review}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="decision" value="approved" />
              <Button type="submit" size="xs" disabled={reviewing}>
                Đạt
              </Button>
            </form>
            <form action={review} className="flex items-center gap-1.5">
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="decision" value="rejected" />
              <Input
                name="note"
                placeholder="Cần bổ sung gì?"
                className="h-6 w-44 text-[11px]"
                required
              />
              <Button
                type="submit"
                size="xs"
                variant="ghost"
                className="text-warning"
                disabled={reviewing}
              >
                Yêu cầu bổ sung
              </Button>
            </form>
          </div>
        ) : null}

        {canReview && locked ? (
          <p className="text-[11.5px] text-success">Mục đã được duyệt và khoá.</p>
        ) : null}
      </div>
    </details>
  );
}

/* ------------------------------------------- tài liệu cần cung cấp (collapse) */

export function DocumentPanel({
  doc,
  canWrite,
}: {
  doc: {
    id: string;
    label: string;
    required: boolean;
    status: "pending" | "received" | "waived";
    answer: string | null;
    attachments: AttachmentView[];
  };
  canWrite: boolean;
}) {
  const [attachState] = useActionState<ActionResult, FormData>(attachFilesAction, { ok: false });
  const [receivedState, markReceived, marking] = useActionState<ActionResult, FormData>(
    markDocumentReceivedAction,
    { ok: false },
  );
  useToasts(attachState, receivedState);

  const locked = doc.status === "received" || doc.status === "waived";

  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 hover:bg-surface-2">
        <ChevronRight
          size={14}
          className="shrink-0 text-ink-3 transition-transform group-open:rotate-90"
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{doc.label}</span>
        {doc.attachments.length > 0 ? (
          <span className="tnum shrink-0 text-[11px] text-ink-3">{doc.attachments.length} tệp</span>
        ) : null}
        <StatusBadge kind="document" value={doc.status} />
      </summary>

      <div className="grid gap-3 border-t border-line bg-surface-2/40 px-4 py-3 pl-9">
        <form action={markReceived} className="grid gap-2">
          <input type="hidden" name="documentId" value={doc.id} />
          <Label htmlFor={`doc-answer-${doc.id}`} className="label-xs">
            Nội dung / ghi chú
          </Label>
          <Textarea
            id={`doc-answer-${doc.id}`}
            name="answer"
            rows={2}
            defaultValue={doc.answer ?? ""}
            placeholder="Mô tả tài liệu cung cấp…"
            className="text-[12.5px]"
            disabled={!canWrite || locked}
          />
          {canWrite && !locked ? (
            <div>
              <Button type="submit" size="sm" disabled={marking}>
                {marking ? "Đang lưu…" : "Đánh dấu đã nộp"}
              </Button>
            </div>
          ) : null}
        </form>

        <div className="grid gap-2">
          <AttachmentList attachments={doc.attachments} canDetach={canWrite && !locked} />
          {canWrite && !locked ? (
            <AttachFilesForm kind="document_request" ownerId={doc.id} />
          ) : null}
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------- hoàn tất & brief */

export function CompleteChecklist({
  checklistId,
  canComplete,
  canOverride,
}: {
  checklistId: string;
  canComplete: boolean;
  canOverride: boolean;
}) {
  const [state, complete, pending] = useActionState<ActionResult, FormData>(
    completeChecklistAction,
    { ok: false },
  );
  useToasts(state);

  return (
    <form action={complete} className="grid gap-2">
      <input type="hidden" name="checklistId" value={checklistId} />
      {!canComplete && canOverride ? (
        <div className="grid gap-1.5">
          <Label className="label-xs">Bỏ qua mục còn thiếu (phải ghi lý do)</Label>
          <Input name="reason" placeholder="Lý do bỏ qua" className="h-8 text-[12px]" />
          <input type="hidden" name="override" value="on" />
        </div>
      ) : null}
      <Button type="submit" size="sm" disabled={pending || (!canComplete && !canOverride)}>
        {pending ? "Đang xử lý…" : "Hoàn tất onboarding"}
      </Button>
    </form>
  );
}

const BRIEF_FIELDS: { key: keyof BrandBriefFields; label: string; rows: number }[] = [
  { key: "brand", label: "Thương hiệu", rows: 1 },
  { key: "products", label: "Sản phẩm / dịch vụ", rows: 1 },
  { key: "audience", label: "Khách hàng mục tiêu", rows: 2 },
  { key: "competitors", label: "Đối thủ chính", rows: 1 },
  { key: "tone", label: "Tông giọng mong muốn", rows: 1 },
  { key: "goals", label: "Mục tiêu lần này", rows: 2 },
];

export function BrandBriefForm({
  projectId,
  initial,
}: {
  projectId: string;
  initial: BrandBriefFields | null;
}) {
  const [state, save, pending] = useActionState<ActionResult, FormData>(saveBrandBriefAction, {
    ok: false,
  });
  useToasts(state);

  return (
    <form action={save} className="grid gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      {BRIEF_FIELDS.map((field) => (
        <div key={field.key} className="grid gap-1.5">
          <Label htmlFor={`brief-${field.key}`} className="label-xs">
            {field.label}
          </Label>
          <Textarea
            id={`brief-${field.key}`}
            name={field.key}
            rows={field.rows}
            defaultValue={initial?.[field.key] ?? ""}
            className="text-[12px]"
          />
        </div>
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          Lưu nháp
        </Button>
        <Button type="submit" name="submit" value="1" size="sm" disabled={pending}>
          Gửi brand brief
        </Button>
      </div>
    </form>
  );
}
