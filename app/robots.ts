import type { MetadataRoute } from "next";

// layout.tsx/sitemap.ts와 동일한 siteBaseUrl 산출 로직.
const PRODUCTION_SITE_URL = "https://pc-fit-new.vercel.app";
const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`
  : process.env.VERCEL
    ? PRODUCTION_SITE_URL
    : "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /mypage: 로그인 후 개인화 화면(내 분석·프로필·PC 등록). /admin: 운영자 전용.
      // sitemap.ts의 EXCLUDED_PREFIXES와 반드시 맞춘다.
      disallow: ["/mypage", "/admin", "/api/"],
    },
    sitemap: `${siteBaseUrl}/sitemap.xml`,
  };
}
