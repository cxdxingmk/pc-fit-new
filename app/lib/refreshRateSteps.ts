// 모니터 주사율은 실제 디스플레이 표준 규격 단계로만 고를 수 있게 한다.
// (예전엔 <input type="number" step={1}>이라 네이티브 스피너로 60→61→62처럼 1씩 올라갔다.)
//
// 주의: app/lib/displayMatch.ts의 RefreshRate(60|144|240)와는 다른 개념이다.
// 그쪽은 "성능 진단 엔진이 targetFps/pressure 메타를 가진 Hz"라서 3종뿐이고,
// 여기는 "사용자가 자기 모니터 스펙으로 등록하는 값"이라 표준 규격 전체를 담는다.

export const REFRESH_RATE_STEPS = [60, 75, 100, 120, 144, 165, 180, 240, 360, 480, 540] as const;

export type RefreshRateStep = (typeof REFRESH_RATE_STEPS)[number];

export const MIN_REFRESH_RATE: RefreshRateStep = REFRESH_RATE_STEPS[0];
export const MAX_REFRESH_RATE: RefreshRateStep = REFRESH_RATE_STEPS[REFRESH_RATE_STEPS.length - 1];

export function isRefreshRateStep(value: number): value is RefreshRateStep {
  return (REFRESH_RATE_STEPS as readonly number[]).includes(value);
}

/**
 * 표준 단계가 아닌 값(예전 자유 입력으로 저장된 200Hz, 스캔에서 읽힌 임의값, 범위 밖 값)을
 * 가장 가까운 표준 단계로 맞춘다 — 셀렉트에 매칭되는 option이 없어 빈칸으로 보이는 걸 막는다.
 * 범위 밖은 자연스럽게 양끝(60/540)으로 수렴한다.
 */
export function snapToNearestRefreshRate(value: number): RefreshRateStep {
  if (!Number.isFinite(value)) return MIN_REFRESH_RATE;

  return REFRESH_RATE_STEPS.reduce<RefreshRateStep>(
    (nearest, step) => (Math.abs(step - value) < Math.abs(nearest - value) ? step : nearest),
    MIN_REFRESH_RATE
  );
}
