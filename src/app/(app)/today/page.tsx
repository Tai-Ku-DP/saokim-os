import type { Metadata } from "next";
import { LayoutDashboard } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Hôm nay" };

export default function TodayPage() {
  return (
    <PlaceholderPage
      phase="P3"
      icon={LayoutDashboard}
      title="Hôm nay"
      subtitle="Việc cần làm, thông báo và gợi ý tiếp theo"
      emptyTitle="Chưa có việc cần làm"
      emptyHint="Việc cần xử lý sẽ xuất hiện ở đây, tối đa 5 việc quan trọng nhất."
    />
  );
}
