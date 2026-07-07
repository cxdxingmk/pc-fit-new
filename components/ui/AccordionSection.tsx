"use client";

import { useId, type ReactNode } from "react";
import { cn } from "./cn";

interface AccordionSectionProps {
  title: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

// grid-rows-[0fr]/[1fr]는 표준 스케일에 없는 arbitrary value지만, 높이를 모르는 콘텐츠를
// 애니메이션으로 열고 닫는 데는 max-height 트릭보다 이 grid 기법이 유일하게 매끄럽다
// (지시서에서도 이 기법을 명시적으로 예시로 들었다).
export default function AccordionSection({ title, isOpen, onToggle, children, className }: AccordionSectionProps) {
  const panelId = useId();

  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl p-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:hover:bg-slate-800/50 dark:focus-visible:ring-offset-slate-900"
      >
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</span>
        <ChevronDownIcon isOpen={isOpen} />
      </button>
      <div id={panelId} className={cn("grid transition-[grid-template-rows] duration-300 ease-in-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="p-4 pt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200", isOpen && "rotate-180")}
      aria-hidden="true"
    >
      <path d="M5 7.5 10 12.5 15 7.5" />
    </svg>
  );
}
