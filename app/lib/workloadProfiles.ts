/**
 * workloadProfiles.ts — 카테고리별 CPU/GPU 의존도(boundBy) 매핑.
 *
 * workloadScoring.ts의 WORKLOADS가 이미 워크로드별 실측 가중치
 * (cpuGame/cpuWork/gpuGame/gpuWork/gpuAi)를 갖고 있으므로, boundBy를 별도
 * 상수로 손으로 다시 적지 않고 그 가중치에서 자동으로 도출한다 — 두 테이블을
 * 따로 유지하면 WORKLOADS가 바뀔 때 이 표만 조용히 낡아버릴(drift) 위험이 있다.
 */
import { WORKLOADS, type Workload } from "./workloadScoring";

export type BoundBy = "gpu" | "cpu" | "mixed";

export interface WorkloadProfile {
  /** workloadScoring.ts의 category 문자열과 1:1 (예: "게임/CPU클럭", "CAD") */
  name: string;
  boundBy: BoundBy;
  label: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  "게임/CPU클럭": "e스포츠 게임",
  "게임/멀티코어": "MMORPG · 오픈월드",
  "게임/GPU래스터": "고사양 게임",
  "게임/RT": "레이트레이싱 게임",
  "영상/VFX": "영상 편집 · 인코딩",
  CAD: "CAD · 설계",
  렌더링: "3D 렌더링",
  "AI/딥러닝": "AI · 딥러닝",
};

// cpuShare/gpuShare 중 하나가 이 값 이상이면 해당 축에 "바운드"로 분류하고,
// 둘 다 미달이면 어느 한쪽만으로 확정형 수치를 보여주기엔 근거가 부족하다고 보아 "mixed"로 둔다.
const BOUND_THRESHOLD = 0.6;

function weightShare(w: Workload): { cpuShare: number; gpuShare: number } {
  const cpuShare = (w.weights.cpuGame ?? 0) + (w.weights.cpuWork ?? 0);
  const gpuShare = (w.weights.gpuGame ?? 0) + (w.weights.gpuWork ?? 0) + (w.weights.gpuAi ?? 0);
  return { cpuShare, gpuShare };
}

function classify(avgCpuShare: number, avgGpuShare: number): BoundBy {
  if (avgCpuShare >= BOUND_THRESHOLD) return "cpu";
  if (avgGpuShare >= BOUND_THRESHOLD) return "gpu";
  return "mixed";
}

function buildWorkloadProfiles(): WorkloadProfile[] {
  const buckets = new Map<string, Workload[]>();
  for (const wl of WORKLOADS) {
    const list = buckets.get(wl.category) ?? [];
    list.push(wl);
    buckets.set(wl.category, list);
  }

  return Array.from(buckets.entries()).map(([category, items]) => {
    const shares = items.map(weightShare);
    const avgCpuShare = shares.reduce((sum, s) => sum + s.cpuShare, 0) / shares.length;
    const avgGpuShare = shares.reduce((sum, s) => sum + s.gpuShare, 0) / shares.length;

    return {
      name: category,
      boundBy: classify(avgCpuShare, avgGpuShare),
      label: CATEGORY_LABELS[category] ?? category,
    };
  });
}

export const WORKLOAD_PROFILES: WorkloadProfile[] = buildWorkloadProfiles();

export function getWorkloadProfile(category: string): WorkloadProfile | undefined {
  return WORKLOAD_PROFILES.find((p) => p.name === category);
}

export function boundByForCategory(category: string): BoundBy {
  return getWorkloadProfile(category)?.boundBy ?? "mixed";
}
