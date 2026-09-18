"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { confirmAiWriteAction } from "@/server/actions/ai-write";

/**
 * Ngữ cảnh cho panel AI: quyền ghi + dự án đang mở (để tool ghi biết gắn vào đâu).
 * Quyền do SERVER truyền xuống — client không tự suy ra (docs/03 §4 luật 2).
 */
type AiContextValue = {
  canWrite: boolean;
  projectId?: string;
};

const AiCtx = createContext<AiContextValue>({ canWrite: false });

export function AiContextProvider({
  value,
  children,
}: {
  value: AiContextValue;
  children: ReactNode;
}) {
  return <AiCtx.Provider value={value}>{children}</AiCtx.Provider>;
}

export function useAiContext() {
  return useContext(AiCtx);
}

export function useAiWrite() {
  const { canWrite, projectId } = useAiContext();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function confirm(
    tool: string,
    data: { title?: string; note?: string; label?: string; reason?: string },
  ) {
    setBusy(true);
    const result = await confirmAiWriteAction({ tool, ...data, projectId });
    setBusy(false);

    if (result.ok) toast.success(result.message ?? "Đã tạo");
    else toast.error(result.error ?? "Không tạo được");

    startTransition(() => {
      // Làm mới dữ liệu phía server sau khi ghi thành công.
      if (result.ok) window.location.reload();
    });
  }

  return { confirm, pending: pending || busy, canWrite };
}
