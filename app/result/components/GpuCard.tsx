import type { GPU } from "../../database/gpu";

type Props = {
  gpuTop: GPU[];
};

export default function GpuCard({ gpuTop }: Props) {
  const best = gpuTop[0];
  const others = gpuTop.slice(1);

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-md">
      <h2 className="mb-4 text-lg font-semibold text-gray-600">🎮 GPU 추천 TOP 3</h2>

      <div className="mb-4 flex items-start gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-2xl font-bold">{best.name}</h3>
            <span className="rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold text-white">BEST</span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="font-medium">게임 성능</p>
              <div className="h-3 rounded bg-gray-200">
                <div className="h-3 rounded bg-green-500" style={{ width: `${best.gameScore}%` }} />
              </div>
            </div>

            <div>
              <p className="font-medium">AI 성능</p>
              <div className="h-3 rounded bg-gray-200">
                <div className="h-3 rounded bg-purple-500" style={{ width: `${best.aiScore}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2 text-gray-700">
            <p>브랜드 : {best.brand}</p>
            <p>VRAM : {best.vram}GB</p>
            <p>Ray Tracing : {best.rayTracing ? "지원" : "미지원"}</p>
            <p>DLSS : {best.dlss ? "지원" : "미지원"}</p>
            <p>FSR : {best.fsr ? "지원" : "미지원"}</p>
          </div>
        </div>

        <div className="w-48 space-y-3">
          {others.map((g, i) => (
            <div key={g.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-gray-500">#{i + 2}</div>
              </div>
              <div className="mt-2 text-xs text-gray-600">
                <div>G:{g.gameScore} / AI:{g.aiScore}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}