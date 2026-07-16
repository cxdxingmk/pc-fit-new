import type { Metadata } from "next";
import MyPcClient from "./MyPcClient";
import Container from "@/components/layout/Container";

const KOREAN_TITLE = "내 PC 성능";
const KOREAN_DESCRIPTION = "로그인 없이, 3초 만에 시작하는 내 PC 성능 진단서 — 종합 점수와 게임별 예상 프레임을 확인하세요.";

// 퍼머링크(?spec=...)로 공유된 링크마다 실제 진단 결과가 담긴 OG 이미지가 뜨도록,
// 같은 spec 파라미터를 /api/og로 그대로 전달한다(searchParams는 page.js 세그먼트에서만
// 접근 가능 — opengraph-image.tsx 파일 컨벤션은 이걸 못 받아 쓸 수 없다).
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ spec?: string }> }): Promise<Metadata> {
  const { spec } = await searchParams;
  const ogImageUrl = spec ? `/api/og?spec=${encodeURIComponent(spec)}` : "/api/og";

  return {
    title: KOREAN_TITLE,
    description: KOREAN_DESCRIPTION,
    openGraph: {
      title: `${KOREAN_TITLE} | PC FIT`,
      description: KOREAN_DESCRIPTION,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${KOREAN_TITLE} | PC FIT`,
      description: KOREAN_DESCRIPTION,
      images: [ogImageUrl],
    },
  };
}

export default function Page() {
  return (
    <main className="py-12">
      <Container>
        <h1 className="mb-2 text-2xl font-bold text-white">내 PC 성능 보기</h1>
        <p className="mb-6 text-sm text-white/60">보유 중인 부품을 선택하면 게임·작업·AI 성능을 직관적으로 확인할 수 있습니다.</p>
        <MyPcClient />
      </Container>
    </main>
  );
}
