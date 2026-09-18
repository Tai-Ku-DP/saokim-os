import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Dự án" };

export default function ProjectsPage() {
  return (
    <PlaceholderPage
      phase="P3"
      icon={FolderKanban}
      title="Dự án"
      subtitle="Tiến độ, hạng mục và người phụ trách"
      emptyTitle="Chưa có dự án"
      emptyHint="Dự án được phân quyền sẽ hiển thị ở đây."
    />
  );
}
