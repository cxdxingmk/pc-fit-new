import { compatibilityScore, recencyBoost } from "./compatibility";
import { getCpuBenchmark } from "../../database/mapping/cpuMap";
import { getGpuBenchmark } from "../../database/mapping/gpuMap";

// synchronous local DB imports for backward-compatible recommend()
import { cpus as _cpus } from "../database/cpu";
import { gpus as _gpus } from "../database/gpu";
import { rams as _rams } from "../database/ram";
import { ssds as _ssds } from "../database/ssd";
import { motherboards as _motherboards } from "../database/motherboard";
import { psus as _psus } from "../database/psu";

import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";
import type { ExistingPartsState, CaseOwnershipOption, PurposeType, BudgetRange } from "../types/build";
import type { RecommendationResult } from "../types/recommend";

type Answers = Record<number, string[]>;

// BuildContext가 관리하는 타입 있는 목적(PurposeType)과 동일한 값 집합이다.
// answers[1]의 한글 라벨 문자열로 왕복하지 않고 이 타입을 그대로 쓰기 위해 별칭만 둔다.
type Purpose = PurposeType;

const priceTierToPrice: Record<"budget" | "mid" | "high" | "enthusiast", number> = {
  budget: 250000,
  mid: 500000,
  high: 850000,
  enthusiast: 1200000,
};

const BUDGET_TARGETS: Record<string, number> = {
  "100만원 이하": 1000000,
  "100~150만원": 1250000,
  "150~200만원": 1750000,
  "200~300만원": 2500000,
  "300만원 이상": 3500000,
};

const WEIGHTS: Record<Purpose, { cpu: number; gpu: number; ram: number; ssd: number; motherboard: number; psu: number }> = {
  gaming: { cpu: 0.27, gpu: 0.4, ram: 0.17, ssd: 0.1, motherboard: 0.05, psu: 0.01 },
  work: { cpu: 0.36, gpu: 0.17, ram: 0.24, ssd: 0.17, motherboard: 0.05, psu: 0.01 },
  video: { cpu: 0.32, gpu: 0.22, ram: 0.24, ssd: 0.16, motherboard: 0.05, psu: 0.01 },
  stream: { cpu: 0.3, gpu: 0.33, ram: 0.22, ssd: 0.14, motherboard: 0.01, psu: 0.0 },
  ai: { cpu: 0.2, gpu: 0.5, ram: 0.2, ssd: 0.08, motherboard: 0.02, psu: 0.0 },
  dev: { cpu: 0.37, gpu: 0.12, ram: 0.22, ssd: 0.17, motherboard: 0.05, psu: 0.01 },
  cad: { cpu: 0.25, gpu: 0.4, ram: 0.22, ssd: 0.1, motherboard: 0.02, psu: 0.01 },
  etc: { cpu: 0.27, gpu: 0.27, ram: 0.22, ssd: 0.16, motherboard: 0.05, psu: 0.01 },
};

const CASE_PRICE = 120000;

// 우선순위: 여러 목적이 동시에 선택됐을 때 어떤 목적의 가중치(WEIGHTS)를 대표로 쓸지 정한다.
// 기존 문자열 매칭 pickPurpose()의 if-분기 순서(ai > stream > video > cad > dev > gaming > work > etc)와
// 동일한 우선순위를 유지해 동작 변화가 없도록 했다.
const PURPOSE_PRIORITY: Purpose[] = ["ai", "stream", "video", "cad", "dev", "gaming", "work", "etc"];

// 문자열 매칭 폴백: BuildContext가 answers[1]에 한글 라벨로 직렬화하기 전 시점의 호출 등
// 타입 있는 purposes 배열을 못 받는 경우에만 쓰인다.
function pickPurposeFromAnswers(answers: Answers): Purpose {
  const p = answers[1] ?? [];
  const keys = p.flatMap((s) => s.toLowerCase().split(/\s+|[:]/));

  if (keys.some((k) => k.includes("ai"))) return "ai";
  if (keys.some((k) => k.includes("방송") || k.includes("stream"))) return "stream";
  if (keys.some((k) => k.includes("영상") || k.includes("video"))) return "video";
  if (keys.some((k) => k.includes("cad") || k.includes("3d") || k.includes("건축") || k.includes("blender") || k.includes("maya") || k.includes("autocad"))) return "cad";
  if (keys.some((k) => k.includes("개발") || k.includes("dev"))) return "dev";
  if (keys.some((k) => k.includes("게임") || k.includes("game"))) return "gaming";
  if (keys.some((k) => k.includes("사무") || k.includes("office") || k.includes("work"))) return "work";
  if (keys.some((k) => k.includes("기타"))) return "etc";

  return "work";
}

// purposes(BuildContext의 타입 있는 PurposeType[])가 있으면 문자열 파싱 없이 바로 쓰고,
// 없을 때만 answers[1] 문자열 매칭으로 폴백한다.
export function pickPurpose(answers: Answers, purposes?: PurposeType[]): Purpose {
  if (purposes && purposes.length > 0) {
    const match = PURPOSE_PRIORITY.find((purpose) => purposes.includes(purpose));
    if (match) return match;
  }
  return pickPurposeFromAnswers(answers);
}

function pickBudgetTarget(answers: Answers): number | null {
  const budget = answers[3]?.[0];
  if (!budget) return null;
  if (BUDGET_TARGETS[budget]) return BUDGET_TARGETS[budget];
  const numeric = Number(budget.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseWattage(value: string) {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

// placeholder(0/음수/비정상) 가격 여부 — 동점자 비교에서 변별력을 잃지 않도록 판정한다.
const isPlaceholderPrice = (p: number): boolean => !Number.isFinite(p) || p <= 0;

// 예산 이내에서는 성능이 랭킹을 주도하되, 예산을 넘어서는 순간 급격히 깎이도록 만드는 배율.
// 절대 원화 차액(diff/30000)이 아니라 "예산 대비 초과 비율"로 계산해야 예산 규모와 무관하게
// 일관된 패널티가 걸린다(예: 30만원 초과가 100만원 예산에서는 치명적이지만 350만원 예산에서는 오차 수준).
// 지수감쇠(exp)를 쓰는 이유: 선형 패널티로 0에 floor를 걸면, 다수 조합이 동시에 0으로 뭉개져서
// "그나마 덜 초과한" 조합을 구분해 정렬할 수 없게 된다. exp는 0에 무한히 가까워지되 절대 0이
// 되지 않아, 극단적으로 예산을 초과한 조합들 사이에서도 상대적 우열이 항상 보존된다.
export function computeBudgetFactor(totalPrice: number, budgetTarget: number | null): number {
  if (!budgetTarget || budgetTarget <= 0) return 1;

  if (totalPrice <= budgetTarget) {
    const utilization = totalPrice / budgetTarget;
    return 0.9 + utilization * 0.1; // 예산 내에서는 0.9~1.0 사이, 성능 랭킹을 크게 방해하지 않음
  }

  const overageRatio = (totalPrice - budgetTarget) / budgetTarget;
  return Math.exp(-3 * overageRatio); // 10% 초과 -> 약 0.74배, 50% 초과 -> 약 0.22배, 100% 초과 -> 약 0.05배
}

// 예산과 극단적으로 동떨어진(대략 100%+ 초과, 즉 목표가의 2배 이상) 조합은 점수를 깎는 정도가
// 아니라 아예 결과에서 제외한다. 하한(budgetMin)은 이미 "이 아래는 안 보여준다"는 하드 컷인데
// 상한 쪽은 소프트 페널티뿐이라, 목표가가 아주 낮을 때(예: 정확한 금액 55만원 -> ±10% 49.5만~
// 60.5만) 카탈로그의 가장 싼 조합조차 하한은 가볍게 통과해버려 "174만원짜리를 0.3점으로" 보여주는
// 비일관성이 생겼다. 목표가가 아주 높아 하한 컷으로 이미 결과가 텅 비는 경우와 대칭이 되도록,
// 상한 쪽도 "터무니없이 안 맞음"은 하드 컷으로 통일한다.
const MIN_REASONABLE_BUDGET_FACTOR = 0.05;

function rateRam(ram: RAM, purpose: Purpose) {
  if (purpose === "gaming") return ram.gameScore;
  if (purpose === "ai") return ram.aiScore;
  return ram.workScore;
}

function rateSsd(ssd: SSD, purpose: Purpose) {
  if (purpose === "gaming") return ssd.gameScore;
  if (purpose === "ai") return ssd.aiScore;
  return ssd.workScore;
}

// qualityScore(실측 안정성 등급)가 있는 부품은 벤치마크 점수와 반반 블렌드해 우선순위에 반영한다.
// 레거시 카탈로그 항목(qualityScore 없음)은 기존과 동일하게 동작한다.
function rateMotherboard(mb: MotherBoard) {
  const perf = (mb.gameScore + mb.workScore + mb.aiScore) / 3;
  return typeof mb.qualityScore === "number" ? perf * 0.5 + mb.qualityScore * 0.5 : perf;
}

function ratePsu(psu: PSU, cpu: CPU, gpu: GPU) {
  const required = cpu.tdp + gpu.tgp + 150;
  const base = psu.wattage >= required ? 80 : 55;
  const efficiencyBonus = psu.efficiency === "80 PLUS Platinum" ? 10 : psu.efficiency === "80 PLUS Titanium" ? 12 : 8;
  const baseline = Math.min(100, base + efficiencyBonus);
  return typeof psu.qualityScore === "number" ? baseline * 0.5 + psu.qualityScore * 0.5 : baseline;
}

function createReason(score: number, compatibility: number, caseOwnership: CaseOwnershipOption) {
  const messages: string[] = [];
  if (score > 90) messages.push("최신 세대 아키텍처와 안정성을 동시에 만족하는 세트입니다.");
  else if (score > 80) messages.push("전반적으로 매우 균형 잡힌 완성형 세트입니다.");
  else if (score > 70) messages.push("예산 대비 만족도가 높은 추천 조합입니다.");
  else messages.push("성능과 예산을 다시 조정해보면 더 좋은 결과가 나올 수 있습니다.");

  if (compatibility >= 90) messages.push("소켓·전력·메모리 규격까지 정교하게 맞춘 안정형 조합입니다.");
  if (caseOwnership === "owned") messages.push("케이스를 보유 중이라 케이스 비용을 제외한 견적으로 계산했습니다.");
  return messages;
}

function candidateId(cpu: CPU, gpu: GPU, ram: RAM, ssd: SSD, mb: MotherBoard, psu: PSU) {
  return [cpu.id, gpu.id, ram.id, ssd.id, mb.id, psu.id].join("-");
}

// CPU/GPU 카탈로그가 커질수록(현재 200여 개) 6중 for문을 그대로 돌리면 조합 수가 폭발한다.
// 소켓/DDR이 안 맞는 조합은 애초에 순회 대상에서 빼고(인덱싱), CPU/GPU는 이번 목적(purpose)
// 기준 점수 상위 N개만 후보 풀로 남겨 나머지 세 축(RAM/SSD/PSU)과 조합한다.
const CPU_POOL_PER_TIER = 4;
const GPU_POOL_PER_TIER = 4;
const PRICE_TIERS: Array<"budget" | "mid" | "high" | "enthusiast"> = ["budget", "mid", "high", "enthusiast"];

function purposeScore(scores: { gameScore: number; workScore: number; aiScore: number }, purpose: Purpose): number {
  if (purpose === "gaming" || purpose === "stream" || purpose === "cad") return scores.gameScore;
  if (purpose === "ai") return scores.aiScore;
  return scores.workScore;
}

// 순수 점수 기준 top-K만 뽑으면 예산과 무관하게 항상 최상급 부품만 후보 풀에 남아,
// "저예산" 요청에도 고가 조합만 추천되는 문제가 생긴다(가격은 최종 점수에서 10%만 반영되므로
// 애초에 저가 후보가 풀에 없으면 만회할 기회가 없다). 그래서 가격 티어별로 상위 N개씩 골고루 남긴다.
export function selectDiversePool<T extends { gameScore: number; workScore: number; aiScore: number; priceTier: "budget" | "mid" | "high" | "enthusiast" }>(
  items: T[],
  purpose: Purpose,
  limitPerTier: number
): T[] {
  const pool: T[] = [];
  for (const tier of PRICE_TIERS) {
    const tierItems = items.filter((item) => item.priceTier === tier);
    const sorted = tierItems.length <= limitPerTier
      ? tierItems
      : [...tierItems].sort((a, b) => purposeScore(b, purpose) - purposeScore(a, purpose)).slice(0, limitPerTier);
    pool.push(...sorted);
  }
  return pool;
}

function groupRamsByDdr(rams: RAM[]): Map<string, RAM[]> {
  const map = new Map<string, RAM[]>();
  for (const ram of rams) {
    const bucket = map.get(ram.ddr);
    if (bucket) bucket.push(ram);
    else map.set(ram.ddr, [ram]);
  }
  return map;
}

function groupMotherboardsBySocketAndDdr(mbs: MotherBoard[]): Map<string, MotherBoard[]> {
  const map = new Map<string, MotherBoard[]>();
  for (const mb of mbs) {
    const key = `${mb.socket}|${mb.ddr}`;
    const bucket = map.get(key);
    if (bucket) bucket.push(mb);
    else map.set(key, [mb]);
  }
  return map;
}

/** 랭킹 파이프라인 내부에서만 쓰는 확장 후보 — buildKey/cpuId/gpuId/원시 성능점수를 함께 나른다.
 *  RecommendationResult(공개 타입)에는 없는 필드라 별도 타입으로 둔다. */
export interface RankedCandidate {
  candidate: RecommendationResult;
  buildKey: string;
  cpuId: string;
  gpuId: string;
  gpuScore: number;
  cpuScore: number;
  /** 예산 배율(computeBudgetFactor) 반영 전의 순수 성능+최신성 점수 — "최고성능 지향" 전략의 기준. */
  normalizedBaseScore: number;
}

// 결정적 다단계 비교자 — 동점자도 매 실행 항상 같은 순서로 정렬되도록 보장한다.
// 1차: 종합 점수 내림차순  2차: GPU 성능 내림차순  3차: CPU 성능 내림차순
// 4차: 실가격 오름차순(placeholder는 최후순위로 밀림)  5차: id 사전순(최종 결정성).
export function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (b.candidate.finalScore !== a.candidate.finalScore) return b.candidate.finalScore - a.candidate.finalScore;
  if (b.gpuScore !== a.gpuScore) return b.gpuScore - a.gpuScore;
  if (b.cpuScore !== a.cpuScore) return b.cpuScore - a.cpuScore;

  const aPrice = isPlaceholderPrice(a.candidate.totalPrice) ? Number.MAX_SAFE_INTEGER : a.candidate.totalPrice;
  const bPrice = isPlaceholderPrice(b.candidate.totalPrice) ? Number.MAX_SAFE_INTEGER : b.candidate.totalPrice;
  if (aPrice !== bPrice) return aPrice - bPrice;

  return a.candidate.id.localeCompare(b.candidate.id);
}

export function generateCandidates(
  cpus: CPU[],
  gpus: GPU[],
  rams: RAM[],
  ssds: SSD[],
  mbs: MotherBoard[],
  psus: PSU[],
  purpose: Purpose,
  budgetTarget: number | null,
  existingParts: ExistingPartsState,
  caseOwnership: CaseOwnershipOption,
  budgetMin: number | null = null,
  preferredBudgetTarget: number | null = null
): RecommendationResult[] {
  const cpuPool = selectDiversePool(cpus, purpose, CPU_POOL_PER_TIER);
  const gpuPool = selectDiversePool(gpus, purpose, GPU_POOL_PER_TIER);
  const mbsBySocketDdr = groupMotherboardsBySocketAndDdr(mbs);
  const mbsBySocket = new Map<string, MotherBoard[]>();
  for (const mb of mbs) {
    const bucket = mbsBySocket.get(mb.socket);
    if (bucket) bucket.push(mb);
    else mbsBySocket.set(mb.socket, [mb]);
  }
  const ramsByDdr = groupRamsByDdr(rams);

  // buildKey(핵심 부품 조합: cpu+gpu+mb+psu)와 gpu.id, 원시 성능점수를 함께 추적해
  // 최종 랭킹 단계에서 결정적 동점자 비교 + 완전 중복 제거 + GPU 편중 완화 필터를 적용한다.
  const pool: RankedCandidate[] = [];

  for (const cpu of cpuPool) {
    const motherboardsToUse = mbsBySocketDdr.get(`${cpu.socket}|${cpu.ddr}`) ?? mbsBySocket.get(cpu.socket) ?? [];
    const ramsToUse = ramsByDdr.get(cpu.ddr) ?? [];
    if (motherboardsToUse.length === 0 || ramsToUse.length === 0) continue;

    for (const gpu of gpuPool) {
      // cpu+gpu 조합만으로 이미 전력 요구치가 보유 파워를 넘으면 ram/ssd/mb/psu까지 내려갈 필요가 없다.
      const powerLimit = existingParts.Power.enabled ? parseWattage(existingParts.Power.wattage) : null;
      if (powerLimit && powerLimit < cpu.tdp + gpu.tgp + 150) continue;

      // 결정적 동점자 비교용 원시 성능점수 — buildCandidate 내부의 cpuScore/gpuScore 산출식과 동일하다.
      const cpuBench = getCpuBenchmark(cpu.id);
      const gpuBench = getGpuBenchmark(gpu.id);
      const benchKey = purpose === "gaming" ? "game" : purpose === "ai" ? "ai" : "work";
      const cpuScore = (cpuBench as { game?: number; work?: number; ai?: number })[benchKey] ?? cpu.gameScore;
      const gpuScore = (gpuBench as { game?: number; work?: number; ai?: number })[benchKey] ?? gpu.gameScore;

      // 메인보드 품질 하한선 — CPU TDP가 높을수록(=발열/전력 부하가 큰 CPU) 검증된 VRM
      // 설계의 보드만 허용한다. qualityScore 없는 레거시 항목은 하한선 적용 없이 통과.
      const minBoardQuality = cpu.tdp >= 150 ? 78 : cpu.tdp >= 100 ? 65 : 0;

      for (const ram of ramsToUse) {
        for (const ssd of ssds) {
          for (const mb of motherboardsToUse) {
            if (mb.ddr !== ram.ddr) continue;
            if (typeof mb.qualityScore === "number" && mb.qualityScore < minBoardQuality) continue;

            for (const psu of psus) {
              // 메인보드/PSU 결합: 소켓·DDR 호환 메인보드(위에서 이미 필터링)에
              // 부하 기준 충분 용량 PSU만 결합한다 — 용량 미달 PSU는 감점이 아니라 원천 제외.
              if (psu.wattage < cpu.tdp + gpu.tgp + 150) continue;
              // PSU 신뢰도 하한선 — qualityScore 없는 레거시 항목은 하한선 적용 없이 통과.
              if (typeof psu.qualityScore === "number" && psu.qualityScore < 70) continue;

              const built = buildCandidate(cpu, gpu, ram, ssd, mb, psu, purpose, budgetTarget, existingParts, caseOwnership, budgetMin);
              if (built) {
                pool.push({
                  candidate: built.result,
                  buildKey: `${cpu.id}::${gpu.id}::${mb.id}::${psu.id}`,
                  cpuId: cpu.id,
                  gpuId: gpu.id,
                  gpuScore,
                  cpuScore,
                  normalizedBaseScore: built.normalizedBaseScore,
                });
              }
            }
          }
        }
      }
    }
  }

  return selectTopByStrategy(pool, budgetTarget, preferredBudgetTarget);
}

// TOP1/2/3은 "균형 최적/가성비 추천/최고성능 지향" 라벨이 실제로 의미가 있도록 서로 다른
// 목적함수로 뽑는다(app/result/page.tsx의 STRATEGY_TAGS 순서와 정확히 일치) — 이전에는 셋 다
// 동일한 finalScore 랭킹의 1/2/3위였을 뿐이라 라벨과 무관하게 사실상 같은 조합(특히 CPU)이
// 반복됐다. 전략별 정렬 후 앞서 채택된 슬롯과 CPU/GPU가 겹치지 않는 후보를 우선 채택한다.
type Strategy = "balanced" | "value" | "performance";
const STRATEGIES: Strategy[] = ["balanced", "value", "performance"];

// 가성비: 100만원당 종합점수. 성능 자체보다 "가격 대비 얼마나 효율적인가"를 우선한다.
function valueScoreOf(rc: RankedCandidate): number {
  const price = isPlaceholderPrice(rc.candidate.totalPrice) ? Number.MAX_SAFE_INTEGER : rc.candidate.totalPrice;
  return (rc.candidate.finalScore / price) * 1_000_000;
}

function scoreForStrategy(rc: RankedCandidate, strategy: Strategy, preferredTarget: number | null): number {
  // "정확한 금액 입력"(exact 모드)은 ±10% 범위로 변환돼 range 모드와 같은 경로를 타지만, "정확히
  // 이 금액"이라는 사용자 의도는 균형(TOP1) 슬롯에서만큼은 살려준다 — 종합점수 최댓값이 아니라
  // 입력 금액과의 거리가 가장 가까운 조합을 최우선으로 삼는다(값이 작을수록 좋으므로 부호 반전).
  if (strategy === "balanced" && preferredTarget !== null) {
    return -Math.abs(rc.candidate.totalPrice - preferredTarget);
  }
  if (strategy === "value") return valueScoreOf(rc);
  if (strategy === "performance") return rc.normalizedBaseScore; // 예산 배율 미반영 — 순수 성능/최신성 최대화
  return rc.candidate.finalScore; // balanced(타겟 없음): 기존처럼 목적 가중치+최신성+예산배율을 모두 반영한 종합점수
}

function compareForStrategy(a: RankedCandidate, b: RankedCandidate, strategy: Strategy, preferredTarget: number | null): number {
  const diff = scoreForStrategy(b, strategy, preferredTarget) - scoreForStrategy(a, strategy, preferredTarget);
  if (diff !== 0) return diff;
  return compareCandidates(a, b); // 전략별 점수가 같으면 기존 결정적 tie-break로 폴백
}

// 후보 풀은 CPU×GPU×RAM×SSD×메인보드×PSU 조합이라 수천~수만 건까지 커질 수 있다. 매 전략마다
// 풀 전체를 O(n log n) 정렬하면(3회) 비용이 커지므로, 정렬 대신 O(n) 단일 스캔으로 "이번 전략
// 기준 최선"을 찾는다 — 1순위(CPU/GPU 모두 다름)/2순위(CPU만 다름)/3순위(buildKey만 다름) 각각을
// 스캔 한 번에 동시에 추적한다.
function pickBestForStrategy(
  pool: RankedCandidate[],
  strategy: Strategy,
  usedCpuIds: Set<string>,
  usedGpuIds: Set<string>,
  usedBuildKeys: Set<string>,
  preferredTarget: number | null,
  extraFilter?: (rc: RankedCandidate) => boolean
): RankedCandidate | undefined {
  let bestFull: RankedCandidate | undefined;
  let bestCpuOnly: RankedCandidate | undefined;
  let bestAny: RankedCandidate | undefined;

  for (const rc of pool) {
    if (usedBuildKeys.has(rc.buildKey)) continue;
    if (extraFilter && !extraFilter(rc)) continue;
    if (!bestAny || compareForStrategy(rc, bestAny, strategy, preferredTarget) < 0) bestAny = rc;

    if (usedCpuIds.has(rc.cpuId)) continue;
    if (!bestCpuOnly || compareForStrategy(rc, bestCpuOnly, strategy, preferredTarget) < 0) bestCpuOnly = rc;

    if (usedGpuIds.has(rc.gpuId)) continue;
    if (!bestFull || compareForStrategy(rc, bestFull, strategy, preferredTarget) < 0) bestFull = rc;
  }

  // 1순위: 이미 채택된 슬롯과 CPU/GPU가 모두 다른 후보 (완전한 다양성)
  // 2순위: CPU만이라도 다른 후보 (원인이었던 "CPU 전부 동일" 문제의 핵심 방어선)
  // 3순위: 그래도 없으면 buildKey 중복만 피해 재충원(빈 슬롯 방지, 후보 풀이 얕을 때의 안전망)
  return bestFull ?? bestCpuOnly ?? bestAny;
}

// "최고성능 지향"이 예산과 완전히 무관하게 카탈로그 최상급 조합만 골라버리면, 화면에 공통으로
// 표시되는 finalScore(예산 배율이 반영된 "종합 X점")가 극단적으로 낮게 나와(예: 0.6점) 다른 두
// 카드와 나란히 볼 때 마치 오류처럼 보인다. 그래서 예산 대비 지나치게 벗어난(대략 20%대 초과를
// 넘어서는) 조합은 성능 전략에서도 우선 배제하고, 그 안에서만 순수 성능을 최대화한다 — 그래도
// 후보가 없으면(예산이 극단적으로 낮은 등) 안전망으로 예산 무관 최고성능으로 폴백한다.
const PERFORMANCE_BUDGET_FACTOR_FLOOR = 0.5;

function selectTopByStrategy(pool: RankedCandidate[], budgetTarget: number | null, preferredTarget: number | null = null): RecommendationResult[] {
  const usedCpuIds = new Set<string>();
  const usedGpuIds = new Set<string>();
  const usedBuildKeys = new Set<string>();
  const result: RecommendationResult[] = [];

  for (const strategy of STRATEGIES) {
    let picked: RankedCandidate | undefined;

    if (strategy === "performance" && budgetTarget) {
      const withinEnvelope = (rc: RankedCandidate) => computeBudgetFactor(rc.candidate.totalPrice, budgetTarget) >= PERFORMANCE_BUDGET_FACTOR_FLOOR;
      picked = pickBestForStrategy(pool, strategy, usedCpuIds, usedGpuIds, usedBuildKeys, preferredTarget, withinEnvelope);
    }
    if (!picked) {
      picked = pickBestForStrategy(pool, strategy, usedCpuIds, usedGpuIds, usedBuildKeys, preferredTarget);
    }

    if (!picked) continue;
    usedCpuIds.add(picked.cpuId);
    usedGpuIds.add(picked.gpuId);
    usedBuildKeys.add(picked.buildKey);
    result.push(picked.candidate);
  }

  return result;
}

function buildCandidate(
  cpu: CPU,
  gpu: GPU,
  ram: RAM,
  ssd: SSD,
  mb: MotherBoard,
  psu: PSU,
  purpose: Purpose,
  budgetTarget: number | null,
  existingParts: ExistingPartsState,
  caseOwnership: CaseOwnershipOption,
  budgetMin: number | null
): { result: RecommendationResult; normalizedBaseScore: number } | null {
  const { score: compatibilityScoreVal, warnings } = compatibilityScore(
    cpu,
    gpu,
    ram,
    ssd,
    mb,
    psu,
    existingParts.Power.enabled ? parseWattage(existingParts.Power.wattage) ?? undefined : undefined
  );

  if (compatibilityScoreVal < 70) {
    return null;
  }

  const cpuBench = getCpuBenchmark(cpu.id);
  const gpuBench = getGpuBenchmark(gpu.id);

  const cpuScore =
    (cpuBench as { game?: number; work?: number; ai?: number })[
      purpose === "gaming" ? "game" : purpose === "ai" ? "ai" : "work"
    ] ?? cpu.gameScore;
  const gpuScore =
    (gpuBench as { game?: number; work?: number; ai?: number })[
      purpose === "gaming" ? "game" : purpose === "ai" ? "ai" : "work"
    ] ?? gpu.gameScore;

  const ramScore = rateRam(ram, purpose);
  const ssdScore = rateSsd(ssd, purpose);
  const motherboardScore = rateMotherboard(mb);
  const psuScore = ratePsu(psu, cpu, gpu);

  const recency = recencyBoost(cpu, gpu, mb, psu);
  const weight = WEIGHTS[purpose];
  const baseScore =
    cpuScore * weight.cpu +
    gpuScore * weight.gpu +
    ramScore * weight.ram +
    ssdScore * weight.ssd +
    motherboardScore * weight.motherboard +
    psuScore * weight.psu;

  const normalizedBaseScore = baseScore * 0.88 + recency * 0.12;

  const cpuPrice = priceTierToPrice[cpu.priceTier] ?? 0;
  const gpuPrice = priceTierToPrice[gpu.priceTier] ?? 0;
  const ramPrice = priceTierToPrice[ram.priceTier] ?? 0;
  const ssdPrice = priceTierToPrice[ssd.priceTier] ?? 0;
  // hardwareSeed.ts 병합분은 priceTier 대신 실거래가(price)를 들고 있다 — 있으면 우선 사용.
  const motherboardPrice = mb.price ?? (mb.priceTier ? priceTierToPrice[mb.priceTier] : 0) ?? 0;
  const psuPrice = psu.price ?? (psu.priceTier ? priceTierToPrice[psu.priceTier] : 0) ?? 0;
  const casePrice = caseOwnership === "owned" ? 0 : CASE_PRICE;

  const totalPrice = cpuPrice + gpuPrice + ramPrice + ssdPrice + motherboardPrice + psuPrice + casePrice;

  // 듀얼 레인지 슬라이더의 최소 예산 — max(budgetTarget)는 기존처럼 소프트 페널티(초과할수록
  // 지수감쇠)로 다루지만, min은 "이 아래로는 아예 보여주지 않는다"는 하드 하한이라 원천 제외한다.
  if (budgetMin && totalPrice < budgetMin) {
    return null;
  }

  const budgetFactor = computeBudgetFactor(totalPrice, budgetTarget);
  if (budgetTarget && budgetFactor < MIN_REASONABLE_BUDGET_FACTOR) {
    return null;
  }
  const finalScore = Math.round(Math.min(100, Math.max(0, normalizedBaseScore * budgetFactor)) * 100) / 100;

  // 점수-부품 원자성: finalScore는 여기서 단 1회 계산되어 이 객체에 귀속되고,
  // Object.freeze로 동결해 이후 파이프라인(정렬/필터/렌더)에서 재계산·변조가 불가능하게 한다.
  const result = Object.freeze({
    id: candidateId(cpu, gpu, ram, ssd, mb, psu),
    cpu: cpu.name,
    gpu: gpu.name,
    ram: `${ram.capacity}GB ${ram.ddr}`,
    ssd: `${ssd.capacity}GB ${ssd.interface}`,
    motherboard: mb.name,
    power: `${psu.wattage}W 추천 파워`,
    case: caseOwnership === "owned" ? "보유 케이스 사용" : "신규 케이스 포함",
    totalPrice,
    casePrice,
    parts: [
      { label: "CPU", name: cpu.name, price: cpuPrice },
      { label: "GPU", name: gpu.name, price: gpuPrice },
      { label: "RAM", name: `${ram.capacity}GB ${ram.ddr}`, price: ramPrice },
      { label: "SSD", name: `${ssd.capacity}GB ${ssd.interface}`, price: ssdPrice },
      { label: "메인보드", name: mb.name, price: motherboardPrice },
      { label: "파워", name: `${psu.wattage}W ${psu.name}`, price: psuPrice },
      { label: "케이스", name: caseOwnership === "owned" ? "보유 케이스" : "추천 케이스", price: casePrice },
    ],
    compatibilityScore: compatibilityScoreVal,
    compatibilityDetails: [
      `소켓 일치: CPU ${cpu.socket}와 메인보드 ${mb.socket}가 호환됩니다.`,
      `전력 여유: ${cpu.tdp + gpu.tgp + 150}W 기준으로 ${psu.wattage}W 파워가 충분합니다.`,
      `메모리 규격: ${ram.ddr}와 메인보드 ${mb.ddr}가 일치합니다.`,
      `스토리지 경로: SSD ${ssd.interface} / M.2 ${mb.m2Slots}개 / NVMe Gen ${mb.supportedNvmeGenerations.join(", ")} 지원`,
    ],
    warnings,
    finalScore,
    reason: createReason(finalScore, compatibilityScoreVal, caseOwnership),
  });

  return { result, normalizedBaseScore };
}

export function recommend(
  answers: Answers,
  existingParts: ExistingPartsState = {
    CPU: { enabled: false, brand: "", model: "" },
    GPU: { enabled: false, brand: "", manufacturer: "", model: "" },
    RAM: { enabled: false, ddr: "", capacity: "", brand: "", model: "" },
    SSD: { enabled: false, capacity: "", brand: "", model: "" },
    HDD: { enabled: false, capacity: "" },
    Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
    Power: { enabled: false, wattage: "" },
  },
  caseOwnership: CaseOwnershipOption = "owned",
  purposes?: PurposeType[],
  // 듀얼 레인지 슬라이더(또는 프리셋에서 매핑된) {min,max} — 주어지면 answers[3] 문자열 파싱보다
  // 우선한다. max는 기존 budgetTarget과 동일하게 소프트 페널티 기준으로, min은 하드 하한으로 쓰인다.
  budgetRange?: BudgetRange | null,
  // "정확한 금액 입력"이 ±10% range로 변환돼 위 budgetRange 경로를 타되, 균형(TOP1) 슬롯만큼은
  // 종합점수 최댓값 대신 이 값과 가장 가까운 조합을 우선 채택하도록 한다.
  preferredBudgetTarget?: number | null
): RecommendationResult[] {
  const purpose = pickPurpose(answers, purposes);
  const budgetTarget = budgetRange ? budgetRange.max : pickBudgetTarget(answers);
  const budgetMin = budgetRange?.min ?? null;

  return generateCandidates(
    _cpus,
    _gpus,
    _rams,
    _ssds,
    _motherboards,
    _psus,
    purpose,
    budgetTarget,
    existingParts,
    caseOwnership,
    budgetMin,
    preferredBudgetTarget ?? null
  );
}

export { recommend as default };