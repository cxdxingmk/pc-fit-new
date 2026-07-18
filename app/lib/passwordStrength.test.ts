import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./passwordStrength";

describe("getPasswordStrength", () => {
  it("빈 문자열은 약함(score 0)이다", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, level: "weak", label: "약함" });
  });

  it("최소 규칙만 겨우 충족하는 8자 소문자+숫자는 약함이다", () => {
    const result = getPasswordStrength("abcdefg1");
    expect(result.level).toBe("weak");
  });

  it("대소문자+숫자를 섞은 8자는 보통이다", () => {
    const result = getPasswordStrength("Abcdefg1");
    expect(result.level).toBe("fair");
  });

  it("길이 12자 이상 + 대소문자 + 숫자 + 특수문자를 모두 갖추면 강함이다", () => {
    const result = getPasswordStrength("Abcdefghijkl12!");
    expect(result.level).toBe("strong");
  });

  it("특수문자만 추가해도(11자, 대소문자+숫자+특수문자) 강함으로 올라갈 수 있다", () => {
    const result = getPasswordStrength("Abcdefgh12!");
    expect(result.level).toBe("strong");
  });

  it("점수가 높을수록 단조 증가한다(더 강한 비밀번호가 더 낮은 점수를 받지 않는다)", () => {
    const weak = getPasswordStrength("abcdefg1");
    const fair = getPasswordStrength("Abcdefg1");
    const strong = getPasswordStrength("Abcdefghijkl12!");
    expect(fair.score).toBeGreaterThanOrEqual(weak.score);
    expect(strong.score).toBeGreaterThanOrEqual(fair.score);
  });
});
