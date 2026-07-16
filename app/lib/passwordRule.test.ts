import { describe, expect, it } from "vitest";
import { isValidPassword, PASSWORD_RULE, PASSWORD_HAS_LETTER_AND_DIGIT } from "./passwordRule";

describe("비밀번호 규칙(영문+숫자 포함 8자 이상)", () => {
  it("영문과 숫자를 포함한 8자 이상은 통과한다", () => {
    expect(isValidPassword("abcd1234")).toBe(true);
    expect(isValidPassword("Passw0rd")).toBe(true);
    expect(isValidPassword("a1a1a1a1a1")).toBe(true);
  });

  it("8자 미만이면 실패한다", () => {
    expect(isValidPassword("abc123")).toBe(false);
  });

  it("숫자가 없으면 실패한다", () => {
    expect(isValidPassword("abcdefgh")).toBe(false);
  });

  it("영문이 없으면 실패한다", () => {
    expect(isValidPassword("12345678")).toBe(false);
  });

  it("PASSWORD_RULE와 PASSWORD_HAS_LETTER_AND_DIGIT가 서로 일관된다", () => {
    // 길이 규칙만 다르고 문자 구성 규칙은 동일해야 한다.
    expect(PASSWORD_RULE.test("abcd1234")).toBe(true);
    expect(PASSWORD_HAS_LETTER_AND_DIGIT.test("abcd1234")).toBe(true);
    expect(PASSWORD_HAS_LETTER_AND_DIGIT.test("abc1")).toBe(true); // 문자구성은 OK
    expect(PASSWORD_RULE.test("abc1")).toBe(false); // 길이 미달
  });
});
