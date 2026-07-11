import type { CompatibilitySeverity, CompatibilityWarning } from "../../lib/compatibility";

type Props = {
  score: number;
  warnings: CompatibilityWarning[];
};

const SEVERITY_ORDER: CompatibilitySeverity[] = ["critical", "warn", "info"];

const SEVERITY_STYLE: Record<CompatibilitySeverity, { label: string; icon: string; className: string }> = {
  critical: { label: "치명적", icon: "⛔", className: "bg-bad/10 text-bad ring-1 ring-bad/25" },
  warn: { label: "주의", icon: "⚠️", className: "bg-warn/10 text-warn ring-1 ring-warn/25" },
  info: { label: "정보", icon: "ℹ️", className: "bg-white/[0.03] text-white/50 ring-1 ring-line" },
};

export default function CompatibilityCard({ score, warnings }: Props) {
  const tone = score > 90 ? "good" : score > 70 ? "warn" : "bad";
  const dotClass = tone === "good" ? "bg-good" : tone === "warn" ? "bg-warn" : "bg-bad";

  // 치명적 -> 주의 -> 정보 순으로 먼저 보이게 정렬 — 그리드 안에서도 심각한 문제가 먼저 눈에 띄게 한다.
  const sortedWarnings = [...warnings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <div className="rounded-2xl bg-white/[0.03] p-6 text-white ring-1 ring-line">
      <h2 className="mb-4 text-lg font-bold">🔗 부품 호환성</h2>

      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${dotClass}`}>
          {Math.round(score)}
        </div>
        <div className="w-full">
          <div className="text-sm text-white/40">호환성 점수</div>
          <div className="mt-2 h-3 rounded-full bg-white/[0.06]">
            <div className={`h-3 rounded-full ${dotClass}`} style={{ width: `${Math.min(score, 100)}%` }} />
          </div>
          <div className="mt-2 text-sm text-white/40">
            {score > 90 ? "우수한 호환성" : score > 70 ? "전반적으로 안정적" : "일부 호환성 확인 필요"}
          </div>
        </div>
      </div>

      {sortedWarnings.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sortedWarnings.map((warning, index) => {
            const style = SEVERITY_STYLE[warning.severity];
            return (
              <div key={index} className={`rounded-xl px-3 py-2.5 text-sm leading-snug ${style.className}`}>
                <span className="mr-1.5 whitespace-nowrap text-xs font-bold">
                  {style.icon} {style.label}
                </span>
                <span>{warning.message}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-xl bg-good/10 p-3 text-sm text-good ring-1 ring-good/25">모든 부품이 호환됩니다.</div>
      )}
    </div>
  );
}
