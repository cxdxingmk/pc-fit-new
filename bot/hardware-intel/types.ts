export type HardwareCategory =
  | "CPU"
  | "GPU"
  | "RAM"
  | "SSD"
  | "MAINBOARD"
  | "DRIVER_UPDATE"
  | "BIOS_FIRMWARE"
  | "GAME_OPTIMIZATION"
  | "POWER_THERMAL"
  | "ISSUE_REPORT"
  | "GENERAL";

export type PartStatus = "ANNOUNCED" | "RELEASED";

export interface FeedSource {
  readonly name: string;
  readonly url: string;
}

export interface RawFeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  sourceName: string;
}

export interface ClassifiedArticle {
  urlHash: string;
  title: string;
  link: string;
  summary: string;
  category: HardwareCategory;
  perfGainPercent: number | null;
  detectedPartName: string | null;
  detectedStatus: PartStatus | null;
  sourceName: string;
  publishedAt: string;
  collectedAt: string;
}

export interface ArticleRow {
  id: number;
  url_hash: string;
  title: string;
  link: string;
  summary: string;
  category: string;
  perf_gain_percent: number | null;
  detected_part_name: string | null;
  detected_status: string | null;
  source_name: string;
  published_at: string;
  collected_at: string;
  briefed: number;
}

export interface PartMasterRow {
  id: number;
  part_name: string;
  category: string;
  status: string;
  cumulative_perf_gain: number;
  first_seen_at: string;
  last_updated_at: string;
  related_article_count: number;
}

export interface IngestionResult {
  fetchedFeeds: number;
  failedFeeds: number;
  newArticles: number;
  duplicates: number;
  perfDataPoints: number;
  byCategory: Record<string, number>;
  startedAt: Date;
  finishedAt: Date;
}

export interface WeeklySyncResult {
  upgradedParts: string[];
  newParts: string[];
  perfUpdatedParts: string[];
  vacuumOk: boolean;
  analyzeOk: boolean;
}

export interface ClassificationRule {
  category: HardwareCategory;
  priority: number;
  patterns: RegExp[];
}

// ─────────────────────────────────────────────────────────────────────────
// 카탈로그 제안(승인 워크플로우) — app/database/*.ts 반영 후보를 표현한다.
// ─────────────────────────────────────────────────────────────────────────

/** app/database/*.ts 중 제안 대상이 되는 카탈로그. RAM/SSD/메인보드/PSU는 평면 배열,
 *  CPU/GPU는 curated 배열만 대상(자동 생성 tail은 건드리지 않는다). */
export type CatalogCategory = "CPU" | "GPU" | "RAM" | "SSD" | "MOTHERBOARD" | "PSU";

export type ProposalKind = "NEW_PART" | "STATUS_CHANGE" | "SPEC_UPDATE";

export type ProposalStatus = "pending" | "approved" | "rejected" | "applied" | "failed";

export interface NewProposalInput {
  kind: ProposalKind;
  category: CatalogCategory;
  /** 매칭된 기존 카탈로그 항목 id. NEW_PART면 null. */
  targetCatalogId: string | null;
  /** 기사 원문에서 추출된 표기 그대로("RTX 4070" 등). */
  detectedName: string;
  /** matcher.ts가 산출한 매칭 신뢰도(0~1). 정확 매칭이면 1, 완전 신규면 null. */
  matchConfidence: number | null;
  /** STATUS_CHANGE/SPEC_UPDATE의 변경 전 값(카탈로그 필드 일부). NEW_PART면 null. */
  payloadBefore: Record<string, unknown> | null;
  /** 반영될 값 — NEW_PART면 카탈로그에 그대로 삽입될 완전한 객체. */
  payloadAfter: Record<string, unknown>;
  /** 근거가 된 articles.id 목록. */
  sourceArticleIds: number[];
}

export interface ProposalRow {
  id: number;
  kind: string;
  category: string;
  target_catalog_id: string | null;
  detected_name: string;
  match_confidence: number | null;
  payload_before: string | null; // JSON 문자열
  payload_after: string; // JSON 문자열
  source_article_ids: string; // JSON 배열 문자열
  status: string;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  applied_at: string | null;
  reject_reason: string | null;
}

/** 사람이 한 번 확정한 "이 표기 = 이 카탈로그 id" 매칭을 누적 저장 — 다음에 같은 표기가
 *  나오면 matcher.ts가 재추론 없이 즉시 재사용한다(자기개선). */
export interface PartAliasRow {
  id: number;
  detected_name_normalized: string;
  category: string;
  catalog_id: string;
  confirmed_count: number;
  created_at: string;
  last_used_at: string;
}
