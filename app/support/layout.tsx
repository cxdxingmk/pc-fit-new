import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "고객센터",
  description: "문의사항과 의견을 남겨주세요.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
