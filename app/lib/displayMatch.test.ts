import { describe, expect, it } from "vitest";
import { evaluateDisplayMatch, evaluateAllGames, regenerateDisplayStatus, type Resolution, type RefreshRate, type DisplayTier } from "./displayMatch";
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

// 회귀 가드: 엘든 링처럼 앵커/엔진 캡 보정폭이 큰 게임에서 헤드라인은 49~53fps인데
// 배지는 raw(보정 전) fps 기준 PERFECT로 뜨던 버그. 배지는 반드시 regenerateDisplayStatus()로
// "보정된" fps를 다시 판정해야 하고, 목표 주사율(144Hz)에 한참 못 미치는 49~53fps에서
// 절대 PERFECT/GOOD이 나오면 안 된다.
describe("regenerateDisplayStatus", () => {
  it('49~53fps · 144Hz 목표에서는 절대 "PERFECT"/"GOOD" 배지가 나오지 않는다(엘든 링 회귀 케이스)', () => {
    // raw 판정은 일부러 PERFECT가 되도록 유리한 조건(FHD)으로 originate — 이게 그 버그의 핵심:
    // 원래(raw) 상태가 좋아 보여도, 보정된 fps로 다시 판정하면 실제 체감과 일치해야 한다.
    const row = evaluateDisplayMatch(95, "게임/GPU래스터", "FHD", 60);
    expect(row.status === "PERFECT" || row.status === "GOOD").toBe(true); // raw 판정 확인(전제 조건)

    // 실제 유저 화면 조건(QHD/144Hz)에서 앵커/엔진 캡 보정 후 49~53fps로 떨어진 상황을 재현.
    const capped144 = { ...row, targetHz: 144 as const };
    for (const correctedFps of [49, 50, 51, 52, 53]) {
      const status = regenerateDisplayStatus(capped144, correctedFps);
      expect(status, `correctedFps=${correctedFps}인데 status=${status}`).not.toBe("PERFECT");
      expect(status, `correctedFps=${correctedFps}인데 status=${status}`).not.toBe("GOOD");
    }
  });

  it("보정된 fps가 목표 주사율을 실제로 충족하면 PERFECT로 재판정된다(오탐 방지 확인)", () => {
    const row = evaluateDisplayMatch(50, "게임/GPU래스터", "FHD", 60);
    const status = regenerateDisplayStatus(row, 300); // 60Hz 목표를 여유 있게 충족
    expect(status).toBe("PERFECT");
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
