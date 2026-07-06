import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "부품 추천 & 병목 분석",
  description: "CPU/GPU 조합별 병목 현상과 예상 FPS를 분석해드립니다.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
