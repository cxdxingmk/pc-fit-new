type Props = {
  ram: {
    name: string;
    brand: string;
    capacity: number;
    sticks: number;
    speed: number;
    ddr: string;
    rgb: boolean;
    gameScore: number;
    workScore: number;
    aiScore: number;
  };
};

export default function RamCard({ ram }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-slate-100 shadow-md">
      <h2 className="mb-5 text-2xl font-bold">💾 추천 RAM</h2>

      <h3 className="mb-4 text-xl font-semibold">{ram.name}</h3>

      <div className="space-y-3">

        <div>
          <p className="font-medium">게임 성능</p>
          <div className="h-3 rounded bg-slate-700">
            <div
              className="h-3 rounded bg-green-500"
              style={{ width: `${ram.gameScore}%` }}
            />
          </div>
        </div>

        <div>
          <p className="font-medium">작업 성능</p>
          <div className="h-3 rounded bg-slate-700">
            <div
              className="h-3 rounded bg-blue-500"
              style={{ width: `${ram.workScore}%` }}
            />
          </div>
        </div>

        <div>
          <p className="font-medium">AI 성능</p>
          <div className="h-3 rounded bg-slate-700">
            <div
              className="h-3 rounded bg-purple-500"
              style={{ width: `${ram.aiScore}%` }}
            />
          </div>
        </div>

      </div>

      <div className="mt-6 space-y-2 text-slate-300">
        <p>브랜드 : {ram.brand}</p>
        <p>용량 : {ram.capacity}GB</p>
        <p>구성 : {ram.sticks}개</p>
        <p>클럭 : {ram.speed}MHz</p>
        <p>규격 : {ram.ddr}</p>
        <p>RGB : {ram.rgb ? "지원" : "미지원"}</p>
      </div>
    </div>
  );
}