import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resolveLivePrice, type PartPriceOverrideEntry, type PartPriceOverrides } from "./partPriceOverrides";

// vi.mock 팩토리는 파일 최상단으로 물리적으로 호이스팅되므로, 그 안에서 참조하는 mock 변수는
// vi.hoisted()로 함께 끌어올려야 한다(그냥 const로 선언하면 "not defined" 참조 오류가 난다).
const { selectMock, fromMock, createClientMock } = vi.hoisted(() => {
  const selectMock = vi.fn();
  const fromMock = vi.fn(() => ({ select: selectMock }));
  const createClientMock = vi.fn(() => ({ from: fromMock }));
  return { selectMock, fromMock, createClientMock };
});

vi.mock("./supabase/client", () => ({
  createClient: () => createClientMock(),
}));

function overridesOf(entries: Record<string, PartPriceOverrideEntry>): PartPriceOverrides {
  return new Map(Object.entries(entries));
}

const NOW = new Date("2026-07-23T00:00:00.000Z").getTime();

describe("resolveLivePrice", () => {
  it("표본 3개 이상 + 7일 이내면 실거래가를 반환한다", () => {
    const overrides = overridesOf({
      "cpu:r5-5600": { priceKrw: 150000, sampleCount: 5, updatedAt: new Date(NOW - 1 * 24 * 60 * 60 * 1000).toISOString() },
    });
    expect(resolveLivePrice(overrides, "cpu", "r5-5600", NOW)).toBe(150000);
  });

  it("해당 catalogId의 행이 없으면 null(호출부가 정적 가격으로 폴백)", () => {
    const overrides = overridesOf({});
    expect(resolveLivePrice(overrides, "cpu", "r5-5600", NOW)).toBeNull();
  });

  it("표본이 3개 미만이면 null(방어선 — 실제로는 쓰기 쪽이 이미 걸러내지만 DB를 직접 수정한 경우 등을 대비)", () => {
    const overrides = overridesOf({
      "cpu:r5-5600": { priceKrw: 150000, sampleCount: 2, updatedAt: new Date(NOW).toISOString() },
    });
    expect(resolveLivePrice(overrides, "cpu", "r5-5600", NOW)).toBeNull();
  });

  it("정확히 7일 이내는 유효하다(경계값 포함)", () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const overrides = overridesOf({
      "gpu:rtx4070-super": { priceKrw: 700000, sampleCount: 4, updatedAt: new Date(NOW - sevenDaysMs).toISOString() },
    });
    expect(resolveLivePrice(overrides, "gpu", "rtx4070-super", NOW)).toBe(700000);
  });

  it("7일을 1ms라도 초과하면 null(정적 가격으로 폴백)", () => {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const overrides = overridesOf({
      "gpu:rtx4070-super": { priceKrw: 700000, sampleCount: 4, updatedAt: new Date(NOW - sevenDaysMs - 1).toISOString() },
    });
    expect(resolveLivePrice(overrides, "gpu", "rtx4070-super", NOW)).toBeNull();
  });

  it("updatedAt이 파싱 불가능한 값이면 null(방어적으로 정적 가격 유지)", () => {
    const overrides = overridesOf({
      "cpu:r5-5600": { priceKrw: 150000, sampleCount: 5, updatedAt: "not-a-date" },
    });
    expect(resolveLivePrice(overrides, "cpu", "r5-5600", NOW)).toBeNull();
  });

  it("part_type이 다르면 같은 catalogId라도 별개 항목으로 취급한다(키가 partType:catalogId)", () => {
    const overrides = overridesOf({
      "cpu:shared-id": { priceKrw: 100000, sampleCount: 5, updatedAt: new Date(NOW).toISOString() },
    });
    expect(resolveLivePrice(overrides, "gpu", "shared-id", NOW)).toBeNull();
  });
});

describe("fetchPartPriceOverrides", () => {
  beforeEach(async () => {
    const { __resetPartPriceOverridesCacheForTest } = await import("./partPriceOverrides");
    __resetPartPriceOverridesCacheForTest();
    fromMock.mockClear();
    selectMock.mockReset();
    createClientMock.mockClear();
    createClientMock.mockImplementation(() => ({ from: fromMock }));
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("part_prices를 조회해 partType:catalogId를 키로 하는 Map을 만든다", async () => {
    selectMock.mockResolvedValue({
      data: [{ part_type: "cpu", catalog_id: "r5-5600", price_krw: 150000, sample_count: 5, updated_at: new Date(NOW).toISOString() }],
      error: null,
    });

    const { fetchPartPriceOverrides } = await import("./partPriceOverrides");
    const overrides = await fetchPartPriceOverrides();

    expect(overrides.get("cpu:r5-5600")?.priceKrw).toBe(150000);
    expect(fromMock).toHaveBeenCalledWith("part_prices");
  });

  it("5분 이내 재호출은 캐시를 쓰고 다시 조회하지 않는다", async () => {
    selectMock.mockResolvedValue({
      data: [{ part_type: "cpu", catalog_id: "r5-5600", price_krw: 150000, sample_count: 5, updated_at: new Date(NOW).toISOString() }],
      error: null,
    });

    const { fetchPartPriceOverrides } = await import("./partPriceOverrides");
    await fetchPartPriceOverrides();
    vi.setSystemTime(NOW + 4 * 60 * 1000); // 4분 후
    await fetchPartPriceOverrides();

    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("TTL(5분)이 지나면 다시 조회한다", async () => {
    selectMock.mockResolvedValue({
      data: [{ part_type: "cpu", catalog_id: "r5-5600", price_krw: 150000, sample_count: 5, updated_at: new Date(NOW).toISOString() }],
      error: null,
    });

    const { fetchPartPriceOverrides } = await import("./partPriceOverrides");
    await fetchPartPriceOverrides();
    vi.setSystemTime(NOW + 6 * 60 * 1000); // 6분 후
    await fetchPartPriceOverrides();

    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it("조회 실패(error) 시 throw하지 않고 빈 Map을 반환한다(사이트는 정적 가격으로 정상 작동해야 함)", async () => {
    selectMock.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });

    const { fetchPartPriceOverrides } = await import("./partPriceOverrides");
    await expect(fetchPartPriceOverrides()).resolves.toBeInstanceOf(Map);
    const overrides = await fetchPartPriceOverrides();
    expect(overrides.size).toBe(0);
  });

  it("클라이언트 생성 자체가 throw해도(예: 환경변수 누락) 빈 Map으로 안전하게 폴백한다", async () => {
    createClientMock.mockImplementationOnce(() => {
      throw new Error("환경변수 없음");
    });

    const { fetchPartPriceOverrides } = await import("./partPriceOverrides");
    const overrides = await fetchPartPriceOverrides();
    expect(overrides.size).toBe(0);
  });
});
