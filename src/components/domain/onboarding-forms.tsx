"use client";

import { useActionState, useEffect } from "react";
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

  return (
    <div className="flex items-center gap-1.5">
      {canSubmit ? (
        <form action={submit}>
          <input type="hidden" name="itemId" value={itemId} />
          <Button type="submit" size="xs" variant="outline" disabled={submitting}>
            {submitting ? "Đang nộp…" : ownerSide === "client" ? "Đánh dấu đã nộp" : "Đánh dấu xong"}
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
