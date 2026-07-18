"use server";

import { z } from "zod";
import { createClient } from "@/app/lib/supabase/server";
import { verifyCurrentPassword } from "@/app/lib/supabase/verifyCurrentPassword";
import { sendPasswordChangedEmail } from "@/app/lib/notifications/sendPasswordChangedEmail";
import { PASSWORD_MIN_LENGTH, PASSWORD_HAS_LETTER_AND_DIGIT, PASSWORD_MISMATCH_MESSAGE } from "@/app/lib/passwordRule";

const LOCKOUT_THRESHOLD = 5;

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "현재 비밀번호를 입력해 주세요."),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "새 비밀번호는 8자 이상이어야 해요.")
      .regex(PASSWORD_HAS_LETTER_AND_DIGIT, "새 비밀번호에 영문과 숫자를 함께 포함해 주세요."),
    newPasswordConfirm: z.string(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: PASSWORD_MISMATCH_MESSAGE,
    path: ["newPasswordConfirm"],
  });

export type ChangePasswordState = { error?: string; success?: true } | undefined;

function formatRemainingMinutes(lockedUntil: string | Date): number {
  const target = typeof lockedUntil === "string" ? new Date(lockedUntil) : lockedUntil;
  return Math.max(1, Math.ceil((target.getTime() - Date.now()) / 60_000));
}

export async function changePassword(_prevState: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    newPasswordConfirm: formData.get("newPasswordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const { currentPassword, newPassword } = parsed.data;

  let supabase;
  try {
    supabase = await createClient();
  } catch (configError) {
    console.error("[changePassword] Supabase 클라이언트 생성 실패(환경변수/설정 문제일 수 있음):", configError);
    return { error: "서버 설정 문제로 처리할 수 없어요. 잠시 후 다시 시도해 주세요." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "로그인이 필요해요." };
  }

  // 무차별 대입 방지: 이미 잠긴 상태면 Supabase에 새로 물어보지도 않고 바로 막는다.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("password_fail_locked_until")
    .eq("id", user.id)
    .single();

  if (profileError) {
    // 0003_password_change_rate_limit.sql 마이그레이션이 아직 적용되지 않았을 때 나는 에러일 수
    // 있다 — 이 경우 잠금 여부만 확인 못 할 뿐 나머지 비밀번호 변경 로직은 정상 동작해야 하므로
    // 여기서 막지 않고 로그만 남긴다.
    console.error("[changePassword] 잠금 상태 조회 실패(마이그레이션 미적용일 수 있음):", profileError);
  }

  if (profile?.password_fail_locked_until && new Date(profile.password_fail_locked_until) > new Date()) {
    const remainingMin = formatRemainingMinutes(profile.password_fail_locked_until);
    return { error: `현재 비밀번호를 여러 번 잘못 입력해 ${remainingMin}분 후에 다시 시도할 수 있어요.` };
  }

  const currentPasswordValid = await verifyCurrentPassword(user.email, currentPassword);

  if (!currentPasswordValid) {
    const { data: attemptRows, error: attemptError } = await supabase.rpc("record_password_attempt_failure");
    if (attemptError) {
      console.error("[changePassword] 실패 횟수 기록 실패:", attemptError);
    } else {
      const attempt = attemptRows?.[0] as { fail_count: number; locked_until: string | null } | undefined;
      if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
        const remainingMin = formatRemainingMinutes(attempt.locked_until);
        return {
          error: `현재 비밀번호를 ${LOCKOUT_THRESHOLD}회 이상 잘못 입력해 ${remainingMin}분간 다시 시도할 수 없어요.`,
        };
      }
    }
    // 계정 존재 여부 등은 이미 로그인된 사용자라 노출될 정보가 없으니, 단순 오답 메시지만 준다.
    return { error: "현재 비밀번호가 올바르지 않아요." };
  }

  // 검증에 성공했으니(비밀번호를 실제로 바꾸든 안 바꾸든) 실패 카운터를 리셋한다.
  const { error: resetError } = await supabase.rpc("reset_password_attempts");
  if (resetError) {
    console.error("[changePassword] 실패 카운터 리셋 실패(치명적이지 않음):", resetError);
  }

  if (newPassword === currentPassword) {
    return { error: "이전과 다른 비밀번호를 사용해 주세요." };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    console.error("[changePassword] supabase.auth.updateUser 실패:", updateError);
    return { error: "비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  // 방금 바꾼 비밀번호로 로그인된 이 세션은 유지하고, 다른 기기의 세션만 무효화한다.
  // 실패해도 비밀번호 변경 자체는 이미 끝났으니 사용자에게는 성공으로 보고한다.
  try {
    const { error: signOutOthersError } = await supabase.auth.signOut({ scope: "others" });
    if (signOutOthersError) {
      console.error("[changePassword] 다른 세션 무효화 실패:", signOutOthersError);
    }
  } catch (signOutError) {
    console.error("[changePassword] 다른 세션 무효화 중 예외:", signOutError);
  }

  // 이메일 발송 인프라 연동 전까지는 스텁(app/lib/notifications/sendPasswordChangedEmail.ts) —
  // 실패해도 이미 끝난 비밀번호 변경에 영향 주지 않도록 결과를 기다리지 않고 로그만 남긴다.
  sendPasswordChangedEmail(user.email).catch((emailError) => {
    console.error("[changePassword] 변경 알림 이메일 발송 실패(스텁):", emailError);
  });

  return { success: true };
}
