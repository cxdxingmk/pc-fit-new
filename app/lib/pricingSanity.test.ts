import { describe, expect, it } from "vitest";
import { rams } from "../database/ram";
import { motherboards } from "../database/motherboard";
import { psus } from "../database/psu";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { recommend, ratePsu } from "./recommender";
import type { ExistingPartsState } from "../types/build";

/**
 * 카테고리별 가격 sanity-check — 32GB DDR5가 50만원, B760 보드가 50만원처럼 개별 항목
 * 가격 없이 4단계 티어(25/50/85/120만원)로만 뭉뚱그려 나오던 이상치를 재발 방지한다.
 */

const priceTierToPrice: Record<"budget" | "mid" | "high", number> = { budget: 250_000, mid: 500_000, high: 850_000 };

describe("RAM 가격 sanity", () => {
  it("모든 RAM 항목이 개별 실거래가(price)를 갖고, 플랫 티어 폴백 값과 우연히도 겹치지 않는다", () => {
    for (const ram of rams) {
      expect(ram.price, `${ram.name}에 price가 없음`).toBeGreaterThan(0);
      expect(ram.price, `${ram.name}(${ram.priceTier})가 여전히 플랫 티어값(${priceTierToPrice[ram.priceTier]}원)과 동일함`).not.toBe(
        priceTierToPrice[ram.priceTier]
      );
      // 절대 원화 범위 대신 GB당 단가로 검사한다 — 카탈로그가 8GB~64GB까지 다양한 용량을
      // 담고 있어 플랫 상한(예: 40만원)을 쓰면 64GB 항목이 항상 걸린다. 2026년 D램 공급난으로
      // 실제 시세가 GB당 약 5,000~23,000원대(다나와 실측, ram.ts 상단 주석 참고)라 여유 있게
      // 2,000~30,000원/GB를 벗어나면 비현실적인 가격으로 본다.
      const perGb = ram.price / ram.capacity;
      expect(perGb, `${ram.name} GB당 가격(${Math.round(perGb).toLocaleString()}원/GB)이 비현실적`).toBeGreaterThanOrEqual(2_000);
      expect(perGb, `${ram.name} GB당 가격(${Math.round(perGb).toLocaleString()}원/GB)이 비현실적`).toBeLessThanOrEqual(30_000);
    }
  });

  it("용량이 클수록(같은 세대 내에서) 가격도 같거나 더 비싸다 — 32GB가 16GB보다 싸면 이상치", () => {
    const ddr5 = rams.filter((r) => r.ddr === "DDR5").sort((a, b) => a.capacity - b.capacity);
    for (let i = 1; i < ddr5.length; i++) {
      expect(ddr5[i].price, `${ddr5[i].name}(${ddr5[i].capacity}GB)가 ${ddr5[i - 1].name}(${ddr5[i - 1].capacity}GB)보다 저렴함`).toBeGreaterThanOrEqual(
        ddr5[i - 1].price
      );
    }
  });
});

describe("메인보드 가격 sanity", () => {
  it("모든 항목이 개별 price를 갖고(더 이상 priceTier 플랫 폴백에 의존하지 않고), 칩셋 등급 대비 합리적인 범위 안에 있다", () => {
    for (const mb of motherboards) {
      expect(mb.price, `${mb.name}에 price가 없어 여전히 priceTier 폴백(${mb.priceTier})에 의존함`).toBeGreaterThan(0);
      expect(mb.price!, `${mb.name} 가격(${mb.price}원)이 비현실적`).toBeGreaterThanOrEqual(70_000);
      expect(mb.price!, `${mb.name} 가격(${mb.price}원)이 비현실적`).toBeLessThanOrEqual(900_000);
    }
  });

  it('구체적 회귀: "B760" 계열 보드는 더 이상 플랫 mid 티어값(50만원)으로 안 나온다', () => {
    const b760Boards = motherboards.filter((mb) => mb.chipset === "B760");
    expect(b760Boards.length).toBeGreaterThan(0);
    for (const mb of b760Boards) {
      expect(mb.price, `${mb.name}`).not.toBe(500_000);
    }
  });
});

describe("PSU 가격 sanity", () => {
  it("모든 항목이 개별 price를 가지며 용량 대비 합리적인 범위 안에 있다", () => {
    for (const psu of psus) {
      expect(psu.price, `${psu.name}에 price가 없음`).toBeGreaterThan(0);
      expect(psu.price!, `${psu.name} 가격(${psu.price}원)이 비현실적`).toBeGreaterThanOrEqual(40_000);
      expect(psu.price!, `${psu.name} 가격(${psu.price}원)이 비현실적`).toBeLessThanOrEqual(500_000);
    }
  });

  it("카탈로그에 550W 이하 저용량 옵션이 존재한다 — 없으면 저전력 빌드도 항상 650W+ 로 과대추천된다", () => {
    expect(psus.some((psu) => psu.wattage <= 600)).toBe(true);
  });
});

describe("PSU 추천 로직 — 오버스펙 회귀 (RTX 4060에 1000W PSU)", () => {
  it("요구 전력 대비 적정 헤드룸(650W)인 PSU가, 3배 가까이 과도한 1000W PSU보다 항상 높거나 같은 점수를 받는다", () => {
    const cpu = cpus.find((c) => c.id === "r5-5600")!;
    const gpu = gpus.find((g) => g.id === "rtx4060")!;
    expect(cpu, "테스트용 CPU를 카탈로그에서 못 찾음").toBeDefined();
    expect(gpu, "테스트용 GPU를 카탈로그에서 못 찾음").toBeDefined();

    const required = cpu.tdp + gpu.tgp + 150; // 65(CPU) + 115(GPU) + 150 = 330W대
    // 카탈로그 최소 용량이 550W라 330W 요구치 기준으로는 그것조차 순수 배율상 헤드룸이 크지만,
    // 실제로 시중에 판매되는 가장 작은 옵션이 그 정도이므로 "적정" 기준을 넉넉히 잡는다.
    const rightSized = psus.filter((p) => p.wattage >= required && p.wattage <= required * 2.2);
    const oversized = psus.filter((p) => p.wattage >= required * 2.5);
    expect(rightSized.length, "적정 헤드룸 PSU 후보가 카탈로그에 없음").toBeGreaterThan(0);
    expect(oversized.length, "과도한 오버스펙 PSU 후보가 카탈로그에 없음").toBeGreaterThan(0);

    const bestRightSized = Math.max(...rightSized.map((p) => ratePsu(p, cpu, gpu)));
    const bestOversized = Math.max(...oversized.map((p) => ratePsu(p, cpu, gpu)));
    expect(
      bestRightSized,
      `적정 헤드룸 PSU 최고점(${bestRightSized})이 오버스펙 PSU 최고점(${bestOversized})보다 낮음 — 오버스펙이 여전히 이김`
    ).toBeGreaterThanOrEqual(bestOversized);
  });

  it("실제 recommend() 파이프라인에서 저전력 게이밍 예산 추천의 TOP3 중 어느 것도 1000W 이상 PSU를 쓰지 않는다", () => {
    const existingParts: ExistingPartsState = {
      CPU: { enabled: false, brand: "", model: "" },
      GPU: { enabled: false, brand: "", manufacturer: "", model: "" },
      RAM: { enabled: false, ddr: "", capacity: "", brand: "", model: "" },
      SSD: { enabled: false, capacity: "", brand: "", model: "" },
      HDD: { enabled: false, capacity: "" },
      Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
      Power: { enabled: false, wattage: "" },
    };
    // "100~150만원"은 더 이상 게임 용도로 구성 불가하다 — RAM 가격이 2026년 D램 공급난으로
    // 카탈로그 전반 갱신된 뒤(app/database/ram.ts) 게임(디스크리트 GPU 필수)의 실제 최저
    // 구성가가 133만원대까지 올라갔다. "150~200만원"으로 저예산 게이밍 조건을 검증한다.
    const results = recommend({ 1: ["게임"], 3: ["150~200만원"] }, existingParts, "none");
    expect(results.length).toBeGreaterThan(0);

    for (const result of results.slice(0, 3)) {
      const wattageMatch = result.power.match(/(\d+)W/);
      expect(wattageMatch, `파워 문구에서 와트를 못 뽑음: "${result.power}"`).not.toBeNull();
      const wattage = Number(wattageMatch![1]);
      expect(wattage, `저예산 게이밍 추천인데 파워가 ${wattage}W — 과대추천 의심`).toBeLessThan(1000);
    }
  });
});
