import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Lộ trình phát triển" };

export default function GrowthPage() {
  return (
    <PlaceholderPage
      phase="P6"
      icon={BarChart3}
      title="Lộ trình phát triển"
      subtitle="Bước tiếp theo cho thương hiệu và dịch vụ đề xuất"
      emptyTitle="Lộ trình đang được chuẩn bị"
      emptyHint="Đề xuất sẽ dựa trên dự án đã hoàn thành và mức độ tương tác."
    />
  );
}
