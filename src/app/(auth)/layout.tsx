import { Sparkles } from "lucide-react";

/** Khung cho màn hình xác thực: một cột, không sidebar. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="spark-gradient grid size-8 place-items-center rounded-md">
            <Sparkles size={16} className="text-white" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-[14px] font-semibold text-ink">Sao Kim BrandCare OS</p>
            <p className="text-[11px] text-ink-3">Brand Growth Firm</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
