import type { CPU } from "../../database/cpu";

type Props = {
  cpuTop: CPU[];
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className="font-medium">{label}</p>
      <div className="h-3 rounded bg-gray-200">
        <div className={`h-3 rounded ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function CpuCard({ cpuTop }: Props) {
  const best = cpuTop[0];
  const others = cpuTop.slice(1);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-md">
      <h2 className="mb-4 text-lg font-semibold text-gray-600">🧠 CPU 추천 TOP 3</h2>

      <div className="mb-4 flex items-start gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-2xl font-bold">{best.name}</h3>
            <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold text-white">BEST</span>
          </div>

          <div className="space-y-3">
            <ScoreBar label="게임 성능" value={best.gameScore} color="bg-green-500" />
            <ScoreBar label="작업 성능" value={best.workScore} color="bg-blue-500" />
            <ScoreBar label="AI 성능" value={best.aiScore} color="bg-purple-500" />
          </div>

          <div className="mt-6 space-y-2 text-gray-700">
            <p>브랜드 : {best.brand}</p>
            <p>코어 : {best.cores}</p>
            <p>스레드 : {best.threads}</p>
            <p>소켓 : {best.socket}</p>
            <p>메모리 : {best.ddr}</p>
            <p>PCIe : {best.pcie}</p>
          </div>
        </div>

        <div className="w-48 space-y-3">
          {others.map((c, i) => (
            <div key={c.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-gray-500">#{i + 2}</div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <div>G:{c.gameScore} / W:{c.workScore} / AI:{c.aiScore}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}