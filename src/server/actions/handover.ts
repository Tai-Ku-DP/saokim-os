"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/guard";
import { toActionResult, type ActionResult } from "@/server/services/errors";
import { prepareHandover, releaseHandover } from "@/server/services/handover";

export async function prepareHandoverAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const projectId = String(formData.get("projectId") ?? "");
    if (!projectId) return { ok: false, error: "Thiếu dự án" };

    await prepareHandover(ctx, projectId);
    revalidatePath("/projects", "layout");
    return { ok: true, message: "Đã tập hợp bộ bàn giao" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function releaseHandoverAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const projectId = String(formData.get("projectId") ?? "");
    if (!projectId) return { ok: false, error: "Thiếu dự án" };

    await releaseHandover(ctx, projectId);
    revalidatePath("/projects", "layout");
    return { ok: true, message: "Đã phát hành bàn giao" };
  } catch (error) {
    return toActionResult(error);
  }
}
