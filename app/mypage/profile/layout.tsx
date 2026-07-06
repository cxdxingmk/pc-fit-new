import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "내 정보 관리",
  description: "계정 정보를 확인하고 관리하세요.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
