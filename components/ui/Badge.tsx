import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "emerald" | "amber" | "rose" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  neutral:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

export default function Badge({ children, tone = "neutral", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** 0-100 점수를 프로젝트 공용 시맨틱 컬러 규약(우수=emerald, 보통=amber, 경고=rose)으로 변환한다. */
export function toneFromScore(score: number): BadgeTone {
  if (score >= 80) return "emerald";
  if (score >= 60) return "amber";
  return "rose";
}
