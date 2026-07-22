import { describe, expect, it } from "vitest";
import { curatedCpus, cpus } from "../database/cpu";
import { curatedGpus, gpus } from "../database/gpu";
import {
  buildPriceableCatalogEntries,
  computeFinalPrice,
  excludeOutliers,
  filterRelevantListings,
  median,
  stripHtmlTags,
} from "./partPricing";
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
    const result = filterRelevantListings(modelName, items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain("SN770");
  });

  it("제목에 모델명이 포함돼도 케이스/액세서리 등 무관 상품 키워드가 있으면 제외한다", () => {
    const items = [
      fakeItem({ title: "WD Black SN770 1TB NVMe SSD" }),
      fakeItem({ title: "WD Black SN770 1TB 전용 방열판 쿨러" }),
      fakeItem({ title: "WD Black SN770 1TB M.2 SSD 히트싱크 브라켓" }),
    ];
    const result = filterRelevantListings(modelName, items);
    expect(result).toHaveLength(1);
    expect(result[0].title).not.toContain("쿨러");
  });

  it("공백/대소문자 차이가 있어도 정규화해서 매칭한다", () => {
    const items = [fakeItem({ title: "wdblack sn770 1tb ssd" })];
    expect(filterRelevantListings(modelName, items)).toHaveLength(1);
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

    expect(cpuEntries).toHaveLength(curatedCpus.length);
    expect(gpuEntries).toHaveLength(curatedGpus.length);
    // additional 풀이 섞여 있었다면 전체 cpus/gpus와 개수가 같아야 하는데, curated만 쓰므로 더 적어야 한다
    expect(cpuEntries.length).toBeLessThan(cpus.length);
    expect(gpuEntries.length).toBeLessThan(gpus.length);
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
});
