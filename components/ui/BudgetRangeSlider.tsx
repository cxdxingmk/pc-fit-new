"use client";

import { useId, useRef, useState } from "react";
import { cn } from "./cn";
import { BUDGET_MAX, BUDGET_MIN, BUDGET_STEP, BUDGET_TICKS, snapBudgetInput, toPercent, toValue } from "./budgetRangeScale";

interface BudgetRangeSliderProps {
  valueMin: number;
  valueMax: number;
  onChange: (range: { min: number; max: number }) => void;
  formatValue?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
}

type Thumb = "min" | "max";

// 두 손잡이가 완전히 겹치는 걸 막는 최소 간격 — 슬라이더 전체가 이제 10만원 단위 하나뿐이라 그대로 쓴다.
const MIN_GAP = BUDGET_STEP;

const toManwonText = (won: number) => String(Math.round(won / 10_000));

/**
 * 예산 슬라이더 전용 커스텀 듀얼 레인지 슬라이더. 전 구간 균등(선형) 매핑 + 10만원 단위이지만
 * 100만원 단위 굵은 눈금과 10만원 단위 얇은 보조 눈금을 함께 그려야 하고, 상단 금액 칩을 직접
 * 입력 필드로 전환할 수 있어야 해서(양방향 동기화) 네이티브 input[type=range] 대신 트랙 위
 * 절대 위치 + pointer capture로 드래그를 직접 구현한다. 손잡이는 role="slider"로 키보드
 * 접근성을 유지한다.
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
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const [minInputText, setMinInputText] = useState("");
  const [maxInputText, setMaxInputText] = useState("");
  const trackRef = useRef<HTMLDivElement>(null);
  const minId = useId();
  const maxId = useId();

  const percentMin = toPercent(valueMin);
  const percentMax = toPercent(valueMax);
  const format = formatValue ?? ((v: number) => v.toLocaleString());

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
        next = current + BUDGET_STEP;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = current - BUDGET_STEP;
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

  const startEditMin = () => {
    setMinInputText(toManwonText(valueMin));
    setEditingMin(true);
  };
  const startEditMax = () => {
    setMaxInputText(toManwonText(valueMax));
    setEditingMax(true);
  };

  // 문자 등 숫자로 해석할 수 없는 입력은 조용히 이전 유효값으로 되돌린다(onChange 호출 안 함).
  const commitMinInput = () => {
    setEditingMin(false);
    const numeric = Number(minInputText.trim());
    if (!minInputText.trim() || Number.isNaN(numeric)) return;
    const snapped = snapBudgetInput(numeric * 10_000);
    commitValue("min", snapped);
  };
  const commitMaxInput = () => {
    setEditingMax(false);
    const numeric = Number(maxInputText.trim());
    if (!maxInputText.trim() || Number.isNaN(numeric)) return;
    const snapped = snapBudgetInput(numeric * 10_000);
    commitValue("max", snapped);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <div className="w-full select-none">
      <div className="mb-4 flex items-center justify-center gap-3 text-base font-bold text-white">
        {editingMin ? (
          <div className="flex items-center gap-1.5 rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft ring-2 ring-brand/60">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={minInputText}
              onChange={(e) => setMinInputText(e.target.value)}
              onBlur={commitMinInput}
              onKeyDown={handleInputKeyDown}
              aria-label="최소 예산 직접 입력(만원 단위)"
              className="w-14 bg-transparent text-center tabular-nums outline-none"
            />
            <span className="text-sm font-normal text-brand-soft/70">만원</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditMin}
            className="rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft tabular-nums transition hover:ring-2 hover:ring-brand/40"
          >
            {format(valueMin)}
          </button>
        )}
        <span className="text-white/25">~</span>
        {editingMax ? (
          <div className="flex items-center gap-1.5 rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft ring-2 ring-brand/60">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              value={maxInputText}
              onChange={(e) => setMaxInputText(e.target.value)}
              onBlur={commitMaxInput}
              onKeyDown={handleInputKeyDown}
              aria-label="최대 예산 직접 입력(만원 단위)"
              className="w-14 bg-transparent text-center tabular-nums outline-none"
            />
            <span className="text-sm font-normal text-brand-soft/70">만원</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditMax}
            className="rounded-full bg-brand-dim px-4 py-1.5 text-brand-soft tabular-nums transition hover:ring-2 hover:ring-brand/40"
          >
            {format(valueMax)}
          </button>
        )}
      </div>

      <div className="relative h-8">
        {/* 손잡이 반지름(10px)만큼 안쪽으로 들여, 0%/100%에서도 손잡이가 트랙 밖으로 넘치지 않게 한다. */}
        <div ref={trackRef} className="absolute inset-x-2.5 inset-y-0">
          <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" />
          <div
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
            style={{ left: `${percentMin}%`, width: `${percentMax - percentMin}%` }}
          />

          {/* 눈금 — 100만원 단위(+양끝)는 굵고 진하게, 10만원 단위 보조 눈금은 짧고 연하게. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {BUDGET_TICKS.map((tick) => (
              <span
                key={tick.value}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  tick.major ? "h-3 w-[2px] bg-white/60" : "h-1 w-px bg-white/20"
                )}
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

      {/* 100만원 단위 라벨만 노출 — 손잡이/트랙보다 눈에 덜 띄게 작은 폰트+연한 색상으로, 조작에 방해되지 않게 한다. */}
      <div className="relative mt-2 h-4">
        <div className="absolute inset-x-2.5 inset-y-0">
          {BUDGET_TICKS.filter((tick) => tick.major).map((tick) => (
            <span
              key={tick.value}
              className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-white/30"
              style={{ left: `${tick.percent}%` }}
            >
              {format(tick.value)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
