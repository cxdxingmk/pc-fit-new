import type { SSD } from "../../database/ssd";

type Props = {
  ssdTop: SSD[];
};

export default function SsdCard({ ssdTop }: Props) {
  const best = ssdTop[0];
  const others = ssdTop.slice(1);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-md">
      <h2 className="mb-4 text-lg font-semibold text-gray-600">💾 SSD 추천 TOP 3</h2>

      <div className="mb-4 flex items-start gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-2xl font-bold">{best.name}</h3>
            <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold text-white">BEST</span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium">읽기 속도</p>
              <div className="h-3 rounded bg-gray-200">
                <div className="h-3 rounded bg-blue-500" style={{ width: `${Math.min(best.readSpeed / 75, 100)}%` }} />
              </div>
              <p className="mt-1 text-sm text-gray-600">{best.readSpeed.toLocaleString()} MB/s</p>
            </div>

            <div>
              <p className="font-medium">쓰기 속도</p>
              <div className="h-3 rounded bg-gray-200">
                <div className="h-3 rounded bg-green-500" style={{ width: `${Math.min(best.writeSpeed / 75, 100)}%` }} />
              </div>
              <p className="mt-1 text-sm text-gray-600">{best.writeSpeed.toLocaleString()} MB/s</p>
            </div>
          </div>

          <div className="mt-6 space-y-2 text-gray-700">
            <p>브랜드 : {best.brand}</p>
            <p>용량 : {best.capacity}GB</p>
            <p>인터페이스 : {best.interface}</p>
            <p>DRAM : {best.dram ? "탑재" : "미탑재"}</p>
            <p>NAND : {best.nand}</p>
          </div>
        </div>

        <div className="w-48 space-y-3">
          {others.map((s, i) => (
            <div key={s.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-gray-500">#{i + 2}</div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <div>R:{s.readSpeed} / W:{s.writeSpeed}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}