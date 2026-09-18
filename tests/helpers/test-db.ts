import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/db/sqlite/schema";

/**
 * DB SQLite in-memory với **migration thật** đã generate (drizzle/sqlite/*.sql).
 * Nhờ vậy test chạy trên đúng schema sẽ lên production, không phải schema mô phỏng.
 */
export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");

  const migrationsDir = path.join(process.cwd(), "drizzle", "sqlite");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    for (const statement of content.split("--> statement-breakpoint")) {
      const trimmed = statement.trim();
      if (trimmed) sqlite.exec(trimmed);
    }
  }

  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export type TestDb = ReturnType<typeof createTestDb>["db"];

/** Tạo nhanh một tổ chức + người dùng để test phạm vi dữ liệu. */
export async function seedOrgWithProject(
  db: TestDb,
  input: {
    orgId: string;
    orgName: string;
    userId: string;
    projectId: string;
    pmId?: string;
    role?: "owner" | "member";
    assignment?: "read" | "write" | "approve" | null;
  },
) {
  await db.insert(schema.organization).values({
    id: input.orgId,
    name: input.orgName,
    slug: input.orgId,
    createdAt: new Date(),
  });

  await db.insert(schema.user).values({
    id: input.userId,
    name: `Người dùng ${input.userId}`,
    email: `${input.userId}@example.com`,
    emailVerified: true,
    type: "client",
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(schema.member).values({
    id: `member_${input.userId}`,
    organizationId: input.orgId,
    userId: input.userId,
    role: input.role ?? "owner",
    createdAt: new Date(),
  });

  await db.insert(schema.project).values({
    id: input.projectId,
    organizationId: input.orgId,
    name: `Dự án ${input.projectId}`,
    projectType: "brand_identity",
    status: "active",
    pmId: input.pmId ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  if (input.assignment) {
    await db.insert(schema.projectMember).values({
      id: `pm_${input.userId}_${input.projectId}`,
      projectId: input.projectId,
      userId: input.userId,
      side: "client",
      access: input.assignment,
      createdAt: new Date(),
    });
  }
}
