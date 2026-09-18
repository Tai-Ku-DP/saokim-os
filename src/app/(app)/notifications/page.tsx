import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Thông báo" };

export default function NotificationsPage() {
  return (
    <PlaceholderPage
      phase="P7"
      icon={Bell}
      title="Thông báo"
      subtitle="Toàn bộ thông báo và việc cần xử lý"
      emptyTitle="Không có thông báo mới"
      emptyHint="Thông báo về phiên bản, phản hồi và hạn chót sẽ ở đây."
    />
  );
}
