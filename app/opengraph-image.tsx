import { ImageResponse } from "next/og";

export const alt = "PC FIT — 로그인 없이 3초 만에 시작하는 PC 성능 진단";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// next/og(Satori)는 flexbox 인라인 스타일만 지원한다 — Tailwind 클래스/외부 CSS 불가.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0A0B0F",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            height: 84,
            width: 84,
            borderRadius: 24,
            background: "linear-gradient(135deg, #4C7DFF, #6E96FF)",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 21h8M12 16v5" />
          </svg>
        </div>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 800, color: "#ffffff", letterSpacing: -1 }}>PC FIT</div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 34, color: "rgba(255,255,255,0.6)" }}>
          로그인 없이, 3초 만에 시작하는 PC 성능 진단
        </div>
      </div>
    ),
    { ...size }
  );
}
