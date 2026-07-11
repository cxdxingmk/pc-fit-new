"use client";

/**
 * ============================================================================
 * RecommendationReasons.tsx — 견적 세트 '추천 이유' 인라인 확장 영역
 * ----------------------------------------------------------------------------
 * [잘리던 원인 → 수정 매핑]
 *
 *  ① 고정 높이/max-height + overflow:hidden
 *     · 기존: 목록 컨테이너에 h-[200px] 또는 max-h-* 가 걸려 마지막 항목이 잘림
 *     · 수정: 높이를 콘텐츠에 위임(auto). 부드러운 펼침은 max-height 트릭 대신
 *       `grid-template-rows: 0fr → 1fr` 전환으로 구현 — 콘텐츠가 아무리 길어도
 *       측정(measure) 코드 없이 정확한 auto 높이로 애니메이션됨.
 *
 *  ② 한글 줄바꿈 붕괴 (가로 탈출)
 *     · 수정: `word-break: keep-all` (한글 어절 단위 줄바꿈)
 *             + `overflow-wrap: anywhere` (URL·모델명 등 초장 토큰 안전망)
 *             + `white-space: pre-wrap` (작성된 개행 보존)
 *
 *  ③ Flex 자식의 min-width:auto 함정
 *     · flex/grid 자식은 기본 min-width:auto 라서 긴 텍스트가 부모 벽을 뚫음
 *     · 수정: 텍스트를 감싸는 flex 자식에 `min-w-0` 명시
 *
 *  ④ 패딩 스쿼시(찌그러짐)
 *     · 컨테이너가 좁아질 때 아이콘/불릿이 shrink 되며 여백이 무너짐
 *     · 수정: 불릿 요소에 `shrink-0`, 카드 항목은 사방 패딩을 항목 자신이 소유
 * ============================================================================
 */

import { useId } from "react";

export interface RecommendationReasonsProps {
  /** 추천 사유 목록 (줄바꿈 \n 포함 가능 — pre-wrap 으로 보존됨) */
  reasons: string[];
  /** 펼침 여부 — 옆 "견적 보기" 패널과 상호배타적으로 열려야 해서 부모가 상태를 소유한다. */
  open: boolean;
  onToggle: () => void;
  /** 토글 버튼 라벨 */
  label?: string;
  className?: string;
}

export default function RecommendationReasons({
  reasons,
  open,
  onToggle,
  label = "추천 이유",
  className = "",
}: RecommendationReasonsProps) {
  const panelId = useId();

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {/* 토글 버튼 — 옆 "견적 보기" 버튼과 동일한 pill 톤 유지 */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.02] px-4 py-2 text-sm font-semibold
                   text-white/50 ring-1 ring-line transition hover:text-white/80
                   focus-visible:outline focus-visible:outline-2
                   focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {label}
        <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/*
        ★ 핵심: grid rows 0fr↔1fr 로 'auto 높이'를 부드럽게 전환.
        max-height 하드코딩이 없으므로 사유가 10줄이어도 절대 잘리지 않음.
        prefers-reduced-motion 사용자는 즉시 전환.
      */}
      <div
        id={panelId}
        role="region"
        aria-label={label}
        className={`grid w-full transition-[grid-template-rows] duration-300 ease-out
                    motion-reduce:transition-none
                    ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        {/* grid 트릭의 필수 짝: 자식은 overflow-hidden + min-h-0 */}
        <div className="min-h-0 overflow-hidden">
          <ul className="mt-3 flex min-w-0 flex-col gap-2 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
            {reasons.map((reason, i) => (
              <li
                key={i}
                /* 높이 고정 없음(height:auto) · 항목이 자기 패딩을 소유해
                   스쿼시 불가 · min-w-0 로 가로 탈출 차단 */
                className="flex min-w-0 items-start gap-2.5 rounded-xl bg-white/[0.03] px-4 py-3"
              >
                {/* 불릿: shrink-0 으로 찌그러짐 방지 */}
                <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/80" />
                <p className="min-w-0 whitespace-pre-wrap text-sm leading-6 text-white/70 [overflow-wrap:anywhere] [word-break:keep-all]">
                  {reason}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
