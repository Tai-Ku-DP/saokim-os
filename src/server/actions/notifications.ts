"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/server/auth/guard";
import { markAllRead, markNotificationRead } from "@/server/notifications";

export async function markNotificationReadAction(formData: FormData): Promise<void> {
  const ctx = await requireSession();
  const id = String(formData.get("notificationId") ?? "");
  if (!id) return;

  await markNotificationRead(ctx, id);
  revalidatePath("/notifications");
}

export async function markAllReadAction(): Promise<void> {
  const ctx = await requireSession();
  await markAllRead(ctx);
  revalidatePath("/notifications");
}
