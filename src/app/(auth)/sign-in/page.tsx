import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth/guard";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function SignInPage() {
  const ctx = await getAuthContext();
  if (ctx) redirect("/");

  return <SignInForm />;
}
