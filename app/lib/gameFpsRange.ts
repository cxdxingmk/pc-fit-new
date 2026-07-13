/**
 * gameFpsRange.ts — 게임별 예상 FPS를 "확정 숫자" 대신 범위로 표기한다.
 *
 * 같은 카테고리의 게임들은 CPU/GPU 점수가 비슷한 고사양 조합일수록 가중치
 * 차이가 최종 fps에 거의 반영되지 않아(둘 다 최고점에 가까우면 가중 평균도
 * 항상 최고점 근처) 반올림 후 여러 게임이 완전히 같은 숫자로 보이는 현상이
 * 있었다. 애초에 ±1fps 단위 확정값처럼 보여주는 것 자체가 과도한 정밀도라,
 * 게임 이름 기반 결정적 지터로 폭이 살짝씩 다른 범위를 보여준다 — 매 렌더
 * 다른 값이 아니라(불안정해 보임 방지) 같은 게임은 항상 같은 범위를 낸다.
 */

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 1000;
}

const MIN_HALF_WIDTH_RATIO = 0.03;
const MAX_HALF_WIDTH_RATIO = 0.06;
const MIN_HALF_WIDTH_FPS = 2;

/** 게임 이름을 시드로 한 결정적 ±3~6% 범위 문자열(예: "246~266")을 반환한다. */
export function formatGameFpsRange(estimatedFps: number | null, seed: string): string {
  if (estimatedFps == null) return "—";

  const jitter = hashSeed(seed) / 1000; // 0~1, 게임마다 고정
  const halfWidthRatio = MIN_HALF_WIDTH_RATIO + jitter * (MAX_HALF_WIDTH_RATIO - MIN_HALF_WIDTH_RATIO);
  const halfWidth = Math.max(MIN_HALF_WIDTH_FPS, Math.round(estimatedFps * halfWidthRatio));

  const low = Math.max(0, estimatedFps - halfWidth);
  const high = estimatedFps + halfWidth;
  return `${low}~${high}`;
}
