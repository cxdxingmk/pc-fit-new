import type { HardwareIntelRepository } from "../db.ts";
import type { CatalogCategory } from "../types.ts";

export interface ProposalExportItem {
  id: number;
  category: CatalogCategory;
  targetCatalogId: string;
  detectedName: string;
  /** app/database/*.ts 해당 객체에 그대로 대입할 숫자 필드들(예: gameScore). */
  fieldUpdates: Record<string, number>;
  approvedAt: string;
  approvedBy: string;
  sourceArticleIds: number[];
}

/**
 * 승인됐지만(status='approved') 아직 카탈로그에 반영되지 않은 SPEC_UPDATE 제안만 골라
 * 로컬 pc-fit-new 저장소의 scripts/applyProposals.ts가 바로 소비할 수 있는 형태로 내보낸다.
 *
 * NEW_PART/STATUS_CHANGE는 RSS만으로 카탈로그가 요구하는 전체 스펙을 채울 수 없어 애초에
 * 내보내기 대상이 아니다 — 승인해도 사람이 수동으로 app/database/*.ts에 추가해야 한다(제안
 * 상세의 note/possibleDuplicates를 참고).
 */
export async function exportApprovedProposals(repo: HardwareIntelRepository): Promise<ProposalExportItem[]> {
  const approved = await repo.getApprovedProposals();
  const items: ProposalExportItem[] = [];

  for (const p of approved) {
    if (p.kind !== "SPEC_UPDATE" || !p.target_catalog_id) continue;

    let after: Record<string, unknown>;
    try {
      after = JSON.parse(p.payload_after) as Record<string, unknown>;
    } catch {
      continue;
    }
    const fieldUpdates: Record<string, number> = {};
    for (const [field, value] of Object.entries(after)) {
      if (typeof value === "number") fieldUpdates[field] = value;
    }
    if (Object.keys(fieldUpdates).length === 0) continue;

    let sourceArticleIds: number[] = [];
    try {
      sourceArticleIds = JSON.parse(p.source_article_ids) as number[];
    } catch {
      // 근거 기사 id 파싱 실패해도 나머지 필드는 유효하니 내보내기는 계속 진행
    }

    items.push({
      id: p.id,
      category: p.category as CatalogCategory,
      targetCatalogId: p.target_catalog_id,
      detectedName: p.detected_name,
      fieldUpdates,
      approvedAt: p.decided_at ?? "",
      approvedBy: p.decided_by ?? "",
      sourceArticleIds,
    });
  }

  return items;
}
