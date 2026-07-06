/* eslint-disable @typescript-eslint/no-explicit-any */

export type ComponentCategory = "CPU" | "GPU" | "MB" | "RAM" | "SSD" | "MONITOR";
export type CpuSocket = "LGA1851" | "LGA1700" | "AM5" | "AM4" | string;
export type MotherboardChipsetAlpha = "Z" | "X" | "B" | "A";
export type MotherboardFormFactor = "ATX" | "Micro-ATX" | "Mini-ITX";
export type Resolution = "FHD" | "QHD" | "4K";

export interface Component {
  id: string;
  category: ComponentCategory;
  brand: string;
  name: string;
  matchKeywords: string[];
  price?: number;
  specs?: Record<string, any>;
  benchmarks?: Record<string, any>;
  estimatedPrice?: number;
}

export interface CpuSpecs {
  socket: CpuSocket;
  generation: string;
  cores: number;
  threads?: number;
  defaultPower: number;
  tops?: number;
}

export interface GpuSpecs {
  vram: number;
  tgpW: number;
  dlss: boolean;
  fsr: boolean;
  gpuLengthMm: number;
}

export interface MotherboardSpecs {
  socket: CpuSocket;
  chipsetAlpha: MotherboardChipsetAlpha;
  chipsetNumber: string;
  mbSizeATX?: MotherboardFormFactor;
  memorySlots?: number;
  maxMemoryGb?: number;
}

export interface CpuComponent extends Component {
  category: "CPU";
  specs: CpuSpecs;
  benchmarks: Record<string, any>;
}

export interface GpuComponent extends Component {
  category: "GPU";
  specs: GpuSpecs;
  benchmarks: Record<string, any>;
}

export interface MotherboardComponent extends Component {
  category: "MB";
  specs: MotherboardSpecs;
  benchmarks: Record<string, any>;
}

export interface UserSavedPc {
  id: string;
  cpuId: string;
  gpuId: string;
  ramCapacity: string;
  ramDetail?: string;
  ssdCapacity: string;
  ssdDetail?: string;
  monitorResolution: Resolution;
  monitorRefreshRate: number;
}

export interface BottleneckResult {
  cpuId: string;
  gpuId: string;
  cpuScore: number;
  gpuScore: number;
  monitorRefreshRate: number;
  bottleneckPercent: number;
  status: "BALANCED" | "CPU_BOTTLENECK" | "GPU_BOTTLENECK" | "MONITOR_BOTTLENECK";
  guide: string;
}

export interface FpsResult {
  cpuId: string;
  gpuId: string;
  gameTitle: string;
  resolution: Resolution;
  averageFps: number;
  onePercentLowFps: number;
  recommendUpscaling: boolean;
  monitorLimited: boolean;
}

export interface UpgradeProposal {
  id: string;
  category: ComponentCategory;
  name: string;
  projectedImprovementPercent: number;
  estimatedPrice: number;
  reason: string;
}

export interface UserPreset {
  cpuId?: string;
  gpuId?: string;
  ramGb?: number;
  storageGb?: number;
  useCase?: "gaming" | "content" | "ai";
  monitorResolution?: Resolution;
  monitorRefreshRate?: number;
}

export interface SimulationResult {
  cpuId: string;
  gpuId: string;
  gameTitle: string;
  resolution: Resolution;
  renderedFps: number;
  averageFps: number;
  onePercentLowFps: number;
  monitorRefreshRate: number;
  monitorLimited: boolean;
  monitorBottleneck: "NONE" | "REFRESH_CAP" | "RESOLUTION_LIMIT";
  recommendUpscaling: boolean;
}

export const cpuMasterDb: Component[] = [
  { id: "i5-14400f", category: "CPU", brand: "Intel", name: "Core i5-14400F", matchKeywords: ["14400f", "i5-14400f", "core i5"], price: 229, benchmarks: { multicore: 84, singlecore: 82, aiTops: 75 } },
  { id: "i7-14700k", category: "CPU", brand: "Intel", name: "Core i7-14700K", matchKeywords: ["14700k", "i7-14700k", "core i7"], price: 389, benchmarks: { multicore: 94, singlecore: 89, aiTops: 90 } },
  { id: "ultra9-285k", category: "CPU", brand: "Intel", name: "Core Ultra 9 285K", matchKeywords: ["285k", "ultra 9", "core ultra"], price: 799, benchmarks: { multicore: 98, singlecore: 94, aiTops: 98 } },
  { id: "r7-9700x", category: "CPU", brand: "AMD", name: "Ryzen 7 9700X", matchKeywords: ["9700x", "ryzen 7"], price: 299, benchmarks: { multicore: 91, singlecore: 90, aiTops: 86 } },
  { id: "r7-9800x3d", category: "CPU", brand: "AMD", name: "Ryzen 7 9800X3D", matchKeywords: ["9800x3d", "x3d", "ryzen 7 9800"], price: 499, benchmarks: { multicore: 95, singlecore: 94, aiTops: 90 } },
  { id: "r5-5600x", category: "CPU", brand: "AMD", name: "Ryzen 5 5600X", matchKeywords: ["5600x", "ryzen 5"], price: 179, benchmarks: { multicore: 78, singlecore: 80, aiTops: 70 } },
  { id: "r7-7500f", category: "CPU", brand: "AMD", name: "Ryzen 7 7500F", matchKeywords: ["7500f", "ryzen 7 7500"], price: 209, benchmarks: { multicore: 84, singlecore: 83, aiTops: 78 } },
];

export const gpuMasterDb: Component[] = [
  { id: "rtx3060", category: "GPU", brand: "NVIDIA", name: "GeForce RTX 3060", matchKeywords: ["rtx 3060", "3060", "nvidia 3060"], price: 329, benchmarks: { graphics: 80, aiTops: 75 } },
  { id: "rtx4060", category: "GPU", brand: "NVIDIA", name: "GeForce RTX 4060", matchKeywords: ["rtx 4060", "4060", "nvidia 4060"], price: 299, benchmarks: { graphics: 86, aiTops: 82 } },
  { id: "rtx4070", category: "GPU", brand: "NVIDIA", name: "GeForce RTX 4070", matchKeywords: ["rtx 4070", "4070", "nvidia 4070"], price: 549, benchmarks: { graphics: 92, aiTops: 89 } },
  { id: "rtx5070", category: "GPU", brand: "NVIDIA", name: "GeForce RTX 5070", matchKeywords: ["rtx 5070", "5070", "nvidia 5070"], price: 749, benchmarks: { graphics: 96, aiTops: 93 } },
  { id: "rtx5080", category: "GPU", brand: "NVIDIA", name: "GeForce RTX 5080", matchKeywords: ["rtx 5080", "5080", "nvidia 5080"], price: 1199, benchmarks: { graphics: 99, aiTops: 97 } },
];

export const monitorMasterDb: Component[] = [
  { id: "monitor-fhd-60", category: "MONITOR", brand: "Generic", name: "FHD 60Hz", matchKeywords: ["1080p", "fhd", "60hz"], specs: { resolution: "FHD", refreshRate: 60 } },
  { id: "monitor-fhd-144", category: "MONITOR", brand: "Generic", name: "FHD 144Hz", matchKeywords: ["1080p", "fhd", "144hz"], specs: { resolution: "FHD", refreshRate: 144 } },
  { id: "monitor-qhd-144", category: "MONITOR", brand: "Generic", name: "QHD 144Hz", matchKeywords: ["1440p", "qhd", "144hz"], specs: { resolution: "QHD", refreshRate: 144 } },
  { id: "monitor-4k-144", category: "MONITOR", brand: "Generic", name: "4K 144Hz", matchKeywords: ["2160p", "4k", "144hz"], specs: { resolution: "4K", refreshRate: 144 } },
];

export const motherboardMasterDb: Component[] = [
  {
    id: "mb-z890",
    category: "MB",
    brand: "ASUS",
    name: "Z890 메인보드",
    matchKeywords: ["z890", "lga1851", "z series"],
    specs: { chipsetAlpha: "Z", chipsetNumber: "890", socket: "LGA1851" },
  },
  {
    id: "mb-b760",
    category: "MB",
    brand: "MSI",
    name: "B760 메인보드",
    matchKeywords: ["b760", "lga1700", "b series"],
    specs: { chipsetAlpha: "B", chipsetNumber: "760", socket: "LGA1700" },
  },
  {
    id: "mb-b650",
    category: "MB",
    brand: "Gigabyte",
    name: "B650 메인보드",
    matchKeywords: ["b650", "am5", "b series"],
    specs: { chipsetAlpha: "B", chipsetNumber: "650", socket: "AM5" },
  },
];

export const gameBenchmarkMock = {
  "Cyberpunk 2077": { base: 92, gpuWeight: 0.92, cpuWeight: 0.26, intensity: 1.1 },
  "Apex Legends": { base: 110, gpuWeight: 0.86, cpuWeight: 0.34, intensity: 0.9 },
  "Valorant": { base: 150, gpuWeight: 0.65, cpuWeight: 0.4, intensity: 0.75 },
  "Black Myth: Wukong": { base: 88, gpuWeight: 0.97, cpuWeight: 0.22, intensity: 1.2 },
} as const;
