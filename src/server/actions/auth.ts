"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { invitation } from "@/db/sqlite/schema";
import { auth } from "@/server/auth";
import { getAuthContext } from "@/server/auth/guard";

/**
 * Server Action cho xác thực. Next 16 coi mọi Server Action là endpoint POST công khai
 * → mọi action ở đây đều tự kiểm tra điều kiện của nó (docs/03 §4 luật 1).
 */

export type AuthActionState = {
  error?: string;
  message?: string;
};

const emailSchema = z.email({ error: "Email không hợp lệ" });
const passwordSchema = z
  .string()
  .min(8, { error: "Mật khẩu tối thiểu 8 ký tự" });

export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({ email: emailSchema, password: passwordSchema })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  try {
    await auth.api.signInEmail({
      body: { email: parsed.data.email, password: parsed.data.password },
      headers: await headers(),
    });
  } catch {
    // Không tiết lộ email có tồn tại hay không.
    return { error: "Email hoặc mật khẩu không đúng" };
  }

  redirect("/");
}

export async function sendLoginOtp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Email không hợp lệ" };

  try {
    await auth.api.sendVerificationOTP({
      body: { email: parsed.data, type: "sign-in" },
    });
  } catch {
    return { error: "Không gửi được mã. Thử lại" };
  }

  return { message: "Đã gửi mã 6 số tới email của bạn" };
}

export async function signInWithOtp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = z
    .object({ email: emailSchema, otp: z.string().regex(/^\d{6}$/, { error: "Mã gồm 6 số" }) })
    .safeParse({ email: formData.get("email"), otp: formData.get("otp") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  try {
    await auth.api.signInEmailOTP({
      body: { email: parsed.data.email, otp: parsed.data.otp },
      headers: await headers(),
    });
  } catch {
    return { error: "Mã không đúng hoặc đã hết hạn" };
  }

  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}

/**
 * Nhận lời mời vào không gian làm việc của khách hàng, rồi đặt tổ chức đó làm active.
 * Yêu cầu: đã đăng nhập và email trùng với email được mời (better-auth tự kiểm tra).
 */
export async function acceptInvitationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return { error: "Lời mời không hợp lệ" };

  const ctx = await getAuthContext();
  if (!ctx) {
    redirect(`/sign-in?next=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`);
  }

  const rows = await db
    .select({ organizationId: invitation.organizationId })
    .from(invitation)
    .where(eq(invitation.id, invitationId))
    .limit(1);

  const target = rows[0];
  if (!target) return { error: "Lời mời không tồn tại hoặc đã bị huỷ" };

  try {
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    });
    await auth.api.setActiveOrganization({
      body: { organizationId: target.organizationId },
      headers: await headers(),
    });
  } catch {
    return { error: "Không nhận được lời mời. Kiểm tra email đăng nhập" };
  }

  redirect("/today");
}
