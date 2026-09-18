import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Badge } from "@/components/ui/badge";
import { requireStaff } from "@/server/auth/guard";
import { listClientOrganizations } from "@/server/services/clients";

export const metadata: Metadata = { title: "Khách hàng" };

export default async function ClientsPage() {
  const ctx = await requireStaff();
  const clients = await listClientOrganizations(ctx);

  return (
    <PageBody>
      <PageHeader title="Khách hàng" subtitle={`${clients.length} công ty`} />

      {clients.length === 0 ? (
        <EmptyState icon={Users} title="Chưa có khách hàng" hint="Hồ sơ tạo khi ký hợp đồng." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-surface-2 text-left text-[11px] text-ink-3">
                <th scope="col" className="px-4 py-2 font-medium">Công ty</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">Ngành</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Giai đoạn</th>
                <th scope="col" className="px-3 py-2 font-medium">Dự án</th>
                <th scope="col" className="px-4 py-2 font-medium">Người dùng</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="row border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5">
                    <Link href={`/clients/${client.id}`} className="font-medium text-ink hover:text-brand">
                      {client.name}
                    </Link>
                  </td>
                  <td className="hidden px-3 py-2.5 text-ink-2 md:table-cell">{client.industry ?? "—"}</td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    {client.brandStage ? (
                      <Badge variant="secondary" className="font-normal">
                        {client.brandStage}
                      </Badge>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                  <td className="tnum px-3 py-2.5 text-ink-2">{client.activeProjects}</td>
                  <td className="tnum px-4 py-2.5 text-ink-2">{client.memberCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageBody>
  );
}
