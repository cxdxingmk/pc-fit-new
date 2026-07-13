"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuild } from "../context/BuildContext";
import { recommend } from "../lib/recommender";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import { getSavedPc } from "../lib/savedPc";
import { trackEvent } from "../lib/analytics";
import { SectionCard, PrimaryButton, FX } from "../components/pcfit-ui";
import RecommendationReasons from "../components/quote/RecommendationReasons";

import CompatibilityCard from "./components/CompatibilityCard";
import PerformanceGateModal from "./components/PerformanceGateModal";
import Container from "@/components/layout/Container";
import IndependenceNotice from "@/components/ui/IndependenceNotice";

type ResultItem = ReturnType<typeof recommend>[number];

const STRATEGY_TAGS = ["균형 최적", "가성비 추천", "최고성능 지향"] as const;
const SUMMARY_PART_KEYS = ["cpu", "gpu", "ram", "ssd"] as const;
const SUMMARY_PART_LABELS: Record<(typeof SUMMARY_PART_KEYS)[number], string> = {
  cpu: "CPU",
  gpu: "GPU",
  ram: "RAM",
  ssd: "SSD",
};

/** TOP1~3 세트를 서로 비교해 "왜 이 견적이 다른가"를 보여주는 diff 플래그를 계산한다.
 *  세 세트 모두 같은 부품이면 굳이 강조할 필요가 없고, 하나라도 다르면 그 부품이 견적 차이의 핵심이다. */
function computePartDiffFlags(items: ResultItem[]): Record<(typeof SUMMARY_PART_KEYS)[number], boolean> {
  const flags = {} as Record<(typeof SUMMARY_PART_KEYS)[number], boolean>;
  for (const key of SUMMARY_PART_KEYS) {
    const values = new Set(items.map((item) => item[key]));
    flags[key] = values.size > 1;
  }
  return flags;
}

function EstimateAccordionCard({
  item,
  index,
  diffFlags,
  isOpen,
  onToggle,
  reasonsOpen,
  onToggleReasons,
  onOpenPerformance,
}: {
  item: ResultItem;
  index: number;
  diffFlags: Record<(typeof SUMMARY_PART_KEYS)[number], boolean>;
  isOpen: boolean;
  onToggle: () => void;
  reasonsOpen: boolean;
  onToggleReasons: () => void;
  onOpenPerformance: () => void;
}) {
  const featured = index === 0;
  const strategyTag = STRATEGY_TAGS[index] ?? STRATEGY_TAGS[STRATEGY_TAGS.length - 1];
  const performanceParts = item.parts.filter((part) => !/케이스|case/i.test(part.label));

  return (
    <article className={`flex flex-col gap-5 rounded-3xl bg-surface p-7 shadow-card ${FX.card} ${featured ? "ring-2 ring-brand/60 shadow-glow" : "ring-1 ring-line"}`}>
      <header className="flex items-center justify-between">
        <span className="text-xs font-bold tracking-wider text-white/35">TOP {index + 1}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${featured ? "bg-brand text-white" : "bg-white/[0.05] text-white/60"}`}>
          {strategyTag}
        </span>
      </header>

      <div>
        <p className="text-xs font-medium text-white/35">총 금액</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight text-white">
          {item.totalPrice.toLocaleString()}
          <span className="ml-1 text-lg font-bold text-white/40">원</span>
        </p>
      </div>

      <dl className="flex flex-col gap-2 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
        {SUMMARY_PART_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-3 text-sm">
            <dt className="shrink-0 text-white/35">{SUMMARY_PART_LABELS[key]}</dt>
            <dd className={`truncate text-right font-semibold ${diffFlags[key] ? "text-brand-soft" : "text-white/80"}`}>
              {item[key]}
              {diffFlags[key] && <span className="ml-1.5 text-[10px] font-bold text-brand-soft/70">차이</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/70 ring-1 ring-line transition-all hover:bg-white/[0.08]"
            aria-expanded={isOpen}
            aria-controls={`estimate-detail-${item.id}`}
          >
            {isOpen ? "견적 닫기" : "견적 보기"}
            <svg
              className={`h-4 w-4 transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : "rotate-0"}`}
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

          <RecommendationReasons reasons={item.reason} open={reasonsOpen} onToggle={onToggleReasons} className="contents" />
        </div>

        <span className="shrink-0 pt-2 text-xs font-semibold text-white/40">종합 {item.finalScore.toFixed(1)}점</span>
      </div>

      <div
        id={`estimate-detail-${item.id}`}
        className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[1200px] overflow-hidden opacity-100" : "max-h-0 overflow-hidden opacity-0"}`}
      >
        <div className="flex flex-col gap-4 rounded-2xl bg-white/[0.02] p-4 ring-1 ring-line">
          <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-line">
            <p className="text-sm font-semibold text-white/60">부품별 세부 견적</p>
            <ul className="mt-3 space-y-3 text-sm text-white/70">
              {performanceParts.map((part) => (
                <li key={part.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
                  <div>
                    <p className="font-semibold text-white/90">{part.label}</p>
                    <p className="text-xs text-white/40">{part.name}</p>
                  </div>
                  <span className="text-sm font-semibold text-white/75">{part.price.toLocaleString()}원</span>
                </li>
              ))}
            </ul>
          </div>

          <CompatibilityCard score={item.compatibilityScore} warnings={item.warnings} />

          <div className="rounded-2xl bg-good/10 p-4 ring-1 ring-good/20">
            <p className="text-sm font-semibold text-good">호환성 근거</p>
            <ul className="mt-2 space-y-2 text-sm text-white/70">
              {item.compatibilityDetails.map((detail) => (
                <li key={detail} className="rounded-xl bg-white/[0.03] px-3 py-2">
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <PrimaryButton full onClick={onOpenPerformance}>
        이 견적으로 성능 보기
      </PrimaryButton>
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

type PanelKind = "estimate" | "reasons";
type OpenPanel = { index: number; kind: PanelKind } | null;

export default function ResultPage() {
  const router = useRouter();
  const { buildData } = useBuild();
  // TOP1/2/3 카드를 통틀어 "견적 보기"/"추천 이유" 패널 중 단 하나만 열리도록 페이지 레벨에서
  // 단일 상태로 관리한다(카드별로 따로 관리하면 다른 카드의 패널이 동시에 열려 있을 수 있어
  // 스크롤이 길어지는 문제가 그대로 남는다 — 전체를 통틀어 하나만 열리는 쪽이 실제 요구를 해결한다).
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const togglePanel = (index: number, kind: PanelKind) => {
    setOpenPanel((prev) => (prev && prev.index === index && prev.kind === kind ? null : { index, kind }));
  };
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
    () =>
      recommend(
        buildData.answers,
        buildData.existingParts,
        buildData.caseOwnership,
        buildData.purposes,
        buildData.budget.range,
        buildData.budget.exactValue
      ),
    [
      buildData.answers,
      buildData.existingParts,
      buildData.caseOwnership,
      buildData.purposes,
      buildData.budget.range,
      buildData.budget.exactValue,
    ]
  );

  const diffFlags = useMemo(() => computePartDiffFlags(topResults), [topResults]);

  const openPerformanceModal = (index: number, estimateId: string, cpuName: string, gpuName: string) => {
    trackEvent("performance_gate_button_click", { estimateRank: index + 1, estimateId });
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
    <main className="min-h-screen bg-ink py-12 text-white">
      <Container>
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-soft">AI 기반 견적 추천</p>
          <h1 className="mt-3 text-4xl font-extrabold text-white sm:text-5xl">TOP 3 완성형 PC 견적 세트</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/50">
            보유 부품과 예산을 반영해 소켓·전력·메모리 규격까지 맞춘 완성형 세트를 제안합니다.
          </p>
        </div>

        {topResults.length === 0 ? (
          <SectionCard className="text-center">
            <p className="text-xl font-semibold text-white">추천 결과가 없습니다.</p>
            <p className="mt-3 text-white/50">빌드 단계를 완료한 후 다시 시도해 주세요.</p>
          </SectionCard>
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-3">
              {topResults.map((item, index) => (
                <EstimateAccordionCard
                  key={item.id}
                  item={item}
                  index={index}
                  diffFlags={diffFlags}
                  isOpen={openPanel?.index === index && openPanel.kind === "estimate"}
                  onToggle={() => togglePanel(index, "estimate")}
                  reasonsOpen={openPanel?.index === index && openPanel.kind === "reasons"}
                  onToggleReasons={() => togglePanel(index, "reasons")}
                  onOpenPerformance={() => openPerformanceModal(index, item.id, item.cpu, item.gpu)}
                />
              ))}
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

            <IndependenceNotice className="mt-8" />
          </>
        )}
      </Container>
    </main>
  );
}
