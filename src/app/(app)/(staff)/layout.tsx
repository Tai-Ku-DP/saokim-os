import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth/guard";

/**
 * Khu vực nội bộ Sao Kim (docs/03 §3): khách hàng không bao giờ thấy
 * Inbox/Khách hàng/Báo cáo/Quản trị.
 *
 * Ở tầng layout ta **chuyển hướng** thay vì ném lỗi (trải nghiệm tốt hơn);
 * còn trong Server Action thì `requireStaff()` ném `ForbiddenError`.
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/sign-in");
  if (ctx.kind !== "staff") redirect("/today");
  return <>{children}</>;
}
