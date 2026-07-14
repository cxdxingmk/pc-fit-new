import MyPcClient from "./MyPcClient";
import Container from "@/components/layout/Container";

export const metadata = {
  title: "내 PC 성능",
};

export default function Page() {
  return (
    <main className="py-12">
      <Container>
        <h1 className="mb-2 text-2xl font-bold text-white">내 PC 성능 보기</h1>
        <p className="mb-6 text-sm text-white/60">보유 중인 부품을 선택하면 게임·작업·AI 성능을 직관적으로 확인할 수 있습니다.</p>
        <MyPcClient />
      </Container>
    </main>
  );
}
