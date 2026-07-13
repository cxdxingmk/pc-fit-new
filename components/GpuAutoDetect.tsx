"use client";

/**
 * GpuAutoDetect — 진단 페이지 최상단에서 WebGL로 GPU를 자동감지하고,
 * 부품 DB와 매칭해 확정하거나(성공) 후보를 골라주거나(애매) 수동 선택으로
 * 폴백한다(실패). 원본 에러는 절대 화면에 노출하지 않는다.
 */
import { useEffect, useState } from "react";
import { detectGpu } from "@/app/lib/browserScan";
import { matchGpuToDb } from "@/app/lib/gpuMatch";
import { gpus, type GPU } from "@/app/database/gpu";
import DarkSelect from "./ui/DarkSelect";

type Status = "loading" | "matched" | "candidates" | "unmatched" | "failed";

export default function GpuAutoDetect({ onGpuSelected }: { onGpuSelected: (gpuId: string) => void }) {
  const [status, setStatus] = useState<Status>("loading");
  const [rawGpu, setRawGpu] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GPU[]>([]);
  const [confirmedGpu, setConfirmedGpu] = useState<GPU | null>(null);

  useEffect(() => {
    const normalized = detectGpu();
    setRawGpu(normalized);

    if (!normalized) {
      setStatus("failed");
      return;
    }

    const { matched, candidates: found } = matchGpuToDb(normalized);
    if (matched) {
      setConfirmedGpu(matched);
      setStatus("matched");
      onGpuSelected(matched.id);
    } else if (found.length > 0) {
      setCandidates(found);
      setStatus("candidates");
    } else {
      setStatus("unmatched");
    }
    // onGpuSelected는 매 렌더 새 함수로 들어올 수 있어 의존성에 넣지 않는다 — 마운트 시 1회 감지만 수행한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCandidateSelect = (gpu: GPU) => {
    setConfirmedGpu(gpu);
    setStatus("matched");
    onGpuSelected(gpu.id);
  };

  const handleManualSelect = (gpuId: string) => {
    const found = gpus.find((g) => g.id === gpuId);
    if (!found) return;
    setConfirmedGpu(found);
    setStatus("matched");
    onGpuSelected(found.id);
  };

  if (status === "loading") {
    return (
      <div className="animate-pulse rounded-2xl bg-surface p-5 ring-1 ring-line">
        <div className="h-3 w-24 rounded-full bg-white/10" />
        <div className="mt-3 h-5 w-48 rounded-full bg-white/10" />
      </div>
    );
  }

  if (status === "matched" && confirmedGpu) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-good/10 p-5 ring-1 ring-good/25">
        <span aria-hidden="true" className="text-lg">
          ✓
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold text-good">자동으로 찾았어요: {confirmedGpu.name}</p>
      </div>
    );
  }

  if (status === "candidates") {
    return (
      <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
        <p className="text-sm font-semibold text-warn">비슷한 GPU를 찾았어요. 맞는 걸 골라주세요.</p>
        {rawGpu && <p className="mt-1 text-xs text-white/40">감지된 원문: {rawGpu}</p>}
        <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="GPU 후보">
          {candidates.map((gpu) => (
            <button
              key={gpu.id}
              type="button"
              role="tab"
              onClick={() => handleCandidateSelect(gpu)}
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/80 ring-1 ring-line transition hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              {gpu.name}
            </button>
          ))}
        </div>
        <ManualGpuFallback onSelect={handleManualSelect} className="mt-4" />
      </div>
    );
  }

  // "unmatched" | "failed" — 자동감지에 실패했거나(웹GL 미지원 등), 감지는 됐지만 목록에 없는 경우
  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      <p className="text-sm font-semibold text-white/70">
        {status === "failed" ? "자동으로 찾지 못했어요. 직접 선택해 주세요." : "목록에서 정확히 일치하는 GPU를 찾지 못했어요. 직접 선택해 주세요."}
      </p>
      {status === "unmatched" && rawGpu && <p className="mt-1 text-xs text-white/40">감지된 원문: {rawGpu}</p>}
      <ManualGpuFallback onSelect={handleManualSelect} className="mt-3" />
    </div>
  );
}

function ManualGpuFallback({ onSelect, className }: { onSelect: (gpuId: string) => void; className?: string }) {
  return (
    <div className={className}>
      <DarkSelect aria-label="GPU 직접 선택" defaultValue="" onChange={(event) => event.target.value && onSelect(event.target.value)}>
        <option value="" disabled>
          GPU를 선택해 주세요
        </option>
        {gpus.map((gpu) => (
          <option key={gpu.id} value={gpu.id}>
            {gpu.name}
          </option>
        ))}
      </DarkSelect>
    </div>
  );
}
