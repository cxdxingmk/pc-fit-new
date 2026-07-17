import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { encodeSpec } from "@/app/lib/specPermalink";

/**
 * next/og의 ImageResponse는 satori(JSX→SVG) + resvg-wasm(SVG→PNG)로 실제 이미지를 렌더링하는데,
 * resvg-wasm이 vitest(jsdom/node) 환경에서는 "Unsupported input" 에러로 동작하지 않는다(실제
 * Edge 런타임에서만 정상 동작 — 라이브 프로덕션에서는 스크린샷으로 별도 확인함). 그래서 여기서는
 * ImageResponse를 모킹해 GET()이 실제로 만드는 JSX 트리(점수/CPU/GPU 텍스트)만 검증한다 —
 * "og:image가 spec마다 다른 내용을 렌더링하는가"라는 핵심 회귀를 이미지 픽셀 없이도 잡아낸다.
 */
let capturedElement: ReactElement | null = null;

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(element: ReactElement) {
      capturedElement = element;
      return new Response(null, { status: 200, headers: { "content-type": "image/png" } }) as never;
    }
  },
}));

import { GET } from "./route";

function htmlFor(element: ReactElement | null): string {
  if (!element) throw new Error("ImageResponse가 호출되지 않았다");
  return renderToStaticMarkup(element);
}

const SPEC_A = encodeSpec({ c: "i5-14600kf", g: "rx7600", r: "64-ddr5-6400", s: "sn770-1tb", m: "z790-tuf-gaming", p: "750W", mr: "QHD", mh: 144 });
const SPEC_B = encodeSpec({ c: "r5-5600", g: "gtx1660super", r: "16-ddr4-3200", s: "sn770-1tb", m: "b550m-aorus-pro", p: "500W", mr: "QHD", mh: 144 });

describe("/api/og — spec 쿼리 파라미터에 따른 개인화 OG 이미지", () => {
  beforeEach(() => {
    capturedElement = null;
  });

  it("spec이 없으면 범용 폴백 문구를 렌더한다", async () => {
    await GET(new Request("http://localhost/api/og"));
    const html = htmlFor(capturedElement);
    expect(html).toContain("내 PC 성능, 지금 바로 확인해보세요");
  });

  it("유효한 spec이 있으면 종합 점수 + CPU/GPU 이름을 렌더하고, 범용 폴백 문구는 나오지 않는다", async () => {
    await GET(new Request(`http://localhost/api/og?spec=${SPEC_A}`));
    const html = htmlFor(capturedElement);

    expect(html).toContain("Core i5-14600KF");
    expect(html).toContain("Radeon RX 7600");
    expect(html).toMatch(/\d+<!-- -->\/100|\d+\/100|>\d+</); // 점수 숫자가 렌더된다(마크업 포맷에 안전하게)
    expect(html).not.toContain("내 PC 성능, 지금 바로 확인해보세요");
  });

  it("서로 다른 두 spec은 서로 다른 이미지 내용(점수/CPU/GPU)을 렌더한다(핵심 회귀)", async () => {
    await GET(new Request(`http://localhost/api/og?spec=${SPEC_A}`));
    const htmlA = htmlFor(capturedElement);

    capturedElement = null;
    await GET(new Request(`http://localhost/api/og?spec=${SPEC_B}`));
    const htmlB = htmlFor(capturedElement);

    expect(htmlA).not.toBe(htmlB);
    expect(htmlA).toContain("Core i5-14600KF");
    expect(htmlA).not.toContain("Ryzen 5 5600");
    expect(htmlB).toContain("Ryzen 5 5600");
    expect(htmlB).not.toContain("Core i5-14600KF");
  });

  it("깨진(디코딩 실패) spec은 조용히 범용 폴백으로 처리된다(throw하지 않음)", async () => {
    await expect(GET(new Request("http://localhost/api/og?spec=not-valid-base64!!!"))).resolves.toBeDefined();
    const html = htmlFor(capturedElement);
    expect(html).toContain("내 PC 성능, 지금 바로 확인해보세요");
  });

  it("카탈로그에 없는 부품 id가 섞인 spec도 범용 폴백으로 안전하게 처리된다", async () => {
    const brokenSpec = encodeSpec({ c: "no-such-cpu", g: "no-such-gpu", r: "no-such-ram", s: "no-such-ssd", m: "no-such-mb", p: "500W", mr: "QHD", mh: 144 });
    await GET(new Request(`http://localhost/api/og?spec=${brokenSpec}`));
    const html = htmlFor(capturedElement);
    expect(html).toContain("내 PC 성능, 지금 바로 확인해보세요");
  });
});
