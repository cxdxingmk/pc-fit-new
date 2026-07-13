/**
 * mergeScanResults.ts — WebGL 자동감지 결과와 CMD 붙여넣기 파싱 결과(scanParser.ts)를 병합.
 *
 * CMD 결과가 있으면 CPU/메인보드 필드를 그 값으로 덮어쓰고, 없으면 WebGL 결과와
 * "확인 필요" 상태를 유지한다. CMD 붙여넣기도 임의 텍스트를 정규식으로 파싱한
 * 신뢰할 수 없는 입력이므로, 병합 후에도 화이트리스트(실제 카탈로그 존재 여부)
 * 검증을 다시 거친다 — submitScan.ts의 SubmitScanSchema(GPU/스레드/RAM/화면)와는
 * 별개로, 여기서는 CPU/메인보드 필드만을 위한 자체 화이트리스트 검증을 수행한다.
 */
import { z } from "zod";
import { cpus } from "../database/cpu";
import type { BrowserScanResult } from "./browserScan";
import { sanitizeScanInput } from "./api/submitScan";
import type { ParseCommandOutputResult } from "./scanParser";

const validCpuIds = new Set(cpus.map((c) => c.id));

const CpuIdField = z.string().refine((id) => validCpuIds.has(id), { message: "카탈로그에 없는 cpuId" });
// wmic 칩셋 표기(Z890, B760 등) 이외의 값이 섞여 들어오는 걸 막기 위한 보수적 화이트리스트 패턴
const MotherboardChipsetField = z.string().regex(/^[A-Z0-9]{2,12}$/, "칩셋 표기 형식 아님");

function sanitizeCpuId(value: string | null | undefined): string | null {
  if (!value) return null;
  const result = CpuIdField.safeParse(value);
  if (result.success) return result.data;
  console.warn('[mergeScanResults] "cpuId" 값이 카탈로그 화이트리스트를 통과하지 못해 제외했습니다.', value);
  return null;
}

function sanitizeChipset(value: string | null | undefined): string | null {
  if (!value) return null;
  const result = MotherboardChipsetField.safeParse(value);
  if (result.success) return result.data;
  console.warn('[mergeScanResults] "motherboardChipset" 값이 형식 검증을 통과하지 못해 제외했습니다.', value);
  return null;
}

export interface MergedScanResult {
  gpuModel: string | null;
  threads: number | null;
  ramApproxGB: number | null;
  screen: { w: number; h: number; hzApprox: number | null } | null;
  cpuId: string | null;
  cpuLabel: string | null;
  motherboardChipset: string | null;
  /** CMD 붙여넣기로 CPU가 실제 확인됐는지 — WorkloadCategoryCard의 확정형/범위형 분기 기준 */
  cpuConfirmed: boolean;
}

export function mergeScanResults(
  webglResult: BrowserScanResult,
  cmdResult: ParseCommandOutputResult | null
): MergedScanResult {
  // GPU/스레드/RAM/화면 — WebGL 결과를 화이트리스트 재검증(submitScan과 동일 스키마 재사용)
  const sanitizedWebgl = sanitizeScanInput({
    gpuModel: webglResult.gpu,
    threads: webglResult.threads,
    ramApproxGB: webglResult.ramApproxGB,
    screen: webglResult.screen,
  });

  // CPU/메인보드 — CMD 결과가 있으면 그 값으로 덮어쓰되, 자체 화이트리스트 재검증
  const cpuId = sanitizeCpuId(cmdResult?.cpuId);
  const cpuLabel = cpuId ? (cmdResult?.cpuLabel ?? null) : null;
  const motherboardChipset = sanitizeChipset(cmdResult?.motherboardChipset);

  return {
    gpuModel: sanitizedWebgl.gpuModel,
    threads: sanitizedWebgl.threads,
    ramApproxGB: sanitizedWebgl.ramApproxGB,
    screen: sanitizedWebgl.screen,
    cpuId,
    cpuLabel,
    motherboardChipset,
    cpuConfirmed: cpuId !== null,
  };
}
