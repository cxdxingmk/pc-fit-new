// /가격갱신 파이프라인이 채운 part_prices 테이블을 읽어 recommender.ts에 실거래가를 공급한다.
// 이 모듈이 실패하는 모든 경로(네트워크 오류, RLS 미설정, 마이그레이션 미실행 등)는 절대 throw하지
// 않고 빈 Map(또는 마지막으로 성공한 캐시)을 반환한다 — 이 값이 없어도 recommender.ts는 기존
// 정적 가격(priceTier 등)으로 그대로 동작해야 하기 때문이다.
import { createClient } from "./supabase/client";
import type { PartType } from "./partPricing";

export interface PartPriceOverrideEntry {
  priceKrw: number;
  sampleCount: number;
  updatedAt: string; // ISO 문자열(Supabase timestamptz)
}

export type PartPriceOverrides = Map<string, PartPriceOverrideEntry>;

// 유효 표본 3개 미만인 행은 /가격갱신 쪽(partPricing.ts의 computeFinalPrice)이 애초에 저장하지
// 않으므로 실제로는 항상 통과하지만, DB를 직접 수정하는 경우 등을 대비한 방어선으로 그대로 둔다.
const MIN_SAMPLE_COUNT = 3;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7일 — /가격갱신은 자동 스케줄 없이 수동 트리거뿐이라 중요한 안전장치
const CACHE_TTL_MS = 5 * 60 * 1000;

function overrideKey(partType: PartType, catalogId: string): string {
  return `${partType}:${catalogId}`;
}

let cache: { overrides: PartPriceOverrides; fetchedAt: number } | null = null;

/** 테스트 전용 — 모듈 레벨 캐시를 초기화한다. */
export function __resetPartPriceOverridesCacheForTest(): void {
  cache = null;
}

/** part_prices 전체를 가져와 캐싱한다(TTL 5분) — 약 150행 규모라 매번 전체를 읽어도 부담이 없다. */
export async function fetchPartPriceOverrides(): Promise<PartPriceOverrides> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.overrides;
  }

  try {
    const supabase = createClient();
    const { data, error } = await supabase.from("part_prices").select("part_type, catalog_id, price_krw, sample_count, updated_at");
    if (error || !data) {
      return cache?.overrides ?? new Map();
    }

    const overrides: PartPriceOverrides = new Map();
    for (const row of data as Array<{ part_type: string; catalog_id: string; price_krw: number; sample_count: number; updated_at: string }>) {
      overrides.set(overrideKey(row.part_type as PartType, row.catalog_id), {
        priceKrw: row.price_krw,
        sampleCount: row.sample_count,
        updatedAt: row.updated_at,
      });
    }

    cache = { overrides, fetchedAt: now };
    return overrides;
  } catch (err) {
    console.error("[partPriceOverrides] 실거래가 조회 실패 — 정적 가격으로 폴백합니다:", err);
    return cache?.overrides ?? new Map();
  }
}

/**
 * 신뢰도(표본 3개 이상)와 최신성(7일 이내)을 모두 만족할 때만 실거래가를 반환한다.
 * 조건을 만족하지 않으면 null — 호출부(recommender.ts)가 기존 정적 가격으로 폴백한다.
 */
export function resolveLivePrice(overrides: PartPriceOverrides, partType: PartType, catalogId: string, now: number = Date.now()): number | null {
  const entry = overrides.get(overrideKey(partType, catalogId));
  if (!entry) return null;
  if (entry.sampleCount < MIN_SAMPLE_COUNT) return null;

  const updatedAtMs = new Date(entry.updatedAt).getTime();
  if (!Number.isFinite(updatedAtMs)) return null;
  if (now - updatedAtMs > STALE_AFTER_MS) return null;

  return entry.priceKrw;
}
