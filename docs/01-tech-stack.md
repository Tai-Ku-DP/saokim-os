# 01 — Tech stack & kiến trúc kỹ thuật

> Xác minh version ngày **2026-09-18** từ npm registry. Mọi version trong bảng là **pin cứng** — không nâng nếu không có lý do ghi trong ADR.

---

## 1. Stack đã chốt

### Runtime & framework
| Thành phần | Version | Ghi chú |
|---|---|---|
| Node.js | **≥ 22** (dev: 26.9.0) | AI SDK 7 yêu cầu ≥22, Better Auth CLI ≥22.12 |
| Next.js | **16.3.5** | App Router, `--src-dir`, Turbopack mặc định cho cả dev & build |
| React / React DOM | **19.3.0** | create-next-app sinh 19.2.8 → đã nâng tay |
| TypeScript | **5.x** | `strict: true` |
| React Compiler | `babel-plugin-react-compiler@1.0.0`, `reactCompiler: true` | mặc định của scaffold 16 |

### UI
| Thành phần | Version | Ghi chú |
|---|---|---|
| Tailwind CSS | **4.3.3** | không có `tailwind.config.js`; token khai báo trong CSS |
| `@tailwindcss/postcss` | **4.3.3** | **phải trùng version với `tailwindcss`**, nếu lệch sẽ lỗi build |
| shadcn/ui | CLI **4.21.0** | source component trong `src/components/ui` |
| lucide-react | **1.47.0** | icon duy nhất được dùng |
| class-variance-authority / clsx / tailwind-merge | 0.7.1 / 2.1.1 / 3.7.0 | nền của shadcn |
| tw-animate-css | 1.4.0 | thay `tailwindcss-animate` ở Tailwind v4 |
| Chart | **không dùng lib** ở MVP | SVG nội bộ cho sparkline/bar; chỉ cân nhắc `recharts` khi có màn analytics thật |

### Dữ liệu & xác thực
| Thành phần | Version | Ghi chú |
|---|---|---|
| Drizzle ORM | **0.45.2** | 2 dialect: `sqlite-core` hôm nay, `pg-core` khi migrate |
| drizzle-kit | **0.31.10** | `generate` → commit SQL → `migrate` |
| better-sqlite3 | **13.0.3** | driver SQLite (đồng bộ, Node runtime) |
| better-auth | **1.7.5** + `@better-auth/drizzle-adapter` 1.7.5 | peer khớp `drizzle-orm ^0.45.2`, `next ^16`, `react ^19` |
| zod | **4.6.5** | validation; chú ý API v4 dùng `{ error: ... }` thay `{ message: ... }` |

### AI
| Thành phần | Version | Ghi chú |
|---|---|---|
| `ai` | **7.0.105** | ESM-only, `instructions` (không còn `system`), `inputSchema`, `isStepCount` |
| `@ai-sdk/deepseek` | **3.0.47** | provider mặc định |
| `@ai-sdk/react` | **4.0.108** | `useChat` + transport |
| Provider dự phòng | `@ai-sdk/openai@4.0.69`, `@ai-sdk/google@4.0.74` | cắm thêm bằng config, không sửa code nghiệp vụ |

### Kiểm thử & script
| Thành phần | Version | Ghi chú |
|---|---|---|
| Vitest | **5.0.1** | unit: domain, permission, repository (SQLite in-memory **chạy migration thật**) |
| tsx | **4.23.13** | chạy script TS ngoài Next (`scripts/seed.ts`, `scripts/outbox-worker.ts`) |
| server-only | 0.0.1 | chặn import module server vào client |
| Playwright | 1.63.0 *(Phase 3)* | dùng `channel: "chrome"` để **không tải browser** (tiết kiệm ~400MB đĩa) |

**Quy tắc `server-only`:** đặt ở tầng service/guard (`src/server/**`), **không** đặt trong
`src/db/sqlite/client.ts` hay `src/server/auth/index.ts` — better-auth CLI phải load được
hai module này để sinh schema. Xem §6.

---

## 2. ADR (Architecture Decision Records)

**ADR-001 — Next.js 16 App Router, không dùng Pages Router.**
Server Component + Server Action cho phép authorize ở tầng dữ liệu, giảm API layer tự viết. Đánh đổi: `cookies()/headers()/params` đều async; `middleware.ts` đã đổi thành `proxy.ts`.

**ADR-002 — SQLite (Drizzle) trước, Postgres sau.**
Chốt theo yêu cầu: chạy thật được ngay, không cần hạ tầng. Điều kiện để đổi sang Postgres chỉ là *schema + client*, nhờ 8 quy tắc portability ở §5. **Hệ quả bắt buộc:** mọi ID là `text` UUID sinh ở app — đây là quyết định khiến việc migrate chỉ còn là copy dữ liệu, không phải re-key.

**ADR-003 — Better Auth, một instance, hai tầng quyền.**
Một bảng `user` + `user.type = internal | client`; plugin `admin` cho nhân sự Sao Kim (admin/pm/account/cs/designer/management), plugin `organization` cho khách hàng (mỗi công ty = 1 org, role `owner`/`member`). Lý do: một migration graph, một luồng session, plugin đã tách sẵn hai không gian permission. Đánh đổi: cô lập hoàn toàn phải enforce ở app code — nên **mọi** Server Action đều đi qua `guard.ts`.

**ADR-004 — AI SDK 7 + DeepSeek, generative UI bằng tool-calling.**
`streamText` + tool có `inputSchema`; client render theo `part.type === 'tool-<name>'`. Không dùng `ai/rsc` (`streamUI`) vì chính docs AI SDK ghi *"experimental, recommend AI SDK UI for production"*. Abstraction bằng `createProviderRegistry` → thêm OpenAI/Gemini chỉ là thêm key + 1 dòng registry.

**ADR-005 — Storage sau một port.**
`StoragePort` với driver `local` (dev) và stub `s3` / `gdrive-link`. PRD §24 còn để mở câu hỏi lưu file, nên không được để đường dẫn file rò vào domain.

**ADR-006 — Không chart library ở MVP.**
Giảm ~400KB bundle và một dependency dễ vỡ với React 19. Dashboard MVP chỉ cần progress + sparkline SVG.

**ADR-007 — npm, không pnpm.**
Máy không có pnpm; thêm package manager là rủi ro không cần thiết. npm 11 đủ nhanh cho repo đơn.

---

## 3. Cấu trúc thư mục

```
saokim-os/
├── AGENTS.md                     # luật cho coding agent (đọc trước khi sửa code)
├── docs/                         # 00..06 — blueprint
├── drizzle.sqlite.config.ts      # config drizzle-kit cho SQLite
├── drizzle.pg.config.ts          # config cho Postgres (dùng khi migrate)
├── drizzle/sqlite/               # migration SQL đã generate (commit)
├── data/app.db                   # DB dev (gitignore)
├── .data/uploads/                # file dev (gitignore)
├── scripts/
│   ├── seed.ts                   # seed dữ liệu demo
│   ├── outbox-worker.ts          # dispatcher notification
│   └── copy-sqlite-to-pg.ts      # migrate dữ liệu (P8)
└── src/
    ├── app/
    │   ├── (auth)/               # sign-in, accept-invitation
    │   ├── (app)/                # bề mặt khách hàng + staff dùng chung shell
    │   │   ├── today/  projects/[projectId]/{overview,files,feedback,approvals,handover}
    │   │   ├── onboarding/  growth/  brand-vault/  notifications/  settings/
    │   │   └── (staff)/inbox/  (staff)/admin/  (staff)/reports/
    │   ├── api/auth/[...all]/route.ts
    │   ├── api/ai/chat/route.ts
    │   └── globals.css           # design token
    ├── components/
    │   ├── ui/                   # shadcn (generated)
    │   ├── shell/                # sidebar, topbar, command-palette
    │   ├── ai/                   # ai-panel, tool-renderer
    │   └── domain/                # component nghiệp vụ
    ├── db/
    │   ├── types.ts              # domain type (không phụ thuộc dialect)
    │   ├── ports.ts              # interface Repositories
    │   ├── index.ts              # chọn driver theo env
    │   ├── sqlite/{client,schema,relations,repository}.ts
    │   └── pg/                   # stub, viết khi migrate
    ├── server/
    │   ├── auth/{index,permissions,guard,client}.ts
    │   ├── services/             # nghiệp vụ thuần
    │   ├── actions/              # Server Action (mỏng, chỉ validate + gọi service)
    │   └── dto/                  # shape trả ra UI
    ├── ai/{client,registry,prompts,tools,renderers,guardrails,cost}.ts
    └── lib/{utils,format,keyboard}.ts
```

**Luật phụ thuộc (không được vi phạm):**
```
app/ → server/actions → server/services → db/ports
components/ → dto (không bao giờ import trực tiếp từ db/sqlite)
ai/ → db/ports (đọc dữ liệu qua service, không query thô)
db/sqlite, db/pg: chỉ được import bởi db/index.ts
```

---

## 4. Biến môi trường

```dotenv
# App
APP_URL=http://localhost:3000
NODE_ENV=development

# Auth (better-auth)
BETTER_AUTH_SECRET=            # openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:3000

# Database
DB_DRIVER=sqlite               # sqlite | pg
SQLITE_PATH=./data/app.db
DATABASE_URL=                  # chỉ dùng khi DB_DRIVER=pg

# AI
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash  # hoặc deepseek-v4-pro
AI_DAILY_COST_CAP_USD=5        # cap theo org/ngày
OPENAI_API_KEY=                # tùy chọn
GOOGLE_GENERATIVE_AI_API_KEY=  # tùy chọn

# Storage & notify
STORAGE_DRIVER=local           # local | s3 | gdrive-link
MAIL_DRIVER=console            # console | smtp
SMTP_URL=
N8N_WEBHOOK_URL=               # đẩy signal sang n8n → Zalo/Odoo
```

---

## 5. Tám quy tắc portability DB (bắt buộc từ dòng code đầu tiên)

1. PK: `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())`. **Không** autoincrement, **không** `serial`.
2. Timestamp: SQLite `integer('x', { mode: 'timestamp_ms' })`, PG `timestamp('x', { withTimezone: true })`; app luôn thấy `Date`, luôn UTC.
3. Tiền: integer đơn vị nhỏ nhất (`amount_cents`) + cột `currency`. Không float.
4. Boolean: `integer({ mode: 'boolean' })` / `boolean()`. Không sentinel `0/1` trong domain.
5. JSON: `.$type<T>()` ở cả hai phía. Không `json_extract` ngoài port.
6. Enum: **không** `pgEnum`; dùng `text({ enum: [...] })` (type-level) và giữ enum ở domain layer.
7. Mọi truy vấn đều `await` (better-sqlite3 sync nhưng libsql/pg async) → repository viết async từ đầu.
8. Tính năng riêng dialect (FTS5, `strftime`, `GLOB`, `tsvector`) chỉ nằm sau một port có tên.

---

## 6. Lệnh chuẩn

```bash
npm run dev            # next dev (Turbopack)
npm run build          # next build (Turbopack) — cũng là cổng chất lượng
npm run typecheck      # next typegen && tsc --noEmit  (LayoutProps/PageProps do Next sinh)
npm run lint           # eslint (next lint đã bị bỏ ở Next 16)
npm run db:generate    # sinh migration từ schema
npm run db:migrate     # áp migration
npm run db:seed        # seed dữ liệu demo (idempotent; -- --reset để tạo lại)
npm test               # vitest
npm run outbox         # chạy dispatcher notification (dev)
```

**Sinh lại schema better-auth** (sau khi thêm/bớt plugin — nếu không, endpoint của plugin sẽ 500):

```bash
npx auth@1.7.5 generate --adapter drizzle --dialect sqlite \
  --output src/db/sqlite/auth-schema.ts --config src/server/auth/index.ts -y
npm run db:generate && npm run db:migrate
```

> File `src/db/sqlite/auth-schema.ts` do CLI sinh, **không sửa tay**. CLI dùng
> `timestamp_ms` (khớp quy tắc portability §5) và tự thêm index/FK cần thiết.

> Nếu npm không ghi được cache mặc định: thêm `npm_config_cache=/tmp/npm-cache` trước lệnh.

---

## 7. Ràng buộc vận hành của SQLite (đọc trước khi deploy)

- Chỉ chạy ở **Node.js runtime**, không Edge. Route chạm DB cần `export const runtime = 'nodejs'`.
- Bật pragma ở `db/sqlite/client.ts`: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`, `synchronous=NORMAL`.
- Một writer tại một thời điểm; worker outbox là nơi dễ tranh chấp nhất.
- Dev HMR: giữ connection trong `globalThis` để không rò handle.
- Backup: `VACUUM INTO 'backup-<date>.db'` theo lịch; không `cp` khi đang ghi.
- **Vercel/serverless: file SQLite cục bộ KHÔNG chạy được** (filesystem chỉ đọc, `/tmp` là tạm thời). Nếu deploy serverless → chuyển Turso (giữ `sqlite-core`) hoặc Postgres trước. Mặc định MVP: Docker/Node host.

---

## 8. Runbook đổi sang Postgres (mục tiêu: 1 PR, 1 buổi chiều)

1. Viết `src/db/pg/{client,schema,relations,repository}.ts` — mirror schema sqlite **từng cột một** theo 8 quy tắc §5.
2. `npm run db:generate` với `drizzle.pg.config.ts` → commit `drizzle/pg/*` → `migrate` lên một nhánh Neon/Supabase trống.
3. `scripts/copy-sqlite-to-pg.ts`: đọc bằng repo sqlite, ghi bằng repo pg, batch 500–2000 dòng, một transaction mỗi batch, thứ tự FK. ID giữ nguyên vì là UUID sinh ở app.
4. Chạy bộ integration test với `DB_DRIVER=pg` trên môi trường preview.
5. Freeze ghi → copy → đếm số dòng từng bảng → đổi `DB_DRIVER=pg` → giữ file SQLite + bản `VACUUM INTO` làm rollback.

Sau đó xoá `db/sqlite` chỉ khi đã chạy production ổn định ≥ 1 sprint.
