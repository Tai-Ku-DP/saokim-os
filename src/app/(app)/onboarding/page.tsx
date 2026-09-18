import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return (
    <PlaceholderPage
      phase="P4"
      icon={Compass}
      title="Onboarding"
      subtitle="Hồ sơ, brand brief, tài liệu cần nộp và tiến độ khởi động"
      emptyTitle="Onboarding chưa bắt đầu"
      emptyHint="Checklist khởi động sẽ xuất hiện sau khi dự án được tạo."
    />
  );
}
