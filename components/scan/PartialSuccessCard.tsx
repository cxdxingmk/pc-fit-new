export interface ScanFieldStatus {
  label: string;
  detected: boolean;
  value?: string;
}

/** "자동으로 찾았어요 / 이것만 확인해 주세요" 부분 성공 카드 — 감지 실패 항목만 눈에 띄게 분리한다. */
export default function PartialSuccessCard({
  fields,
  onFixMissing,
}: {
  fields: ScanFieldStatus[];
  onFixMissing?: () => void;
}) {
  const found = fields.filter((f) => f.detected);
  const missing = fields.filter((f) => !f.detected);

  if (fields.length === 0) return null;

  return (
    <div className="rounded-2xl bg-surface p-5 ring-1 ring-line">
      {found.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-good">✓ 자동으로 찾았어요</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {found.map((f) => (
              <li key={f.label} className="rounded-full bg-good/10 px-3 py-1 text-xs font-medium text-good ring-1 ring-good/20">
                {f.label}
                {f.value ? `: ${f.value}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {missing.length > 0 && (
        <div className={found.length > 0 ? "mt-4" : ""}>
          <p className="text-xs font-semibold text-warn">! 이것만 확인해 주세요</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((f) => (
              <li key={f.label} className="rounded-full bg-warn/10 px-3 py-1 text-xs font-medium text-warn ring-1 ring-warn/20">
                {f.label}
              </li>
            ))}
          </ul>
          {onFixMissing && (
            <button
              type="button"
              onClick={onFixMissing}
              className="mt-3 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              지금 확인하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
