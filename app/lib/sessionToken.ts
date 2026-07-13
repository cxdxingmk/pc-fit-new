/**
 * createSessionToken — 자동감지 결과 제출용 익명 세션 토큰.
 * 사용자를 식별하지 않는 상관관계용 UUID일 뿐이므로 localStorage에 저장하지 않고
 * 호출부(React 상태 또는 URL 파라미터)에서만 수명을 관리한다.
 */
export function createSessionToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // crypto.randomUUID 미지원 구형 환경 폴백 — 인증/보안 용도가 아닌 세션 상관관계 식별자이므로 충분하다.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
