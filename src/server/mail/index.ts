/**
 * MailPort — mọi email đi qua đây (docs/01 §4).
 * Dev: driver `console` in ra terminal. Sản xuất: driver `smtp` (chưa bật ở P2).
 * Không nơi nào khác trong code được gọi trực tiếp dịch vụ gửi mail.
 */

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface MailPort {
  send(message: MailMessage): Promise<void>;
}

const consoleDriver: MailPort = {
  async send(message) {
    // Không log nội dung nhạy cảm ở production — chỉ log khi dev.
    if (process.env.NODE_ENV === "production") return;
    console.info(
      `\n[mail:console] → ${message.to}\n  ${message.subject}\n  ${message.text.replace(/\n/g, "\n  ")}\n`,
    );
  },
};

const smtpDriver: MailPort = {
  async send() {
    throw new Error(
      "Mail driver 'smtp' chưa được cấu hình. Đặt MAIL_DRIVER=console cho dev, hoặc cài driver SMTP ở P7.",
    );
  },
};

function selectDriver(): MailPort {
  return (process.env.MAIL_DRIVER ?? "console") === "smtp" ? smtpDriver : consoleDriver;
}

export const mail: MailPort = selectDriver();

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  await mail.send({ to, subject, text });
}
