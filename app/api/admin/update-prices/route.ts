import { NextResponse } from "next/server";
import {
  buildPriceableCatalogEntries,
  computeFinalPrice,
  filterRelevantListings,
  excludeOutliers,
  median,
  MIN_VALID_RESULTS,
  ANCHOR_MIN_RATIO,
  ANCHOR_MAX_RATIO,
  type PriceableCatalogEntry,
} from "@/app/lib/partPricing";
import { isNaverShoppingConfigured, searchNaverShopping } from "@/app/lib/naverShopping";
import { createServiceRoleClient } from "@/app/lib/supabase/serviceRole";

// 봇(별도 VPS, PM2 상시 실행)이 /가격갱신 명령을 받으면 이 라우트를 HTTP로 호출한다 — 실제 계산
// (네이버 검색 + 관련성 필터 + 중앙값/이상치 처리)은 여기서, 봇은 트리거+결과 중계만 담당한다.
export const maxDuration = 60;

// 일일 사용량(예: 369/25000)은 여유가 충분한데도 429가 나는 걸 실제로 겪었다 — 하루 한도가 아니라
// 초당/분당 호출 속도 제한에 걸리는 것으로 보인다. 동시성을 8 -> 3으로 낮추고, 각 워커가 다음
// 항목을 집기 전 STAGGER만큼 쉬어 순간 호출 속도 자체를 늦춘다(naverShopping.ts의 429 재시도와는
// 별개의, 애초에 429를 덜 유발하기 위한 예방 조치).
const CONCURRENCY_LIMIT = 3;
const REQUEST_STAGGER_MS = 150;

// 임시 진단용 확장 — 왜 스킵됐는지 알려면 지금까진 Vercel 로그를 뒤져야 했다. 나중에 필요 없어지면
// ProcessEntryResult를 다시 "updated" | "skipped" 문자열로, UpdatePricesSummary에서
// skippedDetails를 되돌리는 식으로 간단히 축소할 수 있다.
interface ProcessEntryResult {
  status: "updated" | "skipped";
  partType: string;
  catalogId: string;
  /** status가 "skipped"일 때만 채워진다. */
  reason?: string;
}

interface UpdatePricesSummary {
  updated: number;
  skipped: number;
  skippedDetails: Array<{ partType: string; catalogId: string; reason: string }>;
}

/**
 * computeFinalPrice()가 null을 반환한 정확한 이유를 재구성한다(진단 전용) — computeFinalPrice
 * 자체의 반환 타입/계약은 건드리지 않고, 같은 판정 기준(MIN_VALID_RESULTS/ANCHOR_*_RATIO,
 * excludeOutliers/median)을 그대로 재사용해 route.ts 쪽에서만 사유를 다시 계산한다.
 */
function diagnoseComputeFinalPriceFailure(
  relevant: ReturnType<typeof filterRelevantListings>,
  staticAnchorPriceKrw: number | null
): string {
  if (relevant.length < MIN_VALID_RESULTS) {
    return `관련성 필터 통과 ${relevant.length}개(최소 ${MIN_VALID_RESULTS}개 필요)`;
  }

  const prices = relevant.map((item) => Number(item.lprice)).filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length < MIN_VALID_RESULTS) {
    return `가격 파싱 가능 표본 ${prices.length}개(최소 ${MIN_VALID_RESULTS}개 필요)`;
  }

  const withoutOutliers = excludeOutliers(prices);
  if (withoutOutliers.length < MIN_VALID_RESULTS) {
    return `이상치 제거 후 표본 ${withoutOutliers.length}개(최소 ${MIN_VALID_RESULTS}개 필요)`;
  }

  const finalPrice = Math.round(median(withoutOutliers));
  if (staticAnchorPriceKrw) {
    const lower = Math.round(staticAnchorPriceKrw * ANCHOR_MIN_RATIO);
    const upper = Math.round(staticAnchorPriceKrw * ANCHOR_MAX_RATIO);
    if (finalPrice < lower || finalPrice > upper) {
      return `정적앵커 범위 벗어남 — 계산값 ${finalPrice.toLocaleString()}원, 허용범위 ${lower.toLocaleString()}~${upper.toLocaleString()}원`;
    }
  }

  return "알 수 없는 이유(computeFinalPrice 로직과 진단 로직이 어긋났을 가능성)";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 배열을 limit개씩 동시에 처리하되, 워커마다 다음 항목을 집기 전 delayMs만큼 쉰다. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>, delayMs = 0): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex]);
      if (delayMs > 0 && nextIndex < items.length) {
        await sleep(delayMs);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.PRICE_UPDATE_API_SECRET?.trim();
  if (!expected) return false; // 시크릿 자체가 안 정해져 있으면 항상 거부(fail-closed)
  return request.headers.get("x-price-update-secret") === expected;
}

async function processEntry(
  entry: PriceableCatalogEntry,
  supabase: ReturnType<typeof createServiceRoleClient>
): Promise<ProcessEntryResult> {
  const { partType, catalogId } = entry;
  const skip = (reason: string): ProcessEntryResult => ({ status: "skipped", partType, catalogId, reason });

  try {
    const rawItems = await searchNaverShopping(entry.searchQuery);
    if (rawItems.length === 0) return skip("네이버 검색결과 0개");

    const relevant = filterRelevantListings(entry.requiredTitleTokens, rawItems);
    const result = computeFinalPrice(relevant, entry.staticAnchorPriceKrw);
    if (!result) {
      // 유효 결과 3개 미만 또는 정적가 앵커 대비 이상값 — 기존 가격 유지, 갱신하지 않음
      return skip(diagnoseComputeFinalPriceFailure(relevant, entry.staticAnchorPriceKrw));
    }

    const { error } = await supabase.from("part_prices").upsert(
      {
        part_type: entry.partType,
        catalog_id: entry.catalogId,
        price_krw: result.priceKrw,
        sample_count: result.sampleCount,
      },
      { onConflict: "part_type,catalog_id" }
    );
    if (error) {
      console.error(`[update-prices] ${partType}/${catalogId} 저장 실패:`, error.message);
      return skip(`DB 저장 실패: ${error.message}`);
    }
    return { status: "updated", partType, catalogId };
  } catch (err) {
    // 개별 부품 실패가 전체 작업을 막지 않는다 — 스킵으로 집계하고 다음 항목 계속.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[update-prices] ${partType}/${catalogId} 처리 실패:`, message);
    return skip(message);
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  if (!isNaverShoppingConfigured()) {
    return NextResponse.json({ error: "네이버 쇼핑 API 키가 아직 설정되지 않았습니다." }, { status: 503 });
  }

  let supabase: ReturnType<typeof createServiceRoleClient>;
  try {
    supabase = createServiceRoleClient();
  } catch (err) {
    console.error("[update-prices] Supabase service-role 클라이언트 생성 실패:", err);
    return NextResponse.json({ error: "서버 설정 오류로 가격을 갱신할 수 없습니다." }, { status: 503 });
  }

  const entries = buildPriceableCatalogEntries();
  const outcomes = await mapWithConcurrency(entries, CONCURRENCY_LIMIT, (entry) => processEntry(entry, supabase), REQUEST_STAGGER_MS);

  const skippedOutcomes = outcomes.filter((outcome) => outcome.status === "skipped");
  const summary: UpdatePricesSummary = {
    updated: outcomes.length - skippedOutcomes.length,
    skipped: skippedOutcomes.length,
    skippedDetails: skippedOutcomes.map(({ partType, catalogId, reason }) => ({ partType, catalogId, reason: reason ?? "" })),
  };

  return NextResponse.json(summary);
}
