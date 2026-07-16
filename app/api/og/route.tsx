import { ImageResponse } from "next/og";
import { decodeSpec } from "@/app/lib/specPermalink";
import { getMyPcScore } from "@/app/lib/myPc";
import { cpus } from "@/app/database/cpu";
import { gpus } from "@/app/database/gpu";
import { rams } from "@/app/database/ram";
import { ssds } from "@/app/database/ssd";
import { motherboards } from "@/app/database/motherboard";

export const runtime = "edge";

const SIZE = { width: 1200, height: 630 };

/**
 * /my-pc?spec=... 로 공유된 링크마다 실제 진단 결과(종합 점수 + 대표 부품)가 들어간 OG 이미지를
 * 생성한다. opengraph-image.tsx 파일 컨벤션은 searchParams를 못 받아 쓸 수 없어(문서상 params만
 * 지원) 일반 Route Handler + ImageResponse 조합으로 직접 구현했다 — app/my-pc/page.tsx의
 * generateMetadata가 이 라우트를 openGraph.images로 가리킨다.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const specParam = searchParams.get("spec");
  const decoded = specParam ? decodeSpec(specParam) : null;

  const cpu = decoded ? cpus.find((c) => c.id === decoded.c) : undefined;
  const gpu = decoded ? gpus.find((g) => g.id === decoded.g) : undefined;
  const ram = decoded ? rams.find((r) => r.id === decoded.r) : undefined;
  const ssd = decoded ? ssds.find((s) => s.id === decoded.s) : undefined;
  const motherboard = decoded ? motherboards.find((m) => m.id === decoded.m) : undefined;

  const score = cpu && gpu && ram && ssd && motherboard ? getMyPcScore({ cpu, gpu, ram, ssd, motherboard }) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: "#0A0B0F",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              height: 56,
              width: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg, #4C7DFF, #6E96FF)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="12" rx="2" />
              <path d="M8 21h8M12 16v5" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 800, color: "#ffffff" }}>PC FIT · PC 진단서</div>
        </div>

        {score && cpu && gpu ? (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <div style={{ display: "flex", fontSize: 160, fontWeight: 800, color: "#4C7DFF", lineHeight: 1 }}>{score.totalScore}</div>
              <div style={{ display: "flex", fontSize: 48, color: "rgba(255,255,255,0.4)" }}>/100</div>
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: "rgba(255,255,255,0.75)" }}>
              {cpu.name} · {gpu.name}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", marginTop: 24 }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, color: "#ffffff" }}>내 PC 성능, 지금 바로 확인해보세요</div>
            <div style={{ display: "flex", marginTop: 16, fontSize: 28, color: "rgba(255,255,255,0.55)" }}>
              로그인 없이, 3초 만에 시작하는 무료 PC 성능 진단
            </div>
          </div>
        )}

        <div style={{ display: "flex", fontSize: 24, color: "rgba(255,255,255,0.3)" }}>
          {(process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).host).replace(/^https?:\/\//, "")}
        </div>
      </div>
    ),
    { ...SIZE }
  );
}
