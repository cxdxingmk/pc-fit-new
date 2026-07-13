/**
 * fpsDisplay.ts — GPU 바운드는 확정형("256fps"), CPU 확인이 필요한 경우는
 * 범위형("230~270fps (CPU 확인 시 더 정확해요)") 표기로 분기한다.
 *
 * "mixed" 카테고리(예: 렌더링/영상 편집)도 CPU 가중치가 무시할 수 없는 수준이라
 * cpu와 동일하게 "CPU 미확인 시 범위형"으로 취급한다 — 순수 gpu 바운드만 확정형이다.
 */
import type { BoundBy } from "./workloadProfiles";

const RANGE_PADDING_RATIO = 0.09; // 요청 범위 ±8~10%의 중간값

export function needsCpuConfirmation(boundBy: BoundBy, cpuConfirmed: boolean): boolean {
  return boundBy !== "gpu" && !cpuConfirmed;
}

interface RangeFormatInput {
  value: number | null;
  boundBy: BoundBy;
  cpuConfirmed: boolean;
  unit: string;
}

function formatWithRange({ value, boundBy, cpuConfirmed, unit }: RangeFormatInput): string {
  if (value == null) return "—";

  if (!needsCpuConfirmation(boundBy, cpuConfirmed)) {
    return `${value}${unit}`;
  }

  const delta = Math.max(1, Math.round(value * RANGE_PADDING_RATIO));
  const low = Math.max(0, value - delta);
  const high = value + delta;
  return `${low}~${high}${unit} (CPU 확인 시 더 정확해요)`;
}

export interface FpsDisplayInput {
  estimatedFps: number | null;
  boundBy: BoundBy;
  cpuConfirmed: boolean;
}

/** 게임 카테고리 전용 — "256fps" / "230~270fps (CPU 확인 시 더 정확해요)" */
export function formatFpsDisplay({ estimatedFps, boundBy, cpuConfirmed }: FpsDisplayInput): string {
  return formatWithRange({ value: estimatedFps, boundBy, cpuConfirmed, unit: "fps" });
}

export interface ScoreDisplayInput {
  score: number | null;
  boundBy: BoundBy;
  cpuConfirmed: boolean;
}

/** CAD/렌더링/영상/AI 등 fps 개념이 없는 카테고리 전용 — "72점" / "65~79점 (CPU 확인 시 더 정확해요)" */
export function formatScoreDisplay({ score, boundBy, cpuConfirmed }: ScoreDisplayInput): string {
  return formatWithRange({ value: score, boundBy, cpuConfirmed, unit: "점" });
}
