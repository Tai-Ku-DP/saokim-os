# 03 — Information architecture & phân quyền

---

## 1. Cây route

```
(auth)
  /sign-in                        # email + password (OTP/magic link cho lời mời)
  /accept-invitation/[id]         # khách nhận lời mời → tạo mật khẩu → vào portal
  /forgot-password · /reset-password

(app)                             # dùng chung shell, yêu cầu đăng nhập
  /today                          # BỀ MẶT 1 — hàng đợi hành động (mặc định sau login)
  /projects                       # danh sách dự án (client: chỉ của mình; staff: theo phân công)
  /projects/[projectId]/overview  # tóm tắt + milestone + người phụ trách
  /projects/[projectId]/files     # file + version + upload
  /projects/[projectId]/feedback  # luồng phản hồi theo file/version
  /projects/[projectId]/approvals # duyệt / từ chối / yêu cầu sửa
  /projects/[projectId]/handover  # bộ bàn giao cuối dự án
  /onboarding                     # checklist khởi động, brand brief, tài liệu cần nộp
  /growth                         # lộ trình phát triển + dịch vụ đề xuất + service request
  /brand-vault                    # BỀ MẶT 3 — tài sản, guideline, brand health
  /notifications                  # toàn bộ thông báo + việc cần xử lý
  /settings                       # hồ sơ, người dùng công ty, thông báo, giao diện

(app)/(staff)                     # mặt nội bộ Sao Kim
  /inbox                          # việc của tôi: task, phản hồi chờ xử lý, khách chờ phản hồi
  /admin                          # quản trị user/role/template/project type
  /reports                        # delivery health, CSAT, cơ hội upsell
  /clients/[companyId]            # hồ sơ khách hàng 360° (lịch sử tương tác, signal)

api
  /api/auth/[...all]              # better-auth handler
  /api/ai/chat                    # AI gateway (stream + tools)
```

**Luật route:**
- Route khách hàng **không** chứa từ nội bộ (`hub`, `admin`, `pipeline`, `CRM`).
- Mọi màn hình trong `(app)` phải nằm trong shell; không có page "trần".
- Không dead link: nếu màn hình chưa làm, dùng `empty-state` có nội dung thật, không để link 404.

---

## 2. Map "Key Screens" của PRD §18.2 → route thực

| PRD Key Screen | Route | Bề mặt |
|---|---|---|
| Client Home Dashboard | `/today` | Today |
| Onboarding Dashboard | `/onboarding` | Today (nhánh onboarding) |
| Project Dashboard | `/projects/[projectId]/overview` | Workroom |
| File Review Screen | `/projects/[projectId]/files` (+ `/feedback`) | Workroom |
| Growth Roadmap | `/growth` | Brand Home |
| Brand Vault | `/brand-vault` | Brand Home |
| Brand Health Dashboard | `/brand-vault#health` | Brand Home |
| Service Marketplace | `/growth#services` | Brand Home |
| Notification Center | `/notifications` | mọi bề mặt |
| Admin Console | `/admin` | Staff |

Bổ sung ngoài PRD (cần cho vận hành, đã có trong data model): `/inbox`, `/reports`, `/clients/[companyId]`, `/projects/[projectId]/handover`.

---

## 3. Điều hướng theo vai trò

Sidebar thay đổi theo `user.type` — không hiển thị mục vô nghĩa với người dùng.

```
KHÁCH HÀNG (client_owner, client_member)     SAO KIM (staff)
──────────────────────────────────────       ──────────────────────────────
Hôm nay                                       Inbox            ← mặc định staff
Dự án                                         Dự án
Onboarding          (chỉ khi chưa xong)       Khách hàng
Brand Home                                    Onboarding (template & tiến độ)
Thông báo                                     Báo cáo
Cài đặt                                       Quản trị
                                              Thông báo · Cài đặt
```

- Client **không** thấy: Inbox, Khách hàng, Báo cáo, Quản trị, dữ liệu công ty khác.
- `client_member` **không** thấy mục Duyệt (chỉ được xem + bình luận + nộp tài liệu).
- Staff thấy góc nhìn khách hàng khi mở một dự án (cùng component, khác quyền).

---

## 4. Mô hình phân quyền

Hai tầng, một bảng `user`:

```
user.type = internal  →  plugin `admin` của better-auth, role toàn cục:
                         admin · pm · account · cs · designer · management
user.type = client    →  plugin `organization`, mỗi công ty = 1 org:
                         owner · member        (tổ chức = ClientCompany)
```

### Statement (permission catalog)
```ts
export const statement = {
  ...defaultStatements,           // organization, member, invitation, team
  project:  ["create", "read", "update", "delete", "manage_members"],
  onboarding: ["read", "submit", "review", "override"],
  file:     ["upload", "read", "comment", "approve", "delete"],
  handover: ["prepare", "read", "release"],
  growth:   ["read", "request", "recommend"],
  vault:    ["read", "manage"],
  report:   ["read_own", "read_all"],
  admin:    ["configure", "manage_users"],
  ai:       ["use", "use_write_tools"],
} as const;
```

### Ma trận quyền (map PRD §14, đã chuẩn hoá)

| Hành động | admin | pm | account | cs | designer | management | client_owner | client_member |
|---|---|---|---|---|---|---|---|---|
| Tạo khách hàng | ✅ | — | ✅ | — | — | — | — | — |
| Tạo dự án | ✅ | ✅ | ✅ | — | — | — | — | — |
| Mời người dùng công ty | ✅ | ✅ | ✅ | ✅ | — | — | ✅ (giới hạn) | — |
| Xem tổng quan dự án | ✅ | ✅ | ✅ | ✅ | ✅ (được phân công) | ✅ | ✅ (công ty mình) | ✅ (được phân công) |
| Nộp file | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| Bình luận | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| **Duyệt** | ✅ | ✅ *(override có lý do)* | — | — | — | — | ✅ | — |
| Xem growth roadmap | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ |
| Gửi service request | ✅ | ✅ | ✅ | ✅ | — | — | ✅ | ✅ |
| Xem brand vault | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cấu hình template | ✅ | — | — | — | — | — | — | — |
| Xem báo cáo quản trị | ✅ | ✅ (dự án mình) | ✅ (khách mình) | ✅ (khách mình) | — | ✅ | — | — |
| Dùng AI | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI ghi dữ liệu (cần confirm) | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ (trong công ty mình) | — |

> Nguyên tắc PRD §14: `approve` thuộc về **Client Owner**. PM chỉ override được ở bước chuyển trạng thái dự án, và **bắt buộc nhập lý do** (AC-ONB-005).

### Phạm vi dữ liệu (scope) — 3 lớp
```
1. organization      : user.type=client → mọi truy vấn lọc theo session.activeOrganizationId
2. project membership: bảng project_member (staff được phân công · client được thêm vào dự án)
3. file / version    : kế thừa quyền từ project; feedback kế thừa từ version
```
**Không bao giờ** tin `organizationId` / `projectId` do client gửi lên. Luôn lấy từ session rồi mới query.

### Guard (một cửa duy nhất)
```ts
// src/server/auth/access.ts  — quyết định THUẦN (test được, không IO)
can(role, { project: ["create"] })        // đánh giá theo ma trận
mayAccessProject(ctx, shield, level)      // quyết định truy cập dự án

// src/server/auth/guard.ts   — IO + enforcement
requireSession()                                // → session hoặc redirect /sign-in
requireStaff()                                  // ném ForbiddenError nếu không phải nội bộ
requireClientOrg()                              // ném ForbiddenError nếu không phải khách hàng
requirePermission({ project: ["approve"] })     // theo ma trận
requireProjectAccess(projectId, "read"|"write"|"approve")
requireOrgScope(ctx, organizationId)            // chặn truy cập chéo công ty
```

**Cách resolve tổ chức của khách hàng:** ưu tiên `session.activeOrganizationId`; nếu chưa có
(đăng nhập thường, magic link, tài khoản được seed) thì lấy membership đầu tiên của chính
người dùng đó. Người dùng thuộc nhiều công ty chọn bằng `acceptInvitationAction` (đặt active
organization sau khi nhận lời mời) hoặc org switcher ở topbar (P7).

**Chuyển hướng theo vai trò (layout):** khách hàng vào `/inbox|/clients|/reports|/admin`
bị đá về `/today`; người chưa đăng nhập bị đá về `/sign-in`. Trong Server Action thì
`requireStaff()` **ném lỗi** (không redirect) để action trả về thông báo thay vì nhảy trang.

**Không có quyền ở tầng trang → hiện trang "không tìm thấy", không phải lỗi 500:** loader
cho trang dùng `checkProjectAccess` — trả `null` khi bị từ chối, page gọi `notFound()` để hiện
`not-found.tsx` ("…hoặc bạn không có quyền xem"). Ném `ForbiddenError` từ page chỉ đẩy người
dùng vào error boundary chung, mà vẫn lộ dự án nào đang tồn tại.
`assertProjectAccess` vẫn **ném** (403 kèm lý do) cho Server Action / Route Handler.

> ⚠️ **Lưu ý đã kiểm chứng trên dev server:** vì `(app)` có `loading.tsx` nên shell được stream
> trước khi page chạy `notFound()`. Hệ quả: **HTTP status vẫn là 200** dù nội dung là trang
> "không tìm thấy" (đã đo: designer truy cập dự án không được phân công → 200 + nội dung 404).
> Với portal có đăng nhập thì điều này chấp nhận được (không ảnh hưởng SEO/crawler). Nếu cần
> status 404 thật: chuyển kiểm tra quyền lên `projects/[projectId]/layout.tsx` và tắt streaming
> cho nhánh đó, hoặc gọi `notFound()` trong layout trước khi shell render.

**Luật cứng:**
1. Mọi Server Action và Route Handler **tự authorize** — Next 16 coi action là POST endpoint công khai.
2. Check ở client chỉ để ẩn/hiện UI; **không** phải enforcement.
3. Mọi truy vấn chạm dữ liệu khách hàng phải đi qua `requireOrgScope` (test isolation là test bắt buộc, xem `docs/06`).
4. `requireProjectAccess` là nơi duy nhất quyết định "thấy hay không thấy file/task/milestone" (AC-DEL-001).
5. Thao tác nhạy cảm (approve, override, release handover, đổi quyền) ghi `audit_log`: ai, làm gì, trên đối tượng nào, lúc nào, lý do.

---

## 5. Trạng thái rỗng theo vai trò (không được để màn hình trắng)

| Màn hình | Client mới | Staff chưa có gì |
|---|---|---|
| `/today` | `Chưa có việc cần làm. Xem lộ trình thương hiệu` | `Không có việc tồn. Xem báo cáo` |
| `/projects` | `Chưa có dự án. Liên hệ quản lý dự án` | `Chưa có dự án. Tạo dự án` |
| `/onboarding` | `Onboarding hoàn tất. Vào dự án` | `Không có onboarding đang mở` |
| `/growth` | `Lộ trình đang được chuẩn bị` | `Chưa có đề xuất nào` |
| `/brand-vault` | `Tài sản sẽ xuất hiện sau bàn giao` | `Khách này chưa có tài sản` |
| `/notifications` | `Không có thông báo mới` | `Không có hoạt động mới` |
