import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import Header from "../components/Header";
import Footer from "../components/Footer";
import GoogleAnalytics from "../components/GoogleAnalytics";
import { BuildProvider } from "./context/BuildContext";
import { AuthProvider } from "./context/AuthContext";
import { getServerAuthUser } from "./lib/supabase/getServerAuthUser";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 실제 서비스 도메인 — 커스텀 도메인을 연결하기 전까지는 이 Vercel 기본 도메인이 프로덕션 주소다.
const PRODUCTION_SITE_URL = "https://pc-fit-new.vercel.app";

// 우선순위: NEXT_PUBLIC_SITE_URL(직접 설정, 커스텀 도메인 연결 시 이 값만 바꾸면 된다) → 고정
// 프로덕션 도메인 → 로컬 개발 폴백.
// VERCEL_URL(배포마다 바뀌는 임시 미리보기 주소, 예: pc-fit-xxxxx.vercel.app)은 절대 쓰지 않는다 —
// 그 주소로 만든 og:image/twitter:image 절대 URL은 Vercel 배포 보호(SSO)에 막혀 카카오톡/트위터
// 크롤러가 열지 못하고 계속 로딩 중 상태로 멈춘다(실제로 겪은 버그). process.env.VERCEL은 프로덕션·
// 프리뷰 배포 전부에서 "1"로 주입되므로, Vercel 위에서 도는 배포는 전부 고정 도메인을 쓰고 로컬
// 개발 서버에서만 localhost로 폴백한다.
const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`
  : process.env.VERCEL
    ? PRODUCTION_SITE_URL
    : "http://localhost:3000";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getServerAuthUser();
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

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
        {gaMeasurementId ? <GoogleAnalytics gaId={gaMeasurementId} /> : null}
        <Analytics />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-[-200px] mx-auto h-[480px] w-[720px] rounded-full bg-brand/10 blur-[120px]"
        />
        <AuthProvider initialUser={initialUser}>
          <BuildProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </BuildProvider>
        </AuthProvider>
      </body>
    </html>
  );
}