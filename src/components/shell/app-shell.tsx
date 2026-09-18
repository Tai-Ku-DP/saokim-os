import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { Topbar } from "@/components/shell/topbar";
import { getViewer } from "@/server/auth/viewer";
import { getAuthContext } from "@/server/auth/guard";
import { can } from "@/server/auth/access";
import { aiDriver } from "@/ai/client";
import { unreadCount as unreadNotifications } from "@/server/notifications";

/**
 * Khung ứng dụng dùng chung cho mọi màn hình trong (app):
 *   Topbar
 *   ├── Sidebar  └── Main
 * Không copy sidebar/topbar vào từng page (docs/02 §7).
 *
 * Quyền dùng tool ghi của AI được tính ở SERVER rồi truyền xuống panel — client
 * không bao giờ tự suy ra quyền (docs/03 §4 luật 2).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const ctx = await getAuthContext();

  const aiCanWrite = ctx ? can(ctx, { ai: ["use_write_tools"] }) : false;
  const aiDemo = aiDriver() === "mock";
  const unread = ctx ? await unreadNotifications(ctx) : 0;

  return (
    <SidebarProvider>
      <AppSidebar
        viewerType={viewer.type}
        workspaceName={viewer.organizationName ?? "Sao Kim Branding"}
      />
      <SidebarInset className="min-w-0 bg-bg">
        {/* Bỏ qua điều hướng: chuẩn a11y, chỉ hiện khi focus bằng Tab */}
        <a
          href="#noi-dung"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-1.5 focus:text-[12.5px] focus:text-ink focus:shadow-2"
        >
          Bỏ qua điều hướng
        </a>
        <Topbar viewer={viewer} aiCanWrite={aiCanWrite} aiDemo={aiDemo} unreadCount={unread} />
        <main id="noi-dung" className="min-w-0 flex-1">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
