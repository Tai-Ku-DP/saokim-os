"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary. Không lộ chi tiết kỹ thuật cho người dùng; lỗi thật được ghi ra
 * console phía client và (ở production) sẽ gửi về nơi thu thập log.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[ui] lỗi không mong đợi:", error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm text-center">
        <TriangleAlert size={22} className="mx-auto text-warning" aria-hidden />
        <h1 className="mt-2 text-[15px] font-semibold text-ink">Có lỗi xảy ra</h1>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Dữ liệu của bạn vẫn an toàn. Thử tải lại phần này.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button size="sm" onClick={reset}>
            Thử lại
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push("/")}>
            Về trang chính
          </Button>
        </div>
      </div>
    </div>
  );
}
