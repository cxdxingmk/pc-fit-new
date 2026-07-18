"use client";

import { useId, useMemo, useRef, useState } from "react";
import { cn } from "./cn";
import { BUDGET_MAX, BUDGET_MIN, BUDGET_SEGMENT_A_STEP, BUDGET_TICKS, stepForValue, toPercent, toValue } from "./budgetRangeScale";

interface BudgetRangeSliderProps {
  valueMin: number;
  valueMax: number;
  onChange: (range: { min: number; max: number }) => void;
  formatValue?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
}

type Thumb = "min" | "max";

// 두 손잡이가 완전히 겹치는 걸 막는 최소 간격 — 전체 구간에서 가장 촘촘한 구간 A의 step(10만원)을 쓴다.
const MIN_GAP = BUDGET_SEGMENT_A_STEP;

/**
 * 예산 슬라이더 전용 커스텀 듀얼 레인지 슬라이더. budgetRangeScale.ts의 비선형 매핑(구간 A: 50만~
 * 500만원 10만원 단위, 구간 B: 500만~1000만원 50만원 단위)을 쓰기 때문에 네이티브
 * input[type=range](step이 전 구간에서 고정)로는 표현할 수 없어, 트랙 위 절대 위치 + pointer
 * capture로 직접 드래그를 구현한다. 손잡이는 role="slider"로 키보드 접근성을 유지한다.
 */
export default function BudgetRangeSlider({
  valueMin,
  valueMax,
  onChange,
  formatValue,
  minLabel = "최소 예산",
  maxLabel = "최대 예산",
}: BudgetRangeSliderProps) {
  const [activeThumb, setActiveThumb] = useState<Thumb | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const minId = useId();
  const maxId = useId();

  const percentMin = toPercent(valueMin);
  const percentMax = toPercent(valueMax);
  const format = formatValue ?? ((v: number) => v.toLocaleString());

  const ticks = useMemo(
    () => BUDGET_TICKS.map((tick) => ({ ...tick, percent: toPercent(tick.value) })),
    []
  );

  const commitValue = (thumb: Thumb, rawValue: number) => {
    if (thumb === "min") {
      const next = Math.min(rawValue, valueMax - MIN_GAP);
      onChange({ min: Math.max(BUDGET_MIN, next), max: valueMax });
    } else {
      const next = Math.max(rawValue, valueMin + MIN_GAP);
      onChange({ min: valueMin, max: Math.min(BUDGET_MAX, next) });
    }
  };

  const percentFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.min(100, Math.max(0, ratio * 100));
  };

  const handlePointerDown = (thumb: Thumb) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveThumb(thumb);
  };

  const handlePointerMove = (thumb: Thumb) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeThumb !== thumb) return;
    commitValue(thumb, toValue(percentFromClientX(e.clientX)));
  };

  const handlePointerUp = () => setActiveThumb(null);

  const handleKeyDown = (thumb: Thumb) => (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = thumb === "min" ? valueMin : valueMax;
    let next: number | null = null;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = current + stepForValue(current, "increase");
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = current - stepForValue(current, "decrease");
        break;
      case "Home":
        next = BUDGET_MIN;
        break;
      case "End":
        next = BUDGET_MAX;
        break;
      default:
        return;
    }

    e.preventDefault();
    commitValue(thumb, next);
  };

  return (
    <div className="w-full select-none">
      <div className="mb-4 flex items-center justify-center gap-3 text-base font-bold text-white">
        <span className="rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft tabular-nums">{format(valueMin)}</span>
        <span className="text-white/25">~</span>
        <span className="rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft tabular-nums">{format(valueMax)}</span>
      </div>

      <div className="relative h-8">
        {/* 손잡이 반지름(10px)만큼 안쪽으로 들여, 0%/100%에서도 손잡이가 트랙 밖으로 넘치지 않게 한다. */}
        <div ref={trackRef} className="absolute inset-x-2.5 inset-y-0">
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
          <div
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
            style={{ left: `${percentMin}%`, width: `${percentMax - percentMin}%` }}
          />

          {/* 100만원 단위(+양끝) 눈금 — 위치는 비선형 매핑 함수(toPercent)를 그대로 재사용해서 구한다. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {ticks.map((tick) => (
              <span
                key={tick.value}
                className="absolute top-1/2 h-2.5 w-px -translate-x-1/2 -translate-y-1/2 bg-white/40"
                style={{ left: `${tick.percent}%` }}
              />
            ))}
          </div>

          <div
            id={minId}
            role="slider"
            tabIndex={0}
            aria-label={minLabel}
            aria-valuemin={BUDGET_MIN}
            aria-valuemax={valueMax - MIN_GAP}
            aria-valuenow={valueMin}
            aria-valuetext={format(valueMin)}
            onPointerDown={handlePointerDown("min")}
            onPointerMove={handlePointerMove("min")}
            onPointerUp={handlePointerUp}
            onKeyDown={handleKeyDown("min")}
            className={cn(
              "absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-[3px] border-white bg-brand shadow-md shadow-black/35 transition-transform focus-visible:scale-[1.15] focus-visible:outline-none hover:scale-[1.15]",
              activeThumb === "min" ? "z-30" : "z-20"
            )}
            style={{ left: `${percentMin}%` }}
          />
          <div
            id={maxId}
            role="slider"
            tabIndex={0}
            aria-label={maxLabel}
            aria-valuemin={valueMin + MIN_GAP}
            aria-valuemax={BUDGET_MAX}
            aria-valuenow={valueMax}
            aria-valuetext={format(valueMax)}
            onPointerDown={handlePointerDown("max")}
            onPointerMove={handlePointerMove("max")}
            onPointerUp={handlePointerUp}
            onKeyDown={handleKeyDown("max")}
            className={cn(
              "absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-[3px] border-white bg-brand shadow-md shadow-black/35 transition-transform focus-visible:scale-[1.15] focus-visible:outline-none hover:scale-[1.15]",
              activeThumb === "max" ? "z-30" : "z-20"
            )}
            style={{ left: `${percentMax}%` }}
          />
        </div>
      </div>

      {/* 눈금 라벨 — 손잡이/트랙보다 눈에 덜 띄게 작은 폰트+연한 색상으로, 조작에 방해되지 않게 한다. */}
      <div className="relative mt-2 h-4">
        <div className="absolute inset-x-2.5 inset-y-0">
          {ticks.map((tick) => (
            <span
              key={tick.value}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-white/30"
              style={{ left: `${tick.percent}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
