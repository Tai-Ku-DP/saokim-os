import { eq } from "drizzle-orm";
import { db } from "@/db";
import { fileAsset, fileVersion } from "@/db/sqlite/schema";
import { assertProjectAccess } from "@/server/auth/project-access";
import { getAuthContext } from "@/server/auth/guard";
import { storage } from "@/server/storage";

/**
 * Tải một phiên bản tệp — có kiểm tra quyền theo dự án trước khi đọc storage.
 * Route Handler không được cache và luôn chạy ở Node runtime (better-sqlite3).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ versionId: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response("Cần đăng nhập", { status: 401 });

  const { versionId } = await context.params;

  const rows = await db
    .select({
      storageKey: fileVersion.storageKey,
      versionNumber: fileVersion.versionNumber,
      fileName: fileAsset.name,
      projectId: fileAsset.projectId,
      visibility: fileAsset.visibility,
      mime: fileAsset.mime,
    })
    .from(fileVersion)
    .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
    .where(eq(fileVersion.id, versionId))
    .limit(1);

  const row = rows[0];
  if (!row) return new Response("Không tìm thấy phiên bản", { status: 404 });

  try {
    await assertProjectAccess(ctx, row.projectId, "read");
  } catch {
    return new Response("Không có quyền", { status: 403 });
  }

  if (ctx.kind === "client" && row.visibility === "internal") {
    return new Response("Không có quyền", { status: 403 });
  }

  try {
    const data = await storage.get(row.storageKey);
    const safeName = `${row.fileName}-v${row.versionNumber}`.replace(/[^\w.\-]+/g, "_");

    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": row.mime ?? "application/octet-stream",
        "content-disposition": `attachment; filename="${safeName}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("Tệp không còn trong kho lưu trữ", { status: 410 });
  }
}
