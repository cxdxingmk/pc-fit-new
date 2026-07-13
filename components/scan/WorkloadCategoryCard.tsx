import ConfidenceBadge from "./ConfidenceBadge";
import { needsCpuConfirmation } from "@/app/lib/fpsDisplay";
import type { BoundBy } from "@/app/lib/workloadProfiles";

export default function WorkloadCategoryCard({
  label,
  boundBy,
  displayValue,
  cpuConfirmed,
  onConfirmCpu,
}: {
  label: string;
  boundBy: BoundBy;
  /** formatFpsDisplay/formatScoreDisplay로 이미 포맷된 문자열 — 이 컴포넌트는 단위(fps/점)를 모른다 */
  displayValue: string;
  cpuConfirmed: boolean;
  onConfirmCpu?: () => void;
}) {
  const needsConfirm = needsCpuConfirmation(boundBy, cpuConfirmed);

  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 text-[15px] font-bold text-white">{label}</h3>
        <ConfidenceBadge confident={!needsConfirm} />
      </div>

      <p className="text-2xl font-extrabold tabular-nums text-white/90">{displayValue}</p>

      {needsConfirm && (
        <div className="mt-auto flex flex-col gap-2 rounded-xl bg-white/[0.03] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/55">CPU 정보를 조금만 더 알려주시면 정확도가 올라가요</p>
          <button
            type="button"
            onClick={onConfirmCpu}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            CPU 확인하기
          </button>
        </div>
      )}
    </div>
  );
}
