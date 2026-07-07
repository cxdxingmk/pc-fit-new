"use client";

import React, { useId, useMemo, useState } from "react";
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
import { derivePartSeries } from "../lib/derivePartSeries";
import Card from "../../components/ui/Card";
import Badge, { toneFromScore } from "../../components/ui/Badge";
import ProgressBar from "../../components/ui/ProgressBar";
import CascadingPartSelect from "../../components/ui/CascadingPartSelect";
import { useCascadingPartSelect } from "../../components/ui/useCascadingPartSelect";

const SELECT_CLASSES =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const INPUT_CLASSES = SELECT_CLASSES;

export default function MyPcClient() {
  const [cpu, setCpu] = useState<CPU>(cpus[0]);
  const [gpu, setGpu] = useState<GPU>(gpus[0]);
  const [ram, setRam] = useState<RAM>(rams[0]);
  const [ssd, setSsd] = useState<SSD>(ssds[0]);
  const [motherboard, setMotherboard] = useState<MotherBoard>(motherboards[0]);
  const [monitorResolution, setMonitorResolution] = useState<"FHD" | "QHD" | "4K">("QHD");
  const [monitorRefreshRate, setMonitorRefreshRate] = useState(144);
  const [gameTitle, setGameTitle] = useState("Cyberpunk 2077");
  const [resolution, setResolution] = useState<"FHD" | "QHD" | "4K">("4K");

  // 계층형 선택(브랜드 -> 시리즈/칩셋 -> 모델). register-pc의 CascadingPartSelect/useCascadingPartSelect를
  // 그대로 재사용한다 - 두 화면 모두 app/database/{cpu,gpu,motherboard}.ts를 원본으로 쓰므로 안전하게 통합된다.
  const cpuSeriesOf = useMemo(() => (item: CPU) => derivePartSeries(item.name), []);
  const gpuSeriesOf = useMemo(() => (item: GPU) => derivePartSeries(item.name), []);
  const mbChipsetOf = useMemo(() => (item: MotherBoard) => item.chipset, []);

  const cpuCascade = useCascadingPartSelect(cpus, cpuSeriesOf, cpu.id);
  const gpuCascade = useCascadingPartSelect(gpus, gpuSeriesOf, gpu.id);
  const mbCascade = useCascadingPartSelect(motherboards, mbChipsetOf, motherboard.id);

  const handleCpuSelect = (id: string) => {
    cpuCascade.selectModel(id);
    const found = cpus.find((item) => item.id === id);
    if (found) setCpu(found);
  };
  const handleGpuSelect = (id: string) => {
    gpuCascade.selectModel(id);
    const found = gpus.find((item) => item.id === id);
    if (found) setGpu(found);
  };
  const handleMbSelect = (id: string) => {
    mbCascade.selectModel(id);
    const found = motherboards.find((item) => item.id === id);
    if (found) setMotherboard(found);
  };

  const ramFieldId = useId();
  const ssdFieldId = useId();
  const gameTitleFieldId = useId();
  const resolutionFieldId = useId();
  const monitorResolutionFieldId = useId();
  const monitorRefreshRateFieldId = useId();

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

  const overallTone = toneFromScore(score.totalScore);

  return (
    <div className="space-y-6">
      {/* 히어로: 종합 등급/점수를 가장 크게, 3초 안에 스캔되도록 */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge tone={overallTone}>{getGrade(score.totalScore)}</Badge>
            <p className="mt-3 text-3xl font-bold text-slate-900 dark:text-slate-50">{score.totalScore}점</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{getDescription("office", score.officeScore)}</p>
          </div>
          <ProgressBar value={score.totalScore} tone={overallTone} className="w-full sm:w-48" label="종합 성능 점수" />
        </div>
      </Card>

      {/* 부품 선택 */}
      <Card className="p-4" muted>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">부품 선택</h3>
        <div className="mt-3 space-y-4">
          <CascadingPartSelect title="CPU" state={{ ...cpuCascade, selectModel: handleCpuSelect }} />
          <CascadingPartSelect title="GPU" state={{ ...gpuCascade, selectModel: handleGpuSelect }} />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={ramFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                RAM
              </label>
              <select
                id={ramFieldId}
                className={SELECT_CLASSES}
                value={ram.id}
                onChange={(event) => {
                  const found = rams.find((item) => item.id === event.target.value);
                  if (found) setRam(found);
                }}
              >
                {rams.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={ssdFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                SSD
              </label>
              <select
                id={ssdFieldId}
                className={SELECT_CLASSES}
                value={ssd.id}
                onChange={(event) => {
                  const found = ssds.find((item) => item.id === event.target.value);
                  if (found) setSsd(found);
                }}
              >
                {ssds.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <CascadingPartSelect title="메인보드" groupLabel="칩셋" state={{ ...mbCascade, selectModel: handleMbSelect }} />
        </div>
      </Card>

      {/* 지표 그리드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard emoji="🎮" title="게임 성능" score={score.gameScore} desc={getDescription("game", score.gameScore)} />
        <MetricCard emoji="🎬" title="영상 편집" score={score.workScore} desc={getDescription("work", score.workScore)} />
        <MetricCard emoji="🤖" title="AI 작업" score={score.aiScore} desc={getDescription("ai", score.aiScore)} />
        <MetricCard emoji="💼" title="일반 작업" score={score.officeScore} desc={getDescription("office", score.officeScore)} />
      </div>

      {/* 용도별 성능 시뮬레이터 */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">🎮 용도별 성능 시뮬레이터</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={gameTitleFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              게임 제목
            </label>
            <input id={gameTitleFieldId} value={gameTitle} onChange={(event) => setGameTitle(event.target.value)} className={INPUT_CLASSES} />
          </div>
          <div>
            <label htmlFor={resolutionFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              해상도
            </label>
            <select
              id={resolutionFieldId}
              value={resolution}
              onChange={(event) => setResolution(event.target.value as "FHD" | "QHD" | "4K")}
              className={SELECT_CLASSES}
            >
              <option value="FHD">FHD</option>
              <option value="QHD">QHD</option>
              <option value="4K">4K</option>
            </select>
          </div>
          <div>
            <label htmlFor={monitorResolutionFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              모니터 최대 해상도
            </label>
            <select
              id={monitorResolutionFieldId}
              value={monitorResolution}
              onChange={(event) => setMonitorResolution(event.target.value as "FHD" | "QHD" | "4K")}
              className={SELECT_CLASSES}
            >
              <option value="FHD">FHD</option>
              <option value="QHD">QHD</option>
              <option value="4K">4K</option>
            </select>
          </div>
          <div>
            <label htmlFor={monitorRefreshRateFieldId} className="block text-xs font-medium text-slate-500 dark:text-slate-400">
              모니터 최대 주사율
            </label>
            <input
              id={monitorRefreshRateFieldId}
              type="number"
              min={60}
              max={500}
              value={monitorRefreshRate}
              onChange={(event) => setMonitorRefreshRate(Number(event.target.value) || 60)}
              className={INPUT_CLASSES}
            />
          </div>
        </div>

        <dl className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 px-4 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/50">
          <DetailRow label="렌더링 FPS" value={simulation.renderedFps} />
          <DetailRow label="예상 평균 FPS" value={simulation.averageFps} />
          <DetailRow label="1% 저하 프레임" value={simulation.onePercentLowFps} />
          <DetailRow label="모니터 병목" value={simulation.monitorBottleneck} />
          <DetailRow label="업스케일 권장" value={simulation.recommendUpscaling ? "예" : "아니오"} />
        </dl>
      </Card>

      {/* 상세 등록 정보 */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">🧠 내 PC 등록 정보</h3>
        <dl className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
          <DetailRow label="CPU" value={cpu.name} />
          <DetailRow label="GPU" value={gpu.name} />
          <DetailRow label="메인보드" value={motherboard.chipset} />
          <DetailRow label="RAM" value={savedPc.ramCapacity} />
          <DetailRow label="SSD" value={savedPc.ssdCapacity} />
          <DetailRow label="모니터" value={`${savedPc.monitorResolution} / ${savedPc.monitorRefreshRate}Hz`} />
        </dl>
      </Card>
    </div>
  );
}

function MetricCard({ emoji, title, score, desc }: { emoji: string; title: string; score: number; desc: string }) {
  const tone = toneFromScore(score);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {emoji}
        </span>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">{score}</p>
      <ProgressBar value={score} tone={tone} className="mt-2" label={`${title} 점수`} />
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-900 dark:text-slate-100">{value}</dd>
    </div>
  );
}
