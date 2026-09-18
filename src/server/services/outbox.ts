import "server-only";

import { db } from "@/db";
import { notificationOutbox } from "@/db/sqlite/schema";

/**
 * Outbox (docs/05 §6.8): mọi thông báo ra ngoài (email/Zalo/webhook) được ghi vào
 * `notification_outbox` **trong cùng transaction** với hành động nghiệp vụ, rồi worker
 * `scripts/outbox-worker.ts` gửi sau. Nhờ vậy không mất thông báo khi gửi lỗi.
 *
 * `idempotencyKey` unique để một hành động chỉ sinh một thông báo dù retry.
 */

export type OutboxChannel = "email" | "zalo" | "webhook" | "inapp";

export type EnqueueInput = {
  organizationId: string;
  channel: OutboxChannel;
  /** phải ổn định giữa các lần retry, ví dụ `approval-requested:<approvalId>` */
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Dùng trong transaction đồng bộ của better-sqlite3. */
export function enqueueInTx(tx: Tx, input: EnqueueInput): void {
  tx.insert(notificationOutbox)
    .values({
      organizationId: input.organizationId,
      channel: input.channel,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({ target: notificationOutbox.idempotencyKey })
    .run();
}

/** Ngoài transaction (ví dụ job định kỳ). */
export async function enqueue(input: EnqueueInput): Promise<void> {
  await db
    .insert(notificationOutbox)
    .values({
      organizationId: input.organizationId,
      channel: input.channel,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({ target: notificationOutbox.idempotencyKey });
}

/** Bất biến nghiệp vụ quan trọng nào cũng nên để lại vết (NFR AuditLog). */
export type AuditInput = {
  organizationId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
};
