/** 가격 출처/신뢰도 안내 — IndependenceNotice와 같은 스타일의 절제된 고지 카드. */
export default function PriceSourceNotice({ className }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-white/[0.03] px-5 py-4 text-center ring-1 ring-line ${className ?? ""}`}>
      <p className="text-xs leading-relaxed text-white/50">
        가격은 네이버 쇼핑 검색 결과를 참고해 산출한 평균값이에요. 최근 갱신 기준 당일~2일 이내 시세지만 실제 판매가와 다를 수 있으니,
        정확한 금액은 구매 전 판매처에서 다시 확인해 주세요.
      </p>
    </div>
  );
}
