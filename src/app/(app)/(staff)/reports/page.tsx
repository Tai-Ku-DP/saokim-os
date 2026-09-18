import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Báo cáo" };

export default function ReportsPage() {
  return (
    <PlaceholderPage
      phase="P7"
      icon={BarChart3}
      title="Báo cáo"
      subtitle="Chất lượng delivery, tiến độ và cơ hội doanh thu"
      emptyTitle="Chưa có dữ liệu báo cáo"
      emptyHint="Số liệu xuất hiện khi có dự án đang triển khai."
    />
  );
}
