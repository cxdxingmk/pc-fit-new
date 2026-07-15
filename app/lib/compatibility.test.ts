import { describe, expect, it } from "vitest";
import { compatibilityScore, recencyBoost } from "./compatibility";
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";

function makeCpu(overrides: Partial<CPU> = {}): CPU {
  return {
    id: "test-cpu",
    name: "Test CPU",
    brand: "AMD",
    socket: "AM5",
    cores: 8,
    threads: 16,
    baseClock: 4.0,
    boostClock: 5.0,
    cache: 32,
    tdp: 105,
    igpu: true,
    ddr: "DDR5",
    pcie: "5.0",
    releaseYear: 2024,
    gameScore: 90,
    workScore: 88,
    aiScore: 85,
    priceTier: "mid",
    ...overrides,
  };
}

function makeGpu(overrides: Partial<GPU> = {}): GPU {
  return {
    id: "test-gpu",
    name: "Test GPU",
    brand: "NVIDIA",
    vram: 12,
    memoryType: "GDDR6X",
    tgp: 220,
    dlss: true,
    fsr: false,
    xess: false,
    rayTracing: true,
    pcie: "5.0",
    releaseYear: 2024,
    gameScore: 90,
    workScore: 88,
    aiScore: 90,
    priceTier: "mid",
    ...overrides,
  };
}

function makeRam(overrides: Partial<RAM> = {}): RAM {
  return {
    id: "test-ram",
    name: "Test RAM",
    brand: "Samsung",
    capacity: 32,
    sticks: 2,
    speed: 6000,
    ddr: "DDR5",
    rgb: false,
    xmp: true,
    expo: true,
    gameScore: 85,
    workScore: 85,
    aiScore: 85,
    price: 135_000,
    priceTier: "mid",
    ...overrides,
  };
}

function makeSsd(overrides: Partial<SSD> = {}): SSD {
  return {
    id: "test-ssd",
    name: "Test SSD",
    brand: "Samsung",
    capacity: 1000,
    interface: "PCIe 5.0",
    formFactor: "M.2 2280",
    readSpeed: 7000,
    writeSpeed: 6000,
    dram: true,
    nand: "TLC",
    tbw: 600,
    releaseYear: 2024,
    gameScore: 85,
    workScore: 85,
    aiScore: 85,
    priceTier: "mid",
    ...overrides,
  };
}

function makeMotherboard(overrides: Partial<MotherBoard> = {}): MotherBoard {
  return {
    id: "test-mb",
    name: "Test Motherboard",
    brand: "ASUS",
    socket: "AM5",
    chipset: "X870",
    ddr: "DDR5",
    maxMemory: 192,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 4,
    sataPorts: 4,
    supportedNvmeGenerations: [4, 5],
    wifi: true,
    releaseYear: 2024,
    gameScore: 90,
    workScore: 90,
    aiScore: 90,
    priceTier: "high",
    ...overrides,
  };
}

function makePsu(overrides: Partial<PSU> = {}): PSU {
  return {
    id: "test-psu",
    name: "Test PSU",
    brand: "Seasonic",
    wattage: 750,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2024,
    priceTier: "mid",
    ...overrides,
  };
}

describe("compatibilityScore", () => {
  it("returns a perfect 100 with no warnings when everything matches", () => {
    const result = compatibilityScore(makeCpu(), makeGpu(), makeRam(), makeSsd(), makeMotherboard(), makePsu());
    expect(result.score).toBe(100);
    expect(result.warnings).toHaveLength(0);
  });

  it("applies the large CPU/GPU gap penalty when the gap exceeds 20", () => {
    const result = compatibilityScore(makeCpu({ gameScore: 95 }), makeGpu({ gameScore: 60 }));
    expect(result.score).toBe(100 - 24);
    expect(result.warnings.some((w) => w.message.includes("병목"))).toBe(true);
    expect(result.warnings.find((w) => w.message.includes("병목"))?.severity).toBe("critical");
  });

  it("applies the small CPU/GPU gap penalty when the gap is between 10 and 20", () => {
    const result = compatibilityScore(makeCpu({ gameScore: 90 }), makeGpu({ gameScore: 78 }));
    expect(result.score).toBe(100 - 10);
  });

  it("does not penalize a CPU/GPU gap of 10 or less", () => {
    const result = compatibilityScore(makeCpu({ gameScore: 90 }), makeGpu({ gameScore: 82 }));
    expect(result.score).toBe(100);
  });

  it("penalizes a CPU/GPU PCIe mismatch", () => {
    const result = compatibilityScore(makeCpu({ pcie: "4.0" }), makeGpu({ pcie: "5.0" }));
    expect(result.score).toBe(100 - 8);
  });

  it("penalizes a CPU/RAM DDR mismatch", () => {
    const result = compatibilityScore(makeCpu({ ddr: "DDR5" }), makeGpu(), makeRam({ ddr: "DDR4" }));
    expect(result.score).toBe(100 - 20);
    expect(result.warnings.some((w) => w.message.includes("DDR"))).toBe(true);
    expect(result.warnings.find((w) => w.message.includes("DDR"))?.severity).toBe("warn");
  });

  it("heavily penalizes a CPU/motherboard socket mismatch", () => {
    const result = compatibilityScore(makeCpu({ socket: "AM5" }), makeGpu(), undefined, undefined, makeMotherboard({ socket: "LGA1700" }));
    expect(result.score).toBe(100 - 30);
    expect(result.warnings.some((w) => w.message.includes("소켓"))).toBe(true);
    expect(result.warnings.find((w) => w.message.includes("소켓"))?.severity).toBe("critical");
  });

  it("penalizes a motherboard/RAM DDR mismatch", () => {
    const result = compatibilityScore(
      makeCpu({ ddr: "DDR5" }),
      makeGpu(),
      makeRam({ ddr: "DDR5" }),
      undefined,
      makeMotherboard({ ddr: "DDR4" })
    );
    expect(result.score).toBe(100 - 18);
  });

  it("penalizes an SSD/CPU PCIe mismatch", () => {
    const result = compatibilityScore(makeCpu({ pcie: "5.0" }), makeGpu({ pcie: "5.0" }), undefined, makeSsd({ interface: "PCIe 4.0" }));
    expect(result.score).toBe(100 - 6);
  });

  it("penalizes a SATA SSD when the motherboard has no SATA ports", () => {
    // app/database/ssd.ts's own SSD["interface"] union never includes "SATA" (only PCIe 4.0/5.0),
    // but compatibility.ts's isSataInterface() check is a plain regex on the string, so a
    // "SATA"-labeled drive is simulated here via an `as` cast to exercise that branch.
    const result = compatibilityScore(
      makeCpu(),
      makeGpu(),
      undefined,
      { ...makeSsd(), interface: "SATA" as SSD["interface"] },
      makeMotherboard({ sataPorts: 0 })
    );
    // also trips the SSD/CPU PCIe-normalization mismatch warning (SATA !== PCIe 5.0)
    expect(result.score).toBe(100 - 6 - 18);
  });

  it("penalizes an NVMe SSD when the motherboard has no M.2 slots", () => {
    const result = compatibilityScore(makeCpu(), makeGpu(), undefined, makeSsd(), makeMotherboard({ m2Slots: 0 }));
    expect(result.score).toBe(100 - 22);
  });

  it("penalizes an unsupported NVMe generation", () => {
    const result = compatibilityScore(
      makeCpu(),
      makeGpu(),
      undefined,
      makeSsd({ interface: "PCIe 5.0" }),
      makeMotherboard({ supportedNvmeGenerations: [3, 4] })
    );
    expect(result.score).toBe(100 - 14);
  });

  it("penalizes insufficient PSU wattage", () => {
    const result = compatibilityScore(makeCpu({ tdp: 150 }), makeGpu({ tgp: 300 }), undefined, undefined, undefined, makePsu({ wattage: 500 }));
    // required = 150 + 300 + 150 = 600, 500 < 600
    expect(result.score).toBe(100 - 24);
  });

  it("penalizes low PSU headroom without being fully insufficient", () => {
    const result = compatibilityScore(makeCpu({ tdp: 150 }), makeGpu({ tgp: 300 }), undefined, undefined, undefined, makePsu({ wattage: 650 }));
    // required = 600, 650 is >= 600 but < 600 + 100 headroom margin
    expect(result.score).toBe(100 - 8);
  });

  it("penalizes when an existing (user-owned) PSU is insufficient for the powerLimit", () => {
    const result = compatibilityScore(makeCpu({ tdp: 150 }), makeGpu({ tgp: 300 }), undefined, undefined, undefined, undefined, 500);
    expect(result.score).toBe(100 - 26);
  });

  it("floors the score at 0 when penalties stack past zero", () => {
    const result = compatibilityScore(
      makeCpu({ socket: "AM5", ddr: "DDR5", gameScore: 95 }),
      makeGpu({ gameScore: 30 }),
      makeRam({ ddr: "DDR4" }),
      { ...makeSsd(), interface: "SATA" as SSD["interface"] },
      makeMotherboard({ socket: "LGA1700", ddr: "DDR4", sataPorts: 0 }),
      makePsu({ wattage: 100 })
    );
    // -24 (gap) -20 (ram ddr) -30 (socket) -6 (ssd/cpu pcie) -18 (sata no ports) -24 (psu insufficient) = -122, floored to 0
    expect(result.score).toBe(0);
  });
});

describe("recencyBoost", () => {
  it("scores a 2025+ part at 100 and averages across all four parts", () => {
    const cpu = makeCpu({ releaseYear: 2025 });
    const gpu = makeGpu({ releaseYear: 2025 });
    const mb = makeMotherboard({ releaseYear: 2025 });
    const psu = makePsu({ releaseYear: 2025 });
    expect(recencyBoost(cpu, gpu, mb, psu)).toBe(100);
  });

  it("blends different release years using the documented year buckets", () => {
    // 2024 -> 95, 2023 -> 88, 2022 -> 80, pre-2022 -> 70
    const cpu = makeCpu({ releaseYear: 2024 });
    const gpu = makeGpu({ releaseYear: 2023 });
    const mb = makeMotherboard({ releaseYear: 2022 });
    const psu = makePsu({ releaseYear: 2019 });
    const expected = (95 + 88 + 80 + 70) / 4;
    expect(recencyBoost(cpu, gpu, mb, psu)).toBe(Math.round(expected * 100) / 100);
  });
});
