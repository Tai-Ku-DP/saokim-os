"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideApprovalAction } from "@/server/actions/files";
import type { ActionResult } from "@/server/services/errors";

/**
 * Duyệt / yêu cầu sửa. Lý do chỉ bắt buộc khi duyệt thay khách (PM override) —
 * nhưng UI luôn hiện ô lý do để khuyến khích ghi lại (audit).
 */
export function ApprovalDecision({ approvalId }: { approvalId: string }) {
  const [approveState, approve, approving] = useActionState<ActionResult, FormData>(
    decideApprovalAction,
    { ok: false },
  );
  const [changeState, requestChange, changing] = useActionState<ActionResult, FormData>(
    decideApprovalAction,
    { ok: false },
  );

  useEffect(() => {
    const message = approveState.message ?? changeState.message;
    const error = approveState.error ?? changeState.error;
    if (message) toast.success(message);
    if (error) toast.error(error);
  }, [approveState, changeState]);

  return (
    <div className="grid gap-2">
      <form action={approve} className="grid gap-2">
        <input type="hidden" name="approvalId" value={approvalId} />
        <input type="hidden" name="decision" value="approved" />
        <Input name="reason" placeholder="Lý do (bắt buộc nếu duyệt thay khách)" className="h-8 text-[12px]" />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={approving}>
            {approving ? "Đang duyệt…" : "Duyệt"}
          </Button>
        </div>
      </form>

      <form action={requestChange} className="grid gap-2">
        <input type="hidden" name="approvalId" value={approvalId} />
        <input type="hidden" name="decision" value="changes_requested" />
        <Input name="reason" placeholder="Cần sửa gì?" className="h-8 text-[12px]" />
        <div className="flex gap-2">
          <Button type="submit" size="sm" variant="outline" disabled={changing}>
            {changing ? "Đang gửi…" : "Yêu cầu sửa"}
          </Button>
        </div>
      </form>
    </div>
  );
}
