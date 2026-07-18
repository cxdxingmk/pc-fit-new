import { describe, expect, it } from "vitest";
import { buildAdditionalCpus, buildAdditionalGpus, isWorkstationGpuModel } from "./hardwareScoring";
import { cpus as mergedCpus } from "../database/cpu";
import { gpus as mergedGpus } from "../database/gpu";
import { motherboards } from "../database/motherboard";
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { CPUData, GPUData } from "../../src/constants/hardwareData";

const curatedCpuAnchors: CPU[] = [
  {
    id: "r5-3600x",
    name: "Ryzen 5 3600X",
    brand: "AMD",
    socket: "AM4",
    cores: 6,
    threads: 12,
    baseClock: 3.8,
    boostClock: 4.4,
    cache: 32,
    tdp: 95,
    igpu: false,
    ddr: "DDR4",
    pcie: "4.0",
    releaseYear: 2019,
    gameScore: 78,
    workScore: 74,
    aiScore: 68,
    singleCoreScore: 65,
    multiCoreScore: 48,
    efficiencyScore: 75,
    priceTier: "budget",
  },
  {
    id: "r9-9950x",
    name: "Ryzen 9 9950X",
    brand: "AMD",
    socket: "AM5",
    cores: 16,
    threads: 32,
    baseClock: 4.3,
    boostClock: 5.7,
    cache: 64,
    tdp: 170,
    igpu: true,
    ddr: "DDR5",
    pcie: "5.0",
    releaseYear: 2025,
    gameScore: 99,
    workScore: 99,
    aiScore: 99,
    singleCoreScore: 97,
    multiCoreScore: 100,
    efficiencyScore: 55,
    priceTier: "enthusiast",
  },
];

const curatedGpuAnchors: GPU[] = [
  {
    id: "rtx4070",
    name: "GeForce RTX 4070",
    brand: "NVIDIA",
    vram: 12,
    memoryType: "GDDR6X",
    tgp: 200,
    dlss: true,
    fsr: false,
    xess: false,
    rayTracing: true,
    pcie: "4.0",
    releaseYear: 2023,
    gameScore: 90,
    workScore: 88,
    aiScore: 90,
    priceTier: "mid",
  },
  {
    id: "gtx1660",
    name: "GeForce GTX 1660",
    brand: "NVIDIA",
    vram: 6,
    memoryType: "GDDR5",
    tgp: 120,
    dlss: false,
    fsr: false,
    xess: false,
    rayTracing: false,
    pcie: "3.0",
    releaseYear: 2019,
    gameScore: 65,
    workScore: 60,
    aiScore: 32,
    priceTier: "mid",
  },
];

describe("buildAdditionalCpus", () => {
  it("skips catalog entries whose slug already exists in the curated list (no duplicates)", () => {
    const newCatalog: CPUData[] = [
      { model: "AMD Ryzen 5 3600X", cores: 6, threads: 12, baseClockGhz: 3.8, releaseYear: 2019 },
    ];
    const additional = buildAdditionalCpus(curatedCpuAnchors, newCatalog);
    expect(additional).toHaveLength(0);
  });

  it("excludes Threadripper models (motherboard catalog has no matching socket)", () => {
    const newCatalog: CPUData[] = [
      { model: "AMD Ryzen Threadripper 3970X", cores: 32, threads: 64, baseClockGhz: 3.7, releaseYear: 2019 },
    ];
    const additional = buildAdditionalCpus(curatedCpuAnchors, newCatalog);
    expect(additional).toHaveLength(0);
  });

  it("produces a scored, non-NaN entry for a genuinely new model", () => {
    const newCatalog: CPUData[] = [
      { model: "AMD Ryzen 7 5800X3D", cores: 8, threads: 16, baseClockGhz: 3.4, releaseYear: 2022 },
    ];
    const [entry] = buildAdditionalCpus(curatedCpuAnchors, newCatalog);
    expect(entry).toBeDefined();
    expect(Number.isNaN(entry.gameScore)).toBe(false);
    expect(Number.isNaN(entry.workScore)).toBe(false);
    expect(Number.isNaN(entry.aiScore)).toBe(false);
    expect(entry.gameScore).toBeGreaterThan(0);
    expect(entry.gameScore).toBeLessThanOrEqual(100);
    // between the two anchors' scores directionally (more cores/clock than the budget anchor)
    expect(entry.gameScore).toBeGreaterThan(curatedCpuAnchors[0].gameScore);

    expect(Number.isNaN(entry.singleCoreScore)).toBe(false);
    expect(Number.isNaN(entry.multiCoreScore)).toBe(false);
    expect(Number.isNaN(entry.efficiencyScore)).toBe(false);
    expect(entry.singleCoreScore).toBeGreaterThan(0);
    expect(entry.singleCoreScore).toBeLessThanOrEqual(100);
    expect(entry.multiCoreScore).toBeGreaterThan(0);
    expect(entry.multiCoreScore).toBeLessThanOrEqual(100);
    expect(entry.efficiencyScore).toBeGreaterThan(0);
    expect(entry.efficiencyScore).toBeLessThanOrEqual(100);
  });
});

describe("buildAdditionalGpus", () => {
  it("skips catalog entries whose slug already exists in the curated list", () => {
    const newCatalog: GPUData[] = [
      { model: "GeForce GTX 1660", manufacturer: "NVIDIA", cudaOrStreamCores: 1408, vramGb: 6, releaseYear: 2019 },
    ];
    const additional = buildAdditionalGpus(curatedGpuAnchors, newCatalog);
    expect(additional).toHaveLength(0);
  });

  it("produces a scored, non-NaN entry for a genuinely new model", () => {
    const newCatalog: GPUData[] = [
      { model: "GeForce RTX 4090", manufacturer: "NVIDIA", cudaOrStreamCores: 16384, vramGb: 24, releaseYear: 2022 },
    ];
    const [entry] = buildAdditionalGpus(curatedGpuAnchors, newCatalog);
    expect(entry).toBeDefined();
    expect(Number.isNaN(entry.gameScore)).toBe(false);
    expect(entry.gameScore).toBeGreaterThan(curatedGpuAnchors[1].gameScore);
  });
});

describe("merged app/database catalogs (real data regression check)", () => {
  it("grew beyond the original hand-curated 16 CPUs / 56 GPUs after merging src/constants/hardwareData.ts", () => {
    expect(mergedCpus.length).toBeGreaterThan(16);
    expect(mergedGpus.length).toBeGreaterThan(56);
  });

  it("has no NaN scores anywhere in the merged catalogs", () => {
    for (const cpu of mergedCpus) {
      expect(Number.isNaN(cpu.gameScore)).toBe(false);
      expect(Number.isNaN(cpu.workScore)).toBe(false);
      expect(Number.isNaN(cpu.aiScore)).toBe(false);
      expect(Number.isNaN(cpu.singleCoreScore)).toBe(false);
      expect(Number.isNaN(cpu.multiCoreScore)).toBe(false);
      expect(Number.isNaN(cpu.efficiencyScore)).toBe(false);
    }
    for (const gpu of mergedGpus) {
      expect(Number.isNaN(gpu.gameScore)).toBe(false);
      expect(Number.isNaN(gpu.workScore)).toBe(false);
      expect(Number.isNaN(gpu.aiScore)).toBe(false);
    }
  });

  it("only produces CPU sockets that the motherboard catalog actually supports", () => {
    const supportedSockets = new Set(motherboards.map((mb) => mb.socket));
    for (const cpu of mergedCpus) {
      expect(supportedSockets.has(cpu.socket as (typeof motherboards)[number]["socket"])).toBe(true);
    }
  });

  it("has no duplicate ids after merging curated and estimated entries", () => {
    const cpuIds = mergedCpus.map((cpu) => cpu.id);
    expect(new Set(cpuIds).size).toBe(cpuIds.length);

    const gpuIds = mergedGpus.map((gpu) => gpu.id);
    expect(new Set(gpuIds).size).toBe(gpuIds.length);
  });
});

describe("isWorkstationGpuModel — 전문가용(워크스테이션) GPU 판정", () => {
  it("Arc Pro/Quadro/RTX A시리즈/Radeon Pro 이름을 워크스테이션 카드로 인식한다", () => {
    expect(isWorkstationGpuModel("Intel Arc Pro B50")).toBe(true);
    expect(isWorkstationGpuModel("NVIDIA Quadro RTX 4000")).toBe(true);
    expect(isWorkstationGpuModel("NVIDIA RTX A4000")).toBe(true);
    expect(isWorkstationGpuModel("AMD Radeon Pro W7800")).toBe(true);
  });

  it("일반 게이밍 카드는 워크스테이션 카드로 오인하지 않는다", () => {
    expect(isWorkstationGpuModel("GeForce RTX 4070")).toBe(false);
    expect(isWorkstationGpuModel("Radeon RX 7800 XT")).toBe(false);
    expect(isWorkstationGpuModel("Intel Arc A770")).toBe(false); // "Pro"가 없는 일반 Arc 라인
  });
});

describe("buildAdditionalGpus — 워크스테이션 GPU의 gameScore 감점", () => {
  // 신고된 버그: "Intel Arc Pro B50"이 VRAM/TGP만 보는 회귀식 때문에 게이밍 카드와 비슷한
  // gameScore(81)를 받아 게임 용도 TOP1에 올랐다 — 실제로는 게임 최적화 드라이버도, 게임
  // 검증도 없는 전문가용 카드다. workScore/aiScore는 전문가용 카드가 실제로 강점을 보일 수
  // 있는 영역이라 감점하지 않는다.
  const anchors: GPU[] = [
    {
      id: "anchor-1",
      name: "GeForce RTX 4060",
      brand: "NVIDIA",
      vram: 8,
      memoryType: "GDDR6",
      tgp: 115,
      dlss: true,
      fsr: false,
      xess: false,
      rayTracing: true,
      pcie: "4.0",
      releaseYear: 2023,
      gameScore: 75,
      workScore: 70,
      aiScore: 72,
      priceTier: "budget",
    },
    {
      id: "anchor-2",
      name: "GeForce RTX 4090",
      brand: "NVIDIA",
      vram: 24,
      memoryType: "GDDR6X",
      tgp: 450,
      dlss: true,
      fsr: false,
      xess: true,
      rayTracing: true,
      pcie: "4.0",
      releaseYear: 2022,
      gameScore: 100,
      workScore: 99,
      aiScore: 99,
      priceTier: "enthusiast",
    },
  ];

  it("전문가용 카드는 같은 스펙의 일반 게이밍 카드보다 gameScore가 낮게 나온다(workScore는 그대로)", () => {
    const gamingCard: GPUData = { model: "NVIDIA RTX 4070 Gaming Twin", manufacturer: "NVIDIA", cudaOrStreamCores: 5888, vramGb: 16, releaseYear: 2023 };
    const workstationCard: GPUData = { model: "NVIDIA RTX A4000 Pro", manufacturer: "NVIDIA", cudaOrStreamCores: 5888, vramGb: 16, releaseYear: 2023 };

    const [gamingEntry] = buildAdditionalGpus(anchors, [gamingCard]);
    const [proEntry] = buildAdditionalGpus(anchors, [workstationCard]);

    expect(proEntry.gameScore).toBeLessThan(gamingEntry.gameScore);
    expect(proEntry.workScore).toBe(gamingEntry.workScore); // 동일 스펙이면 workScore는 감점 없이 동일해야 한다
  });

  it("감점 후에도 gameScore는 1 미만으로 내려가지 않는다(clampScore 하한 유지)", () => {
    const weakProCard: GPUData = { model: "Some Pro GPU", manufacturer: "NVIDIA", cudaOrStreamCores: 512, vramGb: 2, releaseYear: 2015 };
    const [entry] = buildAdditionalGpus(anchors, [weakProCard]);
    expect(entry.gameScore).toBeGreaterThanOrEqual(1);
  });
});
