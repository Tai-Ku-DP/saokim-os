"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadVersionAction } from "@/server/actions/files";
import type { ActionResult } from "@/server/services/errors";

/** Tải lên phiên bản mới. Không ghi đè: server tự cấp số phiên bản kế tiếp. */
export function UploadVersionForm({ fileId }: { fileId: string }) {
  const [state, upload, pending] = useActionState<ActionResult, FormData>(uploadVersionAction, {
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
    <form ref={formRef} action={upload} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="fileId" value={fileId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`file-${fileId}`} className="label-xs">
          Tệp mới
        </Label>
        <Input
          id={`file-${fileId}`}
          type="file"
          name="file"
          required
          className="h-8 w-64 cursor-pointer py-1 text-[12px] file:mr-2 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-0.5 file:text-[11px]"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`note-${fileId}`} className="label-xs">
          Ghi chú
        </Label>
        <Input
          id={`note-${fileId}`}
          name="note"
          placeholder="Đổi gì ở phiên bản này?"
          className="h-8 w-52 text-[12px]"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Đang tải…" : "Tải lên"}
      </Button>
    </form>
  );
}
