import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Chuẩn bị môi trường test TRƯỚC khi module ứng dụng được import:
 *  - `SQLITE_PATH` trỏ vào file tạm riêng cho từng worker
 *  - `STORAGE_LOCAL_ROOT` trỏ vào thư mục tạm
 *  - áp toàn bộ migration đã generate (drizzle/sqlite/*.sql)
 *
 * Nhờ vậy test chạy trên đúng schema production, không phải schema mô phỏng.
 */

const worker = process.env.VITEST_WORKER_ID ?? String(process.pid);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `brandcare-test-${worker}-`));

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = env.NODE_ENV ?? "test";
env.SQLITE_PATH = path.join(tmpRoot, "app.db");
env.STORAGE_LOCAL_ROOT = path.join(tmpRoot, "uploads");
env.STORAGE_DRIVER = "local";
env.MAIL_DRIVER = "console";
env.BETTER_AUTH_SECRET = "test-secret-for-vitest-only";
env.BETTER_AUTH_URL = "http://localhost:3000";

const migrationsDir = path.join(process.cwd(), "drizzle", "sqlite");
const sqlite = new Database(process.env.SQLITE_PATH);
sqlite.pragma("foreign_keys = ON");

for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  for (const statement of content.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
}
sqlite.close();
