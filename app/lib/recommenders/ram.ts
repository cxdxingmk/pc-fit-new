import { rams } from "../../database/ram";

type Answers = Record<number, string[]>;

export function recommendRam(answers: Answers) {
  const budget = answers[2]?.[0] || "";

  let candidates = [...rams];

  if (budget === "100만원 이하") {
    candidates = candidates.filter(ram => ram.priceTier === "budget");
  }

  if (budget === "100~150만원") {
    candidates = candidates.filter(
      ram =>
        ram.priceTier === "budget" ||
        ram.priceTier === "mid"
    );
  }

  return candidates[0] ?? rams[0];
}