import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Quản trị" };

export default function AdminPage() {
  return (
    <PlaceholderPage
      phase="P2"
      icon={ShieldCheck}
      title="Quản trị"
      subtitle="Người dùng, vai trò, loại dự án và template"
      emptyTitle="Chưa có cấu hình"
      emptyHint="Cấu hình vai trò và template onboarding sẽ ở đây."
    />
  );
}
