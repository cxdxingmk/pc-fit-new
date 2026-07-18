"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useBuild } from "../context/BuildContext";
import { recommend, findCheapestViableTotalPrice } from "../lib/recommender";
import { encodeSpec } from "../lib/specPermalink";
import { buildPerformanceSpec } from "../lib/estimatePermalink";
import { trackEvent } from "../lib/analytics";
import { SectionCard, PrimaryButton, FX } from "../components/pcfit-ui";
import { RecommendationReasonsToggle, RecommendationReasonsPanel } from "../components/quote/RecommendationReasons";

import CompatibilityCard from "./components/CompatibilityCard";
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

// "OO만원 이상을 권장해요" 안내용 — 10만원 단위로 올림해, 안내한 금액으로 다시 시도해도
// 여전히 애매하게 부족한 상황이 나오지 않게 한다.
function formatManwonRoundedUp(won: number): string {
  const roundedUp = Math.ceil(won / 100_000) * 100_000;
  return `${Math.round(roundedUp / 10_000).toLocaleString()}만원`;
}

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
  const reasonsPanelId = useId();

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
              {item.ownedParts[key] && <span className="ml-1.5 rounded-full bg-good/10 px-1.5 py-0.5 text-[10px] font-bold text-good">보유 중</span>}
              {diffFlags[key] && <span className="ml-1.5 text-[10px] font-bold text-brand-soft/70">차이</span>}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-start justify-between gap-3">
        {/* flex-wrap이었을 때 TOP1 카드에서만(그리드 3분할의 서브픽셀 반올림으로 이 줄의 가용
            너비가 두 버튼 합계보다 1px 미만 모자란 경우가 있었다) "추천 이유" 버튼이 다음 줄로
            밀려 "견적 보기"와 나란히 서지 못하는 회귀가 있었다. 패널을 이 줄 밖으로 뺀 지금은
            이 줄에 버튼 2개만 남으므로 줄바꿈이 필요할 이유가 없다 — nowrap으로 고정하고, 버튼에
            shrink-0을 줘서 그 서브픽셀 부족분 때문에 버튼 자체가 찌그러져(내부 텍스트가 2줄로
            밀림) 카드마다 높이가 달라지는 일도 없게 한다(0.5px 미만의 시각적으로 무의미한
            오버플로만 남는다). */}
        <div className="flex flex-nowrap items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white/70 ring-1 ring-line transition-all hover:bg-white/[0.08]"
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

          <RecommendationReasonsToggle open={reasonsOpen} onToggle={onToggleReasons} panelId={reasonsPanelId} />
        </div>

        <span className="shrink-0 pt-2 text-xs font-semibold text-white/40">종합 {item.finalScore.toFixed(1)}점</span>
      </div>

      <RecommendationReasonsPanel reasons={item.reason} open={reasonsOpen} panelId={reasonsPanelId} />

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

  // "정확한 금액 입력"으로 target±20만원 안에 구성 가능한 조합이 하나도 없는 경우(예: 목표가가
  // 최소 구성가보다 낮음) — 억지로 범위를 벗어난 결과를 보여주는 대신, 실제 구성 가능한 최저가를
  // 찾아 "OO만원 이상을 권장해요"로 안내한다.
  const isExactModeEmpty = buildData.budget.mode === "exact" && buildData.budget.exactValue !== null && topResults.length === 0;
  const cheapestViablePrice = useMemo(() => {
    if (!isExactModeEmpty) return null;
    return findCheapestViableTotalPrice(buildData.answers, buildData.existingParts, buildData.caseOwnership, buildData.purposes);
  }, [isExactModeEmpty, buildData.answers, buildData.existingParts, buildData.caseOwnership, buildData.purposes]);

  // /my-pc는 로그인/DB 저장 없이도 ?spec= 퍼머링크만으로 사양을 복원해 보여주는 페이지다
  // (/build 자체가 비로그인으로 시작 가능하니, 그 결과 조회도 로그인을 요구하면 안 된다).
  // 그래서 로그인 게이트 모달 대신 이 견적의 부품 id를 그대로 퍼머링크로 인코딩해 이동시킨다.
  const viewPerformance = (item: ResultItem, index: number) => {
    trackEvent("performance_gate_button_click", { estimateRank: index + 1, estimateId: item.id });
    const encoded = encodeSpec(buildPerformanceSpec(item));
    router.push(`/my-pc?spec=${encoded}`);
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
            {isExactModeEmpty ? (
              <>
                <p className="text-xl font-semibold text-white">이 예산으로는 구성이 어려워요.</p>
                <p className="mt-3 text-white/50">
                  {cheapestViablePrice !== null
                    ? `${formatManwonRoundedUp(cheapestViablePrice)} 이상을 권장해요.`
                    : "입력하신 조건(보유 부품 등)으로는 구성 가능한 조합을 찾지 못했어요."}
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-semibold text-white">추천 결과가 없습니다.</p>
                <p className="mt-3 text-white/50">빌드 단계를 완료한 후 다시 시도해 주세요.</p>
              </>
            )}
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
                  onOpenPerformance={() => viewPerformance(item, index)}
                />
              ))}
            </div>

            <IndependenceNotice className="mt-8" />
          </>
        )}
      </Container>
    </main>
  );
}
