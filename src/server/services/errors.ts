import "server-only";

/**
 * Lỗi nghiệp vụ có mã — tầng action map sang thông báo tiếng Việt ngắn (docs/00 §6),
 * không bao giờ lộ chi tiết kỹ thuật cho người dùng.
 */
export type DomainErrorCode =
  | "FILE_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "VERSION_LOCKED"
  | "FEEDBACK_MISMATCH"
  | "FEEDBACK_NOT_FOUND"
  | "APPROVAL_NOT_FOUND"
  | "APPROVAL_DECIDED"
  | "APPROVER_NOT_ALLOWED"
  | "NOT_APPROVER"
  | "REASON_REQUIRED"
  | "CHECKLIST_INCOMPLETE"
  | "HANDOVER_RELEASED"
  | "HANDOVER_EMPTY"
  | "AI_CAP_REACHED"
  | "INVALID_INPUT";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export type ActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
};

/** Chuyển lỗi bất kỳ thành kết quả trả về cho form (không ném ra UI). */
export function toActionResult(error: unknown): ActionResult {
  if (error instanceof DomainError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error && error.name === "ForbiddenError") {
    return { ok: false, error: "Bạn không có quyền thực hiện thao tác này" };
  }
  console.error("[action] lỗi không mong đợi:", error);
  return { ok: false, error: "Có lỗi xảy ra. Thử lại" };
}
