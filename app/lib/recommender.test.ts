import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeBudgetFactor, cpuPurposeFitScore, pickPurpose, recommend, selectDiverseCpuPool, selectDiversePool } from "./recommender";
import type { CPU } from "../database/cpu";
import { cpus, curatedCpus } from "../database/cpu";

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
