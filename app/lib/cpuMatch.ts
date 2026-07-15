/**
 * cpuMatch.ts — 정규화된 CPU 문자열을 부품 DB(app/database/cpu.ts)와 매칭.
 * gpuMatch.ts와 동일한 2단계 전략(큐레이션 키워드 → 토큰 유사도)을 CPU에 그대로 적용한다.
 *
 * 1) 큐레이션된 HARDWARE_MASTER 키워드 매칭을 먼저 시도한다(오탐이 적은 확정 매칭).
 * 2) 실패하면 토큰 유사도로 전체 cpus 카탈로그를 스코어링해, 확신도가 높으면
 *    바로 확정하고 그렇지 않으면 상위 3개를 후보로 반환해 사람이 고르게 한다.
 */
import { cpus, type CPU } from "../database/cpu";
import { HARDWARE_MASTER, findMasterMatch } from "../data/hardwareMaster";

export interface CpuMatchResult {
  matched: CPU | null;
  candidates: CPU[];
}

/** 토큰 유사도만으로 자동 확정해도 안전하다고 볼 수 있는 최소 점수 — gpuMatch.ts와 동일 기준 */
const AUTO_CONFIRM_SIMILARITY = 0.6;
const MAX_CANDIDATES = 3;

/**
 * Win32_Processor.Name 원문엔 "(R)"/"(TM)"/"CPU @ x.xxGHz"/"12th Gen" 같은 브랜드 상표·클럭
 * 보일러플레이트가 붙지만, 카탈로그 name(예: "Core i9-14900K")엔 이게 전혀 없다. 이 노이즈
 * 토큰들이 Jaccard 분모(합집합)만 부풀려 실제로는 같은 CPU인데도 유사도가 임계값 밑으로
 * 떨어지는 문제가 있어("Intel(R) Core(TM) i9-14900K" vs "Core i9-14900K" ≈ 0.5) 매칭 전에 벗겨낸다.
 */
function stripCpuBoilerplate(text: string): string {
  return text
    .replace(/\(R\)|\(TM\)/gi, " ")
    .replace(/\bCPU\b/gi, " ")
    .replace(/@\s*[\d.]+\s*GHz/gi, " ")
    .replace(/\b\d+(st|nd|rd|th)\s*Gen\b/gi, " ")
    .replace(/\b(Intel|AMD)\b/gi, " ");
}

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

export function matchCpuToDb(normalizedName: string): CpuMatchResult {
  const trimmed = normalizedName.trim();
  if (!trimmed) return { matched: null, candidates: [] };

  const masterHit = findMasterMatch(HARDWARE_MASTER.CPU, trimmed);
  if (masterHit?.mappedId) {
    const matched = cpus.find((c) => c.id === masterHit.mappedId) ?? null;
    if (matched) return { matched, candidates: [] };
  }

  const targetTokens = tokenize(stripCpuBoilerplate(trimmed));
  const scored = cpus
    .map((cpu) => ({ cpu, score: similarity(targetTokens, tokenize(cpu.name)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score >= AUTO_CONFIRM_SIMILARITY) {
    return { matched: scored[0].cpu, candidates: [] };
  }

  return { matched: null, candidates: scored.slice(0, MAX_CANDIDATES).map((entry) => entry.cpu) };
}
