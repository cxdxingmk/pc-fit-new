import fs from "node:fs";
import path from "node:path";
import { Logger } from "../logger.ts";
import type { CatalogCategory } from "../types.ts";

export interface CatalogEntry {
  id: string;
  name: string;
  /** 원본 카탈로그 객체 전체 — SPEC_UPDATE 제안에서 gameScore 등 기존 필드값을 읽을 때 사용. */
  raw: Record<string, unknown>;
}

type CatalogExport = Record<CatalogCategory, CatalogEntry[]>;

interface SnapshotFile {
  generatedAt: string;
  catalog: CatalogExport;
}

const EMPTY_CATALOG: CatalogExport = { CPU: [], GPU: [], RAM: [], SSD: [], MOTHERBOARD: [], PSU: [] };

/**
 * 봇은 웹앱 소스(app/database/*.ts)와 별도 서버에 배포될 수 있다(실제로 지금 그렇다 — 봇
 * 서버에는 웹앱이 없음). 그래서 카탈로그를 직접 읽지 않고, 로컬 개발 환경에서
 * `npx ts-node -P scripts/tsconfig.cjs.json scripts/export-catalog.cts`로 만든 스냅샷 JSON을
 * 이 경로로 수동 복사(scp)해두면 그걸 읽는 방식으로 바꿨다 — 웹앱을 나중에 어디에
 * 배포하든(같은 서버든 Vercel이든) 이 스냅샷 파일 하나만 최신으로 유지하면 되고, 봇이
 * 웹앱과 같은 파일시스템에 있다는 가정이 전혀 필요 없다.
 *
 * 스냅샷이 아직 없으면 빈 카탈로그로 동작한다 — 모든 매칭이 no_match(완전 신규 취급)로
 * 안전하게 fallback될 뿐 크래시하지 않는다.
 */
const SNAPSHOT_PATH = path.resolve(import.meta.dirname, "../data/catalog-snapshot.json");
const STALE_WARNING_DAYS = 14;

let cache: { catalog: CatalogExport; generatedAt: string | null; mtimeMs: number } | null = null;

function loadSnapshot(): { catalog: CatalogExport; generatedAt: string | null } {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    if (!cache) {
      Logger.warn(
        `카탈로그 스냅샷 없음(${SNAPSHOT_PATH}) — 모든 부품명 매칭이 신규(no_match)로 처리됩니다. ` +
          "로컬에서 `npx ts-node -P scripts/tsconfig.cjs.json scripts/export-catalog.cts` 실행 후 이 경로로 복사해주세요.",
      );
    }
    cache = { catalog: EMPTY_CATALOG, generatedAt: null, mtimeMs: -1 };
    return cache;
  }

  const stat = fs.statSync(SNAPSHOT_PATH);
  if (cache && cache.mtimeMs === stat.mtimeMs) {
    return cache;
  }

  const parsed = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, "utf-8")) as SnapshotFile;
  cache = { catalog: parsed.catalog, generatedAt: parsed.generatedAt, mtimeMs: stat.mtimeMs };

  const ageDays = (Date.now() - new Date(parsed.generatedAt).getTime()) / 86_400_000;
  if (ageDays > STALE_WARNING_DAYS) {
    Logger.warn(`카탈로그 스냅샷이 ${Math.floor(ageDays)}일 전 것입니다 — 최신 카탈로그 반영이 필요할 수 있습니다.`);
  }
  return cache;
}

export function getCatalog(): CatalogExport {
  return loadSnapshot().catalog;
}

export function getCatalogEntries(category: CatalogCategory): CatalogEntry[] {
  return getCatalog()[category];
}

export interface SnapshotInfo {
  exists: boolean;
  generatedAt: string | null;
  ageDays: number | null;
}

export function getSnapshotInfo(): SnapshotInfo {
  const { generatedAt } = loadSnapshot();
  if (!generatedAt) return { exists: false, generatedAt: null, ageDays: null };
  return { exists: true, generatedAt, ageDays: (Date.now() - new Date(generatedAt).getTime()) / 86_400_000 };
}
