"use client";

import { useId, useState } from "react";

interface PasswordInputProps {
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** 새 비밀번호 칸은 "new-password", 로그인 칸은 "current-password" — 비밀번호 관리자 오토필 오작동 방지 */
  autoComplete?: "new-password" | "current-password";
  id?: string;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
}

const INPUT_CLASS =
  "w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 pr-12 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-400/60";

export default function PasswordInput({
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  autoComplete = "new-password",
  id,
  ariaDescribedBy,
  ariaInvalid,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="relative mt-2">
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        className={INPUT_CLASS}
      />
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:text-cyan-300"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.12 9.12 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
