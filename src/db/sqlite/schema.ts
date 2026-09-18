import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

/* Bảng do better-auth sinh (organization/user/session/account/verification/member/
   invitation/twoFactor). Import tường minh để có binding cục bộ cho khoá ngoại —
   `export *` không tạo binding trong module này. */
import { organization, user } from "./auth-schema";

/**
 * Schema SQLite (docs/05). Bảng của better-auth nằm trong `./auth-schema` và được
 * re-export ở cuối file.
 *
 * 8 quy tắc portability (docs/01 §5) — BẮT BUỘC:
 *  - PK là `text` UUID sinh ở app, KHÔNG autoincrement/serial
 *  - timestamp UTC (`timestamp_ms`), app luôn thấy `Date`
 *  - tiền là integer đơn vị nhỏ nhất + cột currency
 *  - boolean qua `{ mode: "boolean" }`
 *  - JSON qua `.$type<T>()`
 *  - không enum ở DB (chỉ type-level qua `{ enum: [...] }`)
 *  - không tính năng riêng dialect ngoài port
 */

/* ------------------------------------------------------------------ helpers */

const pk = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());
const deletedAt = () => integer("deleted_at", { mode: "timestamp_ms" });
const ts = (name: string) => integer(name, { mode: "timestamp_ms" });
const bool = (name: string) => integer(name, { mode: "boolean" });
const projectRef = () =>
  text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" });
const orgRef = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

/* ------------------------------------------------------------------- khách hàng */

export const companyProfile = sqliteTable(
  "company_profile",
  {
    id: pk(),
    organizationId: text("organization_id")
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: "cascade" }),
    industry: text("industry"),
    website: text("website"),
    size: text("size"),
    phone: text("phone"),
    address: text("address"),
    brandStage: text("brand_stage", { enum: ["startup", "scaleup", "corporate"] }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("company_profile_stage_idx").on(t.brandStage)],
);

/* ---------------------------------------------------------------- dự án & phân công */

export const project = sqliteTable(
  "project",
  {
    id: pk(),
    organizationId: orgRef(),
    code: text("code"),
    name: text("name").notNull(),
    projectType: text("project_type", {
      enum: [
        "brand_strategy",
        "brand_identity",
        "website",
        "profile",
        "packaging",
        "video",
        "marcom",
        "consulting",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["active", "waiting_client", "overdue", "completed", "paused"],
    })
      .notNull()
      .default("active"),
    startDate: ts("start_date"),
    endDate: ts("end_date"),
    pmId: text("pm_id").references(() => user.id, { onDelete: "set null" }),
    progress: integer("progress").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("project_org_status_idx").on(t.organizationId, t.status),
    index("project_pm_status_idx").on(t.pmId, t.status),
  ],
);

export const projectMember = sqliteTable(
  "project_member",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    side: text("side", { enum: ["client", "staff"] }).notNull(),
    access: text("access", { enum: ["read", "write", "approve"] }).notNull().default("read"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("project_member_unique").on(t.projectId, t.userId),
    index("project_member_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------- onboarding */

export const onboardingChecklist = sqliteTable(
  "onboarding_checklist",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    templateKey: text("template_key").notNull(),
    status: text("status", { enum: ["draft", "in_progress", "completed"] })
      .notNull()
      .default("draft"),
    completionRate: integer("completion_rate").notNull().default(0),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("onboarding_project_idx").on(t.projectId)],
);

export const checklistItem = sqliteTable(
  "checklist_item",
  {
    id: pk(),
    checklistId: text("checklist_id")
      .notNull()
      .references(() => onboardingChecklist.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    required: bool("required").notNull().default(true),
    status: text("status", { enum: ["todo", "submitted", "approved", "rejected"] })
      .notNull()
      .default("todo"),
    ownerSide: text("owner_side", { enum: ["client", "staff"] }).notNull().default("client"),
    dueAt: ts("due_at"),
    completedAt: ts("completed_at"),
    orderIndex: integer("order_index").notNull().default(0),
    note: text("note"),
    /** Nội dung khách trả lời cho mục này (ô nhập khi mở mục ra). */
    answer: text("answer"),
    submittedAt: ts("submitted_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("checklist_item_list_idx").on(t.checklistId, t.orderIndex)],
);

export const brandBrief = sqliteTable(
  "brand_brief",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    organizationId: orgRef(),
    fields: text("fields", { mode: "json" })
      .$type<{
        brand?: string;
        products?: string;
        audience?: string;
        competitors?: string;
        tone?: string;
        goals?: string;
      }>()
      .notNull()
      .default({}),
    attachments: text("attachments", { mode: "json" }).$type<string[]>().notNull().default([]),
    status: text("status", { enum: ["draft", "submitted", "approved"] })
      .notNull()
      .default("draft"),
    submittedBy: text("submitted_by").references(() => user.id, { onDelete: "set null" }),
    submittedAt: ts("submitted_at"),
    aiRunId: text("ai_run_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("brand_brief_project_idx").on(t.projectId)],
);

export const documentRequest = sqliteTable(
  "document_request",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    required: bool("required").notNull().default(true),
    status: text("status", { enum: ["pending", "received", "waived"] })
      .notNull()
      .default("pending"),
    /** Nội dung/ghi chú khách nhập kèm tài liệu. */
    answer: text("answer"),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    receivedAt: ts("received_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("document_request_project_idx").on(t.projectId, t.status)],
);

/**
 * Đính kèm cho onboarding (AC-ONB-002): một mục có THỂ có nhiều tệp.
 *
 * Vì sao một bảng với hai cột FK (thay vì bảng polymorphic `owner_type/owner_id`):
 * giữ được khoá ngoại thật cho cả hai chủ thể, mà UI vẫn dùng chung một component.
 * Đúng một trong hai cột được set (ràng buộc ở tầng service).
 *
 * Xoá = **gỡ mềm**: set `detached_at` + `detached_by`; tệp vẫn nằm trong dự án và
 * `audit_log` ghi lại ai gỡ (không xoá dữ liệu).
 */
export const attachment = sqliteTable(
  "attachment",
  {
    id: pk(),
    projectId: projectRef(),
    checklistItemId: text("checklist_item_id").references(() => checklistItem.id, {
      onDelete: "cascade",
    }),
    documentRequestId: text("document_request_id").references(() => documentRequest.id, {
      onDelete: "cascade",
    }),
    fileId: text("file_id")
      .notNull()
      .references(() => fileAsset.id, { onDelete: "cascade" }),
    versionId: text("version_id").references(() => fileVersion.id, { onDelete: "set null" }),
    attachedBy: text("attached_by").references(() => user.id, { onDelete: "set null" }),
    detachedAt: ts("detached_at"),
    detachedBy: text("detached_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("attachment_item_idx").on(t.checklistItemId, t.detachedAt),
    index("attachment_doc_idx").on(t.documentRequestId, t.detachedAt),
    index("attachment_project_idx").on(t.projectId),
  ],
);

/* ---------------------------------------------------------------------- delivery */

export const milestone = sqliteTable(
  "milestone",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    dueDate: ts("due_date"),
    status: text("status", { enum: ["pending", "in_progress", "done", "overdue"] })
      .notNull()
      .default("pending"),
    orderIndex: integer("order_index").notNull().default(0),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("milestone_project_idx").on(t.projectId, t.orderIndex)],
);

export const task = sqliteTable(
  "task",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    milestoneId: text("milestone_id").references(() => milestone.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: ["todo", "doing", "review", "done"] })
      .notNull()
      .default("todo"),
    dueDate: ts("due_date"),
    priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    dependsOnTaskId: text("depends_on_task_id").references((): AnySQLiteColumn => task.id, {
      onDelete: "set null",
    }),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    completedAt: ts("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("task_project_status_idx").on(t.projectId, t.status, t.dueDate),
    index("task_owner_idx").on(t.ownerId, t.status),
  ],
);

export const fileAsset = sqliteTable(
  "file_asset",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["design", "document", "image", "video", "other"] })
      .notNull()
      .default("other"),
    storageKey: text("storage_key").notNull(),
    mime: text("mime"),
    sizeBytes: integer("size_bytes"),
    currentVersionId: text("current_version_id"),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    visibility: text("visibility", { enum: ["internal", "client"] }).notNull().default("client"),
    deletedAt: deletedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("file_asset_project_idx").on(t.projectId, t.visibility, t.deletedAt),
  ],
);

export const fileVersion = sqliteTable(
  "file_version",
  {
    id: pk(),
    fileId: text("file_id")
      .notNull()
      .references(() => fileAsset.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    storageKey: text("storage_key").notNull(),
    checksum: text("checksum"),
    note: text("note"),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    status: text("status", {
      enum: ["draft", "in_review", "changes_requested", "approved"],
    })
      .notNull()
      .default("draft"),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    approvedAt: ts("approved_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("file_version_unique").on(t.fileId, t.versionNumber)],
);

export const feedback = sqliteTable(
  "feedback",
  {
    id: pk(),
    fileId: text("file_id")
      .notNull()
      .references(() => fileAsset.id, { onDelete: "cascade" }),
    versionId: text("version_id")
      .notNull()
      .references(() => fileVersion.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnySQLiteColumn => feedback.id, {
      onDelete: "cascade",
    }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    authorSide: text("author_side", { enum: ["client", "staff"] }).notNull(),
    body: text("body").notNull(),
    anchor: text("anchor", { mode: "json" })
      .$type<{ page?: number; x?: number; y?: number; section?: string }>()
      .notNull()
      .default({}),
    status: text("status", { enum: ["open", "resolved", "wontfix"] })
      .notNull()
      .default("open"),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("feedback_version_idx").on(t.versionId, t.status)],
);

export const approval = sqliteTable(
  "approval",
  {
    id: pk(),
    versionId: text("version_id")
      .notNull()
      .references(() => fileVersion.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    approverId: text("approver_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "changes_requested"],
    })
      .notNull()
      .default("pending"),
    decidedAt: ts("decided_at"),
    reason: text("reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("approval_approver_idx").on(t.approverId, t.status),
    index("approval_project_idx").on(t.projectId, t.status),
  ],
);

export const meetingNote = sqliteTable(
  "meeting_note",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    heldAt: ts("held_at"),
    attendees: text("attendees", { mode: "json" }).$type<string[]>().notNull().default([]),
    summary: text("summary"),
    actionItems: text("action_items", { mode: "json" })
      .$type<{ text: string; ownerId?: string; dueAt?: string }[]>()
      .notNull()
      .default([]),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    aiRunId: text("ai_run_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("meeting_note_project_idx").on(t.projectId, t.heldAt)],
);

export const issueLog = sqliteTable(
  "issue_log",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: ["open", "in_progress", "closed"] }).notNull().default("open"),
    raisedBy: text("raised_by").references(() => user.id, { onDelete: "set null" }),
    closedAt: ts("closed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("issue_project_idx").on(t.projectId, t.status)],
);

export const handoverPackage = sqliteTable(
  "handover_package",
  {
    id: pk(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["preparing", "ready", "released"] })
      .notNull()
      .default("preparing"),
    releasedAt: ts("released_at"),
    releasedBy: text("released_by").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("handover_project_idx").on(t.projectId)],
);

export const handoverItem = sqliteTable(
  "handover_item",
  {
    id: pk(),
    handoverId: text("handover_id")
      .notNull()
      .references(() => handoverPackage.id, { onDelete: "cascade" }),
    fileId: text("file_id").references(() => fileAsset.id, { onDelete: "set null" }),
    versionId: text("version_id").references(() => fileVersion.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    note: text("note"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("handover_item_list_idx").on(t.handoverId, t.orderIndex)],
);

/* --------------------------------------------------------------- brand & retaining */

export const brandAsset = sqliteTable(
  "brand_asset",
  {
    id: pk(),
    organizationId: orgRef(),
    type: text("type", {
      enum: ["logo", "font", "color", "template", "key_visual", "profile", "guideline", "other"],
    }).notNull(),
    name: text("name").notNull(),
    fileId: text("file_id").references(() => fileAsset.id, { onDelete: "set null" }),
    value: text("value", { mode: "json" }).$type<Record<string, string>>().notNull().default({}),
    usageNote: text("usage_note"),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("brand_asset_org_type_idx").on(t.organizationId, t.type)],
);

export const brandGuideline = sqliteTable(
  "brand_guideline",
  {
    id: pk(),
    organizationId: orgRef(),
    title: text("title").notNull(),
    sections: text("sections", { mode: "json" })
      .$type<{ key: string; title: string; content: string }[]>()
      .notNull()
      .default([]),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    publishedAt: ts("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("brand_guideline_org_idx").on(t.organizationId, t.status)],
);

export const brandScanResult = sqliteTable(
  "brand_scan_result",
  {
    id: pk(),
    organizationId: orgRef(),
    score: integer("score"),
    findings: text("findings", { mode: "json" })
      .$type<{ key: string; label: string; severity: string }[]>()
      .notNull()
      .default([]),
    recommendation: text("recommendation", { mode: "json" })
      .$type<{ serviceId?: string; text: string }[]>()
      .notNull()
      .default([]),
    source: text("source"),
    scannedAt: ts("scanned_at"),
    createdAt: createdAt(),
  },
  (t) => [index("brand_scan_org_idx").on(t.organizationId, t.scannedAt)],
);

export const brandHealthSnapshot = sqliteTable(
  "brand_health_snapshot",
  {
    id: pk(),
    organizationId: orgRef(),
    score: integer("score"),
    breakdown: text("breakdown", { mode: "json" })
      .$type<{ key: string; label: string; score: number }[]>()
      .notNull()
      .default([]),
    takenAt: ts("taken_at"),
    createdAt: createdAt(),
  },
  (t) => [index("brand_health_org_idx").on(t.organizationId, t.takenAt)],
);

/* ------------------------------------------------------------------- growth & revenue */

export const servicePackage = sqliteTable("service_package", {
  id: pk(),
  name: text("name").notNull(),
  category: text("category"),
  description: text("description"),
  priceRange: text("price_range"),
  active: bool("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const growthRecommendation = sqliteTable(
  "growth_recommendation",
  {
    id: pk(),
    organizationId: orgRef(),
    projectId: text("project_id").references(() => project.id, { onDelete: "set null" }),
    trigger: text("trigger", { mode: "json" })
      .$type<{ rule: string; input?: Record<string, unknown> }>()
      .notNull()
      .default({ rule: "manual" }),
    serviceId: text("service_id").references(() => servicePackage.id, { onDelete: "set null" }),
    priority: integer("priority").notNull().default(0),
    status: text("status", { enum: ["new", "shown", "requested", "dismissed"] })
      .notNull()
      .default("new"),
    aiRunId: text("ai_run_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("growth_rec_org_idx").on(t.organizationId, t.status)],
);

export const serviceRequest = sqliteTable(
  "service_request",
  {
    id: pk(),
    organizationId: orgRef(),
    projectId: text("project_id").references(() => project.id, { onDelete: "set null" }),
    serviceId: text("service_id").references(() => servicePackage.id, { onDelete: "set null" }),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    note: text("note"),
    status: text("status", { enum: ["new", "contacted", "quoted", "won", "lost"] })
      .notNull()
      .default("new"),
    assignedTo: text("assigned_to").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("service_request_org_idx").on(t.organizationId, t.status)],
);

export const opportunity = sqliteTable(
  "opportunity",
  {
    id: pk(),
    organizationId: orgRef(),
    source: text("source", {
      enum: ["service_request", "brand_scan", "interaction"],
    }).notNull(),
    serviceId: text("service_id").references(() => servicePackage.id, { onDelete: "set null" }),
    stage: text("stage").notNull().default("new"),
    valueCents: integer("value_cents"),
    currency: text("currency").notNull().default("VND"),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    crmRef: text("crm_ref"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("opportunity_org_idx").on(t.organizationId, t.stage)],
);

/* ------------------------------------------------------------------ notification */

export const notification = sqliteTable(
  "notification",
  {
    id: pk(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: orgRef(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: ts("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

export const notificationOutbox = sqliteTable(
  "notification_outbox",
  {
    id: pk(),
    organizationId: orgRef(),
    channel: text("channel", { enum: ["email", "zalo", "webhook", "inapp"] }).notNull(),
    payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["pending", "sent", "failed"] }).notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull(),
    nextAttemptAt: ts("next_attempt_at"),
    sentAt: ts("sent_at"),
    lastError: text("last_error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("outbox_idempotency_unique").on(t.idempotencyKey),
    index("outbox_status_idx").on(t.status, t.nextAttemptAt),
  ],
);

/* ------------------------------------------------- intelligence, audit & AI */

export const interactionEvent = sqliteTable(
  "interaction_event",
  {
    id: pk(),
    organizationId: orgRef(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    projectId: text("project_id").references(() => project.id, { onDelete: "set null" }),
    action: text("action", {
      enum: ["login", "view_file", "download", "view_service", "comment", "approve"],
    }).notNull(),
    targetId: text("target_id"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("interaction_org_idx").on(t.organizationId, t.createdAt)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: pk(),
    organizationId: orgRef(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: text("before", { mode: "json" }).$type<Record<string, unknown>>(),
    after: text("after", { mode: "json" }).$type<Record<string, unknown>>(),
    reason: text("reason"),
    ip: text("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.organizationId, t.createdAt)],
);

export const aiRun = sqliteTable(
  "ai_run",
  {
    id: pk(),
    organizationId: orgRef(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    feature: text("feature").notNull(),
    provider: text("provider").notNull().default("deepseek"),
    model: text("model").notNull(),
    status: text("status", { enum: ["ok", "error", "capped"] }).notNull().default("ok"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: integer("cost_usd_micros").notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_run_org_idx").on(t.organizationId, t.createdAt)],
);

export const aiFeedback = sqliteTable(
  "ai_feedback",
  {
    id: pk(),
    aiRunId: text("ai_run_id")
      .notNull()
      .references(() => aiRun.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    rating: text("rating", { enum: ["up", "down"] }).notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("ai_feedback_run_idx").on(t.aiRunId)],
);

/* -------------------------------------------------------- bảng của better-auth */

export * from "./auth-schema";
