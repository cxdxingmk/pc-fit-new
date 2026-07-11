import { describe, expect, it } from "vitest";
import { evaluateDisplayMatch, evaluateAllGames, type Resolution, type RefreshRate, type DisplayTier } from "./displayMatch";
import { WORKLOADS } from "./workloadScoring";

const ALL_TIERS: DisplayTier[] = ["PERFECT", "GOOD", "LACK_GPU", "LACK_CPU", "CRITICAL"];
const RESOLUTIONS: Resolution[] = ["FHD", "QHD", "4K"];
const REFRESH_RATES: RefreshRate[] = [60, 144, 240];
const GAME_CATEGORIES = ["게임/CPU클럭", "게임/멀티코어", "게임/GPU래스터", "게임/RT"];

describe("evaluateDisplayMatch", () => {
  it("flags LACK_GPU for a mediocre RT-heavy game pushed to 4K/144Hz", () => {
    const result = evaluateDisplayMatch(68, "게임/RT", "4K", 144);
    expect(result.status).toBe("LACK_GPU");
  });

  it("flags PERFECT for a strong CPU-bound esports title at FHD/240Hz", () => {
    const result = evaluateDisplayMatch(93, "게임/CPU클럭", "FHD", 240);
    expect(result.status).toBe("PERFECT");
  });

  it("matches the game category strings actually produced by workloadScoring.ts", () => {
    const engineGameCategories = new Set(
      WORKLOADS.filter((w) => w.category.startsWith("게임/")).map((w) => w.category)
    );
    expect(Array.from(engineGameCategories).sort()).toEqual([...GAME_CATEGORIES].sort());
  });

  it("never produces NaN/non-finite numeric fields across the full combination matrix", () => {
    for (const res of RESOLUTIONS) {
      for (const hz of REFRESH_RATES) {
        for (const category of GAME_CATEGORIES) {
          for (const baseScore of [0, 25, 50, 75, 100]) {
            const result = evaluateDisplayMatch(baseScore, category, res, hz, 8);
            expect(Number.isFinite(result.estimatedFps)).toBe(true);
            expect(Number.isFinite(result.effectiveScore)).toBe(true);
            expect(Number.isFinite(result.defenseRatio)).toBe(true);
            expect(ALL_TIERS).toContain(result.status);
          }
        }
      }
    }
  });

  it("handles boundary baseScore values (0 and 100) without throwing, for every game category", () => {
    for (const category of GAME_CATEGORIES) {
      for (const baseScore of [0, 100]) {
        expect(() => evaluateDisplayMatch(baseScore, category, "QHD", 144)).not.toThrow();
        const result = evaluateDisplayMatch(baseScore, category, "QHD", 144);
        expect(ALL_TIERS).toContain(result.status);
      }
    }
  });

  it("returns a null-fps passthrough result for non-game categories", () => {
    const result = evaluateDisplayMatch(75, "AI/딥러닝", "4K", 144);
    expect(result.estimatedFps).toBeNull();
    expect(result.defendedFpsTier).toBeNull();
    expect(result.bottleneck).toBe("BALANCED");
  });
});

describe("evaluateAllGames", () => {
  it("filters to only game categories and preserves label/category/baseScore", () => {
    const scores = [
      { id: "lol", label: "리그 오브 레전드", category: "게임/CPU클럭", score: 90 },
      { id: "autocad", label: "오토캐드", category: "CAD", score: 80 },
    ];
    const rows = evaluateAllGames(scores, "FHD", 144, 12);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("리그 오브 레전드");
    expect(rows[0].baseScore).toBe(90);
  });
});
