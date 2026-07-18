import { describe, expect, it } from "vitest";
import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_SEGMENT_A_PERCENT,
  BUDGET_SEGMENT_A_STEP,
  BUDGET_SEGMENT_B_STEP,
  BUDGET_SEGMENT_BOUNDARY,
  BUDGET_TICKS,
  stepForValue,
  toPercent,
  toValue,
} from "./budgetRangeScale";

describe("toValue — 물리적 위치(%) → 예산 값", () => {
  it("0% 지점은 정확히 50만원(BUDGET_MIN)이다", () => {
    expect(toValue(0)).toBe(BUDGET_MIN);
  });

  it("70% 지점(구간 A/B 경계)은 정확히 500만원이며, 값이 끊기지 않는다", () => {
    expect(toValue(BUDGET_SEGMENT_A_PERCENT)).toBe(BUDGET_SEGMENT_BOUNDARY);
  });

  it("100% 지점은 정확히 1,000만원(BUDGET_MAX)이다", () => {
    expect(toValue(100)).toBe(BUDGET_MAX);
  });

  it("50% 지점은 구간 A 내부의 선형 매핑을 따르며, 정확히 500만원이 아니라 ~371만원 근처값이다", () => {
    const value = toValue(50);
    const expectedRaw = BUDGET_MIN + (50 / BUDGET_SEGMENT_A_PERCENT) * (BUDGET_SEGMENT_BOUNDARY - BUDGET_MIN);

    expect(value).not.toBe(BUDGET_SEGMENT_BOUNDARY);
    expect(Math.abs(value - expectedRaw)).toBeLessThanOrEqual(BUDGET_SEGMENT_A_STEP);
    expect(expectedRaw).toBeCloseTo(3_714_285.71, 0);
  });

  it("범위를 벗어난 percent는 0~100으로 클램프된다", () => {
    expect(toValue(-10)).toBe(BUDGET_MIN);
    expect(toValue(150)).toBe(BUDGET_MAX);
  });

  it("구간 A 안에서는 10만원 단위로 스냅된다", () => {
    const value = toValue(10);
    expect((value - BUDGET_MIN) % BUDGET_SEGMENT_A_STEP).toBe(0);
  });

  it("구간 B 안에서는 50만원 단위로 스냅된다", () => {
    const value = toValue(90);
    expect((value - BUDGET_SEGMENT_BOUNDARY) % BUDGET_SEGMENT_B_STEP).toBe(0);
  });
});

describe("toPercent — 예산 값 → 물리적 위치(%) (toValue의 역함수)", () => {
  it("50만원은 0%다", () => {
    expect(toPercent(BUDGET_MIN)).toBe(0);
  });

  it("500만원(경계)은 정확히 70%다", () => {
    expect(toPercent(BUDGET_SEGMENT_BOUNDARY)).toBe(BUDGET_SEGMENT_A_PERCENT);
  });

  it("1,000만원은 100%다", () => {
    expect(toPercent(BUDGET_MAX)).toBe(100);
  });

  it("toValue(50)을 다시 toPercent에 넣으면 대략 50% 근처로 돌아온다", () => {
    const roundTripped = toPercent(toValue(50));
    expect(Math.abs(roundTripped - 50)).toBeLessThan(1);
  });
});

describe("stepForValue — 키보드 조작 시 구간별 step", () => {
  it("구간 A(500만원 미만) 안에서는 증가/감소 모두 10만원 step이다", () => {
    expect(stepForValue(1_000_000, "increase")).toBe(BUDGET_SEGMENT_A_STEP);
    expect(stepForValue(1_000_000, "decrease")).toBe(BUDGET_SEGMENT_A_STEP);
  });

  it("구간 B(500만원 초과) 안에서는 증가/감소 모두 50만원 step이다", () => {
    expect(stepForValue(7_000_000, "increase")).toBe(BUDGET_SEGMENT_B_STEP);
    expect(stepForValue(7_000_000, "decrease")).toBe(BUDGET_SEGMENT_B_STEP);
  });

  it("경계(500만원)에서는 증가 시 구간 B, 감소 시 구간 A의 step을 써서 각 구간 grid를 벗어나지 않는다", () => {
    expect(stepForValue(BUDGET_SEGMENT_BOUNDARY, "increase")).toBe(BUDGET_SEGMENT_B_STEP);
    expect(stepForValue(BUDGET_SEGMENT_BOUNDARY, "decrease")).toBe(BUDGET_SEGMENT_A_STEP);
  });
});

describe("BUDGET_TICKS — 눈금 라벨", () => {
  it("50만원(최소)부터 1,000만원(최대)까지 100만원 단위로만 라벨을 노출한다(10만원 단위 라벨 없음)", () => {
    expect(BUDGET_TICKS.map((t) => t.value)).toEqual([
      500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000,
    ]);
  });

  it("같은 100만원 폭이라도 구간 A 눈금 간격이 구간 B 눈금 간격보다 물리적으로 더 넓다", () => {
    const percents = BUDGET_TICKS.map((t) => toPercent(t.value));
    const segmentAGap = percents[2] - percents[1]; // 100만원 → 200만원 (구간 A 내부, 100만원 폭)
    const segmentBGap = percents[BUDGET_TICKS.length - 1] - percents[BUDGET_TICKS.length - 2]; // 900만원 → 1000만원 (구간 B 내부, 100만원 폭)
    expect(segmentAGap).toBeGreaterThan(segmentBGap);
  });
});
