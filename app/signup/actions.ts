"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/app/lib/supabase/server";

const SignupSchema = z
  .object({
    nickname: z.string().trim().min(1, "닉네임을 입력해 주세요.").max(20, "닉네임은 20자 이내로 입력해 주세요."),
    email: z.email("올바른 이메일 형식이 아니에요."),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 해요."),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "비밀번호가 일치하지 않아요.",
    path: ["passwordConfirm"],
  });

export type AuthFormState = { error?: string; needsEmailConfirmation?: boolean } | undefined;

export async function signup(_prevState: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = SignupSchema.safeParse({
    nickname: formData.get("nickname"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { nickname: parsed.data.nickname } },
  });

  if (error) {
    return { error: error.message.includes("already registered") ? "이미 가입된 이메일이에요." : "회원가입에 실패했어요. 다시 시도해 주세요." };
  }

  // Supabase 프로젝트의 "Confirm email" 설정은 대시보드에서만 바뀌는 값이라 코드로는 알 수 없다 —
  // 세션이 즉시 발급됐는지로 분기해 두 경우 모두 자연스럽게 처리한다.
  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  redirect("/mypage/register-pc");
}
