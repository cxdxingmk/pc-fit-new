import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TOP 3 PC 견적 추천 결과",
  description: "입력하신 예산과 목적에 맞춘 TOP 3 PC 견적 세트를 확인하세요.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
