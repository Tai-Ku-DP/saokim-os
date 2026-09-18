import "server-only";

import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiRun } from "@/db/sqlite/schema";

/**
 * Ghi log mọi lần gọi AI + cap chi phí theo tổ chức/ngày (docs/04 §6).
 *
 * Chi phí lưu bằng **micro-USD** (integer) để không dùng số thực cho tiền — cùng
 * nguyên tắc với `amount_cents` trong docs/05.
 */

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
};

/** Đơn giá DeepSeek flash 2026 (USD / 1M token) — đổi ở đây khi giá thay đổi. */
export const PRICING = {
  "deepseek-flash": { input: 0.15, output: 0.6 },
  "deepseek-v4-pro": { input: 0.66, output: 1.98 },
} as const;

export function estimateCostMicros(modelId: string, usage: AiUsage): number {
  const key = modelId.split(":").pop() ?? "deepseek-flash";
  const price = PRICING[key as keyof typeof PRICING] ?? PRICING["deepseek-flash"];
  const usd =
    (usage.inputTokens / 1_000_000) * price.input +
    (usage.outputTokens / 1_000_000) * price.output;
  return Math.round(usd * 1_000_000);
}

export function costCapMicros(): number {
  const usd = Number(process.env.AI_DAILY_COST_CAP_USD ?? "5");
  return Math.round((Number.isFinite(usd) ? usd : 5) * 1_000_000);
}

export function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Tổng chi phí của một tổ chức trong ngày (UTC). */
export async function spentTodayMicros(organizationId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${aiRun.costUsd}), 0)` })
    .from(aiRun)
    .where(and(eq(aiRun.organizationId, organizationId), gte(aiRun.createdAt, startOfUtcDay())));

  return Number(rows[0]?.total ?? 0);
}

export async function withinBudget(organizationId: string): Promise<boolean> {
  const spent = await spentTodayMicros(organizationId);
  return spent < costCapMicros();
}

export type AiRunInput = {
  organizationId: string;
  userId: string | null;
  feature: string;
  provider: string;
  model: string;
  status: "ok" | "error" | "capped";
  usage?: AiUsage;
  latencyMs?: number;
  error?: string;
};

/**
 * Ghi log KHÔNG lưu nội dung prompt/response (chỉ metadata) — tránh rò dữ liệu
 * khách hàng vào log (docs/04 §7).
 */
export async function logAiRun(input: AiRunInput): Promise<string> {
  const usage = input.usage ?? { inputTokens: 0, outputTokens: 0 };

  const rows = await db
    .insert(aiRun)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      status: input.status,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: input.status === "ok" ? estimateCostMicros(input.model, usage) : 0,
      latencyMs: input.latencyMs ?? 0,
      error: input.error ?? null,
    })
    .returning({ id: aiRun.id });

  return rows[0]!.id;
}
