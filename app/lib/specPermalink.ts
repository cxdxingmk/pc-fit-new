import type { Resolution, RefreshRate } from "./displayMatch";

/**
 * /my-pc?spec=... 퍼머링크 — 현재 입력한 사양을 URL 한 줄로 직렬화한다.
 * 계정/DB 없이 "링크 자체가 저장소" 역할을 하므로, 필드는 부품 id(짧은 문자열)만 담고
 * base64(UTF-8 안전 처리) + URL-safe 치환으로 압축한다.
 */
export interface SpecSnapshot {
  c: string; // cpuId
  g: string; // gpuId
  r: string; // ramId
  s: string; // ssdId
  m: string; // motherboardId
  p: string; // psu (자유 입력 텍스트)
  mr: Resolution; // monitorRes
  mh: RefreshRate; // monitorHz
}

export function encodeSpec(spec: SpecSnapshot): string {
  const json = JSON.stringify(spec);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** 손상되거나 형식이 안 맞는 문자열이 와도 절대 throw하지 않고 null만 반환한다(호출부가 조용히 기본값으로 폴백). */
export function decodeSpec(encoded: string): SpecSnapshot | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(base64)));
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "c" in parsed &&
      "g" in parsed &&
      "r" in parsed &&
      "s" in parsed &&
      "m" in parsed &&
      "p" in parsed &&
      "mr" in parsed &&
      "mh" in parsed
    ) {
      return parsed as SpecSnapshot;
    }
    return null;
  } catch {
    return null;
  }
}
