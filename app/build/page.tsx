"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PurposeStep from "./components/PurposeStep";
import ExistingPartsStep from "@/app/build/components/ExistingPartsStep";
import BudgetStep from "./components/BudgetStep";
import { useBuild } from "../context/BuildContext";
import Container from "@/components/layout/Container";
import StageTransition from "@/components/ui/StageTransition";

export default function BuildPage() {
  const router = useRouter();
  const {
    buildData,
    togglePurpose,
    setPurposeText,
    toggleVideoSoftware,
    setVideoSoftwareCustomText,
    setBudgetMode,
    setBudgetPreset,
    setBudgetExact,
    setBudgetRange,
    updateExistingPart,
    setCaseOwnership,
  } = useBuild();

  const [current, setCurrent] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shakePurpose, setShakePurpose] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const steps = ["purpose", "ownedParts", "budget"] as const;
  const currentStep = steps[current];
  const purposeMissing = currentStep === "purpose" && buildData.purposes.length === 0;

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2000);
  };

  const next = () => {
    // UX 차단(버튼 시각적 비활성 처리)과는 별개로, 새로고침/직접 라우팅/기타 우회 경로로도
    // 여기(실제 전이 지점)에 도달할 수 있으므로 단일 진실 공급원으로 여기서 다시 검증한다.
    if (currentStep === "purpose" && buildData.purposes.length === 0) {
      showToast("최소 하나의 용도를 선택해 주세요.");
      setShakePurpose(true);
      window.setTimeout(() => setShakePurpose(false), 400);
      return;
    }

    if (current < steps.length - 1) {
      setCurrent(current + 1);
    } else {
      setIsSubmitting(true);
    }
  };

  const back = () => {
    if (current > 0) {
      setCurrent(current - 1);
    }
  };

  if (isSubmitting) {
    return (
      <main className="min-h-screen bg-slate-950 py-12 text-slate-100">
        <StageTransition
          stages={["최적의 조합을 계산하는 중"]}
          totalDurationMs={900}
          title="맞춤 견적을 준비하고 있어요"
          onComplete={() => router.push("/result")}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-12 text-slate-100">
      {toastMessage ? (
        <div className="fixed right-6 top-6 z-[90] rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/10">
          {toastMessage}
        </div>
      ) : null}

      <Container className="space-y-6">
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
              shake={shakePurpose}
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
              mode={buildData.budget.mode}
              selectedBudget={buildData.budget.preset}
              exactValue={buildData.budget.exactValue}
              range={buildData.budget.range}
              onModeChange={setBudgetMode}
              onPresetSelect={setBudgetPreset}
              onExactChange={setBudgetExact}
              onRangeChange={setBudgetRange}
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
            aria-disabled={purposeMissing}
            className={`inline-flex h-14 min-w-[140px] items-center justify-center rounded-3xl px-6 text-sm font-semibold shadow-sm transition ${
              purposeMissing
                ? "cursor-not-allowed bg-slate-800 text-slate-500"
                : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            }`}
          >
            {current === steps.length - 1 ? "결과 보기" : "다음 단계"}
          </button>
        </div>
      </Container>
    </main>
  );
}
