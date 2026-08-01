import type { MetadataRoute } from "next";
import fs from "node:fs";
import path from "node:path";

// layout.tsx의 siteBaseUrl 산출 로직과 동일 — VERCEL_URL(배포마다 바뀌는 프리뷰 주소)은
// 절대 쓰지 않는다(og:image가 Vercel 배포 보호에 막혀 카카오톡/트위터 크롤러가 못 여는 문제를
// layout.tsx에서 겪었던 것과 같은 이유로, sitemap의 <loc>도 항상 고정 도메인이어야 한다).
const PRODUCTION_SITE_URL = "https://pc-fit-new.vercel.app";
const siteBaseUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`
  : process.env.VERCEL
    ? PRODUCTION_SITE_URL
    : "http://localhost:3000";

// 로그인 뒤 개인화된 화면은 검색 노출 대상이 아니다 — robots.ts의 disallow 목록과 반드시 함께 맞춘다.
const EXCLUDED_PREFIXES = ["/mypage", "/admin"];

const APP_DIR = path.join(process.cwd(), "app");

/**
 * app/ 디렉터리를 훑어 실제 page.tsx가 있는 정적 라우트를 자동 수집한다 — 새 페이지가 추가돼도
 * 이 파일을 손으로 갱신할 필요가 없다. 동적 세그먼트([id] 등)·라우트 그룹((group))·api 라우트·
 * 개인화 페이지는 제외한다.
 */
function collectStaticRoutes(dir: string, urlPrefix: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const routes: string[] = [];

  if (entries.some((entry) => entry.isFile() && entry.name === "page.tsx")) {
    routes.push(urlPrefix || "/");
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("[")) continue; // 동적 세그먼트 제외
    if (entry.name === "api") continue;

    // 라우트 그룹 "(group)"은 URL 경로에 나타나지 않는다.
    const childUrlPrefix = entry.name.startsWith("(") ? urlPrefix : `${urlPrefix}/${entry.name}`;

    if (EXCLUDED_PREFIXES.some((excluded) => childUrlPrefix === excluded || childUrlPrefix.startsWith(`${excluded}/`))) {
      continue;
    }

    routes.push(...collectStaticRoutes(path.join(dir, entry.name), childUrlPrefix));
  }

  return routes;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = collectStaticRoutes(APP_DIR, "").sort();

  return routes.map((route) => ({
    url: `${siteBaseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
