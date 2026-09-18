import type { LucideIcon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";

/**
 * Màn hình chưa triển khai. Dùng nội dung thật theo docs/03 §5 để không có
 * màn hình trắng và không có link chết. Mỗi page sẽ được thay ở phase tương ứng.
 */
export function PlaceholderPage({
  title,
  subtitle,
  phase,
  icon,
  emptyTitle,
  emptyHint,
  action,
}: {
  title: string;
  subtitle?: string;
  phase: string;
  icon?: LucideIcon;
  emptyTitle: string;
  emptyHint?: string;
  action?: React.ReactNode;
}) {
  return (
    <PageBody>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={action}
        meta={
          <Badge variant="secondary" className="font-normal">
            {phase}
          </Badge>
        }
      />
      <EmptyState icon={icon} title={emptyTitle} hint={emptyHint} />
    </PageBody>
  );
}
