import { describe, expect, it } from "vitest";
import {
  WORKLOADS,
  scoreAllWorkloads,
  scoreWorkloadsByCategory,
  validateWorkloadWeights,
  evaluateAllGames,
  anchorCorrectedFps,
  anchorCorrectedMessage,
  getEngineCapFps,
} from "./workloadScoring";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";

const highEndCpu: CPU = cpus.find((c) => c.id === "i9-14900k") ?? cpus[0];
const highEndNvidiaGpu: GPU = gpus.find((g) => g.brand === "NVIDIA" && g.rayTracing && g.vram >= 16) ?? gpus[0];

const budgetCpu: CPU = cpus.reduce((min, c) => (c.gameScore < min.gameScore ? c : min), cpus[0]);
const lowVramAmdGpu: GPU =
  gpus.find((g) => g.brand === "AMD" && g.vram <= 6) ?? gpus.reduce((min, g) => (g.vram < min.vram ? g : min), gpus[0]);

describe("WORKLOADS weight integrity", () => {
  it("has exactly 43 workloads", () => {
    expect(WORKLOADS.length).toBe(43);
  });

  it("has unique ids", () => {
    const ids = WORKLOADS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every workload's weights sum to 1.0", () => {
    expect(validateWorkloadWeights()).toEqual([]);
  });
});

describe("scoreAllWorkloads", () => {
  it("produces 43 scores with no NaN and within 0-100 for a high-end pairing", () => {
    const results = scoreAllWorkloads(highEndCpu, highEndNvidiaGpu);
    expect(results).toHaveLength(43);
    for (const r of results) {
      expect(Number.isNaN(r.score)).toBe(false);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("produces no NaN for a budget/low-VRAM non-NVIDIA pairing (penalty edge cases)", () => {
    const results = scoreAllWorkloads(budgetCpu, lowVramAmdGpu);
    for (const r of results) {
      expect(Number.isNaN(r.score)).toBe(false);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it("applies the CUDA penalty to CUDA-only workloads on non-NVIDIA GPUs", () => {
    if (lowVramAmdGpu.brand === "NVIDIA") return; // no non-NVIDIA GPU in catalog to test against
    const results = scoreAllWorkloads(highEndCpu, lowVramAmdGpu);
    const pytorch = results.find((r) => r.id === "pytorch");
    expect(pytorch).toBeDefined();
    expect(pytorch!.penalties.some((p) => p.includes("CUDA"))).toBe(true);
  });

  it("applies a VRAM floor penalty when GPU VRAM is under a workload's requirement", () => {
    const tinyVramGpu: GPU = { ...highEndNvidiaGpu, vram: 4 };
    const results = scoreAllWorkloads(highEndCpu, tinyVramGpu);
    const pytorch = results.find((r) => r.id === "pytorch");
    expect(pytorch!.penalties.some((p) => p.includes("VRAM"))).toBe(true);
  });

  it("does not penalize CUDA-only workloads on NVIDIA GPUs", () => {
    const results = scoreAllWorkloads(highEndCpu, highEndNvidiaGpu);
    const pytorch = results.find((r) => r.id === "pytorch");
    expect(pytorch!.penalties.some((p) => p.includes("CUDA"))).toBe(false);
  });
});

describe("scoreWorkloadsByCategory", () => {
  it("returns a non-NaN average per category", () => {
    const byCategory = scoreWorkloadsByCategory(highEndCpu, highEndNvidiaGpu);
    const categories = new Set(WORKLOADS.map((w) => w.category));
    expect(Object.keys(byCategory).length).toBe(categories.size);
    for (const value of Object.values(byCategory)) {
      expect(Number.isNaN(value)).toBe(false);
    }
  });
});

describe("real catalog regression check", () => {
  it("has no NaN scores across every CPU x sampled GPU in the merged catalog", () => {
    const sampleGpus = [gpus[0], gpus[Math.floor(gpus.length / 2)], gpus[gpus.length - 1]];
    for (const cpu of cpus) {
      for (const gpu of sampleGpus) {
        const results = scoreAllWorkloads(cpu, gpu);
        for (const r of results) {
          expect(Number.isNaN(r.score)).toBe(false);
        }
      }
    }
  });
});

// 회귀 가드: 카드 헤드라인(anchorCorrectedFps)과 하단 설명 문구(anchorCorrectedMessage)가
// 서로 다른 fps를 말하던 버그(예: 헤드라인 233~249fps인데 설명은 "예상 137fps") 재발 방지.
describe("game card headline/description fps consistency", () => {
  // displayMatch.ts의 FPS_TIERS를 그대로 미러링 — buildMessage()가 LACK_*/CRITICAL 상태일 때
  // "실제로는 N fps 정도예요"에 쓰는 값이 정확히 이 배열에서 가장 가까운 항목이어야 한다.
  const FPS_TIERS_MIRROR = [30, 45, 60, 90, 120, 144, 165, 240, 300, 360];
  function nearestFpsTierMirror(fps: number): number {
    return FPS_TIERS_MIRROR.reduce((best, t) => (Math.abs(t - fps) < Math.abs(best - fps) ? t : best), FPS_TIERS_MIRROR[0]);
  }

  function extractFpsNumbers(message: string): number[] {
    return [...message.matchAll(/(\d+)\s*fps/g)].map((m) => Number(m[1]));
  }

  const budgetGameCpu: CPU = cpus.find((c) => c.id === "r5-5600") ?? budgetCpu;
  const budgetGameGpu: GPU = gpus.find((g) => g.id === "gtx1660super") ?? lowVramAmdGpu;
  const referenceCpu: CPU = cpus.find((c) => c.id === "i9-14900k") ?? highEndCpu;
  const referenceGpu: GPU = gpus.find((g) => g.id === "rtx4070-super") ?? highEndNvidiaGpu;

  const samples: [string, CPU, GPU][] = [
    ["budget (Ryzen 5 5600 + GTX 1660 SUPER)", budgetGameCpu, budgetGameGpu],
    ["reference (i9-14900K + RTX 4070 SUPER)", referenceCpu, referenceGpu],
  ];

  for (const [label, cpu, gpu] of samples) {
    it(`headline and description never state contradictory fps numbers — ${label}`, () => {
      const scores = scoreAllWorkloads(cpu, gpu, 16);
      const rows = evaluateAllGames(scores, "QHD", 144, gpu.vram);
      expect(rows.length).toBeGreaterThan(0);

      for (const row of rows) {
        const corrected = anchorCorrectedFps(row.id, row.estimatedFps);
        if (corrected == null) continue;

        const message = anchorCorrectedMessage(row.id, row, corrected);
        const cap = getEngineCapFps(row.id);
        const numbersInMessage = extractFpsNumbers(message);

        if (cap != null && corrected >= cap) {
          // 엔진 캡이 걸린 경우 — 설명 문구가 캡 값을 그대로 말해야 한다(예: 엘든 링 60fps).
          expect(numbersInMessage, `"${row.label}": "${message}"`).toContain(cap);
          continue;
        }

        expect(numbersInMessage.length, `"${row.label}" 설명 문구에 fps 숫자가 없음: "${message}"`).toBeGreaterThan(0);

        // PERFECT/GOOD은 보정된 fps를 그대로 문장에 넣고, 나머지 상태는 가장 가까운 표준 fps
        // 티어로 반올림해 넣는다(buildMessage 참고) — 둘 중 어느 쪽이든 정확히 일치해야 한다.
        const expected = row.status === "PERFECT" || row.status === "GOOD" ? corrected : nearestFpsTierMirror(corrected);
        expect(
          numbersInMessage,
          `"${row.label}" 헤드라인 보정치=${corrected}fps(기대값=${expected})인데 설명 문구는 "${message}"`
        ).toContain(expected);
      }
    });
  }
});
