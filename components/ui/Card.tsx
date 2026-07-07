import type { ReactNode } from "react";
import { cn } from "./cn";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** 카드 내부에 은은한 배경을 얹어 인접 텍스트 블록과 시각적으로 분리할 때 사용 */
  muted?: boolean;
}

export default function Card({ children, className, muted = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
        muted && "bg-slate-50 dark:bg-slate-900/50",
        className
      )}
    >
      {children}
    </div>
  );
}
