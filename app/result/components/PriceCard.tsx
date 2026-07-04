type Props = {
  totalPrice: number;
};

export default function PriceCard({ totalPrice }: Props) {
  const priceInManwon = Math.round(totalPrice / 10000);

  return (
    <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-pink-600 p-6 text-white shadow-lg">
      <h2 className="mb-3 text-xl font-semibold">💰 예상 견적</h2>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm opacity-90">예상 총액</div>
          <div className="mt-1 text-3xl font-bold">약 {priceInManwon.toLocaleString()}만원</div>
          <div className="mt-2 text-sm opacity-80">AI 추천 기반의 예측 견적입니다.</div>
        </div>

        <div className="rounded-lg bg-white/20 px-3 py-2 text-sm">견적 저장</div>
      </div>
    </div>
  );
}