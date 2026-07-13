/**
 * deviceDetect.ts — 모바일 기기 판별. GPU 자동감지(WebGL)처럼 "지금 보고 있는
 * 기기"의 GPU를 읽는 기능이 폰에서 무의미해지는 걸 막기 위한 용도로만 쓴다.
 *
 * 화면 폭으로 판단하지 않는다 — 작은 창으로 띄운 PC 브라우저를 모바일로
 * 오판하면 안 되므로 반드시 User-Agent/UA-CH 기반으로만 판별한다.
 */

/** User-Agent Client Hints API — 표준 lib.dom.d.ts에 없는 실험적 크롬 계열 전용 API. */
interface NavigatorUAData {
  mobile: boolean;
}

interface NavigatorWithUAData extends Navigator {
  userAgentData?: NavigatorUAData;
}

const MOBILE_UA_PATTERN = /Android|iPhone|iPad|iPod|Mobile/i;

export function isProbablyMobile(): boolean {
  // SSR 등 navigator 자체가 없는 환경 — 실제 판별은 클라이언트 마운트 후에만
  // 신뢰해야 하므로(하이드레이션 불일치 방지) 훅(useIsMobileDevice) 쪽에서 처리한다.
  if (typeof navigator === "undefined") return false;

  try {
    const uaData = (navigator as NavigatorWithUAData).userAgentData;
    if (uaData && typeof uaData.mobile === "boolean") {
      return uaData.mobile;
    }
  } catch {
    // userAgentData 접근 자체가 막힌 환경 — 아래 UA 문자열 폴백으로 내려간다.
  }

  try {
    return MOBILE_UA_PATTERN.test(navigator.userAgent);
  } catch {
    return false;
  }
}
