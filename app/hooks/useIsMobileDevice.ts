"use client";

import { useEffect, useState } from "react";
import { isProbablyMobile } from "../lib/deviceDetect";

/**
 * 판별 전에는 null을 반환해 "판별 중 / PC / 모바일" 3단계를 구분할 수 있게 한다.
 * useEffect 안에서만 판별해야 서버·클라이언트 첫 렌더 결과가 같아 하이드레이션이
 * 어긋나지 않는다(서버는 항상 null을 렌더하고, 클라이언트도 마운트 전까진 null).
 */
export function useIsMobileDevice(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMobile(isProbablyMobile());
  }, []);

  return isMobile;
}
