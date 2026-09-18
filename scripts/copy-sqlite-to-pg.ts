/**
 * Chuyển dữ liệu SQLite → Postgres (docs/01 §8).
 *
 *   npm run pg:dry-run     # đếm số dòng mỗi bảng theo thứ tự FK — chạy được ngay, không cần PG
 *   npm run pg:copy        # copy thật (cần DATABASE_URL + driver `pg`)
 *
 * Vì sao ID giữ nguyên được: mọi khoá chính là UUID sinh ở app (docs/01 §5 quy tắc 1),
 * nên không phải re-key, không phải resync sequence.
 */
import Database from "better-sqlite3";

/**
 * Thứ tự an toàn với khoá ngoại: bảng cha trước, bảng con sau.
 * Đây cũng là thứ tự copy thật.
 */
const TABLE_ORDER = [
  "organization",
  "user",
  "company_profile",
  "member",
  "invitation",
  "session",
  "account",
  "verification",
  "service_package",
  "project",
  "project_member",
  "onboarding_checklist",
  "checklist_item",
  "brand_brief",
  "file_asset",
  "file_version",
  "document_request",
  "milestone",
  "task",
  "feedback",
  "approval",
  "meeting_note",
  "issue_log",
  "handover_package",
  "handover_item",
  "brand_asset",
  "brand_guideline",
  "brand_scan_result",
  "brand_health_snapshot",
  "growth_recommendation",
  "service_request",
  "opportunity",
  "notification",
  "notification_outbox",
  "interaction_event",
  "audit_log",
  "ai_run",
  "ai_feedback",
] as const;

const BATCH_SIZE = 1000;

type Counts = { table: string; rows: number };

function countRows(sqlite: Database.Database): Counts[] {
  const existing = new Set(
    sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name),
  );

  return TABLE_ORDER.filter((table) => existing.has(table)).map((table) => ({
    table,
    rows: Number(
      (sqlite.prepare(`select count(*) as c from "${table}"`).get() as { c: number }).c,
    ),
  }));
}

async function dryRun() {
  const path = process.env.SQLITE_PATH ?? "./data/app.db";
  const sqlite = new Database(path, { readonly: true });

  const counts = countRows(sqlite);
  const total = counts.reduce((sum, row) => sum + row.rows, 0);

  console.info(`Nguồn: ${path}`);
  console.info("Bảng".padEnd(26) + "Số dòng");
  for (const row of counts) {
    console.info(row.table.padEnd(26) + String(row.rows));
  }
  console.info("─".repeat(34));
  console.info("Tổng".padEnd(26) + String(total));
  console.info(`\nThứ tự copy trên đã an toàn với khoá ngoại. Batch size: ${BATCH_SIZE}.`);

  sqlite.close();
  return counts;
}

async function copy() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Thiếu DATABASE_URL. Xem runbook docs/01 §8 (bước 1–5) trước khi chạy copy thật.",
    );
  }

  // Nạp driver qua biến để không buộc dự án cài `pg` khi chưa migrate.
  const driverName = "pg";
  let pgModule: { Pool: new (options: { connectionString: string }) => PgPool };
  try {
    pgModule = (await import(driverName)) as typeof pgModule;
  } catch {
    throw new Error(
      "Chưa cài driver Postgres. Chạy: npm install pg && npm install -D @types/pg",
    );
  }

  const path = process.env.SQLITE_PATH ?? "./data/app.db";
  const sqlite = new Database(path, { readonly: true });
  const counts = countRows(sqlite);
  const pool = new pgModule.Pool({ connectionString: url });

  for (const { table, rows } of counts) {
    if (rows === 0) {
      console.info(`• ${table}: 0 dòng — bỏ qua`);
      continue;
    }

    const columns = (
      sqlite.prepare(`pragma table_info("${table}")`).all() as { name: string }[]
    ).map((column) => column.name);

    let copied = 0;
    for (let offset = 0; offset < rows; offset += BATCH_SIZE) {
      const batch = sqlite
        .prepare(`select * from "${table}" limit ? offset ?`)
        .all(BATCH_SIZE, offset) as Record<string, unknown>[];

      const values: unknown[] = [];
      const placeholders = batch.map((row) => {
        const slots = columns.map((column) => {
          values.push(row[column]);
          return `$${values.length}`;
        });
        return `(${slots.join(", ")})`;
      });

      const statement = `insert into "${table}" (${columns
        .map((column) => `"${column}"`)
        .join(", ")}) values ${placeholders.join(", ")} on conflict do nothing`;

      await pool.query(statement, values);
      copied += batch.length;
    }

    console.info(`• ${table}: ${copied}/${rows} dòng`);
  }

  await pool.end();
  sqlite.close();
  console.info("\nCopy xong. Bước tiếp theo: đối chiếu số dòng, rồi đổi DB_DRIVER=pg.");
}

type PgPool = {
  query(text: string, values?: unknown[]): Promise<unknown>;
  end(): Promise<void>;
};

async function main() {
  const mode = process.argv.includes("--copy") ? "copy" : "dry-run";
  if (mode === "dry-run") {
    await dryRun();
    return;
  }
  await copy();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("✗", error instanceof Error ? error.message : error);
    process.exit(1);
  });
