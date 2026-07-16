import type { AuthUser } from "../context/AuthContext";

/**
 * /admin/* 서버 컴포넌트 가드의 판정 로직만 분리한 순수 함수 — 이 저장소엔 Playwright 등
 * 실브라우저 도구가 없어 실제 리다이렉트 배선(app/admin/support/page.tsx)은 수동 QA로,
 * "누구를 막아야 하는가" 판단 로직은 이 함수로 유닛테스트한다.
 */
export function shouldRedirectFromAdmin(user: AuthUser | null): boolean {
  return !user?.isAdmin;
}
