// CMD(wmic) 스캔 결과 텍스트를 파싱하는 순수 로직.
// 원래 components/PcScannerModal.tsx 안에 있었는데, register-pc 페이지가 "모달 컴포넌트 파일"에서
// 함수를 import해다 쓰는 형태라 모달은 UI만, 파싱은 여기서 담당하도록 분리했다.
import { HARDWARE_MASTER, findMasterMatch } from "../data/hardwareMaster";
import { motherboards } from "../database/motherboard";
import { getAllSsds } from "../../src/utils/hardwareLookup";

export const wmiScanCommand =
  "wmic cpu get name & wmic path win32_VideoController get name & wmic baseboard get product,Manufacturer & wmic memorychip get capacity,speed & wmic diskdrive get model,size";

export interface ParseCommandOutputResult {
  cpuId: string | null;
  gpuId: string | null;
  motherboardChipset: string | null;
  ramCapacity: "8GB" | "16GB" | "32GB" | "64GB" | null;
  ramDetail: string | null;
  ssdCapacity: "256GB" | "512GB" | "1TB" | "2TB" | null;
  ssdDetail: string | null;
  monitorResolution: "FHD" | "QHD" | "4K" | null;
  monitorRefreshRate: number | null;
  cpuLabel: string | null;
  gpuLabel: string | null;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const masterSsdCatalog = getAllSsds();

function motherboardChipsetFromText(text: string): string | null {
  const found = motherboards.find((board) => text.toLowerCase().includes(board.chipset.toLowerCase()));
  return found?.chipset ?? null;
}

export function parseCommandOutput(rawText: string): ParseCommandOutputResult {
  const lowerRaw = rawText.toLowerCase();
  const normalized = normalizeText(rawText);
  const matchedCpu = findMasterMatch(HARDWARE_MASTER.CPU, rawText);
  const matchedGpu = findMasterMatch(HARDWARE_MASTER.GPU, rawText);
  const matchedBoard = findMasterMatch(HARDWARE_MASTER.MAINBOARD, rawText);

  const fallbackCpu = !matchedCpu
    ? normalized.includes("intel")
      ? { id: "i5-14400f", label: "Core i5-14400F" }
      : normalized.includes("ryzen")
        ? { id: "r7-9700x", label: "Ryzen 7 9700X" }
        : null
    : null;

  const fallbackGpu = !matchedGpu
    ? /(rtx|nvidia)/i.test(lowerRaw)
      ? { id: "rtx4060", label: "GeForce RTX 4060" }
      : /gtx/i.test(lowerRaw)
        ? { id: "gtx1660", label: "GeForce GTX 1660" }
        : null
    : null;

  const extractedBoardFromMaster = matchedBoard
    ? (matchedBoard.matchKeywords.find((keyword) => /[zxbah]\d{3}/i.test(keyword)) ?? matchedBoard.name.match(/[zxbah]\d{3}/i)?.[0] ?? null)
    : null;

  const chipsetMatch = rawText.match(/(Z890|Z790|B860|B760|H610|X870|X670|B650|A620|B550)/i);

  const memoryCapacities = [...rawText.matchAll(/\b(\d{9,13})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 1_000_000_000 && value < 300_000_000_000);
  const totalMemoryBytes = memoryCapacities.reduce((sum, value) => sum + value, 0);
  const totalMemoryGb = totalMemoryBytes > 0 ? Math.max(4, Math.round(totalMemoryBytes / 1024 / 1024 / 1024)) : 0;
  const parsedRamCapacity = totalMemoryGb >= 64 ? "64GB" : totalMemoryGb >= 32 ? "32GB" : totalMemoryGb >= 16 ? "16GB" : totalMemoryGb > 0 ? "8GB" : null;

  const speedMatch = rawText.match(/\b(3200|3600|4800|5200|5600|6000|6400|7200)\b/);
  const speedValue = speedMatch ? Number(speedMatch[1]) : null;
  const guessedDdr = speedValue && speedValue >= 4800 ? "DDR5" : speedValue ? "DDR4" : null;
  const ramDetail = parsedRamCapacity ? `${parsedRamCapacity}${guessedDdr ? ` ${guessedDdr}` : ""}${speedValue ? `-${speedValue}` : ""}` : null;

  const preferredSsdLine = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => /ssd|nvme|m\.2|samsung|western|wd|hynix|crucial|kingston|p41|sn770|990|kc3000|m480/i.test(line));

  const preferredSsdText = preferredSsdLine ?? rawText;
  const normalizedPreferredSsdText = normalizeText(preferredSsdText);
  const matchedSsd = masterSsdCatalog.find((item) => {
    const normalizedModel = normalizeText(item.model);
    const normalizedBrand = normalizeText(item.manufacturer);
    return normalizedPreferredSsdText.includes(normalizedModel) || normalizedPreferredSsdText.includes(normalizedBrand);
  });

  const diskSizes = [...rawText.matchAll(/\b(\d{11,14})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 150_000_000_000);
  const largestDiskBytes = diskSizes.length > 0 ? Math.max(...diskSizes) : 0;

  const parsedSsdCapacity = matchedSsd
    ? matchedSsd.capacityGb >= 2000
      ? "2TB"
      : matchedSsd.capacityGb >= 1000
        ? "1TB"
        : matchedSsd.capacityGb >= 500
          ? "512GB"
          : "256GB"
    : largestDiskBytes >= 1_800_000_000_000
      ? "2TB"
      : largestDiskBytes >= 900_000_000_000
        ? "1TB"
        : largestDiskBytes >= 450_000_000_000
          ? "512GB"
          : largestDiskBytes > 0
            ? "256GB"
            : null;

  const parsedSsdDetail = matchedSsd?.model ?? preferredSsdLine ?? null;

  const resolutionMatch = rawText.match(/(3840\s*[xX]\s*2160|2560\s*[xX]\s*1440|1920\s*[xX]\s*1080)/i);
  const monitorResolution = resolutionMatch
    ? /3840/i.test(resolutionMatch[1])
      ? "4K"
      : /2560/i.test(resolutionMatch[1])
        ? "QHD"
        : "FHD"
    : null;

  const refreshMatch = rawText.match(/\b(60|75|100|120|144|165|180|200|240|360)\s*hz\b/i);
  const monitorRefreshRate = refreshMatch ? Number(refreshMatch[1]) : null;

  const motherboardChipset = chipsetMatch
    ? motherboardChipsetFromText(chipsetMatch[1])
    : extractedBoardFromMaster
      ? motherboardChipsetFromText(extractedBoardFromMaster)
      : motherboardChipsetFromText(rawText);

  return {
    cpuId: matchedCpu?.mappedId ?? fallbackCpu?.id ?? null,
    gpuId: matchedGpu?.mappedId ?? fallbackGpu?.id ?? null,
    motherboardChipset,
    ramCapacity: parsedRamCapacity,
    ramDetail,
    ssdCapacity: parsedSsdCapacity,
    ssdDetail: parsedSsdDetail,
    monitorResolution,
    monitorRefreshRate,
    cpuLabel: matchedCpu?.name ?? fallbackCpu?.label ?? null,
    gpuLabel: matchedGpu?.name ?? fallbackGpu?.label ?? null,
  };
}
