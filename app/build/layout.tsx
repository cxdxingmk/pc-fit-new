import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI 맞춤 PC 구성",
  description: "예산과 사용 목적을 입력하면 AI가 맞는 부품 조합을 추천해드립니다.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
