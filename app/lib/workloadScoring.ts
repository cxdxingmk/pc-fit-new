/**
 * 40개 대표 워크로드(게임 20 + 전문/AI 앱 20) 예상 성능 점수 산출.
 *
 * app/database/cpu.ts, gpu.ts의 gameScore/workScore/aiScore는 이미 curated 앵커 +
 * hardwareScoring.ts 회귀 추정으로 검증된 유일한 "성능 점수" 소스다(하드웨어 마스터 데이터에는
 * RT코어 수, 텐서코어 수, 메모리 대역폭 같은 세부 아키텍처 스펙이 없음 - hardwareMasterDb.ts 상단
 * 주석 참고). 이 파일은 그 3축 점수를 워크로드별 가중치로 재조합해 40개 프로그램 점수를 추정하며,
 * CUDA 전용 여부·VRAM 용량·레이트레이싱 지원 같은 "실제로 DB에 있는" 필드만으로 페널티를 적용한다.
 */
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import { evaluateDisplayMatch, type Resolution, type RefreshRate } from "./displayMatch";

const CUDA_PENALTY = 0.5;
const RT_UNSUPPORTED_PENALTY = 0.85;

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));

export type WorkloadWeights = {
  cpuGame?: number;
  cpuWork?: number;
  gpuGame?: number;
  gpuWork?: number;
  gpuAi?: number;
};

export interface Workload {
  id: string;
  label: string;
  category: string;
  weights: WorkloadWeights; // 합 = 1.0
  requiresCUDA?: boolean;
  cudaPenalty?: number; // 기본 CUDA_PENALTY
  rtRequired?: boolean;
  vramFloorGB?: number; // 미달 시 clamp(vram/floor, 0.3, 1.0) 비례 감점
  /** 미달 시 감점 적용할 시스템 RAM 권장 용량(GB). AI/영상 워크로드처럼 RAM 의존도가
   *  실제로 큰 카테고리에만 붙인다 — GPU VRAM과는 별개로 "시스템 메모리"를 본다. */
  ramFloorGB?: number;
  /** ramFloorGB 미달 시 감점의 하한 배율 — 낮을수록 감점이 세다(AI < 영상). 기본 0.7 */
  ramPenaltyFloor?: number;
  /**
   * 기준 사양(REFERENCE_CPU_ID + REFERENCE_GPU_ID, QHD)에서의 실측 근사 fps.
   * TODO(실측 반영): 아래 값들은 보수적 추정 placeholder이며 실측 벤치마크로 교체가 필요하다.
   * 특히 e스포츠 게임(롤/발로란트/오버워치2)은 프레임 제한 없이 설정하면 이 기준 사양에서
   * 수백 fps를 훌쩍 넘기는 게 일반적이라, 현재 모델이 자체적으로 뽑아내는 값(약 250~260대)보다
   * 훨씬 높게 잡아야 한다. anchorCorrectedFps()가 이 값과 모델 자체 추정치의 비율만큼
   * 전체 곡선을 비례 보정한다.
   */
  anchorFps?: number;
}

export const WORKLOADS: Workload[] = [
  // ══════════════ 게임 20 (weights: cpuGame + gpuGame = 1.0) ══════════════
  { id: "lol", label: "리그 오브 레전드", category: "게임/CPU클럭", weights: { cpuGame: 0.7, gpuGame: 0.3 }, anchorFps: 450 },
  { id: "valorant", label: "발로란트", category: "게임/CPU클럭", weights: { cpuGame: 0.75, gpuGame: 0.25 }, anchorFps: 500 },
  { id: "ow2", label: "오버워치 2", category: "게임/CPU클럭", weights: { cpuGame: 0.65, gpuGame: 0.35 }, anchorFps: 400 },
  { id: "fconline", label: "FC 온라인", category: "게임/CPU클럭", weights: { cpuGame: 0.68, gpuGame: 0.32 } },
  { id: "sudden", label: "서든어택", category: "게임/CPU클럭", weights: { cpuGame: 0.72, gpuGame: 0.28 } },

  { id: "pubg", label: "배틀그라운드", category: "게임/멀티코어", weights: { cpuGame: 0.5, gpuGame: 0.5 }, anchorFps: 180 },
  { id: "lostark", label: "로스트아크", category: "게임/멀티코어", weights: { cpuGame: 0.55, gpuGame: 0.45 } },
  { id: "wow", label: "월드 오브 워크래프트", category: "게임/멀티코어", weights: { cpuGame: 0.55, gpuGame: 0.45 } },
  { id: "maple", label: "메이플스토리", category: "게임/멀티코어", weights: { cpuGame: 0.6, gpuGame: 0.4 } },
  { id: "dnf", label: "던전앤파이터", category: "게임/멀티코어", weights: { cpuGame: 0.6, gpuGame: 0.4 } },

  { id: "rdr2", label: "레드 데드 리뎀션 2", category: "게임/GPU래스터", weights: { cpuGame: 0.25, gpuGame: 0.75 }, vramFloorGB: 8 },
  { id: "mhwilds", label: "몬스터 헌터 와일즈", category: "게임/GPU래스터", weights: { cpuGame: 0.22, gpuGame: 0.78 }, vramFloorGB: 10 },
  { id: "bdo", label: "검은사막", category: "게임/GPU래스터", weights: { cpuGame: 0.28, gpuGame: 0.72 }, vramFloorGB: 8 },
  { id: "valhalla", label: "어쌔신 크리드 발할라", category: "게임/GPU래스터", weights: { cpuGame: 0.25, gpuGame: 0.75 }, vramFloorGB: 8 },
  { id: "gta5", label: "GTA 5", category: "게임/GPU래스터", weights: { cpuGame: 0.35, gpuGame: 0.65 }, vramFloorGB: 6 },

  { id: "cyberpunk", label: "사이버펑크 2077", category: "게임/RT", weights: { cpuGame: 0.15, gpuGame: 0.85 }, rtRequired: true, vramFloorGB: 8, anchorFps: 95 },
  { id: "witcher3", label: "위쳐 3 차세대", category: "게임/RT", weights: { cpuGame: 0.15, gpuGame: 0.85 }, rtRequired: true, vramFloorGB: 8 },
  { id: "horizon", label: "호라이즌 포비든 웨스트", category: "게임/RT", weights: { cpuGame: 0.2, gpuGame: 0.8 }, rtRequired: true, vramFloorGB: 8 },
  { id: "forza5", label: "포르자 호라이즌 5", category: "게임/RT", weights: { cpuGame: 0.22, gpuGame: 0.78 }, rtRequired: true, vramFloorGB: 8 },
  { id: "avatar", label: "아바타: 프론티어 오브 판도라", category: "게임/RT", weights: { cpuGame: 0.15, gpuGame: 0.85 }, rtRequired: true, vramFloorGB: 12 },

  // ══════════════ 전문/AI 20 (weights: cpuWork + gpuWork + gpuAi = 1.0) ══════════════
  // 영상/VFX·AI 워크로드는 시스템 RAM 32GB를 권장선으로 보고, 그 아래에서는 감점한다
  // (ramPenaltyFloor: 영상은 0.75, AI는 0.55 — AI가 RAM 부족에 더 민감).
  { id: "premiere", label: "어도비 프리미어 프로", category: "영상/VFX", weights: { cpuWork: 0.45, gpuWork: 0.4, gpuAi: 0.15 }, vramFloorGB: 8, ramFloorGB: 32, ramPenaltyFloor: 0.75 },
  { id: "davinci", label: "다빈치 리졸브", category: "영상/VFX", weights: { cpuWork: 0.25, gpuWork: 0.55, gpuAi: 0.2 }, vramFloorGB: 8, ramFloorGB: 32, ramPenaltyFloor: 0.75 },
  { id: "aftereffects", label: "어도비 애프터 이펙트", category: "영상/VFX", weights: { cpuWork: 0.65, gpuWork: 0.25, gpuAi: 0.1 }, vramFloorGB: 6, ramFloorGB: 32, ramPenaltyFloor: 0.75 },
  { id: "finalcut", label: "파이널 컷 프로", category: "영상/VFX", weights: { cpuWork: 0.4, gpuWork: 0.5, gpuAi: 0.1 }, vramFloorGB: 6, ramFloorGB: 32, ramPenaltyFloor: 0.75 },
  { id: "vegas", label: "소니 베가스 프로", category: "영상/VFX", weights: { cpuWork: 0.55, gpuWork: 0.4, gpuAi: 0.05 }, ramFloorGB: 32, ramPenaltyFloor: 0.75 },

  { id: "autocad", label: "오토캐드", category: "CAD", weights: { cpuWork: 0.9, gpuWork: 0.1 } },
  { id: "solidworks", label: "솔리드웍스", category: "CAD", weights: { cpuWork: 0.85, gpuWork: 0.15 } },
  { id: "catia", label: "카티아", category: "CAD", weights: { cpuWork: 0.82, gpuWork: 0.18 } },
  { id: "revit", label: "오토데스크 레빗", category: "CAD", weights: { cpuWork: 0.88, gpuWork: 0.12 } },
  { id: "sketchup", label: "스케치업", category: "CAD", weights: { cpuWork: 0.9, gpuWork: 0.1 } },

  { id: "blender", label: "블렌더", category: "렌더링", weights: { cpuWork: 0.45, gpuWork: 0.45, gpuAi: 0.1 }, vramFloorGB: 8 },
  { id: "cinema4d", label: "시네마 4D", category: "렌더링", weights: { cpuWork: 0.6, gpuWork: 0.35, gpuAi: 0.05 } },
  { id: "maxmaya", label: "오토데스크 3ds Max/Maya", category: "렌더링", weights: { cpuWork: 0.6, gpuWork: 0.35, gpuAi: 0.05 } },
  {
    id: "octane",
    label: "옥테인 렌더러",
    category: "렌더링",
    weights: { cpuWork: 0.15, gpuWork: 0.6, gpuAi: 0.25 },
    requiresCUDA: true,
    vramFloorGB: 8,
  },
  { id: "vray", label: "카오스 V-Ray", category: "렌더링", weights: { cpuWork: 0.55, gpuWork: 0.4, gpuAi: 0.05 } },

  {
    id: "pytorch",
    label: "파이토치",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.15, gpuWork: 0.25, gpuAi: 0.6 },
    requiresCUDA: true,
    vramFloorGB: 8,
    ramFloorGB: 32,
    ramPenaltyFloor: 0.55,
  },
  {
    id: "stablediff",
    label: "스테이블 디퓨전",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.15, gpuWork: 0.3, gpuAi: 0.55 },
    requiresCUDA: true,
    vramFloorGB: 6,
    ramFloorGB: 32,
    ramPenaltyFloor: 0.55,
  },
  {
    id: "ollama",
    label: "올라마 (Local LLM)",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.3, gpuWork: 0.2, gpuAi: 0.5 },
    requiresCUDA: true,
    vramFloorGB: 8,
    ramFloorGB: 32,
    ramPenaltyFloor: 0.55,
  },
  {
    id: "tensorflow",
    label: "텐서플로",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.15, gpuWork: 0.25, gpuAi: 0.6 },
    requiresCUDA: true,
    vramFloorGB: 8,
    ramFloorGB: 32,
    ramPenaltyFloor: 0.55,
  },
  {
    id: "jupyter",
    label: "아나콘다/주피터 노트북",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.55, gpuWork: 0.15, gpuAi: 0.3 },
    ramFloorGB: 32,
    ramPenaltyFloor: 0.55,
  },
];

export interface WorkloadScore {
  id: string;
  label: string;
  category: string;
  score: number; // 0~100 (반올림)
  penalties: string[];
}

function weightedScore(cpu: CPU, gpu: GPU, w: WorkloadWeights): number {
  let sum = 0;
  if (w.cpuGame) sum += cpu.gameScore * w.cpuGame;
  if (w.cpuWork) sum += cpu.workScore * w.cpuWork;
  if (w.gpuGame) sum += gpu.gameScore * w.gpuGame;
  if (w.gpuWork) sum += gpu.workScore * w.gpuWork;
  if (w.gpuAi) sum += gpu.aiScore * w.gpuAi;
  return sum;
}

const DEFAULT_RAM_PENALTY_FLOOR = 0.7;

/**
 * @param ramGB 시스템(메인) RAM 총 용량(GB). 생략하면 RAM 감점을 적용하지 않는다
 *   (호출부가 RAM 정보를 안 넘기는 기존 경로와 하위 호환).
 */
export function scoreWorkload(cpu: CPU, gpu: GPU, wl: Workload, ramGB?: number): WorkloadScore {
  let score = weightedScore(cpu, gpu, wl.weights);
  const penalties: string[] = [];

  if (wl.requiresCUDA && gpu.brand !== "NVIDIA") {
    const p = wl.cudaPenalty ?? CUDA_PENALTY;
    score *= p;
    penalties.push(`CUDA 미지원(${gpu.brand}) x${p}`);
  }

  if (wl.rtRequired && !gpu.rayTracing) {
    score *= RT_UNSUPPORTED_PENALTY;
    penalties.push(`레이트레이싱 미지원 x${RT_UNSUPPORTED_PENALTY}`);
  }

  if (wl.vramFloorGB && gpu.vram < wl.vramFloorGB) {
    const m = clamp(gpu.vram / wl.vramFloorGB, 0.3, 1.0);
    score *= m;
    penalties.push(`VRAM ${gpu.vram}GB < ${wl.vramFloorGB}GB 요구 x${m.toFixed(2)}`);
  }

  if (wl.ramFloorGB && typeof ramGB === "number" && ramGB < wl.ramFloorGB) {
    const floor = wl.ramPenaltyFloor ?? DEFAULT_RAM_PENALTY_FLOOR;
    const m = clamp(floor + (1 - floor) * (ramGB / wl.ramFloorGB), floor, 1.0);
    score *= m;
    penalties.push(`RAM ${ramGB}GB < ${wl.ramFloorGB}GB 권장 x${m.toFixed(2)}`);
  }

  return {
    id: wl.id,
    label: wl.label,
    category: wl.category,
    score: Math.round(clamp(score, 0, 100)),
    penalties,
  };
}

/** CPU/GPU 한 쌍에 대해 40개 워크로드 전부 스코어링. ramGB를 넘기면 AI/영상 워크로드에 RAM 감점이 반영된다. */
export function scoreAllWorkloads(cpu: CPU, gpu: GPU, ramGB?: number): WorkloadScore[] {
  return WORKLOADS.map((wl) => scoreWorkload(cpu, gpu, wl, ramGB));
}

/** 카테고리별 평균으로 그룹핑 (요약 리포트용) */
export function scoreWorkloadsByCategory(cpu: CPU, gpu: GPU, ramGB?: number): Record<string, number> {
  const all = scoreAllWorkloads(cpu, gpu, ramGB);
  const buckets: Record<string, number[]> = {};
  for (const r of all) (buckets[r.category] ??= []).push(r.score);
  const out: Record<string, number> = {};
  for (const [category, scores] of Object.entries(buckets)) {
    out[category] = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  return out;
}

/** 무결성 검증: 워크로드별 가중치 합 = 1.0 확인 (빈 배열이면 전부 정상) */
export function validateWorkloadWeights(): { id: string; sum: number }[] {
  const bad: { id: string; sum: number }[] = [];
  for (const wl of WORKLOADS) {
    const sum = Object.values(wl.weights).reduce((a: number, b) => a + (b ?? 0), 0);
    if (Math.abs(sum - 1) > 1e-6) bad.push({ id: wl.id, sum: +sum.toFixed(4) });
  }
  return bad;
}

// ─────────────────────────────────────────────────────────────────────────────
// 앵커 보정 — FPS_CURVE(displayMatch.ts) 기반 추정치의 절대값이 실측과 크게
// 어긋나는 문제(예: 상한 없는 e스포츠 게임의 실측이 모델 추정보다 훨씬 높음)를
// 완화한다. 워크로드별 상대적 우열은 그대로 두고, 기준 사양에서 모델이 뽑는 값과
// anchorFps의 비율만큼 전체 곡선을 비례 스케일링한다.
// ─────────────────────────────────────────────────────────────────────────────
const REFERENCE_CPU_ID = "i9-14900k";
const REFERENCE_GPU_ID = "rtx4070-super";
const REFERENCE_RESOLUTION: Resolution = "QHD";
const REFERENCE_REFRESH: RefreshRate = 240;

/**
 * @param workloadId WORKLOADS의 id (예: "lol"). anchorFps가 없는 워크로드는 원본값을 그대로 반환.
 * @param rawEstimatedFps evaluateDisplayMatch()가 이미 계산한 원본 추정치.
 */
export function anchorCorrectedFps(workloadId: string | undefined, rawEstimatedFps: number | null): number | null {
  if (rawEstimatedFps == null || !workloadId) return rawEstimatedFps;

  const workload = WORKLOADS.find((w) => w.id === workloadId);
  if (!workload?.anchorFps) return rawEstimatedFps;

  const refCpu = cpus.find((c) => c.id === REFERENCE_CPU_ID);
  const refGpu = gpus.find((g) => g.id === REFERENCE_GPU_ID);
  if (!refCpu || !refGpu) return rawEstimatedFps;

  const refScore = scoreWorkload(refCpu, refGpu, workload).score;
  const refResult = evaluateDisplayMatch(refScore, workload.category, REFERENCE_RESOLUTION, REFERENCE_REFRESH);
  if (!refResult.estimatedFps) return rawEstimatedFps;

  const correctionFactor = workload.anchorFps / refResult.estimatedFps;
  return Math.max(1, Math.round(rawEstimatedFps * correctionFactor));
}

// 해상도/주사율별 프레임 방어 판정 레이어(displayMatch.ts)를 이 모듈 경로로도 재노출.
// WORKLOADS의 게임 카테고리 문자열("게임/CPU클럭" 등)은 displayMatch.ts의 CATEGORY_PROFILE 키와 1:1로 맞춰져 있다.
export * from "./displayMatch";
