"use client";

import { useId, useState } from "react";
import { cn } from "./cn";

interface DualRangeSliderProps {
  min: number;
  max: number;
  step: number;
  valueMin: number;
  valueMax: number;
  onChange: (range: { min: number; max: number }) => void;
  formatValue?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
}

/**
 * 네이티브 input[type=range] 두 개를 같은 트랙 위에 겹쳐 그리는 방식의 듀얼 레인지 슬라이더.
 * 각 input 자체는 pointer-events:none(globals.css)로 두고 실제 손잡이(::-webkit/moz-slider-thumb)만
 * pointer-events:auto로 열어둬서, 트랙 중간 클릭이 엉뚱한 손잡이를 잡아채지 않는다.
 * 키보드 방향키/Home/End, 터치 드래그는 네이티브 input의 기본 동작을 그대로 활용한다(커스텀
 * ARIA를 새로 만들지 않음 — input[type=range]는 이미 role=slider와 aria-valuenow 등을 자동 노출한다).
 */
export default function DualRangeSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChange,
  formatValue,
  minLabel = "최소 예산",
  maxLabel = "최대 예산",
}: DualRangeSliderProps) {
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);
  const minId = useId();
  const maxId = useId();

  const percentMin = ((valueMin - min) / (max - min)) * 100;
  const percentMax = ((valueMax - min) / (max - min)) * 100;
  const format = formatValue ?? ((v: number) => v.toLocaleString());

  const handleMinChange = (raw: number) => {
    const next = Math.min(raw, valueMax - step);
    onChange({ min: Math.max(min, next), max: valueMax });
  };

  const handleMaxChange = (raw: number) => {
    const next = Math.max(raw, valueMin + step);
    onChange({ min: valueMin, max: Math.min(max, next) });
  };

  return (
    <div className="w-full select-none">
      <div className="mb-4 flex items-center justify-center gap-3 text-base font-bold text-white">
        <span className="rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft tabular-nums">{format(valueMin)}</span>
        <span className="text-white/25">~</span>
        <span className="rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft tabular-nums">{format(valueMax)}</span>
      </div>

      <div className="relative h-8 px-1">
        {/* 트랙 배경 */}
        <div className="absolute left-1 right-1 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
        {/* 선택된 구간 강조 */}
        <div
          className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
          style={{ left: `calc(${percentMin}% * 0.01 * (100% - 8px) + 4px)`, width: `calc((${percentMax}% - ${percentMin}%) * 0.01 * (100% - 8px))` }}
        />

        <input
          id={minId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          onPointerDown={() => setActiveThumb("min")}
          aria-label={minLabel}
          className={cn("dual-range-input absolute inset-0 w-full appearance-none bg-transparent", activeThumb === "min" ? "z-30" : "z-20")}
        />
        <input
          id={maxId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          onPointerDown={() => setActiveThumb("max")}
          aria-label={maxLabel}
          className={cn("dual-range-input absolute inset-0 w-full appearance-none bg-transparent", activeThumb === "max" ? "z-30" : "z-20")}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-white/30">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
