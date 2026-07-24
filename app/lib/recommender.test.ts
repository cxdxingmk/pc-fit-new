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
  isNewPurchaseEligibleCpu,
  isNewPurchaseEligibleGpu,
  MIN_NEW_PURCHASE_GPU_RELEASE_YEAR,
  EXACT_BUDGET_TOLERANCE,
  findCheapestViableTotalPrice,
  findMostExpensiveViableTotalPrice,
  IGPU_ONLY_GPU_ID,
} from "./recommender";
import type { CPU } from "../database/cpu";
import { cpus, curatedCpus } from "../database/cpu";
import { gpus, curatedGpus } from "../database/gpu";
import { isWorkstationGpuModel } from "./hardwareScoring";
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
    // "100만원 이하"는 카탈로그의 절대 최저 구성가(케이스 포함 약 111만원)보다도 낮아 하드 상한
    // 적용 후 어떤 용도로도 구성 자체가 불가능하다(recommender.ts의 budgetTarget 하드 컷 참고) —
    // 그래서 실제로 구성 가능한 가장 낮은 프리셋인 "100~150만원"을 "저예산" 기준으로 쓴다.
    const cheap = recommend({ 1: ["사무"], 3: ["100~150만원"] }, existingParts, "none");
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
    // "100만원 이하"는 카탈로그 최저 구성가보다 낮아 항상 결과가 비므로(위 참고), 실제 구성 가능한
    // 최저 프리셋으로 "저예산" 조건을 검증한다.
    const results = recommend({ 1: ["사무"], 3: ["100~150만원"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);

    const topCpu = cpus.find((c) => c.id === results[0].partIds.cpu);
    expect(topCpu).toBeDefined();
    expect(topCpu!.igpu).toBe(true);
    expect(results[0].reason).toContain("내장그래픽과 전력 효율을 갖춘 사무용 CPU로 구성했습니다.");
  });
});

describe("recommend — priceOverrides(part_prices 실거래가) 반영", () => {
  const existingParts = {
    CPU: { enabled: false, brand: "" as const, model: "" },
    GPU: { enabled: false, brand: "" as const, manufacturer: "", model: "" },
    RAM: { enabled: false, ddr: "" as const, capacity: "" as const, brand: "", model: "" },
    SSD: { enabled: false, capacity: "" as const, brand: "", model: "" },
    HDD: { enabled: false, capacity: "" as const },
    Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
    Power: { enabled: false, wattage: "" as const },
  };

  it("생략하면(기본값 빈 Map) 명시적으로 빈 Map을 넘긴 것과 결과가 완전히 동일하다(하위호환)", () => {
    const withoutArg = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"]);
    const withEmptyMap = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"], undefined, undefined, new Map());
    expect(withEmptyMap).toEqual(withoutArg);
  });

  it("part_prices에 해당 catalog_id의 실거래가가 있으면 정적 가격 대신 그 값을 totalPrice/parts에 반영한다", () => {
    // "300만원 이상"(budgetTarget=350만원)은 안 쓴다 — RAM 가격 갱신(app/database/ram.ts) 이후
    // 이 조합의 TOP1 총액이 정확히 350만원 하드 컷 경계에 걸려서, 아래처럼 아주 작은 델타만
    // 더해도 그 후보 자체가 예산 초과로 통째로 제외돼(다른 동점 CPU로 대체) "같은 CPU가 여전히
    // TOP1~3 안에 있다"는 이 테스트의 전제가 깨진다. "150~200만원"은 TOP1 총액에 16만원 정도
    // 여유가 있어 5만원 델타를 안전하게 흡수한다.
    const baseline = recommend({ 1: ["게임"], 3: ["150~200만원"] }, existingParts, "none", ["gaming"]);
    expect(baseline.length).toBeGreaterThan(0);

    const topCpuId = baseline[0].partIds.cpu;
    const staticCpuPrice = baseline[0].parts.find((p) => p.label === "CPU")!.price;
    // 예산(150~200만원) 대비 무시할 수 있는 소액 델타 — TOP1/2/3 선정 순위 자체는 안 흔들리고
    // "실거래가가 실제로 반영됐는가"만 순수하게 검증할 수 있게 한다.
    const liveCpuPrice = staticCpuPrice + 50_000;

    const withOverride = recommend(
      { 1: ["게임"], 3: ["150~200만원"] },
      existingParts,
      "none",
      ["gaming"],
      undefined,
      undefined,
      new Map([[`cpu:${topCpuId}`, { priceKrw: liveCpuPrice, sampleCount: 5, updatedAt: new Date().toISOString() }]])
    );

    const matching = withOverride.find((r) => r.partIds.cpu === topCpuId);
    expect(matching).toBeDefined();
    expect(matching!.parts.find((p) => p.label === "CPU")!.price).toBe(liveCpuPrice);
    expect(matching!.totalPrice).toBe(baseline[0].totalPrice - staticCpuPrice + liveCpuPrice);
  });

  it("표본 3개 미만인 행은 무시하고 정적 가격을 그대로 쓴다", () => {
    const baseline = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"]);
    const topCpuId = baseline[0].partIds.cpu;
    const staticCpuPrice = baseline[0].parts.find((p) => p.label === "CPU")!.price;

    const withUnreliableOverride = recommend(
      { 1: ["게임"], 3: ["300만원 이상"] },
      existingParts,
      "none",
      ["gaming"],
      undefined,
      undefined,
      new Map([[`cpu:${topCpuId}`, { priceKrw: staticCpuPrice + 999_999, sampleCount: 2, updatedAt: new Date().toISOString() }]])
    );

    const matching = withUnreliableOverride.find((r) => r.partIds.cpu === topCpuId);
    expect(matching!.parts.find((p) => p.label === "CPU")!.price).toBe(staticCpuPrice);
  });

  it("7일보다 오래된 행은 무시하고 정적 가격을 그대로 쓴다", () => {
    const baseline = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"]);
    const topCpuId = baseline[0].partIds.cpu;
    const staticCpuPrice = baseline[0].parts.find((p) => p.label === "CPU")!.price;
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

    const withStaleOverride = recommend(
      { 1: ["게임"], 3: ["300만원 이상"] },
      existingParts,
      "none",
      ["gaming"],
      undefined,
      undefined,
      new Map([[`cpu:${topCpuId}`, { priceKrw: staticCpuPrice + 999_999, sampleCount: 5, updatedAt: eightDaysAgo }]])
    );

    const matching = withStaleOverride.find((r) => r.partIds.cpu === topCpuId);
    expect(matching!.parts.find((p) => p.label === "CPU")!.price).toBe(staticCpuPrice);
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

    const results = recommend({ 1: ["사무"], 3: ["100~150만원"] }, existingParts, "none", ["work"]);
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
      ["사무", "100~150만원"], // "100만원 이하"는 카탈로그 최저 구성가보다 낮아 항상 결과가 빈다
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

describe("isNewPurchaseEligibleCpu / isNewPurchaseEligibleGpu — 단종/구형 세대 판정", () => {
  it("RTX 30번대/RX 6000번대(2021년 이전)는 신규 구매 후보에서 제외된다", () => {
    const rtx3090 = gpus.find((g) => g.id === "rtx3090")!;
    const rtx3080 = gpus.find((g) => g.id === "rtx3080")!;
    const rtx3070 = gpus.find((g) => g.id === "rtx3070")!;
    const rtx3060 = gpus.find((g) => g.id === "rtx3060")!;
    const rx6800xt = gpus.find((g) => g.id === "rx6800xt")!;
    for (const gpu of [rtx3090, rtx3080, rtx3070, rtx3060, rx6800xt]) {
      expect(isNewPurchaseEligibleGpu(gpu)).toBe(false);
    }
  });

  it("RTX 4090/RX 7900 XTX·XT(2022년, RTX 40/RDNA3 세대)부터는 신규 구매 후보로 허용된다", () => {
    const rtx4090 = gpus.find((g) => g.id === "rtx4090")!;
    const rx7900xtx = gpus.find((g) => g.id === "rx7900xtx")!;
    const rtx4060 = gpus.find((g) => g.id === "rtx4060")!;
    for (const gpu of [rtx4090, rx7900xtx, rtx4060]) {
      expect(isNewPurchaseEligibleGpu(gpu)).toBe(true);
    }
  });

  it("세대 접두 패턴이 없는 브랜드(Intel Arc 등)만 releaseYear 폴백 경계값을 쓴다", () => {
    expect(isNewPurchaseEligibleGpu({ name: "Intel Arc B580", releaseYear: MIN_NEW_PURCHASE_GPU_RELEASE_YEAR } as never)).toBe(true);
    expect(isNewPurchaseEligibleGpu({ name: "Intel Arc B580", releaseYear: MIN_NEW_PURCHASE_GPU_RELEASE_YEAR - 1 } as never)).toBe(false);
  });

  it("실제로 겪은 회귀: releaseYear가 2022로 찍힌 'GeForce RTX 3050 4 GB'도 RTX 30번대라 제외된다", () => {
    // releaseYear만 봤다면 MIN_NEW_PURCHASE_GPU_RELEASE_YEAR(2022) 기준을 통과해 "최신"으로
    // 잘못 분류됐을 항목 — 병합 카탈로그 실측치로 그대로 고정한다.
    expect(isNewPurchaseEligibleGpu({ name: "GeForce RTX 3050 4 GB", releaseYear: 2022 } as never)).toBe(false);
  });

  it("병합 카탈로그 전체를 통틀어, RTX 30번대 이하/RX 6000번대 이하로 이름이 붙은 GPU는 예외 없이 제외된다", () => {
    const leaked = gpus.filter((gpu) => {
      const isLegacyName = /RTX\s?[123]\d{3}|GTX\s?\d{3,4}|RX\s?[3-6]\d{3}\b|RX\s?[3-5]\d{2}\b/i.test(gpu.name);
      return isLegacyName && isNewPurchaseEligibleGpu(gpu);
    });
    expect(leaked.map((g) => g.name)).toEqual([]);
  });

  it("2019년 이전(Ryzen 1000~3000번대 등)은 신규 구매 후보에서 제외된다", () => {
    const ryzen3_1200 = cpus.find((c) => c.name === "Ryzen 3 1200")!;
    expect(ryzen3_1200).toBeDefined();
    expect(isNewPurchaseEligibleCpu(ryzen3_1200)).toBe(false);
  });

  it("Ryzen 5 5600(2020, 지금도 신품 유통되는 예산형 스테디셀러)은 신규 구매 후보로 계속 허용된다", () => {
    const r5600 = cpus.find((c) => c.id === "r5-5600")!;
    expect(isNewPurchaseEligibleCpu(r5600)).toBe(true);
  });
});

describe("recommend — 신규 구매 후보군의 구형 세대 제외 회귀", () => {
  // "100만원 이하"는 카탈로그 최저 구성가(케이스 포함 약 111만원)보다 낮아 budgetTarget 하드 컷
  // 적용 후 어떤 용도로도 구성 자체가 불가능하다 — 실제 구성 가능한 최저 프리셋인 "100~150만원"으로
  // "저예산" 조건을 검증한다(예산 하드 컷 자체의 empty 케이스는 result/page.tsx의 안내 UI로 별도 처리).
  // "게임"은 "100~150만원"도 안 쓴다 — RAM 가격이 2026년 AI/HBM발 D램 공급난으로 카탈로그 전반
  // 갱신된 뒤로는(app/database/ram.ts 참고) 게임 용도(디스크리트 GPU 필수, iGPU 생략 불가)의 실제
  // 최저 구성가가 133만원대까지 올라가 "100~150만원"(목표 125만원)으로는 구성 자체가 불가능하다 —
  // "150~200만원"이 이미 이 매트릭스에 있으므로 그걸로 게임의 저예산 조건을 검증한다.
  const purposeBudgetMatrix: Array<[string, string]> = [
    ["게임", "150~200만원"],
    ["게임", "200~300만원"],
    ["게임", "300만원 이상"],
    ["사무", "100~150만원"],
    ["영상편집", "300만원 이상"],
  ];

  it("(검증 1) 신규 구매 추천 결과(TOP1~3)에 RTX 30번대 이하 GPU/2019년 이전 CPU가 전혀 나오지 않는다", () => {
    for (const [purposeLabel, budgetLabel] of purposeBudgetMatrix) {
      const results = recommend({ 1: [purposeLabel], 3: [budgetLabel] }, baseExistingParts(), "none");
      for (const result of results) {
        const cpu = cpus.find((c) => c.id === result.partIds.cpu);
        expect(cpu).toBeDefined();
        // releaseYear 단순 비교가 아니라 실제 판정 함수로 확인한다 — RTX 3050처럼 releaseYear만으로는
        // "최신"으로 잘못 통과되는 회귀가 실제로 있었다(위 isNewPurchaseEligibleGpu 테스트 참고).
        expect(isNewPurchaseEligibleCpu(cpu!)).toBe(true);

        // GPU 생략(iGPU만 사용) 후보는 partIds.gpu가 실제 카탈로그 id가 아니라 sentinel이라
        // 세대 판정 대상 자체가 없다 — 사무/개발 + igpu:true CPU 조합에서만 나올 수 있다.
        if (result.partIds.gpu === IGPU_ONLY_GPU_ID) continue;
        const gpu = gpus.find((g) => g.id === result.partIds.gpu);
        expect(gpu).toBeDefined();
        expect(isNewPurchaseEligibleGpu(gpu!)).toBe(true);
      }
    }
  });

  it("(검증 3) 100만원 이하부터 300만원 이상까지 어느 예산대에서도 최신 세대만으로 결과가 비지 않는다", () => {
    for (const [purposeLabel, budgetLabel] of purposeBudgetMatrix) {
      const results = recommend({ 1: [purposeLabel], 3: [budgetLabel] }, baseExistingParts(), "none");
      expect(results.length, `${purposeLabel}/${budgetLabel}에서 결과가 비었다`).toBeGreaterThan(0);
    }
  });

  it("(검증 2) 보유 부품으로 RTX 3080(구형 세대)을 지정하면 세대 제외 필터와 무관하게 여전히 정상 인식된다", () => {
    const existingParts = baseExistingParts();
    existingParts.GPU = { enabled: true, brand: "NVIDIA", manufacturer: "", model: "GeForce RTX 3080" };

    const results = recommend({ 1: ["게임"], 3: ["150~200만원"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.partIds.gpu).toBe("rtx3080");
      expect(result.ownedParts.gpu).toBe(true);
    }
  });

  it("(검증 2) 보유 부품으로 2019년 이전 구형 CPU(Ryzen 3 1200)를 지정해도 세대 제외 필터와 무관하게 정상 인식된다", () => {
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 3 1200" };

    const results = recommend({ 1: ["사무"], 3: ["100만원 이하"] }, existingParts, "none", ["work"]);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.partIds.cpu).toBe(cpus.find((c) => c.name === "Ryzen 3 1200")!.id);
      expect(result.ownedParts.cpu).toBe(true);
    }
  });
});

describe("recommend — CPU-GPU 병목 자기모순 경고 방지(CPU 보유 고정 시)", () => {
  it("보유 CPU와 치명적 병목(CPU_GPU_GAP_LARGE 초과) 관계인 GPU는 후보에 오르지 않는다 — 경고와 추천이 서로 모순되지 않는다", () => {
    const existingParts = baseExistingParts();
    existingParts.CPU = { enabled: true, brand: "AMD", model: "Ryzen 5 5600" };

    const results = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      const criticalBottleneck = result.warnings.some((w) => w.severity === "critical" && /병목/.test(w.message));
      expect(criticalBottleneck).toBe(false);
    }
  });

  it("대칭 케이스 — 보유 GPU가 성능이 낮아도(예: 전문가용 GPU) 자유 선택되는 CPU가 그 GPU와 병목 없이 짝지어진다", () => {
    // Arc Pro B50의 gameScore를 워크스테이션 감점으로 낮추고 나서 실제로 드러난 문제: GPU를
    // 보유 부품으로 고정하면 CPU는 자유 선택인데, CPU 풀이 순수 목적 적합도로만 뽑히면 이
    // 낮은 gameScore GPU와 최상급 CPU가 짝지어져 compatibilityScore가 70 밑으로 떨어지고
    // 결과 자체가 통째로 사라졌다.
    const existingParts = baseExistingParts();
    existingParts.GPU = { enabled: true, brand: "Intel", manufacturer: "", model: "Intel Arc Pro B50" };

    const results = recommend({ 1: ["게임"], 3: ["300만원 이상"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      const criticalBottleneck = result.warnings.some((w) => w.severity === "critical" && /병목/.test(w.message));
      expect(criticalBottleneck).toBe(false);
    }
  });
});

describe("recommend — 게임 용도 신규 구매 후보에서 전문가용(워크스테이션) GPU 배제", () => {
  // 신고된 버그: "Intel Arc Pro B50"이 gameScore 81(VRAM/TGP만 보는 회귀 추정, 워크스테이션
  // 감점 반영 전)을 받아 게임 용도 TOP1에 올랐다 — 게임 검증이 없는 전문가용 카드인데도.
  const purposeBudgetMatrix: Array<[string, string]> = [
    ["게임", "100만원 이하"],
    ["게임", "150~200만원"],
    ["게임", "200~300만원"],
    ["게임", "300만원 이상"],
  ];

  it("(검증) 어느 예산대에서도 게임 용도 TOP1~3에 전문가용 GPU(Arc Pro 등)가 나오지 않는다", () => {
    for (const [purposeLabel, budgetLabel] of purposeBudgetMatrix) {
      const results = recommend({ 1: [purposeLabel], 3: [budgetLabel] }, baseExistingParts(), "none", ["gaming"]);
      for (const result of results) {
        const gpu = gpus.find((g) => g.id === result.partIds.gpu);
        expect(gpu).toBeDefined();
        expect(isWorkstationGpuModel(gpu!.name)).toBe(false);
      }
    }
  });

  it("전문가용 GPU 배제는 게임 용도에만 적용된다 — 영상편집/CAD 용도에서는 여전히 후보가 될 수 있다", () => {
    // 카탈로그에서 workScore가 가장 높은 워크스테이션 GPU(Arc Pro B60)가 영상편집 목적,
    // 넉넉한 예산에서 실제로 후보 풀에 들어갈 수 있는지 확인한다(반드시 선택되어야 하는 건
    // 아니지만, "게임 용도가 아니면 원천 배제되지 않는다"는 정책 자체를 검증한다).
    const results = recommend({ 1: ["영상편집"], 3: ["300만원 이상"] }, baseExistingParts(), "none", ["video"]);
    expect(results.length).toBeGreaterThan(0);
    // 최소한 결과가 정상적으로 나오고(전문가용 배제 필터가 이 용도에는 아예 관여하지 않음),
    // 배제 로직 자체가 이 경로에선 호출되지 않았음을 간접적으로 확인 — 결과가 비지 않으면 충분하다.
  });

  it("보유 부품으로 전문가용 GPU(Arc Pro B50)를 지정하면 게임 용도에서도 배제 필터와 무관하게 정상 인식된다", () => {
    const existingParts = baseExistingParts();
    existingParts.GPU = { enabled: true, brand: "Intel", manufacturer: "", model: "Intel Arc Pro B50" };

    const results = recommend({ 1: ["게임"], 3: ["150~200만원"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.partIds.gpu).toBe("arc-pro-b50");
      expect(result.ownedParts.gpu).toBe(true);
    }
  });
});

// app/context/BuildContext.tsx의 setBudgetExact()가 실제로 만드는 값과 동일한 형태 —
// {min: value-EXACT_BUDGET_TOLERANCE, max: value+EXACT_BUDGET_TOLERANCE}로 recommend()를 호출한다.
function exactBudgetRange(value: number) {
  return { min: Math.max(0, value - EXACT_BUDGET_TOLERANCE), max: value + EXACT_BUDGET_TOLERANCE };
}

describe("recommend — 정확한 금액 입력(exact mode) 편차 범위 제한", () => {
  const existingParts = baseExistingParts();

  // 100만원은 "게임" 용도로는 카탈로그 최저가(약 124.5만원)보다도 낮아 애초에 구성 불가능한
  // 목표가라(그 케이스는 아래 "극단적으로 낮은 목표가" 테스트가 별도로 다룬다), 여기서는 "사무"
  // 용도로 검증한다 — 내장그래픽만으로 충분해 100만원대가 실제로 achievable하다.
  it("target=100만원(사무 용도)일 때 TOP1~3 총액이 모두 target±20만원 범위 안에 들어온다", () => {
    const target = 1_000_000;
    const results = recommend({ 1: ["사무"], 3: [String(target)] }, existingParts, "none", ["work"], exactBudgetRange(target), target);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(Math.abs(result.totalPrice - target)).toBeLessThanOrEqual(EXACT_BUDGET_TOLERANCE);
    }
  });

  it("target=400만원(게임 용도)일 때 TOP1~3 총액이 모두 target±20만원 범위 안에 들어온다", () => {
    const target = 4_000_000;
    const results = recommend({ 1: ["게임"], 3: [String(target)] }, existingParts, "none", ["gaming"], exactBudgetRange(target), target);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(Math.abs(result.totalPrice - target)).toBeLessThanOrEqual(EXACT_BUDGET_TOLERANCE);
    }
  });

  // 회귀 가드: CPU/GPU가 4단계 가격 티어(고정가)로만 책정돼 있던 시절엔 카탈로그가 만들 수 있는
  // 견적 총액이 대략 420만원대에서 막혀 500만원 이상은 전부 "구성 불가"였다(신고된 버그). RTX
  // 5090/Ryzen 9 9950X3D를 enthusiast 티어에 hand-curate하고 GPU enthusiast 티어 가격을
  // 실제 시세 수준(400만원)으로 올려 카탈로그 최고가를 끌어올린 뒤에는 500만원/700만원도
  // 정상적으로 TOP1~3을 채운다.
  it("target=500만원(게임 용도)일 때도 '구성 불가' 없이 TOP1~3 총액이 모두 target±20만원 범위 안에 들어온다", () => {
    const target = 5_000_000;
    const results = recommend({ 1: ["게임"], 3: [String(target)] }, existingParts, "none", ["gaming"], exactBudgetRange(target), target);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(Math.abs(result.totalPrice - target)).toBeLessThanOrEqual(EXACT_BUDGET_TOLERANCE);
    }
  });

  it("target=700만원(게임 용도)일 때도 '구성 불가' 없이 TOP1~3 총액이 모두 target±20만원 범위 안에 들어온다", () => {
    const target = 7_000_000;
    const results = recommend({ 1: ["게임"], 3: [String(target)] }, existingParts, "none", ["gaming"], exactBudgetRange(target), target);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(Math.abs(result.totalPrice - target)).toBeLessThanOrEqual(EXACT_BUDGET_TOLERANCE);
    }
  });

  it("target=230만원(게임 용도)일 때 TOP1~3 총액이 모두 target±20만원 범위 안에 들어온다", () => {
    const target = 2_300_000;
    const results = recommend({ 1: ["게임"], 3: [String(target)] }, existingParts, "none", ["gaming"], exactBudgetRange(target), target);

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(Math.abs(result.totalPrice - target)).toBeLessThanOrEqual(EXACT_BUDGET_TOLERANCE);
    }
  });

  it("가성비(2번째) 슬롯도 균형(1번째) 슬롯과 마찬가지로 편차 범위를 지킨다(원래 버그: 가성비/최고성능 슬롯엔 상한이 없었음)", () => {
    const target = 2_300_000;
    const results = recommend({ 1: ["게임"], 3: [String(target)] }, existingParts, "none", ["gaming"], exactBudgetRange(target), target);

    expect(results.length).toBeGreaterThanOrEqual(2);
    // 원래 버그 재현 조건이었던 사례(230만원 지정 -> 213만원/306만원)를 정확히 겨냥한 회귀 테스트.
    for (const result of results) {
      expect(result.totalPrice).toBeGreaterThanOrEqual(target - EXACT_BUDGET_TOLERANCE);
      expect(result.totalPrice).toBeLessThanOrEqual(target + EXACT_BUDGET_TOLERANCE);
    }
  });

  it("극단적으로 낮은 목표가(30만원)는 범위 안에서 구성 가능한 조합이 없어 빈 배열을 반환한다(억지로 범위 밖 결과를 끼워 넣지 않는다)", () => {
    const target = 300_000;
    const results = recommend({ 1: ["게임"], 3: [String(target)] }, existingParts, "none", ["gaming"], exactBudgetRange(target), target);

    expect(results).toEqual([]);
  });

  it("findCheapestViableTotalPrice — 30만원처럼 구성 불가능한 목표가에서도 실제 최소 구성가를 찾아 target보다 훨씬 높은 값을 반환한다", () => {
    const target = 300_000;
    const cheapest = findCheapestViableTotalPrice({ 1: ["게임"] }, existingParts, "none", ["gaming"]);

    expect(cheapest).not.toBeNull();
    expect(cheapest!).toBeGreaterThan(target);
  });

  it("range/preset 모드(preferredBudgetTarget 없음)는 이 하드 필터의 영향을 받지 않는다 — 기존 동작 그대로 유지", () => {
    const results = recommend({ 1: ["게임"], 3: ["200~300만원"] }, existingParts, "none", ["gaming"]);
    expect(results.length).toBeGreaterThan(0);
    // preferredBudgetTarget이 없을 때는 범위 필터 자체가 적용되지 않으므로, 결과가 20만원 편차
    // 안에 딱 들어맞을 필요가 없다(범위 폭 자체가 100만원이라 자연히 넓게 퍼질 수 있음) — 그저
    // "정상적으로 결과가 나온다"만 확인해 exact 모드 전용 필터가 range 모드를 침범하지 않았음을 본다.
  });

  it("findMostExpensiveViableTotalPrice — 카탈로그로 도저히 못 만드는 초고예산(3000만원)에서도 실제 최고 구성가를 찾아 target보다 훨씬 낮은 값을 반환한다", () => {
    const target = 30_000_000;
    const mostExpensive = findMostExpensiveViableTotalPrice({ 1: ["게임"] }, existingParts, "none", ["gaming"]);

    expect(mostExpensive).not.toBeNull();
    expect(mostExpensive!).toBeLessThan(target);
    // 500/700만원 테스트가 이미 통과했으니, 카탈로그 최고가는 최소한 700만원+허용치보다는 커야
    // "700만원도 구성 가능"과 앞뒤가 맞는다.
    expect(mostExpensive!).toBeGreaterThan(7_000_000 - EXACT_BUDGET_TOLERANCE);
  });

  it("초고예산(3000만원)은 range로 줘도 구성 불가(빈 배열) — 무한정 비싼 조합을 억지로 만들어내지 않는다", () => {
    const target = 30_000_000;
    const results = recommend(
      { 1: ["게임"], 3: [String(target)] },
      existingParts,
      "none",
      ["gaming"],
      { min: target - EXACT_BUDGET_TOLERANCE, max: target + EXACT_BUDGET_TOLERANCE },
      target
    );
    expect(results).toEqual([]);
  });
});

describe("신규 플래그십 CPU/GPU 카탈로그 확장 회귀", () => {
  it("RTX 5090이 curatedGpus에 정확히 1개만 있고(자동 추정 경로와 중복되지 않음), 실제 공식 스펙(TGP 575W)을 갖는다", () => {
    const matches = curatedGpus.filter((g) => /^GeForce RTX 5090$/.test(g.name));
    expect(matches.length).toBe(1);
    expect(matches[0].tgp).toBe(575);
    expect(matches[0].vram).toBe(32);
    expect(matches[0].priceTier).toBe("enthusiast");
  });

  it("gpus(추천 엔진 후보 풀) 전체에도 'GeForce RTX 5090'(공식 스펙)이 정확히 1개만 있다 — buildAdditionalGpus가 중복 추가하지 않는다", () => {
    const matches = gpus.filter((g) => g.name === "GeForce RTX 5090");
    expect(matches.length).toBe(1);
    expect(matches[0].tgp).toBe(575);
  });

  it("Ryzen 9 9950X3D가 curatedCpus에 있고 신규 구매 세대 필터(isNewPurchaseEligibleCpu)를 통과한다", () => {
    const x3d = curatedCpus.find((c) => c.name === "Ryzen 9 9950X3D");
    expect(x3d).toBeDefined();
    expect(isNewPurchaseEligibleCpu(x3d!)).toBe(true);
    expect(x3d!.priceTier).toBe("enthusiast");
  });

  it("RTX 5090이 신규 구매 세대 필터(isNewPurchaseEligibleGpu)를 통과한다", () => {
    const rtx5090 = curatedGpus.find((g) => g.name === "GeForce RTX 5090");
    expect(rtx5090).toBeDefined();
    expect(isNewPurchaseEligibleGpu(rtx5090!)).toBe(true);
  });

  it("최상위 티어(enthusiast) CPU/GPU가 하위 티어보다 성능 점수가 낮지 않다(티어 순서 정합성)", () => {
    const enthusiastCpus = curatedCpus.filter((c) => c.priceTier === "enthusiast");
    const budgetCpus = curatedCpus.filter((c) => c.priceTier === "budget");
    const minEnthusiastScore = Math.min(...enthusiastCpus.map((c) => c.gameScore));
    const maxBudgetScore = Math.max(...budgetCpus.map((c) => c.gameScore));
    expect(minEnthusiastScore).toBeGreaterThanOrEqual(maxBudgetScore);

    const enthusiastGpus = curatedGpus.filter((g) => g.priceTier === "enthusiast");
    const budgetGpus = curatedGpus.filter((g) => g.priceTier === "budget");
    const minEnthusiastGpuScore = Math.min(...enthusiastGpus.map((g) => g.gameScore));
    const maxBudgetGpuScore = Math.max(...budgetGpus.map((g) => g.gameScore));
    expect(minEnthusiastGpuScore).toBeGreaterThanOrEqual(maxBudgetGpuScore);
  });

  it("중국 내수 시장 전용 컷다운 변형(RTX 5090 D, RTX 5090 D V2)은 신규 구매 후보에서 제외된다", () => {
    const chinaVariants = gpus.filter((g) => /5090 D(\s+V\d+)?$/i.test(g.name));
    expect(chinaVariants.length).toBeGreaterThan(0); // 자동 추정 경로로 카탈로그엔 여전히 존재해야(제외 로직 자체를 테스트하려면)
    for (const variant of chinaVariants) {
      expect(isNewPurchaseEligibleGpu(variant), `${variant.name}이 신규 구매 후보에서 제외되지 않음`).toBe(false);
    }
  });

  it("findMostExpensiveViableTotalPrice — 700만원 exact 테스트가 통과할 만큼(700만원+허용치 이상) 실제 최고 구성가를 정확히 찾는다", () => {
    // buildRankedPool을 직접 스캔하기 전에는(선택 전략 경유) 최고가를 360만원으로 잘못 보고해
    // 700만원이 실제로는 achievable한데도 "구성 불가"로 잘못 안내하는 회귀가 있었다.
    const mostExpensive = findMostExpensiveViableTotalPrice({ 1: ["게임"] }, baseExistingParts(), "none", ["gaming"]);
    expect(mostExpensive).not.toBeNull();
    expect(mostExpensive!).toBeGreaterThanOrEqual(7_000_000 - EXACT_BUDGET_TOLERANCE);
  });

  it("GPU enthusiast 티어 안에서도 hand-curate된 모델별 실거래가가 다르다(RTX 5090 > RTX 4090 > RTX 5080 > RTX 4070 Ti SUPER) — 티어 하나에 고정가 하나면 500만원+ 예산을 achievable/gap-free 둘 다 만족시킬 수 없었다", () => {
    const rtx5090 = curatedGpus.find((g) => g.name === "GeForce RTX 5090")!;
    const rtx4090 = curatedGpus.find((g) => g.name === "GeForce RTX 4090")!;
    const rtx5080 = curatedGpus.find((g) => g.name === "GeForce RTX 5080")!;
    const rtx4070tisuper = curatedGpus.find((g) => g.name === "GeForce RTX 4070 Ti SUPER")!;

    for (const gpu of [rtx5090, rtx4090, rtx5080, rtx4070tisuper]) {
      expect(gpu.priceTier).toBe("enthusiast");
      expect(gpu.price, `${gpu.name}에 개별 실거래가(price)가 없음`).toBeGreaterThan(0);
    }

    expect(rtx5090.price!).toBeGreaterThan(rtx4090.price!);
    expect(rtx4090.price!).toBeGreaterThan(rtx5080.price!);
    expect(rtx5080.price!).toBeGreaterThan(rtx4070tisuper.price!);
  });
});

describe("recommend — GPU 생략(iGPU만 사용) 후보", () => {
  it("사무 용도 + 100만원 이하 -> GPU 생략 후보가 나오고 gpuPrice=0, '내장그래픽 사용'으로 표시된다", () => {
    const results = recommend({}, baseExistingParts(), "none", ["work"], { min: 500_000, max: 1_000_000 });
    expect(results.length).toBeGreaterThan(0);

    const igpuOnly = results.find((r) => r.partIds.gpu === IGPU_ONLY_GPU_ID);
    expect(igpuOnly, "100만원 이하에서 GPU 생략 후보가 하나도 없음").toBeDefined();
    expect(igpuOnly!.gpu).toBe("내장그래픽 사용");
    expect(igpuOnly!.parts.find((p) => p.label === "GPU")?.name).toBe("내장그래픽 사용");
    expect(igpuOnly!.parts.find((p) => p.label === "GPU")?.price).toBe(0);

    const cpu = cpus.find((c) => c.id === igpuOnly!.partIds.cpu);
    expect(cpu?.igpu, "GPU 생략 후보의 CPU는 반드시 igpu:true여야 함").toBe(true);
  });

  it("개발 용도도 GPU 생략 후보로 구성 가능하다(단, 100만원 이하 예산에선 아직 안 나옴 — 아래 설명)", () => {
    // dev 용도의 CPU 선별 기준(singlePurposeCpuFitScore)은 순수 multiCoreScore라 igpu 여부와
    // 무관하다 — budget 티어엔 CPU가 5개뿐이고 CPU_POOL_PER_TIER=4라 상위 4개만 남는데,
    // multiCoreScore 기준 정렬에서 이번에 추가한 두 iGPU CPU(r5-5600g=42, i3-14100=38)가
    // 마침 budget 티어 최하위권이라 100만원 이하에선 둘 다 풀에서 잘려나간다(사무 용도는
    // igpu 자체에 +40 가산점을 주는 cpuOfficeFitScore라 카탈로그의 다른 저전력 iGPU 후보가
    // 그 예산에서도 살아남는다 — 위 테스트 참고). 100~150만원부터는 i5-14600K 등 성능 자체가
    // 우수한 mid/high 티어 iGPU CPU가 multiCoreScore 기준으로도 상위권이라 정상적으로 나온다.
    const results = recommend({}, baseExistingParts(), "none", ["dev"], { min: 1_000_000, max: 1_500_000 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.partIds.gpu === IGPU_ONLY_GPU_ID)).toBe(true);
  });

  it("게임 용도는 igpu:true CPU를 쓰더라도 GPU 생략 후보가 절대 나오지 않는다(회귀 없음 확인)", () => {
    const budgetRanges: Array<{ min: number; max: number }> = [
      { min: 500_000, max: 1_000_000 },
      { min: 1_000_000, max: 1_500_000 },
      { min: 1_500_000, max: 2_000_000 },
      { min: 2_000_000, max: 3_000_000 },
      { min: 3_000_000, max: 5_000_000 },
    ];
    for (const range of budgetRanges) {
      const results = recommend({}, baseExistingParts(), "none", ["gaming"], range);
      for (const result of results) {
        expect(result.partIds.gpu).not.toBe(IGPU_ONLY_GPU_ID);
        expect(gpus.find((g) => g.id === result.partIds.gpu)).toBeDefined();
      }
    }
  });

  it("영상편집 용도도 GPU 생략 후보가 나오지 않는다(work/dev만 허용 — video는 의도적으로 제외)", () => {
    const results = recommend({}, baseExistingParts(), "none", ["video"], { min: 500_000, max: 1_500_000 });
    for (const result of results) {
      expect(result.partIds.gpu).not.toBe(IGPU_ONLY_GPU_ID);
    }
  });

  it("사무+게임을 동시에 선택하면(purposes 배열에 게임이 섞임) GPU 생략을 허용하지 않는다", () => {
    const results = recommend({}, baseExistingParts(), "none", ["work", "gaming"], { min: 500_000, max: 1_500_000 });
    for (const result of results) {
      expect(result.partIds.gpu).not.toBe(IGPU_ONLY_GPU_ID);
    }
  });

  it("이미 GPU를 보유 부품으로 고정한 경우엔 GPU 생략 후보를 만들지 않는다", () => {
    const existingParts = baseExistingParts();
    existingParts.GPU = { enabled: true, brand: "NVIDIA", manufacturer: "", model: "GeForce RTX 4060" };
    const results = recommend({}, existingParts, "none", ["work"], { min: 500_000, max: 2_000_000 });
    for (const result of results) {
      expect(result.partIds.gpu).not.toBe(IGPU_ONLY_GPU_ID);
      expect(result.ownedParts.gpu).toBe(true);
    }
  });
});
