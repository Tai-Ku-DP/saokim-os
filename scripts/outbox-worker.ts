/**
 * Outbox dispatcher (PRD §15, docs/05 §6.8).
 *
 *   npm run outbox              # chạy một lượt rồi thoát (dùng cho cron)
 *   npm run outbox -- --watch   # chạy liên tục mỗi 30s
 *
 * Logic nằm ở `src/server/notifications/dispatch.ts` để test được; file này chỉ là vỏ.
 */
import { processDueOutbox } from "../src/server/notifications/dispatch";

const WATCH_INTERVAL_MS = 30_000;

async function main() {
  const watch = process.argv.includes("--watch");
  const quiet = process.argv.includes("--quiet");

  const first = await processDueOutbox();
  if (!quiet) {
    for (const detail of first.details) console.info(detail);
    console.info(`Outbox: xử lý ${first.processed}, gửi ${first.sent}, lỗi ${first.failed}`);
  }

  if (!watch) return;

  console.info(`Outbox: chạy liên tục mỗi ${WATCH_INTERVAL_MS / 1000}s (Ctrl+C để dừng)`);
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, WATCH_INTERVAL_MS));
    try {
      const result = await processDueOutbox();
      if (result.processed > 0) {
        for (const detail of result.details) console.info(detail);
      }
    } catch (error) {
      console.error("Outbox: lượt chạy lỗi:", error);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Outbox thất bại:", error);
    process.exit(1);
  });
