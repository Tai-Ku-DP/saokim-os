"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/auth/guard";
import { toActionResult, type ActionResult } from "@/server/services/errors";
import {
  completeChecklist,
  createChecklistForProject,
  createDocumentRequest,
  markDocumentReceived,
  reviewChecklistItem,
  saveBrandBrief,
  submitChecklistItem,
  submitChecklistItemWithFile,
  uploadDocumentFile,
} from "@/server/services/onboarding";
import { readUpload } from "@/server/upload";

/** Server Action cho Onboarding Hub — mỗi action tự xác thực rồi gọi service. */

export async function createChecklistAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const projectId = String(formData.get("projectId") ?? "");
    if (!projectId) return { ok: false, error: "Thiếu dự án" };

    await createChecklistForProject(ctx, projectId);
    revalidatePath("/onboarding");
    return { ok: true, message: "Đã sinh checklist theo loại dự án" };
  } catch (error) {
    return toActionResult(error);
  }
}

/**
 * Nộp một mục onboarding. Hai đường:
 *  - có tệp  → lưu tệp (StoragePort + phiên bản) rồi mới đánh dấu đã nộp (AC-ONB-002)
 *  - không tệp → chỉ đánh dấu đã nộp (dùng cho mục xác nhận, ví dụ "Xác nhận lịch kickoff")
 */
export async function submitChecklistItemAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const itemId = String(formData.get("itemId") ?? "");
    if (!itemId) return { ok: false, error: "Thiếu mục cần nộp" };

    const hasFile = formData.get("file") instanceof File && (formData.get("file") as File).size > 0;

    if (hasFile) {
      const upload = await readUpload(formData);
      if (!upload.ok) return { ok: false, error: upload.error };

      const note = String(formData.get("note") ?? "").trim() || undefined;
      const result = await submitChecklistItemWithFile(ctx, {
        itemId,
        fileName: upload.fileName,
        note,
        data: upload.data,
      });

      revalidatePath("/onboarding");
      revalidatePath("/today");
      revalidatePath("/projects", "layout");
      return { ok: true, message: `Đã nộp ${upload.fileName} (phiên bản ${result.versionNumber})` };
    }

    await submitChecklistItem(ctx, itemId);
    revalidatePath("/onboarding");
    revalidatePath("/today");
    return { ok: true, message: "Đã nộp mục này" };
  } catch (error) {
    return toActionResult(error);
  }
}

/** Nộp tệp cho một "tài liệu cần cung cấp" — bắt buộc có tệp. */
export async function uploadDocumentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const documentId = String(formData.get("documentId") ?? "");
    if (!documentId) return { ok: false, error: "Thiếu tài liệu cần nộp" };

    const upload = await readUpload(formData);
    if (!upload.ok) return { ok: false, error: upload.error };

    const result = await uploadDocumentFile(ctx, {
      documentId,
      fileName: upload.fileName,
      data: upload.data,
    });

    revalidatePath("/onboarding");
    revalidatePath("/today");
    revalidatePath("/projects", "layout");
    return { ok: true, message: `Đã nộp ${upload.fileName} (phiên bản ${result.versionNumber})` };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function reviewChecklistItemAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const parsed = z
      .object({
        itemId: z.string().min(1),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(300).optional(),
      })
      .safeParse({
        itemId: formData.get("itemId"),
        decision: formData.get("decision"),
        note: String(formData.get("note") ?? "").trim() || undefined,
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }

    await reviewChecklistItem(ctx, parsed.data);
    revalidatePath("/onboarding");
    return {
      ok: true,
      message: parsed.data.decision === "approved" ? "Đã duyệt mục" : "Đã yêu cầu bổ sung",
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function completeChecklistAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const checklistId = String(formData.get("checklistId") ?? "");
    if (!checklistId) return { ok: false, error: "Thiếu checklist" };

    await completeChecklist(ctx, {
      checklistId,
      override: formData.get("override") === "on",
      reason: String(formData.get("reason") ?? "").trim() || undefined,
    });

    revalidatePath("/onboarding");
    revalidatePath("/today");
    return { ok: true, message: "Onboarding đã hoàn tất" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function saveBrandBriefAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const projectId = String(formData.get("projectId") ?? "");
    if (!projectId) return { ok: false, error: "Thiếu dự án" };

    const fields = {
      brand: text(formData, "brand"),
      products: text(formData, "products"),
      audience: text(formData, "audience"),
      competitors: text(formData, "competitors"),
      tone: text(formData, "tone"),
      goals: text(formData, "goals"),
    };

    if (!fields.brand) return { ok: false, error: "Cần tên thương hiệu" };

    await saveBrandBrief(ctx, { projectId, fields, submit: formData.get("submit") === "1" });
    revalidatePath("/onboarding");
    return {
      ok: true,
      message: formData.get("submit") === "1" ? "Đã gửi brand brief" : "Đã lưu nháp",
    };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createDocumentRequestAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const projectId = String(formData.get("projectId") ?? "");
    const label = String(formData.get("label") ?? "").trim();
    if (!projectId || !label) return { ok: false, error: "Thiếu thông tin" };

    await createDocumentRequest(ctx, { projectId, label });
    revalidatePath("/onboarding");
    return { ok: true, message: "Đã yêu cầu tài liệu" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function markDocumentReceivedAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const documentId = String(formData.get("documentId") ?? "");
    if (!documentId) return { ok: false, error: "Thiếu tài liệu" };

    await markDocumentReceived(ctx, { documentId });
    revalidatePath("/onboarding");
    return { ok: true, message: "Đã đánh dấu đã nhận" };
  } catch (error) {
    return toActionResult(error);
  }
}

function text(formData: FormData, key: string): string | undefined {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : undefined;
}
