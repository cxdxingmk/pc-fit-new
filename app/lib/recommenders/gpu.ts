import { gpus } from "../../database/gpu";

type Answers = Record<number, string[]>;

export function recommendGpu(answers: Answers) {
  const budget = answers[2]?.[0] || "";

  let candidates = [...gpus];

  if (budget === "100만원 이하") {
    candidates = candidates.filter(gpu => gpu.priceTier === "budget");
  }

  if (budget === "100~150만원") {
    candidates = candidates.filter(
      gpu =>
        gpu.priceTier === "budget" ||
        gpu.priceTier === "mid"
    );
  }

  return candidates[0] ?? gpus[0];
}

export function recommendGpuTop(answers: Answers, top = 3) {
  const budget = answers[2]?.[0] || "";

  let candidates = [...gpus];

  if (budget === "100만원 이하") {
    candidates = candidates.filter(gpu => gpu.priceTier === "budget");
  }

  if (budget === "100~150만원") {
    candidates = candidates.filter(
      gpu => gpu.priceTier === "budget" || gpu.priceTier === "mid"
    );
  }

  candidates.sort((a, b) => (b.gameScore + b.workScore + b.aiScore) - (a.gameScore + a.workScore + a.aiScore));

  return candidates.slice(0, top);
}