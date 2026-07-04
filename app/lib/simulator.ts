import { cpuMasterDb, gameBenchmarkMock, gpuMasterDb, type Resolution, type SimulationResult, type UserSavedPc } from "../types/hardware";

const resolutionRank: Record<Resolution, number> = {
  FHD: 1,
  QHD: 2,
  "4K": 3,
};

const resolutionFactor: Record<Resolution, number> = {
  FHD: 1,
  QHD: 0.82,
  "4K": 0.63,
};

export function simulatePcPerformance(preset: UserSavedPc, gameTitle: string, resolution: Resolution): SimulationResult {
  const cpu = cpuMasterDb.find((item) => item.id === preset.cpuId) ?? cpuMasterDb[0];
  const gpu = gpuMasterDb.find((item) => item.id === preset.gpuId) ?? gpuMasterDb[0];
  const cpuScore = Number(cpu.benchmarks?.multicore ?? 82);
  const gpuScore = Number(gpu.benchmarks?.graphics ?? 82);
  const gameModel = gameBenchmarkMock[gameTitle as keyof typeof gameBenchmarkMock] ?? {
    base: 98,
    gpuWeight: 0.88,
    cpuWeight: 0.3,
    intensity: 1,
  };

  const rawFps = (gameModel.base + gpuScore * gameModel.gpuWeight + cpuScore * gameModel.cpuWeight) * resolutionFactor[resolution] / gameModel.intensity;

  const monitorResolutionPenalty = resolutionRank[resolution] > resolutionRank[preset.monitorResolution] ? 0.84 : 1;
  const renderedFps = Math.max(20, Math.round(rawFps * monitorResolutionPenalty));
  const averageFps = Math.min(renderedFps, preset.monitorRefreshRate);
  const onePercentLowFps = Math.max(12, Math.round(averageFps * 0.78 + Math.min(cpuScore, gpuScore) * 0.09));

  const monitorLimitedByRefresh = renderedFps > preset.monitorRefreshRate;
  const monitorLimitedByResolution = resolutionRank[resolution] > resolutionRank[preset.monitorResolution];

  return {
    cpuId: cpu.id,
    gpuId: gpu.id,
    gameTitle,
    resolution,
    renderedFps,
    averageFps,
    onePercentLowFps,
    monitorRefreshRate: preset.monitorRefreshRate,
    monitorLimited: monitorLimitedByRefresh || monitorLimitedByResolution,
    monitorBottleneck: monitorLimitedByResolution ? "RESOLUTION_LIMIT" : monitorLimitedByRefresh ? "REFRESH_CAP" : "NONE",
    recommendUpscaling: resolution === "4K" || averageFps < 90,
  };
}
