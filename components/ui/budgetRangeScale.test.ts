import { describe, expect, it } from "vitest";
import { BUDGET_MAX, BUDGET_MIN, BUDGET_STEP, BUDGET_TICKS, snapBudgetInput, toPercent, toValue } from "./budgetRangeScale";

describe("toValue — 물리적 위치(%) → 예산 값 (균등/선형 매핑)", () => {
  it("0% 지점은 정확히 50만원(BUDGET_MIN)이다", () => {
    expect(toValue(0)).toBe(BUDGET_MIN);
  });

  it("100% 지점은 정확히 1,000만원(BUDGET_MAX)이다", () => {
    expect(toValue(100)).toBe(BUDGET_MAX);
  });

  it("50% 지점은 이전 71.4%-구간A 371만원 방식이 아니라, (50만원+1,000만원)/2 ≈ 525만원 근처값이다", () => {
    const value = toValue(50);
    const expectedMidpoint = (BUDGET_MIN + BUDGET_MAX) / 2;
    expect(Math.abs(value - expectedMidpoint)).toBeLessThanOrEqual(BUDGET_STEP);
  });

  it("범위를 벗어난 percent는 0~100으로 클램프된다", () => {
    expect(toValue(-10)).toBe(BUDGET_MIN);
    expect(toValue(150)).toBe(BUDGET_MAX);
  });

  it("전 구간 어디서나 10만원 단위로 스냅된다", () => {
    for (const pct of [3, 17, 42, 58, 71, 89]) {
      expect((toValue(pct) - BUDGET_MIN) % BUDGET_STEP).toBe(0);
    }
  });
});

describe("toPercent — 예산 값 → 물리적 위치(%) (toValue의 역함수)", () => {
  it("50만원은 0%다", () => {
    expect(toPercent(BUDGET_MIN)).toBe(0);
  });

  it("1,000만원은 100%다", () => {
    expect(toPercent(BUDGET_MAX)).toBe(100);
  });

  it("(50만원+1,000만원)/2는 정확히 50%다(균등 매핑이므로 구간 경계 없이 순수 선형)", () => {
    expect(toPercent((BUDGET_MIN + BUDGET_MAX) / 2)).toBe(50);
  });
});

describe("snapBudgetInput — 직접 입력값 clamp/반올림", () => {
  it("50만~1,000만 범위를 벗어나면 가장 가까운 경계값으로 clamp한다", () => {
    expect(snapBudgetInput(100_000)).toBe(BUDGET_MIN);
    expect(snapBudgetInput(-5_000_000)).toBe(BUDGET_MIN);
    expect(snapBudgetInput(50_000_000)).toBe(BUDGET_MAX);
  });

  it("10만원 단위로 반올림한다", () => {
    expect(snapBudgetInput(1_540_000)).toBe(1_500_000);
    expect(snapBudgetInput(1_560_000)).toBe(1_600_000);
  });

  it("이미 10만원 단위인 값은 그대로 유지한다", () => {
    expect(snapBudgetInput(3_400_000)).toBe(3_400_000);
  });
});

describe("BUDGET_TICKS — 계층형 눈금", () => {
  it("10만원 간격으로 50만원부터 1,000만원까지 96개 지점을 만든다", () => {
    expect(BUDGET_TICKS.length).toBe(96);
    expect(BUDGET_TICKS[0].value).toBe(BUDGET_MIN);
    expect(BUDGET_TICKS[BUDGET_TICKS.length - 1].value).toBe(BUDGET_MAX);
  });

  it("100만원 단위(+양끝)만 major=true다", () => {
    const majors = BUDGET_TICKS.filter((t) => t.major).map((t) => t.value);
    expect(majors).toEqual([
      500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000, 7_000_000, 8_000_000, 9_000_000, 10_000_000,
    ]);
  });

  it("10만원 단위 보조 눈금(예: 110만원, 620만원)은 major=false다", () => {
    const minorSample = BUDGET_TICKS.find((t) => t.value === 1_100_000);
    expect(minorSample?.major).toBe(false);
  });

  it("모든 눈금의 물리적 위치는 균등 간격(선형)이다 — 인접한 두 눈금 사이 percent 차이가 전부 동일하다", () => {
    const gaps = BUDGET_TICKS.slice(1).map((tick, i) => tick.percent - BUDGET_TICKS[i].percent);
    const firstGap = gaps[0];
    for (const gap of gaps) {
      expect(Math.abs(gap - firstGap)).toBeLessThan(1e-9);
    }
  });
});
