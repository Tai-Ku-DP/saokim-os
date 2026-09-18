/**
 * Kiểu domain dùng chung — KHÔNG phụ thuộc dialect DB (docs/01 §5, docs/05 §1).
 * P2 sẽ thêm schema Drizzle và repository trả về đúng các kiểu này.
 */

export type Id = string;

export type ProjectType =
  | "brand_strategy"
  | "brand_identity"
  | "website"
  | "profile"
  | "packaging"
  | "video"
  | "marcom"
  | "consulting";

export type ProjectStatus = "active" | "waiting_client" | "overdue" | "completed" | "paused";

export type MilestoneStatus = "pending" | "in_progress" | "done" | "overdue";

export type TaskStatus = "todo" | "doing" | "review" | "done";

export type VersionStatus = "draft" | "in_review" | "changes_requested" | "approved";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "changes_requested";

export type ChecklistItemStatus = "todo" | "submitted" | "approved" | "rejected";

export type FeedbackStatus = "open" | "resolved" | "wontfix";

export type BrandStage = "startup" | "scaleup" | "corporate";

/** Tiền luôn là integer đơn vị nhỏ nhất + currency (docs/01 §5). */
export type Money = { amountCents: number; currency: string };
