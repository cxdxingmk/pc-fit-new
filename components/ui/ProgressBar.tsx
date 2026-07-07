import { cn } from "./cn";
import type { BadgeTone } from "./Badge";

const FILL_CLASSES: Record<BadgeTone, string> = {
  emerald: "bg-emerald-500 dark:bg-emerald-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  rose: "bg-rose-500 dark:bg-rose-400",
  neutral: "bg-slate-500 dark:bg-slate-400",
};

interface ProgressBarProps {
  /** 0-100 사이 값. 범위를 벗어나면 clamp한다. */
  value: number;
  tone?: BadgeTone;
  className?: string;
  label?: string;
}

export default function ProgressBar({ value, tone = "neutral", className, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn("h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800", className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn("h-2 rounded-full transition-[width] duration-300", FILL_CLASSES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
