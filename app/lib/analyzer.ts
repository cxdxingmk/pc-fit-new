import {
  type BottleneckResult,
  type Component,
  type CpuComponent,
  type FpsResult,
  type GpuComponent,
  type MotherboardComponent,
  type MotherboardChipsetAlpha,
  type UpgradeProposal,
  type UserPreset,
} from "../types/hardware";

const cpuCatalog: CpuComponent[] = [
  {
    id: "intel-ultra-9-285k",
    category: "CPU",
    brand: "Intel",
    name: "Core Ultra 9 285K",
    matchKeywords: ["ultra 9", "285k", "intel"],
    price: 799,
    specs: {
      socket: "LGA1851",
      generation: "인텔 코어 울트라 200S",
      cores: 24,
      threads: 24,
      defaultPower: 125,
      tops: 120,
    },
    benchmarks: { multicore: 96, singlecore: 93, ai: 97 },
    estimatedPrice: 799,
  },
  {
    id: "intel-i7-14700k",
    category: "CPU",
    brand: "Intel",
    name: "Core i7-14700K",
    matchKeywords: ["i7", "14700k", "intel"],
    price: 389,
    specs: {
      socket: "LGA1700",
      generation: "인텔 코어 i7 14세대",
      cores: 20,
      threads: 28,
      defaultPower: 125,
      tops: 92,
    },
    benchmarks: { multicore: 90, singlecore: 87, ai: 88 },
    estimatedPrice: 389,
  },
  {
    id: "amd-ryzen-9-9950x",
    category: "CPU",
    brand: "AMD",
    name: "Ryzen 9 9950X",
    matchKeywords: ["ryzen", "9950x", "amd"],
    price: 689,
    specs: {
      socket: "AM5",
      generation: "라이젠 9000 시리즈",
      cores: 16,
      threads: 32,
      defaultPower: 170,
      tops: 125,
    },
    benchmarks: { multicore: 98, singlecore: 95, ai: 99 },
    estimatedPrice: 689,
  },
  {
    id: "amd-ryzen-7-9700x",
    category: "CPU",
    brand: "AMD",
    name: "Ryzen 7 9700X",
    matchKeywords: ["ryzen", "9700x", "amd"],
    price: 299,
    specs: {
      socket: "AM5",
      generation: "라이젠 9000 시리즈",
      cores: 8,
      threads: 16,
      defaultPower: 65,
      tops: 84,
    },
    benchmarks: { multicore: 82, singlecore: 89, ai: 85 },
    estimatedPrice: 299,
  },
];

const gpuCatalog: GpuComponent[] = [
  {
    id: "rtx-5080",
    category: "GPU",
    brand: "NVIDIA",
    name: "GeForce RTX 5080",
    matchKeywords: ["rtx", "5080", "nvidia"],
    price: 1199,
    specs: {
      vram: 16,
      tgpW: 360,
      dlss: true,
      fsr: false,
      gpuLengthMm: 304,
    },
    benchmarks: { graphics: 99, ai: 98 },
    estimatedPrice: 1199,
  },
  {
    id: "rtx-4070-ti-super",
    category: "GPU",
    brand: "NVIDIA",
    name: "GeForce RTX 4070 Ti SUPER",
    matchKeywords: ["rtx", "4070 ti super", "nvidia"],
    price: 799,
    specs: {
      vram: 16,
      tgpW: 285,
      dlss: true,
      fsr: false,
      gpuLengthMm: 267,
    },
    benchmarks: { graphics: 95, ai: 95 },
    estimatedPrice: 799,
  },
  {
    id: "rtx-4070-super",
    category: "GPU",
    brand: "NVIDIA",
    name: "GeForce RTX 4070 SUPER",
    matchKeywords: ["rtx", "4070 super", "nvidia"],
    price: 599,
    specs: {
      vram: 12,
      tgpW: 220,
      dlss: true,
      fsr: false,
      gpuLengthMm: 242,
    },
    benchmarks: { graphics: 90, ai: 89 },
    estimatedPrice: 599,
  },
  {
    id: "rx-7800-xt",
    category: "GPU",
    brand: "AMD",
    name: "Radeon RX 7800 XT",
    matchKeywords: ["rx", "7800 xt", "amd"],
    price: 499,
    specs: {
      vram: 16,
      tgpW: 263,
      dlss: false,
      fsr: true,
      gpuLengthMm: 280,
    },
    benchmarks: { graphics: 88, ai: 82 },
    estimatedPrice: 499,
  },
];

const motherboardCatalog: MotherboardComponent[] = [
  {
    id: "mb-z890",
    category: "MB",
    brand: "ASUS",
    name: "인텔 Z890 칩셋 메인보드",
    matchKeywords: ["z890", "intel", "lga1851"],
    price: 369,
    specs: {
      socket: "LGA1851",
      chipsetAlpha: "Z",
      chipsetNumber: "890",
      mbSizeATX: "ATX",
      memorySlots: 4,
      maxMemoryGb: 256,
    },
    benchmarks: { graphics: 0, multicore: 0, singlecore: 0, ai: 0 },
    estimatedPrice: 369,
  },
  {
    id: "mb-b760",
    category: "MB",
    brand: "MSI",
    name: "인텔 B760 칩셋 메인보드",
    matchKeywords: ["b760", "intel", "lga1700"],
    price: 189,
    specs: {
      socket: "LGA1700",
      chipsetAlpha: "B",
      chipsetNumber: "760",
      mbSizeATX: "ATX",
      memorySlots: 4,
      maxMemoryGb: 192,
    },
    benchmarks: { graphics: 0, multicore: 0, singlecore: 0, ai: 0 },
    estimatedPrice: 189,
  },
  {
    id: "mb-b650",
    category: "MB",
    brand: "Gigabyte",
    name: "AMD B650 칩셋 메인보드",
    matchKeywords: ["b650", "amd", "am5"],
    price: 219,
    specs: {
      socket: "AM5",
      chipsetAlpha: "B",
      chipsetNumber: "650",
      mbSizeATX: "ATX",
      memorySlots: 4,
      maxMemoryGb: 192,
    },
    benchmarks: { graphics: 0, multicore: 0, singlecore: 0, ai: 0 },
    estimatedPrice: 219,
  },
];

const ramCatalog: Component[] = [
  { id: "ram-32gb", category: "RAM", brand: "Corsair", name: "DDR5-32GB", matchKeywords: ["ram", "32gb", "ddr5"], price: 149, specs: { capacityGb: 32 }, benchmarks: { productivity: 75 }, estimatedPrice: 149 },
  { id: "ram-64gb", category: "RAM", brand: "Kingston", name: "DDR5-64GB", matchKeywords: ["ram", "64gb", "ddr5"], price: 269, specs: { capacityGb: 64 }, benchmarks: { productivity: 92 }, estimatedPrice: 269 },
];

const ssdCatalog: Component[] = [
  { id: "ssd-1tb", category: "SSD", brand: "WD", name: "SN770 1TB", matchKeywords: ["ssd", "1tb", "nvme"], price: 89, specs: { capacityGb: 1000 }, benchmarks: { productivity: 70 }, estimatedPrice: 89 },
  { id: "ssd-2tb", category: "SSD", brand: "Samsung", name: "990 EVO 2TB", matchKeywords: ["ssd", "2tb", "nvme"], price: 169, specs: { capacityGb: 2000 }, benchmarks: { productivity: 85 }, estimatedPrice: 169 },
];

export const hardwareCatalog = {
  cpus: cpuCatalog,
  gpus: gpuCatalog,
  motherboards: motherboardCatalog,
  rams: ramCatalog,
  ssds: ssdCatalog,
};

function getCpu(cpuId: string) {
  return cpuCatalog.find((cpu) => cpu.id === cpuId) ?? cpuCatalog[0];
}

function getGpu(gpuId: string) {
  return gpuCatalog.find((gpu) => gpu.id === gpuId) ?? gpuCatalog[0];
}

export function calculateBottleneck(cpuId: string, gpuId: string, monitorRefreshRate = 144): BottleneckResult {
  const cpu = getCpu(cpuId);
  const gpu = getGpu(gpuId);
  const cpuScore = cpu.benchmarks.multicore;
  const gpuScore = gpu.benchmarks.graphics;
  const ratio = Math.max(cpuScore, gpuScore) / Math.max(Math.min(cpuScore, gpuScore), 1);
  const bottleneckPercent = Math.round((ratio - 1) * 100);

  if (gpuScore >= monitorRefreshRate * 0.9 && cpuScore >= monitorRefreshRate * 0.9) {
    return {
      cpuId,
      gpuId,
      cpuScore,
      gpuScore,
      monitorRefreshRate,
      bottleneckPercent: Math.max(6, Math.round((gpuScore - monitorRefreshRate) * 0.5)),
      status: "MONITOR_BOTTLENECK",
      guide: `현재 구성은 ${monitorRefreshRate}Hz 모니터 한계에 먼저 도달합니다. 고주사율 모니터 업그레이드가 체감 개선에 가장 효과적입니다.`,
    };
  }

  if (cpuScore < gpuScore * 0.85) {
    return {
      cpuId,
      gpuId,
      cpuScore,
      gpuScore,
      monitorRefreshRate,
      bottleneckPercent,
      status: "CPU_BOTTLENECK",
      guide: "CPU가 GPU 대비 과도하게 약해 게임·작업 병목이 발생할 수 있습니다. 최신 세대 코어로 업그레이드해 보세요.",
    };
  }

  if (gpuScore < cpuScore * 0.85) {
    return {
      cpuId,
      gpuId,
      cpuScore,
      gpuScore,
      monitorRefreshRate,
      bottleneckPercent,
      status: "GPU_BOTTLENECK",
      guide: "GPU가 CPU 대비 부족해 고해상도·고프레임에서 제한이 생깁니다. 그래픽카드를 먼저 업그레이드하는 것이 효과적입니다.",
    };
  }

  return {
    cpuId,
    gpuId,
    cpuScore,
    gpuScore,
    monitorRefreshRate,
    bottleneckPercent,
    status: "BALANCED",
    guide: "현재 구성은 전반적으로 균형이 좋습니다. 최신 세대 부품으로 점진적 업그레이드하면 효율이 높아집니다.",
  };
}

export function predictGameFps(cpuId: string, gpuId: string, gameTitle: string, resolution: "FHD" | "QHD" | "4K", monitorRefreshRate = 144): FpsResult {
  const cpu = getCpu(cpuId);
  const gpu = getGpu(gpuId);
  const cpuScore = cpu.benchmarks.multicore;
  const gpuScore = gpu.benchmarks.graphics;
  const resolutionFactor = { FHD: 1.0, QHD: 0.84, "4K": 0.68 }[resolution];
  const gameFactor = gameTitle.includes("Cyberpunk")
    ? 0.82
    : gameTitle.includes("Apex")
      ? 1.14
      : gameTitle.includes("Warzone")
        ? 0.96
        : 1;
        const renderedFps = Math.round((90 + gpuScore * 0.9 + cpuScore * 0.24) * resolutionFactor * gameFactor);
        const averageFps = Math.min(renderedFps, monitorRefreshRate);
  const onePercentLowFps = Math.round(averageFps * 0.76 + gpuScore * 0.09);
  const recommendUpscaling = resolution === "4K" || averageFps < 120;

  return {
    cpuId,
    gpuId,
    gameTitle,
    resolution,
    averageFps,
    onePercentLowFps,
    monitorLimited: renderedFps > monitorRefreshRate,
    recommendUpscaling,
  };
}

export function recommendUpgrade(currentSpecs: UserPreset, budget: number): UpgradeProposal[] {
  const currentCpu = currentSpecs.cpuId ? getCpu(currentSpecs.cpuId) : cpuCatalog[0];
  const currentGpu = currentSpecs.gpuId ? getGpu(currentSpecs.gpuId) : gpuCatalog[0];

  const candidates: UpgradeProposal[] = [];

  if (currentCpu) {
    for (const candidate of cpuCatalog.filter((cpu) => cpu.id !== currentCpu.id && cpu.benchmarks.multicore > currentCpu.benchmarks.multicore)) {
      if ((candidate.estimatedPrice ?? 0) > budget) continue;
      const projectedImprovement = Math.round(((candidate.benchmarks.multicore - currentCpu.benchmarks.multicore) / currentCpu.benchmarks.multicore) * 100);
      candidates.push({
        id: candidate.id,
        category: candidate.category,
        name: candidate.name,
        projectedImprovementPercent: Math.max(projectedImprovement, 4),
        estimatedPrice: candidate.estimatedPrice ?? 0,
        reason: "멀티코어 성능이 더 높아 작업·게임 병목 완화에 유리합니다.",
      });
    }
  }

  if (currentGpu) {
    for (const candidate of gpuCatalog.filter((gpu) => gpu.id !== currentGpu.id && gpu.benchmarks.graphics > currentGpu.benchmarks.graphics)) {
      if ((candidate.estimatedPrice ?? 0) > budget) continue;
      const projectedImprovement = Math.round(((candidate.benchmarks.graphics - currentGpu.benchmarks.graphics) / currentGpu.benchmarks.graphics) * 100);
      candidates.push({
        id: candidate.id,
        category: candidate.category,
        name: candidate.name,
        projectedImprovementPercent: Math.max(projectedImprovement, 6),
        estimatedPrice: candidate.estimatedPrice ?? 0,
        reason: "프레임 안정성과 고해상도 렌더링 성능을 크게 끌어올릴 수 있습니다.",
      });
    }
  }

  for (const candidate of ramCatalog) {
    if ((candidate.estimatedPrice ?? 0) > budget) continue;
    const ramCapacity = typeof candidate.specs?.capacityGb === "number" ? candidate.specs.capacityGb : 0;
    const projectedImprovement = ramCapacity > 0 && (currentSpecs.ramGb ?? 32) < 64 ? 12 : 8;
    candidates.push({
      id: candidate.id,
      category: candidate.category,
      name: candidate.name,
      projectedImprovementPercent: projectedImprovement,
      estimatedPrice: candidate.estimatedPrice ?? 0,
      reason: "메모리 용량이 늘어나 멀티태스킹과 크리에이티브 작업 효율이 향상됩니다.",
    });
  }

  for (const candidate of ssdCatalog) {
    if ((candidate.estimatedPrice ?? 0) > budget) continue;
    const ssdCapacity = typeof candidate.specs?.capacityGb === "number" ? candidate.specs.capacityGb : 0;
    const projectedImprovement = ssdCapacity > 0 && (currentSpecs.storageGb ?? 1000) < 2000 ? 10 : 7;
    candidates.push({
      id: candidate.id,
      category: candidate.category,
      name: candidate.name,
      projectedImprovementPercent: projectedImprovement,
      estimatedPrice: candidate.estimatedPrice ?? 0,
      reason: "저장장치 대역폭과 로딩 속도 개선에 도움이 됩니다.",
    });
  }

  return candidates.sort((left, right) => right.projectedImprovementPercent - left.projectedImprovementPercent).slice(0, 4);
}
