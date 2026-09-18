import type { Metadata } from "next";
import Link from "next/link";
import { getAuthContext } from "@/server/auth/guard";
import { getInvitationView } from "@/server/services/invitations";
import { AcceptInvitationForm } from "./accept-form";

export const metadata: Metadata = { title: "Lời mời tham gia" };

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [view, ctx] = await Promise.all([getInvitationView(id), getAuthContext()]);

  const usable = view !== null && view.status === "pending" && !view.expired;

  return (
    <div className="card p-5">
      <h1 className="text-[15px] font-semibold text-ink">Lời mời tham gia</h1>

      {!view ? (
        <p className="mt-1 text-[13px] text-ink-2">Lời mời không tồn tại hoặc đã bị huỷ.</p>
      ) : !usable ? (
        <p className="mt-1 text-[13px] text-ink-2">Lời mời đã được xử lý hoặc đã hết hạn.</p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-ink-2">
            {view.organizationName} mời bạn vào không gian làm việc trên BrandCare.
          </p>
          <p className="mt-2 text-[12px] text-ink-3">
            Email được mời: <span className="text-ink-2">{view.email}</span>
          </p>

          {ctx ? (
            <div className="mt-4">
              <AcceptInvitationForm invitationId={id} />
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              <p className="text-[12px] text-ink-3">
                Đăng nhập bằng đúng email được mời để tiếp tục.
              </p>
              <Link
                href={`/sign-in?next=${encodeURIComponent(`/accept-invitation/${id}`)}`}
                className="text-[13px] font-medium text-brand hover:underline"
              >
                Đăng nhập
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
