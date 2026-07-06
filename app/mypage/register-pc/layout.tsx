import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 PC 등록",
  description: "보유 부품을 등록하고 맞춤 분석을 받아보세요.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
