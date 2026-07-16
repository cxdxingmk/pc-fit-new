"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/app/lib/supabase/server";

const LoginSchema = z.object({
  email: z.email("올바른 이메일 형식이 아니에요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export type AuthFormState = { error?: string } | undefined;

export async function login(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  let supabase;
  try {
    supabase = await createClient();
  } catch (configError) {
    console.error("[login] Supabase 클라이언트 생성 실패(환경변수/설정 문제일 수 있음):", configError);
    return { error: "서버 설정 문제로 로그인을 처리할 수 없어요. 잠시 후 다시 시도해 주세요." };
  }

  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    console.error("[login] supabase.auth.signInWithPassword 실패:", {
      message: error.message,
      status: error.status,
      code: (error as { code?: string }).code,
    });
    // 잘못된 자격증명은 400/"invalid login credentials" — 그 외(401 invalid api key, 5xx 등)는
    // 설정/서버 문제일 수 있으므로 화면 문구만 갈라 준다(원인 상세는 위 로그로).
    if (error.status === 401 || error.message.toLowerCase().includes("api key")) {
      return { error: "서버 인증 설정 문제로 로그인을 처리할 수 없어요. 잠시 후 다시 시도해 주세요." };
    }
    return { error: "이메일 또는 비밀번호가 올바르지 않아요." };
  }

  redirect("/mypage/register-pc");
}

const DEV_EMAIL = "dev@pcfit.local";
// scripts/seedDevUser.cts의 DEV_DEFAULT_PASSWORD와 같은 값이어야 한다(시드가 만든 비번으로 로그인하므로).
const DEV_DEFAULT_PASSWORD = "dev1234";

export async function devLogin(_prevState: AuthFormState, _formData: FormData): Promise<AuthFormState> {
  if (process.env.NODE_ENV !== "development") {
    return { error: "개발 환경에서만 사용할 수 있어요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: process.env.DEV_SEED_PASSWORD || DEV_DEFAULT_PASSWORD,
  });

  if (error) {
    return { error: "개발 계정 로그인 실패 — npm run seed:dev-user를 먼저 실행했나요?" };
  }

  redirect("/mypage/register-pc");
}
