# Sao Kim BrandCare OS

Hệ điều hành chăm sóc & phát triển thương hiệu cho khách hàng Sao Kim Branding.
Sản phẩm thay thế PMS hiện tại, tổ chức theo 4 hub nghiệp vụ (Onboarding · Delivery · Growth · Retaining)
nhưng chỉ bày ra **3 bề mặt trải nghiệm**: **Hôm nay** · **Workroom** · **Brand Home**.

---

## Bắt đầu

```bash
cp .env.example .env.local     # điền BETTER_AUTH_SECRET, DEEPSEEK_API_KEY
npm install
npm run db:migrate             # (có sau P2)
npm run db:seed                # (có sau P2)
npm run dev                    # http://localhost:3000
```

> Nếu ổ đĩa chật hoặc npm không ghi được cache mặc định:
> `npm_config_cache=/tmp/npm-cache npm install` rồi xoá `/tmp/npm-cache` sau khi cài.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | chạy dev (Turbopack) |
| `npm run build` | build production — cũng là cổng chất lượng |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm test` | vitest |
| `npm run db:generate` / `db:migrate` / `db:studio` | drizzle-kit (SQLite) |
| `npm run db:seed` | seed dữ liệu demo tiếng Việt |
| `npm run outbox` | chạy dispatcher thông báo |

## Blueprint (đọc theo thứ tự)

| Tài liệu | Nội dung |
|---|---|
| [`docs/00-tu-duy-san-pham.md`](docs/00-tu-duy-san-pham.md) | Tư duy thiết kế sản phẩm: định vị, persona, 3 bề mặt, Signal→Action→Proof, quy tắc "ít chữ" |
| [`docs/01-tech-stack.md`](docs/01-tech-stack.md) | Tech stack + ADR + cấu trúc thư mục + 8 quy tắc portability DB + runbook Postgres |
| [`docs/02-design-system.md`](docs/02-design-system.md) | Design token, typography tiếng Việt, component, keyboard, a11y |
| [`docs/03-ia-va-phan-quyen.md`](docs/03-ia-va-phan-quyen.md) | Cây route, map màn hình PRD, mô hình phân quyền 2 tầng, guard |
| [`docs/04-ai-native.md`](docs/04-ai-native.md) | AI gateway, hợp đồng generative UI, catalog tool, guardrails, chi phí |
| [`docs/05-data-model.md`](docs/05-data-model.md) | ~24 bảng, quan hệ, index, bất biến nghiệp vụ |
| [`docs/06-lo-trinh-va-nghiem-thu.md`](docs/06-lo-trinh-va-nghiem-thu.md) | Phase 0–8, migration PMS, DoD, acceptance criteria → test ID, câu hỏi mở |
| [`AGENTS.md`](AGENTS.md) | Luật bắt buộc cho coding agent |

## Stack

```
Next.js 16.3.5 · React 19.3.0 · TypeScript 5 · Tailwind 4.3.3 · shadcn/ui 4.21 · lucide-react
Drizzle 0.45.2 + better-sqlite3 13  (→ Postgres sau, xem docs/01 §8)
better-auth 1.7.5 (organization + admin + emailOTP)
AI SDK 7.0.105 + @ai-sdk/deepseek 3.0.47 (generative UI bằng tool-calling)
```

## Trạng thái

| Phase | Nội dung | Trạng thái |
|---|---|---|
| P0 | Nền tảng: Next 16, token, shadcn, pin version | ✅ xong |
| P1 | Design system + app shell + ⌘K + light/dark | ✅ xong |
| P2 | Drizzle schema (39 bảng) + migration + seed + better-auth + RBAC 2 tầng + guard + login/invite | ✅ xong |
| P3 | Today · Projects · File review · Approvals · Handover | ✅ xong |
| P4 | Onboarding hub (template, checklist, brand brief, tài liệu, cổng kickoff) | ✅ xong |
| P5 | AI gateway + generative UI + 6 tính năng AI | ⏳ tiếp theo |
| P6 | Growth + Retaining (Brand Home) | ⏳ |
| P7 | Outbox/notification + n8n + dashboards | ⏳ |
| P8 | Hardening + a11y + runbook Postgres | ⏳ |

### Tài khoản demo (sau `npm run db:seed`)

| Email | Vai trò |
|---|---|
| `admin@saokim.vn` | Quản trị hệ thống |
| `minhanh@saokim.vn` | PM Sao Kim |
| `thuha@saokim.vn` / `gialinh@saokim.vn` / `hoangnam@saokim.vn` | Account / CS / Designer |
| `tung.vu@anphatland.vn` | Client Owner (được duyệt) |
| `vy.ngo@anphatland.vn` | Client Member (không được duyệt) |

Mật khẩu chung: **`BrandCare@2026`**. Khách hàng vào `/inbox|/clients|/reports|/admin`
sẽ bị chuyển về `/today`.
