import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import { scoreAllWorkloads, type WorkloadScore } from "./workloadScoring";

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

