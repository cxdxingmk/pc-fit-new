import { compatibilityScore, recencyBoost } from "./compatibility";
import { defaultDataSource } from "./dataSource";
import { getCpuBenchmark } from "../../database/mapping/cpuMap";
import { getGpuBenchmark } from "../../database/mapping/gpuMap";

// synchronous local DB imports for backward-compatible recommend()
import { cpus as _cpus } from "../database/cpu";
import { gpus as _gpus } from "../database/gpu";
import { rams as _rams } from "../database/ram";
import { ssds as _ssds } from "../database/ssd";
import { motherboards as _motherboards } from "../database/motherboard";
import { psus as _psus } from "../database/psu";

import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";
import type { ExistingPartsState, CaseOwnershipOption } from "../types/build";
import type { RecommendationResult } from "../types/recommend";

type Answers = Record<number, string[]>;

type Purpose = "gaming" | "work" | "video" | "stream" | "ai" | "dev" | "etc";

const priceTierToPrice: Record<"budget" | "mid" | "high" | "enthusiast", number> = {
  budget: 250000,
  mid: 500000,
  high: 850000,
  enthusiast: 1200000,
};

const WEIGHTS: Record<Purpose, { cpu: number; gpu: number; ram: number; ssd: number; motherboard: number; psu: number }> = {
  gaming: { cpu: 0.27, gpu: 0.4, ram: 0.17, ssd: 0.1, motherboard: 0.05, psu: 0.01 },
  work: { cpu: 0.36, gpu: 0.17, ram: 0.24, ssd: 0.17, motherboard: 0.05, psu: 0.01 },
  video: { cpu: 0.32, gpu: 0.22, ram: 0.24, ssd: 0.16, motherboard: 0.05, psu: 0.01 },
  stream: { cpu: 0.3, gpu: 0.33, ram: 0.22, ssd: 0.14, motherboard: 0.01, psu: 0.0 },
  ai: { cpu: 0.2, gpu: 0.5, ram: 0.2, ssd: 0.08, motherboard: 0.02, psu: 0.0 },
  dev: { cpu: 0.37, gpu: 0.12, ram: 0.22, ssd: 0.17, motherboard: 0.05, psu: 0.01 },
  etc: { cpu: 0.27, gpu: 0.27, ram: 0.22, ssd: 0.16, motherboard: 0.05, psu: 0.01 },
};

const BUDGET_TARGETS: Record<string, number> = {
  "100만원 이하": 1000000,
  "100~150만원": 1250000,
  "150~200만원": 1750000,
  "200~300만원": 2500000,
  "300만원 이상": 3500000,
};

const CASE_PRICE = 120000;

function pickPurpose(answers: Answers): Purpose {
  const p = answers[1] ?? [];
  const keys = p.flatMap((s) => s.toLowerCase().split(/\s+|[:]/));

  if (keys.some((k) => k.includes("ai"))) return "ai";
  if (keys.some((k) => k.includes("방송") || k.includes("stream"))) return "stream";
  if (keys.some((k) => k.includes("영상") || k.includes("video"))) return "video";
  if (keys.some((k) => k.includes("개발") || k.includes("dev"))) return "dev";
  if (keys.some((k) => k.includes("게임") || k.includes("game"))) return "gaming";
  if (keys.some((k) => k.includes("사무") || k.includes("office") || k.includes("work"))) return "work";
  if (keys.some((k) => k.includes("기타"))) return "etc";

  return "work";
}

function pickBudgetTarget(answers: Answers): number | null {
  const budget = answers[3]?.[0];
  if (!budget) return null;
  if (BUDGET_TARGETS[budget]) return BUDGET_TARGETS[budget];
  const numeric = Number(budget.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseWattage(value: string) {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function rateRam(ram: RAM, purpose: Purpose) {
  if (purpose === "gaming") return ram.gameScore;
  if (purpose === "ai") return ram.aiScore;
  return ram.workScore;
}

function rateSsd(ssd: SSD, purpose: Purpose) {
  if (purpose === "gaming") return ssd.gameScore;
  if (purpose === "ai") return ssd.aiScore;
  return ssd.workScore;
}

function rateMotherboard(mb: MotherBoard) {
  return (mb.gameScore + mb.workScore + mb.aiScore) / 3;
}

function ratePsu(psu: PSU, cpu: CPU, gpu: GPU) {
  const required = cpu.tdp + gpu.tgp + 150;
  const base = psu.wattage >= required ? 80 : 55;
  const efficiencyBonus = psu.efficiency === "80 PLUS Platinum" ? 10 : psu.efficiency === "80 PLUS Titanium" ? 12 : 8;
  return Math.min(100, base + efficiencyBonus);
}

function createReason(score: number, compatibility: number, caseOwnership: CaseOwnershipOption) {
  const messages: string[] = [];
  if (score > 90) messages.push("최신 세대 아키텍처와 안정성을 동시에 만족하는 세트입니다.");
  else if (score > 80) messages.push("전반적으로 매우 균형 잡힌 완성형 세트입니다.");
  else if (score > 70) messages.push("예산 대비 만족도가 높은 추천 조합입니다.");
  else messages.push("성능과 예산을 다시 조정해보면 더 좋은 결과가 나올 수 있습니다.");

  if (compatibility >= 90) messages.push("소켓·전력·메모리 규격까지 정교하게 맞춘 안정형 조합입니다.");
  if (caseOwnership === "owned") messages.push("케이스를 보유 중이라 케이스 비용을 제외한 견적으로 계산했습니다.");
  return messages;
}

function candidateId(cpu: CPU, gpu: GPU, ram: RAM, ssd: SSD, mb: MotherBoard, psu: PSU) {
  return [cpu.id, gpu.id, ram.id, ssd.id, mb.id, psu.id].join("-");
}

function buildCandidate(
  cpu: CPU,
  gpu: GPU,
  ram: RAM,
  ssd: SSD,
  mb: MotherBoard,
  psu: PSU,
  purpose: Purpose,
  budgetTarget: number | null,
  existingParts: ExistingPartsState,
  caseOwnership: CaseOwnershipOption
): RecommendationResult | null {
  const { score: compatibilityScoreVal, warnings } = compatibilityScore(
    cpu,
    gpu,
    ram,
    ssd,
    mb,
    psu,
    existingParts.Power.enabled ? parseWattage(existingParts.Power.wattage) ?? undefined : undefined
  );

  if (compatibilityScoreVal < 70) {
    return null;
  }

  const cpuBench = getCpuBenchmark(cpu.id);
  const gpuBench = getGpuBenchmark(gpu.id);

  const cpuScore =
    (cpuBench as { game?: number; work?: number; ai?: number })[
      purpose === "gaming" ? "game" : purpose === "ai" ? "ai" : "work"
    ] ?? cpu.gameScore;
  const gpuScore =
    (gpuBench as { game?: number; work?: number; ai?: number })[
      purpose === "gaming" ? "game" : purpose === "ai" ? "ai" : "work"
    ] ?? gpu.gameScore;

  const ramScore = rateRam(ram, purpose);
  const ssdScore = rateSsd(ssd, purpose);
  const motherboardScore = rateMotherboard(mb);
  const psuScore = ratePsu(psu, cpu, gpu);

  const recency = recencyBoost(cpu, gpu, mb, psu);
  const baseScore =
    cpuScore * 0.24 +
    gpuScore * 0.35 +
    ramScore * 0.15 +
    ssdScore * 0.08 +
    motherboardScore * 0.05 +
    psuScore * 0.01 +
    recency * 0.12;

  const cpuPrice = priceTierToPrice[cpu.priceTier] ?? 0;
  const gpuPrice = priceTierToPrice[gpu.priceTier] ?? 0;
  const ramPrice = priceTierToPrice[ram.priceTier] ?? 0;
  const ssdPrice = priceTierToPrice[ssd.priceTier] ?? 0;
  const motherboardPrice = priceTierToPrice[mb.priceTier] ?? 0;
  const psuPrice = priceTierToPrice[psu.priceTier] ?? 0;
  const casePrice = caseOwnership === "owned" ? 0 : CASE_PRICE;

  const totalPrice = cpuPrice + gpuPrice + ramPrice + ssdPrice + motherboardPrice + psuPrice + casePrice;

  let budgetScore = 0;
  if (budgetTarget) {
    const diff = Math.abs(totalPrice - budgetTarget);
    budgetScore = Math.max(0, 100 - diff / 30000);
  }

  const finalScore = Math.round(Math.min(100, baseScore * 0.9 + budgetScore * 0.1) * 100) / 100;

  return {
    id: candidateId(cpu, gpu, ram, ssd, mb, psu),
    cpu: cpu.name,
    gpu: gpu.name,
    ram: `${ram.capacity}GB ${ram.ddr}`,
    ssd: `${ssd.capacity}GB ${ssd.interface}`,
    motherboard: mb.name,
    power: `${psu.wattage}W 추천 파워`,
    case: caseOwnership === "owned" ? "보유 케이스 사용" : "신규 케이스 포함",
    totalPrice,
    casePrice,
    parts: [
      { label: "CPU", name: cpu.name, price: cpuPrice },
      { label: "GPU", name: gpu.name, price: gpuPrice },
      { label: "RAM", name: `${ram.capacity}GB ${ram.ddr}`, price: ramPrice },
      { label: "SSD", name: `${ssd.capacity}GB ${ssd.interface}`, price: ssdPrice },
      { label: "메인보드", name: mb.name, price: motherboardPrice },
      { label: "파워", name: `${psu.wattage}W ${psu.name}`, price: psuPrice },
      { label: "케이스", name: caseOwnership === "owned" ? "보유 케이스" : "추천 케이스", price: casePrice },
    ],
    compatibilityScore: compatibilityScoreVal,
    compatibilityDetails: [
      `소켓 일치: CPU ${cpu.socket}와 메인보드 ${mb.socket}가 호환됩니다.`,
      `전력 여유: ${cpu.tdp + gpu.tgp + 150}W 기준으로 ${psu.wattage}W 파워가 충분합니다.`,
      `메모리 규격: ${ram.ddr}와 메인보드 ${mb.ddr}가 일치합니다.`,
    ],
    warnings,
    finalScore,
    reason: createReason(finalScore, compatibilityScoreVal, caseOwnership),
  };
}

export function recommend(
  answers: Answers,
  existingParts: ExistingPartsState = {
    CPU: { enabled: false, brand: "", model: "" },
    GPU: { enabled: false, brand: "", model: "" },
    RAM: { enabled: false, ddr: "", capacity: "" },
    SSD: { enabled: false, capacity: "" },
    HDD: { enabled: false, capacity: "" },
    Motherboard: { enabled: false, series: "", model: "" },
    Power: { enabled: false, wattage: "" },
  },
  caseOwnership: CaseOwnershipOption = "owned"
): RecommendationResult[] {
  const cpus = _cpus;
  const gpus = _gpus;
  const rams = _rams;
  const ssds = _ssds;
  const mbs = _motherboards;
  const psus = _psus;

  const purpose = pickPurpose(answers);
  const budgetTarget = pickBudgetTarget(answers);
  const candidates: RecommendationResult[] = [];

  for (const cpu of cpus) {
    const matchedMbs = mbs.filter((mb) => mb.socket === cpu.socket && mb.ddr === cpu.ddr);
    const motherboardsToUse = matchedMbs.length > 0 ? matchedMbs : mbs.filter((mb) => mb.socket === cpu.socket);

    for (const gpu of gpus) {
      for (const ram of rams) {
        if (ram.ddr !== cpu.ddr) continue;

        for (const ssd of ssds) {
          for (const mb of motherboardsToUse) {
            if (mb.ddr !== ram.ddr) continue;

            for (const psu of psus) {
              const powerLimit = existingParts.Power.enabled ? parseWattage(existingParts.Power.wattage) : null;
              if (powerLimit && powerLimit < cpu.tdp + gpu.tgp + 150) continue;

              const candidate = buildCandidate(
                cpu,
                gpu,
                ram,
                ssd,
                mb,
                psu,
                purpose,
                budgetTarget,
                existingParts,
                caseOwnership
              );
              if (candidate) {
                candidates.push(candidate);
              }
            }
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, 3);
}

export async function recommendAsync(
  answers: Answers,
  existingParts: ExistingPartsState = {
    CPU: { enabled: false, brand: "", model: "" },
    GPU: { enabled: false, brand: "", model: "" },
    RAM: { enabled: false, ddr: "", capacity: "" },
    SSD: { enabled: false, capacity: "" },
    HDD: { enabled: false, capacity: "" },
    Motherboard: { enabled: false, series: "", model: "" },
    Power: { enabled: false, wattage: "" },
  },
  caseOwnership: CaseOwnershipOption = "owned"
): Promise<RecommendationResult[]> {
  const ds = defaultDataSource;

  const [cpus, gpus, rams, ssds, mbs, psus] = await Promise.all([
    ds.getCpuData(),
    ds.getGpuData(),
    ds.getRamData(),
    ds.getSsdData(),
    ds.getMotherboardData(),
    ds.getPsuData(),
  ]);

  const purpose = pickPurpose(answers);
  const budgetTarget = pickBudgetTarget(answers);
  const candidates: RecommendationResult[] = [];

  for (const cpu of cpus) {
    const matchedMbs = mbs.filter((mb) => mb.socket === cpu.socket && mb.ddr === cpu.ddr);
    const motherboardsToUse = matchedMbs.length > 0 ? matchedMbs : mbs.filter((mb) => mb.socket === cpu.socket);

    for (const gpu of gpus) {
      for (const ram of rams) {
        if (ram.ddr !== cpu.ddr) continue;

        for (const ssd of ssds) {
          for (const mb of motherboardsToUse) {
            if (mb.ddr !== ram.ddr) continue;

            for (const psu of psus) {
              const powerLimit = existingParts.Power.enabled ? parseWattage(existingParts.Power.wattage) : null;
              if (powerLimit && powerLimit < cpu.tdp + gpu.tgp + 150) continue;

              const candidate = buildCandidate(
                cpu,
                gpu,
                ram,
                ssd,
                mb,
                psu,
                purpose,
                budgetTarget,
                existingParts,
                caseOwnership
              );
              if (candidate) {
                candidates.push(candidate);
              }
            }
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, 3);
}

export { recommend as default };