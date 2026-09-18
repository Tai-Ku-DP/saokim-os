import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { aiDriver, DEFAULT_MODEL_ID, hasApiKey, modelFor } from "@/ai/client";
import { resolveBillingOrgId } from "@/ai/billing-org";
import { logAiRun, withinBudget } from "@/ai/cost";
import { systemPrompt, type PromptKey } from "@/ai/prompts";
import { buildTools } from "@/ai/tools";
import { getAuthContext } from "@/server/auth/guard";

/**
 * AI gateway (docs/04 §2). Chạy ở Node runtime (better-sqlite3) và luôn lấy ngữ cảnh
 * từ session — không nhận organizationId từ client.
 *
 * Chế độ `mock` chỉ dùng khi chưa cấu hình API key (dev/test): model được thay bằng
 * bộ chọn ý định tất định, nhưng tool vẫn chạy THẬT trên dữ liệu đã scope. Nhờ vậy
 * luồng generative UI kiểm chứng được mà không cần gọi mạng.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatBody = {
  messages: UIMessage[];
  surface?: PromptKey;
};

const SUGGESTIONS: { match: RegExp; tool: string; text: string }[] = [
  { match: /hôm nay|làm gì|việc/i, tool: "showTodayActions", text: "Đây là việc cần xử lý hôm nay." },
  { match: /rủi ro|chăm sóc|im lặng|trễ/i, tool: "showRisks", text: "Các điểm cần chú ý." },
  { match: /dự án/i, tool: "showProjects", text: "Tình trạng dự án hiện tại." },
  { match: /phản hồi|góp ý|sửa/i, tool: "summarizeFeedback", text: "Phản hồi cần xử lý." },
  { match: /duyệt/i, tool: "showApprovals", text: "Yêu cầu duyệt đang chờ." },
];

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return new Response("Cần đăng nhập", { status: 401 });

  const body = (await request.json()) as ChatBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const promptKey: PromptKey = body.surface ?? "general.v1";
  const feature = promptKey.replace(/\.v\d+$/, "");
  const modelId = DEFAULT_MODEL_ID;

  const billingOrgId = await resolveBillingOrgId(ctx);

  if (!(await withinBudget(billingOrgId))) {
    await logAiRun({
      organizationId: billingOrgId,
      userId: ctx.userId,
      feature,
      provider: "gateway",
      model: modelId,
      status: "capped",
      error: "Vượt hạn mức chi phí AI trong ngày",
    });

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          const textId = "cap";
          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta: "Đã đạt hạn mức AI hôm nay. Bạn vẫn làm được mọi việc bằng thao tác thủ công.",
          });
          writer.write({ type: "text-end", id: textId });
        },
      }),
    });
  }

  const tools = buildTools(ctx);
  const driver = aiDriver();
  const startedAt = Date.now();

  if (driver === "mock") {
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: async ({ writer }) => {
          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const text = extractText(lastUser);
          const picked = SUGGESTIONS.find((s) => s.match.test(text));
          const textId = "mock-text";

          writer.write({ type: "text-start", id: textId });
          writer.write({
            type: "text-delta",
            id: textId,
            delta: hasApiKey()
              ? ""
              : "(chế độ demo — chưa cấu hình DEEPSEEK_API_KEY) ",
          });
          writer.write({
            type: "text-delta",
            id: textId,
            delta: picked?.text ?? "Mình có thể xem việc hôm nay, rủi ro, dự án hoặc phản hồi.",
          });
          writer.write({ type: "text-end", id: textId });

          if (picked) {
            const toolEntry = (tools as Record<string, unknown>)[picked.tool] as
              | { execute?: (input: never) => Promise<unknown> }
              | undefined;
            const toolCallId = `mock-${picked.tool}`;
            const input = pickInput(picked.tool, text);

            writer.write({
              type: "tool-input-available",
              toolCallId,
              toolName: picked.tool,
              input,
            });

            try {
              const output = toolEntry?.execute
                ? await toolEntry.execute(input as never)
                : { note: "tool chỉ để hiển thị" };
              writer.write({ type: "tool-output-available", toolCallId, output });
            } catch (error) {
              writer.write({
                type: "tool-output-error",
                toolCallId,
                errorText: error instanceof Error ? error.message : "Lỗi khi lấy dữ liệu",
              });
            }
          }

          await logAiRun({
            organizationId: billingOrgId,
            userId: ctx.userId,
            feature,
            provider: "mock",
            model: "mock",
            status: "ok",
            latencyMs: Date.now() - startedAt,
          });
        },
      }),
    });
  }

  const result = streamText({
    model: modelFor(modelId),
    instructions: systemPrompt(promptKey),
    messages: await convertToModelMessages(messages),
    stopWhen: isStepCount(4),
    tools,
    onEnd: async (event) => {
      const usage = event.usage ?? { inputTokens: 0, outputTokens: 0 };
      await logAiRun({
        organizationId: billingOrgId,
        userId: ctx.userId,
        feature,
        provider: "deepseek",
        model: modelId,
        status: "ok",
        usage: {
          inputTokens: Number(usage.inputTokens ?? 0),
          outputTokens: Number(usage.outputTokens ?? 0),
        },
        latencyMs: Date.now() - startedAt,
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}

function extractText(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

/** Chọn tham số cho tool trong chế độ demo (không có model để quyết định). */
function pickInput(toolName: string, text: string): Record<string, unknown> {
  const projectId = process.env.AI_MOCK_PROJECT_ID ?? "seed_project_identity";
  if (toolName === "summarizeFeedback" || toolName === "showApprovals") {
    void text;
    return { projectId };
  }
  return {};
}
