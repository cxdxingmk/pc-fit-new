import { NextResponse } from "next/server";
import { buildPriceableCatalogEntries, computeFinalPrice, filterRelevantListings, type PriceableCatalogEntry } from "@/app/lib/partPricing";
import { isNaverShoppingConfigured, searchNaverShopping } from "@/app/lib/naverShopping";
import { createServiceRoleClient } from "@/app/lib/supabase/serviceRole";

// 봇(별도 VPS, PM2 상시 실행)이 /가격갱신 명령을 받으면 이 라우트를 HTTP로 호출한다 — 실제 계산
// (네이버 검색 + 관련성 필터 + 중앙값/이상치 처리)은 여기서, 봇은 트리거+결과 중계만 담당한다.
// 카탈로그 약 150개 항목 × 네이버 호출 1회씩을 동시성 제한(8)으로 처리하면 수십 초 안에 끝나
// Vercel 서버리스 시간 제한(아래 maxDuration) 안에 여유 있게 들어온다.
export const maxDuration = 60;

const CONCURRENCY_LIMIT = 8;

interface UpdatePricesSummary {
  updated: number;
  skipped: number;
}

/** 배열을 limit개씩 동시에 처리한다 — 새 의존성 없이 직접 구현(부품 약 150개 규모엔 이 정도로 충분). */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex]);
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
): Promise<"updated" | "skipped"> {
  try {
    const rawItems = await searchNaverShopping(entry.searchQuery);
    const relevant = filterRelevantListings(entry.requiredTitleTokens, rawItems);
    const result = computeFinalPrice(relevant, entry.staticAnchorPriceKrw);
    if (!result) return "skipped"; // 유효 결과 3개 미만 또는 정적가 앵커 대비 이상값 — 기존 가격 유지, 갱신하지 않음

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
      console.error(`[update-prices] ${entry.partType}/${entry.catalogId} 저장 실패:`, error.message);
      return "skipped";
    }
    return "updated";
  } catch (err) {
    // 개별 부품 실패가 전체 작업을 막지 않는다 — 스킵으로 집계하고 다음 항목 계속.
    console.error(`[update-prices] ${entry.partType}/${entry.catalogId} 처리 실패:`, err instanceof Error ? err.message : err);
    return "skipped";
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
  const outcomes = await mapWithConcurrency(entries, CONCURRENCY_LIMIT, (entry) => processEntry(entry, supabase));

  const summary: UpdatePricesSummary = {
    updated: outcomes.filter((outcome) => outcome === "updated").length,
    skipped: outcomes.filter((outcome) => outcome === "skipped").length,
  };

  return NextResponse.json(summary);
}
