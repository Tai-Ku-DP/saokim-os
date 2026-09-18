# 02 — Design system & style

> Hướng: **Linear cho agency** — dày thông tin nhưng tĩnh, ít chữ, keyboard-first, chrome tối giản. Khác Linear ở chỗ: mặc định **light mode** (khách hàng không chuyên), bo góc mềm hơn, và cảm giác "editorial/brand" thay vì "dev tool".

---

## 1. Màu — lấy trực tiếp từ logo

Logo Sao Kim (file `logo-saokim-blue.svg`) có đúng 4 màu:

| Token | Hex | Nguồn trong logo | Dùng cho |
|---|---|---|---|
| `--brand-ink` | `#0A1A5C` | đỉnh gradient wordmark | heading, trạng thái active, chữ trên nền sáng mạnh |
| `--brand` | `#21409A` | thân gradient wordmark | **primary**: nút chính, link, focus ring, biểu đồ |
| `--brand-amber` | `#FAA634` | đuôi gradient ngôi sao | spark AI, cảnh báo mềm, "đang chờ" |
| `--brand-hot` | `#EF4123` | đầu gradient ngôi sao | rủi ro, trễ hạn, phá huỷ |

**Luật dùng màu:**
- Gradient **chỉ một** trong toàn app: motif ngôi sao (`--brand-hot → --brand-amber`) dùng cho affordance AI và logo. Không gradient ở nền, nút, card.
- `--brand-amber` và `--brand-hot` **không bao giờ** dùng làm màu nền diện rộng — chỉ icon, chấm trạng thái, viền, badge nhỏ.
- 95% giao diện là neutral. Màu là tín hiệu, không phải trang trí.

### Thang neutral (cool-neutral để hợp navy)
| Token | Light | Dark | Dùng |
|---|---|---|---|
| `--bg` | `#F7F8FA` | `#0B0F1A` | nền app |
| `--surface` | `#FFFFFF` | `#121826` | card, panel, row |
| `--surface-2` | `#F1F3F7` | `#1A2133` | header bảng, hover nhẹ |
| `--line` | `#E4E7EE` | `#232B3D` | hairline 1px |
| `--line-strong` | `#D3D8E3` | `#313B52` | viền input, divider mạnh |
| `--ink` | `#111827` | `#E8ECF4` | chữ chính |
| `--ink-2` | `#4B5563` | `#A7B0C0` | chữ phụ |
| `--ink-3` | `#8A93A5` | `#6F7A8F` | metadata, timestamp |

### Màu ngữ nghĩa
| Trạng thái | Token | Light | Ý nghĩa |
|---|---|---|---|
| Thành công | `--success` | `#0E9F6E` | đã duyệt, hoàn tất, đúng hạn |
| Chờ / cảnh báo | `--warning` | `#D97706` | chờ duyệt, chờ khách phản hồi |
| Rủi ro | `--danger` | `#DC2626` | trễ hạn, bị từ chối, lỗi |
| Thông tin | `--info` | `#21409A` | trung tính có ngữ cảnh |

### Map trạng thái nghiệp vụ → màu (cố định, không tự chế)
```
Dự án    : Đang chạy(info) · Chờ khách(warning) · Trễ hạn(danger) · Hoàn tất(success) · Tạm dừng(ink-3)
Hạng mục : Chưa bắt đầu(ink-3) · Đang làm(info) · Chờ duyệt(warning) · Hoàn tất(success)
Phiên bản: Nháp(ink-3) · Đang xem xét(info) · Yêu cầu sửa(warning) · Đã duyệt(success)
Phản hồi : Mới(info) · Đang xử lý(warning) · Đã xử lý(success)
Brand health: Tốt(success) · Cần chú ý(warning) · Yếu(danger)
```

---

## 2. Typography

```
--font-sans : Be_Vietnam_Pro   (subsets: latin, vietnamese)  ← thiết kế cho tiếng Việt
--font-mono : Geist_Mono       (số liệu, mã, diff)
```
Fallback nếu `vietnamese` subset không tồn tại ở `next/font`: `Inter` (có subset `vietnamese`).

| Vai trò | Size / line-height | Weight | Ghi chú |
|---|---|---|---|
| Page title | 20 / 28 | 600 | 1 dòng, ≤ 4 từ |
| Section title | 15 / 22 | 600 | — |
| Card title | 13.5 / 20 | 600 | — |
| Body | 13 / 20 | 400 | mật độ Linear |
| Reading (brief, guideline) | 15 / 26 | 400 | line-height cao vì dấu tiếng Việt |
| Muted / metadata | 12 / 18 | 400 | `--ink-3` |
| Caption / badge | 11 / 16 | 500 | không all-caps với tiếng Việt |
| Metric | 24 / 28 | 600 | `font-variant-numeric: tabular-nums` |

**Luật tiếng Việt:**
- line-height tối thiểu **1.5** cho mọi đoạn văn (dấu mũ/dấu thanh cần khoảng thở).
- **Không** `text-transform: uppercase` cho nhãn tiếng Việt — mất phân biệt dấu, khó đọc. Nếu cần nhấn, dùng weight + màu.
- Không letter-spacing âm; tracking chỉ dùng cho số liệu/ký hiệu Latin (`+2%`).
- Số, ngày, tiền: `tabular-nums`, định dạng `vi-VN` (`12.500.000 ₫`, `18/09/2026`).

---

## 3. Khoảng cách, bo góc, đổ bóng

```
Base grid        : 4px
Row height       : 32px (bảng/danh sách) · 40px (nav item) · 28px (compact)
Padding card     : 16px (mobile) / 20px (desktop)
Gap section      : 24px
Radius           : --radius-sm 6px (input, button) · --radius 8px (card, panel) · --radius-full 999px (pill, avatar)
Border           : 1px solid var(--line); hairline, không bao giờ 2px (trừ focus)
Shadow           : --shadow-1 0 1px 2px rgb(16 24 40 / .06)  (card)
                   --shadow-2 0 8px 24px rgb(16 24 40 / .10) (popover, dialog)
                   Không dùng shadow để trang trí; nền tối dùng viền thay shadow.
```

---

## 4. Chuyển động

```
Thời lượng : 120ms (hover/focus) · 150ms (mở panel, tab) · 200ms (dialog, sheet)
Easing     : cubic-bezier(.2,.8,.2,1)  — không bounce, không spring
Skeleton   : shimmer nhẹ, dùng thay spinner cho mọi vùng nội dung
Tôn trọng  : @media (prefers-reduced-motion: reduce) → tắt mọi transition > 0ms
Hover row  : đổi nền `--surface-2` (không đổi layout, không nhảy kích thước)
```

---

## 5. Dark mode

- Chiến lược: `@custom-variant dark (&:where(.dark, .dark *))` + class `.dark` trên `<html>`. Mặc định theo `prefers-color-scheme`, người dùng đổi được trong Settings và lưu ở cookie.
- Client mặc định **light**; staff mặc định **dark** nếu hệ thống dark (dense work surface đỡ mỏi mắt).
- Ở dark: **không** dùng shadow để phân tầng — dùng `--line` + `--surface-2`. Giảm độ bão hoà của brand blue một bậc khi làm nền lớn.

---

## 6. Token trong Tailwind v4 (CSS thật)

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --bg:#F7F8FA; --surface:#FFFFFF; --surface-2:#F1F3F7;
  --line:#E4E7EE; --line-strong:#D3D8E3;
  --ink:#111827; --ink-2:#4B5563; --ink-3:#8A93A5;

  --brand:#21409A; --brand-ink:#0A1A5C; --brand-soft:#EEF2FC;
  --brand-amber:#FAA634; --brand-hot:#EF4123;

  --success:#0E9F6E; --warning:#D97706; --danger:#DC2626; --info:#21409A;

  --radius-sm:6px; --radius:8px; --radius-full:999px;
  --shadow-1:0 1px 2px rgb(16 24 40 / .06);
  --shadow-2:0 8px 24px rgb(16 24 40 / .10);
}

.dark {
  --bg:#0B0F1A; --surface:#121826; --surface-2:#1A2133;
  --line:#232B3D; --line-strong:#313B52;
  --ink:#E8ECF4; --ink-2:#A7B0C0; --ink-3:#6F7A8F;
  --brand-soft:#16203A; --shadow-1:none; --shadow-2:0 12px 32px rgb(0 0 0 / .45);
}

@theme inline {
  --color-bg:var(--bg); --color-surface:var(--surface); --color-surface-2:var(--surface-2);
  --color-line:var(--line); --color-line-strong:var(--line-strong);
  --color-ink:var(--ink); --color-ink-2:var(--ink-2); --color-ink-3:var(--ink-3);
  --color-brand:var(--brand); --color-brand-ink:var(--brand-ink); --color-brand-soft:var(--brand-soft);
  --color-amber:var(--brand-amber); --color-hot:var(--brand-hot);
  --color-success:var(--success); --color-warning:var(--warning);
  --color-danger:var(--danger); --color-info:var(--info);

  --font-sans:var(--font-sans); --font-mono:var(--font-mono);
  --radius-sm:var(--radius-sm); --radius:var(--radius); --radius-full:var(--radius-full);
  --shadow-1:var(--shadow-1); --shadow-2:var(--shadow-2);
}

body { background:var(--bg); color:var(--ink); -webkit-font-smoothing:antialiased; }
```

**Luật token:** không hard-code mã màu trong component. Chỉ dùng class Tailwind sinh ra từ token (`bg-surface`, `text-ink-3`, `border-line`, `text-brand`).

---

## 7. Inventory component

Nền tảng shadcn/ui (chỉ add khi thật sự dùng):
```
button card badge avatar dialog dropdown-menu tabs table progress separator tooltip
input textarea label select sheet skeleton alert command popover scroll-area sonner
breadcrumb sidebar
```

Component tự viết (domain):
| Component | Vai trò | Ghi chú |
|---|---|---|
| `app-shell` | khung chung | sidebar + topbar + main; chỉ render 1 lần |
| `sidebar` | điều hướng 3 bề mặt | active theo `pathname`, thu gọn được |
| `topbar` | org switcher, search, AI spark, chuông | — |
| `command-palette` | ⌘K | điều hướng + lệnh + hỏi AI |
| `action-row` | 1 việc cần làm | icon trạng thái + tiêu đề + 1 CTA + deadline |
| `status-badge` | trạng thái nghiệp vụ | map màu §1, không truyền màu thô |
| `metric` | số liệu | số to + nhãn ngắn, tabular-nums |
| `empty-state` | rỗng | icon mờ + 1 câu + 1 CTA |
| `ai-panel` | panel AI bên phải | stream + render tool card |
| `tool-renderer` | map tool → React | 1 chỗ duy nhất, xem `docs/04` |
| `file-version-list` | version + comment + approval | khoá version đã duyệt |
| `checklist-item` | onboarding | tiến độ + tài liệu đính kèm |
| `brand-swatch` | màu/font của brand vault | hiển thị token thương hiệu |

**Trạng thái bắt buộc cho mọi component có dữ liệu:** `loading` (skeleton), `empty`, `error`, `readonly` (khi không có quyền). Thiếu một trong bốn → chưa xong.

---

## 8. Keyboard-first (Linear-like)

```
⌘K / Ctrl+K   Command palette (điều hướng, hành động, hỏi AI)
G rồi T       Hôm nay        G rồi P   Dự án
G rồi O       Onboarding     G rồi B   Brand Home
/             Focus ô search
A             Duyệt (khi đang ở màn duyệt)     C   Bình luận
N             Mục mới (theo ngữ cảnh)          ⌘↵  Gửi / xác nhận
Esc           Đóng panel/dialog                ?   Danh sách phím tắt
J / K         Lên / xuống trong danh sách      ↵  Mở
```
Mọi hành động phải làm được **chỉ bằng bàn phím**. Focus ring: `outline: 2px solid var(--brand); outline-offset: 2px` — không bao giờ `outline: none` mà không có thay thế.

---

## 9. Accessibility (cứng, không thương lượng)

- Tương phản chữ ≥ **4.5:1** (kiểm bằng công cụ, không đoán). `--ink-3` trên `--surface` đạt ~4.6:1 — không dùng cho chữ dưới 12px.
- Mọi icon-only button có `aria-label`; mọi trạng thái màu có **kèm chữ hoặc shape** (không phân biệt chỉ bằng màu).
- Vùng chạm ≥ 32px (desktop) / 44px (mobile).
- Bảng dữ liệu dùng `<table>` thật với `<th scope>`; danh sách dùng `<ul>/<li>`.
- Thông báo động (approval xong, upload lỗi) qua `aria-live="polite"`.
- Không dùng `placeholder` thay `<label>`.

---

## 10. Checklist nhất quán (chạy trước khi kết thúc mỗi phase)

```
[ ] Sidebar/topbar giống nhau ở mọi màn hình
[ ] Chỉ 1 nút primary mỗi màn hình
[ ] Radius, spacing, font size đúng token (không có số lạ)
[ ] Trạng thái dùng đúng bảng map §1, không tự chế màu
[ ] Có đủ loading / empty / error / readonly
[ ] Không có câu chữ nào > 2 câu trong UI
[ ] Mọi CTA ≤ 3 từ và là động từ + danh từ
[ ] Điều hướng được hoàn toàn bằng bàn phím, focus nhìn thấy rõ
[ ] Dark mode không vỡ layout, không dùng shadow để phân tầng
[ ] Số/ngày/tiền đúng định dạng vi-VN và tabular-nums
```
