"use server";

import { z } from "zod";
import { createClient } from "@/app/lib/supabase/server";
import { PASSWORD_MIN_LENGTH, PASSWORD_HAS_LETTER_AND_DIGIT, PASSWORD_MISMATCH_MESSAGE } from "@/app/lib/passwordRule";

const SignupSchema = z
  .object({
    nickname: z.string().trim().min(1, "닉네임을 입력해 주세요.").max(20, "닉네임은 20자 이내로 입력해 주세요."),
    email: z.email("올바른 이메일 형식이 아니에요."),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, "비밀번호는 8자 이상이어야 해요.")
      .regex(PASSWORD_HAS_LETTER_AND_DIGIT, "비밀번호에 영문과 숫자를 함께 포함해 주세요."),
    passwordConfirm: z.string(),
    // 체크된 <input type="checkbox">는 FormData에 "on"으로 담기고, 체크 안 하면 필드 자체가
    // 없다(formData.get()이 null) — 클라이언트의 disabled 버튼을 우회해도 서버에서 다시 막는다.
    agreeTerms: z.literal("on", "개인정보 수집·이용 및 이용약관에 동의해 주세요."),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: PASSWORD_MISMATCH_MESSAGE,
    path: ["passwordConfirm"],
  });

// success 시 여기서 직접 redirect()하지 않는 이유는 app/login/actions.ts의 동일한 주석 참고 —
// /signup과 로그인 후 목적지가 같은 루트 레이아웃을 공유해서, 서버 액션발 redirect(soft
// navigation)로는 AuthContext의 initialUser가 새 세션으로 갱신되지 않는다.
export type AuthFormState = { error?: string; needsEmailConfirmation?: boolean; success?: true } | undefined;

export async function signup(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignupSchema.safeParse({
    nickname: formData.get("nickname"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    agreeTerms: formData.get("agreeTerms"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (configError) {
    // 환경변수 누락 등 클라이언트 자체를 못 만든 경우 — 원문을 로그로 남긴다(Vercel Functions 로그에서 확인).
    console.error("[signup] Supabase 클라이언트 생성 실패(환경변수/설정 문제일 수 있음):", configError);
    return { error: "서버 설정 문제로 회원가입을 처리할 수 없어요. 잠시 후 다시 시도해 주세요." };
  }

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { nickname: parsed.data.nickname } },
  });

  if (error) {
    // 예전엔 error.message를 통째로 삼켜서 로그에도 안 남았다 — 이제 원문을 남겨 원인을 추적한다.
    console.error("[signup] supabase.auth.signUp 실패:", {
      message: error.message,
      status: error.status,
      code: (error as { code?: string }).code,
    });

    const lower = error.message.toLowerCase();
    if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already")) {
      return { error: "이미 가입된 이메일이에요." };
    }
    if (error.status === 429 || lower.includes("rate limit")) {
      return { error: "요청이 많아요. 잠시 후 다시 시도해 주세요." };
    }
    if (error.status === 401 || lower.includes("invalid api key") || lower.includes("api key")) {
      // 배포 환경의 Supabase 키가 잘못됐을 때 나타나는 신호 — 화면엔 일반 안내, 로그엔 원문.
      return { error: "서버 인증 설정 문제로 회원가입을 처리할 수 없어요. 잠시 후 다시 시도해 주세요." };
    }
    return { error: "회원가입에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  // Supabase 프로젝트의 "Confirm email" 설정은 대시보드에서만 바뀌는 값이라 코드로는 알 수 없다 —
  // 세션이 즉시 발급됐는지로 분기해 두 경우 모두 자연스럽게 처리한다.
  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  return { success: true };
}
