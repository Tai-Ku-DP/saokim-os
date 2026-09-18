import "server-only";

import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { notificationOutbox } from "@/db/sqlite/schema";
import { sendMail } from "@/server/mail";
import { deliverEmail, deliverInApp, resolveRecipients, type OutboxPayload } from ".";
import { webhook } from "./webhook";

/**
 * Xử lý outbox — tách khỏi script để TEST được toàn bộ luồng retry/backoff/idempotency
 * (script `scripts/outbox-worker.ts` chỉ là vỏ mỏng).
 */

export const MAX_ATTEMPTS = 5;
export const DEFAULT_BATCH = 25;

export type OutboxRow = typeof notificationOutbox.$inferSelect;

/** Backoff: 2^attempts phút. attempts=1 → 2 phút, 2 → 4 phút… */
export function nextAttemptAt(attempts: number, now = Date.now()): Date {
  return new Date(now + 2 ** attempts * 60_000);
}

export async function dispatchRow(row: OutboxRow): Promise<string> {
  const payload = {
    ...(row.payload as OutboxPayload),
    organizationId: row.organizationId,
  } as { kind: string; organizationId: string } & Record<string, unknown>;

  switch (row.channel) {
    case "inapp": {
      const drafts = await resolveRecipients(payload);
      const created = await deliverInApp(drafts);
      return `in-app ${created} thông báo`;
    }

    case "email": {
      const drafts = await resolveRecipients(payload);
      if (drafts.length > 0) {
        const sent = await deliverEmail(drafts);
        return `email ${sent}`;
      }
      const to = typeof payload.to === "string" ? payload.to : null;
      if (to) {
        await sendMail(to, String(payload.subject ?? "BrandCare"), JSON.stringify(payload));
        return "email 1 (địa chỉ trực tiếp)";
      }
      return "email 0 (không có người nhận)";
    }

    case "webhook":
    case "zalo":
      await webhook.send(payload);
      return row.channel === "zalo" ? "zalo qua n8n" : "webhook n8n";

    default:
      return `bỏ qua kênh ${row.channel}`;
  }
}

export type OutboxRunResult = {
  processed: number;
  sent: number;
  failed: number;
  details: string[];
};

/** Chạy một lượt: lấy các bản ghi đến hạn, gửi, cập nhật trạng thái. */
export async function processDueOutbox(limit = DEFAULT_BATCH): Promise<OutboxRunResult> {
  const due = await db
    .select()
    .from(notificationOutbox)
    .where(
      and(
        eq(notificationOutbox.status, "pending"),
        or(
          isNull(notificationOutbox.nextAttemptAt),
          lte(notificationOutbox.nextAttemptAt, new Date()),
        ),
      ),
    )
    .orderBy(asc(notificationOutbox.createdAt))
    .limit(limit);

  let sent = 0;
  let failed = 0;
  const details: string[] = [];

  for (const row of due) {
    try {
      const detail = await dispatchRow(row);
      db.transaction((tx) => {
        tx.update(notificationOutbox)
          .set({
            status: "sent",
            sentAt: new Date(),
            attempts: row.attempts + 1,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(eq(notificationOutbox.id, row.id))
          .run();
      });
      sent += 1;
      details.push(`sent ${row.channel} ${row.idempotencyKey}: ${detail}`);
    } catch (error) {
      failed += 1;
      const attempts = row.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);

      db.transaction((tx) => {
        tx.update(notificationOutbox)
          .set({
            status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts,
            lastError: message.slice(0, 300),
            nextAttemptAt: nextAttemptAt(attempts),
            updatedAt: new Date(),
          })
          .where(eq(notificationOutbox.id, row.id))
          .run();
      });
      details.push(`fail ${row.idempotencyKey} (lần ${attempts}): ${message}`);
    }
  }

  return { processed: due.length, sent, failed, details };
}
