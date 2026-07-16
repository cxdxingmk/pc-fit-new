"use client";

/**
 * InfoTooltip — 정보 아이콘 한정 트리거 툴팁 (Toss/Kakao 스타일 마이크로 인터랙션)
 *
 * 인터랙션 명세:
 *  - 트리거: ⓘ 아이콘 영역 mouseenter 시에만 툴팁 렌더링 (텍스트/카드 호버는 트리거로 쓰지 않음)
 *  - 해제:   mouseleave 즉시 디바운스 없이 상태 해제
 *  - 배치:   기본 상단(top). 뷰포트 상단 공간 부족 시 우측(right)으로 지능적 폴백
 *  - 전환:   150ms ease-in-out 페이드 인/아웃 (opacity + 미세한 translate)
 *  - 접근성: 키보드 포커스(focus/blur) 및 Escape 지원, aria-describedby 연결
 *  - 모바일: hover가 없는 터치 환경을 위해 아이콘 탭으로 열기/닫기 토글, 바깥 탭 시 닫힘
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

type TooltipPlacement = "top" | "right";

interface InfoTooltipProps {
  /** 툴팁 안에 표시할 설명 텍스트 */
  content: ReactNode;
  /** 선호 배치 방향 (공간 부족 시 자동 폴백). 기본값 "top" */
  preferredPlacement?: TooltipPlacement;
  /** 아이콘 크기(px). 기본값 14 — 지표 텍스트 옆에 붙는 보조 요소 크기 */
  iconSize?: number;
  /** 접근성용 아이콘 레이블. 기본값 "자세한 설명" */
  ariaLabel?: string;
}

const TOOLTIP_TRANSITION_MS = 150;

const styles = {
  wrapper: "relative inline-flex items-center align-middle ml-1",
  iconButton: [
    "inline-flex items-center justify-center rounded-full",
    "text-white/25 hover:text-brand-soft",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
    "focus-visible:outline-brand",
    "transition-colors duration-150 cursor-help",
    "bg-transparent border-0 p-0",
  ].join(" "),
  tooltipBase: [
    "absolute z-50 w-64",
    "rounded-xl bg-ink-soft/95 px-4 py-3",
    "text-xs font-medium leading-relaxed text-white/85 shadow-card ring-1 ring-white/10 backdrop-blur",
    "pointer-events-none select-none",
    "transition-[opacity,transform] ease-in-out",
  ].join(" "),
  placementOpen: {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-100 translate-y-0",
    right: "left-full top-1/2 -translate-y-1/2 ml-2 opacity-100 translate-x-0",
  },
  placementClosed: {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 translate-y-0.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-2 opacity-0 -translate-x-0.5",
  },
  arrow: {
    top: "absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink-soft",
    right: "absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-ink-soft",
  },
} as const;

/** 뷰포트 상단 공간이 부족하면 top → right 폴백 */
function resolvePlacement(anchor: HTMLElement | null, preferred: TooltipPlacement): TooltipPlacement {
  if (!anchor || preferred === "right") return preferred;
  const TOOLTIP_ESTIMATED_HEIGHT = 72; // max-w 기준 2~3줄 높이 여유치
  const { top } = anchor.getBoundingClientRect();
  return top < TOOLTIP_ESTIMATED_HEIGHT ? "right" : "top";
}

export default function InfoTooltip({
  content,
  preferredPlacement = "top",
  iconSize = 14,
  ariaLabel = "자세한 설명",
}: InfoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [placement, setPlacement] = useState<TooltipPlacement>(preferredPlacement);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const handleOpen = useCallback(() => {
    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
    setPlacement(resolvePlacement(anchorRef.current, preferredPlacement));
    setIsMounted(true);
    // 다음 프레임에 open 클래스 적용 → 페이드인 트랜지션 발동
    requestAnimationFrame(() => setIsOpen(true));
  }, [preferredPlacement]);

  const handleClose = useCallback(() => {
    // 명세: 디바운스 없이 즉시 상태 해제. 페이드아웃(150ms) 후 DOM 언마운트.
    setIsOpen(false);
    unmountTimerRef.current = setTimeout(() => setIsMounted(false), TOOLTIP_TRANSITION_MS);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Escape") handleClose();
    },
    [handleClose],
  );

  const handleToggle = useCallback(() => {
    if (isOpen) {
      handleClose();
    } else {
      handleOpen();
    }
  }, [isOpen, handleOpen, handleClose]);

  useEffect(() => {
    return () => {
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, []);

  // 터치 기기는 hover(mouseenter/leave)가 없어 탭으로 열고, 다른 곳을 탭하면 닫히게 한다.
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isOpen, handleClose]);

  // 열려 있는 동안 리사이즈 시 배치 재계산
  useLayoutEffect(() => {
    if (!isOpen) return;
    const onResize = () => setPlacement(resolvePlacement(anchorRef.current, preferredPlacement));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen, preferredPlacement]);

  return (
    <span className={styles.wrapper}>
      <button
        ref={anchorRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-describedby={isMounted ? tooltipId : undefined}
        className={styles.iconButton}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
        onKeyDown={handleKeyDown}
        onClick={handleToggle}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="8" cy="4.9" r="0.9" fill="currentColor" />
          <rect x="7.25" y="6.8" width="1.5" height="5" rx="0.75" fill="currentColor" />
        </svg>
      </button>

      {isMounted && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{ transitionDuration: `${TOOLTIP_TRANSITION_MS}ms` }}
          className={[styles.tooltipBase, isOpen ? styles.placementOpen[placement] : styles.placementClosed[placement]].join(" ")}
        >
          {content}
          <span aria-hidden="true" className={styles.arrow[placement]} />
        </span>
      )}
    </span>
  );
}
