import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 PC 분석",
  description: "등록한 내 PC의 성능 점수와 업그레이드 제안을 확인하세요.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
