/**
 * ─────────────────────────────────────────────────────────────────────────────
 * psuRecommendation.ts — 최소 권장 파워 용량 산정 유틸리티 (순수 로직, UI 무의존)
 * ─────────────────────────────────────────────────────────────────────────────
 * 산정 알고리즘 (다나와/컴퓨존 계산기 방식 벤치마킹):
 *   1. CPU TDP + GPU TGP를 모델명 패턴 매칭으로 추정 (미확인 모델은 보수적 폴백)
 *   2. 기타 시스템 소비전력(메인보드/RAM/SSD/팬 등) 고정 가산: +75W
 *   3. 피크 전력 합산 후 안전 마진 30% 반영
 *   4. 시판 표준 파워 용량 단위(500/550/600/650/700/750/850/1000/1200W)로 올림
 *
 * 반환값은 UI에서 그대로 렌더링할 수 있는 상세 객체입니다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ═══ 타입 ═══
export interface PsuRecommendation {
  /** 최종 최소 권장 용량 (표준 단위로 올림, 예: 650) */
  recommendedWatt: number;
  /** 마진 반영 전 추정 피크 전력 */
  estimatedPeakWatt: number;
  /** CPU 추정 TDP */
  cpuTdp: number;
  /** GPU 추정 TGP */
  gpuTdp: number;
  /** 적용된 안전 마진 비율 (0.3 = 30%) */
  marginRatio: number;
  /** TDP를 패턴 매칭으로 못 찾아 폴백 추정치를 쓴 경우 true → UI에서 "약" 표기 권장 */
  isEstimated: boolean;
}

// "low_headroom": 최소 권장치는 충족하지만 여유가 거의 없는 구간(권장치의 110% 미만).
export type PsuAdequacy = "sufficient" | "low_headroom" | "insufficient" | "unknown";

// ═══ 상수 ═══
const SAFETY_MARGIN = 0.3; // 안전 마진 30%
const BASE_SYSTEM_WATT = 75; // 메인보드+RAM+SSD+팬 등 기타 소비전력
const STANDARD_PSU_SIZES = [450, 500, 550, 600, 650, 700, 750, 850, 1000, 1200, 1600] as const;

const CPU_FALLBACK_TDP = 125; // 미확인 CPU 보수적 추정치
const GPU_FALLBACK_TDP = 220; // 미확인 GPU 보수적 추정치

// ═══ TDP 룩업 테이블 (패턴 → 와트) — 상단 규칙이 우선 매칭됨 ═══
// 신규 부품은 이 배열에 규칙만 추가하면 됨 (OCP)
const CPU_TDP_RULES: ReadonlyArray<[RegExp, number]> = [
  [/i9-14900K|i9-13900K/i, 253],
  [/i7-14700K|i7-13700K/i, 253],
  [/i9-\d{5}(?!K)/i, 219],
  [/i7-\d{5}(?!K)/i, 219],
  [/i5-14600K|i5-13600K/i, 181],
  [/i5-\d{5}(?!K)/i, 154],
  [/i3-\d{5}/i, 110],
  [/Core\s?Ultra\s?9/i, 250],
  [/Core\s?Ultra\s?7/i, 250],
  [/Core\s?Ultra\s?5/i, 181],
  [/9950X3?D?|9900X3?D?/i, 170],
  [/7950X3?D?|7900X3?D?/i, 170],
  [/9800X3D|9700X|9600X/i, 120],
  [/7800X3D/i, 120],
  [/7700X?|7600X?/i, 105],
  [/5950X|5900X/i, 105],
  [/5800X3?D?|5700X|5600X?/i, 105],
  [/Threadripper/i, 350],
];

const GPU_TDP_RULES: ReadonlyArray<[RegExp, number]> = [
  [/RTX\s?5090/i, 575],
  [/RTX\s?5080/i, 360],
  [/RTX\s?5070\s?Ti/i, 300],
  [/RTX\s?5070/i, 250],
  [/RTX\s?5060\s?Ti/i, 180],
  [/RTX\s?5060/i, 145],
  [/RTX\s?4090/i, 450],
  [/RTX\s?4080\s?SUPER|RTX\s?4080/i, 320],
  [/RTX\s?4070\s?Ti\s?SUPER/i, 285],
  [/RTX\s?4070\s?Ti/i, 285],
  [/RTX\s?4070\s?SUPER/i, 220],
  [/RTX\s?4070/i, 200],
  [/RTX\s?4060\s?Ti/i, 165],
  [/RTX\s?4060/i, 115],
  [/RTX\s?3090/i, 350],
  [/RTX\s?3080/i, 320],
  [/RTX\s?3070/i, 220],
  [/RTX\s?3060\s?Ti/i, 200],
  [/RTX\s?3060/i, 170],
  // RTX 20 / GTX 16·10·9 세대 — 카탈로그(app/database/gpu.ts)에 큐레이션돼 있는데도
  // 아래 규칙이 없어 전부 GPU_FALLBACK_TDP(220W)로 과대추정되던 구간을 보강.
  [/RTX\s?2080\s?Ti/i, 260],
  [/RTX\s?2080/i, 215],
  [/RTX\s?2070\s?SUPER/i, 215],
  [/RTX\s?2070/i, 175],
  [/RTX\s?2060/i, 160],
  [/GTX\s?1660\s?Ti/i, 130],
  [/GTX\s?1660\s?SUPER/i, 125],
  [/GTX\s?1660/i, 120],
  [/GTX\s?1650/i, 75],
  [/GTX\s?1080\s?Ti/i, 250],
  [/GTX\s?1080/i, 180],
  [/GTX\s?1070/i, 150],
  [/GTX\s?1060/i, 120],
  [/GTX\s?1050\s?Ti|GTX\s?1050/i, 75],
  [/GTX\s?980\s?Ti/i, 250],
  [/GTX\s?980/i, 165],
  [/GTX\s?970/i, 145],
  [/GTX\s?960/i, 120],
  [/RX\s?7900\s?XTX/i, 355],
  [/RX\s?7900\s?XT/i, 315],
  [/RX\s?7800\s?XT/i, 263],
  [/RX\s?7700\s?XT/i, 245],
  [/RX\s?7600/i, 165],
  // RX 6000 / 5000 / 500 세대 — 위와 같은 이유로 보강.
  [/RX\s?6900\s?XT/i, 300],
  [/RX\s?6800\s?XT/i, 300],
  [/RX\s?6800/i, 250],
  [/RX\s?6700\s?XT/i, 230],
  [/RX\s?6600\s?XT/i, 160],
  [/RX\s?5700\s?XT/i, 225],
  [/RX\s?5600\s?XT/i, 150],
  [/RX\s?5500\s?XT/i, 130],
  [/RX\s?590/i, 225],
  [/RX\s?580/i, 185],
  [/RX\s?570/i, 150],
  [/RX\s?560/i, 80],
  [/RX\s?9070\s?XT/i, 304],
  [/RX\s?9070/i, 220],
  [/Arc\s?B580/i, 190],
  [/Arc\s?A770/i, 225],
  [/Arc\s?A750/i, 225],
  [/Arc\s?A580/i, 120],
  [/Arc\s?A380/i, 75],
  [/내장|iGPU|integrated|없음/i, 0],
];

// ═══ 내부 헬퍼 ═══
function lookupTdp(
  modelName: string,
  rules: ReadonlyArray<[RegExp, number]>,
  fallback: number,
): { watt: number; matched: boolean } {
  for (const [pattern, watt] of rules) {
    if (pattern.test(modelName)) return { watt, matched: true };
  }
  return { watt: fallback, matched: false };
}

function roundUpToStandardSize(watt: number): number {
  for (const size of STANDARD_PSU_SIZES) {
    if (size >= watt) return size;
  }
  return STANDARD_PSU_SIZES[STANDARD_PSU_SIZES.length - 1];
}

/** "850W GOLD", "시소닉 750W" 같은 제품명 문자열에서 용량 숫자 추출 */
export function parsePsuWattage(psuName: string | null | undefined): number | null {
  if (!psuName) return null;
  const match = psuName.match(/(\d{3,4})\s?W/i);
  if (!match) return null;
  const watt = parseInt(match[1], 10);
  return Number.isFinite(watt) && watt >= 200 && watt <= 2000 ? watt : null;
}

// ═══ 메인 API ═══
/**
 * CPU/GPU 모델명으로 최소 권장 파워 용량을 계산합니다.
 * @example calculatePsuRecommendation("Core i9-14900K", "GeForce RTX 4070 SUPER")
 *          → { recommendedWatt: 750, estimatedPeakWatt: 548, ... }
 */
export function calculatePsuRecommendation(cpuName: string, gpuName: string): PsuRecommendation {
  const cpu = lookupTdp(cpuName, CPU_TDP_RULES, CPU_FALLBACK_TDP);
  const gpu = lookupTdp(gpuName, GPU_TDP_RULES, GPU_FALLBACK_TDP);

  const estimatedPeakWatt = cpu.watt + gpu.watt + BASE_SYSTEM_WATT;
  const withMargin = estimatedPeakWatt * (1 + SAFETY_MARGIN);

  return {
    recommendedWatt: roundUpToStandardSize(withMargin),
    estimatedPeakWatt,
    cpuTdp: cpu.watt,
    gpuTdp: gpu.watt,
    marginRatio: SAFETY_MARGIN,
    isEstimated: !cpu.matched || !gpu.matched,
  };
}

/**
 * 사용자가 선택한 파워가 권장 용량을 충족하는지 판정합니다.
 * UI 경고 스테이트(주황색) 분기에 사용하세요.
 */
// 권장치 대비 이 비율 미만이면 "충분하긴 하지만 여유가 거의 없음"으로 본다.
const LOW_HEADROOM_RATIO = 1.1;

export function evaluatePsuAdequacy(selectedPsuName: string | null | undefined, recommendation: PsuRecommendation): PsuAdequacy {
  const selectedWatt = parsePsuWattage(selectedPsuName);
  if (selectedWatt === null) return "unknown";
  if (selectedWatt < recommendation.recommendedWatt) return "insufficient";
  if (selectedWatt < recommendation.recommendedWatt * LOW_HEADROOM_RATIO) return "low_headroom";
  return "sufficient";
}
