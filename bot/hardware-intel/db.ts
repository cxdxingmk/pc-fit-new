import { DatabaseSync } from "node:sqlite";
import { Logger } from "./logger.ts";
import type {
  ArticleRow,
  ClassifiedArticle,
  HardwareCategory,
  NewProposalInput,
  PartAliasRow,
  PartMasterRow,
  PartStatus,
  ProposalRow,
  ProposalStatus,
} from "./types.ts";
import { nowIso } from "./util.ts";

export class HardwareIntelRepository {
  private db: DatabaseSync | null = null;
  private readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    const db = new DatabaseSync(this.dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(`
      CREATE TABLE IF NOT EXISTS articles (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        url_hash           TEXT NOT NULL UNIQUE,
        title              TEXT NOT NULL,
        link               TEXT NOT NULL,
        summary            TEXT NOT NULL,
        category           TEXT NOT NULL,
        perf_gain_percent  REAL,
        detected_part_name TEXT,
        detected_status    TEXT,
        source_name        TEXT NOT NULL,
        published_at       TEXT NOT NULL,
        collected_at       TEXT NOT NULL,
        briefed            INTEGER NOT NULL DEFAULT 0
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS parts_master (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        part_name             TEXT NOT NULL UNIQUE,
        category              TEXT NOT NULL,
        status                TEXT NOT NULL DEFAULT 'ANNOUNCED',
        cumulative_perf_gain  REAL NOT NULL DEFAULT 0,
        first_seen_at         TEXT NOT NULL,
        last_updated_at       TEXT NOT NULL,
        related_article_count INTEGER NOT NULL DEFAULT 0
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS proposals (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        kind               TEXT NOT NULL,
        category           TEXT NOT NULL,
        target_catalog_id  TEXT,
        detected_name      TEXT NOT NULL,
        match_confidence   REAL,
        payload_before     TEXT,
        payload_after      TEXT NOT NULL,
        source_article_ids TEXT NOT NULL,
        status             TEXT NOT NULL DEFAULT 'pending',
        created_at         TEXT NOT NULL,
        decided_at         TEXT,
        decided_by         TEXT,
        applied_at         TEXT,
        reject_reason      TEXT
      );
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS part_aliases (
        id                       INTEGER PRIMARY KEY AUTOINCREMENT,
        detected_name_normalized TEXT NOT NULL,
        category                 TEXT NOT NULL,
        catalog_id               TEXT NOT NULL,
        confirmed_count          INTEGER NOT NULL DEFAULT 1,
        created_at               TEXT NOT NULL,
        last_used_at             TEXT NOT NULL,
        UNIQUE(detected_name_normalized, category)
      );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_collected ON articles(collected_at);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_briefed ON articles(briefed);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_parts_status ON parts_master(status);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);`);
    this.db = db;
    Logger.info(`SQLite 초기화 완료 (${this.dbPath})`);
  }

  private requireDb(): DatabaseSync {
    if (!this.db) throw new Error("데이터베이스가 초기화되지 않았습니다.");
    return this.db;
  }

  async insertArticleIfNew(article: ClassifiedArticle): Promise<boolean> {
    const db = this.requireDb();
    const result = db
      .prepare(
        `INSERT OR IGNORE INTO articles
         (url_hash, title, link, summary, category, perf_gain_percent,
          detected_part_name, detected_status, source_name, published_at, collected_at, briefed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        article.urlHash,
        article.title,
        article.link,
        article.summary,
        article.category,
        article.perfGainPercent,
        article.detectedPartName,
        article.detectedStatus,
        article.sourceName,
        article.publishedAt,
        article.collectedAt,
      );
    return Number(result.changes) > 0;
  }

  async getUnbriefedArticles(): Promise<ArticleRow[]> {
    const db = this.requireDb();
    return db
      .prepare(`SELECT * FROM articles WHERE briefed = 0 ORDER BY category ASC, collected_at DESC`)
      .all() as unknown as ArticleRow[];
  }

  async getArticlesSince(sinceIso: string): Promise<ArticleRow[]> {
    const db = this.requireDb();
    return db
      .prepare(`SELECT * FROM articles WHERE collected_at >= ? ORDER BY category ASC, collected_at DESC`)
      .all(sinceIso) as unknown as ArticleRow[];
  }

  async markArticlesBriefed(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = this.requireDb();
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`UPDATE articles SET briefed = 1 WHERE id IN (${placeholders})`).run(...ids);
  }

  async getPartByName(partName: string): Promise<PartMasterRow | undefined> {
    const db = this.requireDb();
    return db.prepare(`SELECT * FROM parts_master WHERE part_name = ?`).get(partName) as
      | PartMasterRow
      | undefined;
  }

  async upsertPart(
    partName: string,
    category: HardwareCategory,
    status: PartStatus,
    perfGainDelta: number,
  ): Promise<{ inserted: boolean; upgraded: boolean; perfUpdated: boolean }> {
    const db = this.requireDb();
    const existing = await this.getPartByName(partName);
    const now = nowIso();

    if (!existing) {
      db.prepare(
        `INSERT INTO parts_master
         (part_name, category, status, cumulative_perf_gain, first_seen_at, last_updated_at, related_article_count)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      ).run(partName, category, status, perfGainDelta, now, now);
      return { inserted: true, upgraded: false, perfUpdated: perfGainDelta > 0 };
    }

    const shouldUpgrade = existing.status === "ANNOUNCED" && status === "RELEASED";
    const newStatus = shouldUpgrade ? "RELEASED" : existing.status;
    const newPerf = existing.cumulative_perf_gain + perfGainDelta;

    db.prepare(
      `UPDATE parts_master
       SET status = ?, cumulative_perf_gain = ?, last_updated_at = ?,
           related_article_count = related_article_count + 1
       WHERE part_name = ?`,
    ).run(newStatus, newPerf, now, partName);
    return { inserted: false, upgraded: shouldUpgrade, perfUpdated: perfGainDelta > 0 };
  }

  async getWeeklyPartCandidates(sinceIso: string): Promise<ArticleRow[]> {
    const db = this.requireDb();
    return db
      .prepare(
        `SELECT * FROM articles
         WHERE collected_at >= ? AND detected_part_name IS NOT NULL
         ORDER BY collected_at ASC`,
      )
      .all(sinceIso) as unknown as ArticleRow[];
  }

  async optimize(): Promise<{ vacuumOk: boolean; analyzeOk: boolean }> {
    const db = this.requireDb();
    let vacuumOk = false;
    let analyzeOk = false;
    try {
      db.exec("VACUUM;");
      vacuumOk = true;
    } catch (err) {
      Logger.error("VACUUM 실패", err);
    }
    try {
      db.exec("ANALYZE;");
      analyzeOk = true;
    } catch (err) {
      Logger.error("ANALYZE 실패", err);
    }
    return { vacuumOk, analyzeOk };
  }

  // ── 카탈로그 제안(승인 워크플로우) ──────────────────────────────────────

  async insertProposal(input: NewProposalInput): Promise<number> {
    const db = this.requireDb();
    const now = nowIso();
    const result = db
      .prepare(
        `INSERT INTO proposals
         (kind, category, target_catalog_id, detected_name, match_confidence,
          payload_before, payload_after, source_article_ids, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(
        input.kind,
        input.category,
        input.targetCatalogId,
        input.detectedName,
        input.matchConfidence,
        input.payloadBefore ? JSON.stringify(input.payloadBefore) : null,
        JSON.stringify(input.payloadAfter),
        JSON.stringify(input.sourceArticleIds),
        now,
      );
    return Number(result.lastInsertRowid);
  }

  async getPendingProposals(): Promise<ProposalRow[]> {
    const db = this.requireDb();
    return db
      .prepare(`SELECT * FROM proposals WHERE status = 'pending' ORDER BY created_at ASC`)
      .all() as unknown as ProposalRow[];
  }

  async getProposalById(id: number): Promise<ProposalRow | undefined> {
    const db = this.requireDb();
    return db.prepare(`SELECT * FROM proposals WHERE id = ?`).get(id) as ProposalRow | undefined;
  }

  async countPendingProposals(): Promise<number> {
    const db = this.requireDb();
    const row = db.prepare(`SELECT COUNT(*) AS n FROM proposals WHERE status = 'pending'`).get() as { n: number };
    return row.n;
  }

  /** 승인됐지만 아직 카탈로그에 반영되지 않은(applied 전환 전) 제안들 — !export-approved 대상. */
  async getApprovedProposals(): Promise<ProposalRow[]> {
    const db = this.requireDb();
    return db
      .prepare(`SELECT * FROM proposals WHERE status = 'approved' ORDER BY decided_at ASC`)
      .all() as unknown as ProposalRow[];
  }

  /** 승인/거절 판정만 기록 — 봇은 웹앱 소스에 접근할 수 없어(별도 서버 배포 가능) 실제 카탈로그
   *  반영은 하지 않는다. !export-approved로 내보내 로컬 저장소의 scripts/applyProposals.ts가
   *  적용한 뒤 !mark-applied로 이 테이블을 닫는다. */
  async decideProposal(id: number, status: Extract<ProposalStatus, "approved" | "rejected">, decidedBy: string, rejectReason?: string): Promise<void> {
    const db = this.requireDb();
    db.prepare(
      `UPDATE proposals SET status = ?, decided_at = ?, decided_by = ?, reject_reason = ? WHERE id = ?`,
    ).run(status, nowIso(), decidedBy, rejectReason ?? null, id);
  }

  async markProposalApplied(id: number): Promise<void> {
    const db = this.requireDb();
    db.prepare(`UPDATE proposals SET status = 'applied', applied_at = ? WHERE id = ?`).run(nowIso(), id);
  }

  async markProposalFailed(id: number, reason: string): Promise<void> {
    const db = this.requireDb();
    db.prepare(`UPDATE proposals SET status = 'failed', reject_reason = ? WHERE id = ?`).run(reason, id);
  }

  // ── 부품명 별칭(학습된 매칭) ────────────────────────────────────────────

  async getAlias(detectedNameNormalized: string, category: string): Promise<PartAliasRow | undefined> {
    const db = this.requireDb();
    return db
      .prepare(`SELECT * FROM part_aliases WHERE detected_name_normalized = ? AND category = ?`)
      .get(detectedNameNormalized, category) as PartAliasRow | undefined;
  }

  /** 사람이 확정한 매칭을 누적 기록 — 동일 (표기, 카테고리) 재등장 시 confirmed_count만 증가. */
  async upsertAlias(detectedNameNormalized: string, category: string, catalogId: string): Promise<void> {
    const db = this.requireDb();
    const now = nowIso();
    db.prepare(
      `INSERT INTO part_aliases (detected_name_normalized, category, catalog_id, confirmed_count, created_at, last_used_at)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(detected_name_normalized, category) DO UPDATE SET
         catalog_id = excluded.catalog_id,
         confirmed_count = confirmed_count + 1,
         last_used_at = excluded.last_used_at`,
    ).run(detectedNameNormalized, category, catalogId, now, now);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      Logger.info("SQLite 커넥션 종료 완료");
    }
  }
}
