// /build 2단계("보유 부품 입력")에서 사용자가 "보유 중"으로 체크하고 구체적 모델까지 지정한
// 부품을, recommender.ts의 추천 카탈로그(app/database/*)와 실제로 매칭시키는 로직.
//
// CPU/GPU는 ExistingPartsStep.tsx의 select가 app/database/cpu.ts·gpu.ts를 원본으로 그대로
// 쓰므로(name 문자열이 카탈로그와 완전히 동일) 이름으로 정확히 매칭된다. 반면 RAM/SSD는
// ExistingPartsStep이 훨씬 방대한 실제 제품 카탈로그(src/utils/hardwareLookup)에서 모델을
// 고르게 하는데, recommender.ts가 쓰는 app/database/ram.ts·ssd.ts는 "용량+규격" 단위로
// 일반화된 훨씬 작은 카탈로그라 제품명이 일치하지 않는다 — 그래서 RAM/SSD는 이름이 아니라
// ExistingPartsState에 함께 저장돼 있는 규격(ddr/capacity)으로 매칭한다. 메인보드는 브랜드
// select + 시리즈 select("AMD B" 등) + 자유입력 모델("650")을 합쳐 칩셋 문자열("B650")을
// 복원해 매칭한다. 파워는 특정 제품이 아니라 와트수만 알려져 있어 카탈로그 매칭 없이 숫자만 쓴다.
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";
import type { ExistingPartsState } from "../types/build";

export interface ResolvedOwnedParts {
  cpu: CPU | null;
  gpu: GPU | null;
  ram: RAM | null;
  ssd: SSD | null;
  motherboard: MotherBoard | null;
  /** 특정 제품이 아니라 와트수만 알려진 값 — 대표 PSU 오브젝트는 buildOwnedPsuRepresentative로 별도 생성. */
  psuWattage: number | null;
}

export interface OwnedPartsCatalogs {
  cpus: CPU[];
  gpus: GPU[];
  rams: RAM[];
  ssds: SSD[];
  motherboards: MotherBoard[];
}

function parseWattageValue(value: string): number | null {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function ramCapacityOptionToGb(option: string): number | null {
  if (!option) return null;
  const numeric = Number(option.replace(/[^0-9]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function ssdCapacityOptionToGb(option: ExistingPartsState["SSD"]["capacity"]): number | null {
  switch (option) {
    case "512GB":
      return 512;
    case "1TB":
      return 1000;
    case "2TB":
      return 2000;
    case "4TB 이상":
      return 4000;
    default:
      return null;
  }
}

export function resolveOwnedCpu(state: ExistingPartsState["CPU"], catalog: CPU[]): CPU | null {
  if (!state.enabled || !state.model) return null;
  return catalog.find((cpu) => cpu.name === state.model) ?? null;
}

export function resolveOwnedGpu(state: ExistingPartsState["GPU"], catalog: GPU[]): GPU | null {
  if (!state.enabled || !state.model) return null;
  return catalog.find((gpu) => gpu.name === state.model) ?? null;
}

export function resolveOwnedRam(state: ExistingPartsState["RAM"], catalog: RAM[]): RAM | null {
  if (!state.enabled || !state.ddr || !state.capacity) return null;
  const capacityGb = ramCapacityOptionToGb(state.capacity);
  if (!capacityGb) return null;
  return catalog.find((ram) => ram.ddr === state.ddr && ram.capacity === capacityGb) ?? null;
}

export function resolveOwnedSsd(state: ExistingPartsState["SSD"], catalog: SSD[]): SSD | null {
  if (!state.enabled || !state.capacity) return null;
  const capacityGb = ssdCapacityOptionToGb(state.capacity);
  if (!capacityGb) return null;

  const exact = catalog.find((ssd) => ssd.capacity === capacityGb);
  if (exact) return exact;
  // 카탈로그 용량 등급이 성긴 경우(예: 512GB 보유인데 카탈로그엔 1TB부터 있음) 요청 용량 이상인
  // 가장 작은 항목으로 근사하고, 그마저 없으면(예: 4TB 이상 보유) 가장 큰 항목으로 근사한다.
  const atLeast = catalog.filter((ssd) => ssd.capacity >= capacityGb).sort((a, b) => a.capacity - b.capacity)[0];
  if (atLeast) return atLeast;
  return [...catalog].sort((a, b) => b.capacity - a.capacity)[0] ?? null;
}

export function resolveOwnedMotherboard(state: ExistingPartsState["Motherboard"], catalog: MotherBoard[]): MotherBoard | null {
  if (!state.enabled || !state.series || !state.model) return null;
  const alpha = state.series.split(" ")[1]; // "AMD B" -> "B", "Intel Z" -> "Z"
  if (!alpha) return null;
  const chipset = `${alpha}${state.model.trim()}`.toUpperCase();
  if (!chipset) return null;
  return catalog.find((mb) => mb.chipset.toUpperCase() === chipset) ?? null;
}

export function resolveOwnedPsuWattage(state: ExistingPartsState["Power"]): number | null {
  if (!state.enabled) return null;
  return parseWattageValue(state.wattage);
}

export function resolveOwnedParts(existingParts: ExistingPartsState, catalogs: OwnedPartsCatalogs): ResolvedOwnedParts {
  return {
    cpu: resolveOwnedCpu(existingParts.CPU, catalogs.cpus),
    gpu: resolveOwnedGpu(existingParts.GPU, catalogs.gpus),
    ram: resolveOwnedRam(existingParts.RAM, catalogs.rams),
    ssd: resolveOwnedSsd(existingParts.SSD, catalogs.ssds),
    motherboard: resolveOwnedMotherboard(existingParts.Motherboard, catalogs.motherboards),
    psuWattage: resolveOwnedPsuWattage(existingParts.Power),
  };
}

/**
 * 보유 파워는 특정 카탈로그 제품이 아니라 와트수만 알려져 있다 — compatibilityScore/ratePsu가
 * 요구하는 PSU 형태(효율 등급 등)를 채우기 위해 같은 와트수대의 카탈로그 항목을 참고해 대표
 * 오브젝트를 만들되, price는 0으로 강제한다(이미 보유 중이라 새로 사지 않음).
 */
export function buildOwnedPsuRepresentative(wattage: number, catalog: PSU[]): PSU {
  const closest = [...catalog].sort((a, b) => Math.abs(a.wattage - wattage) - Math.abs(b.wattage - wattage))[0];
  return {
    id: `owned-psu-${wattage}w`,
    name: `보유 파워 ${wattage}W`,
    brand: closest?.brand ?? "Seasonic",
    wattage,
    efficiency: closest?.efficiency ?? "80 PLUS Bronze",
    modularity: closest?.modularity ?? "non-modular",
    formFactor: closest?.formFactor ?? "ATX",
    releaseYear: closest?.releaseYear ?? 2020,
    qualityScore: closest?.qualityScore,
    price: 0,
    priceTier: undefined,
  };
}
