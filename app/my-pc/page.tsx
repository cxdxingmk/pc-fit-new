import MyPcClient from "./MyPcClient";

export const metadata = {
  title: "내 PC 성능",
};

export default function Page() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">내 PC 성능 보기</h1>
      <p className="text-sm text-gray-600 mb-6">보유 중인 부품을 선택하면 게임·작업·AI 성능을 직관적으로 확인할 수 있습니다.</p>
      <MyPcClient />
    </main>
  );
}
