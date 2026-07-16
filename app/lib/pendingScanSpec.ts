import type { UpsertSavedPcSpecInput } from "./pcSpecs";

// CMD 자동 등록 확인 단계에서 "예"를 눌렀는데 비로그인 상태면, 로그인 페이지로 보내기 전에
// 파싱된 값을 세션스토리지에 잠깐 담아둔다 — 로그인 완료 후 register-pc로 돌아왔을 때
// 다시 붙여넣지 않고도 그대로 이어서 등록할 수 있게 하기 위함(탭을 닫으면 사라지는 게 맞음).
const STORAGE_KEY = "pcfit_pending_scan_spec";

export function savePendingScanSpec(spec: UpsertSavedPcSpecInput): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(spec));
  } catch {
    // 세션스토리지 접근 불가(프라이빗 모드 등) — 값 보존은 best-effort라 조용히 무시한다.
  }
}

export function readPendingScanSpec(): UpsertSavedPcSpecInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UpsertSavedPcSpecInput) : null;
  } catch {
    return null;
  }
}

export function clearPendingScanSpec(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
