"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import IndependenceNotice from "@/components/ui/IndependenceNotice";
import { getSavedPcSpec } from "@/app/lib/pcSpecs";

export default function Home() {
  const router = useRouter();
  const [isGuardModalOpen, setIsGuardModalOpen] = useState(false);

  const handleAnalyzeClick = async () => {
    const savedPc = await getSavedPcSpec();
    if (savedPc) {
      router.push("/mypage/analysis");
      return;
    }
    setIsGuardModalOpen(true);
  };

  return (
    <>
      <main className="bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/70 p-10 text-center shadow-2xl shadow-black/50">
          <span className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-cyan-300 ring-1 ring-cyan-400/30">
            ⚡ 설치 없이, 3초 만에 시작
          </span>

          <h1 className="mb-4 text-5xl font-bold tracking-tight">PC FIT</h1>

          <p className="mb-10 text-slate-300">
            새로 살 PC 견적이 필요하든, 지금 쓰는 PC로 뭐가 되는지 궁금하든 — 원하는 쪽을 골라보세요.
          </p>

          <div className="mb-8 grid gap-5 sm:grid-cols-2">
            <Link
              href="/build"
              className="group flex flex-col items-start rounded-3xl border border-white/10 bg-slate-900/60 p-7 text-left transition duration-200 hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-slate-900"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl ring-1 ring-cyan-400/30">🛒</span>
              <h2 className="mt-4 text-xl font-bold text-slate-100">뭘 사야 할지 모르겠어요</h2>
              <p className="mt-2 text-sm text-slate-400">예산이랑 용도만 알려주면 견적 짜드려요</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 transition group-hover:gap-2">
                견적 받으러 가기 →
              </span>
            </Link>

            <Link
              href="/analyze"
              className="group flex flex-col items-start rounded-3xl border border-white/10 bg-slate-900/60 p-7 text-left transition duration-200 hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-slate-900"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-2xl ring-1 ring-cyan-400/30">🎮</span>
              <h2 className="mt-4 text-xl font-bold text-slate-100">내 PC로 게임/작업 되는지 궁금해요</h2>
              <p className="mt-2 text-sm text-slate-400">지금 있는 컴퓨터 사양으로 성능 확인</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 transition group-hover:gap-2">
                성능 확인하러 가기 →
              </span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <Link href="/analyze" className="underline-offset-2 transition hover:text-slate-300 hover:underline">
              로그인 없이 3초 만에 시작
            </Link>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <Link href="/build" className="underline-offset-2 transition hover:text-slate-300 hover:underline">
              AI 맞춤 PC 구성
            </Link>
            <span aria-hidden="true" className="text-slate-700">
              ·
            </span>
            <button type="button" onClick={handleAnalyzeClick} className="underline-offset-2 transition hover:text-slate-300 hover:underline">
              내 PC 분석하기
            </button>
          </div>

          <p className="mt-4 text-xs text-slate-500">현재 데스크탑 PC를 기준으로 진단합니다.</p>

          <IndependenceNotice className="mt-8" />
        </div>

        <section aria-label="이용 방법 3단계" className="mx-auto mt-14 w-full max-w-5xl">
          <h2 className="text-center text-2xl font-bold">이렇게 3단계로 끝나요</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-2xl ring-1 ring-cyan-400/30">🔍</span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-cyan-300">1단계</p>
              <h3 className="mt-1 text-lg font-semibold">내 PC 스캔</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">설치 없이 3초 만에 자동으로 사양을 찾아내요. 직접 입력해도 괜찮아요.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-2xl ring-1 ring-cyan-400/30">📋</span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-cyan-300">2단계</p>
              <h3 className="mt-1 text-lg font-semibold">진단서 확인</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">게임·작업별 예상 성능과 병목 구간을 한눈에 확인해요.</p>

              <div aria-hidden="true" className="mt-4 rounded-xl border border-white/10 bg-slate-950 p-3 text-left">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>종합 점수</span>
                  <span>82 / 100</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" />
                </div>
                <div className="mt-2 h-1.5 w-3/5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full w-full rounded-full bg-slate-700" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10 text-2xl ring-1 ring-cyan-400/30">🔗</span>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide text-cyan-300">3단계</p>
              <h3 className="mt-1 text-lg font-semibold">결과 공유</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">링크 하나로 친구에게 진단 결과를 바로 보여줄 수 있어요.</p>
            </div>
          </div>
        </section>
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