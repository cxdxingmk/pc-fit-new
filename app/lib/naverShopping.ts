// 네이버 쇼핑 검색 API 얇은 클라이언트 — /api/admin/update-prices 전용.
// https://developers.naver.com/docs/serviceapi/search/shopping/shopping.md

export interface NaverShoppingItem {
  /** 매칭된 검색어가 <b></b>로 감싸진 원문 HTML — 필터링 전 stripHtmlTags()로 벗겨내야 한다 */
  title: string;
  link: string;
  /** 최저가(원) — 네이버 API가 문자열로 내려준다 */
  lprice: string;
  hprice: string;
  mallName: string;
  productId: string;
  productType: string;
  brand: string;
  maker: string;
  category1: string;
  category2: string;
  category3: string;
  category4: string;
}

interface NaverShoppingResponse {
  total: number;
  items: NaverShoppingItem[];
}

/** NAVER_SHOPPING_CLIENT_ID/SECRET이 비어 있을 때 — 호출부가 "설정 안 됨"과 "API 호출 실패"를 구분할 수 있게 전용 에러로 던진다. */
export class NaverShoppingNotConfiguredError extends Error {
  constructor() {
    super("NAVER_SHOPPING_CLIENT_ID/NAVER_SHOPPING_CLIENT_SECRET이 설정되지 않았습니다.");
    this.name = "NaverShoppingNotConfiguredError";
  }
}

export function isNaverShoppingConfigured(): boolean {
  return Boolean(process.env.NAVER_SHOPPING_CLIENT_ID?.trim() && process.env.NAVER_SHOPPING_CLIENT_SECRET?.trim());
}

const NAVER_SHOPPING_SEARCH_URL = "https://openapi.naver.com/v1/search/shop.json";
const REQUEST_TIMEOUT_MS = 5_000;

// 429(Too Many Requests) 전용 재시도 — 일일 사용량은 여유가 있어도(예: 369/25000) 초당/분당
// 호출 속도 제한에 걸려 429가 나는 경우가 실제로 있었다. 지수 백오프(2배씩, 2초 -> 4초)로
// 최대 2회까지 재시도하고, 그래도 안 되면 호출부(processEntry)가 이 항목만 skipped로
// 집계하고 계속 진행한다. 429가 아닌 다른 오류(네트워크/5xx/타임아웃)는 재시도해도 대부분
// 곧바로 다시 실패할 뿐이라 재시도 대상에서 제외한다.
const RATE_LIMIT_RETRY_DELAYS_MS = [2_000, 4_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** query로 네이버 쇼핑을 검색해 원문 아이템 목록을 반환한다. 관련성 필터링은 partPricing.ts가 담당한다. */
export async function searchNaverShopping(query: string, display = 20): Promise<NaverShoppingItem[]> {
  const clientId = process.env.NAVER_SHOPPING_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_SHOPPING_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new NaverShoppingNotConfiguredError();
  }

  const url = new URL(NAVER_SHOPPING_SEARCH_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("sort", "sim");

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      const data = (await response.json()) as NaverShoppingResponse;
      return data.items ?? [];
    }

    if (response.status === 429 && attempt < RATE_LIMIT_RETRY_DELAYS_MS.length) {
      await sleep(RATE_LIMIT_RETRY_DELAYS_MS[attempt]);
      continue;
    }

    throw new Error(`네이버 쇼핑 API 오류: ${response.status} ${response.statusText}`);
  }
}
