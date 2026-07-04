import { ssds } from "../../database/ssd";

type Answers = Record<number, string[]>;

export function recommendSsd(answers: Answers) {
  const budget = answers[2]?.[0] || "";

  let candidates = [...ssds];

  if (budget === "100만원 이하") {
    candidates = candidates.filter(ssd => ssd.priceTier === "budget");
  }

  if (budget === "100~150만원") {
    candidates = candidates.filter(
      ssd =>
        ssd.priceTier === "budget" ||
        ssd.priceTier === "mid"
    );
  }

  return candidates[0] ?? ssds[0];
}

export function recommendSsdTop(answers: Answers, top = 3) {
  const budget = answers[2]?.[0] || "";

  let candidates = [...ssds];

  if (budget === "100만원 이하") {
    candidates = candidates.filter(ssd => ssd.priceTier === "budget");
  }

  if (budget === "100~150만원") {
    candidates = candidates.filter(
      ssd => ssd.priceTier === "budget" || ssd.priceTier === "mid"
    );
  }

  candidates.sort((a, b) => (b.gameScore + b.workScore + b.aiScore) - (a.gameScore + a.workScore + a.aiScore));

  return candidates.slice(0, top);
}