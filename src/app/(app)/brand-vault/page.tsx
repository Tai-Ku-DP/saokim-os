import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Brand Home" };

export default function BrandVaultPage() {
  return (
    <PlaceholderPage
      phase="P6"
      icon={Archive}
      title="Brand Home"
      subtitle="Tài sản thương hiệu, guideline, lộ trình và sức khỏe thương hiệu"
      emptyTitle="Chưa có tài sản thương hiệu"
      emptyHint="Tài sản sẽ xuất hiện sau khi bàn giao dự án."
    />
  );
}
