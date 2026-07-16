"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PsuGuide.tsx — 최소 권장 파워 안내 UI
 * ─────────────────────────────────────────────────────────────────────────────
 * ▶ UX 배치 결정:
 *   견적 테이블의 '파워' 행 하단 마이크로 카피 한 곳에서만 안내한다.
 *   파워를 보는 바로 그 맥락에서 안내하는 것이 인지 비용이 가장 낮고,
 *   항상 노출되어도 시각적 소음이 없다(저채도/저가중치 스타일).
 *   과거엔 미달 시 대시보드 하단에 별도 얼럿 배너도 함께 띄웠으나, 같은 경고를
 *   두 곳에서 반복 노출하는 것이라 제거하고 이 인라인 안내로 통합했다.
 *
 * ▶ 시각 가중치:
 *   - 정상: text-xs + text-white/40 (FPS/병목 등 주요 지표보다 확실히 낮은 위계)
 *   - 미달: text-warn + ⚠ 아이콘 (미세 경고 스테이트)
 *
 * ▶ 연결 대상: app/lib/psuRecommendation.ts(로직), components/ui/InfoTooltip.tsx(설명 아이콘)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo } from "react";
import InfoTooltip from "./InfoTooltip";
import {
  calculatePsuRecommendation,
  evaluatePsuAdequacy,
  type PsuAdequacy,
  type PsuRecommendation,
} from "@/app/lib/psuRecommendation";

// ═══ 공용 훅 — 계산 로직을 컴포넌트에서 한 번만 수행 ═══
export function usePsuGuide(cpuName: string, gpuName: string, selectedPsuName?: string | null) {
  return useMemo(() => {
    const recommendation = calculatePsuRecommendation(cpuName, gpuName);
    const adequacy = evaluatePsuAdequacy(selectedPsuName, recommendation);
    return { recommendation, adequacy };
  }, [cpuName, gpuName, selectedPsuName]);
}

// ═══ 툴팁 설명문 생성 ═══
function buildTooltipCopy(rec: PsuRecommendation): string {
  return `CPU(${rec.cpuTdp}W) + 그래픽카드(${rec.gpuTdp}W) + 기타 부품의 피크 전력에 안전 마진 ${Math.round(rec.marginRatio * 100)}%를 더해 계산했어요.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PsuInlineGuide — 견적 테이블 '파워' 행 하단 마이크로 카피 (상시 노출, 유일한 안내 위치)
// ═══════════════════════════════════════════════════════════════════════════
export function PsuInlineGuide({ recommendation, adequacy }: { recommendation: PsuRecommendation; adequacy: PsuAdequacy }) {
  const approx = recommendation.isEstimated ? "약 " : "";
  const isWarning = adequacy === "insufficient" || adequacy === "low_headroom";

  const message =
    adequacy === "insufficient"
      ? `선택한 파워가 권장 용량(${approx}${recommendation.recommendedWatt}W)보다 낮아요.`
      : adequacy === "low_headroom"
        ? "여유가 거의 없어요. 한 단계 높은 용량을 권장해요."
        : `이 시스템의 최소 권장 파워는 ${approx}${recommendation.recommendedWatt}W입니다.`;

  return (
    <p
      className={[
        "flex items-center justify-center gap-1 px-3 pb-2.5 text-xs",
        isWarning ? "font-medium text-warn" : "font-normal text-white/40",
      ].join(" ")}
    >
      {isWarning && <span aria-hidden="true">⚠</span>}
      {message}
      <InfoTooltip content={buildTooltipCopy(recommendation)} preferredPlacement="top" ariaLabel="권장 파워 계산 기준" />
    </p>
  );
}
