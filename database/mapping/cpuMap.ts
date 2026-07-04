import { cpuBench } from "../benchmarks/cpuBench";

export function getCpuBenchmark(id: string) {
  const found = cpuBench[id];
  if (found) return found;

  // Fallback: return a conservative baseline if not found
  return { game: 60, work: 60, ai: 50 };
}

export function mapCpuToAggregateScore(id: string) {
  const b = getCpuBenchmark(id);
  // Weighted aggregate (default equal weights)
  const aggregate = Math.round((b.game + b.work + b.ai) / 3);
  return { ...b, aggregate };
}
