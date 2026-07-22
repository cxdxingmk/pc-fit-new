import { describe, expect, it } from "vitest";
import { isNewPurchaseEligibleRam, isNewPurchaseEligibleSsd, isNewPurchaseEligibleMotherboard, isNewPurchaseEligiblePsu } from "./newPurchaseEligibility";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";

// GPU/CPU 판정 로직 자체(deriveNvidiaGpuSeries 등)는 recommender.test.ts에 이미 있는
// isNewPurchaseEligibleGpu/isNewPurchaseEligibleCpu 테스트가 그대로 커버한다(recommender.ts가
// 이 모듈에서 재수출만 함) — 여기서는 이번에 새로 추가한 RAM/SSD/모더보드/PSU만 다룬다.

describe("isNewPurchaseEligibleRam", () => {
  it("DDR5는 speed와 무관하게 항상 통과한다", () => {
    expect(isNewPurchaseEligibleRam({ ddr: "DDR5", speed: 4800 } as RAM)).toBe(true);
  });

  it("DDR4는 3200MHz 이상만 통과한다", () => {
    expect(isNewPurchaseEligibleRam({ ddr: "DDR4", speed: 3200 } as RAM)).toBe(true);
    expect(isNewPurchaseEligibleRam({ ddr: "DDR4", speed: 3600 } as RAM)).toBe(true);
  });

  it("DDR4가 3200MHz 미만이면 제외한다", () => {
    expect(isNewPurchaseEligibleRam({ ddr: "DDR4", speed: 2666 } as RAM)).toBe(false);
  });
});

describe("isNewPurchaseEligibleSsd", () => {
  it("2021년 이상은 통과한다", () => {
    expect(isNewPurchaseEligibleSsd({ releaseYear: 2021 } as SSD)).toBe(true);
    expect(isNewPurchaseEligibleSsd({ releaseYear: 2023 } as SSD)).toBe(true);
  });

  it("2021년 미만은 제외한다", () => {
    expect(isNewPurchaseEligibleSsd({ releaseYear: 2020 } as SSD)).toBe(false);
  });
});

describe("isNewPurchaseEligibleMotherboard", () => {
  it("2020년 이상은 통과한다", () => {
    expect(isNewPurchaseEligibleMotherboard({ releaseYear: 2020 } as MotherBoard)).toBe(true);
  });

  it("2020년 미만은 제외한다", () => {
    expect(isNewPurchaseEligibleMotherboard({ releaseYear: 2019 } as MotherBoard)).toBe(false);
  });
});

describe("isNewPurchaseEligiblePsu", () => {
  it("2020년 이상은 통과한다", () => {
    expect(isNewPurchaseEligiblePsu({ releaseYear: 2021 } as PSU)).toBe(true);
  });

  it("2020년 미만은 제외한다", () => {
    expect(isNewPurchaseEligiblePsu({ releaseYear: 2019 } as PSU)).toBe(false);
  });
});
