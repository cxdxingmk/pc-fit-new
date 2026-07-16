"use client";

import { useEffect, useState } from "react";

export interface StageTransitionProps {
  /** 순서대로 보여줄 단계 라벨(예: ["그래픽카드 감지", "성능 매칭", "진단서 생성"]) */
  stages: string[];
  /** 전체 연출 길이(ms) — 단계 수로 균등 분배된다 */
  totalDurationMs: number;
  onComplete: () => void;
  title?: string;
}

/**
 * /analyze→/my-pc, /build→/result 같은 "즉시 리다이렉트"를 대체하는 짧은 로딩 연출.
 * prefers-reduced-motion이면 애니메이션 없이 거의 즉시 onComplete를 호출한다(모션 최소화 요구
 * 무시하지 않기 위함) — 실제 감지/계산 시간을 인위적으로 부풀리는 게 아니라, 이미 클라이언트에서
 * 순식간에 끝나는 연산에 "무슨 일이 일어나고 있는지" 보여주는 순수 UX 연출이다.
 */
export default function StageTransition({ stages, totalDurationMs, onComplete, title }: StageTransitionProps) {
  const [stageIndex, setStageIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
  }, []);

  useEffect(() => {
    if (reducedMotion === null) return; // 아직 판별 전 — 깜빡임 방지로 대기

    if (reducedMotion) {
      onComplete();
      return;
    }

    const stageDuration = totalDurationMs / stages.length;
    const stageTimer = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, stages.length - 1));
    }, stageDuration);
    const completeTimer = setTimeout(onComplete, totalDurationMs);

    return () => {
      clearInterval(stageTimer);
      clearTimeout(completeTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onComplete/stages/totalDurationMs는 호출부에서 안정적으로 유지된다고 가정
  }, [reducedMotion]);

  if (reducedMotion) return null; // 즉시 onComplete가 불려 이 프레임은 사실상 안 보임

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand" />
      </div>
      {title && <p className="text-lg font-bold text-white">{title}</p>}
      <div className="flex flex-col gap-2">
        {stages.map((stage, i) => (
          <p
            key={stage}
            className={`text-sm transition-colors duration-300 ${
              i < stageIndex ? "text-good" : i === stageIndex ? "font-semibold text-white" : "text-white/30"
            }`}
          >
            {i < stageIndex ? "✓ " : ""}
            {stage}
          </p>
        ))}
      </div>
    </main>
  );
}
