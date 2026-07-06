"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RegisterPcModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRegistered: () => void;
};

const storageKey = "user_pc_spec";

export default function RegisterPcModal({
  isOpen,
  onClose,
  onRegistered,
}: RegisterPcModalProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");

  if (!isOpen) return null;

  const handleCheckRegistration = () => {
    if (typeof window === "undefined") return;

    const hasRegisteredPc = Boolean(window.localStorage.getItem(storageKey));
    if (!hasRegisteredPc) {
      setMessage("등록된 내 컴퓨터 정보가 아직 없습니다. 등록 후 다시 시도해주세요.");
      return;
    }

    setMessage("");
    onRegistered();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">PC FIT</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">내 컴퓨터 등록이 필요해요</h2>
        <p className="mt-2 text-sm text-slate-300">
          맞춤형 성능 분석 결과를 보려면 현재 PC 사양을 먼저 등록해야 합니다.
        </p>

        {message && (
          <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/mypage/register-pc");
            }}
            className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            내 컴퓨터 등록하러 가기
          </button>
          <button
            type="button"
            onClick={handleCheckRegistration}
            className="rounded-2xl border border-white/20 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-cyan-400/60"
          >
            등록 완료 후 잠금 해제
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-sm text-slate-400 transition hover:text-slate-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
