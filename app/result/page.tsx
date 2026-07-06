"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuild } from "../context/BuildContext";
import { recommend } from "../lib/recommender";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { getSavedPc } from "../lib/savedPc";

import CompatibilityCard from "./components/CompatibilityCard";
import PerformanceGateModal from "./components/PerformanceGateModal";

type ResultItem = ReturnType<typeof recommend>[number];

function EstimateAccordionCard({
  item,
  index,
  isOpen,
  onToggle,
  onOpenPerformance,
}: {
  item: ResultItem;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onOpenPerformance: () => void;
}) {
  const [isReasonOpen, setIsReasonOpen] = useState(false);
  const isVisible = isOpen;
  const strategyTag = index === 0 ? "균형 최적" : index === 1 ? "가성비 추천" : "최고성능 지향";
  const performanceParts = item.parts.filter((part) => !/케이스|case/i.test(part.label));

  return (
    <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">TOP {index + 1}</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">완성형 견적 세트</h2>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{strategyTag}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">총금액</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{item.totalPrice.toLocaleString()}원</p>
        <div className="mt-3 space-y-1 text-sm text-slate-700">
          <p>
            <span className="font-semibold text-slate-900">CPU</span>: {item.cpu}
          </p>
          <p>
            <span className="font-semibold text-slate-900">GPU</span>: {item.gpu}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200"
            aria-expanded={isVisible}
            aria-controls={`estimate-detail-${item.id}`}
          >
            {isVisible ? "견적 닫기" : "견적 보기"}
            <svg
              className={`h-4 w-4 transition-transform duration-300 ease-in-out ${isVisible ? "rotate-180" : "rotate-0"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => setIsReasonOpen((prev) => !prev)}
            className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            aria-expanded={isReasonOpen}
            aria-controls={`estimate-reason-${item.id}`}
          >
            추천 이유
          </button>
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">종합 {item.finalScore.toFixed(1)}점</span>
      </div>

      <div
        id={`estimate-reason-${item.id}`}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isReasonOpen ? "mt-3 max-h-56 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">추천 이유</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
            {item.reason.map((line) => (
              <li key={line} className="rounded-xl bg-white px-3 py-2">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        id={`estimate-detail-${item.id}`}
        className={`transition-all duration-300 ease-in-out ${isVisible ? "mt-4 max-h-[1200px] overflow-hidden opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}
      >
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <CompatibilityCard score={item.compatibilityScore} warnings={item.warnings} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-600">부품별 세부 견적</p>
            <ul className="mt-3 space-y-3 text-sm text-slate-700">
              {performanceParts.map((part) => (
                <li key={part.label} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <div>
                    <p className="font-semibold text-slate-900">{part.label}</p>
                    <p className="text-xs text-slate-500">{part.name}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{part.price.toLocaleString()}원</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-700">호환성 근거</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {item.compatibilityDetails.map((detail) => (
                <li key={detail} className="rounded-xl bg-white px-3 py-2">
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          type="button"
          onClick={onOpenPerformance}
          className="inline-flex w-full items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
        >
          성능 보기
        </button>
      </div>
    </article>
  );
}

type ModalState = {
  isOpen: boolean;
  isLocked: boolean;
  estimateId: string;
  bundleTitle: string;
  cpuName: string;
  gpuName: string;
  cpuIndex: number | null;
  gpuIndex: number | null;
};

export default function ResultPage() {
  const router = useRouter();
  const { buildData } = useBuild();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    isLocked: true,
    estimateId: "",
    bundleTitle: "",
    cpuName: "",
    gpuName: "",
    cpuIndex: null,
    gpuIndex: null,
  });

  const topResults = useMemo(
    () => recommend(buildData.answers, buildData.existingParts, buildData.caseOwnership),
    [buildData.answers, buildData.existingParts, buildData.caseOwnership]
  );

  const openPerformanceModal = (index: number, estimateId: string, cpuName: string, gpuName: string) => {
    console.log("[GA4-ready]", "performance_gate_button_click", { estimateRank: index + 1, estimateId });
    const savedPc = getSavedPc();
    const cpuRecord = cpus.find((cpu) => cpu.name === cpuName);
    const gpuRecord = gpus.find((gpu) => gpu.name === gpuName);

    setModalState({
      isOpen: true,
      isLocked: savedPc === null,
      estimateId,
      bundleTitle: `추천 #${index + 1} 성능 보기`,
      cpuName,
      gpuName,
      cpuIndex: cpuRecord?.gameScore ?? null,
      gpuIndex: gpuRecord?.gameScore ?? null,
    });
  };

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">AI 기반 견적 추천</p>
          <h1 className="mt-3 text-4xl font-bold text-slate-900 sm:text-5xl">
            TOP 3 완성형 PC 견적 세트
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
            보유 부품과 예산을 반영해 소켓·전력·메모리 규격까지 맞춘 완성형 세트를 제안합니다.
          </p>
        </div>

        {topResults.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-xl font-semibold text-slate-900">추천 결과가 없습니다.</p>
            <p className="mt-3 text-slate-600">빌드 단계를 완료한 후 다시 시도해 주세요.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
              {topResults.map((item, index) => {
                return (
                  <EstimateAccordionCard
                    key={item.id}
                    item={item}
                    index={index}
                    isOpen={expandedIndex === index}
                    onToggle={() => setExpandedIndex((prev) => (prev === index ? null : index))}
                    onOpenPerformance={() => openPerformanceModal(index, item.id, item.cpu, item.gpu)}
                  />
                );
              })}
            </div>

            <PerformanceGateModal
              isOpen={modalState.isOpen}
              isLocked={modalState.isLocked}
              onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
              onGoRegister={() => router.push("/mypage/register-pc")}
              estimateId={modalState.estimateId}
              bundleTitle={modalState.bundleTitle}
              cpuName={modalState.cpuName}
              gpuName={modalState.gpuName}
              cpuIndex={modalState.cpuIndex}
              gpuIndex={modalState.gpuIndex}
            />
          </>
        )}
      </div>
    </main>
  );
}