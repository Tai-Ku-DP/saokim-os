import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organization } from "@/db/sqlite/schema";
import type { AuthContext } from "@/server/auth/access";

/**
 * Tổ chức dùng để tính hạn mức chi phí AI và gắn log `ai_run`.
 * Khách hàng → chính công ty họ. Nhân sự Sao Kim → một tổ chức nội bộ.
 */
export const INTERNAL_ORG_ID = "org_saokim_internal";

export async function resolveBillingOrgId(ctx: AuthContext): Promise<string> {
  if (ctx.kind === "client") return ctx.organizationId;

  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, INTERNAL_ORG_ID))
    .limit(1);

  if (rows[0]) return INTERNAL_ORG_ID;

  await db
    .insert(organization)
    .values({
      id: INTERNAL_ORG_ID,
      name: "Sao Kim Branding",
      slug: "saokim-internal",
      createdAt: new Date(),
    })
    .onConflictDoNothing({ target: organization.id });

  return INTERNAL_ORG_ID;
}
