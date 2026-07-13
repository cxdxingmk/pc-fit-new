/**
 * submitScan.ts — 자동감지 결과를 서버로 전송하는 클라이언트 사이드 방어 레이어.
 *
 * 서버 API 자체(엔드포인트, 인증, Rate Limiting, CORS, DB 재검증)는 이 파일의
 * 책임 범위 밖이며 별도 서버 프로젝트에서 구현된다. 여기서는 클라이언트가
 * 반드시 지켜야 할 규약만 다룬다:
 *  1) 화이트리스트 스키마 밖 값은 통째로 요청을 막지 않고 필드 단위로 제거
 *  2) 최소 제출 간격 락 + 중복(진행 중) 호출 차단
 *  3) 엔드포인트는 환경변수로만 주입(하드코딩 금지)
 *  4) IP/위치/이메일 등 식별 정보 금지, 사양 데이터 + 익명 세션 토큰만 전송
 *  5) 서버 응답도 무조건 신뢰하지 않고 렌더링 전 이스케이프
 */
import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// 1. 화이트리스트 스키마
// ═══════════════════════════════════════════════════════════════════════════

const GpuModelField = z.string().max(120);
const ThreadsField = z.number().int().min(1).max(256);
const RamApproxField = z.number().min(0).max(256);
const ScreenField = z.object({
  w: z.number().int().positive().max(20000),
  h: z.number().int().positive().max(20000),
  hzApprox: z.number().int().positive().max(1000).nullable(),
});

export const SubmitScanSchema = z.object({
  /** 로컬에서 생성한 익명 UUID. localStorage에 저장하지 않고 React 상태/URL 파라미터로만 관리한다. */
  sessionToken: z.uuid(),
  gpuModel: GpuModelField.nullable(),
  threads: ThreadsField.nullable(),
  ramApproxGB: RamApproxField.nullable(),
  screen: ScreenField.nullable(),
});

export type SubmitScanPayload = z.infer<typeof SubmitScanSchema>;

export interface RawScanInput {
  sessionToken: string;
  gpuModel?: string | null;
  threads?: number | null;
  ramApproxGB?: number | null;
  screen?: { w: number; h: number; hzApprox: number | null } | null;
}

/** 값이 없으면(null/undefined) 조용히 null 처리, 스키마를 통과 못 하면 경고 로그만 남기고 null 처리. 절대 throw하지 않는다. */
function sanitizeField<T>(schema: z.ZodType<T>, value: unknown, fieldName: string): T | null {
  if (value === null || value === undefined) return null;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  console.warn(`[submitScan] "${fieldName}" 값이 화이트리스트 스키마를 통과하지 못해 전송에서 제외했습니다.`, result.error.issues);
  return null;
}

export function sanitizeScanInput(input: Omit<RawScanInput, "sessionToken">) {
  return {
    gpuModel: sanitizeField(GpuModelField, input.gpuModel, "gpuModel"),
    threads: sanitizeField(ThreadsField, input.threads, "threads"),
    ramApproxGB: sanitizeField(RamApproxField, input.ramApproxGB, "ramApproxGB"),
    screen: sanitizeField(ScreenField, input.screen, "screen"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. 응답 이스케이프 — 서버 값도 무조건 신뢰하지 않는다
// ═══════════════════════════════════════════════════════════════════════════

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 서버 응답 형태는 실제 API 연동 시 확정된다(현재는 플레이스홀더).
 * dangerouslySetInnerHTML을 쓰지 않고 React 자식으로 렌더링하면 자동 이스케이프되지만,
 * 속성값 등 다른 컨텍스트에 쓰일 가능성을 대비해 문자열 필드는 여기서 한 번 더 이스케이프한다.
 */
export function parseScanResponse(raw: unknown): { message: string } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.message !== "string") return null;
  return { message: escapeHtml(record.message) };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. 쓰로틀 + 중복 요청 차단
// ═══════════════════════════════════════════════════════════════════════════

// 호출부(UI)가 쓰로틀 카운트다운을 미리 그릴 수 있도록 export한다.
export const MIN_SUBMIT_INTERVAL_MS = 5000;

let lastSubmitAt = 0;
let inFlightController: AbortController | null = null;

export class SubmitInFlightError extends Error {
  constructor() {
    super("이미 진행 중인 제출 요청이 있습니다.");
    this.name = "SubmitInFlightError";
  }
}

export class SubmitThrottledError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`${Math.ceil(retryAfterMs / 1000)}초 후 다시 시도해 주세요.`);
    this.name = "SubmitThrottledError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** 진행 중인 제출을 명시적으로 취소한다 (예: 호출 컴포넌트 unmount 시 정리용). */
export function cancelInFlightSubmit(): void {
  inFlightController?.abort();
  inFlightController = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. 제출
// ═══════════════════════════════════════════════════════════════════════════

// TODO(API 연동): .env.local에 실제 API 서버 주소를 채워 넣으세요.
//   NEXT_PUBLIC_API_BASE_URL=https://api.example.com
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

// 응답이 이보다 오래 걸리면 pending 상태로 영원히 묶여있지 않게 강제로 취소한다.
const SUBMIT_TIMEOUT_MS = 10000;

export interface SubmitScanResult {
  ok: boolean;
  data?: unknown;
  error?: "invalid_payload" | "missing_api_base_url" | "timeout" | "aborted" | "network_error" | `http_${number}`;
}

export async function submitScan(input: RawScanInput): Promise<SubmitScanResult> {
  if (inFlightController) {
    throw new SubmitInFlightError();
  }

  const now = Date.now();
  const elapsed = now - lastSubmitAt;
  if (lastSubmitAt > 0 && elapsed < MIN_SUBMIT_INTERVAL_MS) {
    throw new SubmitThrottledError(MIN_SUBMIT_INTERVAL_MS - elapsed);
  }

  const sanitized = sanitizeScanInput(input);
  const parsed = SubmitScanSchema.safeParse({ sessionToken: input.sessionToken, ...sanitized });
  if (!parsed.success) {
    console.error("[submitScan] 최종 페이로드 검증 실패 — 전송을 중단합니다.", parsed.error.issues);
    return { ok: false, error: "invalid_payload" };
  }

  if (!API_BASE_URL) {
    console.warn("[submitScan] NEXT_PUBLIC_API_BASE_URL이 설정되지 않아 전송을 건너뜁니다. .env.local에 값을 채워주세요.");
    return { ok: false, error: "missing_api_base_url" };
  }

  const controller = new AbortController();
  inFlightController = controller;

  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUBMIT_TIMEOUT_MS);

  try {
    // TODO(API 연동): 실제 엔드포인트 경로 및 인증 헤더(예: Authorization)를 채워 넣으세요.
    const response = await fetch(`${API_BASE_URL}/scan/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: controller.signal,
    });

    lastSubmitAt = Date.now();

    if (!response.ok) {
      return { ok: false, error: `http_${response.status}` };
    }

    const data: unknown = await response.json();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: timedOut ? "timeout" : "aborted" };
    }
    console.error("[submitScan] 요청 실패", error);
    return { ok: false, error: "network_error" };
  } finally {
    clearTimeout(timeoutId);
    if (inFlightController === controller) inFlightController = null;
  }
}
