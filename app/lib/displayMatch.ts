/**
 * ============================================================================
 *  DISPLAY MATCH LAYER  —  해상도 / 주사율 프레임 방어 시뮬레이터
 * ----------------------------------------------------------------------------
 *  benchmark-engine 의 게임 baseScore(0~100)를 입력받아,
 *  유저가 고른 [해상도] + [주사율] 조합에서의 "체감 프레임 방어 능력"을
 *  한글 문구 + 상태 티어로 반환한다.  workloadScoring.ts / UI 레이어에 바로 이식.
 *
 *  판정 파이프라인
 *    1) effective = baseScore × resMult(해상도, 카테고리 GPU의존도)
 *         └ 해상도↑ → 픽셀 연산량↑ → GPU 의존 카테고리일수록 배율 급락
 *    2) estFps    = FPS_CURVE(effective)        // 유효점수 → 실질 방어 fps
 *    3) ratio     = estFps / 목표Hz             // 주사율 방어율
 *    4) tier      = ratio + estFps 로 등급 산정
 *    5) bottleneck = (해상도압력×GPU의존) vs (주사율압력×CPU의존) 비교
 *
 *  ※ 4K VRAM 하드패널티: 엔진의 gpuVRAM 서브스코어에 1차 반영됨.
 *    호출부에서 vramGB 를 넘기면 4K 에서 추가(파괴적) 감점을 이중 적용한다.
 * ============================================================================
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. 타입 정의
// ─────────────────────────────────────────────────────────────────────────────

export type Resolution = "FHD" | "QHD" | "4K";
export type RefreshRate = 60 | 144 | 240;

export type DisplayTier =
  | "PERFECT"    // 목표 주사율 완벽 방어 (여유 있음)
  | "GOOD"       // 목표 주사율 방어 (여유 적음)
  | "LACK_GPU"   // 플레이 가능하나 해상도 대비 GPU 부족 → 목표 Hz 미달
  | "LACK_CPU"   // 플레이 가능하나 주사율 대비 CPU 부족 → 프레임 상한 묶임
  | "CRITICAL";  // 목표 구동 불가 수준

export type Bottleneck = "GPU" | "CPU" | "BALANCED";

export interface DisplayMatchResult {
  status: DisplayTier;
  message: string;            // UI 노출용 한글 문구
  bottleneck: Bottleneck;
  targetHz: RefreshRate;
  estimatedFps: number | null; // 실질 방어 프레임 (비게임=null)
  defendedFpsTier: number | null; // 가장 근접한 표준 fps 티어
  effectiveScore: number;     // 해상도 배율 반영 유효점수
  defenseRatio: number;       // estFps / targetHz
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. 환경 메타데이터 (튜닝 파라미터)
// ─────────────────────────────────────────────────────────────────────────────

/** 해상도별 기본 GPU 배율 + 압력(병목 판정용) */
const RES_META: Record<Resolution, { baseMult: number; pressure: number; label: string }> = {
  FHD: { baseMult: 1.0, pressure: 0.0, label: "FHD(1080p)" },  // 깡성능 100%
  QHD: { baseMult: 0.85, pressure: 0.5, label: "QHD(1440p)" }, // 픽셀 1.7배
  "4K": { baseMult: 0.62, pressure: 1.0, label: "4K UHD(2160p)" }, // 픽셀 4배
};

/** 주사율별 목표 fps + 압력(병목 판정용) */
const HZ_META: Record<RefreshRate, { targetFps: number; pressure: number; label: string }> = {
  60: { targetFps: 60, pressure: 0.0, label: "60Hz" },
  144: { targetFps: 144, pressure: 0.55, label: "144Hz" },
  240: { targetFps: 240, pressure: 1.0, label: "240Hz" },
};

/**
 * 게임 카테고리별 CPU/GPU 의존도 (benchmark-engine 의 category 문자열과 1:1)
 *  - 해상도 패널티 강도와 병목 판정에 사용
 */
const CATEGORY_PROFILE: Record<string, { cpuBound: number; gpuBound: number }> = {
  "게임/CPU클럭": { cpuBound: 0.85, gpuBound: 0.30 },
  "게임/멀티코어": { cpuBound: 0.65, gpuBound: 0.55 },
  "게임/GPU래스터": { cpuBound: 0.30, gpuBound: 0.90 },
  "게임/RT": { cpuBound: 0.25, gpuBound: 0.95 },
};

/** 유효점수(0~100) → 실질 방어 fps 커브 (구간 선형보간) */
const FPS_CURVE: [number, number][] = [
  [0, 0], [15, 30], [30, 45], [44, 60],
  [58, 100], [70, 144], [85, 240], [100, 360],
];

/** 메시지·UI 표기용 표준 fps 티어 */
const FPS_TIERS = [30, 45, 60, 90, 120, 144, 165, 240, 300, 360];

// ─────────────────────────────────────────────────────────────────────────────
// 3. 내부 유틸
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** 유효점수 → fps (FPS_CURVE 선형보간) */
function interpFps(effective: number): number {
  const e = clamp(effective, 0, 100);
  for (let i = 0; i < FPS_CURVE.length - 1; i++) {
    const [x0, y0] = FPS_CURVE[i];
    const [x1, y1] = FPS_CURVE[i + 1];
    if (e >= x0 && e <= x1) {
      const t = (e - x0) / (x1 - x0);
      return Math.round(y0 + t * (y1 - y0));
    }
  }
  return 360;
}

/** 실측 fps 에 가장 가까운 표준 티어 */
function nearestFpsTier(fps: number): number {
  return FPS_TIERS.reduce((best, t) =>
    Math.abs(t - fps) < Math.abs(best - fps) ? t : best, FPS_TIERS[0]);
}

function isGameCategory(category: string): boolean {
  return category in CATEGORY_PROFILE;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. 메인 판정 함수
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param baseScore 엔진이 산출한 게임 워크로드 점수(0~100)
 * @param category  엔진 category 문자열 ("게임/RT" 등)
 * @param res       선택 해상도
 * @param hz        선택 주사율
 * @param vramGB    (선택) GPU VRAM. 4K + 저용량 시 파괴적 추가 패널티 적용
 */
export function evaluateDisplayMatch(
  baseScore: number,
  category: string,
  res: Resolution,
  hz: RefreshRate,
  vramGB?: number
): DisplayMatchResult {
  const targetHz = hz;

  // ── 비(非)게임 워크로드: 해상도/주사율 비적용 ──
  if (!isGameCategory(category)) {
    return {
      status: baseScore >= 60 ? "GOOD" : "LACK_GPU",
      message: "게임 외 워크로드 — 해상도·주사율은 성능에 영향을 주지 않습니다.",
      bottleneck: "BALANCED",
      targetHz,
      estimatedFps: null,
      defendedFpsTier: null,
      effectiveScore: Math.round(baseScore),
      defenseRatio: 0,
    };
  }

  const prof = CATEGORY_PROFILE[category];
  const resMeta = RES_META[res];
  const hzMeta = HZ_META[hz];

  // ── 1) 해상도 유효 배율 (GPU 의존도가 높을수록 패널티 강함) ──
  //    effMult = 1 - (1 - baseMult) × (0.55 + 0.45 × gpuBound)
  const resMult = 1 - (1 - resMeta.baseMult) * (0.55 + 0.45 * prof.gpuBound);
  let effective = baseScore * resMult;

  // ── 4K VRAM 파괴적 하드패널티 (호출부가 vramGB 제공 시) ──
  let vramHit = false;
  if (res === "4K" && typeof vramGB === "number") {
    if (vramGB <= 8) { effective *= 0.6; vramHit = true; }
    else if (vramGB < 12) { effective *= 0.82; vramHit = true; }
  }
  effective = clamp(effective, 0, 100);

  // ── 2~3) 실질 fps & 방어율 ──
  const estFps = interpFps(effective);
  const defendedFpsTier = nearestFpsTier(estFps);
  const ratio = estFps / hzMeta.targetFps;

  // ── 5) 병목 판정 ──
  const gpuPressure = resMeta.pressure * prof.gpuBound;
  const cpuPressure = hzMeta.pressure * prof.cpuBound;
  const bottleneck: Bottleneck =
    Math.abs(gpuPressure - cpuPressure) < 0.08
      ? "BALANCED"
      : gpuPressure >= cpuPressure
      ? "GPU"
      : "CPU";

  // ── 티어 결정 ──
  //   CRITICAL 은 "플레이 자체가 불가(≈45fps 미만)" 일 때만.
  //   60fps 는 나오지만 목표 주사율에 못 미치는 경우는 LACK_* 로 분기.
  let status: DisplayTier;
  if (estFps < 45) {
    status = "CRITICAL";
  } else if (ratio >= 1.15) {
    status = "PERFECT";
  } else if (ratio >= 0.9) {
    status = "GOOD";
  } else {
    // 목표 미달이지만 플레이 가능 → 병목 방향으로 LACK 분기
    status = bottleneck === "CPU" ? "LACK_CPU" : "LACK_GPU";
  }

  return {
    status,
    message: buildMessage(status, res, hz, estFps, defendedFpsTier, vramHit),
    bottleneck,
    targetHz,
    estimatedFps: estFps,
    defendedFpsTier,
    effectiveScore: Math.round(effective * 10) / 10,
    defenseRatio: Math.round(ratio * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. 한글 문구 빌더
// ─────────────────────────────────────────────────────────────────────────────

function buildMessage(
  status: DisplayTier,
  res: Resolution,
  hz: RefreshRate,
  estFps: number,
  defFps: number,
  vramHit: boolean
): string {
  const R = RES_META[res].label;
  const H = HZ_META[hz].label;
  const vramNote = vramHit ? " · VRAM 용량 부족으로 추가 하락" : "";

  switch (status) {
    case "PERFECT":
      return `${R} ${H} 완벽 방어 가능 — 예상 ${estFps}fps, 옵션 여유까지 확보.`;
    case "GOOD":
      return `${R} ${H} 방어 가능 — 예상 ${estFps}fps, 옵션 여유는 크지 않음.`;
    case "LACK_GPU":
      return `해상도(${R}) 대비 GPU 성능 부족 — ${H} 주사율 활용 불가, 실질 ${defFps}fps 방어 수준.${vramNote} (그래픽 옵션 하향 / DLSS·FSR 업스케일 권장)`;
    case "LACK_CPU":
      return `${H} 목표 대비 CPU 성능 부족 — 프레임 상한이 CPU에서 묶임, 실질 ${defFps}fps 수준. (CPU·RAM 클럭 오버클럭 / 고IPC CPU 권장)`;
    case "CRITICAL":
      return `${R} ${H} 구동 불가 수준 — 실질 ${defFps}fps.${vramNote} (해상도 하향 또는 옵션 대폭 타협 필요)`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. 배치 어댑터 — 엔진 출력(게임 20종) 일괄 평가
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoredGame {
  id?: string;
  label: string;
  category: string;
  score: number;
}

export interface DisplayMatchRow extends DisplayMatchResult {
  label: string;
  category: string;
  baseScore: number;
}

/**
 * benchmark-engine 의 scoreAll() 결과(또는 동형 배열)를 받아
 * 게임 워크로드만 골라 해상도/주사율 매칭을 일괄 반환.
 */
export function evaluateAllGames(
  scores: ScoredGame[],
  res: Resolution,
  hz: RefreshRate,
  vramGB?: number
): DisplayMatchRow[] {
  return scores
    .filter((s) => isGameCategory(s.category))
    .map((s) => ({
      label: s.label,
      category: s.category,
      baseScore: s.score,
      ...evaluateDisplayMatch(s.score, s.category, res, hz, vramGB),
    }));
}

/** 상태 티어 → UI 색상/뱃지 매핑 (프론트 편의) */
export const TIER_UI: Record<DisplayTier, { color: string; badge: string }> = {
  PERFECT: { color: "#22c55e", badge: "완벽 방어" },
  GOOD: { color: "#84cc16", badge: "방어 가능" },
  LACK_GPU: { color: "#f59e0b", badge: "GPU 부족" },
  LACK_CPU: { color: "#f59e0b", badge: "CPU 부족" },
  CRITICAL: { color: "#ef4444", badge: "구동 불가" },
};
