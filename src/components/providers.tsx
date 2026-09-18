"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

/**
 * Provider dùng chung cho toàn app.
 * - next-themes: theme bằng class `.dark` (khớp `@custom-variant dark` trong globals.css),
 *   lưu ở localStorage key `bc-theme`, mặc định theo hệ thống, không nháy khi tải.
 * - TooltipProvider: bắt buộc cho component tooltip (shadcn yêu cầu).
 * - Toaster: thông báo dạng toast (sonner).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="bc-theme"
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
