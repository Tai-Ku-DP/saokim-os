import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Cài đặt" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      phase="P7"
      icon={Settings}
      title="Cài đặt"
      subtitle="Hồ sơ, người dùng, thông báo và giao diện"
      emptyTitle="Chưa có mục cài đặt"
      emptyHint="Thông tin cá nhân và mức nhận thông báo sẽ ở đây."
    />
  );
}
