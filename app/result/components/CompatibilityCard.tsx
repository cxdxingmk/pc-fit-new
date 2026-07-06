type Props = {
  score: number;
  warnings: string[];
};

export default function CompatibilityCard({ score, warnings }: Props) {
  const color = score > 90 ? "bg-green-500" : score > 70 ? "bg-yellow-400" : "bg-red-500";

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-slate-100 shadow-md">
      <h2 className="mb-4 text-2xl font-bold">🔗 부품 호환성</h2>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm text-slate-400">호환성 점수</div>
          <div className="mt-2 flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full text-center text-white flex items-center justify-center ${color} text-lg font-semibold`}>
              {Math.round(score)}
            </div>
            <div className="w-full">
              <div className="h-3 rounded bg-slate-700">
                <div className={`${color} h-3 rounded`} style={{ width: `${Math.min(score, 100)}%` }} />
              </div>
              <div className="mt-2 text-sm text-slate-400">
                {score > 90
                  ? "우수한 호환성"
                  : score > 70
                  ? "전반적으로 안정적"
                  : "일부 호환성 확인 필요"}
              </div>
            </div>
          </div>
        </div>

        <div className="w-1/3">
          {warnings.length > 0 ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              <div className="font-semibold">경고</div>
              <ul className="mt-2 list-disc pl-4">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">
              모든 부품이 호환됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
