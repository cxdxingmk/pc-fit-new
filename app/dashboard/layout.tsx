import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "성능 대시보드",
  description: "내 PC의 병목 구간과 게임별 예상 프레임을 확인하세요.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
