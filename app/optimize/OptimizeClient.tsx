"use client";

import { useEffect, useMemo, useState } from "react";
import { cpus, type CPU } from "@/app/database/cpu";
import { gpus, type GPU } from "@/app/database/gpu";
import { rams, type RAM } from "@/app/database/ram";
import { decodeSpec } from "@/app/lib/specPermalink";
import { scoreAllWorkloads } from "@/app/lib/workloadScoring";
import { evaluateAllGames, type Resolution, type RefreshRate } from "@/app/lib/displayMatch";
import { derivePartSeries } from "@/app/lib/derivePartSeries";
import { SectionCard, PrimaryButton, DisplayControls } from "@/app/components/pcfit-ui";
import CascadingPartSelect from "@/components/ui/CascadingPartSelect";
import { useCascadingPartSelect } from "@/components/ui/useCascadingPartSelect";
import DarkSelect from "@/components/ui/DarkSelect";
import GpuAutoDetect from "@/components/GpuAutoDetect";
import GameSettingsSection from "./components/GameSettingsSection";
import WindowsChecklistSection from "./components/WindowsChecklistSection";
import DriverUpdateSection from "./components/DriverUpdateSection";

const DEFAULT_CPU_ID = "r5-5600"; // Ryzen 5 5600 — /my-pc와 동일한 보급형 샘플 기본값
const DEFAULT_RAM_ID = "16-ddr4-3200";

type Step = "loading" | "input" | "result";

export default function OptimizeClient() {
  const [step, setStep] = useState<Step>("loading");
  const [cpu, setCpu] = useState<CPU>(() => cpus.find((c) => c.id === DEFAULT_CPU_ID) ?? cpus[0]);
  const [gpu, setGpu] = useState<GPU | null>(null);
  const [ram, setRam] = useState<RAM>(() => rams.find((r) => r.id === DEFAULT_RAM_ID) ?? rams[0]);
  const [monitorRes, setMonitorRes] = useState<Resolution>("QHD");
  const [monitorHz, setMonitorHz] = useState<RefreshRate>(144);

  const cpuSeriesOf = useMemo(() => (item: CPU) => derivePartSeries(item.name), []);
  const cpuCascade = useCascadingPartSelect(cpus, cpuSeriesOf, cpu.id);

  const handleCpuSelect = (id: string) => {
    cpuCascade.selectModel(id);
    const found = cpus.find((c) => c.id === id);
    if (found) setCpu(found);
  };
  const handleGpuSelect = (id: string) => {
    const found = gpus.find((g) => g.id === id);
    if (found) setGpu(found);
  };
  const handleRamSelect = (id: string) => {
    const found = rams.find((r) => r.id === id);
    if (found) setRam(found);
  };

  // 최초 마운트 1회 — /my-pc에서 "성능 최적화 가이드 보기" 버튼으로 넘어온 ?spec= 이 있으면
  // 그대로 복원해 입력 단계를 건너뛴다. next/navigation의 useSearchParams()는 이 서브트리를
  // 클라이언트 전용 렌더로 강제 전환시켜(BAILOUT_TO_CLIENT_SIDE_RENDERING) 정적/서버 렌더
  // 콘텐츠가 비어버리는 회귀가 있었다(app/my-pc/MyPcClient.tsx도 같은 이유로 window.location만 씀).
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("spec");
    if (raw) {
      const decoded = decodeSpec(raw);
      if (decoded) {
        const foundCpu = cpus.find((c) => c.id === decoded.c);
        const foundGpu = gpus.find((g) => g.id === decoded.g);
        const foundRam = rams.find((r) => r.id === decoded.r);
        if (foundCpu) handleCpuSelect(foundCpu.id);
        if (foundGpu) handleGpuSelect(foundGpu.id);
        if (foundRam) setRam(foundRam);
        if (decoded.mr === "FHD" || decoded.mr === "QHD" || decoded.mr === "4K") setMonitorRes(decoded.mr);
        if (decoded.mh === 60 || decoded.mh === 144 || decoded.mh === 240) setMonitorHz(decoded.mh);
        if (foundCpu && foundGpu) {
          setStep("result");
          return;
        }
      }
    }
    setStep("input");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 마운트 1회만 실행
  }, []);

  const workloadScores = useMemo(() => (gpu ? scoreAllWorkloads(cpu, gpu, ram.capacity) : []), [cpu, gpu, ram]);
  const displayMatchRows = useMemo(
    () => (gpu ? evaluateAllGames(workloadScores, monitorRes, monitorHz, gpu.vram) : []),
    [workloadScores, monitorRes, monitorHz, gpu]
  );

  if (step === "loading") {
    return <div className="h-40 animate-pulse rounded-3xl bg-surface ring-1 ring-line" />;
  }

  if (step === "result" && gpu) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
          <p className="text-sm text-white/70">
            <span className="font-semibold text-white">{cpu.name}</span> · <span className="font-semibold text-white">{gpu.name}</span> · {ram.name}
          </p>
          <button
            type="button"
            onClick={() => setStep("input")}
            className="text-xs font-semibold text-brand-soft transition-colors hover:text-brand"
          >
            사양 다시 입력
          </button>
        </div>

        <GameSettingsSection rows={displayMatchRows} gpu={gpu} />
        <WindowsChecklistSection />
        <DriverUpdateSection gpuBrand={gpu.brand} />
      </div>
    );
  }

  return (
    <SectionCard className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold text-white">내 PC 사양 입력</h2>
        <p className="mt-1 text-sm text-white/50">그래픽카드는 최대한 자동으로 찾아드려요. 나머지만 골라주세요 — 어디에도 저장되지 않아요.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-white/70">그래픽카드(GPU)</p>
        <GpuAutoDetect onGpuSelected={handleGpuSelect} />
      </div>

      <CascadingPartSelect title="CPU" state={{ ...cpuCascade, selectModel: handleCpuSelect }} />

      <div>
        <label className="mb-2 block text-sm font-semibold text-white/70">메모리(RAM)</label>
        <DarkSelect value={ram.id} onChange={(event) => handleRamSelect(event.target.value)}>
          {rams.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </DarkSelect>
      </div>

      <DisplayControls res={monitorRes} hz={monitorHz} onRes={setMonitorRes} onHz={setMonitorHz} />

      <PrimaryButton full disabled={!gpu} onClick={() => setStep("result")}>
        가이드 보기
      </PrimaryButton>
    </SectionCard>
  );
}
