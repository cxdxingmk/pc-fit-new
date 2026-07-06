"use client";

import { useMemo, useState } from "react";
import { hardwareCatalog, predictGameFps, calculateBottleneck } from "../lib/analyzer";
import { type MotherboardChipsetAlpha } from "../types/hardware";
import {
  benchmarkCategories,
  type BenchmarkCategoryId,
  videoEditingSoftwareOptions,
} from "../constants/benchmarkCategories";

const directInputValue = "직접 입력";

export default function RecommenderPage() {
  const [selectedPurposes, setSelectedPurposes] = useState<BenchmarkCategoryId[]>(["game"]);
  const [selectedSoftware, setSelectedSoftware] = useState("");
  const [customSoftwareInput, setCustomSoftwareInput] = useState("");
  const [budget, setBudget] = useState(1400);
  const [existingParts, setExistingParts] = useState<Record<string, boolean>>({ cpu: false, gpu: false, ram: false, ssd: false, motherboard: false });
  const [selectedAlpha, setSelectedAlpha] = useState<MotherboardChipsetAlpha>("Z");
  const [selectedNumber, setSelectedNumber] = useState("890");
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<null | {
    cpu: string;
    gpu: string;
    motherboard: string;
    estimatedPrice: number;
    bottleneck: ReturnType<typeof calculateBottleneck>;
    fps: ReturnType<typeof predictGameFps>;
  }>(null);

  const motherboardOptions = useMemo(() => {
    const grouped = hardwareCatalog.motherboards.reduce<Record<string, typeof hardwareCatalog.motherboards>>((acc, board) => {
      const key = board.specs.chipsetAlpha;
      acc[key] = [...(acc[key] ?? []), board];
      return acc;
    }, {});

    return Object.entries(grouped).map(([alpha, boards]) => ({
      alpha,
      numbers: Array.from(new Set(boards.map((board) => board.specs.chipsetNumber))),
    }));
  }, []);

  const handlePurposeToggle = (purpose: BenchmarkCategoryId) => {
    setSelectedPurposes((current) => {
      const next = current.includes(purpose)
        ? current.filter((item) => item !== purpose)
        : [...current, purpose];

      if (!next.includes("video-editing")) {
        setSelectedSoftware("");
        setCustomSoftwareInput("");
      }

      return next;
    });
  };

  const handleExistingPartToggle = (key: string) => {
    setExistingParts((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const cpu = hardwareCatalog.cpus.find((item) => item.benchmarks.multicore >= 90) ?? hardwareCatalog.cpus[0];
    const gpu = hardwareCatalog.gpus.find((item) => item.benchmarks.graphics >= 90) ?? hardwareCatalog.gpus[0];
    const motherboard = hardwareCatalog.motherboards.find((item) => item.specs.chipsetAlpha === selectedAlpha && item.specs.chipsetNumber === selectedNumber) ?? hardwareCatalog.motherboards[0];
    const estimatedPrice = (cpu.estimatedPrice ?? 0) + (gpu.estimatedPrice ?? 0) + (motherboard.estimatedPrice ?? 0) + 220;
    const adjustedBudget = Math.max(0, budget - (existingParts.cpu ? 0 : 0));

    const recommendation = {
      cpu: cpu.name,
      gpu: gpu.name,
      motherboard: motherboard.name,
      estimatedPrice: Math.min(estimatedPrice, adjustedBudget),
      bottleneck: calculateBottleneck(cpu.id, gpu.id),
      fps: predictGameFps(cpu.id, gpu.id, selectedPurposes.includes("game") ? "Cyberpunk 2077" : "Apex Legends", "QHD"),
    };

    setResult(recommendation);
    setSubmitted(true);
    console.log("Recommendation", recommendation);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">AI Recommender</p>
          <h1 className="mt-2 text-3xl font-semibold">기존 부품 활용 견적 추천</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">용도와 예산을 입력하고 기존 부품을 체크하면, 최신 세대 CPU·GPU·메인보드 조합을 추천합니다.</p>
        </section>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">1. 사용 용도</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {benchmarkCategories.map((purpose) => (
                <button
                  key={purpose.id}
                  type="button"
                  onClick={() => handlePurposeToggle(purpose.id)}
                  className={`rounded-full px-4 py-2 text-sm transition ${selectedPurposes.includes(purpose.id) ? "bg-cyan-500 text-slate-950" : "bg-white/5 text-slate-200"}`}
                >
                  {purpose.label}
                </button>
              ))}
            </div>

            {selectedPurposes.includes("video-editing") && (
              <div className="mt-6 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                <p className="text-sm font-semibold text-cyan-200">영상/편집 소프트웨어</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {videoEditingSoftwareOptions.map((software) => {
                    const isActive = selectedSoftware === software;
                    return (
                      <label
                        key={software}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                          isActive
                            ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                            : "border-white/10 bg-slate-900/60 text-slate-200"
                        }`}
                      >
                        <input
                          type="radio"
                          name="video-software"
                          value={software}
                          checked={isActive}
                          onChange={() => setSelectedSoftware(software)}
                          className="h-4 w-4"
                        />
                        {software}
                      </label>
                    );
                  })}
                </div>

                {selectedSoftware === directInputValue && (
                  <input
                    type="text"
                    value={customSoftwareInput}
                    onChange={(event) => setCustomSoftwareInput(event.target.value)}
                    placeholder="사용 중인 편집 소프트웨어를 입력하세요"
                    className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                  />
                )}

                <p className="mt-3 text-xs text-slate-300">
                  선택된 소프트웨어: {selectedSoftware === directInputValue ? customSoftwareInput || "직접 입력 대기 중" : selectedSoftware || "미선택"}
                </p>
              </div>
            )}

            <div className="mt-6">
              <label className="mb-2 block text-sm text-slate-300">예산</label>
              <input type="range" min="900" max="2500" step="50" value={budget} onChange={(event) => setBudget(Number(event.target.value))} className="w-full accent-cyan-400" />
              <p className="mt-2 text-sm text-cyan-300">예산: {budget.toLocaleString()}원</p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold">2. 기존 보유 부품</h3>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(existingParts).map(([key, checked]) => (
                  <label key={key} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    <input type="checkbox" checked={checked} onChange={() => handleExistingPartToggle(key)} className="h-4 w-4 rounded border-white/20 bg-transparent" />
                    <span>{key === "cpu" ? "CPU" : key === "gpu" ? "GPU" : key === "ram" ? "RAM" : key === "ssd" ? "SSD" : "메인보드"}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold">3. 메인보드 칩셋 선택</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-slate-300">알파벳 라인</label>
                  <select value={selectedAlpha} onChange={(event) => setSelectedAlpha(event.target.value as MotherboardChipsetAlpha)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                    {motherboardOptions.map((option) => (
                      <option key={option.alpha} value={option.alpha}>
                        {option.alpha}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm text-slate-300">세대 번호</label>
                  <select value={selectedNumber} onChange={(event) => setSelectedNumber(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                    {motherboardOptions.find((option) => option.alpha === selectedAlpha)?.numbers.map((number) => (
                      <option key={number} value={number}>
                        {number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" className="mt-8 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400">
              추천 조합 생성
            </button>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">추천 결과</h2>
            {!submitted || !result ? (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">폼을 제출하면 최신 세대 추천 조합과 성능 예측이 여기에 출력됩니다.</div>
            ) : (
              <div className="mt-6 space-y-4 text-sm text-slate-300">
                <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">추천 세트</p>
                  <p className="mt-2 text-lg font-semibold text-white">{result.cpu}</p>
                  <p className="mt-1">{result.gpu}</p>
                  <p className="mt-1">{result.motherboard}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">예상 가격</p>
                  <p className="mt-2 text-2xl font-semibold text-cyan-300">{result.estimatedPrice.toLocaleString()}원</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">병목 분석</p>
                  <p className="mt-2">{result.bottleneck.guide}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">게임 FPS 예측</p>
                  <p className="mt-2">평균 FPS: {result.fps.averageFps}</p>
                  <p className="mt-1">1% 저하 프레임: {result.fps.onePercentLowFps}</p>
                  <p className="mt-1">업스케일 권장: {result.fps.recommendUpscaling ? "예" : "아니오"}</p>
                </div>
              </div>
            )}
          </section>
        </form>
      </div>
    </main>
  );
}
