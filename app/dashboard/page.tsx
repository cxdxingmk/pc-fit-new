"use client";

import { useMemo, useState } from "react";
import { calculateBottleneck, predictGameFps } from "../lib/analyzer";

function getChartPoints(values: number[]) {
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = 12 + index * 28;
      const y = 92 - (value / max) * 60;
      return `${x},${y}`;
    })
    .join(" ");
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);

  const analysis = useMemo(() => {
    if (!analysisReady) return null;
    const bottleneck = calculateBottleneck("intel-ultra-9-285k", "rtx-4070-ti-super");
    const fps = predictGameFps("intel-ultra-9-285k", "rtx-4070-ti-super", "Cyberpunk 2077", "4K");
    return {
      bottleneck,
      fps,
      tops: 120,
      metrics: [92, 88, 95, 90, 97],
    };
  }, [analysisReady]);

  const handleAnalyze = () => {
    setIsLoading(true);
    window.setTimeout(() => {
      setIsLoading(false);
      setAnalysisReady(true);
    }, 900);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <section className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">AI PC Analytics</p>
              <h1 className="mt-2 text-3xl font-semibold">내 컴퓨터 원클릭 분석</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">병목 지수, 게임 프레임, AI 연산력까지 한 화면에서 확인할 수 있는 커머스형 대시보드입니다.</p>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              className="rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              {isLoading ? "분석 중..." : "내 컴퓨터 원클릭 분석"}
            </button>
          </div>

          {!analysis ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/20 p-8 text-sm text-slate-300">
              분석 버튼을 누르면 실시간 성능 요약이 표시됩니다.
            </div>
          ) : (
            <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-cyan-400/30 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-cyan-300">병목 지수</p>
                    <h2 className="mt-1 text-2xl font-semibold">{analysis.bottleneck.bottleneckPercent}%</h2>
                  </div>
                  <div className="rounded-full border border-cyan-400/30 px-3 py-1 text-sm text-cyan-300">{analysis.bottleneck.status}</div>
                </div>
                <p className="mt-4 text-sm text-slate-300">{analysis.bottleneck.guide}</p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">CPU 점수</p>
                    <p className="mt-2 text-xl font-semibold">{analysis.bottleneck.cpuScore}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">GPU 점수</p>
                    <p className="mt-2 text-xl font-semibold">{analysis.bottleneck.gpuScore}</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">AI TOPS</p>
                    <p className="mt-2 text-xl font-semibold">{analysis.tops}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <p className="text-sm text-cyan-300">게임 프레임 예측</p>
                <h3 className="mt-2 text-2xl font-semibold">{analysis.fps.averageFps} FPS</h3>
                <p className="mt-2 text-sm text-slate-300">1% 저하 프레임: {analysis.fps.onePercentLowFps} FPS</p>
                <div className="mt-6 rounded-2xl bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm text-slate-300">
                    <span>성능 점수</span>
                    <span>{analysis.tops} TOPS</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-2 w-[78%] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" />
                  </div>
                  <div className="mt-6">
                    <svg viewBox="0 0 140 100" className="h-40 w-full">
                      <polygon points="12,70 32,34 70,20 106,34 126,70 98,90 42,90" fill="rgba(34,211,238,0.18)" stroke="rgba(34,211,238,0.7)" strokeWidth="2" />
                      <polygon points="12,70 32,34 70,20 106,34 126,70" fill="none" stroke="rgba(192,132,252,0.8)" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">성능 지표 요약</h2>
              <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-400">실시간 가시화</span>
            </div>
            <div className="mt-6">
              <svg viewBox="0 0 160 100" className="h-48 w-full">
                <line x1="10" y1="85" x2="150" y2="85" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <polyline points={getChartPoints(analysis?.metrics ?? [72, 84, 90, 76, 88])} fill="none" stroke="#22d3ee" strokeWidth="3" />
              </svg>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">추천 액션</h2>
            <div className="mt-6 space-y-4 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">GPU 업그레이드 우선</p>
                <p className="mt-2">고해상도와 프레임 안정성 확보를 위해 그래픽카드 대체가 가장 효과적입니다.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">AI 워크로드 확장</p>
                <p className="mt-2">TOPS와 멀티코어 점수를 고려해 최신 세대 CPU로 확장하면 생산성 향상이 큽니다.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
