"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  if (state?.needsEmailConfirmation) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 text-center shadow-2xl shadow-black/40">
          <h1 className="text-2xl font-bold tracking-tight">가입 완료!</h1>
          <p className="mt-3 text-sm text-slate-400">이메일로 발송된 확인 링크를 눌러 인증을 완료해 주세요.</p>
          <Link href="/login" className="mt-6 inline-flex rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400">
            로그인하러 가기
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-3xl font-bold tracking-tight">회원가입</h1>
        <p className="mt-2 text-sm text-slate-400">닉네임과 이메일로 간편하게 가입할 수 있습니다.</p>

        <form action={formAction} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-300">
            닉네임
            <input
              type="text"
              name="nickname"
              required
              maxLength={20}
              placeholder="닉네임을 입력하세요"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

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

          <label className="block text-sm font-medium text-slate-300">
            비밀번호
            <input
              type="password"
              name="password"
              required
              minLength={8}
              placeholder="8자 이상 입력하세요"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            비밀번호 확인
            <input
              type="password"
              name="passwordConfirm"
              required
              minLength={8}
              placeholder="비밀번호를 한 번 더 입력하세요"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

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
            {pending ? "가입 처리 중..." : "회원가입"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
            로그인
          </Link>
        </p>
      </div>
    </main>
  );
}
