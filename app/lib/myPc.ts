import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";

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

// 간단 설명 생성
export function getDescription(type: "game" | "work" | "ai" | "office", score: number): string {
  switch (type) {
    case "game":
      if (score >= 90) return `최신 게임을 높은 설정에서 원활히 즐길 수 있습니다.`;
      if (score >= 80) return `대부분의 게임에서 높은 품질로 플레이 가능합니다.`;
      if (score >= 70) return `중간~높음 설정에서 쾌적한 게임이 가능합니다.`;
      if (score >= 60) return `설정을 낮추면 플레이는 가능하지만 업그레이드 고려하세요.`;
      return `고사양 게임에서는 성능이 부족할 수 있습니다.`;
    case "work":
      if (score >= 90) return `대형 영상이나 멀티트랙 편집 작업을 빠르게 처리합니다.`;
      if (score >= 80) return `고해상도 편집과 이펙트 작업에 적합합니다.`;
      if (score >= 70) return `일반적인 편집작업에서 무난한 성능을 보입니다.`;
      if (score >= 60) return `복잡한 프로젝트에서는 느려질 수 있습니다.`;
      return `영상 편집 등 작업에서 병목이 자주 발생할 수 있습니다.`;
    case "ai":
      if (score >= 90) return `대형 모델 학습·추론에 적합한 강력한 성능입니다.`;
      if (score >= 80) return `중대형 모델의 학습이나 빠른 추론에 유리합니다.`;
      if (score >= 70) return `소~중형 모델의 학습과 추론에 무난합니다.`;
      if (score >= 60) return `대규모 AI 작업에는 한계가 있습니다.`;
      return `AI 워크로드에서 성능이 부족합니다.`;
    case "office":
      if (score >= 90) return `다중 작업과 대용량 파일 처리도 매끄럽습니다.`;
      if (score >= 80) return `일반 업무 및 멀티태스킹에 쾌적합니다.`;
      if (score >= 70) return `문서, 스프레드시트 등에서 무난한 성능을 제공합니다.`;
      if (score >= 60) return `여러 앱을 동시에 실행하면 답답함을 느낄 수 있습니다.`;
      return `일상적인 작업에서도 성능 저하가 있습니다.`;
    default:
      return "";
  }
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

const myPcUtils = { getMyPcScore, getGrade, getDescription };

export default myPcUtils;
