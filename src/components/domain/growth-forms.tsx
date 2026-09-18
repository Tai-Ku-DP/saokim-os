"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createServiceRequestAction,
  generateRecommendationsAction,
} from "@/server/actions/growth";
import type { ActionResult } from "@/server/services/errors";

export function ServiceRequestForm({
  services,
  projectId,
}: {
  services: { id: string; name: string }[];
  projectId?: string;
}) {
  const [state, submit, pending] = useActionState<ActionResult, FormData>(
    createServiceRequestAction,
    { ok: false },
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form ref={formRef} action={submit} className="grid gap-2.5">
      {projectId ? <input type="hidden" name="projectId" value={projectId} /> : null}
      <div className="grid gap-1.5">
        <Label htmlFor="req-title" className="label-xs">
          Bạn cần gì?
        </Label>
        <Input
          id="req-title"
          name="title"
          required
          placeholder="Ví dụ: Cần guideline cho đối tác"
          className="h-8 text-[12.5px]"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="req-service" className="label-xs">
          Nhóm dịch vụ
        </Label>
        <select
          id="req-service"
          name="serviceId"
          className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[12.5px] text-ink"
        >
          <option value="">Chưa xác định</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="req-note" className="label-xs">
          Ghi chú
        </Label>
        <Textarea id="req-note" name="note" rows={2} className="text-[12.5px]" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Đang gửi…" : "Gửi yêu cầu"}
      </Button>
    </form>
  );
}

export function GenerateRecommendationsButton({ organizationId }: { organizationId: string }) {
  const [state, run, pending] = useActionState<ActionResult, FormData>(
    generateRecommendationsAction,
    { ok: false },
  );

  useEffect(() => {
    if (state.message) toast.success(state.message);
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={run}>
      <input type="hidden" name="organizationId" value={organizationId} />
      <Button type="submit" size="xs" variant="outline" disabled={pending}>
        {pending ? "Đang tính…" : "Cập nhật đề xuất"}
      </Button>
    </form>
  );
}
