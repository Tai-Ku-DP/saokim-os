import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { emailOTP } from "better-auth/plugins/email-otp";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "../../db/sqlite/client";
import * as schema from "../../db/sqlite/schema";
import { sendMail } from "../mail";
import { ADMIN_ROLE_KEYS, ac, clientRoles, isStaffRole, staffRoles } from "./permissions";

/**
 * better-auth 1.7.5 — một instance, một bảng `user`, hai tầng quyền (ADR-003).
 *
 * KHÔNG import "server-only" ở file này: better-auth CLI cần load được nó để sinh
 * schema (`npx auth generate --adapter drizzle`). Việc chặn client-import được bảo
 * đảm bởi chính better-auth (nó không nằm trong bundle client) và bởi các trang
 * `/sign-in` gọi qua Server Action.
 */

const devSecret = "dev-only-insecure-secret-change-me";

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === "production" ? undefined : devSecret),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    // Lời mời qua email OTP/magic link; khách hàng không tự đăng ký công khai.
    requireEmailVerification: false,
    minPasswordLength: 8,
  },

  user: {
    additionalFields: {
      /**
       * `internal` = nhân sự Sao Kim, `client` = người dùng khách hàng.
       * Không cho client set giá trị này (`input: false`) — chỉ hook bên dưới quyết định.
       */
      type: {
        type: "string",
        required: false,
        defaultValue: "client",
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          const role = (newUser as { role?: string }).role;
          const type = isStaffRole(role) ? "internal" : "client";
          return { data: { ...newUser, type } };
        },
      },
    },
  },

  plugins: [
    // Khách hàng: mỗi công ty là một organization.
    organization({
      ac,
      roles: clientRoles,
      creatorRole: "owner",
      invitationExpiresIn: 60 * 60 * 48,
      async sendInvitationEmail(data) {
        const url = `${process.env.APP_URL ?? "http://localhost:3000"}/accept-invitation/${data.id}`;
        await sendMail(
          data.email,
          `Lời mời tham gia ${data.organization.name} trên BrandCare`,
          `Bạn được mời tham gia không gian làm việc của ${data.organization.name}.\nMở liên kết để bắt đầu: ${url}`,
        );
      },
    }),

    // Nhân sự Sao Kim: role toàn cục + ban/impersonate cho hỗ trợ.
    admin({
      ac,
      roles: staffRoles,
      adminRoles: ADMIN_ROLE_KEYS,
    }),

    // Đăng nhập không mật khẩu cho khách hàng được mời.
    emailOTP({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,
      storeOTP: "hashed",
      resendStrategy: "rotate",
      async sendVerificationOTP({ email, otp, type }) {
        const purpose =
          type === "sign-in"
            ? "Đăng nhập BrandCare"
            : type === "forget-password"
              ? "Đặt lại mật khẩu BrandCare"
              : "Xác thực email BrandCare";
        await sendMail(email, purpose, `Mã xác thực của bạn: ${otp}\nMã hết hạn sau 5 phút.`);
      },
    }),

    magicLink({
      expiresIn: 300,
      storeToken: "hashed",
      async sendMagicLink({ email, url }) {
        await sendMail(email, "Liên kết đăng nhập BrandCare", `Mở liên kết để đăng nhập: ${url}`);
      },
    }),

    // Phải đặt CUỐI để cookie của better-auth được ghi qua next/headers.
    nextCookies(),
  ],
});

export type Auth = typeof auth;
