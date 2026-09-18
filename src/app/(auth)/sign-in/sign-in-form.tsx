"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  sendLoginOtp,
  signInWithOtp,
  signInWithPassword,
  type AuthActionState,
} from "@/server/actions/auth";

const EMPTY: AuthActionState = {};

export function SignInForm() {
  const [pwState, signInPw, pwPending] = useActionState(signInWithPassword, EMPTY);
  const [otpState, sendOtp, sendPending] = useActionState(sendLoginOtp, EMPTY);
  const [verifyState, verifyOtp, verifyPending] = useActionState(signInWithOtp, EMPTY);
  const [otpEmail, setOtpEmail] = useState("");

  return (
    <div className="card p-5">
      <h1 className="text-[15px] font-semibold text-ink">Đăng nhập</h1>
      <p className="mt-0.5 text-[12px] text-ink-3">Dùng tài khoản Sao Kim cấp cho bạn.</p>

      <Tabs defaultValue="password" className="mt-4">
        <TabsList className="w-full">
          <TabsTrigger value="password" className="flex-1">
            Mật khẩu
          </TabsTrigger>
          <TabsTrigger value="otp" className="flex-1">
            Mã email
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="mt-4">
          <form action={signInPw} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {pwState.error ? (
              <Alert variant="destructive">
                <AlertDescription>{pwState.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" disabled={pwPending}>
              {pwPending ? "Đang vào…" : "Đăng nhập"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="otp" className="mt-4">
          <div className="grid gap-3">
            <form action={sendOtp} className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="otp-email">Email</Label>
                <Input
                  id="otp-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={otpEmail}
                  onChange={(event) => setOtpEmail(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" variant="outline" disabled={sendPending}>
                {sendPending ? "Đang gửi…" : "Gửi mã"}
              </Button>
            </form>

            {otpState.message ? (
              <Alert>
                <AlertDescription>{otpState.message}</AlertDescription>
              </Alert>
            ) : null}
            {otpState.error ? (
              <Alert variant="destructive">
                <AlertDescription>{otpState.error}</AlertDescription>
              </Alert>
            ) : null}

            <form action={verifyOtp} className="grid gap-3">
              <input type="hidden" name="email" value={otpEmail} />
              <div className="grid gap-1.5">
                <Label htmlFor="otp">Mã 6 số</Label>
                <Input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="tnum tracking-[0.3em]"
                  required
                />
              </div>
              {verifyState.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{verifyState.error}</AlertDescription>
                </Alert>
              ) : null}
              <Button type="submit" disabled={verifyPending}>
                {verifyPending ? "Đang kiểm tra…" : "Vào BrandCare"}
              </Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
