import { gpuBench } from "../benchmarks/gpuBench";

export function getGpuBenchmark(id: string) {
  const found = gpuBench[id];
  if (found) return found;

  return { game: 60, work: 55, ai: 50 };
}

export function mapGpuToAggregateScore(id: string) {
  const b = getGpuBenchmark(id);
  const aggregate = Math.round((b.game + b.work + b.ai) / 3);
  return { ...b, aggregate };
}
