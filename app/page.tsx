"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const storageKey = "user_pc_spec";

export default function Home() {
  const router = useRouter();
  const [isGuardModalOpen, setIsGuardModalOpen] = useState(false);

  const hasSavedPc = () => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { cpuId?: string; gpuId?: string };
      return Boolean(parsed.cpuId && parsed.gpuId);
    } catch {
      return false;
    }
  };

  const handleAnalyzeClick = () => {
    if (hasSavedPc()) {
      router.push("/mypage/analysis");
      return;
    }
    setIsGuardModalOpen(true);
  };

  return (
    <>
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-950 px-6">
        <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center text-slate-100 shadow-2xl shadow-black/50">
          <h1 className="mb-4 text-5xl font-bold tracking-tight">PC FIT</h1>

          <p className="mb-10 text-slate-300">
            AI 기반 맞춤형 PC 추천 서비스
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/build"
              className="rounded-2xl bg-cyan-500 px-8 py-4 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              AI 맞춤 PC 구성
            </Link>

            <button
              type="button"
              onClick={handleAnalyzeClick}
              className="rounded-2xl border border-white/20 bg-white/5 px-8 py-4 font-semibold text-slate-100 transition hover:bg-white/10"
            >
              내 PC 분석하기
            </button>
          </div>
        </div>
      </main>

      {isGuardModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h2 className="text-xl font-semibold">앗! 아직 내 컴퓨터를 등록하지 않으셨어요</h2>
            <p className="mt-3 text-sm text-slate-300">1분 자동 등록을 완료하면 맞춤형 벤치마크 분석을 바로 시작할 수 있어요.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => router.push("/mypage/register-pc")}
                className="rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                네, 1분 만에 자동 등록할래요 🚀
              </button>
              <button
                type="button"
                onClick={() => setIsGuardModalOpen(false)}
                className="rounded-2xl border border-slate-700 px-4 py-3 text-slate-200 transition hover:bg-slate-800"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}