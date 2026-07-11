import type { CatalogEntry } from "./catalogReader.ts";

export interface MatchCandidate {
  catalogId: string;
  catalogName: string;
  /** 0~1. 1이면 정규화 후 완전 일치. */
  similarity: number;
}

export type MatchStatus = "exact" | "ambiguous" | "no_match";

export interface MatchResult {
  status: MatchStatus;
  /** exact: 정확히 1개, ambiguous: 유사도 내림차순 상위 최대 MAX_CANDIDATES개, no_match: 0개. */
  candidates: MatchCandidate[];
}

/** 뉴스 기사 표기(예: "RTX 4070 Ti")에는 보통 안 붙지만 카탈로그 name에는 붙는 브랜드 접두어.
 *  비교 전에만 제거한다 — 실제 저장값(detected_name/catalog name)은 그대로 둔다. */
const BRAND_NOISE_WORDS = ["GEFORCE", "NVIDIA", "RADEON", "AMD", "INTEL"];

/** 이 미만 유사도는 후보로 보여줄 가치가 없다고 보고 no_match(완전 신규 후보)로 취급한다. */
const AMBIGUOUS_THRESHOLD = 0.5;
const MAX_CANDIDATES = 3;

export function normalizePartName(raw: string): string {
  let normalized = raw.toUpperCase().replace(/[\s\-_]/g, "");
  for (const noise of BRAND_NOISE_WORDS) {
    normalized = normalized.split(noise).join("");
  }
  return normalized;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prevDiagonal = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prevDiagonal : 1 + Math.min(prevDiagonal, dp[j], dp[j - 1]);
      prevDiagonal = temp;
    }
  }
  return dp[n];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * 부품명 문자열 → 카탈로그 id 매칭. 3단계 판정:
 * - exact: 정규화 후 완전 일치하는 카탈로그 항목이 정확히 있음 → 자동 신뢰(SPEC_UPDATE/STATUS_CHANGE 후보).
 * - ambiguous: 완전 일치는 없지만 threshold 이상 유사한 후보가 있음 → 사람이 상위 후보 중 고르거나
 *   "이건 신규다"를 선택해야 함(강제로 하나를 확정하지 않음).
 * - no_match: threshold 이상 후보가 전혀 없음 → 완전 신규 부품 후보(NEW_PART).
 *
 * 오검출 방지를 위해 fuzzy 유사도가 아무리 높아도 "exact"로는 승격시키지 않는다 — 예를 들어
 * "RTX 4070"과 "RTX 4070 Ti"는 유사도가 매우 높지만 실제로는 다른 제품이므로, 정확 일치가
 * 아닌 이상 전부 사람 확인 대상으로 남긴다.
 */
export function matchPartName(detectedName: string, catalog: CatalogEntry[]): MatchResult {
  const normalizedDetected = normalizePartName(detectedName);
  if (!normalizedDetected) {
    return { status: "no_match", candidates: [] };
  }

  const exact = catalog.find((entry) => normalizePartName(entry.name) === normalizedDetected);
  if (exact) {
    return {
      status: "exact",
      candidates: [{ catalogId: exact.id, catalogName: exact.name, similarity: 1 }],
    };
  }

  const scored = catalog
    .map((entry): MatchCandidate => ({
      catalogId: entry.id,
      catalogName: entry.name,
      similarity: similarity(normalizedDetected, normalizePartName(entry.name)),
    }))
    .filter((candidate) => candidate.similarity >= AMBIGUOUS_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CANDIDATES);

  if (scored.length === 0) {
    return { status: "no_match", candidates: [] };
  }
  return { status: "ambiguous", candidates: scored };
}
