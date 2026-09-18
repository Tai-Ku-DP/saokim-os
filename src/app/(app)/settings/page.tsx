import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { requireSession } from "@/server/auth/guard";
import { getViewer } from "@/server/auth/viewer";
import { unreadCount } from "@/server/notifications";
import { STAFF_ROLE_KEYS } from "@/server/auth/permissions";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const ctx = await requireSession();
  const viewer = await getViewer();
  const unread = await unreadCount(ctx);

  const permissions =
    ctx.kind === "staff"
      ? [
          { label: "Quản trị hệ thống", value: ctx.role === "admin" ? "Có" : "Không" },
          { label: "Quản lý dự án", value: ["admin", "pm", "account"].includes(ctx.role) ? "Có" : "Theo phân công" },
          { label: "Duyệt phiên bản", value: ["admin", "pm"].includes(ctx.role) ? "Có (override)" : "Không" },
          { label: "Dùng AI ghi dữ liệu", value: ["admin", "pm", "account", "cs"].includes(ctx.role) ? "Có" : "Không" },
        ]
      : [
          { label: "Duyệt phiên bản", value: ctx.role === "owner" ? "Có" : "Không" },
          { label: "Mời thành viên", value: ctx.role === "owner" ? "Có" : "Không" },
          { label: "Gửi yêu cầu dịch vụ", value: "Có" },
          { label: "Dùng AI ghi dữ liệu", value: ctx.role === "owner" ? "Có" : "Không" },
        ];

  return (
    <PageBody width="readable">
      <PageHeader title="Cài đặt" subtitle="Hồ sơ, quyền và thông báo" />

      <div className="grid gap-4">
        <section className="card p-4">
          <h2 className="text-[13px] font-semibold text-ink">Hồ sơ</h2>
          <dl className="mt-3 grid gap-2 text-[12.5px]">
            <Row label="Họ tên" value={viewer.name} />
            <Row label="Email" value={viewer.email} />
            <Row label="Vai trò" value={viewer.title} />
            {viewer.organizationName ? <Row label="Công ty" value={viewer.organizationName} /> : null}
          </dl>
        </section>

        <section className="card p-4">
          <h2 className="text-[13px] font-semibold text-ink">Quyền của bạn</h2>
          <dl className="mt-3 grid gap-2 text-[12.5px]">
            {permissions.map((row) => (
              <Row key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
          <Separator className="my-3" />
          <p className="text-[11.5px] text-ink-3">
            Quyền được kiểm tra ở server cho mọi thao tác — hiển thị ở đây chỉ để bạn biết.
          </p>
        </section>

        <section className="card p-4">
          <h2 className="text-[13px] font-semibold text-ink">Thông báo</h2>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[12.5px] text-ink-2">Chưa đọc</span>
            <Badge variant="secondary" className="tnum font-normal">
              {unread}
            </Badge>
          </div>
          <p className="mt-2 text-[11.5px] text-ink-3">
            Nhắc việc qua email/Zalo do Sao Kim cấu hình theo từng khách hàng.
          </p>
          <Link href="/notifications" className="mt-2 inline-block text-[12.5px] font-medium text-brand hover:underline">
            Xem tất cả thông báo
          </Link>
        </section>

        {ctx.kind === "staff" ? (
          <section className="card p-4">
            <h2 className="text-[13px] font-semibold text-ink">Vai trò nội bộ</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STAFF_ROLE_KEYS.map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className={role === ctx.role ? "border-brand font-normal text-brand" : "border-line font-normal text-ink-3"}
                >
                  {role}
                </Badge>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PageBody>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}
