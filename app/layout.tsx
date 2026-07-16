import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Header from "../components/Header";
import { BuildProvider } from "./context/BuildContext";
import { AuthProvider } from "./context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 우선순위: NEXT_PUBLIC_SITE_URL(직접 설정) → Vercel이 배포마다 자동 주입하는 VERCEL_URL →
// 로컬 개발 폴백. 하드코딩된 임의 도메인은 쓰지 않는다(ShareReportCard의 resolvedServiceUrl과
// 동일한 원칙).
const configuredHost = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL;
const siteBaseUrl = configuredHost ? `https://${configuredHost.replace(/^https?:\/\//, "")}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteBaseUrl),
  title: { default: "PC FIT | AI 기반 PC 견적 추천", template: "%s | PC FIT" },
  description: "예산과 사용 목적에 맞춰 AI가 PC 부품을 추천하고 병목 현상까지 분석해주는 무료 PC 견적 서비스",
  openGraph: {
    title: "PC FIT | AI 기반 PC 견적 추천",
    description: "예산과 사용 목적에 맞춰 AI가 PC 부품을 추천하고 병목 현상까지 분석해주는 무료 PC 견적 서비스",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PC FIT | AI 기반 PC 견적 추천",
    description: "예산과 사용 목적에 맞춰 AI가 PC 부품을 추천하고 병목 현상까지 분석해주는 무료 PC 견적 서비스",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body className="min-h-screen overflow-x-clip bg-ink text-white antialiased selection:bg-brand/30">
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-[-200px] mx-auto h-[480px] w-[720px] rounded-full bg-brand/10 blur-[120px]"
        />
        <AuthProvider>
          <BuildProvider>
            <Header />
            {children}
          </BuildProvider>
        </AuthProvider>
      </body>
    </html>
  );
}