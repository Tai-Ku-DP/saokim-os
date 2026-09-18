/**
 * Hợp đồng tool ↔ renderer (docs/04 §3): mọi tool model có thể gọi đều phải có
 * component hiển thị. Test `ai.test.ts` so khớp danh sách này với catalog tool —
 * thêm tool mà quên renderer sẽ fail CI.
 *
 * Tách khỏi `tool-renderer.tsx` để test được trong môi trường node (không cần DOM).
 */
export const RENDERED_TOOLS: Record<string, string> = {
  showTodayActions: "Việc cần xử lý",
  showProjects: "Dự án",
  summarizeFeedback: "Phản hồi theo phiên bản",
  showRisks: "Điểm cần chú ý",
  showApprovals: "Yêu cầu duyệt",
  listFiles: "Tệp",
  createServiceRequest: "Yêu cầu dịch vụ",
  createDesignRequest: "Yêu cầu thiết kế",
  requestDocument: "Nhắc nộp tài liệu",
};

export function hasRenderer(toolName: string): boolean {
  return toolName in RENDERED_TOOLS;
}
