import type { RecommendationResult } from "../types/recommend";
import type { SpecSnapshot } from "./specPermalink";

/**
 * /result의 추천 견적(RecommendationResult)을 /my-pc?spec= 퍼머링크 payload로 변환한다.
 * cpu/gpu/ram/ssd/motherboard는 표시용 이름이라 카탈로그 역참조가 불안정하므로 partIds(실제
 * 카탈로그 id)만 사용한다. 모니터 설정은 견적에 없는 정보라 /my-pc 기본값을 그대로 둔다.
 */
export function buildPerformanceSpec(item: Pick<RecommendationResult, "partIds">): SpecSnapshot {
  return {
    c: item.partIds.cpu,
    g: item.partIds.gpu,
    r: item.partIds.ram,
    s: item.partIds.ssd,
    m: item.partIds.motherboard,
    p: `${item.partIds.psuWattage}W`,
    mr: "QHD",
    mh: 144,
  };
}
