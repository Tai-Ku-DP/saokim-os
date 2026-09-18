import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

/**
 * Toàn bộ endpoint của better-auth (sign-in, OTP, magic link, organization, admin).
 * Chỉ chạy ở Node.js runtime vì có better-sqlite3.
 */
export const runtime = "nodejs";

export const { GET, POST } = toNextJsHandler(auth);
