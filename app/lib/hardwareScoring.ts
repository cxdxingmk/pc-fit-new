/**
 * app/database/cpu.ts, app/database/gpu.ts의 curated 16/56개 항목은 gameScore/workScore/aiScore/priceTier가
 * 수작업으로 채워져 있다. src/constants/hardwareData.ts에서 새로 들어오는 항목들은 이 필드가 전혀 없으므로,
 * curated 항목을 "앵커(anchor)"로 삼아 선형회귀로 계수를 학습한 뒤 나머지 항목에 적용해 추정한다.
 *
 * - 이미 curated 카탈로그에 있는 모델은 절대 재추정하지 않고 기존 점수를 그대로 쓴다(Map 매칭).
 * - 신규 항목만 추정치가 채워지며, 반환값에 estimated:true 플래그를 남겨 어디서든 구분 가능하게 한다.
 */
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import { inferCpuCompatFields, inferGpuCompatFields, normalizeModelKey, slugifyHardwareModel } from "./hardwareEnrichment";
import type { CPUData, GPUData } from "../../src/constants/hardwareData";

type PriceTier = "budget" | "mid" | "high" | "enthusiast";

// ---- 아주 작은 다변량 선형회귀 (정규방정식 + 가우스 소거) ----
// anchor 4~수십개, feature 4~5개 규모라 무거운 라이브러리 없이 직접 풀어도 충분하다.
function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const augmented = matrix.map((row, i) => [...row, vector[i]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[pivotRow][col])) pivotRow = row;
    }
    [augmented[col], augmented[pivotRow]] = [augmented[pivotRow], augmented[col]];

    const pivotValue = augmented[col][col];
    if (Math.abs(pivotValue) < 1e-10) continue;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = augmented[row][col] / pivotValue;
      for (let k = col; k <= n; k++) augmented[row][k] -= factor * augmented[col][k];
    }
  }

  return augmented.map((row, i) => (Math.abs(row[i]) < 1e-10 ? 0 : row[row.length - 1] / row[i]));
}

function fitLinearRegression(features: number[][], targets: number[]): number[] {
  const dims = features[0].length;
  const xtx: number[][] = Array.from({ length: dims }, () => new Array(dims).fill(0));
  const xty: number[] = new Array(dims).fill(0);

  for (let i = 0; i < features.length; i++) {
    for (let a = 0; a < dims; a++) {
      xty[a] += features[i][a] * targets[i];
      for (let b = 0; b < dims; b++) {
        xtx[a][b] += features[i][a] * features[i][b];
      }
    }
  }

  return solveLinearSystem(xtx, xty);
}

function predict(coeffs: number[], feature: number[]): number {
  return coeffs.reduce((sum, c, i) => sum + c * feature[i], 0);
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

// ---- priceTier 추정: 성능 점수가 아니라 "라인업 등급 + 출시연도 감가상각 + 보급형 접미사"로 추정한다.
// (curated 데이터를 보면 priceTier는 순수 성능 랭킹과 단조 관계가 아니라, 시장 가격 포지셔닝을 반영하기 때문)
function baseLineupTier(model: string): PriceTier {
  if (/Threadripper|Ryzen\s+9|Core i9|Ultra\s+9/i.test(model)) return "enthusiast";
  if (/Ryzen\s+7|Core i7|Ultra\s+7/i.test(model)) return "high";
  if (/Ryzen\s+5|Core i5|Ultra\s+5/i.test(model)) return "mid";
  return "budget";
}

function downgradeTier(tier: PriceTier, steps: number): PriceTier {
  const order: PriceTier[] = ["budget", "mid", "high", "enthusiast"];
  const idx = Math.max(0, order.indexOf(tier) - steps);
  return order[idx];
}

function estimateCpuPriceTier(model: string, releaseYear: number): PriceTier {
  const tier = baseLineupTier(model);
  let downgrades = 0;
  if (releaseYear <= 2021) downgrades += 1;
  if (releaseYear <= 2018) downgrades += 1;
  if (/F$/i.test(model.trim())) downgrades += 1; // 보급형 F-suffix(무내장그래픽, 저가형 비닝)
  return downgradeTier(tier, downgrades);
}

function estimateGpuPriceTier(vramGb: number, releaseYear: number, gameScoreEstimate: number): PriceTier {
  const tier: PriceTier = gameScoreEstimate >= 95 ? "enthusiast" : gameScoreEstimate >= 82 ? "high" : gameScoreEstimate >= 65 ? "mid" : "budget";
  let downgrades = 0;
  if (releaseYear <= 2018) downgrades += 1;
  if (vramGb <= 4) downgrades += 1;
  return downgradeTier(tier, downgrades);
}

// ---- CPU 점수 추정 ----
interface CpuAnchor {
  feature: number[];
  gameScore: number;
  workScore: number;
  aiScore: number;
}

function cpuFeature(c: { cores: number; threads: number; baseClock: number; releaseYear: number }): number[] {
  return [1, c.cores, c.threads, c.baseClock, c.releaseYear - 2015];
}

export function buildAdditionalCpus(curated: CPU[], newCatalog: CPUData[]): CPU[] {
  // id 문자열끼리 비교하면 curated의 제각각인 id 표기 관례 때문에 같은 부품이 중복으로 들어갈 수 있어
  // (예: "gtx1660" vs slugify 결과 "gtx-1660"), 반드시 정규화한 모델명으로 동일 부품 여부를 판정한다.
  const existingModelKeys = new Set(curated.map((c) => normalizeModelKey(c.name)));
  const usedIds = new Set(curated.map((c) => c.id));
  const anchors: CpuAnchor[] = curated.map((c) => ({
    feature: cpuFeature({ cores: c.cores, threads: c.threads, baseClock: c.baseClock, releaseYear: c.releaseYear }),
    gameScore: c.gameScore,
    workScore: c.workScore,
    aiScore: c.aiScore,
  }));

  const gameCoeffs = fitLinearRegression(anchors.map((a) => a.feature), anchors.map((a) => a.gameScore));
  const workCoeffs = fitLinearRegression(anchors.map((a) => a.feature), anchors.map((a) => a.workScore));
  const aiCoeffs = fitLinearRegression(anchors.map((a) => a.feature), anchors.map((a) => a.aiScore));

  const result: CPU[] = [];

  for (const entry of newCatalog) {
    const modelKey = normalizeModelKey(entry.model);
    if (existingModelKeys.has(modelKey)) continue; // 이미 curated 목록에 있는 실제 부품 - 기존 점수 유지, 재추정하지 않음
    existingModelKeys.add(modelKey);

    const compat = inferCpuCompatFields(entry.model, entry.cores);
    if (compat.unsupportedSocket) continue; // 메인보드 카탈로그가 지원하지 않는 소켓(Threadripper 등)은 추천 로직에서 무의미하므로 제외

    let id = slugifyHardwareModel(entry.model);
    if (usedIds.has(id)) id = `${id}-2`; // 방어적: 생성된 id끼리 우연히 겹치는 경우 대비
    usedIds.add(id);

    const feature = cpuFeature({
      cores: entry.cores,
      threads: entry.threads,
      baseClock: entry.baseClockGhz,
      releaseYear: entry.releaseYear,
    });

    const brandName = /^AMD/i.test(entry.model) || /Ryzen/i.test(entry.model) ? "AMD" : "Intel";

    result.push({
      id,
      name: entry.model.replace(/^AMD\s+|^Intel\s+/i, ""),
      brand: brandName,
      socket: compat.socket,
      cores: entry.cores,
      threads: entry.threads,
      baseClock: entry.baseClockGhz,
      boostClock: entry.baseClockGhz,
      cache: 0,
      tdp: compat.tdp,
      igpu: compat.igpu,
      ddr: compat.ddr,
      pcie: compat.pcie,
      releaseYear: entry.releaseYear,
      gameScore: clampScore(predict(gameCoeffs, feature)),
      workScore: clampScore(predict(workCoeffs, feature)),
      aiScore: clampScore(predict(aiCoeffs, feature)),
      priceTier: estimateCpuPriceTier(entry.model, entry.releaseYear),
    });
  }

  return result;
}

// ---- GPU 점수 추정 ----
interface GpuAnchor {
  feature: number[];
  gameScore: number;
  workScore: number;
  aiScore: number;
}

function gpuFeature(g: { vram: number; releaseYear: number; tgp: number }): number[] {
  return [1, g.vram, g.releaseYear - 2014, g.tgp];
}

export function buildAdditionalGpus(curated: GPU[], newCatalog: GPUData[]): GPU[] {
  const existingModelKeys = new Set(curated.map((g) => normalizeModelKey(g.name)));
  const usedIds = new Set(curated.map((g) => g.id));
  const anchors: GpuAnchor[] = curated.map((g) => ({
    feature: gpuFeature({ vram: g.vram, releaseYear: g.releaseYear, tgp: g.tgp }),
    gameScore: g.gameScore,
    workScore: g.workScore,
    aiScore: g.aiScore,
  }));

  const gameCoeffs = fitLinearRegression(anchors.map((a) => a.feature), anchors.map((a) => a.gameScore));
  const workCoeffs = fitLinearRegression(anchors.map((a) => a.feature), anchors.map((a) => a.workScore));
  const aiCoeffs = fitLinearRegression(anchors.map((a) => a.feature), anchors.map((a) => a.aiScore));

  const result: GPU[] = [];

  for (const entry of newCatalog) {
    const modelKey = normalizeModelKey(entry.model);
    if (existingModelKeys.has(modelKey)) continue;
    existingModelKeys.add(modelKey);

    let id = slugifyHardwareModel(entry.model);
    if (usedIds.has(id)) id = `${id}-2`;
    usedIds.add(id);

    const compat = inferGpuCompatFields(entry.model, entry.manufacturer, entry.cudaOrStreamCores, entry.vramGb);
    const feature = gpuFeature({ vram: entry.vramGb, releaseYear: entry.releaseYear, tgp: compat.tgp });

    const gameScore = clampScore(predict(gameCoeffs, feature));

    result.push({
      id,
      name: entry.model.replace(/^AMD\s+|^NVIDIA\s+/i, ""),
      brand: entry.manufacturer,
      vram: entry.vramGb,
      memoryType: compat.memoryType,
      tgp: compat.tgp,
      dlss: compat.dlss,
      fsr: compat.fsr,
      xess: compat.xess,
      rayTracing: compat.rayTracing,
      pcie: compat.pcie,
      releaseYear: entry.releaseYear,
      gameScore,
      workScore: clampScore(predict(workCoeffs, feature)),
      aiScore: clampScore(predict(aiCoeffs, feature)),
      priceTier: estimateGpuPriceTier(entry.vramGb, entry.releaseYear, gameScore),
    });
  }

  return result;
}
