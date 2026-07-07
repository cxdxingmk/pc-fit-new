/**
 * app/database/cpu.ts / gpu.ts에는 brand 필드는 있지만 "시리즈"(Ryzen 7, Core i5, RTX 40 등) 필드가
 * 없어서, 계층형 부품 선택 Select의 중간 단계(브랜드 -> 시리즈 -> 모델)를 만들려면 모델명 문자열에서
 * 순수 함수로 파싱해야 한다. 분류에 실패한 모델은 반드시 "기타"로 수용해 선택 자체가 불가능해지는
 * 일이 없게 한다.
 */
export const UNKNOWN_SERIES = "기타";

const SERIES_PATTERNS: Array<{ test: RegExp; series: (match: RegExpMatchArray) => string }> = [
  // AMD Threadripper (PRO 여부 구분) - 실제 카탈로그엔 소켓 미지원으로 없지만 방어적으로 남겨둔다.
  { test: /Threadripper\s+PRO/i, series: () => "Threadripper PRO" },
  { test: /Threadripper/i, series: () => "Threadripper" },
  // AMD Ryzen 3/5/7/9
  { test: /Ryzen\s+([3579])/i, series: (m) => `Ryzen ${m[1]}` },
  // Intel Core Ultra 3/5/7/9
  { test: /Core\s+Ultra\s+([3579])/i, series: (m) => `Core Ultra ${m[1]}` },
  // Intel Core i3/i5/i7/i9
  { test: /Core\s+i([3579])/i, series: (m) => `Core i${m[1]}` },
  // NVIDIA RTX/GTX 시리즈 (첫 자리 숫자로 세대 구분: 4070 -> RTX 40)
  { test: /RTX\s*(\d)\d{3}/i, series: (m) => `RTX ${m[1]}0` },
  { test: /GTX\s*(\d)\d{3}/i, series: (m) => `GTX ${m[1]}0` },
  { test: /GTX\s*(\d)\d{2}(?!\d)/i, series: (m) => `GTX ${m[1]}00` },
  // AMD Radeon RX 시리즈 (4자리는 천단위로, 3자리는 백단위로 세대 구분)
  { test: /RX\s*(\d)\d{3}/i, series: (m) => `RX ${m[1]}000` },
  { test: /RX\s*(\d)\d{2}(?!\d)/i, series: (m) => `RX ${m[1]}00` },
  // Intel Arc A/B 시리즈 (Pro 여부 구분)
  { test: /Arc\s+Pro\s+([AB])/i, series: (m) => `Arc Pro ${m[1].toUpperCase()}` },
  { test: /Arc\s+([AB])/i, series: (m) => `Arc ${m[1].toUpperCase()}` },
];

/** 모델명 문자열에서 시리즈를 파싱한다. 매칭 실패 시 "기타"를 반환하며 절대 throw하지 않는다. */
export function derivePartSeries(modelName: string): string {
  for (const pattern of SERIES_PATTERNS) {
    const match = modelName.match(pattern.test);
    if (match) return pattern.series(match);
  }
  return UNKNOWN_SERIES;
}

/** 카탈로그 배열 전체에 대해 시리즈 분류 성공률을 계산한다 (커버리지 리포트/회귀 테스트용). */
export function calculateSeriesCoverage(modelNames: string[]): { total: number; classified: number; ratio: number } {
  const total = modelNames.length;
  const classified = modelNames.filter((name) => derivePartSeries(name) !== UNKNOWN_SERIES).length;
  return { total, classified, ratio: total === 0 ? 1 : classified / total };
}
