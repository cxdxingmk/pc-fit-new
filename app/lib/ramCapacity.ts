// pc_specs.ram_capacity(= 폼의 ramCapacity)는 "모듈 1개당" 용량이다("16GB").
// 실제 총 용량은 반드시 ramCount를 곱해야 나온다. 이 규칙이 파서/폼/요약/분석에 흩어져 있어
// 한쪽이 총합을, 다른 쪽이 개당을 가정하며 어긋나던 적이 있어(총량 2배 부풀림) 여기로 모은다.

/** "16GB" → 16 (숫자만 추출) */
export function parseRamCapacityToGb(value: string): number {
  const matched = value.match(/(\d+)/);
  return matched ? Number(matched[1]) : 0;
}

/** 개당 용량 문자열 + 개수 → 총 용량(GB) */
export function totalRamGb(capacityPerModule: string, count: number): number {
  const perModule = parseRamCapacityToGb(capacityPerModule);
  const safeCount = Number.isFinite(count) && count > 0 ? count : 1;
  return perModule * safeCount;
}
