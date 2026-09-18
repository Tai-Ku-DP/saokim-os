"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/auth/guard";
import { toActionResult, type ActionResult } from "@/server/services/errors";
import { createServiceRequest } from "@/server/services/growth";
import { generateRecommendationsFromCompletedProjects } from "@/server/services/retaining";

/** Server Action cho Growth Hub. */

export async function createServiceRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const parsed = z
      .object({
        title: z.string().min(3, { error: "Tiêu đề tối thiểu 3 ký tự" }).max(120),
        note: z.string().max(1000).optional(),
        serviceId: z.string().optional(),
        projectId: z.string().optional(),
      })
      .safeParse({
        title: String(formData.get("title") ?? "").trim(),
        note: String(formData.get("note") ?? "").trim() || undefined,
        serviceId: String(formData.get("serviceId") ?? "") || undefined,
        projectId: String(formData.get("projectId") ?? "") || undefined,
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }

    await createServiceRequest(ctx, {
      title: parsed.data.title,
      note: parsed.data.note,
      serviceId: parsed.data.serviceId,
      projectId: parsed.data.projectId,
    });

    revalidatePath("/growth");
    revalidatePath("/brand-vault");
    return { ok: true, message: "Đã gửi yêu cầu. Sao Kim sẽ liên hệ" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function generateRecommendationsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const organizationId = String(formData.get("organizationId") ?? "");
    if (!organizationId) return { ok: false, error: "Thiếu khách hàng" };

    const created = await generateRecommendationsFromCompletedProjects(ctx, organizationId);
    revalidatePath("/growth");
    return {
      ok: true,
      message: created > 0 ? `Đã tạo ${created} đề xuất` : "Không có đề xuất mới",
    };
  } catch (error) {
    return toActionResult(error);
  }
}
