import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "PC FIT | AI 기반 PC 견적 추천",
    template: "%s | PC FIT",
  },
  description:
    "PC FIT 서비스 탐색을 위한 공통 네비게이션 영역입니다. AI 기반으로 맞춤형 PC 견적과 업그레이드 방향을 빠르게 확인할 수 있습니다.",
};

type ComponentsLayoutProps = {
  children: ReactNode;
};

export default function ComponentsLayout({ children }: ComponentsLayoutProps) {
  return <>{children}</>;
}