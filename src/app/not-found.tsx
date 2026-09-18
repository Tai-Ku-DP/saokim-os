import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

/** 404 — 1 câu + 1 CTA (docs/00 §6), không có lời xin lỗi dài dòng. */
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm text-center">
        <FileQuestion size={22} className="mx-auto text-ink-3" aria-hidden />
        <h1 className="mt-2 text-[15px] font-semibold text-ink">Không tìm thấy trang</h1>
        <p className="mt-1 text-[12.5px] text-ink-3">
          Liên kết có thể đã cũ hoặc bạn không có quyền xem.
        </p>
        <Button asChild size="sm" className="mt-4">
          <Link href="/">Về trang chính</Link>
        </Button>
      </div>
    </div>
  );
}
