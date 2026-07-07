/**
 * @description 하드웨어 마스터 데이터셋 룩업 유틸
 * - 본 데이터는 제조사 공식 물리 사양(Cores, Threads, Clock, VRAM)만 포함하며, PassMark/UserBenchmark 등 저작권 분쟁 소지가 있는 제3자 벤치마크 점수를 배제한 청정 데이터셋입니다.
 * - 2017-01-01 이후 출시된 데스크탑 전용 부품만 타겟팅하며, 노트북/모바일 파생 라인업은 필터링되었습니다.
 * - 일부 인텔 12~14세대 누락 모델은 Intel ARK 공식 스펙으로 수동 보완(ark_gapfill / ark_manual_addition)되었으므로 주기적 재검증이 필요합니다.
 */
import {
  HARDWARE_MASTER_PRESETS,
  type CPUData,
  type GPUData,
  type RAMData,
  type SSDData,
} from "../constants/hardwareData";

export function getCpuByModel(model: string): CPUData | undefined {
  if (!model) return undefined;
  return HARDWARE_MASTER_PRESETS.cpus[model];
}

export function getGpuByModel(model: string): GPUData | undefined {
  if (!model) return undefined;
  return HARDWARE_MASTER_PRESETS.gpus[model];
}

export function getRamByModel(model: string): RAMData | undefined {
  if (!model) return undefined;
  return HARDWARE_MASTER_PRESETS.ram[model];
}

export function getSsdByModel(model: string): SSDData | undefined {
  if (!model) return undefined;
  return HARDWARE_MASTER_PRESETS.ssd[model];
}

export function getAllCpus(): CPUData[] {
  return Object.values(HARDWARE_MASTER_PRESETS.cpus);
}

export function getAllGpus(): GPUData[] {
  return Object.values(HARDWARE_MASTER_PRESETS.gpus);
}

export function getAllRams(): RAMData[] {
  return Object.values(HARDWARE_MASTER_PRESETS.ram);
}

export function getAllSsds(): SSDData[] {
  return Object.values(HARDWARE_MASTER_PRESETS.ssd);
}

export function searchCpusByKeyword(keyword: string): CPUData[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return getAllCpus();

  return getAllCpus().filter((cpu) => cpu.model.toLowerCase().includes(normalized));
}

export function searchGpusByKeyword(keyword: string): GPUData[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return getAllGpus();

  return getAllGpus().filter((gpu) => gpu.model.toLowerCase().includes(normalized));
}

export function searchRamsByKeyword(keyword: string): RAMData[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return getAllRams();

  return getAllRams().filter((ram) => {
    const haystack = `${ram.model} ${ram.manufacturer} ${ram.type}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function searchSsdsByKeyword(keyword: string): SSDData[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return getAllSsds();

  return getAllSsds().filter((ssd) => {
    const haystack = `${ssd.model} ${ssd.manufacturer} ${ssd.deviceType}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export function getAllCpusSortedByCores(): CPUData[] {
  return getAllCpus().sort((a, b) => {
    if (b.cores !== a.cores) {
      return b.cores - a.cores;
    }

    return b.threads - a.threads;
  });
}

export function getAllRamsSortedBySpeed(): RAMData[] {
  return getAllRams().sort((a, b) => {
    if (b.speedMtps !== a.speedMtps) {
      return b.speedMtps - a.speedMtps;
    }

    return b.capacityGb - a.capacityGb;
  });
}

export function getAllSsdsSortedByReadSpeed(): SSDData[] {
  return getAllSsds().sort((a, b) => {
    if (b.readSpeedMbps !== a.readSpeedMbps) {
      return b.readSpeedMbps - a.readSpeedMbps;
    }

    return b.writeSpeedMbps - a.writeSpeedMbps;
  });
}
