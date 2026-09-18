import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { PlaceholderPage } from "@/components/shell/placeholder";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <PlaceholderPage
      phase="P7"
      icon={Inbox}
      title="Inbox"
      subtitle="Việc của tôi: hạng mục, phản hồi chờ xử lý, khách đang chờ phản hồi"
      emptyTitle="Không có việc tồn"
      emptyHint="Việc được giao và phản hồi mới sẽ tập trung ở đây."
    />
  );
}
