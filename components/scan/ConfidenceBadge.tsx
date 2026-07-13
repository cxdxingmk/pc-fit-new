/** 카테고리별 자동감지 신뢰도 배지 — 확정형(초록)/추가 확인 필요(노랑) 2종. */
export default function ConfidenceBadge({ confident }: { confident: boolean }) {
  if (confident) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-good/10 px-2.5 py-1 text-xs font-semibold text-good ring-1 ring-good/25">
        <span aria-hidden="true">✓</span>
        자동으로 잘 맞아요
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warn/10 px-2.5 py-1 text-xs font-semibold text-warn ring-1 ring-warn/25">
      <span aria-hidden="true">!</span>
      추가 확인이 필요해요
    </span>
  );
}
