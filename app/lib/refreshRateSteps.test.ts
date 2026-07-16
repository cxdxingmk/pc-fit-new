import { describe, expect, it } from "vitest";
import {
  REFRESH_RATE_STEPS,
  MIN_REFRESH_RATE,
  MAX_REFRESH_RATE,
  isRefreshRateStep,
  snapToNearestRefreshRate,
} from "./refreshRateSteps";

describe("모니터 주사율 표준 단계", () => {
  it("표준 규격 단계를 정확히 이 순서로 제공한다", () => {
    expect([...REFRESH_RATE_STEPS]).toEqual([60, 75, 100, 120, 144, 165, 180, 240, 360, 480, 540]);
  });

  it("경계값이 60 / 540이다", () => {
    expect(MIN_REFRESH_RATE).toBe(60);
    expect(MAX_REFRESH_RATE).toBe(540);
  });

  it("단계 사이 간격이 균일하지 않다(그래서 step=1 스피너로는 표현할 수 없다)", () => {
    // 144 다음은 145가 아니라 165여야 한다는 요구사항의 근거를 고정한다.
    const index144 = REFRESH_RATE_STEPS.indexOf(144);
    expect(REFRESH_RATE_STEPS[index144 + 1]).toBe(165);
    expect(REFRESH_RATE_STEPS[index144 - 1]).toBe(120);
  });

  it("isRefreshRateStep는 표준 단계만 통과시킨다", () => {
    expect(isRefreshRateStep(144)).toBe(true);
    expect(isRefreshRateStep(540)).toBe(true);
    expect(isRefreshRateStep(145)).toBe(false);
    expect(isRefreshRateStep(200)).toBe(false);
  });
});

describe("snapToNearestRefreshRate — 비표준 값 정규화", () => {
  it("표준 단계는 그대로 유지한다", () => {
    for (const step of REFRESH_RATE_STEPS) {
      expect(snapToNearestRefreshRate(step)).toBe(step);
    }
  });

  it("예전 자유 입력 시절의 비표준 값을 가장 가까운 단계로 맞춘다", () => {
    expect(snapToNearestRefreshRate(200)).toBe(180); // |200-180|=20 < |200-240|=40
    expect(snapToNearestRefreshRate(145)).toBe(144);
    expect(snapToNearestRefreshRate(61)).toBe(60);
    expect(snapToNearestRefreshRate(239)).toBe(240);
  });

  it("범위를 벗어난 값은 양끝(60/540)으로 수렴한다", () => {
    expect(snapToNearestRefreshRate(30)).toBe(60);
    expect(snapToNearestRefreshRate(1000)).toBe(540);
  });

  it("숫자가 아닌 값에도 throw하지 않고 최소값으로 폴백한다", () => {
    expect(snapToNearestRefreshRate(Number.NaN)).toBe(60);
  });
});
