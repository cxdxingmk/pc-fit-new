import type { Metadata } from "next";
import OptimizeClient from "./OptimizeClient";
import Container from "@/components/layout/Container";

const KOREAN_TITLE = "성능 최적화 가이드";
const KOREAN_DESCRIPTION = "설치 없이, 내 PC 사양에 맞는 게임 그래픽 옵션 추천과 Windows 최적화 체크리스트, 드라이버 업데이트 확인법을 한 번에 확인하세요.";

export const metadata: Metadata = {
  title: KOREAN_TITLE,
  description: KOREAN_DESCRIPTION,
  openGraph: {
    title: `${KOREAN_TITLE} | PC FIT`,
    description: KOREAN_DESCRIPTION,
  },
};

export default function Page() {
  return (
    <main className="py-12">
      <Container>
        <h1 className="mb-2 text-2xl font-bold text-white">설치 없이, 성능 최적화 가이드</h1>
        <p className="mb-6 text-sm text-white/60">
          아무것도 설치하지 않아도 괜찮아요. 사양만 알려주시면 게임 그래픽 옵션 추천과 Windows 최적화 체크리스트, 드라이버 업데이트 확인법을 정리해드려요.
        </p>
        <OptimizeClient />
      </Container>
    </main>
  );
}
