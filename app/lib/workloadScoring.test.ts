import { describe, expect, it } from "vitest";
import { WORKLOADS, scoreAllWorkloads, scoreWorkloadsByCategory, validateWorkloadWeights } from "./workloadScoring";
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
