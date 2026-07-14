"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import IndependenceNotice from "@/components/ui/IndependenceNotice";

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
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-cyan-300 ring-1 ring-cyan-400/30">
            ⚡ 설치 없이, 3초 만에 시작
          </span>

          <h1 className="mb-4 text-5xl font-bold tracking-tight">PC FIT</h1>

          <p className="mb-10 text-slate-300">
            내 컴퓨터 사양 몰라도 괜찮아요 — 지금 바로 게임·작업 성능부터 확인해보세요.
          </p>

          <div className="mb-8">
            <Link
              href="/analyze"
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-sky-300 px-8 py-4 text-base font-extrabold text-slate-950 shadow-lg shadow-cyan-500/30 transition duration-200 hover:scale-105 hover:from-cyan-300 hover:to-sky-200"
            >
              로그인 없이, 3초 만에 시작하는 사양 & 성능 보기
            </Link>
          </div>

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

          <IndependenceNotice className="mt-8" />
        </div>
      </main>

      {isGuardModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h2 className="text-xl font-semibold">앗! 아직 내 컴퓨터를 등록하지 않으셨어요</h2>
            <p className="mt-3 text-sm text-slate-300">3초면 시작하는 자동 등록, 완료되면 맞춤형 벤치마크 분석을 바로 시작할 수 있어요.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => router.push("/mypage/register-pc")}
                className="rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                네, 3초 만에 시작할래요 🚀
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