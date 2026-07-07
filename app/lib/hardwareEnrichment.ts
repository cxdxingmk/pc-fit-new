/**
 * 세대(generation) 기반 규칙으로 소켓/DDR/PCIe 등 호환성 필드를 추론한다.
 * src/constants/hardwareData.ts의 물리 사양(cores/threads/clock/releaseYear)에는
 * 이 필드들이 아예 없기 때문에, app/database/motherboard.ts가 요구하는 형태로
 * 보완해야 recommend()의 소켓/DDR 호환성 필터가 정상 동작한다.
 *
 * 여기서 나온 값은 전부 "세대 규칙 추론값"이며 제조사 스펙 원문 대조가 아니다.
 * Threadripper/PRO OEM SKU 등 세대 내에서도 소켓이 갈리는 라인업은 최대한 반영했지만,
 * 100% 정확을 보장하지 않으므로 신규 모델 편입 전 주기적 재검증이 필요하다
 * (src/constants/hardwareData.ts 상단 주석의 ark_gapfill 재검증 권고와 동일한 성격).
 */

export type InferredCpuSocket = "AM4" | "AM5" | "LGA1700" | "LGA1851" | "TR4" | "sTRX4" | "sWRX8";

export interface CpuCompatFields {
  socket: InferredCpuSocket;
  ddr: "DDR4" | "DDR5";
  pcie: "4.0" | "5.0";
  igpu: boolean;
  tdp: number;
  /** motherboard.ts가 지원하지 않는 소켓(Threadripper 계열 등)이라 추천 로직에 편입할 수 없음 */
  unsupportedSocket: boolean;
}

const AMD_APU_SUFFIX = /\d(GE|G)$/i;

function estimateTdp(cores: number, isLowPower: boolean, isFlagship: boolean): number {
  if (isLowPower) return Math.max(35, cores * 4);
  if (cores <= 4) return 65;
  if (cores <= 8) return isFlagship ? 120 : 65;
  if (cores <= 16) return isFlagship ? 125 : 105;
  return 170;
}

function inferAmdCpuCompat(model: string, cores: number): CpuCompatFields {
  const isThreadripper = /Threadripper/i.test(model);
  const isPro = /\bPRO\b/i.test(model);
  const isLowPower = /(T|TE|GE)$/i.test(model.trim()) && !/X$/i.test(model.trim());
  const isFlagship = /X3D$|X$/i.test(model.trim());
  const isApu = AMD_APU_SUFFIX.test(model.trim());

  const numberMatch = model.match(/(\d{4})/);
  const num = numberMatch ? parseInt(numberMatch[1], 10) : 0;
  const gen = Math.floor(num / 1000);

  if (isThreadripper) {
    if (gen === 1 || gen === 2) {
      return { socket: "TR4", ddr: "DDR4", pcie: "4.0", igpu: false, tdp: 180, unsupportedSocket: true };
    }
    if (isPro) {
      return { socket: "sWRX8", ddr: "DDR4", pcie: "4.0", igpu: false, tdp: 280, unsupportedSocket: true };
    }
    return { socket: "sTRX4", ddr: "DDR4", pcie: "4.0", igpu: false, tdp: 280, unsupportedSocket: true };
  }

  // Ryzen 1000/2000 (Zen1/Zen+, 2017-2019)
  if (gen === 1 || gen === 2) {
    return {
      socket: "AM4",
      ddr: "DDR4",
      pcie: "4.0",
      igpu: isApu,
      tdp: estimateTdp(cores, isLowPower, isFlagship),
      unsupportedSocket: false,
    };
  }

  // Ryzen 3000/4000/5000 (Zen2/Zen3, AM4) - non-APU desktop parts got PCIe4.0, APUs stayed PCIe3.0
  if (gen === 3 || gen === 4 || gen === 5) {
    return {
      socket: "AM4",
      ddr: "DDR4",
      pcie: isApu ? "4.0" : "4.0",
      igpu: isApu,
      tdp: estimateTdp(cores, isLowPower, isFlagship),
      unsupportedSocket: false,
    };
  }

  // Ryzen 7000/9000 (Zen4/Zen5, AM5) - platform-level iGPU on every desktop SKU
  if (gen === 7 || gen === 9) {
    return {
      socket: "AM5",
      ddr: "DDR5",
      pcie: "5.0",
      igpu: true,
      tdp: estimateTdp(cores, isLowPower, isFlagship),
      unsupportedSocket: false,
    };
  }

  // Unknown generation number -> flag for manual review, default to the safest legacy assumption
  return {
    socket: "AM4",
    ddr: "DDR4",
    pcie: "4.0",
    igpu: isApu,
    tdp: estimateTdp(cores, isLowPower, isFlagship),
    unsupportedSocket: false,
  };
}

function inferIntelCpuCompat(model: string, cores: number): CpuCompatFields {
  const trimmed = model.trim();
  const noIgpu = /F$/i.test(trimmed);
  const isLowPower = /(T|TE)$/i.test(trimmed);
  const isFlagship = /K$|KF$|KS$/i.test(trimmed);

  if (/Ultra/i.test(model)) {
    return {
      socket: "LGA1851",
      ddr: "DDR5",
      pcie: "5.0",
      igpu: !noIgpu,
      tdp: estimateTdp(cores, isLowPower, isFlagship),
      unsupportedSocket: false,
    };
  }

  // 12/13/14세대(Alder/Raptor Lake) 전부 - 이 앱은 이미 기존 curated 데이터에서
  // DDR4 보드 옵션을 생략하고 DDR5/PCIe5.0로 단순화해서 다뤄왔으므로 그 관례를 따른다.
  return {
    socket: "LGA1700",
    ddr: "DDR5",
    pcie: "5.0",
    igpu: !noIgpu,
    tdp: estimateTdp(cores, isLowPower, isFlagship),
    unsupportedSocket: false,
  };
}

export function inferCpuCompatFields(model: string, cores: number): CpuCompatFields {
  if (/^AMD/i.test(model) || /Ryzen/i.test(model)) {
    return inferAmdCpuCompat(model, cores);
  }
  return inferIntelCpuCompat(model, cores);
}

export interface GpuCompatFields {
  memoryType: string;
  pcie: "3.0" | "4.0" | "5.0";
  dlss: boolean;
  fsr: boolean;
  xess: boolean;
  rayTracing: boolean;
  tgp: number;
}

function estimateTgp(cudaOrStreamCores: number, vramGb: number): number {
  return Math.max(50, Math.round(cudaOrStreamCores / 22 + vramGb * 4));
}

function inferNvidiaGpuCompat(model: string, cudaOrStreamCores: number, vramGb: number): GpuCompatFields {
  const tgp = estimateTgp(cudaOrStreamCores, vramGb);
  if (/RTX 50/i.test(model)) return { memoryType: "GDDR7", pcie: "5.0", dlss: true, fsr: false, xess: false, rayTracing: true, tgp };
  if (/RTX 40/i.test(model)) return { memoryType: "GDDR6X", pcie: "4.0", dlss: true, fsr: false, xess: false, rayTracing: true, tgp };
  if (/RTX 30/i.test(model)) return { memoryType: "GDDR6X", pcie: "4.0", dlss: true, fsr: false, xess: false, rayTracing: true, tgp };
  if (/RTX 20/i.test(model)) return { memoryType: "GDDR6", pcie: "3.0", dlss: true, fsr: false, xess: false, rayTracing: true, tgp };
  if (/GTX 16/i.test(model)) return { memoryType: "GDDR6", pcie: "3.0", dlss: false, fsr: false, xess: false, rayTracing: false, tgp };
  // GTX 10 시리즈 및 그 이전
  return { memoryType: "GDDR5", pcie: "3.0", dlss: false, fsr: false, xess: false, rayTracing: false, tgp };
}

function inferAmdGpuCompat(model: string, cudaOrStreamCores: number, vramGb: number): GpuCompatFields {
  const tgp = estimateTgp(cudaOrStreamCores, vramGb);
  // "RX 5" 같은 접두사 정규식은 3자리(RX 550 등 구형 Polaris)와 4자리(RX 5700 등 RDNA1)를
  // 구분하지 못해 오분류가 나므로, 숫자를 통째로 뽑아 값으로 구간을 나눈다.
  const numberMatch = model.match(/RX\s?(\d{3,4})/i);
  const num = numberMatch ? parseInt(numberMatch[1], 10) : 0;

  if (num >= 7000) {
    return { memoryType: "GDDR6", pcie: num >= 7900 ? "5.0" : "4.0", dlss: false, fsr: true, xess: false, rayTracing: true, tgp };
  }
  if (num >= 6000) return { memoryType: "GDDR6", pcie: "4.0", dlss: false, fsr: true, xess: false, rayTracing: true, tgp };
  if (num >= 5000) return { memoryType: "GDDR6", pcie: "4.0", dlss: false, fsr: true, xess: false, rayTracing: false, tgp };
  // RX 400/500 시리즈(Polaris) 및 Vega(숫자 매칭 안 됨) - 구형, PCIe 3.0/GDDR5
  return { memoryType: "GDDR5", pcie: "3.0", dlss: false, fsr: true, xess: false, rayTracing: false, tgp };
}

function inferIntelGpuCompat(cudaOrStreamCores: number, vramGb: number): GpuCompatFields {
  return {
    memoryType: "GDDR6",
    pcie: "4.0",
    dlss: false,
    fsr: false,
    xess: true,
    rayTracing: true,
    tgp: estimateTgp(cudaOrStreamCores, vramGb),
  };
}

export function inferGpuCompatFields(
  model: string,
  manufacturer: "NVIDIA" | "AMD" | "Intel",
  cudaOrStreamCores: number,
  vramGb: number
): GpuCompatFields {
  if (manufacturer === "NVIDIA") return inferNvidiaGpuCompat(model, cudaOrStreamCores, vramGb);
  if (manufacturer === "AMD") return inferAmdGpuCompat(model, cudaOrStreamCores, vramGb);
  return inferIntelGpuCompat(cudaOrStreamCores, vramGb);
}

/**
 * curated 항목과 신규 항목이 "같은 물리 부품"인지 판정하기 위한 키.
 * curated 카탈로그의 id 표기 관례가 제각각이라(예: "gtx1660" 하이픈 없음, "rtx4070-super" 일부만 하이픈,
 * "arca380" 아예 없음) slugifyHardwareModel()이 만드는 새 id와 문자열이 우연히 일치하지 않는 경우가 많다.
 * id끼리 비교하면 이런 케이스에서 중복 판정에 실패해 같은 부품이 두 번 들어가므로, 반드시 이 함수로
 * 정규화한 "이름"끼리 비교해야 한다.
 */
export function normalizeModelKey(text: string): string {
  return text
    .replace(/^AMD\s+/i, "")
    .replace(/^NVIDIA\s+/i, "")
    .replace(/^Intel\s+/i, "")
    .replace(/GeForce\s+/i, "")
    .replace(/Radeon\s+/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** 기존 curated 카탈로그의 id 표기 관례(예: "i5-14600k", "rtx4070-super")와 충돌하지 않는 새 id를 만든다. */
export function slugifyHardwareModel(model: string): string {
  return model
    .replace(/^AMD\s+/i, "")
    .replace(/^NVIDIA\s+/i, "")
    .replace(/^Intel\s+/i, "")
    .replace(/GeForce\s+/i, "")
    .replace(/Radeon\s+/i, "")
    .replace(/Ryzen\s+/i, "r")
    .replace(/Core\s+/i, "")
    .replace(/Threadripper\s+/i, "tr-")
    .replace(/PRO\s+/i, "pro-")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
