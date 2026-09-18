# 00 — Tư duy thiết kế sản phẩm

> Nguồn: `SaoKim_BrandCare_OS_PRD (3).pdf` §2, §4, §6, §7, §18, §25.
> Tài liệu này là "hiến pháp" cho mọi quyết định UI/UX. Khi mâu thuẫn với tài liệu khác, tài liệu này thắng.

---

## 1. Sản phẩm là gì — và không là gì

**Là:** hệ điều hành chăm sóc & phát triển thương hiệu cho khách hàng Sao Kim. Nơi khách hàng luôn biết *mình cần làm gì tiếp theo*, và nơi Sao Kim chứng minh giá trị sau khi dự án kết thúc.

**Không là:**
- Không phải app quản lý task (Trello/Asana/Jira/Monday/ClickUp).
- Không phải CRM. CRM là Odoo. Portal chỉ **phát signal** (quan tâm dịch vụ, mức tương tác, brand health) về CRM.
- Không phải nơi trưng bày dashboard nhiều số. Dashboard chỉ để trả lời "tiếp theo làm gì".
- Không phải website marketing. Không có hero, không có slogan.

**Câu định vị dùng trong mọi màn hình giới thiệu:** *Đồng hành cùng doanh nghiệp trong toàn bộ hành trình thương hiệu.*

---

## 2. Người dùng thật sự cần gì (map từ PRD §6)

| Persona | Nỗi đau thật | Họ mở portal để làm gì | Bề mặt chính |
|---|---|---|---|
| **Client Owner** (CEO/CMO/Brand Manager) | "Tôi không biết dự án đang ở đâu và tôi phải quyết cái gì" | Duyệt, xem tiến độ, xem nên làm gì tiếp | Today + Brand Home |
| **Client Member** (marketing/hành chính/kỹ thuật) | "Tôi không biết cần nộp gì, góp ý ở đâu" | Nộp tài liệu, góp ý file, xử lý việc được giao | Today + Workroom |
| **PM** (Sao Kim) | "Task nào trễ, ai đang chờ ai" | Điều phối delivery, gỡ tắc | Workroom + Inbox |
| **Designer/Content/Web/Marcom** | "Feedback nằm rải rác, không biết version nào" | Nhận việc, xử lý feedback theo version | Workroom |
| **Account/Sales** | "Cơ hội upsell phụ thuộc trí nhớ" | Thấy signal quan tâm + lịch sử tương tác | Inbox + Brand Home |
| **Customer Success** | "Khách im lặng quá lâu mà không biết" | Chăm sóc lại, kích hoạt retaining | Inbox + Brand Home |
| **Admin** | Cấu hình, phân quyền | Admin console | Settings |
| **Management** | Chất lượng delivery, doanh thu cũ | Báo cáo tổng | Reports |

**Hệ quả thiết kế:** mỗi persona có **một** màn hình mặc định, và màn hình đó chỉ trả lời một câu hỏi. Không có màn hình "dùng chung cho mọi người".

---

## 3. Quyết định cốt lõi: 4 hub (nội bộ) → 3 bề mặt (trải nghiệm)

PRD tổ chức theo 4 hub. Đó là **taxonomy nghiệp vụ** — giữ nguyên trong data model, phân quyền, roadmap. Nhưng **không** đưa 4 hub ra làm 4 menu, vì khách hàng không nghĩ bằng "hub", họ nghĩ bằng "việc của tôi".

```
BỀ MẶT (khách hàng thấy)      HUB (nội bộ)                 CÂU HỎI NÓ TRẢ LỜI
─────────────────────────────────────────────────────────────────────────────
TODAY                     ←   Onboarding + Delivery +      "Hôm nay tôi cần
(việc cần làm)                Growth + Retaining signals     làm gì?"
─────────────────────────────────────────────────────────────────────────────
WORKROOM                  ←   Delivery (+ Onboarding        "Dự án đang ở đâu,
(theo dự án)                  setup)                         tôi duyệt/góp ý ở đâu?"
─────────────────────────────────────────────────────────────────────────────
BRAND HOME                ←   Growth + Retaining             "Thương hiệu của tôi
(tài sản & tăng trưởng)                                      nên phát triển thế nào?"
─────────────────────────────────────────────────────────────────────────────
```

- **Today** không phải dashboard. Today là **hàng đợi hành động**: tối đa 5 việc, sắp theo (quá hạn → chờ tôi duyệt → chờ tôi nộp → nên xem).
- **Workroom** là nơi delivery thật sự diễn ra: timeline, file, version, feedback, approval, handover.
- **Brand Home** là thứ giữ khách ở lại sau bàn giao: brand vault, guideline, brand health, growth roadmap, service request.

Admin/Reports/Inbox của Sao Kim nằm ở **mặt nội bộ** (route group `(staff)`), dùng chung shell nhưng không lẫn với trải nghiệm khách hàng.

---

## 4. Vòng lặp sản phẩm: Signal → Action → Proof

Mọi tính năng phải nằm ở một trong ba chặng này, nếu không thì không làm.

| Chặng | Nghĩa | Ví dụ trong PRD | Bề mặt |
|---|---|---|---|
| **Signal** | Có gì vừa thay đổi / đáng chú ý | version mới, comment mới, milestone xong, brand scan điểm thấp, khách xem dịch vụ 3 lần | Today, Inbox |
| **Action** | Đúng **một** việc tiếp theo, có CTA | duyệt Logo v03, nộp giấy phép kinh doanh, xác nhận kickoff | Today |
| **Proof** | Bằng chứng giá trị được tích luỹ | handover package, brand vault, growth roadmap, brand health score | Brand Home |

**Retention đến từ Proof.** Nếu khách chỉ thấy Signal + Action, portal giống app quản lý dự án. Proof là thứ khiến khách quay lại sau khi dự án kết thúc — và là nền của recurring revenue (PRD §3.3, §11).

---

## 5. Năm nguyên tắc thiết kế (theo thứ tự ưu tiên khi xung đột)

1. **Một màn hình, một hành động chính.** Mỗi màn hình có đúng 1 nút primary. Nếu có 2, phải chọn lại.
2. **Mỗi câu chữ phải dẫn tới một quyết định — nếu không, xoá.** (Chi tiết §6.)
3. **Client-first, không phải internal-first.** Mọi màn hình khách hàng phải hiểu được mà không cần đào tạo. Màn hình nội bộ được phép dày hơn.
4. **AI làm phần nhàm chán, con người quyết định.** AI đọc, tóm tắt, điền sẵn, đề xuất, phát hiện. AI **không** tự ghi dữ liệu.
5. **Không có ghi vào hệ thống = không tồn tại.** (PRD §22.1) Mọi thứ quan trọng phải sống trong portal, không phải trong Zalo/email. Notification đẩy ra Zalo/email nhưng luôn kèm deep-link quay về — sinh ra từ outbox, không phải gõ tay.

---

## 6. Quy tắc "ít chữ" — đo được, kiểm tra được trong review

| Hạng mục | Giới hạn | Ví dụ đạt |
|---|---|---|
| CTA | ≤ 3 từ, động từ + danh từ | `Duyệt v03`, `Nộp tài liệu`, `Xác nhận kickoff` |
| Tiêu đề trang | ≤ 4 từ | `Hôm nay`, `Dự án An Phát Land` |
| Mô tả card / dòng phụ | ≤ 12 từ, 1 dòng | `Logo v03 đang chờ bạn duyệt` |
| Đoạn văn trong UI | **Không** quá 2 câu (ngoại lệ: brand brief, guideline) | — |
| Trạng thái | 1 từ, cố định, không đồng nghĩa kép | `Chờ duyệt`, `Đã duyệt`, `Trễ hạn`, `Hoàn tất` |
| Empty state | 1 câu + 1 CTA | `Chưa có dự án. Tạo dự án` |
| Error state | 1 câu nói rõ cần làm gì | `Tải file thất bại. Thử lại` |
| Số liệu | con số to + nhãn ngắn, **không** viết thành câu | `3 việc cần xử lý` |
| Thông báo | ≤ 80 ký tự, có deep-link | `An Phát Land: Logo v03 chờ duyệt` |

**Không dùng:** marketing copy dài, "Chào mừng bạn đến với...", icon + chữ lặp nghĩa, tooltip giải thích thứ đã rõ, all-caps cho nhãn tiếng Việt nhiều dấu (mất dấu khó đọc).

**Từ điển product language** (không tự đổi):
```
Tên đầy đủ : Sao Kim BrandCare OS
Tên ngắn   : BrandCare
Bề mặt     : Hôm nay · Workroom · Brand Home
Đơn vị     : Khách hàng · Dự án · Hạng mục · Phiên bản · Phản hồi · Duyệt
```
Không dùng: `BrandCare Pro`, `BrandOS`, `SaoKim CRM`, `PMS 2.0`, `task list`, `board`, `card`.

---

## 7. Anti-pattern (thấy là sửa ngay)

- Kanban board nhiều cột cho khách hàng → khách không hiểu; dùng danh sách có trạng thái.
- Dashboard 8 widget không có CTA → thay bằng Today 5 dòng có hành động.
- Bắt khách đọc bảng phân quyền / thuật ngữ nội bộ.
- Notification không có deep-link, hoặc gửi mọi thứ (mất tín hiệu).
- AI trả lời dài, hoặc tự tạo dự án / tự duyệt thay người.
- Nút "Gửi" chung chung; nút không nói rõ hậu quả.
- Gradient/glassmorphism trang trí; nhiều hơn 1 gradient trong toàn app (gradient chỉ dành cho motif ngôi sao AI).
- Trộn tiếng Việt và tiếng Anh trong cùng một nhãn (`Project Dashboard`, `Growth Hub` trong UI khách hàng).

---

## 8. Đo thành công (map KPI PRD §4.4 vào bề mặt)

| Nhóm KPI (PRD) | Chỉ số | Đo ở đâu |
|---|---|---|
| Onboarding | % hoàn tất onboarding đúng hạn | Today (checklist) + Onboarding |
| Delivery | % milestone/task đúng hạn | Workroom |
| Experience | CSAT/NPS sau milestone | Today (1 câu hỏi, 2 nút) |
| Adoption | % khách đăng nhập & dùng | `interaction_event` |
| Engagement | lượt xem tài liệu/file/growth | `interaction_event` |
| Upsell | service request & cơ hội mới | Brand Home → signal CRM |
| Retention | % khách quay lại sau bàn giao | Brand Home |
| Revenue | doanh thu khách cũ + recurring | Reports (staff) |
| Efficiency | giảm trao đổi Zalo/email thủ công | outbox vs. baseline |

**Chỉ số Bắc Đẩu của thiết kế:** *thời gian từ lúc khách đăng nhập đến lúc họ biết việc tiếp theo* — mục tiêu < 5 giây, đo bằng Today hiển thị action đầu tiên ngay khi tải (không cần cuộn, không cần mở menu).
