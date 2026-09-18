"use server";

import { requireSession } from "@/server/auth/guard";
import { mayUseWriteTool } from "@/ai/guardrails";
import { toActionResult, type ActionResult } from "@/server/services/errors";
import { createDocumentRequest } from "@/server/services/onboarding";
import { createServiceRequest } from "@/server/services/growth";
import { can } from "@/server/auth/access";

/**
 * Xác nhận một đề xuất do AI đưa ra. Đây là **con đường duy nhất** để AI tạo dữ liệu:
 * model chỉ đề xuất, người dùng bấm xác nhận, action này kiểm tra quyền rồi mới ghi.
 */
export async function confirmAiWriteAction(payload: {
  tool: string;
  title?: string;
  note?: string;
  label?: string;
  reason?: string;
  projectId?: string;
}): Promise<ActionResult> {
  try {
    const ctx = await requireSession();

    if (!mayUseWriteTool(ctx, payload.tool)) {
      return { ok: false, error: "Bạn không có quyền tạo mục này" };
    }

    switch (payload.tool) {
      case "createServiceRequest": {
        if (!payload.title) return { ok: false, error: "Thiếu tiêu đề yêu cầu" };
        await createServiceRequest(ctx, {
          title: payload.title,
          note: payload.note,
          projectId: payload.projectId,
        });
        return { ok: true, message: "Đã tạo yêu cầu dịch vụ" };
      }

      case "createDesignRequest": {
        if (!payload.title) return { ok: false, error: "Thiếu tiêu đề yêu cầu" };
        await createServiceRequest(ctx, {
          title: payload.title,
          note: payload.note,
          projectId: payload.projectId,
        });
        return { ok: true, message: "Đã tạo yêu cầu thiết kế" };
      }

      case "requestDocument": {
        if (!payload.projectId) {
          return { ok: false, error: "Mở một dự án trước khi nhắc nộp tài liệu" };
        }
        if (!payload.label) return { ok: false, error: "Thiếu tên tài liệu" };
        if (!can(ctx, { onboarding: ["review"] })) {
          return { ok: false, error: "Chỉ PM/nhân sự phụ trách được nhắc nộp tài liệu" };
        }
        await createDocumentRequest(ctx, { projectId: payload.projectId, label: payload.label });
        return { ok: true, message: "Đã gửi nhắc nộp tài liệu" };
      }

      default:
        return { ok: false, error: "Đề xuất này không hỗ trợ xác nhận" };
    }
  } catch (error) {
    return toActionResult(error);
  }
}
