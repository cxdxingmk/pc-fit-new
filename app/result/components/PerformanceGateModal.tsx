"use client";

import { useEffect } from "react";
import { trackEvent } from "../../lib/analytics";

type PerformanceGateModalProps = {
  isOpen: boolean;
  isLocked: boolean;
  estimateId: string;
  onClose: () => void;
  onGoRegister: () => void;
  bundleTitle: string;
  cpuName: string;
  gpuName: string;
  cpuIndex: number | null;
  gpuIndex: number | null;
};

export default function PerformanceGateModal({
  isOpen,
  isLocked,
  estimateId,
  onClose,
  onGoRegister,
  bundleTitle,
  cpuName,
  gpuName,
  cpuIndex,
  gpuIndex,
}: PerformanceGateModalProps) {
  useEffect(() => {
    if (isOpen && isLocked) {
      trackEvent("performance_gate_modal_shown", { estimateId });
    }
  }, [isOpen, isLocked, estimateId]);

  if (!isOpen) return null;

  const combinedIndex =
    cpuIndex !== null && gpuIndex !== null
      ? Math.round(cpuIndex * 0.45 + gpuIndex * 0.55)
      : null;

  const normalizeScore = (value: number | null) => {
    if (value === null) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  };

  const gameMetrics = [
    { label: "배틀그라운드", score: combinedIndex !== null ? Math.round(combinedIndex * 0.92) : null },
    { label: "Cyberpunk 2077", score: combinedIndex !== null ? Math.round(combinedIndex * 0.85) : null },
  ];

  const workMetrics = [
    { label: "Premiere Pro", score: cpuIndex !== null ? Math.round(cpuIndex * 0.9) : null },
    { label: "Blender", score: gpuIndex !== null ? Math.round(gpuIndex * 0.93) : null },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-surface p-6 shadow-card ring-1 ring-line">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brand-soft">{bundleTitle}</p>
            <h3 className="mt-1 text-xl font-bold text-white">상세 성능 분석</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
            aria-label="닫기"
          >
            x
          </button>
        </div>

        {isLocked ? (
          <div className="mt-6 rounded-2xl bg-brand-dim p-5 ring-1 ring-brand/25">
            <p className="text-base font-semibold text-white">해당 견적의 상세 성능 분석 결과를 확인하려면 내 컴퓨터를 등록해주세요</p>
            <p className="mt-2 text-sm text-white/60">등록 완료 후 추천 견적과 내 PC를 비교한 성능 지수를 확인할 수 있습니다.</p>
            <button
              type="button"
              onClick={() => {
                trackEvent("performance_gate_register_redirect", { estimateId });
                onGoRegister();
              }}
              className="mt-4 inline-flex items-center rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-soft"
            >
              내 PC 등록하러 가기
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
                <p className="text-xs font-semibold text-white/40">CPU INDEX</p>
                <p className="mt-1 text-2xl font-bold text-white">{cpuIndex ?? "N/A"}</p>
                <p className="mt-1 text-xs text-white/40">{cpuName}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
                <p className="text-xs font-semibold text-white/40">GPU INDEX</p>
                <p className="mt-1 text-2xl font-bold text-white">{gpuIndex ?? "N/A"}</p>
                <p className="mt-1 text-xs text-white/40">{gpuName}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
                <p className="text-xs font-semibold text-white/40">COMBINED INDEX</p>
                <p className="mt-1 text-2xl font-bold text-white">{combinedIndex ?? "N/A"}</p>
                <p className="mt-1 text-xs text-white/40">추천 견적 기준</p>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
              <p className="text-xs font-semibold text-white/40">게임 성능 대시보드</p>
              <div className="mt-3 space-y-3">
                {gameMetrics.map((metric) => {
                  const score = normalizeScore(metric.score);
                  return (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/80">{metric.label}</p>
                        <p className="text-xs font-semibold text-white/40">{metric.score ?? "N/A"}</p>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-white/[0.06]">
                        <div className="h-2 rounded-full bg-brand transition-all duration-500" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
              <p className="text-xs font-semibold text-white/40">작업 성능 대시보드</p>
              <div className="mt-3 space-y-3">
                {workMetrics.map((metric) => {
                  const score = normalizeScore(metric.score);
                  return (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-white/80">{metric.label}</p>
                        <p className="text-xs font-semibold text-white/40">{metric.score ?? "N/A"}</p>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-white/[0.06]">
                        <div className="h-2 rounded-full bg-brand transition-all duration-500" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs font-semibold text-white/40">벤치마크 점수를 기반으로 게임/작업 시나리오별 상대 성능을 시각화합니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
