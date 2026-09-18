import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton cho mọi màn hình trong (app) — dùng skeleton thay spinner (docs/02 §4). */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full px-4 py-5 md:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Đang tải</span>
      <Skeleton className="h-6 w-48" />
      <Skeleton className="mt-2 h-3.5 w-72" />
      <div className="mt-5 grid gap-3">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}
