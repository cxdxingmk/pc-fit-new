// 비밀번호 변경 폼의 실시간 강도 표시(Strength Meter)용 순수 함수. zxcvbn류의 엔트로피 계산이
// 아니라, 길이·대소문자 혼합·숫자·특수문자 조합 여부를 점수화하는 단순 휴리스틱이다 — 이미
// PASSWORD_RULE(영문+숫자 8자 이상)을 통과한 값에 "얼마나 더 안전한지" 시각적 신호만 준다.

export type PasswordStrengthLevel = "weak" | "fair" | "strong";

export interface PasswordStrengthResult {
  score: number; // 0~5
  level: PasswordStrengthLevel;
  label: string;
}

const LEVEL_LABEL: Record<PasswordStrengthLevel, string> = {
  weak: "약함",
  fair: "보통",
  strong: "강함",
};

export function getPasswordStrength(password: string): PasswordStrengthResult {
  if (!password) {
    return { score: 0, level: "weak", label: LEVEL_LABEL.weak };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const level: PasswordStrengthLevel = score <= 2 ? "weak" : score <= 3 ? "fair" : "strong";

  return { score, level, label: LEVEL_LABEL[level] };
}
