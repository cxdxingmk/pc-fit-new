import { cpus } from "../../database/cpu";

type Answers = Record<number, string[]>;

export function recommendCpu(answers: Answers) {
  const budget = answers[2]?.[0] || "";

  let candidates = [...cpus];

  if (budget === "100만원 이하") {
    candidates = candidates.filter(cpu => cpu.priceTier === "budget");
  }

  if (budget === "100~150만원") {
    candidates = candidates.filter(
      cpu =>
        cpu.priceTier === "budget" ||
        cpu.priceTier === "mid"
    );
  }

  return candidates[0] ?? cpus[0];
}

export function recommendCpuTop(answers: Answers, top = 3) {
  const budget = answers[2]?.[0] || "";

  let candidates = [...cpus];

  if (budget === "100만원 이하") {
    candidates = candidates.filter(cpu => cpu.priceTier === "budget");
  }

  if (budget === "100~150만원") {
    candidates = candidates.filter(
      cpu => cpu.priceTier === "budget" || cpu.priceTier === "mid"
    );
  }

  // rank by aggregate score (game + work + ai)
  candidates.sort((a, b) => (b.gameScore + b.workScore + b.aiScore) - (a.gameScore + a.workScore + a.aiScore));

  return candidates.slice(0, top);
}