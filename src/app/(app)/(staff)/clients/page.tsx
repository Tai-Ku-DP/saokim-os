import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Khách hàng" };

export default function ClientsPage() {
  return (
    <PlaceholderPage
      phase="P7"
      icon={Users}
      title="Khách hàng"
      subtitle="Hồ sơ khách hàng, lịch sử tương tác và tín hiệu quan tâm"
      emptyTitle="Chưa có khách hàng"
      emptyHint="Hồ sơ khách hàng được tạo khi ký hợp đồng."
    />
  );
}
