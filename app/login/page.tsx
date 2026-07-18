"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, devLogin } from "./actions";
import PasswordInput from "@/components/ui/PasswordInput";

const POST_LOGIN_REDIRECT = "/mypage/register-pc";

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(login, undefined);
  const [devState, devFormAction, devPending] = useActionState(devLogin, undefined);
  const [password, setPassword] = useState("");

  // 로그인 성공 시 서버 액션이 직접 redirect()하지 않고 success 플래그만 반환한다 — /login과
  // 목적지가 같은 루트 레이아웃을 공유해서, 서버 액션발 redirect(soft navigation)로는 이미
  // 마운트된 레이아웃(AuthContext의 initialUser)이 새 세션으로 다시 렌더링되지 않기 때문이다
  // (쿠키는 정상 저장돼 로그인 자체는 성공하지만, 헤더가 로그인 전 상태로 남아 있었다 — 실제
  // 신고된 "로그인해도 그대로"의 원인). router.refresh()로 루트 레이아웃을 새 세션 기준으로
  // 다시 서버 렌더링시킨 뒤 이동한다.
  useEffect(() => {
    if (state?.success) {
      router.refresh();
      router.push(POST_LOGIN_REDIRECT);
    }
  }, [state, router]);

  useEffect(() => {
    if (devState?.success) {
      router.refresh();
      router.push(POST_LOGIN_REDIRECT);
    }
  }, [devState, router]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-3xl font-bold tracking-tight">로그인</h1>
        <p className="mt-2 text-sm text-slate-400">이메일과 비밀번호로 로그인하세요.</p>

        <form action={formAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-300">
            이메일
            <input
              type="email"
              name="email"
              required
              placeholder="이메일을 입력하세요"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

          <div className="text-sm font-medium text-slate-300">
            <label htmlFor="login-password">비밀번호</label>
            <PasswordInput
              id="login-password"
              name="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
            />
          </div>

          {state?.error ? (
            <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/25">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">
            회원가입
          </Link>
        </p>

        {process.env.NODE_ENV === "development" ? (
          <form action={devFormAction} className="mt-6 border-t border-white/10 pt-6">
            {devState?.error ? <p className="mb-3 text-xs text-rose-300">{devState.error}</p> : null}
            <button
              type="submit"
              disabled={devPending}
              className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {devPending ? "로그인 중..." : "개발용 자동 로그인"}
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
