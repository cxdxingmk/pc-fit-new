import type { SelectHTMLAttributes } from "react";
import { cn } from "./cn";

/** appearance-none + 커스텀 chevron, 다크 토큰(surface/line/brand) 전용 select 래퍼 */
export default function DarkSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={cn(
          "w-full appearance-none rounded-xl bg-white/[0.04] px-4 py-3 pr-9 text-sm text-white ring-1 ring-line transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:text-white/30",
          className
        )}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
        aria-hidden="true"
      >
        <path d="M5 7.5 10 12.5 15 7.5" />
      </svg>
    </div>
  );
}
