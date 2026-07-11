import type { HardwareIntelRepository } from "../db.ts";
import { Logger } from "../logger.ts";
import type { ArticleRow, CatalogCategory, HardwareCategory, NewProposalInput, WeeklySyncResult } from "../types.ts";
import { getCatalog } from "./catalogReader.ts";
import { matchPartName, normalizePartName } from "./matcher.ts";

/** 기사 category(HardwareCategory) -> 카탈로그 카테고리 직접 매핑. */
const DIRECT_CATEGORY_MAP: Partial<Record<HardwareCategory, CatalogCategory>> = {
  GPU: "GPU",
  CPU: "CPU",
  RAM: "RAM",
  SSD: "SSD",
  MAINBOARD: "MOTHERBOARD",
};

/** article.category가 GPU/CPU로 직접 분류되지 않아도(예: "FSR 4" 키워드 때문에
 *  GAME_OPTIMIZATION으로 먼저 분류된 기사) detected_part_name 자체의 형태로 카테고리를 추정한다. */
function inferCatalogCategory(article: ArticleRow): CatalogCategory | null {
  const direct = DIRECT_CATEGORY_MAP[article.category as HardwareCategory];
  if (direct) return direct;

  const name = article.detected_part_name;
  if (!name) return null;
  if (/^(RTX|RX|ARC)\b/i.test(name)) return "GPU";
  if (/^(RYZEN|CORE|THREADRIPPER|EPYC)\b/i.test(name)) return "CPU";
  return null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** perf_gain_percent를 gameScore/workScore/aiScore 세 필드에 동일 비율로 적용한 "제안값".
 *  RSS에는 어떤 용도(게임/작업/AI)의 향상인지 구분할 신호가 없어 균등 적용 후 사람이 승인 시
 *  직접 조정하도록 명시적으로 근사치임을 표시한다. */
function suggestScoreUpdate(raw: Record<string, unknown>, perfGainPercent: number) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const field of ["gameScore", "workScore", "aiScore"] as const) {
    const current = raw[field];
    if (typeof current === "number") {
      before[field] = current;
      after[field] = Math.round(current * (1 + perfGainPercent / 100));
    }
  }
  return { before, after };
}

interface ArticleGroup {
  category: CatalogCategory;
  detectedName: string;
  articleIds: number[];
  maxPerfGain: number | null;
}

function groupCandidates(articles: ArticleRow[]): ArticleGroup[] {
  const groups = new Map<string, ArticleGroup>();
  for (const article of articles) {
    if (!article.detected_part_name) continue;
    const category = inferCatalogCategory(article);
    if (!category) continue;

    const key = `${category}::${normalizePartName(article.detected_part_name)}`;
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        category,
        detectedName: article.detected_part_name,
        articleIds: [article.id],
        maxPerfGain: article.perf_gain_percent,
      });
      continue;
    }
    existing.articleIds.push(article.id);
    // 그룹 내에서 더 긴(더 완전해 보이는, 예: "TI"/"SUPER" 접미사 포함) 표기를 대표값으로 채택
    if (article.detected_part_name.length > existing.detectedName.length) {
      existing.detectedName = article.detected_part_name;
    }
    if (article.perf_gain_percent !== null) {
      existing.maxPerfGain =
        existing.maxPerfGain === null ? article.perf_gain_percent : Math.max(existing.maxPerfGain, article.perf_gain_percent);
    }
  }
  return [...groups.values()];
}

export interface ProposalGenerationResult {
  scannedGroups: number;
  created: number;
  skippedAlreadyPending: number;
  skippedNoNewSignal: number;
  byKind: Record<"NEW_PART" | "STATUS_CHANGE" | "SPEC_UPDATE", number>;
}

/**
 * articles(주간 신규분) + runWeeklySync가 이미 계산한 parts_master 상태 전환 정보(sync)를 받아
 * proposals 테이블에 pending 제안을 적재한다. 실제 카탈로그(app/database/*.ts)는 절대 건드리지
 * 않음 — 오직 사람이 Discord/Telegram으로 승인해야 반영되는 큐만 채운다.
 */
export class ProposalGenerator {
  private readonly repo: HardwareIntelRepository;
  private readonly maxProposalsPerRun: number;

  constructor(repo: HardwareIntelRepository, maxProposalsPerRun = 20) {
    this.repo = repo;
    this.maxProposalsPerRun = maxProposalsPerRun;
  }

  async generate(candidateArticles: ArticleRow[], sync: WeeklySyncResult): Promise<ProposalGenerationResult> {
    const result: ProposalGenerationResult = {
      scannedGroups: 0,
      created: 0,
      skippedAlreadyPending: 0,
      skippedNoNewSignal: 0,
      byKind: { NEW_PART: 0, STATUS_CHANGE: 0, SPEC_UPDATE: 0 },
    };

    const groups = groupCandidates(candidateArticles);
    result.scannedGroups = groups.length;
    if (groups.length === 0) return result;

    const catalog = getCatalog();
    const pending = await this.repo.getPendingProposals();
    const pendingKeys = new Set(pending.map((p) => `${p.category}::${normalizePartName(p.detected_name)}`));

    const inputs: NewProposalInput[] = [];

    for (const group of groups) {
      const key = `${group.category}::${normalizePartName(group.detectedName)}`;
      if (pendingKeys.has(key)) {
        result.skippedAlreadyPending++;
        continue;
      }

      const match = matchPartName(group.detectedName, catalog[group.category]);

      if (match.status === "exact") {
        if (group.maxPerfGain === null) {
          result.skippedNoNewSignal++;
          continue;
        }
        const matched = match.candidates[0];
        const suggestion = suggestScoreUpdate(
          catalog[group.category].find((e) => e.id === matched.catalogId)!.raw,
          group.maxPerfGain,
        );
        if (Object.keys(suggestion.after).length === 0) {
          result.skippedNoNewSignal++;
          continue;
        }
        inputs.push({
          kind: "SPEC_UPDATE",
          category: group.category,
          targetCatalogId: matched.catalogId,
          detectedName: group.detectedName,
          matchConfidence: 1,
          payloadBefore: suggestion.before,
          payloadAfter: suggestion.after,
          sourceArticleIds: group.articleIds,
        });
        continue;
      }

      // 카탈로그에 아직 없는 이름(ambiguous/no_match) — parts_master의 ANNOUNCED->RELEASED
      // 전환 여부(sync)로 STATUS_CHANGE/NEW_PART 여부만 가르고, 전환 신호가 없으면 스킵한다
      // (매주 같은 "아직 미출시" 뉴스에 중복 제안을 쌓지 않기 위함).
      const canonicalName = group.detectedName;
      const isUpgrade = sync.upgradedParts.includes(canonicalName);
      const isNew = sync.newParts.includes(canonicalName);
      if (!isUpgrade && !isNew) {
        result.skippedNoNewSignal++;
        continue;
      }
      if (isNew && !isUpgrade) {
        const partRow = await this.repo.getPartByName(canonicalName);
        if (partRow?.status !== "RELEASED") {
          result.skippedNoNewSignal++;
          continue;
        }
      }

      const kind = isUpgrade ? "STATUS_CHANGE" : "NEW_PART";
      inputs.push({
        kind,
        category: group.category,
        targetCatalogId: null,
        detectedName: group.detectedName,
        matchConfidence: null,
        payloadBefore: null,
        payloadAfter: {
          detectedName: group.detectedName,
          category: group.category,
          suggestedId: slugify(group.detectedName),
          possibleDuplicates: match.candidates.map((c) => ({ id: c.catalogId, name: c.catalogName, similarity: c.similarity })),
          note:
            "RSS 소스에는 상세 스펙(코어/클럭/점수 등)이 없어 자동 산출이 불가합니다 — 승인 후 카탈로그 반영 시 필수 필드를 수동으로 채워야 합니다.",
        },
        sourceArticleIds: group.articleIds,
      });
    }

    // 안전장치: 한 번에 너무 많은 제안이 쌓여 승인 피로로 무시되지 않도록 상한을 둔다.
    // SPEC_UPDATE(기존 카탈로그 항목 갱신, 가장 안전/확실)를 우선하고 NEW_PART/STATUS_CHANGE는 그 다음.
    const prioritized = inputs
      .slice()
      .sort((a, b) => (a.kind === "SPEC_UPDATE" ? -1 : 0) - (b.kind === "SPEC_UPDATE" ? -1 : 0));
    const toCreate = prioritized.slice(0, this.maxProposalsPerRun);

    for (const input of toCreate) {
      await this.repo.insertProposal(input);
      result.created++;
      result.byKind[input.kind]++;
    }

    if (inputs.length > toCreate.length) {
      Logger.warn(
        `제안 상한(${this.maxProposalsPerRun}) 초과로 ${inputs.length - toCreate.length}건은 이번 주 생성하지 않음(다음 주 재평가됨)`,
      );
    }

    return result;
  }
}
