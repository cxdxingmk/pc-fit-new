type ScoreTarget = {
  gameScore: number;
  workScore: number;
  aiScore: number;
};

type Answers = Record<number, string[]>;

export function calculateScore(
  item: ScoreTarget,
  answers: Answers
) {
  const usage = answers[1]?.[0] || "";

  let score = 0;

  switch (usage) {
    case "게임":
      score += item.gameScore * 2;
      score += item.workScore * 0.5;
      score += item.aiScore * 0.3;
      break;

    case "영상편집":
      score += item.workScore * 2;
      score += item.gameScore * 0.5;
      score += item.aiScore * 0.7;
      break;

    case "AI":
      score += item.aiScore * 2;
      score += item.workScore * 1;
      score += item.gameScore * 0.3;
      break;

    case "사무용":
      score += item.workScore;
      break;

    default:
      score +=
        item.gameScore +
        item.workScore +
        item.aiScore;
  }

  return score;
}