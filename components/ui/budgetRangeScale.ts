import { BUDGET_SLIDER_MIN, BUDGET_SLIDER_MAX } from "@/app/context/BuildContext";

/**
 * BudgetRangeSlider 전용 비선형 매핑.
 *
 * 구간 A(50만원~500만원)는 슬라이더 물리적 길이의 앞쪽 70%에 걸쳐 10만원 단위로 세밀하게
 * 탐색하도록 하고, 구간 B(500만원~1,000만원)는 뒤쪽 30%에 걸쳐 50만원 단위로 고예산대를
 * 빠르게 훑도록 한다. 두 구간 모두 자기 구간 안에서는 (물리적 위치)↔(예산 값)이 선형이라,
 * 결과적으로 구간 A는 넓은 물리적 간격(적은 원화 폭에 넓은 화면 폭), 구간 B는 좁은 물리적
 * 간격(큰 원화 폭에 좁은 화면 폭)을 갖게 된다.
 */
export const BUDGET_MIN = BUDGET_SLIDER_MIN;
export const BUDGET_MAX = BUDGET_SLIDER_MAX;
export const BUDGET_SEGMENT_BOUNDARY = 5_000_000;
export const BUDGET_SEGMENT_A_PERCENT = 70;
export const BUDGET_SEGMENT_A_STEP = 100_000;
// 50만원으로 확정. 고예산대에서 너무 거칠다고 판단되면 이 값만 낮추면 된다(예: 250_000).
export const BUDGET_SEGMENT_B_STEP = 500_000;

function snapToStep(raw: number, base: number, step: number): number {
  return base + Math.round((raw - base) / step) * step;
}

/** 슬라이더 물리적 위치(0~100%) → 실제 예산 값(원). 70% 경계에서 값이 끊기지 않고 정확히 이어진다. */
export function toValue(percent: number): number {
  const clamped = Math.min(100, Math.max(0, percent));

  if (clamped <= BUDGET_SEGMENT_A_PERCENT) {
    const ratio = clamped / BUDGET_SEGMENT_A_PERCENT;
    const raw = BUDGET_MIN + ratio * (BUDGET_SEGMENT_BOUNDARY - BUDGET_MIN);
    return snapToStep(raw, BUDGET_MIN, BUDGET_SEGMENT_A_STEP);
  }

  const ratio = (clamped - BUDGET_SEGMENT_A_PERCENT) / (100 - BUDGET_SEGMENT_A_PERCENT);
  const raw = BUDGET_SEGMENT_BOUNDARY + ratio * (BUDGET_MAX - BUDGET_SEGMENT_BOUNDARY);
  return snapToStep(raw, BUDGET_SEGMENT_BOUNDARY, BUDGET_SEGMENT_B_STEP);
}

/** 실제 예산 값(원) → 슬라이더 물리적 위치(0~100%). toValue와 같은 구간별 선형 매핑을 반대로 적용한다. */
export function toPercent(value: number): number {
  const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, value));

  if (clamped <= BUDGET_SEGMENT_BOUNDARY) {
    return ((clamped - BUDGET_MIN) / (BUDGET_SEGMENT_BOUNDARY - BUDGET_MIN)) * BUDGET_SEGMENT_A_PERCENT;
  }

  return (
    BUDGET_SEGMENT_A_PERCENT +
    ((clamped - BUDGET_SEGMENT_BOUNDARY) / (BUDGET_MAX - BUDGET_SEGMENT_BOUNDARY)) * (100 - BUDGET_SEGMENT_A_PERCENT)
  );
}

/**
 * 키보드 화살표 조작 시 현재 값 기준으로 적용할 step. 두 구간의 grid(A: 10만원 배수,
 * B: 50만원 배수)가 만나는 경계값(500만원)에서는 이동 방향에 따라 구간을 판정한다
 * (증가는 구간 B 취급, 감소는 구간 A 취급) — 그래야 어느 방향으로 가도 그 구간의 grid를
 * 벗어나는 어중간한 값이 생기지 않는다.
 */
export function stepForValue(value: number, direction: "increase" | "decrease"): number {
  if (direction === "increase") {
    return value < BUDGET_SEGMENT_BOUNDARY ? BUDGET_SEGMENT_A_STEP : BUDGET_SEGMENT_B_STEP;
  }
  return value <= BUDGET_SEGMENT_BOUNDARY ? BUDGET_SEGMENT_A_STEP : BUDGET_SEGMENT_B_STEP;
}

export interface BudgetTick {
  value: number;
  label: string;
}

/** 눈금 라벨 — 100만원 단위(+양끝)만 노출한다. 위치는 toPercent()로 구해 매핑 함수를 재사용한다. */
export const BUDGET_TICKS: BudgetTick[] = [
  { value: 500_000, label: "50만원" },
  { value: 1_000_000, label: "100만원" },
  { value: 2_000_000, label: "200만원" },
  { value: 3_000_000, label: "300만원" },
  { value: 4_000_000, label: "400만원" },
  { value: 5_000_000, label: "500만원" },
  { value: 6_000_000, label: "600만원" },
  { value: 7_000_000, label: "700만원" },
  { value: 8_000_000, label: "800만원" },
  { value: 9_000_000, label: "900만원" },
  { value: 10_000_000, label: "1,000만원" },
];
