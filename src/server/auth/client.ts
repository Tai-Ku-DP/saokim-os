"use client";

import { createAuthClient } from "better-auth/react";
import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  organizationClient,
} from "better-auth/client/plugins";

/**
 * Client better-auth. KHÔNG truyền `ac`/`roles` ở đây: tầng client không đánh giá
 * quyền (docs/03 §4 luật 2). Việc ẩn/hiện UI dựa trên context do server truyền xuống.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient(), adminClient(), emailOTPClient(), magicLinkClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
