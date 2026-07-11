/**
 * bot/hardware-intel이 `!export-approved`로 내보낸 JSON을 받아 app/database/*.ts에
 * AST 레벨로 반영한다.
 *
 * 원래는 봇 프로세스 안에서 이 일을 직접 했지만(옛 catalogWriter.ts), 봇이 웹앱 소스와
 * 다른 서버에 배포될 수 있어(실제로 지금 그렇다 — 봇은 101.79.8.203, 웹앱은 아직 배포 위치
 * 미정) 봇에서 떼어내 "웹앱 소스가 실제로 존재하는 곳"에서 실행하는 스크립트로 옮겼다.
 * 웹앱을 나중에 어디에 배포하든(같은 서버/Vercel 등) 이 스크립트는 그 배포 방식과 무관하게
 * — 개발자가 로컬에서 git으로 관리하는 소스 위에서 — 그대로 동작한다.
 *
 * 사용법: npm run apply-proposals -- <export-approved로 받은 JSON 파일 경로>
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Project, SyntaxKind } from "ts-morph";
import type { ProposalExportItem } from "../bot/hardware-intel/proposals/exportApproved.ts";
import type { CatalogCategory } from "../bot/hardware-intel/types.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const CATEGORY_TARGET: Record<CatalogCategory, { file: string; arrayName: string }> = {
  CPU: { file: "app/database/cpu.ts", arrayName: "curatedCpus" },
  GPU: { file: "app/database/gpu.ts", arrayName: "curatedGpus" },
  RAM: { file: "app/database/ram.ts", arrayName: "rams" },
  SSD: { file: "app/database/ssd.ts", arrayName: "ssds" },
  MOTHERBOARD: { file: "app/database/motherboard.ts", arrayName: "motherboards" },
  PSU: { file: "app/database/psu.ts", arrayName: "psus" },
};

function runTscCheck(): { ok: boolean; output: string } {
  try {
    execFileSync(process.execPath, [path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "."], {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      stdio: "pipe",
    });
    return { ok: true, output: "" };
  } catch (err) {
    const output = err && typeof err === "object" && "stdout" in err ? String((err as { stdout: unknown }).stdout) : String(err);
    return { ok: false, output };
  }
}

/** 파일 스냅샷 → ts-morph로 대상 id의 객체 리터럴 찾아 숫자 필드만 수정 → 저장 →
 *  `tsc --noEmit` 즉시 검증 → 실패 시 스냅샷으로 즉시 롤백. */
function applyOne(item: ProposalExportItem): { ok: boolean; message: string } {
  const target = CATEGORY_TARGET[item.category];
  const filePath = path.join(REPO_ROOT, target.file);
  const backup = fs.readFileSync(filePath, "utf-8");

  try {
    const project = new Project({ tsConfigFilePath: path.join(REPO_ROOT, "tsconfig.json") });
    const sourceFile = project.addSourceFileAtPath(filePath);
    const varDecl = sourceFile.getVariableDeclarationOrThrow(target.arrayName);
    const arrayLiteral = varDecl.getInitializerIfKindOrThrow(SyntaxKind.ArrayLiteralExpression);

    const targetObject = arrayLiteral.getElements().find((el) => {
      if (!el.isKind(SyntaxKind.ObjectLiteralExpression)) return false;
      const idProp = el.getProperty("id");
      if (!idProp || !idProp.isKind(SyntaxKind.PropertyAssignment)) return false;
      const idText = idProp.getInitializer()?.asKind(SyntaxKind.StringLiteral)?.getLiteralValue();
      return idText === item.targetCatalogId;
    });

    if (!targetObject || !targetObject.isKind(SyntaxKind.ObjectLiteralExpression)) {
      return {
        ok: false,
        message: `대상 id(${item.targetCatalogId})를 ${target.arrayName}에서 찾지 못함 — 카탈로그가 이미 바뀌었을 수 있음`,
      };
    }

    for (const [field, value] of Object.entries(item.fieldUpdates)) {
      const prop = targetObject.getProperty(field);
      if (!prop || !prop.isKind(SyntaxKind.PropertyAssignment)) {
        return { ok: false, message: `필드 "${field}"가 대상 객체에 없어 반영을 중단함(부분 반영 방지)` };
      }
      prop.setInitializer(String(value));
    }

    sourceFile.saveSync();
  } catch (err) {
    fs.writeFileSync(filePath, backup, "utf-8");
    const reason = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `AST 수정 중 오류로 롤백함: ${reason}` };
  }

  const tsc = runTscCheck();
  if (!tsc.ok) {
    fs.writeFileSync(filePath, backup, "utf-8");
    console.error(tsc.output);
    return { ok: false, message: "tsc 검증 실패로 롤백함 — 위 로그를 확인하세요." };
  }

  return { ok: true, message: `${target.file} 반영 완료 (${target.arrayName} 중 id=${item.targetCatalogId})` };
}

function main(): void {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("사용법: npm run apply-proposals -- <export-approved로 받은 JSON 파일 경로>");
    process.exit(1);
  }

  const items = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), "utf-8")) as ProposalExportItem[];
  if (items.length === 0) {
    console.log("적용할 항목이 없습니다.");
    return;
  }

  console.log(`${items.length}건 적용 시작...`);
  const results: Array<{ id: number; ok: boolean; message: string }> = [];
  for (const item of items) {
    const result = applyOne(item);
    results.push({ id: item.id, ...result });
    console.log(`${result.ok ? "✅" : "⚠"} #${item.id} (${item.detectedName}): ${result.message}`);
  }

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n완료: 성공 ${succeeded.length}건 / 실패 ${failed.length}건`);
  if (succeeded.length > 0) {
    console.log(`\n봇에 반영 완료를 알리려면: !mark-applied ${succeeded.map((r) => r.id).join(" ")}`);
  }
  console.log("git diff로 변경 내용을 확인한 뒤 커밋/배포하세요.");
}

main();
