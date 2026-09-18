"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/server/auth/guard";
import {
  addFeedback,
  addVersion,
  createFile,
  decideApproval,
  requestApproval,
  resolveFeedback,
} from "@/server/services/files";
import { toActionResult, type ActionResult } from "@/server/services/errors";
import { readUpload } from "@/server/upload";

/**
 * Server Action cho Delivery Hub. Mọi action tự xác thực (Next 16 coi action là
 * endpoint POST công khai) rồi mới gọi service — service kiểm tra quyền lần nữa.
 */

export async function uploadVersionAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const fileId = String(formData.get("fileId") ?? "");
    const note = String(formData.get("note") ?? "").trim();

    if (!fileId) return { ok: false, error: "Thiếu tệp" };

    const upload = await readUpload(formData);
    if (!upload.ok) return { ok: false, error: upload.error };

    const result = await addVersion(ctx, {
      fileId,
      fileName: upload.fileName,
      note: note || undefined,
      data: upload.data,
    });

    revalidatePath("/projects", "layout");
    return { ok: true, message: `Đã tải lên phiên bản ${result.versionNumber}` };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function createFileAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const parsed = z
      .object({
        projectId: z.string().min(1),
        name: z.string().min(2, { error: "Tên tệp tối thiểu 2 ký tự" }).max(120),
        kind: z.enum(["design", "document", "image", "video", "other"]),
        visibility: z.enum(["internal", "client"]),
      })
      .safeParse({
        projectId: formData.get("projectId"),
        name: String(formData.get("name") ?? "").trim(),
        kind: formData.get("kind") ?? "other",
        visibility: formData.get("visibility") ?? "client",
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }

    await createFile(ctx, parsed.data);
    revalidatePath("/projects", "layout");
    return { ok: true, message: "Đã tạo tệp" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function commentAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const parsed = z
      .object({
        fileId: z.string().min(1),
        versionId: z.string().min(1),
        body: z.string().min(2, { error: "Nội dung phản hồi quá ngắn" }).max(2000),
      })
      .safeParse({
        fileId: formData.get("fileId"),
        versionId: formData.get("versionId"),
        body: String(formData.get("body") ?? "").trim(),
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }

    await addFeedback(ctx, parsed.data);
    revalidatePath("/projects", "layout");
    return { ok: true, message: "Đã gửi phản hồi" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function resolveFeedbackAction(formData: FormData): Promise<void> {
  const ctx = await requireSession();
  const feedbackId = String(formData.get("feedbackId") ?? "");
  const status = formData.get("status") === "wontfix" ? "wontfix" : "resolved";
  if (!feedbackId) return;

  await resolveFeedback(ctx, { feedbackId, status });
  revalidatePath("/projects", "layout");
}

export async function requestApprovalAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const parsed = z
      .object({
        projectId: z.string().min(1),
        versionId: z.string().min(1),
        approverId: z.string().min(1, { error: "Chọn người duyệt" }),
        note: z.string().max(500).optional(),
      })
      .safeParse({
        projectId: formData.get("projectId"),
        versionId: formData.get("versionId"),
        approverId: formData.get("approverId"),
        note: String(formData.get("note") ?? "").trim() || undefined,
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }

    await requestApproval(ctx, parsed.data);
    revalidatePath("/projects", "layout");
    return { ok: true, message: "Đã gửi yêu cầu duyệt" };
  } catch (error) {
    return toActionResult(error);
  }
}

export async function decideApprovalAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const parsed = z
      .object({
        approvalId: z.string().min(1),
        decision: z.enum(["approved", "rejected", "changes_requested"]),
        reason: z.string().max(500).optional(),
      })
      .safeParse({
        approvalId: formData.get("approvalId"),
        decision: formData.get("decision"),
        reason: String(formData.get("reason") ?? "").trim() || undefined,
      });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
    }

    await decideApproval(ctx, parsed.data);
    revalidatePath("/projects", "layout");
    revalidatePath("/today");
    return {
      ok: true,
      message:
        parsed.data.decision === "approved"
          ? "Đã duyệt. Phiên bản được khoá"
          : "Đã gửi yêu cầu chỉnh sửa",
    };
  } catch (error) {
    return toActionResult(error);
  }
}
