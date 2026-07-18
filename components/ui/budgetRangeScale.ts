import { BUDGET_SLIDER_MIN, BUDGET_SLIDER_MAX } from "@/app/context/BuildContext";

/**
 * BudgetRangeSlider 전용 균등(선형) 매핑. 50만원~1,000만원 전체를 물리적 위치와 1:1 비례로
 * 매핑하고, 조작 단위는 전 구간 10만원으로 통일한다(구간별로 비율/step이 달라지던 이전 버전의
 * 70:30 비선형 매핑은 폐기).
 */
export const BUDGET_MIN = BUDGET_SLIDER_MIN;
export const BUDGET_MAX = BUDGET_SLIDER_MAX;
export const BUDGET_STEP = 100_000;

function snapToStep(rawWon: number): number {
  const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, rawWon));
  return BUDGET_MIN + Math.round((clamped - BUDGET_MIN) / BUDGET_STEP) * BUDGET_STEP;
}

/** 슬라이더 물리적 위치(0~100%) → 예산 값(원). 전 구간 선형 + 10만원 단위 스냅. */
export function toValue(percent: number): number {
  const clamped = Math.min(100, Math.max(0, percent));
  const raw = BUDGET_MIN + (clamped / 100) * (BUDGET_MAX - BUDGET_MIN);
  return snapToStep(raw);
}

/** 예산 값(원) → 슬라이더 물리적 위치(0~100%). toValue와 짝을 이루는 순수 선형 역함수. */
export function toPercent(value: number): number {
  const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, value));
  return ((clamped - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;
}

/** "정확한 금액 입력" 칩에서 받은 원 단위 숫자를 50만~1,000만 범위로 clamp하고 10만원 단위로 반올림한다. */
export function snapBudgetInput(rawWon: number): number {
  return snapToStep(rawWon);
}

export interface BudgetTick {
  value: number;
  percent: number;
  /** 100만원 단위(+양끝)는 굵은 눈금+라벨, 그 사이 10만원 단위는 얇은 보조 눈금(라벨 없음)으로 그린다. */
  major: boolean;
}

const TICK_COUNT = Math.round((BUDGET_MAX - BUDGET_MIN) / BUDGET_STEP);

export const BUDGET_TICKS: BudgetTick[] = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
  const value = BUDGET_MIN + i * BUDGET_STEP;
  return {
    value,
    percent: toPercent(value),
    major: value === BUDGET_MIN || value === BUDGET_MAX || value % 1_000_000 === 0,
  };
});
