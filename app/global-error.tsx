"use client";

import { useEffect } from "react";

/**
 * 루트 레이아웃(app/layout.tsx) 자체가 던지는 에러를 잡는 최후의 방어선.
 * error.tsx는 레이아웃 "안쪽" 콘텐츠만 대체하므로 레이아웃 자체가 깨지면 무력하다 —
 * 이 파일은 <html>/<body>를 직접 렌더링해야 하고, 다른 provider/전역 CSS에
 * 의존하지 않도록 인라인 스타일만 사용한다(그 provider가 원인일 수도 있으므로).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/global-error.tsx] 루트 레이아웃 에러", error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0a0b0f",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <p style={{ fontSize: 36, margin: 0 }}>⚠️</p>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>일시적인 문제가 생겼어요</h1>
        <p style={{ maxWidth: 360, fontSize: 14, color: "rgba(255,255,255,0.6)", margin: 0 }}>
          새로고침 해주세요. 문제가 계속되면 잠시 후 다시 시도해 주세요.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            borderRadius: 16,
            background: "#4c7dff",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            padding: "12px 20px",
            border: "none",
            cursor: "pointer",
          }}
        >
          새로고침
        </button>
      </body>
    </html>
  );
}
