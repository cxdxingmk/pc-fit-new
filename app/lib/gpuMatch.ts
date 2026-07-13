/**
 * gpuMatch.ts — 정규화된 GPU 문자열을 부품 DB(app/database/gpu.ts)와 매칭.
 *
 * 1) 큐레이션된 HARDWARE_MASTER 키워드 매칭을 먼저 시도한다(오탐이 적은 확정 매칭).
 * 2) 실패하면 토큰 유사도로 전체 gpus 카탈로그를 스코어링해, 확신도가 높으면
 *    바로 확정하고 그렇지 않으면 상위 3개를 후보로 반환해 사람이 고르게 한다.
 */
import { gpus, type GPU } from "../database/gpu";
import { HARDWARE_MASTER, findMasterMatch } from "../data/hardwareMaster";

export interface GpuMatchResult {
  matched: GPU | null;
  candidates: GPU[];
}

/** 토큰 유사도만으로 자동 확정해도 안전하다고 볼 수 있는 최소 점수 */
const AUTO_CONFIRM_SIMILARITY = 0.6;
const MAX_CANDIDATES = 3;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, " ")
      .split(" ")
      .filter(Boolean)
  );
}

/** Jaccard 유사도(교집합/합집합) — 0~1 */
function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap++;
  }
  const unionSize = a.size + b.size - overlap;
  return unionSize === 0 ? 0 : overlap / unionSize;
}

export function matchGpuToDb(normalizedName: string): GpuMatchResult {
  const trimmed = normalizedName.trim();
  if (!trimmed) return { matched: null, candidates: [] };

  const masterHit = findMasterMatch(HARDWARE_MASTER.GPU, trimmed);
  if (masterHit?.mappedId) {
    const matched = gpus.find((g) => g.id === masterHit.mappedId) ?? null;
    if (matched) return { matched, candidates: [] };
  }

  const targetTokens = tokenize(trimmed);
  const scored = gpus
    .map((gpu) => ({ gpu, score: similarity(targetTokens, tokenize(gpu.name)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score >= AUTO_CONFIRM_SIMILARITY) {
    return { matched: scored[0].gpu, candidates: [] };
  }

  return { matched: null, candidates: scored.slice(0, MAX_CANDIDATES).map((entry) => entry.gpu) };
}
