// 회원가입 비밀번호 규칙을 클라이언트(실시간 안내)와 서버(zod 검증)가 동일하게 쓰도록
// 한 곳에 모은다 — 규칙이 어긋나면 "화면엔 통과처럼 보이는데 서버에서 거부" 같은 혼란이 생긴다.
// "use server"가 아닌 순수 상수 모듈이라 클라이언트/서버 양쪽에서 안전하게 import할 수 있다.

export const PASSWORD_MIN_LENGTH = 8;

/** 영문(대소문자 무관) 1자 이상 + 숫자 1자 이상 + 전체 8자 이상 */
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

/** 길이와 무관하게 "영문+숫자 동시 포함" 여부만 보는 정규식(서버 세분화 메시지용) */
export const PASSWORD_HAS_LETTER_AND_DIGIT = /(?=.*[A-Za-z])(?=.*\d)/;

export const PASSWORD_RULE_HINT = "영문, 숫자 포함 8자 이상";
export const PASSWORD_RULE_ERROR = "영문과 숫자를 포함해 8자 이상 입력해 주세요.";
export const PASSWORD_MISMATCH_MESSAGE = "비밀번호가 일치하지 않아요.";
export const PASSWORD_MATCH_MESSAGE = "비밀번호가 일치해요";

export function isValidPassword(password: string): boolean {
  return PASSWORD_RULE.test(password);
}
