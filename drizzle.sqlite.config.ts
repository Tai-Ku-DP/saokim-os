import { defineConfig } from "drizzle-kit";

/**
 * Migration cho SQLite (dev + single-node). Khi chuyển sang Postgres, dùng
 * `drizzle.pg.config.ts` với cùng schema nhưng mirror bằng pg-core (docs/01 §8).
 */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/sqlite/schema.ts",
  out: "./drizzle/sqlite",
  dbCredentials: { url: process.env.SQLITE_PATH ?? "./data/app.db" },
  verbose: true,
  strict: true,
});
