"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PurposeStep from "./components/PurposeStep";
import ExistingPartsStep from "@/app/build/components/ExistingPartsStep";
import BudgetStep from "./components/BudgetStep";
import { useBuild } from "../context/BuildContext";

export default function BuildPage() {
  const router = useRouter();
  const {
    buildData,
    togglePurpose,
    setPurposeText,
    toggleVideoSoftware,
    setVideoSoftwareCustomText,
    setBudgetPreset,
    setBudgetCustom,
    updateExistingPart,
    setCaseOwnership,
  } = useBuild();

  const [current, setCurrent] = useState(0);
  const steps = ["purpose", "ownedParts", "budget"] as const;
  const currentStep = steps[current];

  const next = () => {
    if (current < steps.length - 1) {
      setCurrent(current + 1);
    } else {
      router.push("/result");
    }
  };

  const back = () => {
    if (current > 0) {
      setCurrent(current - 1);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-400">PC 추천 빌드</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-100">내게 딱 맞는 컴퓨터를 구성해보세요</h1>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-300">
              단계 {current + 1} / {steps.length}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {currentStep === "purpose" && (
            <PurposeStep
              selectedPurposes={buildData.purposes}
              purposeText={buildData.purposeText}
              videoSoftware={buildData.videoSoftware}
              videoSoftwareCustomText={buildData.videoSoftwareCustomText}
              onTogglePurpose={togglePurpose}
              onPurposeTextChange={setPurposeText}
              onToggleVideoSoftware={toggleVideoSoftware}
              onVideoSoftwareCustomTextChange={setVideoSoftwareCustomText}
            />
          )}

          {currentStep === "ownedParts" && (
            <ExistingPartsStep
              existingParts={buildData.existingParts}
              updateExistingPart={updateExistingPart}
              caseOwnership={buildData.caseOwnership}
              setCaseOwnership={setCaseOwnership}
            />
          )}

          {currentStep === "budget" && (
            <BudgetStep
              selectedBudget={buildData.budget.preset}
              customRaw={buildData.budget.customRaw}
              customValue={buildData.budget.customValue}
              onPresetSelect={setBudgetPreset}
              onCustomChange={setBudgetCustom}
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={back}
            disabled={current === 0}
            className="inline-flex h-14 min-w-[140px] items-center justify-center rounded-3xl border border-white/15 bg-slate-900 px-6 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            이전 단계
          </button>
          <button
            type="button"
            onClick={next}
            className="inline-flex h-14 min-w-[140px] items-center justify-center rounded-3xl bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-400"
          >
            {current === steps.length - 1 ? "결과 보기" : "다음 단계"}
          </button>
        </div>
      </div>
    </main>
  );
}
