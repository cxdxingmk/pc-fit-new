import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeBudgetFactor,
  cpuPurposeFitScore,
  pickPurpose,
  recommend,
  selectDiverseCpuPool,
  selectDiversePool,
  selectRecommendedPsu,
  selectFixedSsd,
} from "./recommender";
import type { CPU } from "../database/cpu";
import { cpus, curatedCpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { psus } from "../database/psu";
import { ssds } from "../database/ssd";
import type { PSU } from "../database/psu";
import type { SSD } from "../database/ssd";
import type { ExistingPartsState } from "../types/build";

describe("pickPurpose", () => {
  it("prefers the typed purposes[] array over string parsing when both are given", () => {
    expect(pickPurpose({ 1: ["사무"] }, ["gaming"])).toBe("gaming");
  });

  it("resolves multiple selected purposes using the documented priority order (ai beats gaming)", () => {
    expect(pickPurpose({}, ["gaming", "ai"])).toBe("ai");
    expect(pickPurpose({}, ["work", "dev", "video"])).toBe("video");
  });

  it("falls back to string-matching answers[1] when purposes[] is not provided", () => {
    expect(pickPurpose({ 1: ["게임"] })).toBe("gaming");
    expect(pickPurpose({ 1: ["AI 학습용"] })).toBe("ai");
  });

  it("defaults to work when nothing matches", () => {
    expect(pickPurpose({})).toBe("work");
    expect(pickPurpose({}, [])).toBe("work");
  });
});

describe("computeBudgetFactor", () => {
  it("returns 1 (no penalty) when no budget target is given", () => {
    expect(computeBudgetFactor(5_000_000, null)).toBe(1);
    expect(computeBudgetFactor(5_000_000, 0)).toBe(1);
  });

  it("scales between 0.9 and 1.0 when within budget, proportional to utilization", () => {
    expect(computeBudgetFactor(1_000_000, 1_000_000)).toBeCloseTo(1.0, 5);
    expect(computeBudgetFactor(500_000, 1_000_000)).toBeCloseTo(0.95, 5);
    expect(computeBudgetFactor(0, 1_000_000)).toBeCloseTo(0.9, 5);
  });

  it("decays exponentially the further over budget a candidate is", () => {
    const at10PercentOver = computeBudgetFactor(1_100_000, 1_000_000);
    const at50PercentOver = computeBudgetFactor(1_500_000, 1_000_000);
    const at100PercentOver = computeBudgetFactor(2_000_000, 1_000_000);

    expect(at10PercentOver).toBeCloseTo(Math.exp(-0.3), 5);
    expect(at50PercentOver).toBeCloseTo(Math.exp(-1.5), 5);
    expect(at100PercentOver).toBeCloseTo(Math.exp(-3), 5);
  });

  it("always ranks a smaller overage above a larger one (monotonic, never floors to a tie)", () => {
    const targets = [1_000_000, 1_200_000, 1_500_000, 2_000_000, 5_000_000];
    const factors = targets.map((price) => computeBudgetFactor(price, 1_000_000));
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeLessThan(factors[i - 1]);
      expect(factors[i]).toBeGreaterThan(0);
    }
  });
});

type Scored = { id: string; gameScore: number; workScore: number; aiScore: number; priceTier: "budget" | "mid" | "high" | "enthusiast" };

function scored(id: string, priceTier: Scored["priceTier"], gameScore: number): Scored {
  return { id, priceTier, gameScore, workScore: gameScore, aiScore: gameScore };
}

describe("selectDiversePool", () => {
  it("keeps parts from every price tier represented, not just the globally top-scoring tier", () => {
    const items: Scored[] = [
      scored("enthusiast-1", "enthusiast", 99),
      scored("enthusiast-2", "enthusiast", 98),
      scored("high-1", "high", 85),
      scored("mid-1", "mid", 70),
      scored("budget-1", "budget", 40),
      scored("budget-2", "budget", 35),
    ];

    const pool = selectDiversePool(items, "gaming", 4);
    const ids = pool.map((item) => item.id);

    expect(ids).toContain("budget-1");
    expect(ids).toContain("mid-1");
    expect(ids).toContain("high-1");
    expect(ids).toContain("enthusiast-1");
  });

  it("keeps only the top N per tier by purpose score when a tier has more than the limit", () => {
    const items: Scored[] = [
      scored("budget-low", "budget", 10),
      scored("budget-mid", "budget", 20),
      scored("budget-high", "budget", 30),
    ];

    const pool = selectDiversePool(items, "gaming", 2);
    const ids = pool.map((item) => item.id);

    expect(ids).toHaveLength(2);
    expect(ids).toContain("budget-high");
    expect(ids).toContain("budget-mid");
    expect(ids).not.toContain("budget-low");
  });
});

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
    gameScore: 80,
    workScore: 78,
    aiScore: 75,
    singleCoreScore: 80,
    multiCoreScore: 80,
    efficiencyScore: 70,
    priceTier: "mid",
    ...overrides,
  };
}

describe("cpuPurposeFitScore — 용도별 CPU 후보 우선순위", () => {
  it("게임 용도는 gamingScore(gameScore)를 그대로 쓴다 — 3D V-Cache 계열이 이미 최상위권으로 반영돼 있다", () => {
    const x3d = makeCpu({ id: "r7-9800x3d-like", gameScore: 100 });
    const nonX3d = makeCpu({ id: "generic", gameScore: 90 });

    expect(cpuPurposeFitScore(x3d, ["gaming"])).toBe(100);
    expect(cpuPurposeFitScore(x3d, ["gaming"])).toBeGreaterThan(cpuPurposeFitScore(nonX3d, ["gaming"]));
  });

  it("실제 카탈로그에서도 게임 용도 1순위 CPU는 gameScore가 가장 높은 CPU다(회귀 방지)", () => {
    const best = [...curatedCpus].sort((a, b) => cpuPurposeFitScore(b, ["gaming"]) - cpuPurposeFitScore(a, ["gaming"]))[0];
    const maxGameScore = Math.max(...curatedCpus.map((c) => c.gameScore));
    expect(best.gameScore).toBe(maxGameScore);
  });

  it("사무 용도는 내장그래픽(hasIntegratedGraphics) 있는 CPU를 우선한다 — 다른 스탯이 전부 열세여도", () => {
    const withIgpu = makeCpu({ id: "with-igpu", igpu: true, efficiencyScore: 70, gameScore: 75, multiCoreScore: 70, singleCoreScore: 70 });
    // 내장그래픽만 없을 뿐 효율/게임/멀티코어 점수는 전부 더 높게 설정 — 그래도 사무 용도에선 밀려야 한다.
    const withoutIgpu = makeCpu({ id: "without-igpu", igpu: false, efficiencyScore: 95, gameScore: 95, multiCoreScore: 95, singleCoreScore: 95 });

    expect(cpuPurposeFitScore(withIgpu, ["work"])).toBeGreaterThan(cpuPurposeFitScore(withoutIgpu, ["work"]));
  });

  it("사무 용도는 같은 내장그래픽 조건에서 efficiencyScore가 높을수록, gameScore가 높을수록(게이밍 특화) 페널티를 받는다", () => {
    const efficient = makeCpu({ igpu: true, efficiencyScore: 90, gameScore: 60 });
    const gamingLeaning = makeCpu({ igpu: true, efficiencyScore: 90, gameScore: 95 });
    expect(cpuPurposeFitScore(efficient, ["work"])).toBeGreaterThan(cpuPurposeFitScore(gamingLeaning, ["work"]));
  });

  it("영상/방송/AI/개발 용도는 multiCoreScore를 그대로 쓴다", () => {
    const cpu = makeCpu({ multiCoreScore: 88 });
    for (const purpose of ["video", "stream", "ai", "dev"] as const) {
      expect(cpuPurposeFitScore(cpu, [purpose])).toBe(88);
    }
  });

  it("건축/3D/CAD 용도는 singleCoreScore와 multiCoreScore의 가중 평균(50/50)이다", () => {
    const cpu = makeCpu({ singleCoreScore: 90, multiCoreScore: 60 });
    expect(cpuPurposeFitScore(cpu, ["cad"])).toBeCloseTo(75, 5);
  });

  it("기타(직접 입력) 용도는 게임/멀티코어의 중간값이다", () => {
    const cpu = makeCpu({ gameScore: 80, multiCoreScore: 60 });
    expect(cpuPurposeFitScore(cpu, ["etc"])).toBeCloseTo(70, 5);
  });

  it("여러 용도를 동시에 선택하면 각 용도 점수의 가중 평균(단순 평균)이 된다", () => {
    const cpu = makeCpu({ gameScore: 100, multiCoreScore: 40 });
    // gaming(=gameScore=100)과 video(=multiCoreScore=40)를 동시에 선택 -> 평균 70
    expect(cpuPurposeFitScore(cpu, ["gaming", "video"])).toBeCloseTo(70, 5);
  });
});

describe("selectDiverseCpuPool — 용도 기반 CPU 다양성 풀", () => {
  it("게임 용도에서 각 가격 티어의 대표 CPU는 그 티어 안에서 gameScore가 가장 높은 CPU다", () => {
    const pool = selectDiverseCpuPool(curatedCpus, ["gaming"], 1);
    for (const cpu of pool) {
      const sameTier = curatedCpus.filter((c) => c.priceTier === cpu.priceTier);
      const maxInTier = Math.max(...sameTier.map((c) => c.gameScore));
      expect(cpu.gameScore).toBe(maxInTier);
    }
  });

  it("사무 용도에서 티어별 대표 CPU는 내장그래픽이 없는 동일 티어 CPU보다 항상 우선 채택된다", () => {
    const pool = selectDiverseCpuPool(curatedCpus, ["work"], 1);
    for (const cpu of pool) {
      const sameTierWithIgpu = curatedCpus.some((c) => c.priceTier === cpu.priceTier && c.igpu);
      if (sameTierWithIgpu) {
        expect(cpu.igpu).toBe(true);
      }
    }
  });
});

describe("CPU 추천 로직에 브랜드 하드코딩 배제 규칙이 없는지 확인", () => {
  it("recommender.ts 소스 어디에도 CPU 브랜드(Intel/AMD)를 이유로 배제/필터링하는 조건이 없다", () => {
    const source = readFileSync(join(__dirname, "recommender.ts"), "utf-8");
    // cpu.brand를 조건문에서 비교하는 패턴 자체가 없어야 한다(대소문자 무관, 공백 허용).
    expect(source).not.toMatch(/\.brand\s*(===|!==)\s*["'](AMD|Intel)["']/i);
    expect(source).not.toMatch(/brand\s*(===|!==)\s*["'](AMD|Intel)["']/i);
  });

  it("hardwareScoring.ts(카탈로그 확장 로직) 소스에도 브랜드 배제 조건이 없다", () => {
    const source = readFileSync(join(__dirname, "hardwareScoring.ts"), "utf-8");
    expect(source).not.toMatch(/\.brand\s*(===|!==)\s*["'](AMD|Intel)["']/i);
  });

  it("동일 성능 특성을 가진 Intel/AMD CPU는 브랜드와 무관하게 동일한 적합도 점수를 받는다", () => {
    const intelCpu = makeCpu({ id: "intel-twin", brand: "Intel", gameScore: 92, multiCoreScore: 85 });
    const amdCpu = makeCpu({ id: "amd-twin", brand: "AMD", gameScore: 92, multiCoreScore: 85 });

    for (const purpose of ["gaming", "work", "video", "cad", "etc"] as const) {
      expect(cpuPurposeFitScore(intelCpu, [purpose])).toBe(cpuPurposeFitScore(amdCpu, [purpose]));
    }
  });
});

describe("recommend (integration)", () => {
  const existingParts = {
    CPU: { enabled: false, brand: "" as const, model: "" },
    GPU: { enabled: false, brand: "" as const, manufacturer: "", model: "" },
    RAM: { enabled: false, ddr: "" as const, capacity: "" as const, brand: "", model: "" },
    SSD: { enabled: false, capacity: "" as const, brand: "", model: "" },
    HDD: { enabled: false, capacity: "" as const },
    Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
    Power: { enabled: false, wattage: "" as const },
  };

  it("returns at most 3 results, with the balanced (first) slot holding the pool's best finalScore", () => {
    // TOP1/2/3은 이제 [균형 최적, 가성비 추천, 최고성능 지향] 세 가지 다른 목적함수로 뽑히므로
    // (recommender.ts의 selectTopByStrategy 참고) 2번째/3번째 슬롯끼리는 finalScore가 엄격히
    // 내림차순일 필요가 없다 — 가성비 전략이 저가/저점수 조합을, 최고성능 전략이 그보다 점수는
    // 높지만 예산 배율 때문에 최종 finalScore가 다르게 나올 수 있어 순서가 뒤바뀔 수 있음.
    // 다만 균형 전략(1번째)은 제약 없이 풀 전체에서 뽑히므로 항상 나머지보다 finalScore가 높거나 같다.
    const results = recommend({ 1: ["게임"], 3: ["200~300만원"] }, existingParts, "none");
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    for (const result of results.slice(1)) {
      expect(result.finalScore).toBeLessThanOrEqual(results[0].finalScore);
    }
  });

  it("diversifies the CPU across TOP1/2/3 instead of collapsing onto a single dominant model", () => {
    const results = recommend({ 1: ["게임"], 3: ["200~300만원"] }, existingParts, "none");
    const cpuIds = results.map((r) => r.cpu);
    expect(new Set(cpuIds).size).toBe(cpuIds.length);
  });

  it("only returns candidates that already passed the >=70 compatibility gate", () => {
    const results = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none");
    for (const result of results) {
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(70);
    }
  });

  it("recommends a meaningfully cheaper build for a low budget target than for a high one", () => {
    const cheap = recommend({ 1: ["사무"], 3: ["100만원 이하"] }, existingParts, "none");
    const expensive = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none");

    expect(cheap[0].totalPrice).toBeLessThan(expensive[0].totalPrice);
  });

  it("(검증 1) 게임 용도 + 넉넉한 예산 -> TOP1 CPU는 게임 벤치마크 상위권(gameScore>=90)이다", () => {
    const results = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(0);

    const topCpu = cpus.find((c) => c.id === results[0].partIds.cpu);
    expect(topCpu).toBeDefined();
    expect(topCpu!.gameScore).toBeGreaterThanOrEqual(90);
    expect(results[0].reason).toContain("게이밍 벤치마크 기준 상위권 CPU로 구성했습니다.");
  });

  it("(검증 2) 사무 용도 + 저예산 -> TOP1 CPU는 내장그래픽(hasIntegratedGraphics)을 갖췄다", () => {
    const results = recommend({ 1: ["사무"], 3: ["100만원 이하"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    const topCpu = cpus.find((c) => c.id === results[0].partIds.cpu);
    expect(topCpu).toBeDefined();
    expect(topCpu!.igpu).toBe(true);
    expect(results[0].reason).toContain("내장그래픽과 전력 효율을 갖춘 사무용 CPU로 구성했습니다.");
  });
});

function baseExistingParts(): ExistingPartsState {
  return {
    CPU: { enabled: false, brand: "", model: "" },
    GPU: { enabled: false, brand: "", manufacturer: "", model: "" },
    RAM: { enabled: false, ddr: "", capacity: "", brand: "", model: "" },
    SSD: { enabled: false, capacity: "", brand: "", model: "" },
    HDD: { enabled: false, capacity: "" },
    Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
    Power: { enabled: false, wattage: "" },
  };
}

describe("recommend — 보유 부품(existingParts) 고정 회귀", () => {
  // 신고된 버그: CPU를 "보유 중"으로 체크하고 구체적 모델까지 지정해도 추천 결과가 완전히
  // 무시하고 매번 다른 CPU를 새로 구매할 부품으로 청구했다. TOP1/2/3 전부, 그리고 CPU 외
  // GPU/RAM/SSD/메인보드/파워도 동일한 방식으로 무시되고 있었는지 전부 점검해 고정한다.

  it("보유 CPU를 지정하면 TOP1/2/3 전부 그 CPU로 고정되고 가격에서 제외된다", () => {
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 5 5600" };

    const results = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.partIds.cpu).toBe("r5-5600");
      expect(result.ownedParts.cpu).toBe(true);
      const cpuPart = result.parts.find((p) => p.label === "CPU");
      expect(cpuPart?.price).toBe(0);
    }
  });

  it("보유 GPU를 지정하면 TOP1/2/3 전부 그 GPU로 고정되고 가격에서 제외된다", () => {
    const existingParts = baseExistingParts();
    existingParts.GPU = { enabled: true, brand: "NVIDIA", manufacturer: "", model: "GeForce RTX 4070" };

    const results = recommend({ 1: ["게임"], 3: ["200~300만원"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(0);

    const expectedGpuId = gpus.find((g) => g.name === "GeForce RTX 4070")!.id;
    for (const result of results) {
      expect(result.partIds.gpu).toBe(expectedGpuId);
      expect(result.ownedParts.gpu).toBe(true);
      const gpuPart = result.parts.find((p) => p.label === "GPU");
      expect(gpuPart?.price).toBe(0);
    }
  });

  it("보유 RAM(규격 지정)을 지정하면 TOP1/2/3 전부 그 규격으로 고정되고 가격에서 제외된다", () => {
    const existingParts = baseExistingParts();
    existingParts.RAM = { enabled: true, ddr: "DDR5", capacity: "32GB", brand: "", model: "" };

    const results = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.partIds.ram).toBe("32-ddr5-6000");
      expect(result.ownedParts.ram).toBe(true);
      const ramPart = result.parts.find((p) => p.label === "RAM");
      expect(ramPart?.price).toBe(0);
    }
  });

  it("보유 SSD(용량 지정)를 지정하면 TOP1/2/3 전부 그 용량으로 고정되고 가격에서 제외된다", () => {
    const existingParts = baseExistingParts();
    existingParts.SSD = { enabled: true, capacity: "1TB", brand: "", model: "" };

    const results = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.ownedParts.ssd).toBe(true);
      const ssdPart = result.parts.find((p) => p.label === "SSD");
      expect(ssdPart?.price).toBe(0);
    }
  });

  it("보유 메인보드(시리즈+모델)를 지정하면 TOP1/2/3 전부 그 보드로 고정되고 가격에서 제외된다", () => {
    const existingParts = baseExistingParts();
    existingParts.Motherboard = { enabled: true, series: "AMD B", manufacturer: "GIGABYTE", model: "650" };

    const results = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.partIds.motherboard).toBe("b650m-aorus-elite");
      expect(result.ownedParts.motherboard).toBe(true);
      const mbPart = result.parts.find((p) => p.label === "메인보드");
      expect(mbPart?.price).toBe(0);
    }
  });

  it("보유 파워(와트수)를 지정하면 TOP1/2/3 전부 그 와트수로 고정되고 가격에서 제외된다", () => {
    const existingParts = baseExistingParts();
    existingParts.Power = { enabled: true, wattage: "850W" };

    const results = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.partIds.psuWattage).toBe(850);
      expect(result.ownedParts.psu).toBe(true);
      const psuPart = result.parts.find((p) => p.label === "파워");
      expect(psuPart?.price).toBe(0);
    }
  });

  it("보유 부품이 제외된 만큼 미보유 상태보다 총액이 낮다(가격 제외 검증)", () => {
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 5 5600" };

    const withOwnedCpu = recommend({ 1: ["사무"], 3: ["150~200만원"] }, existingParts, "none", ["work"]);
    const withoutOwnedCpu = recommend({ 1: ["사무"], 3: ["150~200만원"] }, baseExistingParts(), "none", ["work"]);

    expect(withOwnedCpu.length).toBeGreaterThan(0);
    expect(withoutOwnedCpu.length).toBeGreaterThan(0);
    // 보유 CPU 견적의 부품별 가격 합(케이스 포함, parts에 이미 케이스 항목이 있다)이 실제로
    // totalPrice와 일치하고(CPU=0 포함), 미보유 견적보다 싸다.
    const ownedTotal = withOwnedCpu[0].parts.reduce((sum, p) => sum + p.price, 0);
    expect(ownedTotal).toBe(withOwnedCpu[0].totalPrice);
    expect(withOwnedCpu[0].totalPrice).toBeLessThan(withoutOwnedCpu[0].totalPrice);
  });

  it("보유 RAM(DDR4)이 나머지 부품과 호환되도록 캐스케이드된다 — TOP1의 CPU도 DDR4 호환이다", () => {
    const existingParts = baseExistingParts();
    existingParts.RAM = { enabled: true, ddr: "DDR4", capacity: "16GB", brand: "", model: "" };

    const results = recommend({ 1: ["사무"], 3: ["100만원 이하"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      const cpu = cpus.find((c) => c.id === result.partIds.cpu);
      expect(cpu?.ddr).toBe("DDR4");
    }
  });

  it("여러 부품을 동시에 보유 지정해도 전부 함께 고정된다(CPU+GPU+RAM)", () => {
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 5 5600" };
    existingParts.GPU = { enabled: true, brand: "NVIDIA", manufacturer: "", model: "GeForce GTX 1660 SUPER" };
    existingParts.RAM = { enabled: true, ddr: "DDR4", capacity: "16GB", brand: "", model: "" };

    const results = recommend({ 1: ["사무"], 3: ["100만원 이하"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.partIds.cpu).toBe("r5-5600");
      expect(result.ownedParts.cpu).toBe(true);
      expect(result.ownedParts.gpu).toBe(true);
      expect(result.ownedParts.ram).toBe(true);
      const cpuPart = result.parts.find((p) => p.label === "CPU");
      const gpuPart = result.parts.find((p) => p.label === "GPU");
      const ramPart = result.parts.find((p) => p.label === "RAM");
      expect(cpuPart?.price).toBe(0);
      expect(gpuPart?.price).toBe(0);
      expect(ramPart?.price).toBe(0);
    }
  });
});

function makePsu(overrides: Partial<PSU> = {}): PSU {
  return {
    id: "test-psu",
    name: "Test PSU",
    brand: "Seasonic",
    wattage: 650,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2023,
    ...overrides,
  };
}

describe("selectRecommendedPsu — 파워는 필요 전력의 1.3~1.5배 안전마진 안에서만 고른다", () => {
  // 신고된 버그: Ryzen 5 5600(tdp 65) + RTX 4060(tgp 115) 조합(필요 전력 330W대)에 카탈로그의
  // 1500W Titanium 파워(qualityScore 83)가 선택됐다 — ratePsu의 오버사이즈 감점(최대 -25)이
  // qualityScore 가중치를 뚫지 못했기 때문. 이제는 후보 자체를 안전마진 범위로 제한한다.
  const r5600 = cpus.find((c) => c.id === "r5-5600")!;
  const rtx4060 = gpus.find((g) => g.id === "rtx4060")!;

  it("실제 카탈로그: Ryzen 5 5600 + RTX 4060(필요 330W대) 조합은 절대 1500W를 고르지 않는다", () => {
    const picked = selectRecommendedPsu(r5600, rtx4060, psus);
    expect(picked).not.toBeNull();
    expect(picked!.wattage).toBeLessThan(800); // 1500W(psu-nzxt-c1500-platinum)는 물론 오버스펙 전부 배제
  });

  it("사용자가 제시한 예시: 필요 전력 500W대 조합은 650W를 고른다", () => {
    // tdp+tgp+150 = 500 이 되도록 합성 CPU/GPU를 구성(카탈로그 CPU/GPU에 의존하지 않고 정확히 검증).
    const cpu = { ...r5600, tdp: 150 };
    const gpu = { ...rtx4060, tgp: 200 }; // 150+200+150 = 500
    const picked = selectRecommendedPsu(cpu, gpu, psus);
    expect(picked?.wattage).toBe(650);
  });

  it("안전마진 범위(1.3~1.5배) 안에 후보가 있으면 그중 가장 작은 것을 고른다", () => {
    const catalog = [makePsu({ id: "a", wattage: 500 }), makePsu({ id: "b", wattage: 550 }), makePsu({ id: "c", wattage: 1000 })];
    // required=400 -> 범위 [520, 600] -> 550만 해당
    const picked = selectRecommendedPsu({ tdp: 100 } as CPU, { tgp: 150 } as never, catalog);
    expect(picked?.id).toBe("b");
  });

  it("안전마진 범위 안에 후보가 없으면(카탈로그가 성김) 요구 전력을 만족하는 가장 작은 것으로 폴백한다", () => {
    const catalog = [makePsu({ id: "small", wattage: 400 }), makePsu({ id: "big", wattage: 1200 })];
    // required=350 -> 범위 [455, 525]엔 아무것도 없음 -> 요구(>=350) 만족하는 가장 작은 것(400)
    const picked = selectRecommendedPsu({ tdp: 100 } as CPU, { tgp: 100 } as never, catalog);
    expect(picked?.id).toBe("small");
  });

  it("품질 하한선(70점) 미만인 파워는 범위 안에 있어도 건너뛰고 다음으로 넘어간다", () => {
    const catalog = [
      makePsu({ id: "low-quality", wattage: 550, qualityScore: 50 }),
      makePsu({ id: "high-quality", wattage: 650, qualityScore: 90 }),
    ];
    // required=400 -> 범위 [520,600] -> low-quality(550)만 범위 안이지만 품질 미달 -> 폴백해서
    // 요구 전력 만족 + 품질 통과 중 가장 작은 것(high-quality, 650)을 고른다.
    const picked = selectRecommendedPsu({ tdp: 100 } as CPU, { tgp: 150 } as never, catalog);
    expect(picked?.id).toBe("high-quality");
  });

  it("카탈로그 전체가 용량 미달이면 null을 반환한다(추천 자체가 불가능한 극단적 사양)", () => {
    const catalog = [makePsu({ id: "tiny", wattage: 100 })];
    const picked = selectRecommendedPsu({ tdp: 200 } as CPU, { tgp: 300 } as never, catalog);
    expect(picked).toBeNull();
  });
});

describe("selectFixedSsd — SSD는 예산/견적 성격과 무관하게 항상 512GB로 고정한다", () => {
  it("실제 카탈로그에서 정확히 512GB 항목을 고른다", () => {
    const picked = selectFixedSsd(ssds);
    expect(picked?.capacity).toBe(512);
  });

  it("카탈로그에 정확히 512GB가 없으면 가장 작은 등급으로 폴백한다", () => {
    const catalog: SSD[] = [
      { ...ssds[0], id: "a", capacity: 1000 },
      { ...ssds[0], id: "b", capacity: 2000 },
    ];
    const picked = selectFixedSsd(catalog);
    expect(picked?.id).toBe("a");
  });
});

describe("recommend — 파워 오버스펙 방지 + SSD 512GB 고정 정책 회귀", () => {
  it("보유 CPU+GPU가 같으면 TOP1/2/3 전부 파워도 동일한 등급으로 고정된다(전략별로 파워가 갈리지 않음)", () => {
    // AM5+DDR5(호환 메인보드가 여럿이라 RAM/보드 조합으로 TOP1/2/3가 실제로 갈리는 조합)로
    // CPU/GPU를 고정해, "같은 cpu+gpu인데 파워만 카드마다 달랐다"는 신고 시나리오를 재현한다.
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 7 9700X" };
    existingParts.GPU = { enabled: true, brand: "NVIDIA", manufacturer: "", model: "GeForce RTX 4070" };

    const results = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(1);
    // RAM/메인보드는 실제로 카드마다 다르게 나온다(다양성 유지) — 그래도 파워만은 고정.
    expect(new Set(results.map((r) => r.ram)).size).toBeGreaterThan(1);

    const wattages = new Set(results.map((r) => r.partIds.psuWattage));
    expect(wattages.size).toBe(1); // 전략(균형/가성비/고성능)과 무관하게 항상 같은 파워 등급
    expect([...wattages][0]).toBeLessThan(800); // 1500W 같은 오버스펙이 아니어야 한다
  });

  it("신고된 재현 조건 그대로: Ryzen 5 5600 + RTX 4060 조합에서 절대 1500W가 선택되지 않는다", () => {
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 5 5600" };
    existingParts.GPU = { enabled: true, brand: "NVIDIA", manufacturer: "", model: "GeForce RTX 4060" };

    const results = recommend({ 1: ["게임"], 3: ["150~200만원"] }, existingParts, "none", ["gaming"]);
    for (const result of results) {
      expect(result.partIds.psuWattage).not.toBe(1500);
      expect(result.parts.find((p) => p.label === "파워")?.name).not.toMatch(/1500W/);
    }
  });

  it("SSD는 예산·용도와 무관하게 모든 추천 견적에서 항상 512GB다", () => {
    const scenarios: Array<[string, string]> = [
      ["게임", "300만원 이상"],
      ["사무", "100만원 이하"],
      ["영상편집", "200~300만원"],
    ];

    for (const [purposeLabel, budgetLabel] of scenarios) {
      const results = recommend({ 1: [purposeLabel], 3: [budgetLabel] }, baseExistingParts(), "none");
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result.ssd).toContain("512GB");
        expect(result.parts.find((p) => p.label === "SSD")?.name).toContain("512GB");
      }
    }
  });

  it("HDD는 어떤 추천 견적의 부품 목록(parts)에도 노출되지 않는다", () => {
    const results = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, baseExistingParts(), "none");
    for (const result of results) {
      expect(result.parts.some((p) => p.label === "HDD")).toBe(false);
      expect(result.parts.some((p) => /hdd/i.test(p.name))).toBe(false);
    }
  });
});
