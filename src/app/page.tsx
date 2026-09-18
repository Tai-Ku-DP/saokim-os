import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth/viewer";
import { homeFor } from "@/lib/nav";

/** Vào app → về bề mặt mặc định theo vai trò (docs/03 §3). */
export default async function RootPage() {
  const viewer = await getViewer();
  redirect(homeFor(viewer.type));
}
