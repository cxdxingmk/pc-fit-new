import { compatibilityScore, recencyBoost } from "./compatibility";
import { defaultDataSource } from "./dataSource";
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
import type { ExistingPartsState, CaseOwnershipOption, PurposeType } from "../types/build";
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

function rateMotherboard(mb: MotherBoard) {
  return (mb.gameScore + mb.workScore + mb.aiScore) / 3;
}

function ratePsu(psu: PSU, cpu: CPU, gpu: GPU) {
  const required = cpu.tdp + gpu.tgp + 150;
  const base = psu.wattage >= required ? 80 : 55;
  const efficiencyBonus = psu.efficiency === "80 PLUS Platinum" ? 10 : psu.efficiency === "80 PLUS Titanium" ? 12 : 8;
  return Math.min(100, base + efficiencyBonus);
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
  caseOwnership: CaseOwnershipOption
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

  const candidates: RecommendationResult[] = [];

  for (const cpu of cpuPool) {
    const motherboardsToUse = mbsBySocketDdr.get(`${cpu.socket}|${cpu.ddr}`) ?? mbsBySocket.get(cpu.socket) ?? [];
    const ramsToUse = ramsByDdr.get(cpu.ddr) ?? [];
    if (motherboardsToUse.length === 0 || ramsToUse.length === 0) continue;

    for (const gpu of gpuPool) {
      // cpu+gpu 조합만으로 이미 전력 요구치가 보유 파워를 넘으면 ram/ssd/mb/psu까지 내려갈 필요가 없다.
      const powerLimit = existingParts.Power.enabled ? parseWattage(existingParts.Power.wattage) : null;
      if (powerLimit && powerLimit < cpu.tdp + gpu.tgp + 150) continue;

      for (const ram of ramsToUse) {
        for (const ssd of ssds) {
          for (const mb of motherboardsToUse) {
            if (mb.ddr !== ram.ddr) continue;

            for (const psu of psus) {
              const candidate = buildCandidate(cpu, gpu, ram, ssd, mb, psu, purpose, budgetTarget, existingParts, caseOwnership);
              if (candidate) {
                candidates.push(candidate);
              }
            }
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, 3);
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
  caseOwnership: CaseOwnershipOption
): RecommendationResult | null {
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
  const motherboardPrice = priceTierToPrice[mb.priceTier] ?? 0;
  const psuPrice = priceTierToPrice[psu.priceTier] ?? 0;
  const casePrice = caseOwnership === "owned" ? 0 : CASE_PRICE;

  const totalPrice = cpuPrice + gpuPrice + ramPrice + ssdPrice + motherboardPrice + psuPrice + casePrice;

  const budgetFactor = computeBudgetFactor(totalPrice, budgetTarget);
  const finalScore = Math.round(Math.min(100, Math.max(0, normalizedBaseScore * budgetFactor)) * 100) / 100;

  return {
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
  };
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
  purposes?: PurposeType[]
): RecommendationResult[] {
  const purpose = pickPurpose(answers, purposes);
  const budgetTarget = pickBudgetTarget(answers);

  return generateCandidates(_cpus, _gpus, _rams, _ssds, _motherboards, _psus, purpose, budgetTarget, existingParts, caseOwnership);
}

export async function recommendAsync(
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
  purposes?: PurposeType[]
): Promise<RecommendationResult[]> {
  const ds = defaultDataSource;

  const [cpus, gpus, rams, ssds, mbs, psus] = await Promise.all([
    ds.getCpuData(),
    ds.getGpuData(),
    ds.getRamData(),
    ds.getSsdData(),
    ds.getMotherboardData(),
    ds.getPsuData(),
  ]);

  const purpose = pickPurpose(answers, purposes);
  const budgetTarget = pickBudgetTarget(answers);

  return generateCandidates(cpus, gpus, rams, ssds, mbs, psus, purpose, budgetTarget, existingParts, caseOwnership);
}

export { recommend as default };