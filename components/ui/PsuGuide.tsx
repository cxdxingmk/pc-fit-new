"use client";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PsuGuide.tsx — 최소 권장 파워 안내 UI (후보 A+B 조합 설계)
 * ─────────────────────────────────────────────────────────────────────────────
 * ▶ UX 배치 결정:
 *   [기본 노출]  후보 A — 견적 테이블의 '파워' 행 하단 마이크로 카피.
 *                파워를 보는 바로 그 맥락에서 안내하는 것이 인지 비용이 가장 낮고,
 *                항상 노출되어도 시각적 소음이 없음 (저채도/저가중치 스타일).
 *   [조건부 승격] 후보 B — 선택한 파워가 권장 용량 "미달"일 때만 대시보드 하단에
 *                얼럿 박스로 승격 노출. 문제가 없을 땐 얼럿을 띄우지 않아
 *                토스식 '필요한 순간에만 말 거는' UX를 유지.
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
// [후보 A] PsuInlineGuide — 견적 테이블 '파워' 행 하단 마이크로 카피 (상시 노출)
// ═══════════════════════════════════════════════════════════════════════════
export function PsuInlineGuide({ recommendation, adequacy }: { recommendation: PsuRecommendation; adequacy: PsuAdequacy }) {
  const approx = recommendation.isEstimated ? "약 " : "";
  const isWarning = adequacy === "insufficient";

  return (
    <p
      className={[
        "flex items-center justify-center gap-1 px-3 pb-2.5 text-xs",
        isWarning ? "font-medium text-warn" : "font-normal text-white/40",
      ].join(" ")}
    >
      {isWarning && <span aria-hidden="true">⚠</span>}
      {isWarning
        ? `선택한 파워가 권장 용량(${approx}${recommendation.recommendedWatt}W)보다 낮아요.`
        : `이 시스템의 최소 권장 파워는 ${approx}${recommendation.recommendedWatt}W입니다.`}
      <InfoTooltip content={buildTooltipCopy(recommendation)} preferredPlacement="top" ariaLabel="권장 파워 계산 기준" />
    </p>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// [후보 B] PsuAlertBanner — 권장 용량 미달 시에만 대시보드 하단에 승격 노출
//          (모니터/케이스 안내 문구 바로 아래 배치 권장)
// ═══════════════════════════════════════════════════════════════════════════
export function PsuAlertBanner({ recommendation, adequacy }: { recommendation: PsuRecommendation; adequacy: PsuAdequacy }) {
  // 정상/판정불가 상태에서는 얼럿을 띄우지 않음 — 후보 A가 이미 커버
  if (adequacy !== "insufficient") return null;

  return (
    <div role="alert" className="flex items-center justify-center gap-2 rounded-lg bg-warn/10 px-3 py-2.5 text-xs text-warn ring-1 ring-warn/20">
      <span aria-hidden="true">⚠️</span>
      <span>
        안정적인 시스템 구동을 위해 <strong className="font-semibold">{recommendation.recommendedWatt}W 이상</strong>의 파워를 권장합니다.
      </span>
    </div>
  );
}
