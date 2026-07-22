// /api/admin/update-prices 전용 순수 로직 — 네트워크 호출 없음, 전부 유닛테스트 대상.
import { curatedCpus } from "../database/cpu";
import { curatedGpus } from "../database/gpu";
import { rams } from "../database/ram";
import { ssds } from "../database/ssd";
import { hdds } from "../database/hdd";
import { motherboards } from "../database/motherboard";
import { psus } from "../database/psu";
import type { NaverShoppingItem } from "./naverShopping";
import { priceTierToPrice } from "./recommender";
import {
  isNewPurchaseEligibleCpu,
  isNewPurchaseEligibleGpu,
  isNewPurchaseEligibleRam,
  isNewPurchaseEligibleSsd,
  isNewPurchaseEligibleMotherboard,
  isNewPurchaseEligiblePsu,
} from "./newPurchaseEligibility";

export type PartType = "cpu" | "gpu" | "ram" | "ssd" | "hdd" | "motherboard" | "psu";

export interface PriceableCatalogEntry {
  partType: PartType;
  catalogId: string;
  /** 사람이 읽기 좋은 표시용 이름(로그/디버그 용도) — 검색/관련성 판정에는 아래 두 필드를 쓴다. */
  name: string;
  /**
   * 네이버 쇼핑 검색 쿼리. 대부분 name과 동일하지만, RAM은 "(16GB x2)" 같은 스틱 구성 문구를
   * 뺀 정리된 형태(예: "32GB DDR5-6000")를 쓴다 — 그 문구는 실제 판매 제목에 다양한 표기
   * ("16Gx2"/"16G×2"/"(16기가x2)" 등)로 나타나 검색어에 넣으면 오히려 정확도를 떨어뜨린다.
   */
  searchQuery: string;
  /**
   * 관련성 판정에 쓰는 필수 토큰들 — 전부(순서 무관) 판매 제목에 포함돼야 통과한다. 대부분
   * [name] 하나뿐이라 기존 "모델명 어순 그대로 요구" 동작과 100% 동일하다. RAM만 용량/DDR세대-
   * 속도를 독립 토큰([`${capacity}GB`, `DDR${ddr}-${speed}`])으로 나눈다 — RAM의 name은
   * 실제 제품명이 아니라 이 앱이 "용량+규격+클럭" 순서로 지어낸 합성 문자열이라, 실제 판매
   * 제목은 흔히 다른 어순(예: "DDR5-6000 32GB")을 쓰는데 어순 그대로 요구하면 거의 항상
   * 매칭에 실패했다(실사례로 확인됨 — part_prices에 ram 행이 단 한 번도 저장되지 않았음).
   */
  requiredTitleTokens: string[];
  /**
   * recommender.ts가 실제로 쓰는 정적 가격(가능하면 카탈로그의 실거래가 price 필드, 없으면
   * priceTier 고정가)과 정확히 같은 값 — computeFinalPrice의 "상식선 앵커" 안전장치에 쓰인다.
   * HDD는 recommender.ts의 가격 계산 로직 자체에 연결돼 있지 않아(app/database/hdd.ts 참고)
   * 비교 기준이 없으므로 null이다.
   */
  staticAnchorPriceKrw: number | null;
}

/**
 * curated(수작업 앵커) 배열 + RAM/SSD/HDD/모더보드/PSU 전체(전부 수작업 목록이라 작음)만
 * 가격 갱신 대상으로 삼는다. CPU/GPU의 automatically-estimated "additional" 풀(수백 개, 실제
 * 스펙만 있고 사람이 확정한 항목이 아님)은 제외한다 — scripts/applyProposals.ts가 curatedCpus/
 * curatedGpus만 패치 대상으로 삼는 것과 같은 원칙.
 *
 * 여기서 한 번 더, 부품군마다 newPurchaseEligibility.ts의 "신규 구매 가치가 있는가" 필터를
 * 적용한다 — 단종/구형 부품은 매물 자체가 거의 없거나 남은 매물이 프리미엄/중고 가격으로
 * 왜곡돼 있어 가격 수집 대상으로 부적절하다. /build 추천 엔진(recommender.ts)이 신규 구매
 * 후보를 고를 때 쓰는 것과 정확히 같은 기준이라, "추천에는 나오는데 가격은 없다" 같은
 * 불일치가 생기지 않는다. HDD는 의도적으로 필터가 없다(newPurchaseEligibility.ts 설명 참고).
 */
export function buildPriceableCatalogEntries(): PriceableCatalogEntry[] {
  return [
    ...curatedCpus.filter(isNewPurchaseEligibleCpu).map((item) => ({
      partType: "cpu" as const,
      catalogId: item.id,
      name: item.name,
      searchQuery: item.name,
      requiredTitleTokens: [item.name],
      staticAnchorPriceKrw: priceTierToPrice[item.priceTier] ?? null,
    })),
    ...curatedGpus.filter(isNewPurchaseEligibleGpu).map((item) => ({
      partType: "gpu" as const,
      catalogId: item.id,
      name: item.name,
      searchQuery: item.name,
      requiredTitleTokens: [item.name],
      staticAnchorPriceKrw: item.price ?? priceTierToPrice[item.priceTier] ?? null,
    })),
    ...rams.filter(isNewPurchaseEligibleRam).map((item) => {
      // "16GB DDR5-5600" 형태의 name과 달리, 검색/관련성 판정은 스틱 구성 문구("(16GB x2)")를
      // 뺀 핵심 스펙 두 토큰(용량, DDR세대-속도)만 쓴다 — 위 인터페이스 설명 참고.
      const ddrGeneration = item.ddr.replace("DDR", "");
      const capacityToken = `${item.capacity}GB`;
      const speedToken = `DDR${ddrGeneration}-${item.speed}`;
      return {
        partType: "ram" as const,
        catalogId: item.id,
        name: item.name,
        searchQuery: `${capacityToken} ${speedToken}`,
        requiredTitleTokens: [capacityToken, speedToken],
        staticAnchorPriceKrw: item.price ?? null,
      };
    }),
    ...ssds.filter(isNewPurchaseEligibleSsd).map((item) => ({
      partType: "ssd" as const,
      catalogId: item.id,
      name: item.name,
      searchQuery: item.name,
      requiredTitleTokens: [item.name],
      staticAnchorPriceKrw: priceTierToPrice[item.priceTier] ?? null,
    })),
    // HDD는 recommender.ts의 가격 계산 로직에 연결돼 있지 않아 앵커가 없다(위 인터페이스 설명 참고).
    ...hdds.map((item) => ({
      partType: "hdd" as const,
      catalogId: item.id,
      name: item.name,
      searchQuery: item.name,
      requiredTitleTokens: [item.name],
      staticAnchorPriceKrw: null,
    })),
    ...motherboards.filter(isNewPurchaseEligibleMotherboard).map((item) => ({
      partType: "motherboard" as const,
      catalogId: item.id,
      name: item.name,
      searchQuery: item.name,
      requiredTitleTokens: [item.name],
      staticAnchorPriceKrw: item.price ?? (item.priceTier ? priceTierToPrice[item.priceTier] : null) ?? null,
    })),
    ...psus.filter(isNewPurchaseEligiblePsu).map((item) => ({
      partType: "psu" as const,
      catalogId: item.id,
      name: item.name,
      searchQuery: item.name,
      requiredTitleTokens: [item.name],
      staticAnchorPriceKrw: item.price ?? (item.priceTier ? priceTierToPrice[item.priceTier] : null) ?? null,
    })),
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
  "방열판", // "히트싱크"의 동의어 — 기존엔 빠져 있어 저가 액세서리가 표본에 섞여 들어왔다.
  "장식",
  "스킨",
  "보호필름",
  // 조립컴퓨터/완제품 PC — 부품 단품이 아니라 그 부품을 포함한 완제품 전체 가격이라 단품 시세보다
  // 훨씬 비싸게 잡힌다(예: RTX 5070 단품 100만원대인데 "RTX 5070 게이밍PC 풀세트"는 200만원대).
  // "데스크탑"은 여기 넣지 않는다 — "데스크탑용 메모리/RAM"처럼 노트북용과 구분하는 지극히
  // 정상적인 부품 표현에도 흔히 쓰여서, 이 키워드 하나 때문에 RAM 매물이 통째로 걸러지는
  // 실제 사고가 있었다(part_prices에 ram 행이 단 한 번도 안 쌓였음). 조립PC 배제는 아래
  // BUNDLE_CATEGORY_PATTERN(네이버 공식 category3/4 신호, 신뢰도가 더 높음)에 맡긴다.
  "조립컴퓨터",
  "조립pc",
  "완제품",
  "풀세트",
  "게이밍pc",
  "본체",
  // 중고/리퍼 — 신품 시세와 무관하게 낮게 잡혀 평균/중앙값을 왜곡한다.
  "중고",
  "리퍼",
  "전시상품",
  "하자",
];

// 판매자 문구(제목)와 무관하게, 네이버가 자체 분류한 카테고리가 조립컴퓨터/완제품 계열이면
// 배제한다 — 제목에 "조립컴퓨터" 같은 키워드가 없어도(예: 그냥 "게이밍 데스크탑 세트") 카테고리
// 분류 자체가 부품이 아니라 완제품 PC임을 보여주는 경우를 잡기 위한 추가 신호.
const BUNDLE_CATEGORY_PATTERN = /조립컴퓨터|완제품|데스크탑/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

/**
 * 제목(HTML 태그 제거 후)에 requiredTokens 전부가(순서 무관) 포함되고, 제외 키워드/카테고리가
 * 없는 상품만 남긴다. 대부분의 부품군은 토큰이 [모델명] 하나뿐이라 "모델명이 그대로 포함되는가"와
 * 동일하게 동작한다 — RAM처럼 토큰이 여러 개면 각각 독립적으로 검사해 어순 문제를 피한다.
 */
export function filterRelevantListings(requiredTokens: string[], items: NaverShoppingItem[]): NaverShoppingItem[] {
  const normalizedTokens = requiredTokens.map(normalize);
  return items.filter((item) => {
    const title = stripHtmlTags(item.title);
    const normalizedTitle = normalize(title);
    if (EXCLUDE_KEYWORDS.some((keyword) => normalizedTitle.includes(normalize(keyword)))) return false;
    if (BUNDLE_CATEGORY_PATTERN.test(item.category3) || BUNDLE_CATEGORY_PATTERN.test(item.category4)) return false;
    return normalizedTokens.every((token) => normalizedTitle.includes(token));
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

// 이상치 제거 후 최종가가 정적 카탈로그 가격(이미 사람이 curate한 값)에서 이 배수를 벗어나면
// 실거래가 자체를 신뢰하지 않고 스킵한다(기존 가격 유지) — 번들/오염 매물이 관련성 필터를
// 뚫고 다수를 차지해 median 자체가 잘못된 쪽으로 넘어간 경우(필터링만으론 못 잡는 극단값)에 대한
// 마지막 안전망. 카탈로그에 이미 있는 데이터를 재사용하는 것이라 추가 비용이 들지 않는다.
const ANCHOR_MIN_RATIO = 0.4;
const ANCHOR_MAX_RATIO = 2.5;

/**
 * 관련성 필터를 이미 통과한 목록을 받아 최종 가격을 계산한다. 유효 결과(필터 통과 개수)가
 * 3개 미만이면 null — 호출부는 기존 가격을 그대로 유지하고 갱신하지 않는다. staticAnchorPriceKrw가
 * 주어지면(정적 카탈로그 가격) 최종가가 그 값의 40%~250% 범위를 벗어날 때도 null을 반환한다.
 */
export function computeFinalPrice(filteredItems: NaverShoppingItem[], staticAnchorPriceKrw?: number | null): FinalPriceResult | null {
  if (filteredItems.length < MIN_VALID_RESULTS) return null;

  const prices = filteredItems.map((item) => Number(item.lprice)).filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length < MIN_VALID_RESULTS) return null;

  const withoutOutliers = excludeOutliers(prices);
  // 이상치 제거 "이전"에만 표본 수를 검증하면, 제거 이후 표본이 1~2개로 줄어도 그대로 저장돼
  // "3개 이상"이라는 신뢰도 하한의 의미가 없어진다 — 제거 이후에도 다시 검증한다.
  if (withoutOutliers.length < MIN_VALID_RESULTS) return null;

  // 평균 대신 중앙값을 최종가로 채택한다 — 잔여 표본에 왜곡(예: 관련성 필터를 통과한 소수의
  // 번들/오염 매물)이 남아 있어도 평균보다 덜 흔들린다.
  const finalPrice = Math.round(median(withoutOutliers));

  if (staticAnchorPriceKrw && (finalPrice < staticAnchorPriceKrw * ANCHOR_MIN_RATIO || finalPrice > staticAnchorPriceKrw * ANCHOR_MAX_RATIO)) {
    return null;
  }

  return { priceKrw: finalPrice, sampleCount: withoutOutliers.length };
}
