/**
 * 40개 대표 워크로드(게임 20 + 전문/AI 앱 20) 예상 성능 점수 산출.
 *
 * app/database/cpu.ts, gpu.ts의 gameScore/workScore/aiScore는 이미 curated 앵커 +
 * hardwareScoring.ts 회귀 추정으로 검증된 유일한 "성능 점수" 소스다(하드웨어 마스터 데이터에는
 * RT코어 수, 텐서코어 수, 메모리 대역폭 같은 세부 아키텍처 스펙이 없음 - hardwareMasterDb.ts 상단
 * 주석 참고). 이 파일은 그 3축 점수를 워크로드별 가중치로 재조합해 40개 프로그램 점수를 추정하며,
 * CUDA 전용 여부·VRAM 용량·레이트레이싱 지원 같은 "실제로 DB에 있는" 필드만으로 페널티를 적용한다.
 */
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";

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
}

export const WORKLOADS: Workload[] = [
  // ══════════════ 게임 20 (weights: cpuGame + gpuGame = 1.0) ══════════════
  { id: "lol", label: "리그 오브 레전드", category: "게임/CPU클럭", weights: { cpuGame: 0.7, gpuGame: 0.3 } },
  { id: "valorant", label: "발로란트", category: "게임/CPU클럭", weights: { cpuGame: 0.75, gpuGame: 0.25 } },
  { id: "ow2", label: "오버워치 2", category: "게임/CPU클럭", weights: { cpuGame: 0.65, gpuGame: 0.35 } },
  { id: "fconline", label: "FC 온라인", category: "게임/CPU클럭", weights: { cpuGame: 0.68, gpuGame: 0.32 } },
  { id: "sudden", label: "서든어택", category: "게임/CPU클럭", weights: { cpuGame: 0.72, gpuGame: 0.28 } },

  { id: "pubg", label: "배틀그라운드", category: "게임/멀티코어", weights: { cpuGame: 0.5, gpuGame: 0.5 } },
  { id: "lostark", label: "로스트아크", category: "게임/멀티코어", weights: { cpuGame: 0.55, gpuGame: 0.45 } },
  { id: "wow", label: "월드 오브 워크래프트", category: "게임/멀티코어", weights: { cpuGame: 0.55, gpuGame: 0.45 } },
  { id: "maple", label: "메이플스토리", category: "게임/멀티코어", weights: { cpuGame: 0.6, gpuGame: 0.4 } },
  { id: "dnf", label: "던전앤파이터", category: "게임/멀티코어", weights: { cpuGame: 0.6, gpuGame: 0.4 } },

  { id: "rdr2", label: "레드 데드 리뎀션 2", category: "게임/GPU래스터", weights: { cpuGame: 0.25, gpuGame: 0.75 }, vramFloorGB: 8 },
  { id: "mhwilds", label: "몬스터 헌터 와일즈", category: "게임/GPU래스터", weights: { cpuGame: 0.22, gpuGame: 0.78 }, vramFloorGB: 10 },
  { id: "bdo", label: "검은사막", category: "게임/GPU래스터", weights: { cpuGame: 0.28, gpuGame: 0.72 }, vramFloorGB: 8 },
  { id: "valhalla", label: "어쌔신 크리드 발할라", category: "게임/GPU래스터", weights: { cpuGame: 0.25, gpuGame: 0.75 }, vramFloorGB: 8 },
  { id: "gta5", label: "GTA 5", category: "게임/GPU래스터", weights: { cpuGame: 0.35, gpuGame: 0.65 }, vramFloorGB: 6 },

  { id: "cyberpunk", label: "사이버펑크 2077", category: "게임/RT", weights: { cpuGame: 0.15, gpuGame: 0.85 }, rtRequired: true, vramFloorGB: 8 },
  { id: "witcher3", label: "위쳐 3 차세대", category: "게임/RT", weights: { cpuGame: 0.15, gpuGame: 0.85 }, rtRequired: true, vramFloorGB: 8 },
  { id: "horizon", label: "호라이즌 포비든 웨스트", category: "게임/RT", weights: { cpuGame: 0.2, gpuGame: 0.8 }, rtRequired: true, vramFloorGB: 8 },
  { id: "forza5", label: "포르자 호라이즌 5", category: "게임/RT", weights: { cpuGame: 0.22, gpuGame: 0.78 }, rtRequired: true, vramFloorGB: 8 },
  { id: "avatar", label: "아바타: 프론티어 오브 판도라", category: "게임/RT", weights: { cpuGame: 0.15, gpuGame: 0.85 }, rtRequired: true, vramFloorGB: 12 },

  // ══════════════ 전문/AI 20 (weights: cpuWork + gpuWork + gpuAi = 1.0) ══════════════
  { id: "premiere", label: "어도비 프리미어 프로", category: "영상/VFX", weights: { cpuWork: 0.45, gpuWork: 0.4, gpuAi: 0.15 }, vramFloorGB: 8 },
  { id: "davinci", label: "다빈치 리졸브", category: "영상/VFX", weights: { cpuWork: 0.25, gpuWork: 0.55, gpuAi: 0.2 }, vramFloorGB: 8 },
  { id: "aftereffects", label: "어도비 애프터 이펙트", category: "영상/VFX", weights: { cpuWork: 0.65, gpuWork: 0.25, gpuAi: 0.1 }, vramFloorGB: 6 },
  { id: "finalcut", label: "파이널 컷 프로", category: "영상/VFX", weights: { cpuWork: 0.4, gpuWork: 0.5, gpuAi: 0.1 }, vramFloorGB: 6 },
  { id: "vegas", label: "소니 베가스 프로", category: "영상/VFX", weights: { cpuWork: 0.55, gpuWork: 0.4, gpuAi: 0.05 } },

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
  },
  {
    id: "stablediff",
    label: "스테이블 디퓨전",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.15, gpuWork: 0.3, gpuAi: 0.55 },
    requiresCUDA: true,
    vramFloorGB: 6,
  },
  {
    id: "ollama",
    label: "올라마 (Local LLM)",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.3, gpuWork: 0.2, gpuAi: 0.5 },
    requiresCUDA: true,
    vramFloorGB: 8,
  },
  {
    id: "tensorflow",
    label: "텐서플로",
    category: "AI/딥러닝",
    weights: { cpuWork: 0.15, gpuWork: 0.25, gpuAi: 0.6 },
    requiresCUDA: true,
    vramFloorGB: 8,
  },
  { id: "jupyter", label: "아나콘다/주피터 노트북", category: "AI/딥러닝", weights: { cpuWork: 0.55, gpuWork: 0.15, gpuAi: 0.3 } },
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

export function scoreWorkload(cpu: CPU, gpu: GPU, wl: Workload): WorkloadScore {
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

  return {
    id: wl.id,
    label: wl.label,
    category: wl.category,
    score: Math.round(clamp(score, 0, 100)),
    penalties,
  };
}

/** CPU/GPU 한 쌍에 대해 40개 워크로드 전부 스코어링 */
export function scoreAllWorkloads(cpu: CPU, gpu: GPU): WorkloadScore[] {
  return WORKLOADS.map((wl) => scoreWorkload(cpu, gpu, wl));
}

/** 카테고리별 평균으로 그룹핑 (요약 리포트용) */
export function scoreWorkloadsByCategory(cpu: CPU, gpu: GPU): Record<string, number> {
  const all = scoreAllWorkloads(cpu, gpu);
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

// 해상도/주사율별 프레임 방어 판정 레이어(displayMatch.ts)를 이 모듈 경로로도 재노출.
// WORKLOADS의 게임 카테고리 문자열("게임/CPU클럭" 등)은 displayMatch.ts의 CATEGORY_PROFILE 키와 1:1로 맞춰져 있다.
export * from "./displayMatch";
