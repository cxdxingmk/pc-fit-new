import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";

/** critical(치명적): 조합 자체가 불가능하거나 심각한 병목. warn(주의): 동작은 하나 최적은 아님.
 *  info(정보): 감점은 있지만 실사용에 거의 영향 없는 참고용 안내. */
export type CompatibilitySeverity = "critical" | "warn" | "info";

export interface CompatibilityWarning {
  severity: CompatibilitySeverity;
  message: string;
}

// CPU/GPU 성능 격차에 따른 병목 페널티
// CPU_GPU_GAP_LARGE는 recommender.ts도 그대로 가져다 쓴다 — "치명적 병목"이라고 경고하면서
// 동시에 그 조합을 추천하는 자기모순을 막으려면, 후보 선별 단계의 격차 기준과 경고 발생
// 기준이 절대 어긋나면 안 되기 때문이다(숫자를 각자 따로 들고 있으면 나중에 한쪽만 바뀌어
// 다시 어긋나기 쉽다).
export const CPU_GPU_GAP_LARGE = 20;
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
  // GPU 생략(iGPU만 사용) 후보는 gpu가 null이다 — 디스크리트 GPU가 아예 없으니 병목/PCIe 불일치
  // 같은 "GPU와의 관계" 체크는 성립하지 않아 전부 건너뛴다(아래 각 분기 참고).
  gpu: GPU | null,
  ram?: RAM,
  ssd?: SSD,
  motherboard?: MotherBoard,
  psu?: PSU,
  powerLimit?: number
) {
  let score = 100;
  const warnings: CompatibilityWarning[] = [];

  if (gpu) {
    const diff = Math.abs(cpu.gameScore - gpu.gameScore);
    if (diff > CPU_GPU_GAP_LARGE) {
      score -= PENALTY_CPU_GPU_GAP_LARGE;
      warnings.push({ severity: "critical", message: "CPU와 GPU 성능 차이가 커서 병목 가능성이 있습니다." });
    } else if (diff > CPU_GPU_GAP_SMALL) {
      score -= PENALTY_CPU_GPU_GAP_SMALL;
      warnings.push({ severity: "warn", message: "CPU와 GPU 성능 밸런스가 약간 맞지 않습니다." });
    }

    if (cpu.pcie && gpu.pcie && normalizePcie(cpu.pcie) !== normalizePcie(gpu.pcie)) {
      score -= PENALTY_PCIE_MISMATCH;
      warnings.push({ severity: "info", message: "PCIe 버전이 서로 달라 성능 제한 가능성이 있습니다." });
    }
  }

  if (ram && cpu.ddr && ram.ddr && cpu.ddr !== ram.ddr) {
    score -= PENALTY_RAM_DDR_MISMATCH;
    warnings.push({ severity: "warn", message: "CPU와 RAM의 DDR 규격이 맞지 않습니다." });
  }

  if (motherboard && cpu.socket && motherboard.socket && cpu.socket !== motherboard.socket) {
    score -= PENALTY_SOCKET_MISMATCH;
    warnings.push({ severity: "critical", message: "CPU와 메인보드 소켓이 일치하지 않아 조합이 불가능합니다." });
  }

  if (motherboard && ram?.ddr && motherboard.ddr && ram.ddr !== motherboard.ddr) {
    score -= PENALTY_MB_RAM_DDR_MISMATCH;
    warnings.push({ severity: "warn", message: "RAM 규격이 메인보드가 지원하는 규격과 다릅니다." });
  }

  if (ssd && cpu.pcie && ssd.interface && normalizePcie(cpu.pcie) !== normalizePcie(ssd.interface)) {
    score -= PENALTY_SSD_PCIE_MISMATCH;
    warnings.push({ severity: "info", message: "SSD 인터페이스와 플랫폼 최적화가 완벽하지 않습니다." });
  }

  if (ssd && motherboard) {
    const ssdIsSata = isSataInterface(ssd.interface);
    const nvmeGen = getSsdNvmeGeneration(ssd.interface);

    if (ssdIsSata && typeof motherboard.sataPorts === "number" && motherboard.sataPorts <= 0) {
      score -= PENALTY_SATA_NO_PORTS;
      warnings.push({ severity: "warn", message: "SATA SSD를 선택했지만 메인보드 SATA 포트가 부족합니다." });
    }

    if (!ssdIsSata && typeof motherboard.m2Slots === "number" && motherboard.m2Slots <= 0) {
      score -= PENALTY_NVME_NO_SLOT;
      warnings.push({ severity: "warn", message: "NVMe SSD를 선택했지만 메인보드 M.2 슬롯이 없습니다." });
    }

    if (nvmeGen && Array.isArray(motherboard.supportedNvmeGenerations)) {
      if (!motherboard.supportedNvmeGenerations.includes(nvmeGen)) {
        score -= PENALTY_NVME_GEN_UNSUPPORTED;
        warnings.push({ severity: "warn", message: `NVMe Gen${nvmeGen} SSD를 선택했지만 메인보드가 해당 세대를 지원하지 않습니다.` });
      }
    }
  }

  // gpu.tgp는 GPU가 있을 때만 더한다 — iGPU 전력은 이미 cpu.tdp에 포함돼 있다고 본다(실제로도
  // CPU 패키지 전력에 iGPU 소모분이 포함되어 측정되는 값이라 별도로 더할 근거가 없다).
  if (cpu && psu) {
    const requiredPower = cpu.tdp + (gpu?.tgp ?? 0) + SYSTEM_OVERHEAD_WATTS;
    if (psu.wattage < requiredPower) {
      score -= PENALTY_PSU_INSUFFICIENT;
      warnings.push({ severity: "critical", message: `파워 용량이 부족합니다. 최소 ${requiredPower}W가 필요합니다.` });
    } else if (psu.wattage < requiredPower + PSU_HEADROOM_MARGIN_WATTS) {
      score -= PENALTY_PSU_LOW_HEADROOM;
      warnings.push({ severity: "info", message: "파워 여유가 다소 적어 안정적인 운영에 약간의 여지가 있습니다." });
    }
  }

  if (cpu && typeof powerLimit === "number" && powerLimit > 0) {
    const requiredPower = cpu.tdp + (gpu?.tgp ?? 0) + SYSTEM_OVERHEAD_WATTS;
    if (powerLimit < requiredPower) {
      score -= PENALTY_EXISTING_PSU_INSUFFICIENT;
      warnings.push({ severity: "critical", message: `보유 파워 용량이 ${requiredPower}W 기준을 넘습니다.` });
    }
  }

  return {
    score: Math.max(0, score),
    warnings,
  };
}

export function recencyBoost(cpu: CPU, gpu: GPU | null, motherboard: MotherBoard, psu: PSU) {
  // GPU 생략(iGPU만 사용) 후보는 gpu가 null이라 recency 점수를 지어낼 근거가 없다 — 3개 항목
  // (cpu/motherboard/psu) 평균으로 계산한다.
  const scores = [getRecencyScore(cpu), gpu ? getRecencyScore(gpu) : null, getRecencyScore(motherboard), getRecencyScore(psu)].filter(
    (s): s is number => s !== null
  );
  const recency = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return Math.round(recency * 100) / 100;
}
