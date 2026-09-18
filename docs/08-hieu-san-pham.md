# 08 — Hiểu sản phẩm này trong 10 phút

> Tài liệu này viết cho **người dùng sản phẩm**, không phải cho lập trình viên.
> `docs/07` nói code chạy thế nào; tài liệu này nói **app này để làm gì, ai dùng, và họ thấy gì**.
> Mọi ví dụ dưới đây lấy **đúng dữ liệu demo** trong app — bạn mở lên sẽ thấy y hệt.

---

## 1. App này giải quyết nỗi đau gì?

### Trước khi có app (cách làm cũ của một agency)
```
Khách ký hợp đồng làm thương hiệu
   → PM gửi file qua Zalo/email
   → khách quên không phản hồi, dự án trễ mà không ai biết vì sao
   → designer bị góp ý rải rác ở 5 nơi, không biết đang sửa bản nào
   → làm xong, bàn giao file… rồi hết chuyện
   → 6 tháng sau khách muốn in name card, không biết lấy logo bản chuẩn ở đâu
   → muốn bán thêm dịch vụ? phải trông vào trí nhớ của account
```
Hệ quả: khách không thấy mình đang ở đâu, Sao Kim không chứng minh được giá trị dài hạn, và
doanh thu chỉ đến từ khách mới.

### Sau khi có BrandCare OS
Đây không phải "app quản lý công việc". Đây là **nơi khách hàng luôn biết mình cần làm gì tiếp theo**,
và **nơi Sao Kim chứng minh giá trị sau khi dự án kết thúc**.

Bốn cảm nhận mà sản phẩm phải tạo ra cho khách (lấy từ PRD):

| # | Khách phải cảm thấy | App làm điều đó bằng |
|---|---|---|
| 1 | "Tôi biết mình cần làm gì khi bắt đầu hợp tác" | **Onboarding** — checklist rõ ràng, biết còn thiếu gì |
| 2 | "Tôi luôn nhìn thấy dự án đang ở đâu" | **Hôm nay** + **Workroom** — tiến độ, phiên bản, ai đang chờ ai |
| 3 | "Tôi hiểu thương hiệu của mình nên phát triển tiếp thế nào" | **Lộ trình phát triển** — gợi ý bước tiếp theo |
| 4 | "Tôi có một nơi để quản trị tài sản thương hiệu lâu dài" | **Brand Home** — kho tài sản, guideline, sức khỏe thương hiệu |

**Một câu tóm tắt:** nếu Linear là công cụ cho đội làm phần mềm, thì BrandCare OS là công cụ
cùng loại nhưng dành cho **agency làm thương hiệu** — và điểm khác biệt lớn nhất là nó
**sống tiếp sau khi dự án xong**.

---

## 2. Cấu trúc app: 3 bề mặt (không phải 4 hub)

PRD tổ chức nghiệp vụ theo **4 hub** (Onboarding · Delivery · Growth · Retaining). Đó là cách
nói của nội bộ. Nhưng khách hàng **không nghĩ bằng "hub"**, họ nghĩ bằng "việc của tôi".
Nên app chỉ bày ra **3 bề mặt**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│  HÔM NAY            WORKROOM                  BRAND HOME                  │
│  "Tôi cần làm gì?"  "Dự án đang ở đâu?"       "Thương hiệu nên đi tiếp    │
│                                                thế nào?"                  │
│  ─────────────      ────────────────────      ──────────────────────────  │
│  • việc cần duyệt   • hạng mục & tiến độ      • kho tài sản (logo, màu,   │
│  • việc cần nộp     • tệp & phiên bản           font)                     │
│  • việc quá hạn     • góp ý trên từng bản     • guideline                 │
│  • rủi ro           • duyệt / yêu cầu sửa     • điểm sức khỏe thương hiệu │
│                     • bàn giao                • lộ trình & dịch vụ gợi ý  │
│                                               • yêu cầu dịch vụ mới      │
└───────────────────────────────────────────────────────────────────────────┘
        ▲                                            ▲
        └── dùng 4 hub ở trên như "kho" nội bộ ──────┘
```

Menu bên trái đổi theo vai trò: khách hàng thấy `Hôm nay · Dự án · Onboarding · Brand Home ·
Thông báo · Cài đặt`; nhân sự Sao Kim thấy `Inbox · Dự án · Khách hàng · Onboarding · Báo cáo ·
Thông báo · Quản trị · Cài đặt`.

---

## 3. Một câu chuyện xuyên suốt: An Phát Land

Hãy đi theo **An Phát Land** — công ty bất động sản trong dữ liệu demo — từ lúc ký hợp đồng
đến lúc thành khách hàng dài hạn. Đây là toàn bộ luồng nghiệp vụ của sản phẩm.

### Mốc 1 — Sau khi ký hợp đồng: mời khách vào hệ thống
| Ai làm | Việc gì | Khách thấy gì |
|---|---|---|
| Minh Anh (PM) | Tạo dự án "Nhận diện thương hiệu An Phát Land" + chọn loại dự án | — |
| Hệ thống | **Tự sinh checklist onboarding theo loại dự án** | — |
| Minh Anh | Gửi lời mời cho `tung.vu@anphatland.vn` | Nhận email có link, hạn **48 giờ** |
| Vũ Thanh Tùng (Giám đốc Marketing) | Mở link → tạo mật khẩu → vào app | Tự động vào **Hôm nay** |

> **Vì sao quan trọng:** khách không phải "được cấp tài khoản rồi tự mò". Họ vào là thấy ngay
> việc cần làm, không thấy menu kỹ thuật nào của Sao Kim.

### Mốc 2 — Onboarding: khách biết chính xác còn thiếu gì
Với dự án **Website An Phát Land**, checklist sinh tự động gồm 5 mục bắt buộc. Hiện trạng trong demo:

| Mục | Trạng thái | Ai làm |
|---|---|---|
| Hồ sơ doanh nghiệp | ✅ Đạt | Khách |
| Tài sản thương hiệu hiện có | ✅ Đạt | Khách |
| Nội dung giới thiệu dự án | ⚠️ **Cần làm** | Khách |
| Thông tin hosting & domain | 🕐 Đã nộp, chờ PM duyệt | Khách |
| Xác nhận lịch kickoff | ✅ Đạt | Sao Kim |

Khách thấy **60%** và biết ngay mình còn nợ đúng 1 việc: *"Nội dung giới thiệu dự án"*.
PM cũng thấy đúng con số đó ở phía mình, kèm 2 nút **Đạt** / **Yêu cầu bổ sung** (bắt buộc ghi
rõ cần gì).

> **Cổng quan trọng:** dự án **không được** chuyển sang "sẵn sàng kickoff" nếu còn mục bắt buộc
> chưa đạt. Ngoại lệ duy nhất: PM bấm override **và phải ghi lý do** — lý do được lưu vết.
> Đây là điều ngăn tình trạng "dự án chạy mà thiếu đầu vào".

### Mốc 3 — Delivery: vòng đời một mẫu thiết kế (phần cốt lõi)
Đây là chỗ app khác biệt rõ nhất so với gửi file qua Zalo. Xem đúng dữ liệu demo của **Logo An Phát Land**:

```
v1  ── khách góp ý: "Ngôi sao hơi nhỏ so với chữ"          → Yêu cầu sửa
v2  ── khách góp ý: "Màu xanh đậm hơn cho hợp BĐS"         → Yêu cầu sửa
v3  ── đang chờ Vũ Thanh Tùng duyệt (2 góp ý chưa xử lý)   → Chờ duyệt  ← hiện tại
```

| Bước | Ai làm | Hệ thống làm gì | Vì sao thiết kế như vậy |
|---|---|---|---|
| 1 | Hoàng Nam (designer) tải lên v1 | Đánh số **v1**, lưu bản cũ, không ghi đè | Không bao giờ mất bản cũ |
| 2 | Vũ Thanh Tùng góp ý ngay trên v1 | Gắn góp ý vào **đúng tệp + đúng phiên bản** | Hết cảnh "góp ý rải rác không biết bản nào" |
| 3 | PM **Gửi yêu cầu duyệt** v3 | Chỉ định **người duyệt** = Vũ Thanh Tùng | Duyệt là việc của khách, không phải PM tự quyết |
| 4 | Vũ Thanh Tùng bấm **Duyệt** | Phiên bản **bị KHOÁ vĩnh viễn** | Bản đã duyệt là bản pháp lý — không ai sửa lén |
| 5 | Nếu cần sửa tiếp | **Chỉ có một đường: tạo v4** | Buộc phải minh bạch lịch sử |

Nếu PM duyệt thay khách (khách xác nhận qua điện thoại chẳng hạn) → **bắt buộc ghi lý do**,
và lý do đó vào sổ audit. Không có ngoại lệ.

### Mốc 4 — Bàn giao: kết thúc dự án, bắt đầu tài sản
Khi mọi phiên bản cần thiết đã duyệt, PM bấm **"Tập hợp bộ bàn giao"** → mọi phiên bản đã duyệt
được gom thành một gói → PM bấm **"Phát hành bàn giao"** → dự án chuyển **Hoàn tất**, và tài sản
được chuyển sang **Brand Home**.

### Mốc 5 — Sau bàn giao: đây là chỗ tạo ra doanh thu dài hạn
Nhìn dữ liệu demo của Brand Home An Phát Land:

| Thành phần | Giá trị trong demo | Ý nghĩa |
|---|---|---|
| Màu thương hiệu | `Xanh An Phát #0F3D6E`, `Cam đất #D97A2B` | Khách lấy đúng mã màu, không hỏi lại |
| Font tiêu đề | Be Vietnam Pro, weight 600 | Đối tác in đúng font |
| Brand guideline | Đã publish, 3 phần (logo/màu/typography) | Gửi thẳng cho đơn vị thi công |
| **Điểm sức khỏe thương hiệu** | **62/100** (Đồng nhất 55 · Độ phủ 70 · Quản trị 50) | Biến "thương hiệu" thành con số biết cải thiện |
| Chẩn đoán gần nhất | 3 phát hiện: guideline cho đối tác (nghiêm trọng), nhận diện chưa đồng nhất, mạng xã hội thiếu hệ thống | Nói rõ đang yếu ở đâu |
| Lộ trình phát triển | 3 giai đoạn: Nền tảng → Hệ thống & ứng dụng → Tăng trưởng | Khách thấy mình đang ở đâu trên đường dài |
| Dịch vụ đề xuất | Brand guideline ✅ đã hiện · Website care 🆕 | Gợi ý bán thêm **dựa trên dữ liệu**, không dựa vào trí nhớ |

Và khi khách bấm **"Gửi yêu cầu"** cho guideline: app tạo yêu cầu *"Cần guideline cho đối tác"*
(trạng thái: đã liên hệ) và tạo một **cơ hội 60.0 tr ₫** để Account theo dõi.

> **Chú ý nguyên tắc:** app **không ghi thẳng vào Odoo**. Nó chỉ tạo **tín hiệu** (cơ hội, mức
> quan tâm) rồi đẩy qua n8n. Odoo vẫn là nơi chốt hợp đồng. Portal không làm thay CRM.

---

## 4. Ví dụ theo từng vai trò — mở app và thấy gì

Đăng nhập bằng các tài khoản dưới đây (mật khẩu chung **`BrandCare@2026`**) để thấy đúng những
gì tài liệu này mô tả.

### 4.1 Vũ Thanh Tùng — Giám đốc Marketing, **Client Owner** (khách)
`tung.vu@anphatland.vn` · trang đầu: **/today**

| Thấy gì | Giải thích |
|---|---|
| Hôm nay: *"Duyệt Logo An Phát Land v3"* (ưu tiên: hôm nay) | Hệ thống tự biết việc số 1 của anh là gì |
| Hôm nay: *"Nộp Nội dung giới thiệu dự án"* | Việc còn nợ duy nhất của dự án Website (mục hosting đã nộp nên không còn hiện) |
| Dự án: 2 dự án, 65% và 25% | Nhìn 1 giây biết tiến độ |
| Chỉ số: **Chờ tôi duyệt**, **Tài liệu cần nộp** | Đúng 2 thứ anh phải quan tâm |
| Trong màn Duyệt: nút **Duyệt** và **Yêu cầu sửa** | Anh là người duy nhất có nút này |
| Brand Home: xem tài sản, guideline, điểm 62/100 | Tài sản công ty anh, dùng lâu dài |

Điều **không** thấy: Inbox, Khách hàng, Báo cáo, Quản trị, và dữ liệu của bất kỳ công ty nào khác.

### 4.2 Ngô Khánh Vy — Chuyên viên marketing, **Client Member** (khách)
`vy.ngo@anphatland.vn` · trang đầu: **/today**

| Thấy gì | Giải thích |
|---|---|
| Cùng việc cần nộp (nội dung, tài liệu) | Chị là người nộp thật |
| Tải tệp lên, góp ý trên từng phiên bản | Làm việc trực tiếp |
| Màn Duyệt: **"Chỉ chủ doanh nghiệp được duyệt."** | Chị **không** có quyền duyệt — app nói rõ chứ không để nút chết |
| Không thấy dự án mình không được thêm vào | Phân quyền theo từng dự án |

### 4.3 Nguyễn Minh Anh — **PM** (Sao Kim)
`minhanh@saokim.vn` · trang đầu: **/inbox**

| Thấy gì | Giải thích |
|---|---|
| Inbox 3 nhóm: **Việc của tôi** · **Phản hồi chờ xử lý** · **Đang chờ duyệt** | Một màn hình chứa hết việc của PM |
| Việc quá hạn được tô đỏ: *"Chỉnh sửa logo theo phản hồi v03"* | Không phải tự đi tìm |
| Trong dự án: **Gửi yêu cầu duyệt** cho phiên bản | Chỉ định đúng người duyệt phía khách |
| Trên /onboarding: nút **Đạt** / **Yêu cầu bổ sung** | Duyệt đầu vào của khách, bắt buộc ghi lý do khi từ chối |
| Được phép **override** cổng kickoff **kèm lý do** | Linh hoạt nhưng có vết |
| Tải phiên bản mới, phát hành bàn giao | Việc delivery hằng ngày |

### 4.4 Đỗ Hoàng Nam — **Designer** (Sao Kim)
`hoangnam@saokim.vn`

| Thấy gì | Giải thích |
|---|---|
| Chỉ thấy dự án mình được phân công | Không thấy toàn bộ khách hàng của công ty |
| Màn Tệp: **Tải lên** phiên bản mới + **Gửi góp ý** | Không có nút Duyệt |
| Không có Báo cáo / Quản trị | Quyền hẹp đúng mức |
| Trong /feedback: đọc góp ý theo phiên bản để sửa đúng chỗ | Không phải lục Zalo |

### 4.5 Lê Thu Hà — **Account** (Sao Kim)
`thuha@saokim.vn`

| Thấy gì | Giải thích |
|---|---|
| /clients → hồ sơ khách 360° | Danh sách khách hàng của mình |
| Trong hồ sơ An Phát Land: dự án, **lịch sử tương tác**, **cơ hội 60.0 tr ₫** | Biết khách đang quan tâm gì mà không cần hỏi |
| /growth: lộ trình + dịch vụ đề xuất | Cơ sở để tư vấn upsell |
| Nhận thông báo khi khách gửi yêu cầu mới | Không bỏ sót cơ hội |
| Tạo/gửi yêu cầu dịch vụ, mời người dùng khách | Việc hằng ngày |

### 4.6 Phạm Gia Linh — **Customer Success** (Sao Kim)
`gialinh@saokim.vn`

| Thấy gì | Giải thích |
|---|---|
| Inbox: việc chờ xử lý, khách đang chờ phản hồi | Chăm sóc chủ động |
| Dữ liệu tương tác: **42 sự kiện** trong demo | Biết khách có đang dùng portal hay không |
| Cảnh báo trong AI: *"khách chưa tương tác 14 ngày"* | Kích hoạt chăm sóc lại trước khi khách nguội |
| Gửi yêu cầu dịch vụ (không tạo dự án) | Quyền vừa đủ |

### 4.7 Trần Quốc Bảo — **Admin** (Sao Kim)
`admin@saokim.vn`

| Thấy gì | Giải thích |
|---|---|
| Mọi thứ, gồm cả /reports có **doanh thu** | Vai trò quản trị |
| Quyền cấu hình template, quản lý người dùng | Duy nhất admin có |
| **Lưu ý thật:** màn `/admin` hiện là **trang chờ** — chức năng cấu hình chưa làm | Đừng kỳ vọng chỉnh được gì ở đó |

---

## 5. AI trong sản phẩm này làm gì (giải thích không kỹ thuật)

AI **không phải** một chatbot gắn thêm. Nó là một lớp giúp bạn **đỡ phải đọc và đỡ phải nhớ**.
Mở bằng nút ✨ trên thanh trên cùng (hoặc `⌘K` → "Hỏi trợ lý AI").

### Ví dụ thật — bấm vào và hỏi
| Bạn hỏi | AI làm gì | Bạn nhận được |
|---|---|---|
| "Hôm nay tôi cần làm gì?" | Tự lấy hàng đợi việc của bạn | 1 câu tóm tắt + **danh sách việc bấm được** |
| "Có rủi ro nào cần chú ý?" | Quét khách im lặng / duyệt treo / việc trễ | Danh sách rủi ro kèm lý do |
| "Phản hồi nào cần xử lý?" | Gộp góp ý theo phiên bản | Checklist sửa cho designer |
| "Tình trạng các dự án?" | Lấy danh sách dự án được phép xem | Bảng trạng thái + % |
| "Tóm tắt phiên bản đang chờ duyệt" | Đọc ghi chú + góp ý của đúng phiên bản đó | Thẻ tóm tắt để bạn duyệt nhanh |

### Ba điều AI **cố ý không làm**
1. **Không tự ghi dữ liệu.** AI có thể đề xuất *"tạo yêu cầu guideline cho khách"*, nhưng bạn phải
   bấm **Xác nhận** thì hệ thống mới ghi. Không có chuyện AI tự tạo dự án hay tự duyệt file.
2. **Không bịa số.** Mọi con số, tên tệp, deadline AI nói ra đều lấy từ dữ liệu thật trong DB.
3. **Không đọc dữ liệu công ty khác.** AI bị chặn y như bạn bị chặn — không phải đường vòng.

### Chi phí được kiểm soát
Mỗi lần gọi AI đều được ghi lại (model, số token, chi phí, thời gian). Có **hạn mức theo công ty
mỗi ngày** (mặc định 5 USD). Vượt hạn mức → AI tự tắt và báo *"Đã đạt hạn mức AI hôm nay. Bạn vẫn
làm được mọi việc bằng thao tác thủ công."* — app không bao giờ chặn công việc vì hết tiền AI.

> **Trạng thái hiện tại:** đã chạy với DeepSeek thật (hỏi "Hôm nay tôi cần làm gì?" mất ~2,3 giây).
> Nếu chưa cấu hình API key, app chạy **chế độ demo**: AI trả lời bằng bộ chọn tất định nhưng
> **vẫn lấy dữ liệu thật**, và panel có nhãn `demo` để bạn biết.

---

## 6. Vì sao thiết kế "ít chữ" như vậy?

Đây là quy tắc cứng, không phải sở thích:

| Quy tắc | Lý do |
|---|---|
| Mỗi màn hình chỉ 1 hành động chính | Khách hàng không chuyên công nghệ — nhiều lựa chọn = không bấm gì |
| CTA ≤ 3 từ (`Duyệt`, `Nộp tài liệu`, `Xác nhận kickoff`) | Đọc 1 giây là hiểu |
| Mỗi dòng phụ ≤ 12 từ | Đủ ngữ cảnh, không viết văn |
| Không đoạn văn > 2 câu trong giao diện | Ai cần đọc dài thì mở guideline |
| Trạng thái chỉ 1 từ, cố định | "Chờ duyệt" luôn là "Chờ duyệt", không có 5 cách nói |
| Màu chỉ để báo tín hiệu | Xám = bình thường, vàng = đang chờ, đỏ = trễ/rủi ro |

Về thị giác: sản phẩm lấy đúng màu từ **logo Sao Kim** (xanh navy `#0A1A5C`, xanh Sao Kim
`#21409A`, và duy nhất một gradient cho motif ngôi sao `#EF4123 → #FAA634` dùng cho AI).
Chữ là **Be Vietnam Pro** — thiết kế cho tiếng Việt nên dấu không bị chật.

---

## 7. Bản đồ: khách thấy gì vs. nội bộ thấy gì

| Chức năng | Client Owner | Client Member | PM | Designer | Account | CS | Admin |
|---|---|---|---|---|---|---|---|
| Xem tiến độ dự án | ✅ công ty mình | ✅ được phân công | ✅ | ✅ được phân công | ✅ | ✅ | ✅ |
| Tải tệp / góp ý | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Duyệt phiên bản** | ✅ | ❌ | ✅ (override + lý do) | ❌ | ❌ | ❌ | ✅ |
| Nộp tài liệu onboarding | ✅ | ✅ | — | — | — | — | — |
| Duyệt đầu vào onboarding | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Gửi yêu cầu dịch vụ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Xem Brand Home | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo dự án | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Mời người dùng khách | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Xem **doanh thu** | ❌ | ❌ | ❌ | ❌ | ❌ (chỉ khách mình) | ❌ | ✅ |
| Cấu hình hệ thống | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Quyền được kiểm tra **ở server** cho mọi thao tác — app không chỉ ẩn nút, mà chặn thật.

---

## 8. Từ điển nhanh (đọc xong là hiểu hết thuật ngữ)

| Từ | Nghĩa trong sản phẩm |
|---|---|
| **Hôm nay** | Hàng đợi việc cần làm của bạn (tối đa 5 việc quan trọng nhất) |
| **Workroom** | Không gian làm việc theo một dự án (tệp, góp ý, duyệt, bàn giao) |
| **Brand Home** | Nhà của thương hiệu: tài sản, guideline, sức khỏe, lộ trình |
| **Khách hàng (organization)** | Mỗi công ty khách là một tổ chức tách biệt hoàn toàn |
| **Dự án** | Một hợp đồng triển khai (nhận diện, website, bao bì…) |
| **Hạng mục (milestone)** | Mốc lớn trong dự án (Concept logo, Hệ thống nhận diện…) |
| **Phiên bản** | Một lần nộp tệp (v1, v2, v3) — không ghi đè, chỉ tạo mới |
| **Phản hồi** | Góp ý gắn vào đúng tệp + đúng phiên bản |
| **Duyệt** | Khách chấp thuận chính thức → phiên bản bị khoá vĩnh viễn |
| **Onboarding** | Giai đoạn thu thập đầu vào trước khi kickoff |
| **Bàn giao** | Gói tài sản cuối dự án, phát hành 1 lần rồi khoá |
| **Tín hiệu (signal)** | Dấu hiệu khách quan tâm (xem dịch vụ, gửi yêu cầu) → đẩy sang CRM |
| **Cơ hội (opportunity)** | Tín hiệu đã thành cơ hội bán hàng, Account theo dõi |
| **Sức khỏe thương hiệu** | Điểm 0–100 về độ đồng nhất, độ phủ tài sản, quản trị |

---

## 9. Thử ngay trong 10 phút (kịch bản có sẵn)

```bash
npm run dev      # mở http://localhost:3000
```

| Phút | Đăng nhập | Bấm gì | Phải thấy |
|---|---|---|---|
| 1 | `tung.vu@anphatland.vn` | — | **Hôm nay** với "Duyệt Logo An Phát Land v3" |
| 2 | (tiếp) | Dự án → "Nhận diện thương hiệu An Phát Land" | 4 hạng mục, 2 xong, tiến độ 65% |
| 3 | (tiếp) | tab **Tệp** | v1/v2 "Yêu cầu sửa", v3 "Chờ duyệt" |
| 4 | (tiếp) | tab **Duyệt** → bấm **Duyệt** (lý do tùy chọn với chính người duyệt) | Báo "Đã duyệt. Phiên bản được khoá" |
| 5 | (tiếp) | quay lại tab **Tệp** | v3 khoá, ghi chú *"Tạo phiên bản mới để trao đổi tiếp"* |
| 6 | (tiếp) | Hôm nay → ✨ AI → "Hôm nay tôi cần làm gì?" | AI đọc dữ liệu thật và trả lời |
| 7 | (tiếp) | Brand Home | 2 màu, font, guideline, điểm 62/100 |
| 8 | `hoangnam@saokim.vn` (Designer) | Tệp của dự án | Có **Tải lên**, **không** có nút Duyệt |
| 9 | `minhanh@saokim.vn` (PM) | Inbox → Onboarding | 3 nhóm việc; checklist 60%, nút Đạt / Yêu cầu bổ sung |
| 10 | `thuha@saokim.vn` (Account) | Khách hàng → An Phát Land | Lịch sử tương tác + cơ hội **60.0 tr ₫** |

Ghi chú khi thử: cổng mặc định là **3000**; nếu bận, Next sẽ tự chọn cổng khác và in ra terminal.

---

## 10. Những gì app **chưa** làm (để bạn không kỳ vọng sai)

| Chưa có | Ghi chú |
|---|---|
| Chữ ký số / phê duyệt có giá trị pháp lý | Duyệt hiện là phê duyệt vận hành |
| Zalo hai chiều | Hiện chỉ gửi thông báo một chiều qua n8n |
| Thanh toán / hoá đơn | Chưa có |
| Màn **Quản trị** thật | `/admin` hiện là trang chờ |
| App mobile riêng | Dùng web trên điện thoại (responsive) |
| Biểu đồ đẹp (chart) | MVP cố ý dùng số + thanh tiến độ |
| Đồng bộ Odoo tự động | Portal chỉ tạo tín hiệu; việc chốt vẫn ở Odoo |

---

## 11. Một câu để nhớ

> **BrandCare OS biến "một agency giao dự án" thành "một đối tác đồng hành dài hạn"** —
> bằng cách để khách luôn biết việc tiếp theo của mình, và để tài sản thương hiệu
> tiếp tục được dùng, đo lường và phát triển **sau khi dự án đã kết thúc**.
