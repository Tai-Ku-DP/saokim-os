import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { invitation, organization } from "@/db/sqlite/schema";

/**
 * Dữ liệu cho màn hình nhận lời mời.
 *
 * Việc tính `expired` nằm ở đây (không phải trong component) để component thuần
 * khi render — tránh gọi hàm không tinh khiết trong thân component.
 */
export type InvitationView = {
  email: string;
  status: string;
  organizationName: string;
  expired: boolean;
};

export async function getInvitationView(invitationId: string): Promise<InvitationView | null> {
  const rows = await db
    .select({
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationName: organization.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(invitation.organizationId, organization.id))
    .where(eq(invitation.id, invitationId))
    .limit(1);

  const found = rows[0];
  if (!found) return null;

  return {
    email: found.email,
    status: found.status,
    organizationName: found.organizationName,
    expired: found.expiresAt.getTime() < Date.now(),
  };
}
