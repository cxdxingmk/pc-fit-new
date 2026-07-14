import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import { scoreAllWorkloads, scoreTier, type PenaltyKind, type WorkloadScore } from "./workloadScoring";

export type MyPcParts = {
  cpu: CPU;
  gpu: GPU;
  ram: RAM;
  ssd: SSD;
  motherboard: MotherBoard;
};

export type MyPcScore = {
  gameScore: number; // 0-100
  workScore: number; // 영상편집 중심
  aiScore: number;
  officeScore: number; // 일반 작업
  totalScore: number; // 평균
};

// 등급 변환
export function getGrade(score: number): string {
  if (score >= 90) return "매우 좋음 🔥";
  if (score >= 80) return "좋음 👍";
  if (score >= 70) return "보통";
  if (score >= 60) return "부족";
  return "매우 부족";
}

// 전체 점수 계산 함수
export function getMyPcScore(parts: MyPcParts): MyPcScore {
  // weights
  const gameWeights = { gpu: 0.6, cpu: 0.3, mem: 0.1 };
  const workWeights = { cpu: 0.5, gpu: 0.2, mem: 0.2, ssd: 0.1 };
  const aiWeights = { gpu: 0.6, cpu: 0.25, mem: 0.1, ssd: 0.05 };
  const officeWeights = { cpu: 0.5, mem: 0.3, ssd: 0.2 };

  const cpu = parts.cpu;
  const gpu = parts.gpu;
  const ram = parts.ram;
  const ssd = parts.ssd;

  // Ensure scores are within 0-100
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const gameScore = clamp(
    gpu.gameScore * gameWeights.gpu + cpu.gameScore * gameWeights.cpu + ((ram.gameScore + ssd.gameScore) / 2) * gameWeights.mem
  );

  const workScore = clamp(
    cpu.workScore * workWeights.cpu + gpu.workScore * workWeights.gpu + ram.workScore * workWeights.mem + ssd.workScore * workWeights.ssd
  );

  const aiScore = clamp(
    gpu.aiScore * aiWeights.gpu + cpu.aiScore * aiWeights.cpu + ram.aiScore * aiWeights.mem + ssd.aiScore * aiWeights.ssd
  );

  const officeScore = clamp(
    cpu.workScore * officeWeights.cpu + ((ram.workScore + ssd.workScore) / 2) * (officeWeights.mem + officeWeights.ssd)
  );

  const totalScore = clamp(Math.round((gameScore + workScore + aiScore + officeScore) / 4));

  return {
    gameScore,
    workScore,
    aiScore,
    officeScore,
    totalScore,
  };
}

// CPU/GPU 조합에 대한 43개 대표 프로그램(게임 23 + 전문/AI 앱 20) 예상 성능 점수.
// RAM을 넘기면 AI/영상 워크로드에 RAM 용량 감점이 반영된다(scoreAllWorkloads 참고).
export function getMyPcWorkloadScores(parts: Pick<MyPcParts, "cpu" | "gpu"> & { ram?: RAM }): WorkloadScore[] {
  return scoreAllWorkloads(parts.cpu, parts.gpu, parts.ram?.capacity);
}

// ─────────────────────────────────────────────────────────────────────────────
// "3줄 요약" — 진단서 카드 최상단에 노출. 새 점수 체계를 만들지 않고 이미 계산된
// 43종 워크로드 점수(WorkloadScore)와 MyPcScore 4축 점수에서만 파생시킨다.
// ─────────────────────────────────────────────────────────────────────────────

const BOTTLENECK_LABEL: Record<PenaltyKind, string> = {
  cuda: "일부 프로그램이 필요로 하는 NVIDIA 전용 기술(CUDA) 지원이 발목을 잡고 있어요.",
  rt: "레이트레이싱 미지원이 일부 프로그램에서 발목을 잡고 있어요.",
  vram: "그래픽카드 메모리(VRAM)가 발목을 잡고 있어요.",
  ram: "메모리(RAM) 용량이 발목을 잡고 있어요.",
};

/** UPGRADE 등급(55점 미만) 워크로드들의 penaltyKinds를 집계해 가장 빈도 높은 병목 원인 1개를 고른다. */
function bottleneckLine(workloadScores: WorkloadScore[]): string {
  const upgradeItems = workloadScores.filter((w) => scoreTier(w.score).label === "UPGRADE");
  if (upgradeItems.length === 0) {
    return "뚜렷한 병목 없이 대부분 프로그램에서 무난하게 돌아가요.";
  }

  const kindCounts = new Map<PenaltyKind, number>();
  for (const w of upgradeItems) {
    for (const kind of w.penaltyKinds) {
      kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
    }
  }
  if (kindCounts.size === 0) {
    return "특정 부품보다는 전반적인 하드웨어 성능이 다소 아쉬운 편이에요.";
  }

  const [topKind] = [...kindCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  return BOTTLENECK_LABEL[topKind];
}

const AXIS_NOUN: Record<string, string> = {
  게임: "게임",
  영상편집: "영상편집",
  "AI 작업": "AI 작업",
  "사무·일반": "사무 작업",
};

/** 게임/영상편집/AI작업/사무(MyPcScore 4축) 중 가장 높은 축(들)을 근거로 "가장 잘 맞는 용도" 문장을 만든다. */
function usageLine(categories: { axis: string; score: number }[]): string {
  const sorted = [...categories].sort((a, b) => b.score - a.score);
  const top = sorted[0];
  const second = sorted[1];
  if (!top) return "다양한 작업에 무난하게 알맞아요.";

  const topNoun = AXIS_NOUN[top.axis] ?? top.axis;
  const nouns = second && second.score >= top.score - 8 ? `${topNoun}·${AXIS_NOUN[second.axis] ?? second.axis}` : topNoun;

  const qualifier = top.score >= 85 ? "본격적인 " : top.score >= 55 ? "" : "가벼운 ";
  return `${qualifier}${nouns} 위주로 알맞아요.`;
}

export function buildThreeLineSummary(params: {
  /** 종합점수 한줄평 — overallVerdict(totalScore).line을 그대로 재사용(호출부에서 계산해 넘김) */
  verdictLine: string;
  workloadScores: WorkloadScore[];
  categories: { axis: string; score: number }[];
}): [string, string, string] {
  return [params.verdictLine, bottleneckLine(params.workloadScores), usageLine(params.categories)];
}

