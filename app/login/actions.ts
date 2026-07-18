"use server";

import { z } from "zod";
import { createClient } from "@/app/lib/supabase/server";

const LoginSchema = z.object({
  email: z.email("올바른 이메일 형식이 아니에요."),
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

// 로그인 성공 시 이 서버 액션이 직접 redirect()를 부르지 않는다 — /login과 로그인 후 목적지가
// 같은 루트 레이아웃을 공유하는데, Next.js는 서버 액션발 redirect(soft navigation)에서 이미
// 마운트돼 있는 공유 레이아웃(app/layout.tsx, getServerAuthUser 호출부)을 다시 실행하지
// 않는다 — 그 결과 세션 쿠키는 정상적으로 저장됐는데도 AuthContext의 initialUser가 로그인 전
// 값(null)에 그대로 머물러, 헤더가 "로그인" 버튼을 계속 보여주는 상태로 남았다(새로고침하면
// 바로 고쳐짐 — 실제로 로그인은 성공했지만 클라이언트 화면만 안 따라온 것). success 플래그만
// 반환하고, 실제 이동은 클라이언트(page.tsx)에서 router.push + router.refresh로 처리해
// 루트 레이아웃이 새 세션으로 다시 렌더링되게 한다.
export type AuthFormState = { error?: string; success?: true } | undefined;

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

  return { success: true };
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

  return { success: true };
}
