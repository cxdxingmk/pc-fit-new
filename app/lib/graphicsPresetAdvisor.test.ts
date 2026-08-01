import { describe, expect, it } from "vitest";
import { recommendGraphicsPreset } from "./graphicsPresetAdvisor";
import type { DisplayMatchRow, DisplayTier, Bottleneck } from "./displayMatch";
import { gpus } from "../database/gpu";

const nvidiaGpu = gpus.find((g) => g.id === "rtx4070-super")!; // dlss + rayTracing
const amdGpu = gpus.find((g) => g.id === "rx7800xt")!; // fsr + rayTracing, no dlss
const noUpscalingGpu = gpus.find((g) => g.id === "gtx1660super")!; // no dlss/fsr/xess/rayTracing

function makeRow(overrides: Partial<DisplayMatchRow> & { status: DisplayTier }): DisplayMatchRow {
  return {
    id: "cyberpunk",
    label: "사이버펑크 2077",
    category: "게임/RT",
    baseScore: 80,
    message: "",
    bottleneck: "GPU",
    targetHz: 144,
    estimatedFps: 100,
    defendedFpsTier: 90,
    effectiveScore: 80,
    defenseRatio: 1.0,
    vramHit: false,
    resolution: "QHD",
    ...overrides,
  };
}

describe("recommendGraphicsPreset", () => {
  const ALL_TIERS: DisplayTier[] = ["PERFECT", "GOOD", "LACK_GPU", "LACK_CPU", "CRITICAL"];

  it("produces preset wording for every possible DisplayTier status", () => {
    for (const status of ALL_TIERS) {
      const advice = recommendGraphicsPreset(makeRow({ status }), nvidiaGpu);
      expect(advice.presetLabel).toBeTruthy();
      expect(advice.note).toContain("사이버펑크 2077");
    }
  });

  it("PERFECT recommends the highest preset with no resolution/upscaling advice needed", () => {
    const advice = recommendGraphicsPreset(makeRow({ status: "PERFECT" }), nvidiaGpu);
    expect(advice.presetLabel).toBe("최상");
    expect(advice.resolutionAdvice).toBeNull();
    expect(advice.upscalingAdvice).toBeNull();
  });

  it("GOOD recommends 높음 with no extra advice", () => {
    const advice = recommendGraphicsPreset(makeRow({ status: "GOOD" }), nvidiaGpu);
    expect(advice.presetLabel).toBe("높음");
    expect(advice.resolutionAdvice).toBeNull();
    expect(advice.upscalingAdvice).toBeNull();
  });

  it("LACK_GPU with vramHit suggests lowering resolution, without it suggests lowering the preset only", () => {
    const withVram = recommendGraphicsPreset(makeRow({ status: "LACK_GPU", vramHit: true }), nvidiaGpu);
    expect(withVram.presetLabel).toBe("중간");
    expect(withVram.resolutionAdvice).toMatch(/해상도/);

    const withoutVram = recommendGraphicsPreset(makeRow({ status: "LACK_GPU", vramHit: false }), nvidiaGpu);
    expect(withoutVram.presetLabel).toBe("중간");
    expect(withoutVram.resolutionAdvice).not.toMatch(/해상도/);
  });

  it("LACK_CPU notes that lowering graphics options won't help much (CPU-bound)", () => {
    const advice = recommendGraphicsPreset(makeRow({ status: "LACK_CPU", bottleneck: "CPU" as Bottleneck }), nvidiaGpu);
    expect(advice.presetLabel).toBe("중간");
    expect(advice.note).toContain("CPU");
  });

  it("CRITICAL recommends the lowest preset and always advises lowering resolution", () => {
    const advice = recommendGraphicsPreset(makeRow({ status: "CRITICAL" }), nvidiaGpu);
    expect(advice.presetLabel).toBe("낮음");
    expect(advice.resolutionAdvice).toMatch(/해상도/);
  });

  it("prefers DLSS for NVIDIA GPUs that support it", () => {
    const advice = recommendGraphicsPreset(makeRow({ status: "LACK_GPU" }), nvidiaGpu);
    expect(advice.upscalingAdvice).toContain("DLSS");
  });

  it("falls back to FSR for AMD GPUs without DLSS", () => {
    const advice = recommendGraphicsPreset(makeRow({ status: "LACK_GPU" }), amdGpu);
    expect(advice.upscalingAdvice).toContain("FSR");
  });

  it("omits upscaling advice when the GPU supports no upscaling tech at all", () => {
    const advice = recommendGraphicsPreset(makeRow({ status: "LACK_GPU" }), noUpscalingGpu);
    expect(advice.upscalingAdvice).toBeNull();
  });

  it("only mentions ray tracing headroom in the PERFECT note when the GPU actually supports it", () => {
    const withRt = recommendGraphicsPreset(makeRow({ status: "PERFECT" }), nvidiaGpu);
    expect(withRt.note).toContain("레이트레이싱");

    const withoutRt = recommendGraphicsPreset(makeRow({ status: "PERFECT" }), noUpscalingGpu);
    expect(withoutRt.note).not.toContain("레이트레이싱");
  });
});
