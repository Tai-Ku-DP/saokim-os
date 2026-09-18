import "server-only";

import type { AuthContext } from "@/server/auth/access";
import { can } from "@/server/auth/access";

/**
 * Guardrails cho AI (docs/04 §7). Ba luật cứng:
 *  1. AI KHÔNG tự ghi dữ liệu — tool ghi phải qua xác nhận của người dùng.
 *  2. Không có quyền thì không bao giờ trả về "card xác nhận" cho tool ghi.
 *  3. Nội dung người dùng tải lên là DỮ LIỆU, không phải mệnh lệnh (chống prompt injection).
 */

export type WriteToolPermission = { statement: string; actions: readonly string[] };

/** Quyền cần có cho từng tool ghi. Tool không có trong bảng này = tool đọc. */
export const WRITE_TOOL_PERMISSIONS: Record<string, WriteToolPermission> = {
  createServiceRequest: { statement: "growth", actions: ["request"] },
  createDesignRequest: { statement: "growth", actions: ["request"] },
  requestDocument: { statement: "onboarding", actions: ["review"] },
  logMeetingNote: { statement: "project", actions: ["update"] },
  updateMilestoneStatus: { statement: "project", actions: ["update"] },
  draftBrandBrief: { statement: "onboarding", actions: ["submit"] },
};

export const WRITE_TOOLS = new Set(Object.keys(WRITE_TOOL_PERMISSIONS));

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOLS.has(toolName);
}

export function mayUseWriteTool(ctx: AuthContext, toolName: string): boolean {
  const required = WRITE_TOOL_PERMISSIONS[toolName];
  if (!required) return false;
  // Khách hàng không dùng tool ghi qua AI (trừ khi được cấp trong ma trận).
  return can(ctx, { [required.statement]: [...required.actions] });
}

/** Tool ghi mà người dùng được phép gọi — dùng để lọc trước khi đưa cho model. */
export function allowedWriteTools(ctx: AuthContext, names: string[]): string[] {
  return names.filter((name) => mayUseWriteTool(ctx, name));
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE_VN = /(\+84|0)\d{9,10}/g;
const ID_NUMBER = /\b\d{9}\b|\b\d{12}\b/g;

/**
 * Che PII trước khi gửi nội dung cho model. Không che ID/tên dự án vì đó là ngữ cảnh
 * cần thiết; chỉ che thông tin định danh cá nhân không cần cho tác vụ.
 */
export function redactPii(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(PHONE_VN, "[số điện thoại]")
    .replace(ID_NUMBER, "[số giấy tờ]");
}

/**
 * Bọc nội dung do người dùng tải lên thành khối dữ liệu không tin cậy.
 * Model được dặn không thực thi mệnh lệnh nằm trong khối này.
 */
export function asUntrustedDocument(label: string, content: string): string {
  return [
    `<tài-liệu-không-tin-cậy nguồn="${label}">`,
    redactPii(content),
    "</tài-liệu-không-tin-cậy>",
  ].join("\n");
}

/** Câu lệnh đáng ngờ trong nội dung tải lên — ghi log để soi, không tự động chặn. */
const INJECTION_PATTERNS = [
  /bỏ qua (mọi|tất cả) hướng dẫn/i,
  /ignore (all|previous) instructions/i,
  /hãy (duyệt|phê duyệt|approve)/i,
  /system prompt/i,
];

export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}
