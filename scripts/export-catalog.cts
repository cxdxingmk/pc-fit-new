/**
 * app/database/*.ts 카탈로그를 하드웨어 인텔 봇이 읽을 수 있는 스냅샷 JSON으로 내보낸다.
 *
 * 봇(bot/hardware-intel)은 웹앱 소스와 별도 서버에 배포될 수 있어(현재 실제로 그렇다 —
 * 101.79.8.203에는 봇만 있고 app/database는 없음) 카탈로그를 직접 import할 수 없다. 이 스크립트를
 * "로컬 개발 환경(이 저장소가 실제로 있는 곳)"에서 실행해 스냅샷을 만들고, 그 파일을 봇 서버의
 * bot/hardware-intel/data/catalog-snapshot.json 경로로 수동 복사(scp)해두면 봇이 그걸 읽는다.
 * 웹앱을 나중에 어디에 배포하든(같은 서버/Vercel 등) 이 흐름은 그대로 유지된다.
 *
 * 사용법: npx ts-node -P scripts/tsconfig.cjs.json scripts/export-catalog.cts [출력경로]
 *   (기본 출력경로: bot/hardware-intel/data/catalog-snapshot.json)
 */
import fs from "fs";
import path from "path";
import { cpus } from "../app/database/cpu";
import { gpus } from "../app/database/gpu";
import { rams } from "../app/database/ram";
import { ssds } from "../app/database/ssd";
import { motherboards } from "../app/database/motherboard";
import { psus } from "../app/database/psu";

interface CatalogEntry {
  id: string;
  name: string;
  raw: Record<string, unknown>;
}

function toEntries(items: ReadonlyArray<{ id: string; name: string }>): CatalogEntry[] {
  return items.map((item) => ({ id: item.id, name: item.name, raw: item as Record<string, unknown> }));
}

const catalog = {
  CPU: toEntries(cpus),
  GPU: toEntries(gpus),
  RAM: toEntries(rams),
  SSD: toEntries(ssds),
  MOTHERBOARD: toEntries(motherboards),
  PSU: toEntries(psus),
};

const snapshot = { generatedAt: new Date().toISOString(), catalog };
const outPath = path.resolve(process.cwd(), process.argv[2] ?? "bot/hardware-intel/data/catalog-snapshot.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf-8");
console.log(`카탈로그 스냅샷 생성 완료: ${outPath}`);
console.log(`  CPU ${catalog.CPU.length} / GPU ${catalog.GPU.length} / RAM ${catalog.RAM.length} / SSD ${catalog.SSD.length} / MOTHERBOARD ${catalog.MOTHERBOARD.length} / PSU ${catalog.PSU.length}`);
