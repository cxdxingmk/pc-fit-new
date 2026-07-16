/**
 * browserScan.ts — WebGL/브라우저 API 기반 하드웨어 자동감지.
 *
 * 모든 감지 함수는 절대 throw하지 않는다: 지원하지 않는 브라우저·환경에서도
 * null/undefined 폴백만 반환하고 나머지 감지에 영향을 주지 않는다.
 * 노트북 감지/분기는 이번 범위에서 제외 — 데스크톱 기준 값만 반환한다.
 */

/** Device Memory API는 표준 lib.dom.d.ts에 없는 실험적 크롬 계열 전용 API라 별도 타입 확장이 필요하다. */
interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

export interface ScreenScanResult {
  /** devicePixelRatio 반영 실측 가로 픽셀 */
  w: number;
  /** devicePixelRatio 반영 실측 세로 픽셀 */
  h: number;
  /** rAF 20프레임 측정 기반 근사 주사율(Hz). 측정 실패 시 null */
  hzApprox: number | null;
}

export interface BrowserScanResult {
  gpu: string | null;
  threads: number | null;
  ramApproxGB: number | null;
  screen: ScreenScanResult | null;
}

/**
 * ANGLE 래핑 문자열(예: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)")
 * 에서 실제 모델명만 뽑아낸다. 매칭 실패 시 원문을 그대로 반환한다(과도한 손실 방지).
 */
export function normalizeGpuName(raw: string): string {
  const angleMatch = raw.match(/^ANGLE\s*\((.+)\)$/i);
  const inner = angleMatch ? angleMatch[1] : raw;

  const parts = inner.split(",").map((part) => part.trim()).filter(Boolean);
  let model = parts.length >= 2 ? parts[1] : parts[0];

  // 뒤에 붙는 드라이버/API 토큰(Direct3D11 vs_5_0 ps_5_0, OpenGL, Vulkan 등) 제거
  model = model.replace(/\s+(Direct3D\d*|OpenGL\s*(ES)?|Vulkan|Metal)\b.*$/i, "").trim();

  return model || raw.trim();
}

export function detectGpu(): string | null {
  // SSR 안전장치 — document/canvas가 없는 서버 렌더 단계에서는 즉시 null.
  if (typeof window === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    // powerPreference 힌트 없이 컨텍스트를 만들면, 하이브리드 그래픽(NVIDIA Optimus/AMD
    // Switchable) 노트북에서 OS/드라이버가 매번 내장·외장 GPU 중 아무거나 배정할 수 있어
    // 같은 기기에서 재진단할 때마다 UNMASKED_RENDERER_WEBGL 원문 자체가 달라지는 경우가
    // 있었다(예: RTX 5070 → GTX 1660 SUPER). "고성능" 힌트로 외장 GPU를 우선 배정받도록
    // 유도한다 — OS/드라이버 정책에 달려 있어 100% 보장은 아니므로 표시는 여전히 추정으로 둔다.
    const contextAttributes: WebGLContextAttributes = { powerPreference: "high-performance", failIfMajorPerformanceCaveat: false };
    const gl = (canvas.getContext("webgl2", contextAttributes) ??
      canvas.getContext("webgl", contextAttributes) ??
      canvas.getContext("experimental-webgl", contextAttributes)) as WebGLRenderingContext | null;
    if (!gl) return null;

    // Safari/프라이버시 강화 브라우저 등에서는 확장 자체가 없을 수 있다.
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return null;

    const rendererRaw = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string | null;
    if (!rendererRaw || typeof rendererRaw !== "string") return null;

    const normalized = normalizeGpuName(rendererRaw);

    if (process.env.NODE_ENV !== "production") {
      console.log("[browserScan] GPU 원문:", rendererRaw, "→ 정규화:", normalized);
    }

    return normalized;
  } catch {
    return null;
  }
}

export function detectThreads(): number | null {
  try {
    const value = navigator.hardwareConcurrency;
    return typeof value === "number" && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function detectRamApprox(): number | null {
  try {
    const value = (navigator as NavigatorWithDeviceMemory).deviceMemory;
    return typeof value === "number" && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** navigator.deviceMemory 스펙상 실제로 보고 가능한 값(0.25/0.5/1/2/4/8, 8 이상은 전부 8로 캡). */
const DEVICE_MEMORY_REPORTING_CAP_GB = 8;

/**
 * deviceMemory 값을 그대로 "약 8GB"처럼 표시하면, 실제로는 16/32/64GB인 기기도 브라우저가
 * fingerprinting 방지를 위해 8에서 캡을 씌워 보고하기 때문에 8GB '미만'이라는 잘못된 인상을
 * 준다. 8(캡에 걸린 값)일 때는 "그 이상일 수 있다"를 명시하고, 캡 아래 값은 신뢰할 수 있는
 * 실측치이므로 그대로 보여준다.
 */
export function formatRamApproxDisplay(deviceMemoryGB: number): string {
  if (deviceMemoryGB >= DEVICE_MEMORY_REPORTING_CAP_GB) {
    return `${DEVICE_MEMORY_REPORTING_CAP_GB}GB 이상 (브라우저 제한상 정확한 값은 확인할 수 없어요)`;
  }
  return `약 ${deviceMemoryGB}GB`;
}

const REFRESH_MEASURE_FRAMES = 20;

/** requestAnimationFrame 20프레임의 평균 간격으로 주사율을 근사한다. */
function measureRefreshRate(): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      if (typeof requestAnimationFrame !== "function") {
        resolve(null);
        return;
      }
      let frameCount = 0;
      let last = performance.now();
      const deltas: number[] = [];

      const tick = (now: number) => {
        const delta = now - last;
        last = now;
        // 첫 델타는 호출 예약 지연이 섞여 신뢰도가 낮아 표본에서 제외한다.
        if (frameCount > 0) deltas.push(delta);
        frameCount++;

        if (frameCount <= REFRESH_MEASURE_FRAMES) {
          requestAnimationFrame(tick);
          return;
        }

        if (deltas.length === 0) {
          resolve(null);
          return;
        }
        const avgDelta = deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
        resolve(avgDelta > 0 ? Math.round(1000 / avgDelta) : null);
      };

      requestAnimationFrame(tick);
    } catch {
      resolve(null);
    }
  });
}

export async function detectScreen(): Promise<ScreenScanResult | null> {
  try {
    const dpr = typeof window !== "undefined" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    const w = Math.round(screen.width * dpr);
    const h = Math.round(screen.height * dpr);
    if (!w || !h) return null;

    const hzApprox = await measureRefreshRate();
    return { w, h, hzApprox };
  } catch {
    return null;
  }
}

/** 4개 감지를 병렬 실행해 하나의 결과 객체로 합친다. 일부가 실패해도 나머지는 정상 반환된다. */
export async function runFullScan(): Promise<BrowserScanResult> {
  const [gpu, threads, ramApproxGB, screen] = await Promise.all([
    Promise.resolve().then(detectGpu),
    Promise.resolve().then(detectThreads),
    Promise.resolve().then(detectRamApprox),
    detectScreen(),
  ]);

  return { gpu, threads, ramApproxGB, screen };
}
