"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

// App Router는 라우트 이동이 클라이언트 사이드 전환(전체 페이지 재로딩 없음)이라, gtag.js를
// 처음 한 번만 로드하면 이후 페이지 이동에서는 GA4가 pageview를 스스로 잡아내지 못한다 — 매
// pathname/searchParams 변화마다 직접 gtag('config', ...)를 다시 호출해 pageview를 수동으로
// 보고한다. useSearchParams는 이 훅을 쓰는 컴포넌트를 클라이언트 전용 렌더로 바꾸므로(빌드 시
// 정적 생성과 충돌) Suspense로 감싸야 한다.
function GAPageviewListener({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || typeof window.gtag !== "function") return;
    const query = searchParams.toString();
    window.gtag("config", gaId, { page_path: query ? `${pathname}?${query}` : pathname });
  }, [pathname, searchParams, gaId]);

  return null;
}

export default function GoogleAnalytics({ gaId }: { gaId: string }) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
      <Suspense fallback={null}>
        <GAPageviewListener gaId={gaId} />
      </Suspense>
    </>
  );
}
