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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "이메일 또는 비밀번호가 올바르지 않아요." };
  }

  redirect("/mypage/register-pc");
}

const DEV_EMAIL = "dev@pcfit.local";

export async function devLogin(_prevState: AuthFormState, _formData: FormData): Promise<AuthFormState> {
  if (process.env.NODE_ENV !== "development") {
    return { error: "개발 환경에서만 사용할 수 있어요." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: DEV_EMAIL,
    password: process.env.DEV_SEED_PASSWORD || "devpassword123!",
  });

  if (error) {
    return { error: "개발 계정 로그인 실패 — npm run seed:dev-user를 먼저 실행했나요?" };
  }

  redirect("/mypage/register-pc");
}
