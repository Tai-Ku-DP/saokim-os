# 09 — Kịch bản backtest từ đầu

> Mục đích: bạn tự chạy lại **toàn bộ hệ thống** từ trạng thái trắng và tự kết luận đúng/sai.
> Mọi bước đều ghi **chính xác cái sẽ thấy** (chuỗi thông báo, con số, trạng thái) — lấy nguyên
> văn từ code, không phải diễn giải.
>
> Cách dùng: tick `[x]` khi đạt. Bước nào sai → dừng, xem **§8 Xử lý sự cố** rồi chạy lại từ mốc
> gần nhất. Toàn bộ kịch bản mất khoảng **45–60 phút**.

```
PHẦN A  Chuẩn bị môi trường            (~5 phút, làm 1 lần)
PHẦN B  Cổng tự động (6 lệnh)          (~5 phút)
PHẦN C  Kịch bản tay theo vai trò      (~30 phút, 7 kịch bản)
PHẦN D  Kiểm tra âm (phải bị chặn)     (~5 phút)
PHẦN E  Kiểm tra dữ liệu ở DB          (~5 phút)
PHẦN F  Bảng ghi kết quả
```

---

# PHẦN A — Chuẩn bị môi trường

### A1. Kiểm tra công cụ
```bash
node -v      # cần >= 22   (máy đã test: v26.9.0)
npm -v       # máy đã test: 11.19.1
```

- [ ] Node ≥ 22

### A2. Kiểm tra dung lượng đĩa (bài học thật: đã từng hết đĩa giữa chừng)
```bash
diskutil info / | grep -i "Container Free Space"
```
- [ ] Còn **≥ 1.5 GB** trước khi cài. Nếu ít hơn: xoá `node_modules` của project không dùng,
      hoặc `rm -rf .next`.

### A3. Cài dependencies
```bash
npm install
```
- [ ] Cài xong, **không có lỗi** `ENOSPC`
- [ ] Nếu npm kêu không ghi được cache: chạy lại bằng
      `npm_config_cache=/tmp/npm-cache npm install` rồi `rm -rf /tmp/npm-cache`

### A4. Tạo file môi trường
```bash
cp .env.example .env.local
```
Mở `.env.local` và điền:
```dotenv
BETTER_AUTH_SECRET=<chạy: openssl rand -base64 32>
DEEPSEEK_API_KEY=<key của bạn>        # không có cũng được, app chạy chế độ demo
DEEPSEEK_MODEL=deepseek-flash
AI_DRIVER=deepseek                     # bỏ trống cũng tự nhận đúng
```
- [ ] File `.env.local` tồn tại
- [ ] Kiểm tra **không bị git theo dõi**: `git check-ignore -v .env.local` → phải in ra `.gitignore:36:.env*`

### A5. Tạo database + dữ liệu demo
```bash
npm run db:migrate
npm run db:seed
```
Kỳ vọng ở cuối lệnh seed:
```
• 7 người dùng
✓ Seed hoàn tất
  Khách hàng : An Phát Land (2 dự án)
  Tài khoản  : admin@saokim.vn · minhanh@saokim.vn · tung.vu@anphatland.vn
  Mật khẩu   : BrandCare@2026
```
- [ ] Seed báo hoàn tất, **7 người dùng**

### A6. Chạy dev server
```bash
npm run dev
```
- [ ] Terminal in ra `Local: http://localhost:3000` (nếu cổng 3000 bận, Next tự chọn cổng khác —
      **ghi lại đúng URL đang chạy**, các bước sau dùng URL đó)
- [ ] Mở URL đó → thấy trang đăng nhập có tiêu đề **"Sao Kim BrandCare OS"**

> ### 🔖 MỐC CHUẨN — ghi lại để đối chiếu về sau
> Ngay sau khi seed (chưa đăng nhập), chạy `npm run pg:dry-run`. Kết quả phải là:
>
> ```
> organization=1 · user=7 · company_profile=1 · member=2 · account=7 · service_package=5
> project=2 · project_member=8 · onboarding_checklist=1 · checklist_item=5 · brand_brief=1
> file_asset=4 · file_version=6 · document_request=2 · milestone=9 · task=6 · feedback=5
> approval=1 · brand_asset=4 · brand_guideline=1 · brand_scan_result=1 · brand_health_snapshot=1
> growth_recommendation=2 · service_request=1 · opportunity=1 · notification=3
> notification_outbox=1 · interaction_event=42 · audit_log=1
> ──────────────────────────────────
> Tổng                      131
> ```
> - [ ] **Tổng = 131** (29 bảng có dữ liệu)
>
> **Các bảng sẽ TĂNG khi bạn test** (đừng hoảng khi thấy lệch):
> `session` (mỗi lần đăng nhập), `audit_log`, `notification_outbox`, `notification`,
> `ai_run`, `feedback`, `file_version`, `file_asset`, `handover_package`, `handover_item`.

---

# PHẦN B — Cổng tự động (chạy hết, không cần bấm tay)

| # | Lệnh | Kết quả phải đạt | ✓ |
|---|---|---|---|
| B1 | `npm run typecheck` | Kết thúc bằng `✓ Types generated successfully`, **0 dòng `error TS`** | [ ] |
| B2 | `npm run lint` | Không in ra dòng `error`/`warning` nào | [ ] |
| B3 | `npm test` | `Test Files 12 passed (12)` · `Tests 115 passed (115)` | [ ] |
| B4 | `npm run build` | `✓ Compiled successfully` · danh sách route có **23 dòng** | [ ] |
| B5 | `npm run pg:dry-run` | In bảng số dòng + `Tổng` (đối chiếu mốc A6) | [ ] |
| B6 | `npm run outbox` | `Outbox: xử lý 1, gửi 1, lỗi 0` (lần đầu) — lần hai phải là `xử lý 0` | [ ] |

**B3 — chi tiết 12 file test (nếu lệch số, ghi lại tên file lệch):**
```
format · nav · permissions · ai                       (unit)
files · onboarding · growth · outbox · isolation · ai-tools · project-access · reset-order
```

> `npm run build` sẽ tạo `.next` (~250 MB). Chạy xong nên `rm -rf .next` nếu ổ đĩa chật —
> nhưng khi đó **phải chạy lại `npm run dev`**.

---

# PHẦN C — Kịch bản tay theo vai trò

Tài khoản dùng chung mật khẩu **`BrandCare@2026`**:

| Email | Vai trò | Trang đầu khi đăng nhập |
|---|---|---|
| `tung.vu@anphatland.vn` | Client Owner (khách) | `/today` |
| `vy.ngo@anphatland.vn` | Client Member (khách) | `/today` |
| `minhanh@saokim.vn` | PM (Sao Kim) | `/inbox` |
| `hoangnam@saokim.vn` | Designer | `/inbox` |
| `thuha@saokim.vn` | Account | `/inbox` |
| `gialinh@saokim.vn` | CS | `/inbox` |
| `admin@saokim.vn` | Admin | `/inbox` |

> **Mẹo:** dùng cửa sổ ẩn danh cho mỗi vai trò, hoặc đăng xuất giữa các vai trò (menu góc phải →
> **Đăng xuất**). Nếu không đăng xuất, phiên cũ sẽ được giữ và bạn sẽ tưởng phân quyền sai.

---

## C1 — Đăng nhập & phân quyền (5 phút)

| # | Làm gì | Phải thấy | ✓ |
|---|---|---|---|
| C1.1 | Mở `/today` **khi chưa đăng nhập** | Tự chuyển sang `/sign-in` | [ ] |
| C1.2 | Đăng nhập `tung.vu@anphatland.vn` | Vào `/today`; menu trái: **Hôm nay · Dự án · Onboarding · Brand Home · Thông báo · Cài đặt** | [ ] |
| C1.3 | Nhìn sidebar | Góc trên ghi **An Phát Land** (tên công ty khách) | [ ] |
| C1.4 | Vào `/inbox` (khu nội bộ) | **Bị đá về `/today`** | [ ] |
| C1.5 | Đăng nhập `minhanh@saokim.vn` | Vào `/inbox`; menu có thêm **Khách hàng · Báo cáo · Quản trị** | [ ] |
| C1.6 | Đăng nhập `vy.ngo@anphatland.vn` | Vào `/today`; **không** thấy Khách hàng / Báo cáo / Quản trị | [ ] |
| C1.7 | Đăng nhập `hoangnam@saokim.vn`, mở `/projects/seed_project_website/overview` | Hiện trang **"Không tìm thấy trang"** (designer không được phân công dự án Website) | [ ] |
| C1.8 | Cùng designer, mở `/projects/seed_project_identity/overview` | **Xem được** (được phân công dự án Nhận diện) | [ ] |

> C1.7 là hành vi đã kiểm chứng: nội dung là trang 404, nhưng **HTTP status vẫn 200** do Next
> streaming (shell gửi trước khi page gọi `notFound()`). Đây là điểm đã ghi trong `docs/03`.
> Muốn xem status thật: `curl -o /dev/null -w "%{http_code}"`.

---

## C2 — Onboarding (7 phút)
Vai trò: **Client Member** (`vy.ngo@anphatland.vn`) → **PM** (`minhanh@saokim.vn`)

| # | Ai | Làm gì | Phải thấy | ✓ |
|---|---|---|---|---|
| C2.1 | Vy | Mở `/onboarding` | Thấy dự án **Website An Phát Land**, tiến độ **60%** | [ ] |
| C2.2 | Vy | Đếm 5 mục | `Hồ sơ doanh nghiệp` ✅ · `Tài sản thương hiệu hiện có` ✅ · `Nội dung giới thiệu dự án` **Cần làm** · `Thông tin hosting & domain` **Đã nộp** · `Xác nhận lịch kickoff` ✅ | [ ] |
| C2.3 | Vy | **Bấm vào tên mục** "Nội dung giới thiệu dự án" để mở ra | Mục mở rộng (collapse) thành: ô **Nội dung trả lời**, nút **Nộp**, khu **Tập tin** + nút **Đính kèm** | [ ] |
| C2.4 | Vy | Gõ nội dung vào ô "Nội dung trả lời" (vd: *"Đã tổng hợp theo brief"*) | — | [ ] |
| C2.5 | Vy | Bấm **"Chọn tệp để đính kèm"** → chọn **1 tệp .pdf** | Toast **"Đã đính kèm <tên-tệp>"** — **tải lên ngay khi chọn**, không cần bấm thêm bước nào | [ ] |
| C2.5b | Vy | Bấm lại **"Chọn tệp để đính kèm"** → chọn **1 tệp ảnh** | Toast **"Đã đính kèm <tên-tệp>"**; giờ có **2 card** và dòng **Tập tin (2)**; icon đổi màu theo loại (PDF đỏ, ảnh xanh) | [ ] |
| C2.5c | Vy | **Tải lại trang (F5)** | **2 card tệp vẫn còn** — đây là điểm từng bị hiểu nhầm là mất tệp | [ ] |
| C2.6 | Vy | Bấm **Tải** ở một card | Tệp tải về đúng nội dung | [ ] |
| C2.7 | Vy | Bấm **Gỡ** ở một card | Toast **"Đã gỡ tệp khỏi mục"**; card biến mất, **Tập tin (1)**. Vào tab **Tệp** của dự án: tệp đó **vẫn còn** (xoá mềm) | [ ] |
| C2.8 | Vy | Bấm **Nộp** | Toast **"Đã nộp mục này"**; mục → **Đã nộp**, trên dòng tóm tắt hiện **có nội dung** + **1 tệp**; tiến độ **vẫn 60%** (nộp ≠ được duyệt) | [ ] |
| C2.9 | Vy | Mở lại **Brand brief**, sửa 1 ô rồi bấm **Lưu nháp** | Toast **"Đã lưu nháp"** | [ ] |
| C2.10 | Vy | Ở khối **Tài liệu cần cung cấp**, xem 2 dòng | Nhãn đúng: `Nội dung giới thiệu dự án` → **Cần nộp** · `Thông tin hosting & domain` → **Đã nhận** (mục này có sẵn 1 tệp) | [ ] |
| C2.11 | Vy | Mở dòng **Đã nhận** ra | Thấy **Tập tin (1)** với card *Wireframe trang chủ* + nút Tải | [ ] |
| C2.12 | Vy→PM | Đăng xuất, đăng nhập `minhanh@saokim.vn`, mở `/onboarding`, mở mục ra | Thấy nội dung khách nhập + các card tệp + nút **Đạt** / **Yêu cầu bổ sung** (khách không có 2 nút này) | [ ] |
| C2.13 | PM | Gõ lý do vào ô "Cần bổ sung gì?" rồi bấm **Yêu cầu bổ sung** | Toast **"Đã yêu cầu bổ sung"**; mục → **Cần bổ sung**, có dòng `PM yêu cầu: …` | [ ] |
| C2.14 | PM | Bấm **Đạt** ở mục đó | Toast **"Đã duyệt mục"**; tiến độ **80%**; mục hiện **"Mục đã được duyệt và khoá."** và **không còn** nút Đính kèm/Gỡ | [ ] |
| C2.15 | PM | Bấm **Hoàn tất onboarding** (KHÔNG tick override) | Toast lỗi **"Còn 1 mục bắt buộc chưa đạt"** (mục hosting còn ở "Đã nộp") | [ ] |
| C2.16 | PM | Gõ lý do vào ô "Lý do bỏ qua" rồi bấm **Hoàn tất onboarding** | Toast **"Onboarding đã hoàn tất"**; checklist → **Hoàn tất** | [ ] |

> **C2.3 kiểm tra điều quan trọng:** nộp ≠ đạt. Tiến độ chỉ tính mục **đã được PM duyệt**.
> **C2.8 kiểm tra cổng kickoff:** không được bỏ qua mục bắt buộc mà không có lý do.

---

## C3 — Delivery: vòng đời một phiên bản (12 phút) — phần cốt lõi
Vai trò: **Designer** → **Client Owner** → **PM**

| # | Ai | Làm gì | Phải thấy | ✓ |
|---|---|---|---|---|
| C3.1 | Tùng | Vào `/projects/seed_project_identity/overview` | **4 hạng mục**: Khám phá & chiến lược ✅ · Concept logo ✅ · Hệ thống nhận diện (đang làm) · Brand guideline (chưa bắt đầu). Tiến độ **65%** | [ ] |
| C3.2 | Tùng | Sang tab **Tệp** | 3 tệp; tệp **Logo An Phát Land** có `v3` **Chờ duyệt**, `v2` và `v1` **Yêu cầu sửa** | [ ] |
| C3.3 | Tùng | Tìm tệp "Brand brief đã duyệt" (v1) | Trạng thái **Đã duyệt**, có dòng `Đã duyệt bởi …` | [ ] |
| C3.4 | Tùng | Ở phiên bản đã duyệt đó | **Không có ô góp ý**; thay vào đó là dòng *"Phiên bản đã duyệt nên đã khoá. Tạo phiên bản mới để trao đổi tiếp."* | [ ] |
| C3.5 | Tùng | Sang tab **Duyệt** | **1 mục chờ duyệt**: "Logo An Phát Land v3", có nút **Duyệt** và **Yêu cầu sửa** | [ ] |
| C3.6 | Tùng | Bấm **Yêu cầu sửa**, gõ "Sửa khoảng cách an toàn" | Toast **"Đã gửi yêu cầu chỉnh sửa"**; mục chuyển sang khối **Đã xử lý** | [ ] |
| C3.7 | Nam (designer) | Đăng nhập `hoangnam@saokim.vn`, mở tab **Tệp** của dự án | Có nút **Tải lên** + ô **Ghi chú**; **không** có nút Duyệt | [ ] |
| C3.8 | Nam | Chọn 1 file bất kỳ (ảnh/pdf nhỏ), ghi chú "Bản sửa khoảng cách", bấm **Tải lên** | Toast **"Đã tải lên phiên bản 4"**; danh sách xuất hiện **v4** trạng thái **Chờ duyệt** | [ ] |
| C3.9 | Nam | Ở v4, gõ góp ý rồi bấm **Gửi góp ý** | Toast **"Đã gửi phản hồi"** | [ ] |
| C3.10 | Minh Anh (PM) | Đăng nhập, mở tab **Duyệt** của dự án | Có nút **Duyệt**/**Yêu cầu sửa** (PM duyệt được, nhưng nếu duyệt thay khách thì **phải ghi lý do**) | [ ] |
| C3.11 | PM | Bấm **Duyệt** ở một yêu cầu, **để trống lý do** | Toast lỗi **"Duyệt thay khách phải ghi lý do"** | [ ] |
| C3.12 | PM | Gõ lý do "Khách xác nhận qua điện thoại" rồi bấm **Duyệt** | Toast **"Đã duyệt. Phiên bản được khoá"** | [ ] |
| C3.13 | Tùng | Đăng nhập lại, mở tab **Tệp** | Phiên bản vừa duyệt có dòng `Đã duyệt bởi …` + **không còn ô góp ý** | [ ] |
| C3.14 | *(kiểm tra DB)* | `npm run pg:dry-run` | `file_version` phải là **7** (6 + 1 phiên bản bạn vừa tải) | [ ] |

> **C3.4 + C3.13 là bất biến quan trọng nhất của sản phẩm:** phiên bản đã duyệt là **bất biến**.
> Không sửa được, không góp ý thêm — chỉ có một đường là **tạo phiên bản mới**.
> Việc chặn được enforce ở **server** (test tự động: `tests/integration/files.test.ts`), không chỉ
> ẩn nút trên UI.

---

## C4 — Bàn giao (3 phút) ⚠️ *bước này đổi trạng thái demo, nên làm sau cùng*
Vai trò: **PM** (`minhanh@saokim.vn`)

| # | Làm gì | Phải thấy | ✓ |
|---|---|---|---|
| C4.1 | Mở tab **Bàn giao** của dự án Nhận diện | Danh sách tệp **trống** + nút **Tập hợp bộ bàn giao** và **Phát hành bàn giao** | [ ] |
| C4.2 | Bấm **Phát hành bàn giao** | Toast lỗi **"Chưa có bộ bàn giao để phát hành"** | [ ] |
| C4.3 | Bấm **Tập hợp bộ bàn giao** | Toast **"Đã tập hợp bộ bàn giao"**; xuất hiện các mục từ **phiên bản đã duyệt** (brand brief v1 + các bản bạn vừa duyệt) | [ ] |
| C4.4 | Bấm **Phát hành bàn giao** | Toast **"Đã phát hành bàn giao"**; dự án chuyển **Hoàn tất** | [ ] |
| C4.5 | Bấm **Phát hành bàn giao** lần nữa | Không còn nút (đã phát hành thì khoá) | [ ] |

---

## C5 — AI-native (6 phút)
Vai trò: **Client Owner** (nên thử ở đây vì Today có việc)

| # | Làm gì | Phải thấy | ✓ |
|---|---|---|---|
| C5.1 | Bấm icon **✨** trên thanh trên cùng | Panel **"Trợ lý"** mở bên phải, có 4 gợi ý bấm nhanh | [ ] |
| C5.2 | Nếu bạn **có** DEEPSEEK_API_KEY | Panel **không** có nhãn `demo` | [ ] |
| C5.3 | Nếu bạn **không** có key | Panel có nhãn **`demo`** và AI trả lời kèm dòng "(chế độ demo — chưa cấu hình DEEPSEEK_API_KEY)" | [ ] |
| C5.4 | Bấm gợi ý **"Hôm nay làm gì?"** | AI trả lời **1–3 câu tiếng Việt** + hiện **thẻ danh sách việc** bấm được (không phải đoạn văn dài) | [ ] |
| C5.5 | Bấm gợi ý **"Rủi ro cần chú ý"** | Thẻ danh sách rủi ro (khách im lặng / duyệt treo / việc quá hạn) | [ ] |
| C5.6 | Hỏi tự do: *"Tình trạng các dự án?"* | AI gọi tool và trả **thẻ dự án** có % tiến độ thật | [ ] |
| C5.7 | Bấm `⌘K` → gõ "trợ lý" → Enter | Panel AI mở (đường thứ hai để vào) | [ ] |
| C5.8 | Gõ vào ô chat rồi `⌘↵` | Gửi được (Enter thường xuống dòng, không gửi) | [ ] |

**Kiểm tra AI KHÔNG tự ghi dữ liệu:**
| # | Làm gì | Phải thấy | ✓ |
|---|---|---|---|
| C5.9 | Hỏi: *"Tạo yêu cầu dịch vụ guideline cho khách"* | **Chỉ khi có DEEPSEEK_API_KEY:** AI đề xuất → hiện thẻ nhãn **"Đề xuất · cần bạn xác nhận"** + nút **Tạo yêu cầu**. **Ở chế độ demo:** chỉ trả lời bằng chữ, **không** có thẻ (bộ chọn demo chỉ trỏ tới tool đọc) | [ ] |
| C5.10 | **Không bấm gì**, đóng panel, vào `/growth` xem "Yêu cầu đã gửi" | **Chưa có gì mới** — chứng minh AI không tự ghi | [ ] |
| C5.11 | *(chỉ khi có key)* Mở lại panel, bấm nút xác nhận ở thẻ đề xuất | Toast **"Đã tạo yêu cầu dịch vụ"**; `/growth` xuất hiện yêu cầu mới | [ ] |

> **C5.10 là bước quan trọng nhất của phần này.** Đây là bằng chứng AI không có quyền ghi dữ liệu.
> Đường "AI đề xuất → bạn xác nhận → mới ghi" chỉ quan sát được bằng **model thật**; phần chặn
> quyền của đường này được kiểm tra tự động ở `tests/integration/ai-tools.test.ts` và
> `tests/unit/ai.test.ts` (chạy ở B3).

---

## C6 — Thông báo & outbox (4 phút)

| # | Làm gì | Phải thấy | ✓ |
|---|---|---|---|
| C6.1 | Đăng nhập `tung.vu@anphatland.vn`, nhìn chuông thông báo trên topbar | Có **badge số** (chưa đọc) | [ ] |
| C6.2 | Mở `/notifications` | 3 thông báo, gồm *"Logo v03 chờ duyệt"*; thông báo chưa đọc có nền xanh nhạt | [ ] |
| C6.3 | Bấm **Đã đọc** ở một thông báo | Nền mất màu, badge giảm 1 | [ ] |
| C6.4 | Bấm **Đánh dấu đã đọc** (góc phải) | Tất cả về trạng thái đã đọc | [ ] |
| C6.5 | Chạy terminal: `npm run outbox` | In các dòng `sent`/`fail` + dòng tổng kết. Lần đầu sau seed phải `xử lý 1` | [ ] |
| C6.6 | Chạy `npm run outbox` lần hai | **`Outbox: xử lý 0, gửi 0, lỗi 0`** — chứng minh không gửi trùng | [ ] |
| C6.7 | Kiểm tra DB: `node -e "const D=require('better-sqlite3');const db=new D('./data/app.db');console.log(db.prepare('select status,attempts,last_error from notification_outbox').all())"` | Mọi dòng `status='sent'`, `attempts=1`, `last_error=null` | [ ] |

---

## C7 — Growth & Retaining (6 phút)
Vai trò: **Account** (`thuha@saokim.vn`) và **Client Owner**

| # | Ai | Làm gì | Phải thấy | ✓ |
|---|---|---|---|---|
| C7.1 | Tùng | Mở `/brand-vault` (Brand Home) | 4 tài sản: **Xanh An Phát** `#0F3D6E`, **Cam đất** `#D97A2B`, **Bộ chữ tiêu đề** (Be Vietnam Pro), Logo | [ ] |
| C7.2 | Tùng | Cuộn xuống | **Brand guideline An Phát Land** với 3 phần (logo, màu, typography) | [ ] |
| C7.3 | Tùng | Xem khối **Sức khỏe thương hiệu** | Điểm **62** + 3 thanh breakdown (Đồng nhất 55 · Độ phủ 70 · Quản trị 50) | [ ] |
| C7.4 | Tùng | Xem khối **Chẩn đoán gần nhất** | 3 phát hiện, gồm *"Chưa có guideline cho đối tác"* | [ ] |
| C7.5 | Tùng | Mở `/growth` | Lộ trình **3 giai đoạn**: Nền tảng thương hiệu · Hệ thống & ứng dụng · Tăng trưởng & truyền thông | [ ] |
| C7.6 | Tùng | Xem khối **Dịch vụ đề xuất** | **Brand guideline** và **Website care** | [ ] |
| C7.7 | Tùng | Gửi yêu cầu mới: tiêu đề *"Cần thiết kế standee"*, chọn nhóm dịch vụ, bấm **Gửi yêu cầu** | Toast **"Đã gửi yêu cầu. Sao Kim sẽ liên hệ"** | [ ] |
| C7.8 | Thu Hà | Đăng nhập `thuha@saokim.vn`, mở `/growth` | Thấy nút **Cập nhật đề xuất** (khách không có) | [ ] |
| C7.9 | Thu Hà | Bấm **Cập nhật đề xuất** | Toast **"Không có đề xuất mới"** (chưa có dự án nào hoàn tất) | [ ] |
| C7.10 | Thu Hà | Mở `/clients` → bấm **An Phát Land** | Hồ sơ 360°: 2 dự án, **lịch sử tương tác**, **cơ hội 60.0 tr ₫** | [ ] |
| C7.11 | Thu Hà | Mở `/reports` | Các ô số liệu + tỷ lệ Onboarding; **không** thấy khối doanh thu (Account không có quyền `read_all`) | [ ] |
| C7.12 | Bảo (admin) | Đăng nhập `admin@saokim.vn`, mở `/reports` | **Có** khối doanh thu/pipeline | [ ] |
| C7.13 | *(sau khi đã làm C4)* | Thu Hà bấm **Cập nhật đề xuất** lần nữa | Toast **"Đã tạo 1 đề xuất"** — dự án đã hoàn tất nên rule engine sinh gợi ý mới | [ ] |

---

# PHẦN D — Kiểm tra âm (những việc **PHẢI** bị chặn)

| # | Thử làm | Kết quả đúng | ✓ |
|---|---|---|---|
| D1 | Client Member (`vy.ngo`) mở `/reports`, `/clients`, `/admin`, `/inbox` | Bị đá về `/today` | [ ] |
| D2 | Client Member mở tab **Duyệt** | Thấy dòng **"Chỉ chủ doanh nghiệp được duyệt."**, **không** có nút Duyệt | [ ] |
| D3 | Designer mở dự án không được phân công (C1.7) | Trang **"Không tìm thấy trang"** | [ ] |
| D4 | Chưa đăng nhập, mở `/api/versions/seed_ver_1/download` | `401` | [ ] |
| D5 | Đăng nhập khách, mở `/api/versions/seed_ver_1/download` | `410` — seed chỉ có metadata, chưa có tệp thật trong storage. **(Phiên bản bạn tự upload ở C3.8 thì tải được `200`)** | [ ] |
| D6 | Upload file **> 25 MB** | Toast **"Tệp vượt 25MB. Nén lại hoặc gửi link"** | [ ] |
| D7 | PM bấm **Hoàn tất onboarding** khi còn mục bắt buộc, không override | Toast **"Còn 1 mục bắt buộc chưa đạt"** | [ ] |
| D8 | PM tick override nhưng **để trống lý do** | Toast **"Bỏ qua mục bắt buộc phải ghi lý do"** | [ ] |
| D9 | PM bấm **Duyệt** thay khách mà không ghi lý do (C3.11) | Toast **"Duyệt thay khách phải ghi lý do"** | [ ] |
| D10 | PM **Phát hành bàn giao** khi chưa tập hợp (C4.2) | Toast **"Chưa có bộ bàn giao để phát hành"** | [ ] |
| D11 | Gửi brand brief **không có tên thương hiệu** | Toast **"Cần tên thương hiệu"** | [ ] |
| D12 | Mở `/khong-ton-tai` | Trang **"Không tìm thấy trang"** | [ ] |

> **D2, D9, D10 và bất biến "phiên bản đã duyệt" (C3.4/C3.13)** được kiểm tra **tự động** ở
> PHẦN B (`tests/integration/*`). Nếu PART B xanh nhưng phần tay thấy khác → có gì đó đã đổi
> trong code sau khi test chạy, hãy chạy lại B3.

---

# PHẦN E — Kiểm tra dữ liệu ở DB (đối chiếu bằng số)

Chạy từ thư mục dự án:

**E1 — Phiên bản tăng liên tục, không ghi đè**
```bash
node -e "const D=require('better-sqlite3');const db=new D('./data/app.db');
console.log(db.prepare('select version_number,status from file_version where file_id=? order by version_number').all('seed_file_logo'))"
```
- [ ] Kỳ vọng: `v1 changes_requested`, `v2 changes_requested`, `v3 in_review` (và **v4** nếu bạn làm C3.8)

**E2 — Không có phiên bản nào bị sửa đè** (mọi `file_id` phải có số phiên bản liên tục từ 1)
```bash
node -e "const D=require('better-sqlite3');const db=new D('./data/app.db');
for(const r of db.prepare('select file_id, group_concat(version_number) v from file_version group by file_id').all()) console.log(r.file_id, '→', r.v)"
```
- [ ] Kỳ vọng: dãy `1,2,3` (và `,4`), không nhảy số, không trùng

**E3 — Mọi hành động nhạy cảm đều có vết audit**
```bash
node -e "const D=require('better-sqlite3');const db=new D('./data/app.db');
for(const r of db.prepare('select action, count(*) c from audit_log group by action order by action').all()) console.log(r.action, r.c)"
```
- [ ] Kỳ vọng thấy các action bạn vừa làm, ví dụ: `approval.approved`, `approval.requested`, `file.version_added`, `onboarding.completed`, `handover.released`

**E4 — Không rò dữ liệu chéo công ty** (mọi dự án phải thuộc đúng 1 tổ chức)
```bash
node -e "const D=require('better-sqlite3');const db=new D('./data/app.db');
console.log(db.prepare('select organization_id, count(*) c from project group by organization_id').all())"
```
- [ ] Kỳ vọng: chỉ `seed_org_anphat` với `c=2`

**E5 — Outbox không còn bản ghi kẹt**
```bash
node -e "const D=require('better-sqlite3');const db=new D('./data/app.db');
console.log(db.prepare(\"select status, count(*) c from notification_outbox group by status\").all())"
```
- [ ] Sau khi chạy `npm run outbox`: chỉ có `sent` (không còn `pending`)

**E6 — Log AI ghi đủ metadata, không lưu nội dung**
```bash
node -e "const D=require('better-sqlite3');const db=new D('./data/app.db');
console.log(db.prepare('select feature,provider,model,status,input_tokens,output_tokens,cost_usd_micros from ai_run order by created_at desc limit 5').all())"
```
- [ ] Nếu bạn đã gọi AI: có dòng `provider=deepseek` với token > 0, và **không có cột nào chứa prompt/response**

**E7 — Sau khi làm hết, đối chiếu tổng thể**
```bash
npm run pg:dry-run
```
- [ ] So với mốc A6: các bảng sau **phải tăng** đúng như bạn đã làm:
      `file_version` (+1 mỗi lần upload), `file_asset` (nếu tạo tệp mới), `feedback` (+1 mỗi góp ý),
      `audit_log`, `notification_outbox`, `session`, `handover_*`, `ai_run`

---

# PHẦN F — Bảng ghi kết quả

| Phần | Nội dung | Số bước | Đạt | Ghi chú |
|---|---|---|---|---|
| A | Chuẩn bị môi trường | 6 | ___/6 | |
| B | Cổng tự động | 6 | ___/6 | |
| C1 | Đăng nhập & phân quyền | 8 | ___/8 | |
| C2 | Onboarding | 18 | ___/18 | |
| C3 | Delivery vòng đời phiên bản | 14 | ___/14 | |
| C4 | Bàn giao | 5 | ___/5 | |
| C5 | AI-native | 11 | ___/11 | |
| C6 | Thông báo & outbox | 7 | ___/7 | |
| C7 | Growth & Retaining | 13 | ___/13 | |
| D | Kiểm tra âm | 12 | ___/12 | |
| E | Kiểm tra dữ liệu | 7 | ___/7 | |
| | **TỔNG** | **107** | **___/107** | |

**Ghi lại khi có lỗi:**
```
Bước:            (vd C3.8)
Đã làm:          (thao tác chính xác)
Mong đợi:        (chuỗi/số trong tài liệu)
Thực tế:         (chụp màn hình / copy thông báo)
Lệnh đã chạy:    (nếu có)
```

---

# PHẦN G — Xử lý sự cố & reset

### Reset về trạng thái gốc bất cứ lúc nào
```bash
rm -rf .data/uploads            # (tuỳ chọn) xoá tệp bạn đã upload khi test
```
```bash
npm run db:seed -- --reset      # xoá dữ liệu demo, tạo lại từ đầu
npm run pg:dry-run              # phải quay về Tổng = 131 (mốc A6)
```
> Cách này xoá **mọi thứ bạn đã tạo khi test** (phiên bản, góp ý, bàn giao, phiên đăng nhập).
> Dùng khi muốn backtest lại từ đầu.

### Sự cố thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `ENOSPC: no space left on device` | Hết đĩa (đã từng xảy ra khi build) | `rm -rf .next` và/hoặc `rm -rf /tmp/npm-cache`; kiểm tra lại bằng `diskutil info /` |
| Cổng 3000 bận | process khác đang giữ | Next tự chọn cổng khác và in ra — dùng URL đó |
| Trang trắng / style vỡ sau khi build | `.next` cũ hoặc dev server đang chạy khi build | `rm -rf .next` rồi `npm run dev` lại |
| Đăng nhập xong vẫn thấy như chưa đăng nhập | phiên cũ trong trình duyệt | Đăng xuất (menu góc phải) hoặc dùng cửa sổ ẩn danh |
| AI báo lỗi đỏ trong panel | key sai/hết hạn/mất mạng | Sửa `DEEPSEEK_API_KEY` trong `.env.local` rồi **khởi động lại dev**; hoặc tạm đặt `AI_DRIVER=mock` để backtest phần còn lại |
| AI luôn có nhãn `demo` dù đã có key | `.env.local` chưa được nạp | Dev server phải **khởi động lại** sau khi sửa `.env.local` |
| AI trả lời *"Đã đạt hạn mức AI hôm nay…"* | Đã vượt 5 USD/ngày (hoặc bạn test cap) | Tăng `AI_DAILY_COST_CAP_USD`, hoặc xoá log: `node -e "const D=require('better-sqlite3');new D('./data/app.db').prepare('delete from ai_run').run()"` |
| `npm run db:seed -- --reset` báo `FOREIGN KEY constraint failed` | thứ tự xoá trong `src/db/reset-order.ts` sai (bảng con phải đứng trước bảng cha) | Sửa thứ tự; test `tests/integration/reset-order.test.ts` sẽ bắt lỗi này trước cả khi bạn reset |
| `npm test` fail sau khi bạn sửa code | code lệch khỏi hành vi đã chốt | Đọc tên test fail — mỗi test ghi rõ mã AC/NFR tương ứng |
| Muốn chạy lại chỉ phần test tự động | — | `npm test` · một file: `npx vitest run tests/integration/files.test.ts` |

### Thứ tự khuyến nghị nếu muốn nhanh (30 phút)
```
A1→A6  (chuẩn bị)  →  B1→B4  (cổng tự động)  →  C2 (onboarding)  →  C3 (delivery)
→  C5 (AI)  →  D (kiểm tra âm)  →  E1,E3,E5 (dữ liệu)
```
Bỏ qua C4 (bàn giao) và C7.13 nếu bạn muốn giữ nguyên trạng thái demo để thử lại nhiều lần.
