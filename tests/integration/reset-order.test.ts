import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { RESET_ORDER } from "@/db/reset-order";
import {
  approval,
  auditLog,
  checklistItem,
  documentRequest,
  fileAsset,
  fileVersion,
  handoverItem,
  handoverPackage,
  notificationOutbox,
  onboardingChecklist,
  organization,
  project,
  user,
} from "@/db/sqlite/schema";

/**
 * Chống tái phát lỗi thật: `delete from file_asset` từng thất bại
 * (`FOREIGN KEY constraint failed`) vì `checklist_item.file_id` được thêm bằng
 * `ALTER TABLE` nên SQLite không gắn `ON DELETE SET NULL`.
 *
 * Test này dựng dữ liệu tham chiếu chéo rồi xoá ĐÚNG theo `RESET_ORDER`
 * (với `foreign_keys = ON`) — sai thứ tự sẽ fail ngay tại đây, không phải lúc user reset.
 */

const ORG = "org_reset";
const PROJECT = "project_reset";

async function seedCrossReferences() {
  for (const table of RESET_ORDER) {
    await db.run(sql.raw(`delete from "${table}"`));
  }

  await db.insert(user).values({
    id: "u_reset",
    name: "Người dùng",
    email: "reset@x.vn",
    emailVerified: true,
    type: "client",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(organization).values({
    id: ORG,
    name: "Công ty Reset",
    slug: "reset",
    createdAt: new Date(),
  });
  await db.insert(project).values({
    id: PROJECT,
    organizationId: ORG,
    name: "Dự án Reset",
    projectType: "website",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(onboardingChecklist).values({
    id: "chk_reset",
    projectId: PROJECT,
    templateKey: "website",
    status: "in_progress",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(fileAsset).values({
    id: "f_reset",
    projectId: PROJECT,
    name: "Tệp của mục checklist",
    kind: "document",
    storageKey: "reset/f",
    visibility: "client",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(fileVersion).values({
    id: "v_reset",
    fileId: "f_reset",
    versionNumber: 1,
    storageKey: "reset/f/v1",
    status: "in_review",
    createdAt: new Date(),
  });
  await db.update(fileAsset).set({ currentVersionId: "v_reset" }).where(sql`${fileAsset.id} = 'f_reset'`);

  // Cột `file_id` của checklist_item là FK được thêm bằng ALTER TABLE (không có ON DELETE).
  await db.insert(checklistItem).values({
    id: "ci_reset",
    checklistId: "chk_reset",
    key: "content",
    label: "Nội dung",
    required: true,
    ownerSide: "client",
    status: "submitted",
    fileId: "f_reset",
    submittedAt: new Date(),
    orderIndex: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Các bảng khác cũng tham chiếu tới file/project để thử thứ tự.
  await db.insert(documentRequest).values({
    id: "dr_reset",
    projectId: PROJECT,
    label: "Tài liệu",
    status: "received",
    fileId: "f_reset",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(approval).values({
    id: "ap_reset",
    versionId: "v_reset",
    projectId: PROJECT,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(handoverPackage).values({
    id: "hp_reset",
    projectId: PROJECT,
    status: "preparing",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(handoverItem).values({
    id: "hi_reset",
    handoverId: "hp_reset",
    fileId: "f_reset",
    versionId: "v_reset",
    label: "Bàn giao",
    orderIndex: 1,
    createdAt: new Date(),
  });
  await db.insert(notificationOutbox).values({
    id: "no_reset",
    organizationId: ORG,
    channel: "inapp",
    payload: { kind: "test" },
    status: "pending",
    idempotencyKey: "reset-test",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(auditLog).values({
    id: "al_reset",
    organizationId: ORG,
    action: "test",
    entity: "test",
    createdAt: new Date(),
  });
}

describe("thứ tự reset dữ liệu (RESET_ORDER)", () => {
  beforeEach(seedCrossReferences);

  it("dữ liệu tham chiếu chéo đã được dựng đúng (tiền đề của test)", async () => {
    const assets = await db.select().from(fileAsset);
    const items = await db.select().from(checklistItem);
    expect(assets).toHaveLength(1);
    expect(items[0]?.fileId).toBe("f_reset");
  });

  it("xoá theo RESET_ORDER không vi phạm khoá ngoại (foreign_keys = ON)", async () => {
    // sqlite đã bật foreign_keys=ON trong src/db/sqlite/client.ts
    for (const table of RESET_ORDER) {
      await db.run(sql.raw(`delete from "${table}"`));
    }

    for (const table of RESET_ORDER) {
      const rows = await db.run(sql.raw(`select count(*) as c from "${table}"`));
      void rows;
    }

    // Kiểm tra vài bảng trọng tâm đã sạch
    expect(await db.select().from(fileAsset)).toHaveLength(0);
    expect(await db.select().from(checklistItem)).toHaveLength(0);
    expect(await db.select().from(user)).toHaveLength(0);
    expect(await db.select().from(organization)).toHaveLength(0);
  });

  it("checklist_item phải đứng TRƯỚC file_asset trong danh sách", () => {
    const checkItem = RESET_ORDER.indexOf("checklist_item");
    const fileAssetIdx = RESET_ORDER.indexOf("file_asset");
    expect(checkItem).toBeGreaterThanOrEqual(0);
    expect(fileAssetIdx).toBeGreaterThanOrEqual(0);
    expect(checkItem).toBeLessThan(fileAssetIdx);
  });

  it("mọi bảng đều xuất hiện đúng một lần", () => {
    expect(new Set(RESET_ORDER).size).toBe(RESET_ORDER.length);
  });
});
