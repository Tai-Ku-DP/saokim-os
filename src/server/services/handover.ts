import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLog,
  fileAsset,
  fileVersion,
  handoverItem,
  handoverPackage,
  project,
} from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";
import { assertProjectAccess } from "@/server/auth/project-access";
import { DomainError } from "./errors";
import { enqueueInTx } from "./outbox";

/**
 * Bàn giao (PRD §9 DEL-010). Bất biến §6.9: chỉ thêm mục khi bộ bàn giao
 * chưa được phát hành (`released`).
 */

export type HandoverItemRow = {
  id: string;
  label: string;
  note: string | null;
  fileName: string | null;
  versionNumber: number | null;
};

export type HandoverView = {
  id: string | null;
  status: "preparing" | "ready" | "released" | "none";
  releasedAt: Date | null;
  notes: string | null;
  items: HandoverItemRow[];
  /** Phiên bản đã duyệt có thể đưa vào bộ bàn giao. */
  approvedVersions: {
    versionId: string;
    fileId: string;
    fileName: string;
    versionNumber: number;
  }[];
};

export async function getHandover(ctx: AuthContext, projectId: string): Promise<HandoverView> {
  await assertProjectAccess(ctx, projectId, "read");

  const packages = await db
    .select()
    .from(handoverPackage)
    .where(eq(handoverPackage.projectId, projectId))
    .limit(1);

  const pkg = packages[0];

  const items = pkg
    ? await db
        .select({
          id: handoverItem.id,
          label: handoverItem.label,
          note: handoverItem.note,
          fileName: fileAsset.name,
          versionNumber: fileVersion.versionNumber,
        })
        .from(handoverItem)
        .leftJoin(fileAsset, eq(handoverItem.fileId, fileAsset.id))
        .leftJoin(fileVersion, eq(handoverItem.versionId, fileVersion.id))
        .where(eq(handoverItem.handoverId, pkg.id))
        .orderBy(asc(handoverItem.orderIndex))
    : [];

  const approvedVersions = await db
    .select({
      versionId: fileVersion.id,
      fileId: fileAsset.id,
      fileName: fileAsset.name,
      versionNumber: fileVersion.versionNumber,
    })
    .from(fileVersion)
    .innerJoin(fileAsset, eq(fileVersion.fileId, fileAsset.id))
    .where(
      and(
        eq(fileAsset.projectId, projectId),
        eq(fileVersion.status, "approved"),
        isNull(fileAsset.deletedAt),
      ),
    )
    .orderBy(asc(fileAsset.name));

  return {
    id: pkg?.id ?? null,
    status: pkg?.status ?? "none",
    releasedAt: pkg?.releasedAt ?? null,
    notes: pkg?.notes ?? null,
    items,
    approvedVersions,
  };
}

/** Tạo bộ bàn giao (nếu chưa có) và thêm các phiên bản đã duyệt vào đó. */
export async function prepareHandover(ctx: AuthContext, projectId: string): Promise<void> {
  const access = await assertProjectAccess(ctx, projectId, "write");
  const view = await getHandover(ctx, projectId);
  if (view.status === "released") {
    throw new DomainError("HANDOVER_RELEASED", "Bộ bàn giao đã phát hành, không sửa được");
  }

  db.transaction((tx) => {
    const handoverId =
      view.id ??
      tx
        .insert(handoverPackage)
        .values({ projectId, status: "preparing" })
        .returning({ id: handoverPackage.id })
        .get().id;

    const existing = new Set(view.items.map((i) => i.label));
    view.approvedVersions.forEach((version, index) => {
      const label = `${version.fileName} v${version.versionNumber}`;
      if (existing.has(label)) return;
      tx.insert(handoverItem)
        .values({
          handoverId,
          fileId: version.fileId,
          versionId: version.versionId,
          label,
          orderIndex: index + 1,
        })
        .run();
    });

    tx.update(handoverPackage)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(handoverPackage.id, handoverId))
      .run();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: "handover.prepared",
        entity: "handover_package",
        entityId: handoverId,
        after: { items: view.approvedVersions.length },
      })
      .run();
  });
}

/** Phát hành: chuyển trạng thái released + thông báo cho khách (qua outbox). */
export async function releaseHandover(ctx: AuthContext, projectId: string): Promise<void> {
  const access = await assertProjectAccess(ctx, projectId, "approve");
  const view = await getHandover(ctx, projectId);
  if (!view.id) throw new DomainError("HANDOVER_EMPTY", "Chưa có bộ bàn giao để phát hành");
  if (view.items.length === 0) {
    throw new DomainError("HANDOVER_EMPTY", "Bộ bàn giao chưa có mục nào");
  }
  if (view.status === "released") {
    throw new DomainError("HANDOVER_RELEASED", "Bộ bàn giao đã được phát hành");
  }

  const handoverId = view.id;

  db.transaction((tx) => {
    tx.update(handoverPackage)
      .set({ status: "released", releasedAt: new Date(), releasedBy: ctx.userId, updatedAt: new Date() })
      .where(eq(handoverPackage.id, handoverId))
      .run();

    tx.update(project)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(project.id, projectId))
      .run();

    tx.insert(auditLog)
      .values({
        organizationId: access.organizationId,
        actorId: ctx.userId,
        action: "handover.released",
        entity: "handover_package",
        entityId: handoverId,
        after: { projectId },
      })
      .run();

    enqueueInTx(tx, {
      organizationId: access.organizationId,
      channel: "email",
      idempotencyKey: `handover-released:${handoverId}`,
      payload: { kind: "handover_released", projectId, handoverId },
    });
  });
}
