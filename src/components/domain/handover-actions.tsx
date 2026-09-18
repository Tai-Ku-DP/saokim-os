"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prepareHandoverAction, releaseHandoverAction } from "@/server/actions/handover";
import type { ActionResult } from "@/server/services/errors";

export function HandoverActions({
  projectId,
  canRelease,
  released,
}: {
  projectId: string;
  canRelease: boolean;
  released: boolean;
}) {
  const [prepareState, prepare, preparing] = useActionState<ActionResult, FormData>(
    prepareHandoverAction,
    { ok: false },
  );
  const [releaseState, release, releasing] = useActionState<ActionResult, FormData>(
    releaseHandoverAction,
    { ok: false },
  );

  useEffect(() => {
    const message = prepareState.message ?? releaseState.message;
    const error = prepareState.error ?? releaseState.error;
    if (message) toast.success(message);
    if (error) toast.error(error);
  }, [prepareState, releaseState]);

  if (released) return null;

  return (
    <div className="flex gap-2">
      <form action={prepare}>
        <input type="hidden" name="projectId" value={projectId} />
        <Button type="submit" size="sm" variant="outline" disabled={preparing}>
          {preparing ? "Đang tập hợp…" : "Tập hợp bộ bàn giao"}
        </Button>
      </form>
      {canRelease ? (
        <form action={release}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button type="submit" size="sm" disabled={releasing}>
            {releasing ? "Đang phát hành…" : "Phát hành bàn giao"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
