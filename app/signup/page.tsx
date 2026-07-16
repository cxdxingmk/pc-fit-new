"use client";

import { useId, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { signup } from "./actions";
import PasswordInput from "@/components/ui/PasswordInput";
import {
  isValidPassword,
  PASSWORD_RULE_HINT,
  PASSWORD_RULE_ERROR,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_MATCH_MESSAGE,
} from "@/app/lib/passwordRule";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordBlurred, setPasswordBlurred] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const passwordHintId = useId();

  // 클라이언트 실시간 계산 — 서버 zod 검증과 "동일한" 규칙(app/lib/passwordRule.ts)을 공유한다.
  const passwordRuleValid = isValidPassword(password);
  const showRuleError = passwordBlurred && password.length > 0 && !passwordRuleValid;

  const confirmFilled = passwordConfirm.length > 0;
  const passwordsMatch = password === passwordConfirm; // 서버와 동일하게 trim 없이 원문 비교
  const showMismatch = confirmFilled && !passwordsMatch;

  // 스펙 B-3: 실시간 일치 확인이 불일치면 제출 버튼 비활성화(제출 전 서버 왕복을 막는 UX 게이트).
  // 약관 동의도 같은 원리로 체크 전엔 제출을 막는다(서버 액션에서도 동일 조건을 재검증함).
  const submitDisabled = pending || showMismatch || !agreed;

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
              autoComplete="nickname"
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
              autoComplete="email"
              placeholder="이메일을 입력하세요"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

          <div className="text-sm font-medium text-slate-300">
            <label htmlFor="signup-password">비밀번호</label>
            <PasswordInput
              id="signup-password"
              name="password"
              value={password}
              onChange={setPassword}
              onBlur={() => setPasswordBlurred(true)}
              autoComplete="new-password"
              placeholder="8자 이상 입력하세요"
              ariaDescribedBy={passwordHintId}
              ariaInvalid={showRuleError}
            />
            {showRuleError ? (
              <p id={passwordHintId} className="mt-1.5 text-xs text-rose-400">
                {PASSWORD_RULE_ERROR}
              </p>
            ) : (
              <p id={passwordHintId} className="mt-1.5 text-xs text-slate-500">
                {PASSWORD_RULE_HINT}
              </p>
            )}
          </div>

          <div className="text-sm font-medium text-slate-300">
            <label htmlFor="signup-password-confirm">비밀번호 확인</label>
            <PasswordInput
              id="signup-password-confirm"
              name="passwordConfirm"
              value={passwordConfirm}
              onChange={setPasswordConfirm}
              autoComplete="new-password"
              placeholder="비밀번호를 한 번 더 입력하세요"
              ariaInvalid={showMismatch}
            />
            {confirmFilled ? (
              <p role="status" className={`mt-1.5 text-xs ${passwordsMatch ? "text-emerald-400" : "text-rose-400"}`}>
                {passwordsMatch ? PASSWORD_MATCH_MESSAGE : PASSWORD_MISMATCH_MESSAGE}
              </p>
            ) : null}
          </div>

          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="agree-terms"
              name="agreeTerms"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-950 accent-cyan-500"
            />
            <label htmlFor="agree-terms" className="text-sm leading-snug text-slate-300">
              {/* Link 클릭 시 label의 기본 동작(연결된 체크박스 토글)까지 함께 발동해 체크가
                  풀리는 걸 막기 위해 stopPropagation — 새 탭으로 열어 작성 중인 폼 값도 보존한다. */}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
              >
                개인정보 수집·이용
              </Link>
              {" 및 "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="font-semibold text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
              >
                이용약관
              </Link>
              에 동의합니다
            </label>
          </div>

          {state?.error ? (
            <p role="alert" className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/25">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitDisabled}
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
