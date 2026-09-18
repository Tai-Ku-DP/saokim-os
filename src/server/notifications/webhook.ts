import "server-only";

/**
 * WebhookPort — đẩy signal sang n8n (rồi n8n mới gọi Zalo OA / Odoo CRM).
 * Portal KHÔNG gọi trực tiếp Zalo hay Odoo (docs/01 §4, PRD §16): mọi tích hợp đi qua
 * một cửa duy nhất để dễ kiểm soát, retry và thay đổi.
 */

export type WebhookPayload = {
  kind: string;
  organizationId: string;
  [key: string]: unknown;
};

export interface WebhookPort {
  send(payload: WebhookPayload & Record<string, unknown>): Promise<void>;
}

const n8nDriver: WebhookPort = {
  async send(payload) {
    const url = process.env.N8N_WEBHOOK_URL;
    if (!url) {
      // Chưa cấu hình n8n ở môi trường dev → coi như đã xử lý, không làm worker kẹt.
      if (process.env.NODE_ENV === "production") {
        throw new Error("N8N_WEBHOOK_URL chưa cấu hình");
      }
      return;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.N8N_WEBHOOK_SECRET
          ? { "x-brandcare-secret": process.env.N8N_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify({ source: "brandcare-os", sentAt: new Date().toISOString(), ...payload }),
    });

    if (!response.ok) {
      throw new Error(`n8n trả về ${response.status}`);
    }
  },
};

export const webhook: WebhookPort = n8nDriver;
