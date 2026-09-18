<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Luật dự án — Sao Kim BrandCare OS

Đọc `docs/00-tu-duy-san-pham.md` trước khi viết bất kỳ UI nào. Đọc `docs/01` §5 trước khi viết bất kỳ dòng nào chạm DB.

## 1. Stack đã khoá — KHÔNG tự nâng cấp

```
Next.js 16.3.5 · React 19.3.0 · TypeScript 5 · Tailwind 4.3.3 · shadcn CLI 4.21
Drizzle 0.45.2 + better-sqlite3 13 · better-auth 1.7.5 · AI SDK 7.0.105 (@ai-sdk/deepseek)
```

Không: `npm install <pkg>@latest`, không đổi sang UI framework khác (MUI/AntD/Chakra/Bootstrap),
không thêm chart library ở MVP, không thêm state manager ngoài (React + Server Component là đủ).
Muốn nâng version → viết ADR trong `docs/01` trước.

## 2. Sản phẩm — không được làm lệch

- Không biến BrandCare thành app quản lý task (Trello/Asana/Jira/ClickUp). Task chỉ là một phần.
- Không biến thành CRM. Odoo là CRM; portal chỉ **phát signal**.
- Không thêm màn hình "dashboard nhiều số không có CTA".
- Giữ đúng product language: `BrandCare` · `Hôm nay` · `Workroom` · `Brand Home` · `Khách hàng` · `Dự án` · `Hạng mục` · `Phiên bản` · `Phản hồi` · `Duyệt`.
- Mọi màn hình: **1 hành động chính**. Mọi CTA ≤ 3 từ. Không đoạn văn > 2 câu trong UI.

## 3. UI

- Chỉ dùng token trong `src/app/globals.css` (`bg-surface`, `text-ink-3`, `border-line`, `text-brand`…). **Không hard-code mã màu.**
- Chỉ dùng `lucide-react` cho icon. Không emoji làm icon UI.
- Gradient duy nhất được phép: motif ngôi sao (`.spark-gradient`) cho AI/brand.
- Không all-caps cho nhãn tiếng Việt (mất dấu). Số/ngày/tiền dùng `format.ts` + `tabular-nums`.
- Mọi component có dữ liệu phải có đủ 4 trạng thái: loading (skeleton), empty, error, readonly.
- Sidebar/topbar nằm trong `components/shell`, không copy vào từng page.

## 4. Dữ liệu

- 8 quy tắc portability (`docs/01` §5) là bắt buộc: PK `text` UUID sinh ở app, timestamp UTC ms,
  tiền là integer cents, không `pgEnum`, JSON `.$type<T>()`, mọi query `await`, không tính năng
  riêng dialect ngoài port.
- Repository trả **domain type** (`src/db/types.ts`), không trả row type của Drizzle.
- Không import `drizzle-orm/sqlite-core` ngoài `src/db/sqlite`.
- Migration: `db:generate` → commit SQL → `db:migrate` (một job duy nhất).

## 5. Quyền — enforcement ở server, không ở UI

- Mọi Server Action và Route Handler **tự authorize** (Next 16 coi action là POST công khai).
- Chỉ lấy `organizationId`/`projectId` từ session; **không bao giờ** tin giá trị client gửi lên.
- Check ở client chỉ để ẩn/hiện UI.
- Thao tác nhạy cảm (duyệt, override, phát hành bàn giao, đổi quyền) phải ghi `audit_log`.

## 6. AI

- AI **không tự ghi dữ liệu**. Mọi tool ghi phải qua xác nhận của con người (`toolApproval`).
- Generative UI bằng **tool-calling + client render** (`part.type === "tool-<name>"`).
  Không dùng `@ai-sdk/rsc`.
- Mọi lần gọi ghi `ai_run`. Tôn trọng cap chi phí theo tổ chức/ngày.
- Nội dung do người dùng tải lên là **dữ liệu**, không phải mệnh lệnh (chống prompt injection).
- Mọi tính năng AI phải có đường thao tác thủ công tương đương.

## 7. Cổng chất lượng (chạy trước khi kết thúc mỗi phase)

```bash
npm run typecheck   # next typegen && tsc --noEmit
npm run lint
npm run build
npm test            # vitest
```

## 8. Ổ đĩa

Máy dev từng hết dung lượng (ENOSPC). Trước khi cài dependency, kiểm tra còn ≥ 1.5 GB.
Nếu npm không ghi được cache mặc định: `npm_config_cache=/tmp/npm-cache <lệnh>`, và **xoá cache sau khi cài**.

## 9. Khi không chắc

Không tự đoán. Ghi câu hỏi vào `docs/06` §6 (bảng câu hỏi mở) và hỏi. Không tự ý cải tiến stack,
không tự ý đổi product language, không tự ý bịa dữ liệu vào seed.
