"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AiContextProvider, useAiContext } from "@/components/ai/use-ai-write";
import { ToolRenderer } from "@/components/ai/tool-renderer";
import type { PromptKey } from "@/ai/prompts";

/**
 * Panel trợ lý AI. Câu trả lời của model render thành CARD (generative UI), không phải
 * khối văn bản dài (docs/04 §1). Mọi tool ghi đều cần người dùng xác nhận.
 */

const SUGGESTIONS = [
  { label: "Hôm nay làm gì?", prompt: "Hôm nay tôi cần làm gì?" },
  { label: "Rủi ro cần chú ý", prompt: "Có rủi ro nào cần chú ý?" },
  { label: "Tình trạng dự án", prompt: "Tình trạng các dự án hiện tại?" },
  { label: "Phản hồi cần xử lý", prompt: "Phản hồi nào cần xử lý?" },
];

export function AiPanel({
  surface = "general.v1",
  projectId,
  canWrite,
  demo,
}: {
  surface?: PromptKey;
  projectId?: string;
  canWrite: boolean;
  demo: boolean;
}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat", body: { surface } }),
  });

  const busy = status === "streaming" || status === "submitted";

  function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    sendMessage({ text: value });
    setInput("");
  }

  return (
    <AiContextProvider value={{ canWrite, projectId }}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <span className="spark-gradient grid size-5 place-items-center rounded">
            <Sparkles size={11} className="text-white" aria-hidden />
          </span>
          <span className="text-[13px] font-semibold text-ink">Trợ lý</span>
          {demo ? (
            <Badge variant="outline" className="border-amber/40 font-normal text-amber">
              demo
            </Badge>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="grid gap-2">
              <p className="text-[12px] text-ink-3">Hỏi nhanh:</p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <Button
                    key={s.label}
                    size="xs"
                    variant="outline"
                    onClick={() => submit(s.prompt)}
                    disabled={busy}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className="grid gap-2">
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  if (!part.text.trim()) return null;
                  return (
                    <p
                      key={index}
                      className={
                        message.role === "user"
                          ? "justify-self-end rounded-lg bg-brand-soft px-2.5 py-1.5 text-[12.5px] text-brand-ink"
                          : "text-[12.5px] leading-5 text-ink"
                      }
                    >
                      {part.text}
                    </p>
                  );
                }

                if (part.type === "reasoning") return null;

                if (part.type.startsWith("tool-")) {
                  return <ToolRenderer key={index} part={part as never} />;
                }

                if (part.type.startsWith("data-")) return null;

                return null;
              })}
            </div>
          ))}

          {error ? (
            <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-[12px] text-danger">
              Không gọi được trợ lý. Kiểm tra DEEPSEEK_API_KEY và thử lại.
            </p>
          ) : null}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
          className="border-t border-line p-3"
        >
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  submit(input);
                }
              }}
              rows={2}
              placeholder="Hỏi về dự án, tệp, phản hồi…"
              className="min-h-8 resize-none text-[12.5px]"
            />
            <Button type="submit" size="icon-sm" disabled={busy || input.trim().length === 0} aria-label="Gửi">
              <ArrowUp size={14} aria-hidden />
            </Button>
          </div>
          <p className="mt-1.5 text-[10.5px] text-ink-3">
            Trợ lý chỉ đề xuất — bạn xác nhận trước khi hệ thống ghi dữ liệu.
          </p>
        </form>
      </div>
    </AiContextProvider>
  );
}

/** Nút mở panel — dùng ở topbar. */
export function AiHint() {
  const { canWrite } = useAiContext();
  return <span className="text-[11px] text-ink-3">{canWrite ? "" : "chỉ đọc"}</span>;
}
