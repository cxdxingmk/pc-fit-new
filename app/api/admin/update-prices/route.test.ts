import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * 네이버 쇼핑 호출과 Supabase 쓰기를 전부 모킹하고 POST()만 직접 호출해 검증한다
 * (app/api/og/route.test.tsx와 같은 방식 — 외부 의존성만 모킹, 실제 라우트 로직은 그대로 실행).
 */

const searchNaverShoppingMock = vi.fn();
const isNaverShoppingConfiguredMock = vi.fn(() => true);

vi.mock("@/app/lib/naverShopping", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/naverShopping")>("@/app/lib/naverShopping");
  return {
    ...actual,
    searchNaverShopping: (query: string) => searchNaverShoppingMock(query),
    isNaverShoppingConfigured: () => isNaverShoppingConfiguredMock(),
  };
});

const upsertMock = vi.fn(async () => ({ error: null as { message: string } | null }));
const fromMock = vi.fn(() => ({ upsert: upsertMock }));

vi.mock("@/app/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

import { POST } from "./route";
import { buildPriceableCatalogEntries } from "@/app/lib/partPricing";

// 실제 라우트가 각 항목의 staticAnchorPriceKrw(정적 카탈로그 가격)로 이상값을 걸러내므로
// (computeFinalPrice의 앵커 안전장치), 목데이터도 항목마다 그 앵커 근처 가격을 내려줘야 "정상
// 케이스"가 실제로 전부 update로 집계된다 — 모든 쿼리에 같은 고정가(예: 10~12만원)를 주면 GPU
// 같은 고가 부품군은 앵커 대비 너무 낮아 오히려 스킵되어(의도된 안전장치 동작) 이 목데이터
// 자체가 비현실적이었던 셈이다.
// 라우트는 searchNaverShopping(entry.searchQuery)로 호출하므로(entry.name이 아님 — RAM은 둘이
// 다르다), 목 조회 키도 searchQuery로 맞춘다.
const anchorByName = new Map(buildPriceableCatalogEntries().map((entry) => [entry.searchQuery, entry.staticAnchorPriceKrw]));
function pricesNearAnchor(query: string): number[] {
  const anchor = anchorByName.get(query) ?? 100_000;
  return [Math.round(anchor * 0.9), anchor, Math.round(anchor * 1.1)];
}

function postRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/admin/update-prices", { method: "POST", headers });
}

describe("POST /api/admin/update-prices", () => {
  beforeEach(() => {
    vi.stubEnv("PRICE_UPDATE_API_SECRET", "test-secret");
    isNaverShoppingConfiguredMock.mockReturnValue(true);
    searchNaverShoppingMock.mockReset();
    upsertMock.mockClear();
    fromMock.mockClear();
    // mapWithConcurrency의 REQUEST_STAGGER_MS(429 예방용 실제 지연)가 카탈로그 111개 전체를
    // 도는 테스트에서 그대로 실행되면 5초 기본 타임아웃을 넘긴다 — 가짜 타이머로 즉시 진행시킨다.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  /** POST()를 실행하면서 mapWithConcurrency의 스태거 지연(setTimeout)을 즉시 진행시킨다. */
  async function postAndFlushTimers(headers: Record<string, string>): Promise<Response> {
    const responsePromise = POST(postRequest(headers));
    await vi.runAllTimersAsync();
    return responsePromise;
  }

  it("시크릿 헤더가 없으면 401을 반환하고 아무 것도 처리하지 않는다", async () => {
    const response = await POST(postRequest());
    expect(response.status).toBe(401);
    expect(searchNaverShoppingMock).not.toHaveBeenCalled();
  });

  it("시크릿 헤더가 틀리면 401을 반환한다", async () => {
    const response = await POST(postRequest({ "x-price-update-secret": "wrong" }));
    expect(response.status).toBe(401);
  });

  it("서버 쪽 PRICE_UPDATE_API_SECRET 자체가 비어 있으면 헤더 값과 무관하게 401(fail-closed)", async () => {
    vi.stubEnv("PRICE_UPDATE_API_SECRET", "");
    const response = await POST(postRequest({ "x-price-update-secret": "" }));
    expect(response.status).toBe(401);
  });

  it("네이버 API 키가 설정되지 않았으면 503으로 명확히 실패하고, 사이트의 나머지 기능엔 영향이 없다(이 라우트만 격리되어 실패)", async () => {
    isNaverShoppingConfiguredMock.mockReturnValue(false);
    const response = await POST(postRequest({ "x-price-update-secret": "test-secret" }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("네이버");
    expect(searchNaverShoppingMock).not.toHaveBeenCalled();
  });

  it("정상 케이스 — 관련 있는 결과가 충분한 항목은 전부 update로 집계된다", async () => {
    searchNaverShoppingMock.mockImplementation(async (query: string) =>
      pricesNearAnchor(query).map((lprice) => ({ title: query, lprice: String(lprice) }))
    );

    const response = await postAndFlushTimers({ "x-price-update-secret": "test-secret" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.updated).toBeGreaterThan(0);
    expect(body.skipped).toBe(0);
    expect(body.updated + body.skipped).toBe(searchNaverShoppingMock.mock.calls.length);
    expect(upsertMock).toHaveBeenCalledTimes(body.updated);
  });

  it("개별 항목에서 네이버 호출이 실패해도 전체 작업은 중단되지 않고, 실패한 항목만 skipped로 집계된다", async () => {
    let callCount = 0;
    searchNaverShoppingMock.mockImplementation(async (query: string) => {
      callCount += 1;
      if (callCount % 3 === 0) throw new Error("네이버 API 일시 오류");
      return [
        { title: query, lprice: "100000" },
        { title: query, lprice: "110000" },
        { title: query, lprice: "120000" },
      ];
    });

    const response = await postAndFlushTimers({ "x-price-update-secret": "test-secret" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.skipped).toBeGreaterThan(0);
    expect(body.updated).toBeGreaterThan(0);
    expect(body.updated + body.skipped).toBe(callCount);
  });

  it("유효 결과가 3개 미만인 항목은 skipped로 집계되고 upsert가 호출되지 않는다", async () => {
    searchNaverShoppingMock.mockImplementation(async (query: string) => [{ title: query, lprice: "100000" }]);

    const response = await postAndFlushTimers({ "x-price-update-secret": "test-secret" });
    const body = await response.json();
    expect(body.updated).toBe(0);
    expect(body.skipped).toBeGreaterThan(0);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
