/** "우리는 부품을 팔지 않는다"는 차별화 서사를 실제 화면에 노출하는 절제된 고지 카드. */
export default function IndependenceNotice({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/[0.03] px-5 py-4 text-center ring-1 ring-line ${className ?? ""}`}>
      <p className="text-xs leading-relaxed text-white/50">
        PC FIT은 부품을 직접 판매하지 않습니다. 추천과 진단은 판매 수익과 무관하게 데이터 기준으로만 계산됩니다.
      </p>
    </div>
  );
}
