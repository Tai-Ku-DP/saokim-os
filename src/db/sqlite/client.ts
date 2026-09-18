import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/**
 * Kết nối SQLite (docs/01 §7).
 *
 * - Chỉ chạy ở Node.js runtime, không Edge.
 * - Pragma bắt buộc: WAL (đọc/ghi song song), busy_timeout (tránh SQLITE_BUSY),
 *   foreign_keys (mặc định TẮT trong SQLite), synchronous NORMAL (an toàn với WAL).
 * - Giữ connection trong `globalThis` để HMR của dev không rò handle.
 *
 * KHÔNG import "server-only" ở đây: better-auth CLI phải load được module này để
 * sinh schema. Chặn client-import được đặt ở tầng service/action và guard.ts.
 */

const dbPath = process.env.SQLITE_PATH ?? "./data/app.db";

function createConnection() {
  const dir = path.dirname(dbPath);
  if (dir && dir !== "." && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("wal_autocheckpoint = 1000");

  return drizzle(sqlite, { schema });
}

export type SqliteDb = ReturnType<typeof createConnection>;

const globalForDb = globalThis as unknown as { __brandcareDb?: SqliteDb };

export const db: SqliteDb = globalForDb.__brandcareDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__brandcareDb = db;
}

export { schema };
