"use client";

import React, { useMemo, useState } from "react";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { rams } from "../database/ram";
import { ssds } from "../database/ssd";
import { motherboards } from "../database/motherboard";
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import { getMyPcScore, getGrade, getDescription } from "../lib/myPc";
import type { UserSavedPc } from "../types/hardware";
import { simulatePcPerformance } from "../lib/simulator";

type Props = {};

export default function MyPcClient(_: Props) {
  const [cpu, setCpu] = useState<CPU>(cpus[0]);
  const [gpu, setGpu] = useState<GPU>(gpus[0]);
  const [ram, setRam] = useState<RAM>(rams[0]);
  const [ssd, setSsd] = useState<SSD>(ssds[0]);
  const [motherboard, setMotherboard] = useState<MotherBoard>(motherboards[0]);
  const [monitorResolution, setMonitorResolution] = useState<"FHD" | "QHD" | "4K">("QHD");
  const [monitorRefreshRate, setMonitorRefreshRate] = useState(144);
  const [gameTitle, setGameTitle] = useState("Cyberpunk 2077");
  const [resolution, setResolution] = useState<"FHD" | "QHD" | "4K">("4K");

  const savedPc = useMemo<UserSavedPc>(
    () => ({
      id: "demo-pc",
      cpuId: cpu.id,
      gpuId: gpu.id,
      ramCapacity: ram.name.includes("64") ? "64GB" : ram.name.includes("32") ? "32GB" : "16GB",
      ramDetail: ram.name,
      ssdCapacity: ssd.name,
      ssdDetail: ssd.name,
      monitorResolution,
      monitorRefreshRate,
    }),
    [cpu.id, gpu.id, ram.name, ssd.name, monitorRefreshRate, monitorResolution]
  );

  const parts = useMemo(() => ({ cpu, gpu, ram, ssd, motherboard }), [cpu, gpu, ram, ssd, motherboard]);

  const score = useMemo(() => getMyPcScore(parts), [parts]);
  const simulation = useMemo(() => simulatePcPerformance(savedPc, gameTitle, resolution), [gameTitle, resolution, savedPc]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white/80 rounded-lg shadow">
          <h3 className="text-lg font-semibold">부품 선택</h3>
          <div className="space-y-3 mt-3">
            <label className="block">
              CPU
              <select
                className="mt-1 block w-full rounded border p-2"
                value={cpu.id}
                onChange={(e) => {
                  const v = e.target.value;
                  const found = cpus.find((c) => c.id === v);
                  if (found) setCpu(found);
                }}
              >
                {cpus.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              GPU
              <select
                className="mt-1 block w-full rounded border p-2"
                value={gpu.id}
                onChange={(e) => {
                  const v = e.target.value;
                  const found = gpus.find((g) => g.id === v);
                  if (found) setGpu(found);
                }}
              >
                {gpus.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              RAM
              <select
                className="mt-1 block w-full rounded border p-2"
                value={ram.id}
                onChange={(e) => {
                  const v = e.target.value;
                  const found = rams.find((r) => r.id === v);
                  if (found) setRam(found);
                }}
              >
                {rams.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              SSD
              <select
                className="mt-1 block w-full rounded border p-2"
                value={ssd.id}
                onChange={(e) => {
                  const v = e.target.value;
                  const found = ssds.find((s) => s.id === v);
                  if (found) setSsd(found);
                }}
              >
                {ssds.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              Motherboard
              <select
                className="mt-1 block w-full rounded border p-2"
                value={motherboard.id}
                onChange={(e) => {
                  const v = e.target.value;
                  const found = motherboards.find((m) => m.id === v);
                  if (found) setMotherboard(found);
                }}
              >
                {motherboards.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="p-4 bg-white/80 rounded-lg shadow">
          <h3 className="text-lg font-semibold">💻 내 PC 종합 성능</h3>
          <div className="mt-3">
            <div className="text-4xl font-bold">{score.totalScore}</div>
            <div className="text-sm text-gray-600 mt-1">{getGrade(score.totalScore)}</div>
            <div className="mt-2 text-sm text-gray-700">{getDescription("office", score.officeScore)}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4">
        <div className="p-4 bg-white/80 rounded-lg shadow">
          <h3 className="text-lg font-semibold">🧠 내 PC 등록 정보</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            <p>CPU: {cpu.name}</p>
            <p>GPU: {gpu.name}</p>
            <p>메인보드: {motherboard.chipset}</p>
            <p>RAM: {savedPc.ramCapacity}</p>
            <p>SSD: {savedPc.ssdCapacity}</p>
            <p>모니터: {savedPc.monitorResolution} / {savedPc.monitorRefreshRate}Hz</p>
          </div>
        </div>

        <div className="p-4 bg-white/80 rounded-lg shadow">
          <h3 className="text-lg font-semibold">🎮 용도별 성능 시뮬레이터</h3>
          <div className="mt-3 space-y-3">
            <label className="block text-sm">
              게임 제목
              <input value={gameTitle} onChange={(event) => setGameTitle(event.target.value)} className="mt-1 block w-full rounded border p-2" />
            </label>
            <label className="block text-sm">
              해상도
              <select value={resolution} onChange={(event) => setResolution(event.target.value as "FHD" | "QHD" | "4K")} className="mt-1 block w-full rounded border p-2">
                <option value="FHD">FHD</option>
                <option value="QHD">QHD</option>
                <option value="4K">4K</option>
              </select>
            </label>
            <label className="block text-sm">
              모니터 최대 해상도
              <select value={monitorResolution} onChange={(event) => setMonitorResolution(event.target.value as "FHD" | "QHD" | "4K")} className="mt-1 block w-full rounded border p-2">
                <option value="FHD">FHD</option>
                <option value="QHD">QHD</option>
                <option value="4K">4K</option>
              </select>
            </label>
            <label className="block text-sm">
              모니터 최대 주사율
              <input type="number" min={60} max={500} value={monitorRefreshRate} onChange={(event) => setMonitorRefreshRate(Number(event.target.value) || 60)} className="mt-1 block w-full rounded border p-2" />
            </label>
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm">
              <p>렌더링 FPS: <span className="font-semibold">{simulation.renderedFps}</span></p>
              <p>예상 평균 FPS: <span className="font-semibold">{simulation.averageFps}</span></p>
              <p>1% 저하 프레임: <span className="font-semibold">{simulation.onePercentLowFps}</span></p>
              <p>모니터 병목: <span className="font-semibold">{simulation.monitorBottleneck}</span></p>
              <p>업스케일 권장: <span className="font-semibold">{simulation.recommendUpscaling ? "예" : "아니오"}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PerfCard emoji="🎮" title="게임 성능" score={score.gameScore} grade={getGrade(score.gameScore)} desc={getDescription("game", score.gameScore)} />
        <PerfCard emoji="🎬" title="영상 편집" score={score.workScore} grade={getGrade(score.workScore)} desc={getDescription("work", score.workScore)} />
        <PerfCard emoji="🤖" title="AI 작업" score={score.aiScore} grade={getGrade(score.aiScore)} desc={getDescription("ai", score.aiScore)} />
        <PerfCard emoji="💼" title="일반 작업" score={score.officeScore} grade={getGrade(score.officeScore)} desc={getDescription("office", score.officeScore)} />
      </div>
    </div>
  );
}

function PerfCard({ emoji, title, score, grade, desc }: { emoji: string; title: string; score: number; grade: string; desc: string }) {
  return (
    <div className="p-4 bg-white/80 rounded-lg shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl">{emoji}</div>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xl font-bold">{score}</div>
            <div className="text-sm text-gray-600">{grade}</div>
          </div>
        </div>
      </div>
      <div className="mt-3 text-sm text-gray-700">{desc}</div>
    </div>
  );
}
