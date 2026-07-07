import { describe, expect, it } from "vitest";
import { computeBudgetFactor, pickPurpose, recommend, selectDiversePool } from "./recommender";

describe("pickPurpose", () => {
  it("prefers the typed purposes[] array over string parsing when both are given", () => {
    expect(pickPurpose({ 1: ["사무"] }, ["gaming"])).toBe("gaming");
  });

  it("resolves multiple selected purposes using the documented priority order (ai beats gaming)", () => {
    expect(pickPurpose({}, ["gaming", "ai"])).toBe("ai");
    expect(pickPurpose({}, ["work", "dev", "video"])).toBe("video");
  });

  it("falls back to string-matching answers[1] when purposes[] is not provided", () => {
    expect(pickPurpose({ 1: ["게임"] })).toBe("gaming");
    expect(pickPurpose({ 1: ["AI 학습용"] })).toBe("ai");
  });

  it("defaults to work when nothing matches", () => {
    expect(pickPurpose({})).toBe("work");
    expect(pickPurpose({}, [])).toBe("work");
  });
});

describe("computeBudgetFactor", () => {
  it("returns 1 (no penalty) when no budget target is given", () => {
    expect(computeBudgetFactor(5_000_000, null)).toBe(1);
    expect(computeBudgetFactor(5_000_000, 0)).toBe(1);
  });

  it("scales between 0.9 and 1.0 when within budget, proportional to utilization", () => {
    expect(computeBudgetFactor(1_000_000, 1_000_000)).toBeCloseTo(1.0, 5);
    expect(computeBudgetFactor(500_000, 1_000_000)).toBeCloseTo(0.95, 5);
    expect(computeBudgetFactor(0, 1_000_000)).toBeCloseTo(0.9, 5);
  });

  it("decays exponentially the further over budget a candidate is", () => {
    const at10PercentOver = computeBudgetFactor(1_100_000, 1_000_000);
    const at50PercentOver = computeBudgetFactor(1_500_000, 1_000_000);
    const at100PercentOver = computeBudgetFactor(2_000_000, 1_000_000);

    expect(at10PercentOver).toBeCloseTo(Math.exp(-0.3), 5);
    expect(at50PercentOver).toBeCloseTo(Math.exp(-1.5), 5);
    expect(at100PercentOver).toBeCloseTo(Math.exp(-3), 5);
  });

  it("always ranks a smaller overage above a larger one (monotonic, never floors to a tie)", () => {
    const targets = [1_000_000, 1_200_000, 1_500_000, 2_000_000, 5_000_000];
    const factors = targets.map((price) => computeBudgetFactor(price, 1_000_000));
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeLessThan(factors[i - 1]);
      expect(factors[i]).toBeGreaterThan(0);
    }
  });
});

type Scored = { id: string; gameScore: number; workScore: number; aiScore: number; priceTier: "budget" | "mid" | "high" | "enthusiast" };

function scored(id: string, priceTier: Scored["priceTier"], gameScore: number): Scored {
  return { id, priceTier, gameScore, workScore: gameScore, aiScore: gameScore };
}

describe("selectDiversePool", () => {
  it("keeps parts from every price tier represented, not just the globally top-scoring tier", () => {
    const items: Scored[] = [
      scored("enthusiast-1", "enthusiast", 99),
      scored("enthusiast-2", "enthusiast", 98),
      scored("high-1", "high", 85),
      scored("mid-1", "mid", 70),
      scored("budget-1", "budget", 40),
      scored("budget-2", "budget", 35),
    ];

    const pool = selectDiversePool(items, "gaming", 4);
    const ids = pool.map((item) => item.id);

    expect(ids).toContain("budget-1");
    expect(ids).toContain("mid-1");
    expect(ids).toContain("high-1");
    expect(ids).toContain("enthusiast-1");
  });

  it("keeps only the top N per tier by purpose score when a tier has more than the limit", () => {
    const items: Scored[] = [
      scored("budget-low", "budget", 10),
      scored("budget-mid", "budget", 20),
      scored("budget-high", "budget", 30),
    ];

    const pool = selectDiversePool(items, "gaming", 2);
    const ids = pool.map((item) => item.id);

    expect(ids).toHaveLength(2);
    expect(ids).toContain("budget-high");
    expect(ids).toContain("budget-mid");
    expect(ids).not.toContain("budget-low");
  });
});

describe("recommend (integration)", () => {
  const existingParts = {
    CPU: { enabled: false, brand: "" as const, model: "" },
    GPU: { enabled: false, brand: "" as const, manufacturer: "", model: "" },
    RAM: { enabled: false, ddr: "" as const, capacity: "" as const, brand: "", model: "" },
    SSD: { enabled: false, capacity: "" as const, brand: "", model: "" },
    HDD: { enabled: false, capacity: "" as const },
    Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
    Power: { enabled: false, wattage: "" as const },
  };

  it("returns at most 3 results sorted by descending finalScore", () => {
    const results = recommend({ 1: ["게임"], 3: ["200~300만원"] }, existingParts, "none");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].finalScore).toBeLessThanOrEqual(results[i - 1].finalScore);
    }
  });

  it("only returns candidates that already passed the >=70 compatibility gate", () => {
    const results = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none");
    for (const result of results) {
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(70);
    }
  });

  it("recommends a meaningfully cheaper build for a low budget target than for a high one", () => {
    const cheap = recommend({ 1: ["사무"], 3: ["100만원 이하"] }, existingParts, "none");
    const expensive = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none");

    expect(cheap[0].totalPrice).toBeLessThan(expensive[0].totalPrice);
  });
});
