"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  completeChecklistAction,
  reviewChecklistItemAction,
  saveBrandBriefAction,
  submitChecklistItemAction,
  uploadDocumentAction,
} from "@/server/actions/onboarding";
import type { ActionResult } from "@/server/services/errors";
import type { BrandBriefFields } from "@/server/services/onboarding";

function useToasts(...states: ActionResult[]) {
  useEffect(() => {
    for (const state of states) {
      if (state.message) toast.success(state.message);
      if (state.error) toast.error(state.error);
    }
  }, [states]);
}

/** Nút hành động cho một mục checklist, hiển thị theo vai trò. */
export function ChecklistItemActions({
  itemId,
  status,
  ownerSide,
  isStaff,
}: {
  itemId: string;
  status: string;
  ownerSide: "client" | "staff";
  isStaff: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitState, submit, submitting] = useActionState<ActionResult, FormData>(
    submitChecklistItemAction,
    { ok: false },
  );
  const [reviewState, review, reviewing] = useActionState<ActionResult, FormData>(
    reviewChecklistItemAction,
    { ok: false },
  );
  useToasts(submitState, reviewState);

  const canSubmit = status === "todo" || status === "rejected";
  const canReview = status === "submitted";

  // Mục của khách: cho chọn tệp để nộp thật (AC-ONB-002). Bỏ trống tệp vẫn nộp được
  // (dùng cho mục chỉ cần xác nhận).
  const canAttach = ownerSide === "client";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canSubmit && canAttach ? (
        <form action={submit} className="flex items-center gap-1.5">
          <input type="hidden" name="itemId" value={itemId} />
          <input
            ref={fileRef}
            type="file"
            name="file"
            className="h-6 max-w-44 cursor-pointer rounded border border-line bg-surface px-1 text-[10.5px] file:mr-1 file:rounded file:border-0 file:bg-surface-2 file:px-1.5 file:text-[10.5px]"
            aria-label="Chọn tệp để nộp"
          />
          <Button type="submit" size="xs" variant="outline" disabled={submitting}>
            {submitting ? "Đang nộp…" : "Nộp"}
          </Button>
        </form>
      ) : canSubmit ? (
        <form action={submit}>
          <input type="hidden" name="itemId" value={itemId} />
          <Button type="submit" size="xs" variant="outline" disabled={submitting}>
            {submitting ? "Đang nộp…" : "Đánh dấu xong"}
          </Button>
        </form>
      ) : null}

      {isStaff && canReview ? (
        <>
          <form action={review}>
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="decision" value="approved" />
            <Button type="submit" size="xs" disabled={reviewing}>
              Đạt
            </Button>
          </form>
          <form action={review} className="flex items-center gap-1">
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="decision" value="rejected" />
            <Input
              name="note"
              placeholder="Cần bổ sung gì?"
              className="h-6 w-40 text-[11px]"
              required
            />
            <Button type="submit" size="xs" variant="ghost" className="text-warning" disabled={reviewing}>
              Yêu cầu bổ sung
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
}

/** Nút hoàn tất onboarding — kèm override + lý do khi còn mục bắt buộc. */
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

/** Dòng "tệp đã nộp" kèm link tải (nếu có). */
export function SubmittedFileLink({
  label,
  version,
  versionId,
}: {
  label: string | null;
  version: number | null;
  versionId: string | null;
}) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-success">
      <PaperclipIcon />
      {label}
      {version ? <span className="tnum text-ink-3">v{version}</span> : null}
      {versionId ? (
        <a
          href={`/api/versions/${versionId}/download`}
          className="text-brand underline-offset-2 hover:underline"
        >
          Tải
        </a>
      ) : null}
    </span>
  );
}

function PaperclipIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

/** Nộp tệp cho một "tài liệu cần cung cấp" (bắt buộc có tệp). */
export function DocumentUploadForm({ documentId }: { documentId: string }) {
  const [state, submit, pending] = useActionState<ActionResult, FormData>(uploadDocumentAction, {
    ok: false,
  });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={submit} className="flex items-center gap-1.5">
      <input type="hidden" name="documentId" value={documentId} />
      <input
        type="file"
        name="file"
        required
        className="h-6 max-w-44 cursor-pointer rounded border border-line bg-surface px-1 text-[10.5px] file:mr-1 file:rounded file:border-0 file:bg-surface-2 file:px-1.5 file:text-[10.5px]"
        aria-label="Chọn tệp để nộp"
      />
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {pending ? "Đang nộp…" : "Nộp"}
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
