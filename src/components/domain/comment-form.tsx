"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { commentAction } from "@/server/actions/files";
import type { ActionResult } from "@/server/services/errors";

/** Góp ý gắn đúng tệp + đúng phiên bản (AC-DEL-003). */
export function CommentForm({
  fileId,
  versionId,
  disabled,
  disabledHint,
}: {
  fileId: string;
  versionId: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [state, comment, pending] = useActionState<ActionResult, FormData>(commentAction, {
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

  if (disabled) {
    return <p className="text-[12px] text-ink-3">{disabledHint ?? "Phiên bản đã khoá"}</p>;
  }

  return (
    <form ref={formRef} action={comment} className="grid gap-2">
      <input type="hidden" name="fileId" value={fileId} />
      <input type="hidden" name="versionId" value={versionId} />
      <Textarea
        name="body"
        required
        rows={2}
        placeholder="Góp ý cho phiên bản này…"
        className="text-[12px]"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Đang gửi…" : "Gửi góp ý"}
        </Button>
      </div>
    </form>
  );
}
