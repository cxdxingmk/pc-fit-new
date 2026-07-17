import { describe, expect, it } from "vitest";
import { generateMetadata } from "./page";
import { encodeSpec } from "../lib/specPermalink";

const SPEC = encodeSpec({ c: "i5-14600kf", g: "rx7600", r: "64-ddr5-6400", s: "sn770-1tb", m: "z790-tuf-gaming", p: "750W", mr: "QHD", mh: 144 });

describe("/my-pc generateMetadata — spec을 og:image/twitter:image에 전달", () => {
  it("spec이 없으면 쿼리 파라미터 없는 범용 이미지 경로를 쓴다", async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({}) });

    const ogImage = metadata.openGraph?.images;
    const ogUrl = Array.isArray(ogImage) ? (ogImage[0] as { url: string }).url : undefined;
    expect(ogUrl).toBe("/api/og");

    const twitterImage = metadata.twitter && "images" in metadata.twitter ? metadata.twitter.images : undefined;
    expect(twitterImage).toEqual(["/api/og"]);
  });

  it("spec이 있으면 og:image/twitter:image 모두 같은 spec 쿼리 파라미터를 포함한다", async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ spec: SPEC }) });

    const ogImage = metadata.openGraph?.images;
    const ogUrl = Array.isArray(ogImage) ? (ogImage[0] as { url: string }).url : undefined;
    expect(ogUrl).toBe(`/api/og?spec=${encodeURIComponent(SPEC)}`);

    const twitterImage = metadata.twitter && "images" in metadata.twitter ? metadata.twitter.images : undefined;
    expect(twitterImage).toEqual([`/api/og?spec=${encodeURIComponent(SPEC)}`]);
  });

  it("서로 다른 spec은 서로 다른 og:image URL을 만든다", async () => {
    const specB = encodeSpec({ c: "r5-5600", g: "gtx1660super", r: "16-ddr4-3200", s: "sn770-1tb", m: "b550m-aorus-pro", p: "500W", mr: "QHD", mh: 144 });

    const metaA = await generateMetadata({ searchParams: Promise.resolve({ spec: SPEC }) });
    const metaB = await generateMetadata({ searchParams: Promise.resolve({ spec: specB }) });

    const urlOf = (m: Awaited<ReturnType<typeof generateMetadata>>) => {
      const images = m.openGraph?.images;
      return Array.isArray(images) ? (images[0] as { url: string }).url : undefined;
    };

    expect(urlOf(metaA)).not.toBe(urlOf(metaB));
  });
});
