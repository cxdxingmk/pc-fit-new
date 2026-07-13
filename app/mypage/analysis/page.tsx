"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { HARDWARE_MASTER } from "../../data/hardwareMaster";
import { OPTIMIZATION_TIPS } from "../../data/optimizationTips";
import { simulatePcPerformance } from "../../lib/simulator";
import type { UserSavedPc } from "../../types/hardware";
import MyPageTabs from "../components/MyPageTabs";
import Container from "@/components/layout/Container";

type AnalysisTab = "game" | "creator" | "ai";

const storageKey = "user_pc_spec";

const gameList = ["배틀그라운드", "리그 오브 레전드", "Cyberpunk 2077"] as const;

function getSavedPc(): UserSavedPc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSavedPc>;
    if (!parsed.cpuId || !parsed.gpuId || !parsed.ramCapacity || !parsed.ssdCapacity || !parsed.monitorResolution || !parsed.monitorRefreshRate) {
      return null;
    }
    return {
      id: parsed.id ?? "saved-pc",
      cpuId: parsed.cpuId,
      gpuId: parsed.gpuId,
      ramCapacity: parsed.ramCapacity,
      ramDetail: parsed.ramDetail,
      ssdCapacity: parsed.ssdCapacity,
      ssdDetail: parsed.ssdDetail,
      monitorResolution: parsed.monitorResolution,
      monitorRefreshRate: parsed.monitorRefreshRate,
    };
  } catch {
    return null;
  }
}

export default function MyPageAnalysisPage() {
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [selectedTab, setSelectedTab] = useState<AnalysisTab>("game");
  const [selectedGame, setSelectedGame] = useState<(typeof gameList)[number]>("배틀그라운드");

  const savedPc = useMemo(() => getSavedPc(), []);

  const cpuName = useMemo(() => cpus.find((item) => item.id === savedPc?.cpuId)?.name ?? "미확인 CPU", [savedPc?.cpuId]);
  const gpuName = useMemo(() => gpus.find((item) => item.id === savedPc?.gpuId)?.name ?? "미확인 GPU", [savedPc?.gpuId]);
  const gpuBrand = useMemo(() => gpus.find((item) => item.id === savedPc?.gpuId)?.brand ?? "NVIDIA", [savedPc?.gpuId]);
  const ramGb = useMemo(() => {
    if (!savedPc?.ramCapacity) return 16;
    const parsed = Number(savedPc.ramCapacity.replace(/[^0-9]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
  }, [savedPc?.ramCapacity]);

  const cpuMasterScore = useMemo(() => {
    if (!savedPc) return 70;
    const found = HARDWARE_MASTER.CPU.find((item) => item.mappedId === savedPc.cpuId || item.id === savedPc.cpuId);
    return found?.score ?? 70;
  }, [savedPc]);

  const gpuMasterScore = useMemo(() => {
    if (!savedPc) return 70;
    const found = HARDWARE_MASTER.GPU.find((item) => item.mappedId === savedPc.gpuId || item.id === savedPc.gpuId);
    return found?.score ?? 70;
  }, [savedPc]);

  const gameResult = useMemo(() => {
    if (!savedPc) return null;
    const mappedTitle = selectedGame === "배틀그라운드" ? "Apex Legends" : selectedGame === "리그 오브 레전드" ? "Valorant" : "Cyberpunk 2077";
    return simulatePcPerformance(savedPc, mappedTitle, savedPc.monitorResolution);
  }, [savedPc, selectedGame]);

  const creatorScore = useMemo(() => {
    if (!savedPc) return 0;
    return Math.min(100, Math.round(cpuMasterScore * 0.56 + gpuMasterScore * 0.44));
  }, [savedPc, cpuMasterScore, gpuMasterScore]);

  const aiImagePerSec = useMemo(() => {
    if (!savedPc) return 0;
    return Number(((cpuMasterScore * 0.011) + (gpuMasterScore * 0.028)).toFixed(2));
  }, [savedPc, cpuMasterScore, gpuMasterScore]);

  const optimizationTips = useMemo(() => {
    if (selectedTab === "game") {
      return gpuBrand === "AMD" ? OPTIMIZATION_TIPS.Gaming.AMD : OPTIMIZATION_TIPS.Gaming.NVIDIA;
    }
    if (selectedTab === "creator") {
      return ramGb <= 16 ? OPTIMIZATION_TIPS.Creator.lowRam : OPTIMIZATION_TIPS.Creator.general;
    }
    return OPTIMIZATION_TIPS.AI;
  }, [selectedTab, gpuBrand, ramGb]);

  const optimizationProfileLabel = useMemo(() => {
    if (selectedTab === "game") {
      return `게임 최적화 프로필: ${gpuBrand}`;
    }
    if (selectedTab === "creator") {
      return `크리에이터 프로필: ${ramGb <= 16 ? "저용량 RAM 집중" : "일반 고효율"}`;
    }
    return "AI 가속 프로필";
  }, [selectedTab, gpuBrand, ramGb]);

  const startAnalysis = () => {
    setAnalysisReady(false);
    setAnalysisProgress(0);
    const timer = window.setInterval(() => {
      setAnalysisProgress((prev) => {
        const next = prev + 10;
        if (next >= 100) {
          window.clearInterval(timer);
          setAnalysisReady(true);
          return 100;
        }
        return next;
      });
    }, 130);
  };

  if (!savedPc) {
    return (
      <main className="min-h-screen bg-slate-950 py-12 text-slate-100">
        <Container className="flex flex-col gap-6">
          <MyPageTabs activeTab="analysis" />

          <div className="max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/70 p-8 text-center shadow-2xl shadow-black/50">
            <h1 className="text-3xl font-semibold">내 PC 분석을 시작하려면 먼저 사양 등록이 필요해요</h1>
            <p className="mt-4 text-slate-300">1분 자동 스캔으로 CPU/GPU/메모리/스토리지/모니터를 한번에 등록할 수 있습니다.</p>
            <Link href="/mypage/register-pc" className="mt-8 inline-flex rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400">
              내 PC 등록하러 가기
            </Link>
          </div>
        </Container>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <Container className="flex flex-col gap-6">
        <MyPageTabs activeTab="analysis" />

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/50">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">My PC Analysis</p>
          <h1 className="mt-2 text-3xl font-semibold">맞춤형 벤치마크 분석</h1>
          <p className="mt-3 text-sm text-slate-300">{cpuName} + {gpuName} / 모니터 {savedPc.monitorResolution} {savedPc.monitorRefreshRate}Hz</p>

          <button
            type="button"
            onClick={startAnalysis}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-4 text-lg font-bold text-slate-950 transition hover:brightness-110"
          >
            ⚡ 실시간 성능 체크 시작
          </button>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-150" style={{ width: `${analysisProgress}%` }} />
          </div>
          <p className="mt-2 text-right text-xs text-slate-400">분석 진행률 {analysisProgress}%</p>
        </section>

        {analysisReady ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/50">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setSelectedTab("game")} className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${selectedTab === "game" ? "bg-cyan-500 text-slate-950" : "bg-white/5 text-slate-200"}`}>
                🎮 게임 프레임 벤치마크
              </button>
              <button type="button" onClick={() => setSelectedTab("creator")} className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${selectedTab === "creator" ? "bg-cyan-500 text-slate-950" : "bg-white/5 text-slate-200"}`}>
                🎬 영상 편집/크리에이터
              </button>
              <button type="button" onClick={() => setSelectedTab("ai")} className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${selectedTab === "ai" ? "bg-cyan-500 text-slate-950" : "bg-white/5 text-slate-200"}`}>
                🤖 AI 가속 성능
              </button>
            </div>

            {selectedTab === "game" ? (
              <div className="mt-6 space-y-5">
                <label className="block text-sm">
                  분석 게임 선택
                  <select value={selectedGame} onChange={(event) => setSelectedGame(event.target.value as (typeof gameList)[number])} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100">
                    {gameList.map((game) => (
                      <option key={game} value={game}>{game}</option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">예상 평균 프레임</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{gameResult?.averageFps ?? 0} FPS</p>
                  <div className="mt-4 h-4 rounded-full bg-slate-800">
                    <div className="h-4 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${Math.min(100, Math.round(((gameResult?.averageFps ?? 0) / 240) * 100))}%` }} />
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm">렌더 FPS: <span className="font-semibold">{gameResult?.renderedFps ?? 0}</span></div>
                    <div className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm">1% Low: <span className="font-semibold">{gameResult?.onePercentLowFps ?? 0}</span></div>
                    <div className="rounded-xl border border-white/10 bg-slate-950 p-3 text-sm">모니터 병목: <span className="font-semibold">{gameResult?.monitorBottleneck ?? "NONE"}</span></div>
                  </div>
                </div>
              </div>
            ) : null}

            {selectedTab === "creator" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">4K 렌더링 쾌적 점수</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{creatorScore}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">프리뷰 실시간 반응도</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{Math.max(60, creatorScore + 8)}%</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">다중 트랙 편집 안정성</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{Math.max(58, creatorScore - 4)}%</p>
                </div>
              </div>
            ) : null}

            {selectedTab === "ai" ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">이미지 생성 속도</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{aiImagePerSec} 장/초</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">LLM 추론 반응 지수</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{Math.round((aiImagePerSec + 1.8) * 18)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-slate-300">AI 가속 권장도</p>
                  <p className="mt-2 text-3xl font-bold text-cyan-300">{aiImagePerSec > 4 ? "Excellent" : aiImagePerSec > 3 ? "Good" : "Entry"}</p>
                </div>
              </div>
            ) : null}

            <section className="mt-8 rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-slate-900 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">💡 내 PC 맞춤 최적화 가이드</h3>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">{optimizationProfileLabel}</span>
              </div>
              <p className="mt-3 text-sm text-slate-300">현재 탭과 GPU 브랜드, 메모리 용량을 기준으로 즉시 적용 가능한 최적화 정답만 추천합니다.</p>
              <div className="mt-5 grid gap-3">
                {optimizationTips.map((tip, index) => (
                  <div key={`${selectedTab}-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-200">
                    <p className="text-xs text-cyan-300">TIP {index + 1}</p>
                    <p className="mt-2 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        ) : null}
      </Container>
    </main>
  );
}
