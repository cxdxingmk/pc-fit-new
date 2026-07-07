import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";

// CPU/GPU 성능 격차에 따른 병목 페널티
const CPU_GPU_GAP_LARGE = 20;
const CPU_GPU_GAP_SMALL = 10;
const PENALTY_CPU_GPU_GAP_LARGE = 24;
const PENALTY_CPU_GPU_GAP_SMALL = 10;

const PENALTY_PCIE_MISMATCH = 8;
const PENALTY_RAM_DDR_MISMATCH = 20;
const PENALTY_SOCKET_MISMATCH = 30;
const PENALTY_MB_RAM_DDR_MISMATCH = 18;
const PENALTY_SSD_PCIE_MISMATCH = 6;
const PENALTY_SATA_NO_PORTS = 18;
const PENALTY_NVME_NO_SLOT = 22;
const PENALTY_NVME_GEN_UNSUPPORTED = 14;

const PENALTY_PSU_INSUFFICIENT = 24;
const PENALTY_PSU_LOW_HEADROOM = 8;
const PSU_HEADROOM_MARGIN_WATTS = 100;
const PENALTY_EXISTING_PSU_INSUFFICIENT = 26;
const SYSTEM_OVERHEAD_WATTS = 150;

const RECENCY_SCORE_LATEST = 100;
const RECENCY_SCORE_YEAR_2024 = 95;
const RECENCY_SCORE_YEAR_2023 = 88;
const RECENCY_SCORE_YEAR_2022 = 80;
const RECENCY_SCORE_OLDER = 70;
const DEFAULT_RELEASE_YEAR = 2020;

function normalizePcie(value?: string) {
  if (!value) return "";
  // CPU/GPU의 pcie 필드는 "5.0" 형태지만 SSD.interface는 "PCIe 5.0" 형태라, 공백/대소문자만
  // 정규화하면 절대 같아질 수 없어 항상 불일치로 판정되던 버그가 있었다. 버전 숫자만 뽑아 비교한다.
  const versionMatch = value.match(/(\d+(?:\.\d+)?)/);
  return versionMatch ? versionMatch[1] : value.replace(/\s+/g, "").toLowerCase();
}

function getSsdNvmeGeneration(ssdInterface?: string): 3 | 4 | 5 | null {
  if (!ssdInterface) return null;
  if (/gen\s*3|pcie\s*3/i.test(ssdInterface)) return 3;
  if (/gen\s*4|pcie\s*4/i.test(ssdInterface)) return 4;
  if (/gen\s*5|pcie\s*5/i.test(ssdInterface)) return 5;
  return null;
}

function isSataInterface(ssdInterface?: string) {
  return Boolean(ssdInterface && /sata/i.test(ssdInterface));
}

function getRecencyScore(item: { releaseYear?: number }) {
  const year = item?.releaseYear ?? DEFAULT_RELEASE_YEAR;
  if (year >= 2025) return RECENCY_SCORE_LATEST;
  if (year === 2024) return RECENCY_SCORE_YEAR_2024;
  if (year === 2023) return RECENCY_SCORE_YEAR_2023;
  if (year === 2022) return RECENCY_SCORE_YEAR_2022;
  return RECENCY_SCORE_OLDER;
}

export function compatibilityScore(
  cpu: CPU,
  gpu: GPU,
  ram?: RAM,
  ssd?: SSD,
  motherboard?: MotherBoard,
  psu?: PSU,
  powerLimit?: number
) {
  let score = 100;
  const warnings: string[] = [];

  const diff = Math.abs(cpu.gameScore - gpu.gameScore);
  if (diff > CPU_GPU_GAP_LARGE) {
    score -= PENALTY_CPU_GPU_GAP_LARGE;
    warnings.push("CPU와 GPU 성능 차이가 커서 병목 가능성이 있습니다.");
  } else if (diff > CPU_GPU_GAP_SMALL) {
    score -= PENALTY_CPU_GPU_GAP_SMALL;
    warnings.push("CPU와 GPU 성능 밸런스가 약간 맞지 않습니다.");
  }

  if (cpu.pcie && gpu.pcie && normalizePcie(cpu.pcie) !== normalizePcie(gpu.pcie)) {
    score -= PENALTY_PCIE_MISMATCH;
    warnings.push("PCIe 버전이 서로 달라 성능 제한 가능성이 있습니다.");
  }

  if (ram && cpu.ddr && ram.ddr && cpu.ddr !== ram.ddr) {
    score -= PENALTY_RAM_DDR_MISMATCH;
    warnings.push("CPU와 RAM의 DDR 규격이 맞지 않습니다.");
  }

  if (motherboard && cpu.socket && motherboard.socket && cpu.socket !== motherboard.socket) {
    score -= PENALTY_SOCKET_MISMATCH;
    warnings.push("CPU와 메인보드 소켓이 일치하지 않아 조합이 불가능합니다.");
  }

  if (motherboard && ram?.ddr && motherboard.ddr && ram.ddr !== motherboard.ddr) {
    score -= PENALTY_MB_RAM_DDR_MISMATCH;
    warnings.push("RAM 규격이 메인보드가 지원하는 규격과 다릅니다.");
  }

  if (ssd && cpu.pcie && ssd.interface && normalizePcie(cpu.pcie) !== normalizePcie(ssd.interface)) {
    score -= PENALTY_SSD_PCIE_MISMATCH;
    warnings.push("SSD 인터페이스와 플랫폼 최적화가 완벽하지 않습니다.");
  }

  if (ssd && motherboard) {
    const ssdIsSata = isSataInterface(ssd.interface);
    const nvmeGen = getSsdNvmeGeneration(ssd.interface);

    if (ssdIsSata && typeof motherboard.sataPorts === "number" && motherboard.sataPorts <= 0) {
      score -= PENALTY_SATA_NO_PORTS;
      warnings.push("SATA SSD를 선택했지만 메인보드 SATA 포트가 부족합니다.");
    }

    if (!ssdIsSata && typeof motherboard.m2Slots === "number" && motherboard.m2Slots <= 0) {
      score -= PENALTY_NVME_NO_SLOT;
      warnings.push("NVMe SSD를 선택했지만 메인보드 M.2 슬롯이 없습니다.");
    }

    if (nvmeGen && Array.isArray(motherboard.supportedNvmeGenerations)) {
      if (!motherboard.supportedNvmeGenerations.includes(nvmeGen)) {
        score -= PENALTY_NVME_GEN_UNSUPPORTED;
        warnings.push(`NVMe Gen${nvmeGen} SSD를 선택했지만 메인보드가 해당 세대를 지원하지 않습니다.`);
      }
    }
  }

  if (cpu && gpu && psu) {
    const requiredPower = cpu.tdp + gpu.tgp + SYSTEM_OVERHEAD_WATTS;
    if (psu.wattage < requiredPower) {
      score -= PENALTY_PSU_INSUFFICIENT;
      warnings.push(`파워 용량이 부족합니다. 최소 ${requiredPower}W가 필요합니다.`);
    } else if (psu.wattage < requiredPower + PSU_HEADROOM_MARGIN_WATTS) {
      score -= PENALTY_PSU_LOW_HEADROOM;
      warnings.push("파워 여유가 다소 적어 안정적인 운영에 약간의 여지가 있습니다.");
    }
  }

  if (cpu && gpu && typeof powerLimit === "number" && powerLimit > 0) {
    const requiredPower = cpu.tdp + gpu.tgp + SYSTEM_OVERHEAD_WATTS;
    if (powerLimit < requiredPower) {
      score -= PENALTY_EXISTING_PSU_INSUFFICIENT;
      warnings.push(`보유 파워 용량이 ${requiredPower}W 기준을 넘습니다.`);
    }
  }

  return {
    score: Math.max(0, score),
    warnings,
  };
}

export function recencyBoost(cpu: CPU, gpu: GPU, motherboard: MotherBoard, psu: PSU) {
  const recency = (getRecencyScore(cpu) + getRecencyScore(gpu) + getRecencyScore(motherboard) + getRecencyScore(psu)) / 4;
  return Math.round(recency * 100) / 100;
}
