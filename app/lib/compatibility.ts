/* eslint-disable @typescript-eslint/no-explicit-any */

function normalizePcie(value?: string) {
  if (!value) return "";
  return value.replace(/\s+/g, "").toLowerCase();
}

function getRecencyScore(item: { releaseYear?: number }) {
  const year = item?.releaseYear ?? 2020;
  if (year >= 2025) return 100;
  if (year === 2024) return 95;
  if (year === 2023) return 88;
  if (year === 2022) return 80;
  return 70;
}

export function compatibilityScore(
  cpu: any,
  gpu: any,
  ram?: any,
  ssd?: any,
  motherboard?: any,
  psu?: any,
  powerLimit?: number
) {
  let score = 100;
  const warnings: string[] = [];

  const diff = Math.abs(cpu.gameScore - gpu.gameScore);
  if (diff > 20) {
    score -= 24;
    warnings.push("CPU와 GPU 성능 차이가 커서 병목 가능성이 있습니다.");
  } else if (diff > 10) {
    score -= 10;
    warnings.push("CPU와 GPU 성능 밸런스가 약간 맞지 않습니다.");
  }

  if (cpu.pcie && gpu.pcie && normalizePcie(cpu.pcie) !== normalizePcie(gpu.pcie)) {
    score -= 8;
    warnings.push("PCIe 버전이 서로 달라 성능 제한 가능성이 있습니다.");
  }

  if (ram && cpu.ddr && ram.ddr && cpu.ddr !== ram.ddr) {
    score -= 20;
    warnings.push("CPU와 RAM의 DDR 규격이 맞지 않습니다.");
  }

  if (motherboard && cpu.socket && motherboard.socket && cpu.socket !== motherboard.socket) {
    score -= 30;
    warnings.push("CPU와 메인보드 소켓이 일치하지 않아 조합이 불가능합니다.");
  }

  if (motherboard && ram?.ddr && motherboard.ddr && ram.ddr !== motherboard.ddr) {
    score -= 18;
    warnings.push("RAM 규격이 메인보드가 지원하는 규격과 다릅니다.");
  }

  if (ssd && cpu.pcie && ssd.interface && normalizePcie(cpu.pcie) !== normalizePcie(ssd.interface)) {
    score -= 6;
    warnings.push("SSD 인터페이스와 플랫폼 최적화가 완벽하지 않습니다.");
  }

  if (cpu && gpu && psu) {
    const requiredPower = cpu.tdp + gpu.tgp + 150;
    if (psu.wattage < requiredPower) {
      score -= 24;
      warnings.push(`파워 용량이 부족합니다. 최소 ${requiredPower}W가 필요합니다.`);
    } else if (psu.wattage < requiredPower + 100) {
      score -= 8;
      warnings.push("파워 여유가 다소 적어 안정적인 운영에 약간의 여지가 있습니다.");
    }
  }

  if (cpu && gpu && typeof powerLimit === "number" && powerLimit > 0) {
    const requiredPower = cpu.tdp + gpu.tgp + 150;
    if (powerLimit < requiredPower) {
      score -= 26;
      warnings.push(`보유 파워 용량이 ${requiredPower}W 기준을 넘습니다.`);
    }
  }

  return {
    score: Math.max(0, score),
    warnings,
  };
}

export function recencyBoost(cpu: any, gpu: any, motherboard: any, psu: any) {
  const recency = (getRecencyScore(cpu) + getRecencyScore(gpu) + getRecencyScore(motherboard) + getRecencyScore(psu)) / 4;
  return Math.round(recency * 100) / 100;
}