import type { ReactNode } from "react";
import { cn } from "./cn";

const VARIANT_STYLES = {
  warning: "bg-warn/10 text-warn ring-1 ring-warn/20",
  info: "bg-white/[0.04] text-white/50 ring-1 ring-line",
} as const;

const VARIANT_ICON = {
  warning: "⚠️",
  info: "ℹ️",
} as const;

/** 경고/안내 메시지 공용 배너 — 아이콘 고정폭 + 본문 min-w-0로 긴 텍스트도 안전하게 줄바꿈 */
export default function Callout({
  variant,
  role,
  children,
  className,
}: {
  variant: "warning" | "info";
  role?: "alert" | "status";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role={role} className={cn("flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs", VARIANT_STYLES[variant], className)}>
      <span aria-hidden="true" className="w-4 shrink-0 text-center leading-none">
        {VARIANT_ICON[variant]}
      </span>
      <span className="min-w-0 flex-1 text-left leading-relaxed">{children}</span>
    </div>
  );
}
