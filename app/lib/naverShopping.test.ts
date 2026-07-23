import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchNaverShopping, isNaverShoppingConfigured, NaverShoppingNotConfiguredError } from "./naverShopping";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? "Too Many Requests" : "OK",
    json: async () => body,
  } as Response;
}

describe("searchNaverShopping", () => {
  beforeEach(() => {
    vi.stubEnv("NAVER_SHOPPING_CLIENT_ID", "test-id");
    vi.stubEnv("NAVER_SHOPPING_CLIENT_SECRET", "test-secret");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("클라이언트 ID/SECRET이 없으면 NaverShoppingNotConfiguredError를 던진다", async () => {
    vi.stubEnv("NAVER_SHOPPING_CLIENT_ID", "");
    await expect(searchNaverShopping("GeForce RTX 5070")).rejects.toThrow(NaverShoppingNotConfiguredError);
    expect(isNaverShoppingConfigured()).toBe(false);
  });

  it("정상 응답이면 items를 그대로 반환한다", async () => {
    const items = [{ title: "GeForce RTX 5070", lprice: "1000000" }];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { total: 1, items })));

    const result = await searchNaverShopping("GeForce RTX 5070");
    expect(result).toEqual(items);
  });

  it("429가 나면 지수 백오프(2초, 4초)로 재시도하고, 재시도 중 성공하면 그 결과를 반환한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, {}))
      .mockResolvedValueOnce(jsonResponse(200, { total: 1, items: [{ title: "ok", lprice: "1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = searchNaverShopping("GeForce RTX 5070");
    await vi.advanceTimersByTimeAsync(2_000); // 첫 재시도 대기(2초)까지만 진행
    const result = await promise;

    expect(result).toEqual([{ title: "ok", lprice: "1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("429가 재시도 횟수(2회)를 넘겨도 계속되면 결국 에러를 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, {})));

    const promise = searchNaverShopping("GeForce RTX 5070");
    const assertion = expect(promise).rejects.toThrow(/네이버 쇼핑 API 오류: 429/);
    await vi.advanceTimersByTimeAsync(2_000 + 4_000); // 두 번의 재시도 대기를 모두 소진
    await assertion;
  });

  it("429가 아닌 오류(예: 500)는 재시도 없이 곧바로 에러를 던진다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(500, {}));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchNaverShopping("GeForce RTX 5070")).rejects.toThrow(/네이버 쇼핑 API 오류: 500/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
