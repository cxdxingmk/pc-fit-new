import { describe, expect, it, vi, beforeEach } from "vitest";
import { changePassword } from "./actions";
import { createClient } from "@/app/lib/supabase/server";
import { verifyCurrentPassword } from "@/app/lib/supabase/verifyCurrentPassword";
import { sendPasswordChangedEmail } from "@/app/lib/notifications/sendPasswordChangedEmail";

vi.mock("@/app/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/lib/supabase/verifyCurrentPassword", () => ({
  verifyCurrentPassword: vi.fn(),
}));

vi.mock("@/app/lib/notifications/sendPasswordChangedEmail", () => ({
  sendPasswordChangedEmail: vi.fn().mockResolvedValue(undefined),
}));

const USER_EMAIL = "user@example.com";
const USER_ID = "user-123";

interface MockSupabaseOptions {
  profileRow?: { password_fail_locked_until: string | null };
  updateUserError?: { message: string } | null;
  signOutError?: { message: string } | null;
  recordAttemptResult?: { data: Array<{ fail_count: number; locked_until: string | null }> | null; error: { message: string } | null };
  resetAttemptsError?: { message: string } | null;
}

function buildMockSupabase(opts: MockSupabaseOptions = {}) {
  const updateUser = vi.fn().mockResolvedValue({ error: opts.updateUserError ?? null });
  const signOut = vi.fn().mockResolvedValue({ error: opts.signOutError ?? null });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: USER_ID, email: USER_EMAIL } } });

  const rpc = vi.fn((fnName: string) => {
    if (fnName === "record_password_attempt_failure") {
      return Promise.resolve(opts.recordAttemptResult ?? { data: [{ fail_count: 1, locked_until: null }], error: null });
    }
    if (fnName === "reset_password_attempts") {
      return Promise.resolve({ error: opts.resetAttemptsError ?? null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const single = vi.fn().mockResolvedValue({
    data: opts.profileRow ?? { password_fail_locked_until: null },
  });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return { auth: { getUser, updateUser, signOut }, from, rpc };
}

function buildFormData(fields: { currentPassword?: string; newPassword?: string; newPasswordConfirm?: string }) {
  const formData = new FormData();
  formData.set("currentPassword", fields.currentPassword ?? "oldPass1");
  formData.set("newPassword", fields.newPassword ?? "newPass1");
  formData.set("newPasswordConfirm", fields.newPasswordConfirm ?? "newPass1");
  return formData;
}

beforeEach(() => {
  vi.mocked(verifyCurrentPassword).mockReset();
  vi.mocked(sendPasswordChangedEmail).mockReset().mockResolvedValue(undefined);
});

describe("changePassword — 입력값 검증", () => {
  it("새 비밀번호가 규칙(영문+숫자 8자 이상)을 어기면 Supabase를 호출하지 않고 에러를 반환한다", async () => {
    const mockSupabase = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await changePassword(undefined, buildFormData({ newPassword: "short1", newPasswordConfirm: "short1" }));

    expect(result?.error).toBeTruthy();
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("새 비밀번호와 확인이 다르면 불일치 에러를 반환한다", async () => {
    const mockSupabase = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await changePassword(undefined, buildFormData({ newPassword: "newPass1", newPasswordConfirm: "newPass2" }));

    expect(result?.error).toBe("비밀번호가 일치하지 않아요.");
  });
});

describe("changePassword — 잠금/무차별 대입 방지", () => {
  it("이미 잠긴 상태면 현재 비밀번호 검증을 시도하지 않고 즉시 막는다", async () => {
    const lockedUntil = new Date(Date.now() + 3 * 60_000).toISOString();
    const mockSupabase = buildMockSupabase({ profileRow: { password_fail_locked_until: lockedUntil } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await changePassword(undefined, buildFormData({}));

    expect(result?.error).toContain("분 후에 다시 시도");
    expect(verifyCurrentPassword).not.toHaveBeenCalled();
  });

  it("현재 비밀번호가 틀리고 아직 5회 미만이면 일반 오답 메시지를 반환한다", async () => {
    const mockSupabase = buildMockSupabase({
      recordAttemptResult: { data: [{ fail_count: 2, locked_until: null }], error: null },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(verifyCurrentPassword).mockResolvedValue(false);

    const result = await changePassword(undefined, buildFormData({}));

    expect(result?.error).toBe("현재 비밀번호가 올바르지 않아요.");
    expect(mockSupabase.rpc).toHaveBeenCalledWith("record_password_attempt_failure");
  });

  it("현재 비밀번호를 5회 이상 틀리면 잠금 메시지를 반환한다", async () => {
    const lockedUntil = new Date(Date.now() + 5 * 60_000).toISOString();
    const mockSupabase = buildMockSupabase({
      recordAttemptResult: { data: [{ fail_count: 5, locked_until: lockedUntil }], error: null },
    });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(verifyCurrentPassword).mockResolvedValue(false);

    const result = await changePassword(undefined, buildFormData({}));

    expect(result?.error).toContain("5회 이상");
    expect(result?.error).toContain("분간");
  });
});

describe("changePassword — 이전 비밀번호 재사용 차단", () => {
  it("새 비밀번호가 현재 비밀번호와 같으면 에러를 반환하고 업데이트를 시도하지 않는다", async () => {
    const mockSupabase = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(verifyCurrentPassword).mockResolvedValue(true);

    const result = await changePassword(
      undefined,
      buildFormData({ currentPassword: "samePass1", newPassword: "samePass1", newPasswordConfirm: "samePass1" })
    );

    expect(result?.error).toBe("이전과 다른 비밀번호를 사용해 주세요.");
    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("changePassword — 성공 경로", () => {
  it("현재 비밀번호 검증 성공 시 실패 카운터를 리셋한다", async () => {
    const mockSupabase = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(verifyCurrentPassword).mockResolvedValue(true);

    await changePassword(undefined, buildFormData({}));

    expect(mockSupabase.rpc).toHaveBeenCalledWith("reset_password_attempts");
  });

  it("성공 시 updateUser, 다른 세션 로그아웃(scope: others), 이메일 알림을 순서대로 호출하고 success를 반환한다", async () => {
    const mockSupabase = buildMockSupabase();
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(verifyCurrentPassword).mockResolvedValue(true);

    const result = await changePassword(undefined, buildFormData({}));

    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({ password: "newPass1" });
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(sendPasswordChangedEmail).toHaveBeenCalledWith(USER_EMAIL);
    expect(result).toEqual({ success: true });
  });

  it("updateUser가 실패하면 에러를 반환하고 다른 세션을 로그아웃하지 않는다", async () => {
    const mockSupabase = buildMockSupabase({ updateUserError: { message: "boom" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(verifyCurrentPassword).mockResolvedValue(true);

    const result = await changePassword(undefined, buildFormData({}));

    expect(result?.error).toBe("비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요.");
    expect(mockSupabase.auth.signOut).not.toHaveBeenCalled();
  });

  it("다른 세션 로그아웃이 실패해도(치명적이지 않음) 비밀번호 변경 자체는 성공으로 보고한다", async () => {
    const mockSupabase = buildMockSupabase({ signOutError: { message: "boom" } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);
    vi.mocked(verifyCurrentPassword).mockResolvedValue(true);

    const result = await changePassword(undefined, buildFormData({}));

    expect(result).toEqual({ success: true });
  });
});

describe("changePassword — 로그인 상태 가드", () => {
  it("로그인돼 있지 않으면 에러를 반환한다", async () => {
    const mockSupabase = buildMockSupabase();
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const result = await changePassword(undefined, buildFormData({}));

    expect(result?.error).toBe("로그인이 필요해요.");
  });
});
