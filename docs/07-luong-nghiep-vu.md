# 07 — Luồng nghiệp vụ & luồng kỹ thuật (mô tả hệ thống đang chạy)

> Tài liệu này mô tả **đúng những gì code đang làm** tại commit `f98c793` (nhánh `main`).
> Mọi hằng số, tên file, tên hàm đều lấy từ code thật — không phải thiết kế mong muốn.
> Muốn xem quy tắc sản phẩm/thiết kế thì đọc `docs/00`–`docs/06`; tài liệu này nói **đường đi**.

---

## 1. Kiến trúc một request đi qua những đâu

```
Browser
  │
  ├── GET  /<route>                     → Server Component (page.tsx)
  │      └── src/app/(app)/layout.tsx   → AppShell: requireSession()  [chặn 1]
  │             └── (staff)/layout.tsx  → requireStaff()  hoặc redirect /today  [chặn 2]
  │                    └── page.tsx     → requireSession()/requireStaff() lấy ctx  [chặn 3]
  │                           └── service (src/server/services/*)  ← nghiệp vụ
  │                                  └── assertProjectAccess(ctx, …)  [chặn 4]
  │                                         └── db (src/db) → Drizzle → SQLite
  │
  ├── POST Server Action                → src/server/actions/*.ts
  │      └── requireSession()  [chặn 5] → service → assertProjectAccess  [chặn 6] → db
  │
  ├── POST /api/ai/chat                 → getAuthContext() [chặn 7] → budget → tools → DeepSeek
  │
  └── GET  /api/versions/[id]/download  → getAuthContext() [chặn 8] → assertProjectAccess [chặn 9] → storage
```

**Luật bất di bất dịch:** quyết định quyền luôn ở **server**. Tầng client chỉ ẩn/hiện nút.
`organizationId` luôn lấy từ session/membership, **không bao giờ** từ dữ liệu client gửi lên.

### Bản đồ thư mục theo tầng
| Tầng | Vị trí | Nhiệm vụ |
|---|---|---|
| Route/UI | `src/app/**/page.tsx` | lấy ctx, gọi service, render |
| Khung | `src/components/shell/*` | sidebar, topbar, ⌘K, page header |
| Ghi dữ liệu | `src/server/actions/*.ts` | `"use server"`, validate zod, gọi service, `revalidatePath` |
| Nghiệp vụ | `src/server/services/*.ts` | **nơi duy nhất** enforce bất biến |
| Quyền | `src/server/auth/{access,project-access,guard}.ts` | quyết định thuần → IO → session |
| Dữ liệu | `src/db/{index,sqlite/*}` | schema, client, migration |
| AI | `src/ai/*` | gateway, tool, prompt, guardrails, cost |
| Thông báo | `src/server/notifications/*` | phân giải người nhận, dispatch outbox |

---

## 2. Luồng xác thực & phiên

```
Người dùng mở /today
  │
  ├─(chưa có session)─→ requireSession() → redirect /sign-in
  │
  └─(đã có session)──→ getAuthContext()  [src/server/auth/guard.ts]
         │
         ├─ user.type = "internal"  → ctx = { kind:"staff", role: user.role }
         │
         └─ user.type = "client"    → tìm membership của chính user
                ├─ ưu tiên session.activeOrganizationId nếu khớp
                ├─ nếu chưa có → lấy membership đầu tiên (order by createdAt)
                └─ không có membership nào → trả null → về /sign-in
```

**Đăng nhập** (`src/server/actions/auth.ts`):

| Cách | Hàm | Ghi chú |
|---|---|---|
| Email + mật khẩu | `auth.api.signInEmail` | lỗi luôn trả "Email hoặc mật khẩu không đúng" (không tiết lộ email có tồn tại) |
| Mã 6 số qua email | `sendVerificationOTP` → `signInEmailOTP` | OTP hạn **300s**, tối đa 3 lần, lưu dạng hash |
| Magic link | `magicLink` | hạn **300s**, token hash |
| Đăng xuất | `signOutAction` | xoá session rồi `redirect("/sign-in")` |

Sau khi đăng nhập thành công → `redirect("/")` → `src/app/page.tsx` đọc `homeFor(viewer.type)`:
**nhân sự → `/inbox`**, **khách hàng → `/today`**.

Giao diện: 1 tầng `user`; plugin `admin` giữ role nhân sự, plugin `organization` giữ role trong công ty khách.

---

## 3. Luồng lời mời khách hàng (invitation)

```
PM/Account                    Hệ thống                         Khách được mời
   │                             │                                  │
   │ organization.inviteMember   │                                  │
   ├────────────────────────────►│ tạo bản ghi `invitation`         │
   │                             │ hạn 48h (60*60*48)               │
   │                             ├── sendInvitationEmail ──► email chứa link
   │                             │      /accept-invitation/<id>      │
   │                             │                                  │
   │                             │        khách mở link ◄───────────┤
   │                             │        getInvitationView() lọc status + hạn
   │                             │        chưa đăng nhập → mời /sign-in?next=…
   │                             │        đã đăng nhập → acceptInvitationAction
   │                             │◄─────────────────────────────────┤
   │                             │ acceptInvitation + setActiveOrganization
   │                             │ cấp membership role owner|member
   │                             │                                  └─► redirect /today
```

Bảo vệ: better-auth yêu cầu **email đăng nhập phải trùng email được mời**; màn hình hiển thị
`status` + `expired` (tính ở `src/server/services/invitations.ts`, không tính trong component
để component thuần khi render).

---

## 4. Luồng ra quyết định quyền (3 lớp)

```
        access.ts                        project-access.ts                guard.ts
   (THUẦN, test được)                  (IO, không Next)            (session + redirect)
┌──────────────────────────┐   ┌──────────────────────────────┐   ┌────────────────────────┐
│ can(role, {project:[…]}) │   │ assertProjectAccess(ctx,     │   │ getAuthContext()       │
│ mayAccessProject(ctx,    │◄──┤   projectId, level)          │◄──┤ requireSession()       │
│   shield, level)         │   │ requireOrgScope(ctx, orgId)  │   │ requireStaff()         │
│ levelAllows(granted,req) │   │                              │   │ requireClientOrg()     │
└──────────────────────────┘   └──────────────────────────────┘   │ requirePermission()    │
                                                                  │ requireProjectAccess() │
                                                                  └────────────────────────┘
```

**Mức truy cập dự án:** `read(1) < write(2) < approve(3)`.

**Quy tắc `mayAccessProject` (thực tế trong code):**

| Ai | Điều kiện được xem dự án |
|---|---|
| Client Owner | mọi dự án thuộc `organizationId` của mình |
| Client Member | phải có dòng `project_member` và đủ mức |
| Staff có `project.manage_members` (admin/pm/account) | mọi dự án |
| Staff khác (designer, cs, management) | phải có dòng `project_member` và đủ mức |
| Khác công ty | **luôn từ chối**, lý do `cross_org` |

**Redirect ở tầng layout:** khách vào `/inbox|/clients|/reports|/admin` → đá về `/today`;
chưa đăng nhập → `/sign-in`. Trong Server Action thì `requireStaff()` **ném lỗi** (để action trả
thông báo thay vì nhảy trang).

---

## 5. Luồng Onboarding

```
PM tạo dự án
   │
   ▼
createChecklistForProject(ctx, projectId)                 [src/server/services/onboarding.ts]
   │  • chọn template theo project_type  (ONBOARDING_TEMPLATES — 8 loại)
   │  • gọi lại không tạo trùng (kiểm tra checklist đã tồn tại)
   │  • transaction: insert checklist + N checklist_item + audit_log
   ▼
Khách: /onboarding  →  submitChecklistItem()   → item.status = submitted
   │                                              └─ enqueue outbox inapp (checklist-submitted:<id>)
   ▼
PM: reviewChecklistItem({decision:"approved"|"rejected"})
   │  • chỉ ai có onboarding.review (admin/pm/account/cs)
   │  • rejected BẮT BUỘC có note → nếu không: DomainError REASON_REQUIRED
   ▼
PM bấm "Hoàn tất onboarding"  → completeChecklist()
   │
   ├─ còn mục required chưa approved?
   │     ├─ không override            → CHECKLIST_INCOMPLETE
   │     ├─ override nhưng thiếu quyền → CHECKLIST_INCOMPLETE
   │     ├─ override nhưng thiếu lý do → REASON_REQUIRED
   │     └─ override + có lý do        → cho qua, ghi audit `overridden: true` + reason
   ▼
checklist.status = completed, completionRate = 100 → enqueue email `onboarding-completed:<id>`
```

Tiến độ (`completionRate`) **chỉ tính mục `required` đã `approved`** (AC-ONB-004).
Brand brief: `saveBrandBrief` tạo mới hoặc cập nhật (không nhân đôi), `submit: true` → status
`submitted` + outbox.

---

## 6. Luồng Delivery (trái tim của hệ thống)

### 6.1 Vòng đời phiên bản tệp

```
NV Sao Kim                     PM                    Client Owner
    │                           │                          │
    │ addVersion()              │                          │
    ├──► kiểm tra file tồn tại + assertProjectAccess(write)
    │    nextNumber = max(version_number) + 1        ← AC-DEL-002, không ghi đè
    │    storage.put(key)   ← I/O NGOÀI transaction
    │    ▼ TRANSACTION ĐỒNG BỘ:
    │       insert file_version(status=in_review)
    │       update file_asset.current_version_id
    │       insert audit_log  +  enqueueOutbox inapp
    │                           │                          │
    │                           │ requestApproval()        │
    │                           ├─ assertProjectAccess(approve)
    │                           ├─ người duyệt phải có project_member.access = "approve"
    │                           │  (nếu không → APPROVER_NOT_ALLOWED)
    │                           ▼ TRANSACTION:
    │                              insert approval(pending) + version.status=in_review
    │                              audit_log + outbox email
    │                           │                          │
    │                           │        decideApproval() ◄┘
    │                           │        ├─ approval phải còn pending (nếu không: APPROVAL_DECIDED)
    │                           │        ├─ phải là người được chỉ định, hoặc staff
    │                           │        │    • staff duyệt thay mà không có lý do → REASON_REQUIRED
    │                           ▼        ▼ TRANSACTION:
    │                              approved  → version.status=approved + approvedBy + approvedAt
    │                                          ⇒ PHIÊN BẢN BỊ KHOÁ (AC-DEL-004)
    │                              rejected  → version.status=changes_requested
    │                              update approval + audit_log + outbox
    ▼
Muốn sửa tiếp ⇒ chỉ có một đường: addVersion() tạo phiên bản MỚI
```

`addFeedback()` cũng chặn trên phiên bản đã duyệt → `VERSION_LOCKED`
("Phiên bản đã duyệt nên không nhận phản hồi mới. Tạo phiên bản mới để tiếp tục trao đổi.").
Phản hồi khai báo `fileId` khác `version.fileId` → `FEEDBACK_MISMATCH` (AC-DEL-003).

### 6.2 Bàn giao

```
prepareHandover()   → gom mọi file_version.status = approved vào handover_item
                      status = ready ; nếu đã released → HANDOVER_RELEASED
releaseHandover()   → status = released + releasedBy + releasedAt
                      project.status = completed
                      audit_log + outbox email `handover-released:<id>`
                      (chưa có mục nào → HANDOVER_EMPTY)
```

Tải tệp: `GET /api/versions/[versionId]/download` → không đăng nhập **401** → không có quyền
**403** → tệp `visibility=internal` mà là khách **403** → mất tệp trong storage **410**.
Header `cache-control: private, no-store`.

---

## 7. Luồng "Hôm nay" — hàng đợi hành động

`getTodayActions(ctx)` trong `src/server/services/today.ts` gom theo thứ tự, sau đó **loại trùng →
sắp theo ưu tiên → cắt còn tối đa 5** (`MAX_ITEMS = 5`):

| # | Nguồn | Ưu tiên | Ghi chú |
|---|---|---|---|
| 1 | Yêu cầu duyệt đang chờ **tôi** | `today` | với Client Owner là việc số 1 |
| 2 | Task của tôi đến hạn/quá hạn | `overdue` / `today` | `dueDate < cuối ngày` |
| 3 | Checklist item required chưa đạt (chỉ khách) | `overdue` / `soon` | |
| 4 | Document request còn `pending` (chỉ khách) | `soon` | |
| 5 | Phản hồi mới chưa xử lý (chỉ staff) | `today` | trong dự án mình được phân công |

Thứ tự ưu tiên khi sắp: `overdue(0) < today(1) < soon(2) < info(3)`.
Mỗi mục bắt buộc có `title`, `reason` (1 dòng), `href` (deep-link) và `cta` — thỏa quy tắc "ít chữ"
trong `docs/00 §6`.

`getTodaySummary(ctx)` trả 3 số định hướng: dự án đang chạy · chờ tôi duyệt · (khách) tài liệu cần
nộp / (nhân sự) việc quá hạn.

---

## 8. Luồng AI-native (chi tiết nhất)

### 8.1 Một lượt hỏi–đáp

```
Người dùng bấm ✨ (topbar) hoặc ⌘K → "Hỏi trợ lý AI"
   │  AiPanel mở trong Sheet; surface suy từ pathname:
   │     /today → today.v1 · /projects → workroom.v1 · /brand-growth → brand-home.v1 · còn lại general.v1
   ▼
useChat().sendMessage({ text })  ──POST /api/ai/chat──►  route handler
   │
   ├─ getAuthContext()  → null thì 401
   ├─ resolveBillingOrgId(ctx)   (khách = công ty họ; nhân sự = org_saokim_internal)
   ├─ withinBudget(orgId)?  spentToday < AI_DAILY_COST_CAP_USD (mặc định 5 USD)
   │     └─ VƯỢT CAP → stream 1 câu thông báo, KHÔNG gọi tool, log ai_run status="capped"
   ├─ buildTools(ctx)  → tool đọc (có execute) + tool ghi ĐÃ LỌC THEO QUYỀN
   │
   ├─ aiDriver() = "deepseek" (có key)  → streamText({ model, instructions, tools, stopWhen: isStepCount(4) })
   │     ├─ model tự chọn tool → execute chạy server-side với ctx đã scope
   │     └─ onEnd → logAiRun(provider=deepseek, token vào/ra, cost micro-USD, latency)
   │
   └─ aiDriver() = "mock" (chưa có key)  → bộ chọn ý định tất định
         └─ VẪN gọi tool thật trên dữ liệu đã scope (chỉ thay phần "model quyết định")
   ▼
Client đọc message.parts và render:
   text           → <p> ngắn
   reasoning-*    → ẨN (không hiện trên UI)
   tool-<name>    → RENDERED_TOOLS[name]  (map ở src/ai/renderers-registry.ts)
   không có renderer → không hiển thị gì (không bao giờ đổ JSON thô)
```

### 8.2 Catalog tool hiện có

**Tool đọc (8) — model có thể gọi, tự chạy, dữ liệu đã scope:**

| Tool | Trả về | Phục vụ tính năng |
|---|---|---|
| `showTodayActions` | hàng đợi việc cần làm | "Hôm nay có gì" |
| `showProjects` | danh sách dự án được xem | tổng quan |
| `summarizeFeedback` | phản hồi gộp theo phiên bản | tóm tắt phản hồi |
| `showRisks` | khách im lặng / duyệt treo / việc quá hạn | cảnh báo rủi ro |
| `showApprovals` | duyệt đang chờ của một dự án | — |
| `showGrowthRoadmap` | lộ trình 3 giai đoạn + dịch vụ đề xuất | gợi ý phát triển |
| `summarizeApproval` | phiên bản chờ duyệt: ghi chú + góp ý mở | duyệt nhanh |
| `listFiles` | tệp + trạng thái phiên bản mới nhất | — |

**Tool ghi (3) — KHÔNG có `execute`, chỉ hiện card xác nhận:**

```
model đề xuất  →  <ConfirmCard>  →  người dùng bấm  →  confirmAiWriteAction()
                                                        ├─ mayUseWriteTool(ctx, tool)?  không → từ chối
                                                        └─ service thật (kiểm tra quyền lần nữa) → ghi + audit + outbox
```
`createServiceRequest` · `createDesignRequest` · `requestDocument`.
Bảng quyền nằm ở `WRITE_TOOL_PERMISSIONS` trong `src/ai/guardrails.ts`.

### 8.3 Guardrails đang chạy thật
| Cơ chế | Hàm | Tác dụng |
|---|---|---|
| Chặn tool ghi theo quyền | `mayUseWriteTool`, `allowedWriteTools` | model không thấy tool mà người dùng không được dùng |
| Che PII | `redactPii` | email / SĐT VN / số 9–12 chữ số → `[email]`, `[số điện thoại]` |
| Bọc tài liệu | `asUntrustedDocument` | nội dung khách tải lên nằm trong `<tài-liệu-không-tin-cậy>` |
| Phát hiện injection | `looksLikeInjection` | 4 mẫu câu lệnh đáng ngờ (vd "hãy duyệt…") |
| Giới hạn vòng lặp | `stopWhen: isStepCount(4)` | chặn tool-loop vô hạn |
| Không lưu nội dung | `logAiRun` | chỉ ghi metadata + token + cost, không ghi prompt/response |
| Hạn mức | `withinBudget` | cap theo tổ chức/ngày |

### 8.4 Đã kiểm chứng với DeepSeek thật
Hỏi "Hôm nay tôi cần làm gì?" → HTTP 200 sau **2.26s**, model **tự gọi `showTodayActions`**,
tool trả dữ liệu thật, câu trả lời tiếng Việt 2 câu, `reasoning` tách riêng và bị ẩn.
Log: 3.410 token vào / 137 token ra / **594 micro-USD** / latency 1762ms.

---

## 9. Luồng thông báo (outbox pattern)

```
Hành động nghiệp vụ (upload, comment, duyệt, nộp tài liệu, phát hành bàn giao…)
   │
   ▼  TRONG CÙNG TRANSACTION với hành động:
enqueueInTx(tx, { organizationId, channel, idempotencyKey, payload })
   │   idempotencyKey UNIQUE  ⇒ cùng một hành động chỉ sinh 1 thông báo dù retry
   ▼
notification_outbox (status=pending, nextAttemptAt=now)
   │
   ▼  npm run outbox   (một lượt, cho cron)   |   npm run outbox -- --watch  (mỗi 30s)
processDueOutbox()   [src/server/notifications/dispatch.ts]
   │  lấy batch 25 bản ghi pending đến hạn
   ├─ channel = inapp    → resolveRecipients() → insert `notification` cho từng người
   ├─ channel = email    → resolveRecipients() → sendMail  (hoặc gửi trực tiếp nếu payload có `to`)
   ├─ channel = webhook  → POST N8N_WEBHOOK_URL  (kèm header x-brandcare-secret)
   └─ channel = zalo     → cũng qua n8n (Portal KHÔNG gọi trực tiếp Zalo)
   │
   ├─ thành công → status=sent, sentAt, attempts+1
   └─ lỗi       → attempts+1, nextAttemptAt = now + 2^attempts phút
                  attempts ≥ 5 (MAX_ATTEMPTS) → status=failed  (không kẹt vô hạn)
```

**Phân giải người nhận theo `payload.kind`** (`resolveRecipients`) — không gửi cho người lạ:

| kind | Người nhận |
|---|---|
| `version_uploaded` | toàn bộ `project_member` phía client + PM |
| `feedback_created` | phía đối diện (khách góp ý → staff; staff góp ý → khách) |
| `approval_requested` | đúng `approval.approverId` |
| `approval_decided` | cả hai phía của dự án |
| `checklist_item_submitted`, `brand_brief_submitted` | PM |
| `document_requested`, `onboarding_completed`, `handover_released` | phía khách |
| `service_request_created` | mọi user nội bộ có role `account` hoặc `admin` |

UI: `/notifications` (đánh dấu đã đọc / tất cả), badge chưa đọc trên topbar do `AppShell` truyền vào.

---

## 10. Luồng Growth & Retaining

```
Dự án chuyển status = completed khi PM bấm "Phát hành bàn giao" (releaseHandover)
   │
   │  ⚠️ LƯU Ý THỰC TẾ: releaseHandover KHÔNG tự sinh đề xuất.
   │     Đề xuất được sinh khi nhân sự có quyền `growth.recommend` bấm nút
   │     "Cập nhật đề xuất" trên /growth (idempotent, bấm nhiều lần không nhân đôi).
   │     Đây là chỗ có thể tự động hoá sau này bằng cách gọi trong releaseHandover
   │     hoặc bằng một job định kỳ — hiện tại cố ý để thủ công.
   ▼
generateRecommendationsFromCompletedProjects(ctx, orgId)      [rule TẤT ĐỊNH]
   │  NEXT_STEPS_BY_PROJECT_TYPE[projectType] → tìm service_package theo tên
   │  ⇒ insert growth_recommendation (trigger.rule = "after_<projectType>")
   │  ⇒ gọi lại KHÔNG nhân đôi (so key projectId:serviceId)
   ▼
/ growth : hiển thị lộ trình 3 giai đoạn + dịch vụ đề xuất
   │  buildRoadmap(): done / current / next suy từ dự án đã xong & đang chạy
   ▼
Khách bấm "Gửi yêu cầu"  → createServiceRequestAction → createServiceRequest()
   │  TRANSACTION: insert service_request
   │              + insert opportunity (source="service_request")  ← SIGNAL cho CRM
   │              + audit_log + outbox channel=webhook  ⇒ n8n đẩy sang Odoo/Zalo
   ▼
Account thấy ở /clients/[companyId] (pipeline) và /reports
```

**Portal không bao giờ gọi trực tiếp Odoo hay Zalo** — chỉ ghi signal và đẩy qua n8n (ADR/PRD §16).

Brand Home (`/brand-vault`) đọc `brand_asset`, `brand_guideline`, `brand_health_snapshot`,
`brand_scan_result` — dữ liệu gắn **organization**, không gắn project, nên sống lâu hơn dự án.

---

## 11. Luồng dữ liệu & khả năng chuyển Postgres

```
page/action ──► service ──► db (src/db/index.ts)     ← điểm chọn driver DUY NHẤT
                              │
                              ├─ DB_DRIVER=sqlite → src/db/sqlite/{client,schema}.ts
                              └─ DB_DRIVER=pg     → chưa viết (throw lỗi rõ ràng) — xem docs/01 §8
```

Ràng buộc kỹ thuật đã gặp và tuân thủ:
- **better-sqlite3 chỉ chạy transaction ĐỒNG BỘ** → mọi thao tác ghi nguyên tử nằm trong
  `db.transaction((tx) => …)` với API đồng bộ (`.run()`, `.get()`, `.all()`); phần I/O (storage,
  gọi mạng) đặt **ngoài** transaction.
- Query đọc vẫn viết `await` để sau này đổi sang driver async mà không phải sửa.
- ID là `text` UUID sinh ở app ⇒ copy sang Postgres **không phải re-key** (`npm run pg:dry-run`).

---

## 12. Bảng tra: bất biến nằm ở file nào

| Bất biến / quy tắc | File | Hàm |
|---|---|---|
| Phiên bản đã duyệt là bất biến | `services/files.ts` | `addFeedback` (guard), `decideApproval` (set `approved`) |
| `version_number` tăng liên tục | `services/files.ts` | `addVersion` |
| Phản hồi đúng tệp + đúng phiên bản | `services/files.ts` | `addFeedback` |
| Duyệt thay khách phải có lý do | `services/files.ts` | `decideApproval` |
| Cổng hoàn tất onboarding | `services/onboarding.ts` | `completeChecklist` |
| Yêu cầu bổ sung phải ghi rõ | `services/onboarding.ts` | `reviewChecklistItem` |
| Bàn giao không sửa sau khi phát hành | `services/handover.ts` | `prepareHandover`, `releaseHandover` |
| Không truy cập chéo công ty | `auth/project-access.ts` | `assertProjectAccess`, `requireOrgScope` |
| Client Member không được duyệt | `auth/access.ts` + `services/files.ts` | `clientRoles.member` (không có `file.approve`) |
| AI không tự ghi dữ liệu | `ai/guardrails.ts` + `server/actions/ai-write.ts` | `mayUseWriteTool`, `confirmAiWriteAction` |
| Outbox cùng transaction với hành động | `services/outbox.ts` | `enqueueInTx` |
| Idempotency thông báo | schema `notification_outbox.idempotencyKey` (UNIQUE) | — |
| Hạn mức chi phí AI | `ai/cost.ts` | `withinBudget`, `logAiRun` |
| Giới hạn 25MB mỗi tệp | `server/actions/files.ts` | `uploadVersionAction` |

---

## 13. Chạy thử từng luồng

```bash
# Chuẩn bị
cp .env.example .env.local        # điền BETTER_AUTH_SECRET + DEEPSEEK_API_KEY
npm install && npm run db:migrate && npm run db:seed
npm run dev                       # http://localhost:3000

# 1) Xác thực: tung.vu@anphatland.vn / BrandCare@2026  (mật khẩu chung BrandCare@2026)
# 2) Delivery: /projects/seed_project_identity/files → tải lên phiên bản mới
#              → /approvals → Duyệt → quay lại /files: phiên bản đã khoá
# 3) Onboarding: /onboarding → "Đánh dấu đã nộp" → đăng nhập minhanh@saokim.vn để duyệt
# 4) AI: bấm ✨ trên topbar → "Hôm nay làm gì?"  (cần DEEPSEEK_API_KEY; không có key sẽ chạy chế độ demo)
# 5) Thông báo: npm run outbox      # gửi các bản ghi pending, xem terminal
# 6) Chuyển Postgres: npm run pg:dry-run   # đếm số dòng nguồn theo thứ tự FK
# Kiểm thử: npm test               # 99 test, gồm bất biến + isolation + outbox
```

---

## 14. Những chỗ tài liệu này KHÔNG nói tới (để tránh hiểu sai)

- Chữ ký số/phê duyệt pháp lý, Zalo hai chiều, SSO, `src/db/pg/*`: **chưa triển khai** (xem `docs/06 §0`).
- `job` nền duy nhất hiện có là outbox worker; không có queue/worker framework nào khác.
- Dashboard chưa dùng chart library (ADR-006) — số liệu hiển thị dạng số + progress bar.
- `/admin` hiện là màn hình placeholder có nội dung thật nhưng **chưa có chức năng quản trị**.
