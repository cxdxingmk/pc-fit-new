import { describe, expect, it } from "vitest";
import { shouldRedirectFromAdmin } from "./adminGuard";
import type { AuthUser } from "../context/AuthContext";

function makeUser(isAdmin: boolean): AuthUser {
  return { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin };
}

describe("shouldRedirectFromAdmin", () => {
  it("비로그인(null)이면 리다이렉트한다", () => {
    expect(shouldRedirectFromAdmin(null)).toBe(true);
  });

  it("isAdmin이 false면 리다이렉트한다", () => {
    expect(shouldRedirectFromAdmin(makeUser(false))).toBe(true);
  });

  it("isAdmin이 true면 리다이렉트하지 않는다", () => {
    expect(shouldRedirectFromAdmin(makeUser(true))).toBe(false);
  });
});
