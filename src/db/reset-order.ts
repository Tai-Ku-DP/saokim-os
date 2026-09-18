/**
 * Thứ tự xoá dữ liệu khi reset (con trước, cha sau) — dùng bởi `scripts/seed.ts`
 * và được kiểm chứng bằng `tests/integration/reset-order.test.ts`.
 *
 * ⚠️ Vì sao phải là một danh sách tường minh:
 * SQLite **không** gắn `ON DELETE SET NULL` cho khoá ngoại thêm bằng
 * `ALTER TABLE … ADD COLUMN` (xem `drizzle/sqlite/0001_*.sql`: cột `checklist_item.file_id`).
 * Nên `checklist_item` BẮT BUỘC đứng trước `file_asset`, nếu không sẽ gặp
 * `FOREIGN KEY constraint failed` khi reset.
 *
 * Khi thêm bảng/cột có khoá ngoại mới → cập nhật danh sách này; test sẽ báo nếu sai thứ tự.
 */
export const RESET_ORDER = [
  "ai_feedback",
  "ai_run",
  "audit_log",
  "interaction_event",
  "notification_outbox",
  "notification",
  "opportunity",
  "service_request",
  "growth_recommendation",
  "brand_health_snapshot",
  "brand_scan_result",
  "brand_guideline",
  "brand_asset",
  "handover_item",
  "handover_package",
  "issue_log",
  "meeting_note",
  "approval",
  "feedback",
  "checklist_item",
  "onboarding_checklist",
  "document_request",
  "brand_brief",
  "file_version",
  "file_asset",
  "task",
  "milestone",
  "project_member",
  "project",
  "company_profile",
  "service_package",
  "invitation",
  "member",
  "organization",
  "session",
  "account",
  "verification",
  "user",
] as const;
