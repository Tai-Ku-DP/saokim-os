import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { Topbar } from "@/components/shell/topbar";
import { getViewer } from "@/server/auth/viewer";

/**
 * Khung ứng dụng dùng chung cho mọi màn hình trong (app):
 *   Topbar
 *   ├── Sidebar  └── Main
 * Không copy sidebar/topbar vào từng page (docs/02 §7).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <SidebarProvider>
      <AppSidebar
        viewerType={viewer.type}
        workspaceName={viewer.organizationName ?? "Sao Kim Branding"}
      />
      <SidebarInset className="min-w-0 bg-bg">
        <Topbar viewer={viewer} />
        <main className="min-w-0 flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
