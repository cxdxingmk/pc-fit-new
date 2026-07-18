import { compatibilityScore, recencyBoost, CPU_GPU_GAP_LARGE } from "./compatibility";
import { getCpuBenchmark } from "../../database/mapping/cpuMap";
import { getGpuBenchmark } from "../../database/mapping/gpuMap";
import { resolveOwnedParts, buildOwnedPsuRepresentative, type ResolvedOwnedParts } from "./ownedParts";
import { isWorkstationGpuModel } from "./hardwareScoring";

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

// "정확한 금액 입력"(preferredBudgetTarget)이 주어졌을 때 TOP1/2/3 모두가 지켜야 하는 허용 오차 —
// 위/아래 20만원. app/context/BuildContext.tsx의 setBudgetExact가 이 값으로 {min,max} range를
// 만들어 budgetMin 하드 하한과도 정확히 맞물리게 한다(둘이 어긋나면 한쪽이 다른 쪽보다 느슨해져
// 이 허용치보다 더 넓은/좁은 범위로 후보 풀 자체가 잘못 구성된다).
export const EXACT_BUDGET_TOLERANCE = 200_000;

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

// 용량 하한(315행, wattage < required 제외)만 있고 상한이 없으면, 용량 초과분과 무관하게
// 모든 통과 PSU가 base=80으로 동점 처리되어 효율등급/qualityScore만으로 승자가 갈린다 —
// 그 결과 "RTX 4060(요구 330W대)에 1000W 티타늄 PSU" 같은 과도한 오버스펙이 단지 등급이
// 높다는 이유로 이겨버렸다. 적정 헤드룸(요구치의 1.15~1.6배)을 넘는 초과분엔 감점을 준다.
const PSU_HEADROOM_SWEET_SPOT = 1.6;
const PSU_OVERSIZE_PENALTY_PER_RATIO = 20;
const MAX_PSU_OVERSIZE_PENALTY = 25;

export function ratePsu(psu: PSU, cpu: CPU, gpu: GPU) {
  const required = cpu.tdp + gpu.tgp + 150;
  const headroomRatio = psu.wattage / required;
  const oversizePenalty =
    headroomRatio > PSU_HEADROOM_SWEET_SPOT
      ? Math.min(MAX_PSU_OVERSIZE_PENALTY, (headroomRatio - PSU_HEADROOM_SWEET_SPOT) * PSU_OVERSIZE_PENALTY_PER_RATIO)
      : 0;
  const base = (psu.wattage >= required ? 80 : 55) - oversizePenalty;
  const efficiencyBonus = psu.efficiency === "80 PLUS Platinum" ? 10 : psu.efficiency === "80 PLUS Titanium" ? 12 : 8;
  const baseline = Math.min(100, base + efficiencyBonus);
  return typeof psu.qualityScore === "number" ? baseline * 0.5 + psu.qualityScore * 0.5 : baseline;
}

// 정책: 파워는 "필요 전력 × 1.3~1.5배" 안전마진 안에서만 고른다 — ratePsu의 오버사이즈 감점(위
// PSU_HEADROOM_SWEET_SPOT)만으로는 qualityScore가 아주 높은 대용량 PSU(예: 1500W Titanium,
// qualityScore 83)가 감점을 뚫고 점수로 이겨버리는 사례가 실제로 있었다(요구 350W대 조합에
// 1500W가 선택됨). 그래서 후보 자체를 이 범위로 강하게 제한해, 균형/가성비/고성능 어떤 전략을
// 쓰든 PSU는 cpu+gpu 조합에 의해 결정적으로 하나만 정해지게 한다(전략별로 PSU가 갈릴 이유
// 자체를 없앰 — 회귀 테스트로 고정).
const PSU_SAFETY_MARGIN_MIN = 1.3;
const PSU_SAFETY_MARGIN_MAX = 1.5;
const PSU_MIN_QUALITY_SCORE = 70;

export function selectRecommendedPsu(cpu: CPU, gpu: GPU, catalog: PSU[]): PSU | null {
  const required = cpu.tdp + gpu.tgp + 150;
  const minWattage = required * PSU_SAFETY_MARGIN_MIN;
  const maxWattage = required * PSU_SAFETY_MARGIN_MAX;
  const qualifies = (psu: PSU) => typeof psu.qualityScore !== "number" || psu.qualityScore >= PSU_MIN_QUALITY_SCORE;

  // 1순위: 안전마진 범위 안 + 품질 기준 통과 — 그중 가장 작은(=과도한 스펙 지양) 것을 고르고,
  // 동일 와트수 동률이면 qualityScore가 높은 쪽을 우선한다.
  const inRange = catalog
    .filter((psu) => psu.wattage >= minWattage && psu.wattage <= maxWattage && qualifies(psu))
    .sort((a, b) => a.wattage - b.wattage || (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
  if (inRange.length > 0) return inRange[0];

  // 2순위: 카탈로그 등급이 성겨 안전마진 범위 안에 맞는 게 없으면(품질 기준은 유지한 채) 요구
  // 전력을 만족하는 것 중 가장 작은 것으로 폴백한다.
  const meetsRequirement = catalog
    .filter((psu) => psu.wattage >= required && qualifies(psu))
    .sort((a, b) => a.wattage - b.wattage);
  if (meetsRequirement.length > 0) return meetsRequirement[0];

  // 3순위(안전망): 품질 기준을 만족하는 것마저 없으면 품질 기준을 내려놓고 요구 전력만
  // 만족하는 것 중 가장 작은 것 — "추천 자체가 없음"보다는 낫다.
  const anyMeetsRequirement = catalog.filter((psu) => psu.wattage >= required).sort((a, b) => a.wattage - b.wattage);
  return anyMeetsRequirement[0] ?? null;
}

// 정책: 새로 구매하는 SSD는 예산/견적 성격과 무관하게 항상 512GB 한 등급으로 고정한다(보유
// SSD가 있으면 당연히 그걸 그대로 쓴다 — ownedParts.ts 참고). 카탈로그에 정확히 512GB가 없으면
// (성긴 등급 구성) 가장 작은 등급으로 안전하게 폴백한다.
const FIXED_SSD_CAPACITY_GB = 512;

export function selectFixedSsd(catalog: SSD[]): SSD | null {
  const exact = catalog.find((ssd) => ssd.capacity === FIXED_SSD_CAPACITY_GB);
  if (exact) return exact;
  return [...catalog].sort((a, b) => a.capacity - b.capacity)[0] ?? null;
}

// 용도별 CPU 선정 기준을 사용자에게 설명하는 문구 — 대표 목적(purpose) 하나를 기준으로 고른다.
function cpuPurposeReason(purpose: Purpose): string {
  switch (purpose) {
    case "gaming":
      return "게이밍 벤치마크 기준 상위권 CPU로 구성했습니다.";
    case "work":
      return "내장그래픽과 전력 효율을 갖춘 사무용 CPU로 구성했습니다.";
    case "video":
    case "stream":
    case "ai":
    case "dev":
      return "멀티코어 성능이 뛰어난 CPU로 인코딩·렌더링·컴파일 작업에 유리하게 구성했습니다.";
    case "cad":
      return "싱글코어와 멀티코어 성능의 균형을 맞춘 CPU로 구성했습니다.";
    case "etc":
      return "게임과 멀티코어 작업 모두 무난한 CPU로 구성했습니다.";
  }
}

function createReason(score: number, compatibility: number, caseOwnership: CaseOwnershipOption, purpose: Purpose) {
  const messages: string[] = [];
  if (score > 90) messages.push("최신 세대 아키텍처와 안정성을 동시에 만족하는 세트입니다.");
  else if (score > 80) messages.push("전반적으로 매우 균형 잡힌 완성형 세트입니다.");
  else if (score > 70) messages.push("예산 대비 만족도가 높은 추천 조합입니다.");
  else messages.push("성능과 예산을 다시 조정해보면 더 좋은 결과가 나올 수 있습니다.");

  messages.push(cpuPurposeReason(purpose));

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

// ── 신규 구매 후보 세대 제한 ────────────────────────────────────────────────
// GPU: RTX 30번대/RX 6000번대 이하 세대는 이미 단종돼 신품 유통이 매우 제한적이고, 있어도
// 신세대보다 비싸게 팔리는 가격 역전이 흔하다 — "신품 견적 추천" 서비스 목적과 맞지 않아
// 신규 구매 후보에서 제외한다. RTX 40번대/RX 7000번대(RDNA3)부터를 최신 세대로 본다.
//
// releaseYear만으로는 부족하다 — 실제로 겪은 문제: 병합 카탈로그의 "GeForce RTX 3050 4 GB"는
// releaseYear가 2022라서 releaseYear>=2022 기준만 쓰면 30번대인데도 "최신"으로 잘못 통과된다
// (RTX 30번대 중 일부는 40번대와 같은 해에도 출시됐다). 그래서 모델명에 박혀 있는 세대 번호
// 자체(RTX/GTX의 두 자리 세대 접두, RX의 천 단위 세대)를 1차 기준으로 삼고, 그 패턴에 안
// 걸리는 브랜드(Intel Arc 등 — 아직 구세대가 존재하지 않음)만 releaseYear로 폴백한다.
// 모델명을 하나하나 나열해 배제하는 게 아니라 "세대 번호가 몇 이상인가"라는 규칙 하나로
// 판정하므로, RTX 50xx/60xx나 RX 8xxx/9xxx 이후 신세대가 카탈로그에 추가돼도 코드 수정 없이
// 자동으로 통과한다. 보유 부품으로 지정하는 경로(ownedParts.ts)는 이 제한과 무관하게 전
// 세대를 허용한다 — 이미 가진 부품 진단에는 세대 제한이 의미가 없다.
const MIN_NVIDIA_RTX_SERIES = 40; // RTX 40번대부터
const MIN_AMD_RX_SERIES = 7; // RX 7000번대(RDNA3, RTX 40세대와 동시대)부터
export const MIN_NEW_PURCHASE_GPU_RELEASE_YEAR = 2022; // 위 패턴에 안 걸리는 브랜드용 폴백 기준

function deriveNvidiaGpuSeries(name: string): number | null {
  const rtxMatch = name.match(/RTX\s?(\d{2})\d{2}/i); // "RTX 4070 SUPER" -> 40, "RTX 3050 4 GB" -> 30
  if (rtxMatch) return Number(rtxMatch[1]);
  if (/\bGTX\b/i.test(name)) return 0; // GTX는 전부 RTX 이전 세대다.
  return null;
}

function deriveAmdGpuSeries(name: string): number | null {
  const rxMatch = name.match(/RX\s?(\d)\d{3}\b/i); // "RX 7900 XTX" -> 7, "RX 6800 XT" -> 6
  if (rxMatch) return Number(rxMatch[1]);
  if (/RX\s?[3-5]\d{2}\b/i.test(name)) return -1; // RX 590/580/570/560 등 3자리(Polaris 이전) — 가장 오래됨
  return null;
}

export function isNewPurchaseEligibleGpu(gpu: GPU): boolean {
  const nvidiaSeries = deriveNvidiaGpuSeries(gpu.name);
  if (nvidiaSeries !== null) return nvidiaSeries >= MIN_NVIDIA_RTX_SERIES;

  const amdSeries = deriveAmdGpuSeries(gpu.name);
  if (amdSeries !== null) return amdSeries >= MIN_AMD_RX_SERIES;

  // Intel Arc 등 세대 접두 패턴이 없는 브랜드 — 아직 구세대가 존재하지 않으므로 releaseYear로만 판단.
  return gpu.releaseYear >= MIN_NEW_PURCHASE_GPU_RELEASE_YEAR;
}

// CPU는 GPU만큼 세대 교체가 빠르지 않다 — 예를 들어 Ryzen 5 5600(2020, AM4)은 지금도 AMD가
// 계속 신품으로 파는 예산형 스테디셀러라, GPU와 같은 기준(2022)을 그대로 적용하면 실제로
// 살 수 있는 합리적인 예산 픽까지 부당하게 제외하게 된다. 2019년 이전(Ryzen 1000~3000번대와
// 그에 준하는 구세대 Intel)은 실질적으로 신품 유통이 끊긴 지 오래라 확실히 제외한다. GPU와
// 달리 CPU 카탈로그 전수 조사에서는 releaseYear가 실제 세대와 어긋나는 사례가 발견되지
// 않아 releaseYear 단독 기준으로 충분하다.
export const MIN_NEW_PURCHASE_CPU_RELEASE_YEAR = 2020;

export function isNewPurchaseEligibleCpu(cpu: CPU): boolean {
  return cpu.releaseYear >= MIN_NEW_PURCHASE_CPU_RELEASE_YEAR;
}

function purposeScore(scores: { gameScore: number; workScore: number; aiScore: number }, purpose: Purpose): number {
  if (purpose === "gaming" || purpose === "stream" || purpose === "cad") return scores.gameScore;
  if (purpose === "ai") return scores.aiScore;
  return scores.workScore;
}

const clampCpuFitScore = (value: number): number => Math.max(0, Math.min(100, value));

// 사무용 CPU 적합도 — hasIntegratedGraphics(igpu)를 1순위 기준으로 크게 우대하고(브랜드가 아니라
// 내장그래픽 유무·전력효율이라는 성능 특성으로 판단), efficiencyScore를 주 신호로 삼되, 게이밍
// 특화 CPU(gameScore가 높은 CPU)는 사무용으로는 오히려 후순위가 되도록 감점한다.
function cpuOfficeFitScore(cpu: CPU): number {
  const igpuBonus = cpu.igpu ? 40 : 0;
  return clampCpuFitScore(igpuBonus + cpu.efficiencyScore * 0.6 - cpu.gameScore * 0.3);
}

// 단일 용도 하나에 대한 CPU 적합도. 브랜드(Intel/AMD)는 어떤 분기에도 등장하지 않는다 — 오직
// gamingScore(gameScore)/multiCoreScore/singleCoreScore/efficiencyScore/hasIntegratedGraphics(igpu)
// 같은 성능 특성만으로 순위가 갈린다.
function singlePurposeCpuFitScore(cpu: CPU, purpose: Purpose): number {
  switch (purpose) {
    case "gaming":
      // 게이밍 벤치마크(gameScore) 기준 — 3D V-Cache 계열(9800X3D/7800X3D 등)이 이미 이 점수에서
      // 최상위권으로 반영돼 있다.
      return cpu.gameScore;
    case "work":
      return cpuOfficeFitScore(cpu);
    case "video":
    case "stream":
    case "ai":
    case "dev":
      // 영상/방송/AI/개발 — 인코딩·렌더링·컴파일·다중 스트림 처리처럼 병렬화가 잘 되는 작업 위주라
      // 멀티코어 성능이 핵심 신호다.
      return cpu.multiCoreScore;
    case "cad":
      // 건축/3D/CAD — 뷰포트 조작(싱글코어 의존)과 렌더링(멀티코어 의존)을 둘 다 하므로 균형(가중평균).
      return cpu.singleCoreScore * 0.5 + cpu.multiCoreScore * 0.5;
    case "etc":
      // 직접 입력한 기타 용도는 특정 워크로드로 단정할 수 없어 게임/멀티코어의 중간값을 쓴다.
      return (cpu.gameScore + cpu.multiCoreScore) / 2;
  }
}

/**
 * 여러 용도가 동시에 선택됐을 때(BuildContext의 purposes[])는 각 용도별 적합도의 가중 평균으로
 * CPU 후보 우선순위를 매긴다(선택된 용도마다 동일 가중치 — 특정 용도를 더 중요하게 취급할 근거가
 * 없으므로 단순 평균이 "가중 평균"의 가장 공정한 기본형이다). 이 점수는 (1) selectDiverseCpuPool의
 * 예산 티어별 후보 선별과 (2) buildCandidate의 baseScore CPU 항목 양쪽에 쓰여, 예산 필터링 이후의
 * 최종 정렬에도 반영된다.
 */
export function cpuPurposeFitScore(cpu: CPU, purposes: Purpose[]): number {
  if (purposes.length === 0) return singlePurposeCpuFitScore(cpu, "work"); // 시스템 기본 목적(work)과 동일한 폴백
  const total = purposes.reduce((sum, purpose) => sum + singlePurposeCpuFitScore(cpu, purpose), 0);
  return total / purposes.length;
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

// CPU 전용 다양성 풀 — selectDiversePool과 같은 "가격 티어별 상위 N개" 전략을 쓰되, 정렬 기준이
// purposeScore(단일 목적 3분류)가 아니라 cpuPurposeFitScore(선택된 모든 목적의 가중 평균, CPU
// 고유의 singleCore/multiCore/efficiency/hasIntegratedGraphics까지 반영)다. selectDiversePool은
// GPU 등 다른 부품군에서 그대로 쓰이므로 시그니처를 바꾸지 않고 별도 함수로 둔다.
export function selectDiverseCpuPool(cpus: CPU[], purposes: Purpose[], limitPerTier: number): CPU[] {
  const pool: CPU[] = [];
  for (const tier of PRICE_TIERS) {
    const tierItems = cpus.filter((cpu) => cpu.priceTier === tier);
    const sorted = tierItems.length <= limitPerTier
      ? tierItems
      : [...tierItems].sort((a, b) => cpuPurposeFitScore(b, purposes) - cpuPurposeFitScore(a, purposes)).slice(0, limitPerTier);
    pool.push(...sorted);
  }
  return pool;
}

/**
 * CPU가 보유 부품으로 고정된 경우, 그 CPU와 성능 격차가 커서 compatibilityScore가 "치명적
 * 병목" 경고(CPU_GPU_GAP_LARGE 초과)를 붙일 GPU는 애초에 신규 구매 후보에도 올리지 않는다 —
 * "병목이 심각하다"고 경고하면서 동시에 그 조합을 추천하는 자기모순을 막는다. 격차 기준 안에
 * 드는 GPU가 하나도 없으면(예: 아주 오래된 저성능 CPU를 보유한 경우) 빈 결과보다는 나으므로
 * 격차 제한 없이 세대 제한만 적용한 풀로 폴백한다.
 */
function selectGpuPoolForOwnedCpu(cpu: CPU, genEligibleGpus: GPU[], purpose: Purpose): GPU[] {
  const withinBottleneckMargin = genEligibleGpus.filter((gpu) => Math.abs(cpu.gameScore - gpu.gameScore) <= CPU_GPU_GAP_LARGE);
  const candidates = withinBottleneckMargin.length > 0 ? withinBottleneckMargin : genEligibleGpus;
  return selectDiversePool(candidates, purpose, GPU_POOL_PER_TIER);
}

/**
 * 위 selectGpuPoolForOwnedCpu의 대칭 케이스 — GPU가 보유 부품으로 고정된 경우, 그 GPU와
 * 병목이 나는 CPU는 신규 구매 후보에서 배제한다. 이 대칭 케이스가 없으면(GPU 보유 고정 + CPU
 * 자유 선택 상태에서), CPU 풀은 순수 목적 적합도로만 뽑혀 병목 걱정 없이 최고 성능 CPU를
 * 골라버린다 — 특히 gameScore가 낮은 GPU(예: 전문가용 GPU를 보유 부품으로 지정한 경우)와
 * 짝지어지면 compatibilityScore가 <70으로 떨어져 결과가 통째로 사라지는 문제로 실제 이어졌다.
 */
function selectCpuPoolForOwnedGpu(gpu: GPU, genEligibleCpus: CPU[], purposes: Purpose[]): CPU[] {
  const withinBottleneckMargin = genEligibleCpus.filter((cpu) => Math.abs(cpu.gameScore - gpu.gameScore) <= CPU_GPU_GAP_LARGE);
  const candidates = withinBottleneckMargin.length > 0 ? withinBottleneckMargin : genEligibleCpus;
  return selectDiverseCpuPool(candidates, purposes, CPU_POOL_PER_TIER);
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
  preferredBudgetTarget: number | null = null,
  // 동시에 선택된 모든 용도(BuildContext의 purposes[]) — CPU 후보 선별/정렬에서만 purpose(대표
  // 목적 하나) 대신 이 배열 전체의 가중 평균(cpuPurposeFitScore)을 쓴다. 주어지지 않으면 대표
  // 목적 하나짜리 배열로 취급해 기존 동작과 동일하게 폴백한다.
  purposes: Purpose[] = [purpose]
): RecommendationResult[] {
  // /build 2단계에서 "보유 중"으로 체크하고 모델까지 지정한 부품은 새로 사는 후보군에서
  // 완전히 자유롭게 재최적화하는 대신 이 값 하나로 고정한다 — 후보 풀 자체를 [보유 부품]
  // 싱글턴으로 좁히면, 아래 기존 소켓/DDR 호환성 캐스케이드(mbsBySocketDdr/ramsByDdr)가
  // 그대로 "나머지 부품이 보유 부품과 호환되는가"까지 자동으로 처리해준다(예: DDR4 RAM을
  // 보유 중이면 DDR5 전용 CPU는 ramsToUse가 비어 자연히 후보에서 빠진다).
  const owned = resolveOwnedParts(existingParts, { cpus, gpus, rams, ssds, motherboards: mbs });

  // 신규 구매 후보군에서만 구형 세대를 제외한다(보유 부품 고정 경로는 resolveOwnedParts가
  // 전 세대 카탈로그를 그대로 검색하므로 이 필터와 무관하게 계속 인식된다).
  const cpuGenEligible = cpus.filter(isNewPurchaseEligibleCpu);
  let gpuGenEligible = gpus.filter(isNewPurchaseEligibleGpu);

  // 게임 용도 신규 구매 후보에서는 전문가용(워크스테이션) GPU를 아예 배제한다 — VRAM/TGP가
  // 넉넉해도 게임 최적화 드라이버·게임 검증이 없는 제품이라 gameScore를 아무리 정확히
  // 추정해도(hardwareScoring.ts의 워크스테이션 감점 참고) "게임용으로 설계·검증된 제품"이라는
  // 사실 자체는 숫자 하나로 완전히 대체되지 않는다. CAD/영상/AI 등 다른 용도에서는 오히려
  // 전문가용 카드가 강점이 될 수 있어 배제하지 않는다 — 게임 용도에서만 적용한다.
  if (purpose === "gaming") {
    gpuGenEligible = gpuGenEligible.filter((gpu) => !isWorkstationGpuModel(gpu.name));
  }

  const cpuPool = owned.cpu
    ? [owned.cpu]
    : owned.gpu
      ? selectCpuPoolForOwnedGpu(owned.gpu, cpuGenEligible, purposes)
      : selectDiverseCpuPool(cpuGenEligible, purposes, CPU_POOL_PER_TIER);
  const gpuPool = owned.gpu
    ? [owned.gpu]
    : owned.cpu
      ? selectGpuPoolForOwnedCpu(owned.cpu, gpuGenEligible, purpose)
      : selectDiversePool(gpuGenEligible, purpose, GPU_POOL_PER_TIER);
  const ramCandidates = owned.ram ? [owned.ram] : rams;
  const mbCandidates = owned.motherboard ? [owned.motherboard] : mbs;

  // 정책: SSD는 보유 중이 아니면 항상 512GB 한 등급으로 고정(예산/견적 성격과 무관) — 더 이상
  // "여러 SSD 후보 중 점수로 고르기"가 아니라 cpu/gpu와 무관하게 결정된 값 하나이므로 루프
  // 차원 자체가 필요 없다.
  const ssd = owned.ssd ?? selectFixedSsd(ssds);
  if (!ssd) return [];

  const mbsBySocketDdr = groupMotherboardsBySocketAndDdr(mbCandidates);
  const mbsBySocket = new Map<string, MotherBoard[]>();
  for (const mb of mbCandidates) {
    const bucket = mbsBySocket.get(mb.socket);
    if (bucket) bucket.push(mb);
    else mbsBySocket.set(mb.socket, [mb]);
  }
  const ramsByDdr = groupRamsByDdr(ramCandidates);

  // buildKey(핵심 부품 조합: cpu+gpu+mb+psu)와 gpu.id, 원시 성능점수를 함께 추적해
  // 최종 랭킹 단계에서 결정적 동점자 비교 + 완전 중복 제거 + GPU 편중 완화 필터를 적용한다.
  const pool: RankedCandidate[] = [];

  for (const cpu of cpuPool) {
    const motherboardsToUse = mbsBySocketDdr.get(`${cpu.socket}|${cpu.ddr}`) ?? mbsBySocket.get(cpu.socket) ?? [];
    const ramsToUse = ramsByDdr.get(cpu.ddr) ?? [];
    if (motherboardsToUse.length === 0 || ramsToUse.length === 0) continue;

    for (const gpu of gpuPool) {
      // cpu+gpu 조합만으로 이미 전력 요구치가 보유 파워를 넘으면 ram/mb까지 내려갈 필요가 없다.
      const powerLimit = owned.psuWattage;
      if (powerLimit && powerLimit < cpu.tdp + gpu.tgp + 150) continue;

      // 정책: 파워는 cpu+gpu 조합이 정해지는 순간 결정적으로 하나만 고른다(선택 로직은
      // selectRecommendedPsu 참고 — 필요 전력의 1.3~1.5배 안전마진 안에서 가장 작은 것).
      // 더 이상 "여러 PSU 후보 중 전략별로 다른 걸 고르기"가 불가능해, 균형/가성비/고성능
      // 세 카드가 같은 cpu+gpu를 쓰면 파워도 항상 같은 등급이 된다.
      const psu = owned.psuWattage !== null ? buildOwnedPsuRepresentative(owned.psuWattage, psus) : selectRecommendedPsu(cpu, gpu, psus);
      if (!psu) continue; // 카탈로그에 이 조합을 감당할 파워가 전혀 없음(극단적 사양 조합)
      // 보유 파워도 예외 없이 이 하드 컷을 받는다(전력 부족은 품질 문제가 아니라 실사용 불가 문제).
      if (psu.wattage < cpu.tdp + gpu.tgp + 150) continue;

      // 결정적 동점자 비교용 원시 성능점수 — buildCandidate 내부의 cpuScore/gpuScore 산출식과 동일하다.
      const cpuBench = getCpuBenchmark(cpu.id);
      const gpuBench = getGpuBenchmark(gpu.id);
      const benchKey = purpose === "gaming" ? "game" : purpose === "ai" ? "ai" : "work";
      const cpuScore = (cpuBench as { game?: number; work?: number; ai?: number })[benchKey] ?? cpu.gameScore;
      const gpuScore = (gpuBench as { game?: number; work?: number; ai?: number })[benchKey] ?? gpu.gameScore;

      // 메인보드 품질 하한선 — CPU TDP가 높을수록(=발열/전력 부하가 큰 CPU) 검증된 VRM
      // 설계의 보드만 허용한다. qualityScore 없는 레거시 항목은 하한선 적용 없이 통과.
      // 단, 이미 보유 중인 메인보드는 "새로 살 보드 추천"이 아니므로 이 품질 하한선을 적용하지
      // 않는다 — 적용하면 사용자가 이미 갖고 있는 보드가 단지 등급이 낮다는 이유로 결과 자체가
      // 통째로 사라져버린다.
      const minBoardQuality = cpu.tdp >= 150 ? 78 : cpu.tdp >= 100 ? 65 : 0;

      for (const ram of ramsToUse) {
        for (const mb of motherboardsToUse) {
          if (mb.ddr !== ram.ddr) continue;
          if (!owned.motherboard && typeof mb.qualityScore === "number" && mb.qualityScore < minBoardQuality) continue;

          const built = buildCandidate(cpu, gpu, ram, ssd, mb, psu, purpose, budgetTarget, existingParts, caseOwnership, budgetMin, purposes, owned);
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

// "정확한 금액 입력" 모드에서 세 전략(균형/가성비/최고성능) 모두가 지켜야 하는 하드 필터 —
// target±EXACT_BUDGET_TOLERANCE 밖의 후보는 finalScore가 아무리 높아도 절대 뽑히지 않는다.
// value/performance 전략은 원래 가격 상한을 신경 쓰지 않거나(가성비는 순수 점수/가격비만,
// 최고성능은 훨씬 느슨한 PERFORMANCE_BUDGET_FACTOR_FLOOR만 봄) 느슨한 소프트 페널티만 거쳤던
// 게 "정확한 금액"이라면서 실제로는 최대 76만원까지 벗어나는 결과를 냈던 원인이었다.
function withinExactBudgetEnvelope(rc: RankedCandidate, preferredTarget: number): boolean {
  return !isPlaceholderPrice(rc.candidate.totalPrice) && Math.abs(rc.candidate.totalPrice - preferredTarget) <= EXACT_BUDGET_TOLERANCE;
}

function selectTopByStrategy(pool: RankedCandidate[], budgetTarget: number | null, preferredTarget: number | null = null): RecommendationResult[] {
  const usedCpuIds = new Set<string>();
  const usedGpuIds = new Set<string>();
  const usedBuildKeys = new Set<string>();
  const result: RecommendationResult[] = [];

  for (const strategy of STRATEGIES) {
    let picked: RankedCandidate | undefined;

    if (preferredTarget !== null) {
      // 예산 약속을 지키는 게 다양성/폴백보다 우선이라, 이 필터를 통과 못 하면 그 슬롯은 그냥
      // 비운다 — 아래(무필터) 폴백으로 넘어가지 않는다. 넘어가면 이 기능이 고치려는 바로 그
      // 버그(범위 밖 결과)가 재발한다.
      picked = pickBestForStrategy(pool, strategy, usedCpuIds, usedGpuIds, usedBuildKeys, preferredTarget, (rc) =>
        withinExactBudgetEnvelope(rc, preferredTarget)
      );
    } else {
      if (strategy === "performance" && budgetTarget) {
        const withinEnvelope = (rc: RankedCandidate) => computeBudgetFactor(rc.candidate.totalPrice, budgetTarget) >= PERFORMANCE_BUDGET_FACTOR_FLOOR;
        picked = pickBestForStrategy(pool, strategy, usedCpuIds, usedGpuIds, usedBuildKeys, preferredTarget, withinEnvelope);
      }
      if (!picked) {
        picked = pickBestForStrategy(pool, strategy, usedCpuIds, usedGpuIds, usedBuildKeys, preferredTarget);
      }
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
  budgetMin: number | null,
  // 동시에 선택된 모든 용도 — CPU 항목(baseScore)에만 쓰인다(용도별 CPU 추천 후보군 로직).
  purposes: Purpose[] = [purpose],
  // 보유 부품으로 고정된 항목 — 가격을 0으로 제외하고 "보유 중" 표시를 붙이는 데 쓴다.
  owned: ResolvedOwnedParts = { cpu: null, gpu: null, ram: null, ssd: null, motherboard: null, psuWattage: null }
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

  const gpuBench = getGpuBenchmark(gpu.id);

  // CPU 항목은 getCpuBenchmark(과거엔 커버리지가 거의 없어 항상 cpu.gameScore로만 폴백되던 값)
  // 대신 cpuPurposeFitScore를 쓴다 — 선택된 모든 용도의 가중 평균으로, singleCore/multiCore/
  // efficiency/hasIntegratedGraphics까지 반영해 baseScore(→ finalScore → 최종 정렬)를 구동한다.
  const cpuScore = cpuPurposeFitScore(cpu, purposes);
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

  // compatibilityScoreVal은 여태 <70 하드컷에만 쓰이고 랭킹에는 전혀 반영되지 않았다 — 그 결과
  // "CPU와 GPU 성능 밸런스가 약간 맞지 않습니다" 같은 경고(-10점, 90점으로 컷은 통과)가 붙은
  // 조합도 경고 없는 조합과 순위상 완전히 동점으로 취급돼 TOP3에 그대로 섞여 나왔다. 비율로
  // 곱해 넣어 경고가 있으면 그만큼 감점되게 하고, 더 깔끔한 대안이 있으면 자연히 밀려나게 한다.
  const normalizedBaseScore = (baseScore * 0.88 + recency * 0.12) * (compatibilityScoreVal / 100);

  // 보유 중으로 고정된 항목은 새로 사지 않으므로 가격을 0으로 제외한다(케이스가 이미 이 패턴 —
  // caseOwnership === "owned" ? 0 : CASE_PRICE — 을 쓰고 있어 그대로 확장했다).
  const isOwnedCpu = owned.cpu?.id === cpu.id;
  const isOwnedGpu = owned.gpu?.id === gpu.id;
  const isOwnedRam = owned.ram?.id === ram.id;
  const isOwnedSsd = owned.ssd?.id === ssd.id;
  const isOwnedMotherboard = owned.motherboard?.id === mb.id;
  const isOwnedPsu = owned.psuWattage !== null;

  const cpuPrice = isOwnedCpu ? 0 : priceTierToPrice[cpu.priceTier] ?? 0;
  const gpuPrice = isOwnedGpu ? 0 : priceTierToPrice[gpu.priceTier] ?? 0;
  // RAM은 모든 카탈로그 항목에 실거래가(price)가 있으므로 그걸 그대로 쓴다 — priceTier 폴백을
  // 쓰면 8GB든 64GB든 같은 티어면 같은 가격이 나오는 문제가 있었다(예: 32GB DDR5가 50만원).
  const ramPrice = isOwnedRam ? 0 : ram.price;
  const ssdPrice = isOwnedSsd ? 0 : priceTierToPrice[ssd.priceTier] ?? 0;
  // hardwareSeed.ts 병합분은 priceTier 대신 실거래가(price)를 들고 있다 — 있으면 우선 사용.
  const motherboardPrice = isOwnedMotherboard ? 0 : mb.price ?? (mb.priceTier ? priceTierToPrice[mb.priceTier] : 0) ?? 0;
  const psuPrice = isOwnedPsu ? 0 : psu.price ?? (psu.priceTier ? priceTierToPrice[psu.priceTier] : 0) ?? 0;
  const casePrice = caseOwnership === "owned" ? 0 : CASE_PRICE;

  const ownedTag = (isOwned: boolean, name: string) => (isOwned ? `${name} (보유 중)` : name);

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
    ram: ram.name,
    ssd: `${ssd.capacity}GB ${ssd.interface}`,
    motherboard: mb.name,
    power: isOwnedPsu ? `${psu.wattage}W 보유 파워` : `${psu.wattage}W 추천 파워`,
    case: caseOwnership === "owned" ? "보유 케이스 사용" : "신규 케이스 포함",
    totalPrice,
    casePrice,
    partIds: { cpu: cpu.id, gpu: gpu.id, ram: ram.id, ssd: ssd.id, motherboard: mb.id, psuWattage: psu.wattage },
    ownedParts: {
      cpu: isOwnedCpu,
      gpu: isOwnedGpu,
      ram: isOwnedRam,
      ssd: isOwnedSsd,
      motherboard: isOwnedMotherboard,
      psu: isOwnedPsu,
    },
    parts: [
      { label: "CPU", name: ownedTag(isOwnedCpu, cpu.name), price: cpuPrice },
      { label: "GPU", name: ownedTag(isOwnedGpu, gpu.name), price: gpuPrice },
      { label: "RAM", name: ownedTag(isOwnedRam, ram.name), price: ramPrice },
      { label: "SSD", name: ownedTag(isOwnedSsd, `${ssd.capacity}GB ${ssd.interface}`), price: ssdPrice },
      { label: "메인보드", name: ownedTag(isOwnedMotherboard, mb.name), price: motherboardPrice },
      { label: "파워", name: isOwnedPsu ? `${psu.wattage}W 보유 파워` : `${psu.wattage}W ${psu.name}`, price: psuPrice },
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
    reason: createReason(finalScore, compatibilityScoreVal, caseOwnership, purpose),
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
  // "정확한 금액 입력"이 target±EXACT_BUDGET_TOLERANCE range로 변환돼 위 budgetRange 경로를
  // 타되, 세 전략(균형/가성비/최고성능) 모두 selectTopByStrategy의 withinExactBudgetEnvelope
  // 하드 필터로 이 값과의 차이가 EXACT_BUDGET_TOLERANCE 이내인 후보만 채택한다.
  preferredBudgetTarget?: number | null
): RecommendationResult[] {
  const purpose = pickPurpose(answers, purposes);
  const budgetTarget = budgetRange ? budgetRange.max : pickBudgetTarget(answers);
  const budgetMin = budgetRange?.min ?? null;
  // CPU 후보 선별/정렬엔 대표 목적 하나(purpose)가 아니라 동시에 선택된 용도 전체를 쓴다 —
  // purposes[]가 없을 때만(answers[1] 문자열 파싱 경로 등) 대표 목적 하나짜리로 폴백한다.
  const effectivePurposes: Purpose[] = purposes && purposes.length > 0 ? purposes : [purpose];

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
    preferredBudgetTarget ?? null,
    effectivePurposes
  );
}

// "정확한 금액 입력"의 target±EXACT_BUDGET_TOLERANCE 안에서 구성 가능한 조합이 하나도 없을 때
// (recommend()가 빈 배열을 반환할 때), "OO만원 이상을 권장해요" 안내에 쓸 참고값을 찾는다.
// 예산 제약을 완전히 걷어내고 같은 용도/보유부품/케이스 조건에서 만들 수 있는 가장 저렴한 유효
// 조합의 총액을 반환한다 — 만들 수 있는 조합 자체가 없으면(예: 보유 부품끼리 호환 불가) null.
export function findCheapestViableTotalPrice(
  answers: Answers,
  existingParts: ExistingPartsState,
  caseOwnership: CaseOwnershipOption = "owned",
  purposes?: PurposeType[]
): number | null {
  const purpose = pickPurpose(answers, purposes);
  const effectivePurposes: Purpose[] = purposes && purposes.length > 0 ? purposes : [purpose];

  const unconstrained = generateCandidates(
    _cpus,
    _gpus,
    _rams,
    _ssds,
    _motherboards,
    _psus,
    purpose,
    null, // budgetTarget
    existingParts,
    caseOwnership,
    null, // budgetMin
    null, // preferredBudgetTarget
    effectivePurposes
  );

  const prices = unconstrained.map((r) => r.totalPrice).filter((p) => !isPlaceholderPrice(p));
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export { recommend as default };