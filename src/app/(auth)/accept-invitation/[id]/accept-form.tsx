"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction, type AuthActionState } from "@/server/actions/auth";

export function AcceptInvitationForm({ invitationId }: { invitationId: string }) {
  const [state, accept, pending] = useActionState<AuthActionState, FormData>(
    acceptInvitationAction,
    {},
  );

  return (
    <form action={accept} className="grid gap-3">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Đang vào…" : "Vào không gian làm việc"}
      </Button>
    </form>
  );
}
