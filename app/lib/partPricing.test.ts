import { describe, expect, it } from "vitest";
import { curatedCpus, cpus } from "../database/cpu";
import { curatedGpus, gpus } from "../database/gpu";
import { rams } from "../database/ram";
import { ssds } from "../database/ssd";
import { hdds } from "../database/hdd";
import { motherboards } from "../database/motherboard";
import { psus } from "../database/psu";
import {
  buildPriceableCatalogEntries,
  computeFinalPrice,
  diagnoseRelevanceRejections,
  excludeOutliers,
  filterRelevantListings,
  median,
  stripHtmlTags,
} from "./partPricing";
import {
  isNewPurchaseEligibleCpu,
  isNewPurchaseEligibleGpu,
  isNewPurchaseEligibleRam,
  isNewPurchaseEligibleSsd,
  isNewPurchaseEligibleMotherboard,
  isNewPurchaseEligiblePsu,
} from "./newPurchaseEligibility";
import type { NaverShoppingItem } from "./naverShopping";

function fakeItem(overrides: Partial<NaverShoppingItem>): NaverShoppingItem {
  return {
    title: "",
    link: "https://example.com",
    lprice: "0",
    hprice: "0",
    mallName: "테스트몰",
    productId: "1",
    productType: "1",
    brand: "",
    maker: "",
    category1: "",
    category2: "",
    category3: "",
    category4: "",
    ...overrides,
  };
}

describe("stripHtmlTags", () => {
  it("네이버가 검색어를 강조하는 <b></b> 태그를 제거한다", () => {
    expect(stripHtmlTags("<b>WD Black</b> SN770 1TB")).toBe("WD Black SN770 1TB");
  });
});

describe("filterRelevantListings", () => {
  const modelName = "WD Black SN770 1TB";

  it("제목에 모델명이 실제로 포함된 상품만 남긴다", () => {
    const items = [
      fakeItem({ title: "<b>WD Black</b> SN770 1TB NVMe SSD" }),
      fakeItem({ title: "삼성전자 990 PRO 1TB" }), // 전혀 다른 모델 — 제외
    ];
    const result = filterRelevantListings([modelName], items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain("SN770");
  });

  it("제목에 모델명이 포함돼도 케이스/액세서리 등 무관 상품 키워드가 있으면 제외한다", () => {
    const items = [
      fakeItem({ title: "WD Black SN770 1TB NVMe SSD" }),
      fakeItem({ title: "WD Black SN770 1TB 전용 방열판 쿨러" }),
      fakeItem({ title: "WD Black SN770 1TB M.2 SSD 히트싱크 브라켓" }),
    ];
    const result = filterRelevantListings([modelName], items);
    expect(result).toHaveLength(1);
    expect(result[0].title).not.toContain("쿨러");
  });

  it("공백/대소문자 차이가 있어도 정규화해서 매칭한다", () => {
    const items = [fakeItem({ title: "wdblack sn770 1tb ssd" })];
    expect(filterRelevantListings([modelName], items)).toHaveLength(1);
  });

  it("토큰이 여러 개면(RAM 등) 어순과 무관하게 전부 포함돼야 통과한다", () => {
    const tokens = ["32GB", "DDR5-6000"];
    const items = [
      fakeItem({ title: "삼성전자 정품 DDR5 6000 32GB (16Gx2) PC 메모리" }), // 어순이 반대(속도 먼저) — 그래도 두 토큰 다 포함되면 통과
      fakeItem({ title: "삼성전자 990 PRO 32GB" }), // "32GB"만 있고 "DDR5-6000"은 없음 — 제외
      fakeItem({ title: "커세어 DDR5-6000 16GB" }), // "DDR5-6000"만 있고 용량이 다름("32GB" 없음) — 제외
    ];
    const result = filterRelevantListings(tokens, items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain("32GB");
  });

  it("'데스크탑'이 제목에 있어도(노트북용과 구분하는 정상적인 RAM 표현) 배제하지 않는다", () => {
    // 실제로 겪은 문제: EXCLUDE_KEYWORDS에 조립PC 배제용으로 "데스크탑"을 넣었더니,
    // "데스크탑용 메모리/RAM"이라는 지극히 정상적인 표현까지 걸려서 part_prices에 ram 행이
    // 단 한 번도 저장되지 않았다 — "데스크탑"은 이제 EXCLUDE_KEYWORDS에서 빠지고, 조립PC 배제는
    // BUNDLE_CATEGORY_PATTERN(category3/4, 아래 테스트)이 전담한다.
    const tokens = ["32GB", "DDR5-6000"];
    const items = [
      fakeItem({ title: "삼성전자 정품 DDR5-6000 32GB 데스크탑 메모리" }),
      fakeItem({ title: "G.SKILL DDR5-6000 32GB(16Gx2) 데스크탑용 램" }),
    ];
    expect(filterRelevantListings(tokens, items)).toHaveLength(2);
  });

  it("제목에 '데스크탑'이 있어도 category3/4가 조립컴퓨터/완제품 계열이면 여전히 배제된다", () => {
    const tokens = ["32GB", "DDR5-6000"];
    const items = [
      fakeItem({ title: "사무용 데스크탑 컴퓨터 DDR5-6000 32GB 탑재", category3: "완제품" }),
    ];
    expect(filterRelevantListings(tokens, items)).toHaveLength(0);
  });
});

describe("diagnoseRelevanceRejections (임시 진단용)", () => {
  it("filterRelevantListings와 동일한 순서(키워드 -> 카테고리 -> 토큰)로 각 매물의 탈락 단계를 집계한다", () => {
    const tokens = ["32GB", "DDR5-6000"];
    const items = [
      fakeItem({ title: "32GB DDR5-6000 전용 브라켓", category3: "메모리" }), // 키워드
      fakeItem({ title: "32GB DDR5-6000 특가 판매", category3: "조립컴퓨터" }), // 카테고리(제목엔 배제 키워드 없음)
      fakeItem({ title: "32GB 16GB 다른모델", category3: "메모리" }), // 토큰 불일치
      fakeItem({ title: "DDR5-6000 32GB 정품", category3: "메모리" }), // 통과
    ];

    const diag = diagnoseRelevanceRejections(tokens, items);
    expect(diag.totalRaw).toBe(4);
    expect(diag.keywordExcluded).toBe(1);
    expect(diag.categoryExcluded).toBe(1);
    expect(diag.tokenMismatch).toBe(1);
    expect(diag.passed).toBe(1);
    expect(diag.samples.map((s) => s.rejectedBy)).toEqual(["keyword", "category", "token", "passed"]);
    expect(diag.samples[1].category3).toBe("조립컴퓨터");
  });

  it("filterRelevantListings가 실제로 통과시키는 개수와 diagnoseRelevanceRejections의 passed 개수가 일치한다", () => {
    const tokens = ["32GB", "DDR5-6000"];
    const items = [
      fakeItem({ title: "32GB DDR5-6000 정품 메모리", category3: "메모리" }),
      fakeItem({ title: "DDR5-6000 32GB(16Gx2) 데스크탑용 램", category3: "메모리" }),
      fakeItem({ title: "16GB DDR4-3200", category3: "메모리" }),
    ];
    expect(diagnoseRelevanceRejections(tokens, items).passed).toBe(filterRelevantListings(tokens, items).length);
  });
});

describe("median", () => {
  it("홀수 개는 정확히 가운데 값", () => {
    expect(median([10, 30, 20])).toBe(20);
  });

  it("짝수 개는 가운데 두 값의 평균", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
});

describe("excludeOutliers", () => {
  it("중앙값의 50% 미만은 이상치로 제외한다", () => {
    // median([100,100,100,49]) = 100 (짝수 4개 정렬: 49,100,100,100 → 가운데 두 값 100,100 평균=100)
    const prices = [100, 100, 100, 49];
    expect(excludeOutliers(prices)).toEqual([100, 100, 100]);
  });

  it("중앙값의 200% 초과는 이상치로 제외한다", () => {
    const prices = [100, 100, 100, 201];
    expect(excludeOutliers(prices)).toEqual([100, 100, 100]);
  });

  it("정확히 50%/200% 경계값은 포함한다(미만/초과만 제외)", () => {
    const prices = [100, 100, 100, 50, 200];
    expect(excludeOutliers(prices).sort((a, b) => a - b)).toEqual([50, 100, 100, 100, 200]);
  });
});

describe("computeFinalPrice", () => {
  it("유효 결과(필터 통과 개수)가 3개 미만이면 null — 갱신하지 않는다", () => {
    const items = [fakeItem({ lprice: "100000" }), fakeItem({ lprice: "110000" })];
    expect(computeFinalPrice(items)).toBeNull();
  });

  it("3개 이상이면 이상치를 제외한 나머지의 평균을 최종 가격으로 채택한다", () => {
    const items = [
      fakeItem({ lprice: "100000" }),
      fakeItem({ lprice: "110000" }),
      fakeItem({ lprice: "120000" }),
      fakeItem({ lprice: "500000" }), // 이상치(중앙값의 200% 초과) — 제외돼야 함
    ];
    const result = computeFinalPrice(items);
    expect(result).not.toBeNull();
    expect(result!.priceKrw).toBe(Math.round((100000 + 110000 + 120000) / 3));
    expect(result!.sampleCount).toBe(3);
  });

  it("가격이 숫자로 파싱 안 되는 항목은 표본에서 제외하고, 남은 유효 표본이 3개 미만이면 null", () => {
    const items = [fakeItem({ lprice: "100000" }), fakeItem({ lprice: "110000" }), fakeItem({ lprice: "not-a-number" })];
    expect(computeFinalPrice(items)).toBeNull();
  });
});

describe("buildPriceableCatalogEntries", () => {
  it("CPU/GPU는 curated 배열만 포함하고, 자동 추정된 additional 풀은 제외한다", () => {
    const entries = buildPriceableCatalogEntries();
    const cpuEntries = entries.filter((e) => e.partType === "cpu");
    const gpuEntries = entries.filter((e) => e.partType === "gpu");

    // additional 풀이 섞여 있었다면 전체 cpus/gpus와 개수가 같아야 하는데, curated만 쓰므로 더 적어야 한다
    expect(cpuEntries.length).toBeLessThan(cpus.length);
    expect(gpuEntries.length).toBeLessThan(gpus.length);
  });

  it("각 부품군에 신규 구매 세대 필터(newPurchaseEligibility.ts)가 적용된다 — HDD만 예외", () => {
    const entries = buildPriceableCatalogEntries();
    const idsOf = (type: string) => new Set(entries.filter((e) => e.partType === type).map((e) => e.catalogId));

    expect(idsOf("cpu")).toEqual(new Set(curatedCpus.filter(isNewPurchaseEligibleCpu).map((c) => c.id)));
    expect(idsOf("gpu")).toEqual(new Set(curatedGpus.filter(isNewPurchaseEligibleGpu).map((g) => g.id)));
    expect(idsOf("ram")).toEqual(new Set(rams.filter(isNewPurchaseEligibleRam).map((r) => r.id)));
    expect(idsOf("ssd")).toEqual(new Set(ssds.filter(isNewPurchaseEligibleSsd).map((s) => s.id)));
    expect(idsOf("motherboard")).toEqual(new Set(motherboards.filter(isNewPurchaseEligibleMotherboard).map((m) => m.id)));
    expect(idsOf("psu")).toEqual(new Set(psus.filter(isNewPurchaseEligiblePsu).map((p) => p.id)));
    // HDD는 의도적으로 필터가 없다 — 전량 포함되어야 한다.
    expect(idsOf("hdd")).toEqual(new Set(hdds.map((h) => h.id)));
  });

  it("모든 항목이 partType/catalogId/name을 갖고, catalogId가 비어있지 않다", () => {
    const entries = buildPriceableCatalogEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.catalogId.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it("RAM/SSD/HDD/모더보드/PSU도 포함된다", () => {
    const entries = buildPriceableCatalogEntries();
    const partTypes = new Set(entries.map((e) => e.partType));
    expect(partTypes).toEqual(new Set(["cpu", "gpu", "ram", "ssd", "hdd", "motherboard", "psu"]));
  });

  it("CPU/GPU/SSD/모더보드/PSU는 requiredTitleTokens가 [name] 하나뿐이라 기존 동작과 동일하다", () => {
    const entries = buildPriceableCatalogEntries();
    for (const entry of entries.filter((e) => e.partType !== "ram")) {
      expect(entry.requiredTitleTokens).toEqual([entry.name]);
      expect(entry.searchQuery).toBe(entry.name);
    }
  });

  it("RAM은 searchQuery가 스틱 구성 문구 없이 정리되고, requiredTitleTokens가 용량/DDR세대-속도 두 토큰으로 나뉜다", () => {
    const entries = buildPriceableCatalogEntries();
    const ramEntry = entries.find((e) => e.partType === "ram" && e.catalogId === "32-ddr5-6000")!;
    expect(ramEntry.name).toBe("32GB DDR5-6000 (16GB x2)"); // 표시용 name은 그대로 유지
    expect(ramEntry.searchQuery).toBe("32GB DDR5-6000"); // 검색 쿼리는 괄호 없이 정리됨
    expect(ramEntry.requiredTitleTokens).toEqual(["32GB", "DDR5-6000"]);
  });
});
