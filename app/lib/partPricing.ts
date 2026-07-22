// /api/admin/update-prices 전용 순수 로직 — 네트워크 호출 없음, 전부 유닛테스트 대상.
import { curatedCpus } from "../database/cpu";
import { curatedGpus } from "../database/gpu";
import { rams } from "../database/ram";
import { ssds } from "../database/ssd";
import { hdds } from "../database/hdd";
import { motherboards } from "../database/motherboard";
import { psus } from "../database/psu";
import type { NaverShoppingItem } from "./naverShopping";

export type PartType = "cpu" | "gpu" | "ram" | "ssd" | "hdd" | "motherboard" | "psu";

export interface PriceableCatalogEntry {
  partType: PartType;
  catalogId: string;
  /** 네이버 쇼핑 검색어로도, 관련성 필터의 필수 부분 문자열로도 그대로 쓰인다 */
  name: string;
}

/**
 * curated(수작업 앵커) 배열 + RAM/SSD/HDD/모더보드/PSU 전체(전부 수작업 목록이라 작음)만
 * 가격 갱신 대상으로 삼는다. CPU/GPU의 automatically-estimated "additional" 풀(수백 개, 실제
 * 스펙만 있고 사람이 확정한 항목이 아님)은 제외한다 — scripts/applyProposals.ts가 curatedCpus/
 * curatedGpus만 패치 대상으로 삼는 것과 같은 원칙.
 */
export function buildPriceableCatalogEntries(): PriceableCatalogEntry[] {
  return [
    ...curatedCpus.map((item) => ({ partType: "cpu" as const, catalogId: item.id, name: item.name })),
    ...curatedGpus.map((item) => ({ partType: "gpu" as const, catalogId: item.id, name: item.name })),
    ...rams.map((item) => ({ partType: "ram" as const, catalogId: item.id, name: item.name })),
    ...ssds.map((item) => ({ partType: "ssd" as const, catalogId: item.id, name: item.name })),
    ...hdds.map((item) => ({ partType: "hdd" as const, catalogId: item.id, name: item.name })),
    ...motherboards.map((item) => ({ partType: "motherboard" as const, catalogId: item.id, name: item.name })),
    ...psus.map((item) => ({ partType: "psu" as const, catalogId: item.id, name: item.name })),
  ];
}

export function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, "");
}

// 케이스/액세서리 등 부품 자체가 아닌 상품을 걸러낸다 — 검색어(모델명)가 우연히 제목에 들어가도
// (예: "OO 그래픽카드 전용 브라켓") 실제 부품 판매글이 아니면 가격 표본에서 빼야 한다.
const EXCLUDE_KEYWORDS = [
  "케이스",
  "거치대",
  "파우치",
  "스티커",
  "커버",
  "가방",
  "받침대",
  "쿨러",
  "브라켓",
  "브래킷",
  "변환",
  "젠더",
  "케이블",
  "히트싱크",
  "장식",
  "스킨",
  "보호필름",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

/** 제목(HTML 태그 제거 후)에 모델명이 실제로 포함되고, 제외 키워드가 없는 상품만 남긴다. */
export function filterRelevantListings(modelName: string, items: NaverShoppingItem[]): NaverShoppingItem[] {
  const normalizedModel = normalize(modelName);
  return items.filter((item) => {
    const title = stripHtmlTags(item.title);
    if (EXCLUDE_KEYWORDS.some((keyword) => title.includes(keyword))) return false;
    return normalize(title).includes(normalizedModel);
  });
}

export function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** 중앙값의 50% 미만 또는 200% 초과인 이상치를 제외한다. */
export function excludeOutliers(prices: number[]): number[] {
  const med = median(prices);
  return prices.filter((price) => price >= med * 0.5 && price <= med * 2);
}

export interface FinalPriceResult {
  priceKrw: number;
  sampleCount: number;
}

const MIN_VALID_RESULTS = 3;

/**
 * 관련성 필터를 이미 통과한 목록을 받아 최종 가격을 계산한다. 유효 결과(필터 통과 개수)가
 * 3개 미만이면 null — 호출부는 기존 가격을 그대로 유지하고 갱신하지 않는다.
 */
export function computeFinalPrice(filteredItems: NaverShoppingItem[]): FinalPriceResult | null {
  if (filteredItems.length < MIN_VALID_RESULTS) return null;

  const prices = filteredItems.map((item) => Number(item.lprice)).filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length < MIN_VALID_RESULTS) return null;

  const withoutOutliers = excludeOutliers(prices);
  if (withoutOutliers.length === 0) return null;

  const average = Math.round(withoutOutliers.reduce((sum, price) => sum + price, 0) / withoutOutliers.length);
  return { priceKrw: average, sampleCount: withoutOutliers.length };
}
