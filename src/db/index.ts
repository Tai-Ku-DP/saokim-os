import { db as sqliteDb, type SqliteDb } from "./sqlite/client";

/**
 * Điểm chọn driver duy nhất (docs/01 §3). Mọi service/repository import `db` từ đây,
 * không bao giờ import trực tiếp `./sqlite/client`.
 *
 * Khi chuyển sang Postgres (docs/01 §8): thêm `src/db/pg/client.ts`, đổi `AppDb`
 * thành union và chọn theo `DB_DRIVER`.
 */
export type AppDb = SqliteDb;

function selectDb(): AppDb {
  const driver = process.env.DB_DRIVER ?? "sqlite";
  if (driver !== "sqlite") {
    throw new Error(
      `DB_DRIVER="${driver}" chưa được triển khai. Xem runbook Postgres trong docs/01 §8.`,
    );
  }
  return sqliteDb;
}

export const db: AppDb = selectDb();

export { sqliteDb };
