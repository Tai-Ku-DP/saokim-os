# 05 — Data model

> Drizzle 0.45.2. Hôm nay: `sqlite-core`. Sau này: `pg-core` (mirror từng cột).
> **8 quy tắc portability trong `docs/01` §5 là bắt buộc** — mọi bảng dưới đây tuân theo.

---

## 1. Quy ước chung

```
ID          : text, UUID v4 sinh ở app:  .$defaultFn(() => crypto.randomUUID())
Thời gian   : created_at / updated_at / deleted_at (soft delete)
              SQLite: integer({ mode: "timestamp_ms" })   PG: timestamp({ withTimezone: true })
Tiền        : integer đơn vị nhỏ nhất (amount_cents) + currency text
JSON        : text({ mode: "json" }).$type<T>()   PG: jsonb().$type<T>()
Enum        : text({ enum: [...] }) — chỉ ở tầng type, KHÔNG pgEnum
Xoá         : soft delete cho project/file/brand_asset; hard delete chỉ ở Admin
Mọi bảng tenant-scoped đều có organization_id (FK → organization.id) và index
```

**Ngắn gọn tên bảng:** `snake_case`, số ít cho bảng nghiệp vụ chính, số nhiều không dùng để tránh lẫn với bảng của better-auth (`user`, `session`, `organization`, `member`, `invitation` do better-auth sinh và quản lý).

---

## 2. Bảng do better-auth quản lý (không tự sửa cấu trúc)

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `user` | id, name, email (unique), emailVerified, image, **type** (`internal`\|`client`), **role** (staff role), banned, banReason, banExpires, twoFactorEnabled, createdAt, updatedAt | `type` set trong `databaseHooks.user.create.before`. `role` + `banned*` do plugin `admin` thêm. |
| `session` | id, token, userId, expiresAt, ipAddress, userAgent, **activeOrganizationId**, activeTeamId, impersonatedBy | `activeOrganizationId` là chìa khoá scope của khách hàng |
| `account` | id, userId, providerId, accountId, password, tokens… | email/password + OTP |
| `verification` | id, identifier, value, expiresAt | OTP / magic link |
| `organization` | id, name, slug (unique), logo, metadata, createdAt | **= ClientCompany** (mỗi khách hàng 1 org) |
| `member` | id, userId, organizationId, role (`owner`\|`member`), createdAt | người dùng phía khách hàng |
| `invitation` | id, email, inviterId, organizationId, role, status, expiresAt, teamId | lời mời khách hàng |
| `twoFactor` | id, secret, backupCodes, userId | bật khi khách enterprise yêu cầu (PRD §24) |

---

## 3. Bảng nghiệp vụ

### Khách hàng
| Bảng | Cột | Map PRD §13 |
|---|---|---|
| `company_profile` | id, organization_id (unique FK), industry, website, size, owner_user_id (FK user), phone, address, notes, brand_stage (`startup`\|`scaleup`\|`corporate`), created_at, updated_at | ClientCompany |

### Dự án & phân công
| Bảng | Cột | Map |
|---|---|---|
| `project` | id, organization_id, code, name, **project_type** (`brand_strategy`\|`brand_identity`\|`website`\|`profile`\|`packaging`\|`video`\|`marcom`\|`consulting`), status (`active`\|`waiting_client`\|`overdue`\|`completed`\|`paused`), start_date, end_date, pm_id (FK user), progress (0–100), created_at, updated_at, deleted_at | Project |
| `project_member` | id, project_id, user_id, side (`client`\|`staff`), access (`read`\|`write`\|`approve`), created_at · unique(project_id,user_id) | Team & Role Setup (ONB-006) |

### Onboarding
| Bảng | Cột | Map |
|---|---|---|
| `onboarding_checklist` | id, project_id (FK), template_key, status (`draft`\|`in_progress`\|`completed`), completion_rate, completed_at | OnboardingChecklist |
| `checklist_item` | id, checklist_id, key, label, required (bool), status (`todo`\|`submitted`\|`approved`\|`rejected`), owner_side, due_at, completed_at, order_index, note (PM yêu cầu bổ sung), **answer** (nội dung khách nhập), submitted_at | items |
| `brand_brief` | id, project_id, organization_id, **fields** (JSON: brand, products, audience, competitors, tone, goals), attachments (JSON: file id[]), submitted_by, submitted_at, status | BrandBrief |
| `document_request` | id, project_id, label, required (bool), status (`pending`\|`received`\|`waived`), **answer**, requested_by, received_at | DocumentRequest (ONB-004) |
| `attachment` | id, project_id, checklist_item_id (nullable), document_request_id (nullable), file_id, version_id, attached_by, detached_at, detached_by, created_at | Đính kèm nhiều tệp cho onboarding (AC-ONB-002). Đúng một trong hai cột chủ thể được set. **Gỡ = xoá mềm** (`detached_at`), tệp vẫn nằm trong dự án |

### Delivery
| Bảng | Cột | Map |
|---|---|---|
| `milestone` | id, project_id, name, due_date, status (`pending`\|`in_progress`\|`done`\|`overdue`), order_index, completed_at | Milestone |
| `task` | id, project_id, milestone_id, title, description, owner_id (FK user), status (`todo`\|`doing`\|`review`\|`done`), due_date, priority, depends_on_task_id, created_by, completed_at | Task |
| `file_asset` | id, project_id, name, kind (`design`\|`document`\|`image`\|`video`\|`other`), storage_key, mime, size_bytes, current_version_id, owner_id, visibility (`internal`\|`client`), deleted_at | File/Asset |
| `file_version` | id, file_id, version_number (int), storage_key, checksum, note, uploaded_by, status (`draft`\|`in_review`\|`changes_requested`\|`approved`), approved_by, approved_at, created_at · unique(file_id, version_number) | Version |
| `feedback` | id, file_id, version_id, parent_id (thread), author_id, author_side, body, anchor (JSON: page/x/y hoặc section), status (`open`\|`resolved`\|`wontfix`), resolved_by, resolved_at, created_at | Feedback |
| `approval` | id, version_id, project_id, requested_by, approver_id, status (`pending`\|`approved`\|`rejected`\|`changes_requested`), decided_at, reason | Approval |
| `meeting_note` | id, project_id, title, held_at, attendees (JSON), summary, action_items (JSON), created_by, ai_run_id (nullable) | MeetingNote |
| `issue_log` | id, project_id, title, description, severity (`low`\|`medium`\|`high`), owner_id, status (`open`\|`in_progress`\|`closed`), raised_by, closed_at | IssueLog |
| `handover_package` | id, project_id, status (`preparing`\|`ready`\|`released`), released_at, released_by, notes | HandoverPackage |
| `handover_item` | id, handover_id, file_id, version_id, label, note, order_index | file_list |

### Retaining / Brand
| Bảng | Cột | Map |
|---|---|---|
| `brand_asset` | id, organization_id, type (`logo`\|`font`\|`color`\|`template`\|`key_visual`\|`profile`\|`guideline`\|`other`), name, file_id, value (JSON: hex/font stack cho color/font), usage_note, tags (JSON), created_at | BrandAsset / BrandAssetLibrary |
| `brand_guideline` | id, organization_id, title, sections (JSON: [{key,title,content}]), status (`draft`\|`published`), published_at | BrandGuideline |
| `brand_scan_result` | id, organization_id, score (int 0–100), findings (JSON), recommendation (JSON), source, scanned_at | BrandScanResult |
| `brand_health_snapshot` | id, organization_id, score, breakdown (JSON), taken_at | BrandHealthDashboard |

### Growth / Revenue
| Bảng | Cột | Map |
|---|---|---|
| `service_package` | id, name, category, description, price_range, active (bool) | ServicePackage |
| `growth_recommendation` | id, organization_id, project_id (nullable), trigger (JSON: rule id + dữ liệu vào), service_id, priority, status (`new`\|`shown`\|`requested`\|`dismissed`), ai_run_id (nullable) | GrowthRecommendation |
| `service_request` | id, organization_id, project_id (nullable), service_id (nullable), requested_by, title, note, status (`new`\|`contacted`\|`quoted`\|`won`\|`lost`), assigned_to | RequestNewService (GRO-011) |
| `opportunity` | id, organization_id, source (`service_request`\|`brand_scan`\|`interaction`), service_id, stage, value_cents, currency, owner_id, crm_ref (id bên Odoo) | Opportunity |

### Notification / Audit / Intelligence
| Bảng | Cột | Map |
|---|---|---|
| `notification` | id, user_id, organization_id, type, title, body, link, read_at, created_at | Notification |
| `notification_outbox` | id, channel (`email`\|`zalo`\|`webhook`\|`inapp`), payload (JSON), status (`pending`\|`sent`\|`failed`), attempts, idempotency_key (unique), next_attempt_at, sent_at, last_error | Automation §15 |
| `interaction_event` | id, organization_id, user_id, project_id (nullable), action (`login`\|`view_file`\|`download`\|`view_service`\|`comment`\|`approve`), target_id, meta (JSON), created_at | InteractionHistory §11.3 |
| `audit_log` | id, organization_id, actor_id, action, entity, entity_id, before (JSON), after (JSON), reason, ip, created_at | AuditLog (NFR §17) |
| `ai_run` | id, organization_id, user_id, feature, provider, model, status, input_tokens, output_tokens, cost_usd, latency_ms, error, created_at | AI (mới) |
| `ai_feedback` | id, ai_run_id, user_id, rating (`up`\|`down`), note, created_at | đo chất lượng AI |

---

## 4. Quan hệ chính

```
organization 1─1 company_profile
organization 1─n member ─n user
organization 1─n project 1─n { milestone, task, file_asset, meeting_note, issue_log,
                               onboarding_checklist, handover_package, document_request }
project      1─n project_member ─ user
file_asset   1─n file_version 1─n { feedback, approval }
brand_asset / brand_guideline / brand_scan_result / growth_recommendation / service_request
             └── gắn organization (tồn tại độc lập với project — đây là nền của retaining)
notification_outbox / ai_run / interaction_event / audit_log  └── gắn organization
```

**Quyết định quan trọng:** `brand_asset`, `brand_guideline`, `growth_recommendation`, `service_request` gắn **organization**, không gắn project. Đây chính là chỗ biến portal từ "app quản lý dự án" thành "hệ điều hành thương hiệu" — tài sản sống lâu hơn dự án.

---

## 5. Index bắt buộc

```sql
-- tenant + trạng thái (mọi màn hình danh sách đều query theo cặp này)
project            (organization_id, status)
project            (pm_id, status)
task               (project_id, status, due_date)
file_asset         (project_id, visibility, deleted_at)
file_version       (file_id, version_number DESC)
feedback           (version_id, status)
approval           (approver_id, status)
milestone          (project_id, order_index)
notification       (user_id, read_at, created_at DESC)
notification_outbox(status, next_attempt_at)
interaction_event  (organization_id, created_at DESC)
audit_log          (organization_id, created_at DESC)
ai_run             (organization_id, created_at DESC)
brand_asset        (organization_id, type)
-- unique
file_version       (file_id, version_number)
project_member     (project_id, user_id)
notification_outbox(idempotency_key)
organization       (slug)
user               (email)
```

---

## 6. Bất biến nghiệp vụ (enforce ở service, có test)

| # | Bất biến | Nguồn |
|---|---|---|
| 1 | `file_version.status = 'approved'` là **bất biến** — không sửa/xoá; chỉ tạo version mới | AC-DEL-004 |
| 2 | Mỗi `file_version` thuộc đúng 1 `file_asset`; `version_number` tăng liên tục, không tái sử dụng | AC-DEL-002 |
| 3 | `feedback` luôn có `file_id` + `version_id` khớp nhau | AC-DEL-003 |
| 4 | `project` chuyển `ready_for_kickoff` chỉ khi mọi `checklist_item.required` đã `approved`, hoặc PM override **có `reason`** | AC-ONB-005 |
| 5 | Truy vấn dữ liệu khách hàng luôn lọc `organization_id` từ session | NFR Privacy |
| 6 | `client_member` không tạo được `approval` (chỉ `client_owner`) | §14 |
| 7 | Bản ghi sinh ra do AI luôn có `ai_run_id` và một `audit_log` tương ứng | §04 guardrails |
| 8 | Ghi outbox nằm **cùng transaction** với hành động nghiệp vụ | §15 |
| 9 | `handover_item` chỉ thêm được khi `handover_package.status != 'released'` | §9 |
| 10 | Tiền luôn là integer cents; không có phép tính float trên tiền | §01 |
| 11 | Gỡ tệp đính kèm là **xoá mềm**: chỉ set `detached_at/detached_by`, không xoá tệp — vẫn tải được từ dự án và có `audit_log` | AC-ONB-002 |
| 12 | Mục onboarding đã `approved` thì **không** đính kèm thêm, không gỡ tệp, không nộp lại | AC-ONB-005 |

---

## 7. Migration & seed

- `npm run db:generate` → sinh SQL vào `drizzle/sqlite/`, **commit** cả `meta/`.
- `npm run db:migrate` → chạy **một job duy nhất** (không chạy từ nhiều instance).
- `npm run db:seed` → dữ liệu demo tiếng Việt: 1 công ty khách (BĐS), 2 dự án (Brand Identity + Website), 3 version logo + 5 feedback + 2 approval, onboarding 60%, brand vault + guideline + roadmap, 6 user (admin/pm/designer/account/client_owner/client_member), ~40 interaction_event để AI có dữ liệu.
- Seed **idempotent**: chạy lại không nhân đôi dữ liệu (dùng UUID cố định cho seed + `onConflictDoNothing`).
