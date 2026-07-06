"use client";

import { FormEvent, useState } from "react";

type SignupForm = {
  username: string;
  password: string;
  name: string;
  phone: string;
};

const initialForm: SignupForm = {
  username: "",
  password: "",
  name: "",
  phone: "",
};

export default function SignupPage() {
  const [form, setForm] = useState<SignupForm>(initialForm);

  const handleSocialLogin = (provider: "카카오톡" | "구글") => {
    alert(`${provider} 로그인은 준비중입니다`);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    alert("회원가입 연동은 준비중입니다");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl shadow-black/40">
        <h1 className="text-3xl font-bold tracking-tight">회원가입</h1>
        <p className="mt-2 text-sm text-slate-400">간편 로그인 또는 직접 입력으로 가입할 수 있습니다.</p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => handleSocialLogin("카카오톡")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-4 py-3 text-sm font-bold text-[#191919] transition hover:brightness-95"
          >
            카카오톡으로 시작하기
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin("구글")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
          >
            구글로 시작하기
          </button>
        </div>

        <div className="my-6 h-px bg-white/10" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-300">
            아이디 (필수)
            <input
              type="text"
              required
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="아이디를 입력하세요"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            비밀번호 (필수)
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="비밀번호를 입력하세요"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            이름 (선택)
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="이름 입력 (선택)"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

          <label className="block text-sm font-medium text-slate-300">
            전화번호 (선택)
            <input
              type="tel"
              value={form.phone}
              onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
              placeholder="전화번호 입력 (선택)"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60"
            />
          </label>

          <button
            type="submit"
            className="mt-2 w-full rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
          >
            직접 회원가입
          </button>
        </form>
      </div>
    </main>
  );
}
