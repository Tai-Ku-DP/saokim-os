import { createDeepSeek } from "@ai-sdk/deepseek";
import { createProviderRegistry } from "ai";

/**
 * AI gateway (docs/04 §2). DeepSeek là provider mặc định; thêm OpenAI/Google sau này
 * chỉ cần thêm key + một dòng trong registry, KHÔNG sửa code nghiệp vụ.
 *
 * Model id nằm trong env (`DEEPSEEK_MODEL`), không hard-code — DeepSeek đổi tên model
 * giữa các phiên bản (deepseek-chat/reasoner → deepseek-flash/v4-pro).
 */

export const AI_PROVIDERS = ["deepseek"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

function buildRegistry() {
  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY ?? "missing-key",
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
  });

  return createProviderRegistry({ deepseek });
}

export const registry = buildRegistry();

export const DEFAULT_MODEL_ID = `deepseek:${process.env.DEEPSEEK_MODEL ?? "deepseek-flash"}`;

export type AiDriver = "deepseek" | "mock";

/**
 * `mock` chỉ dùng cho test/demo khi chưa có API key — KHÔNG bao giờ bật ở production.
 * Không có key và không bật mock → route trả lỗi rõ ràng thay vì trả lời giả.
 */
export function aiDriver(): AiDriver {
  const configured = process.env.AI_DRIVER;
  if (configured === "mock") return "mock";
  if (configured === "deepseek") return "deepseek";
  return process.env.DEEPSEEK_API_KEY ? "deepseek" : "mock";
}

export function hasApiKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function modelFor(modelId: string) {
  // Model id đến từ env nên registry không suy ra được literal type — ép về dạng
  // `deepseek:<model>` (registry tự báo lỗi nếu provider không tồn tại lúc chạy).
  return registry.languageModel(modelId as `deepseek:${string}`);
}
