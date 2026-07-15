// CMD/PowerShell 스캔 결과 텍스트를 파싱하는 순수 로직.
// 원래 components/PcScannerModal.tsx 안에 있었는데, register-pc 페이지가 "모달 컴포넌트 파일"에서
// 함수를 import해다 쓰는 형태라 모달은 UI만, 파싱은 여기서 담당하도록 분리했다.
//
// Windows 11 24H2부터 wmic이 기본 제거되어 PowerShell(Get-CimInstance)을 1차 안내 명령으로 쓴다.
// parseSpecOutput()은 두 출력 포맷을 모두 받아들인다 — CPU/GPU 이름은 "Name" 헤더 다음 줄을 그대로
// 뽑아 카탈로그와 매칭하고(포맷과 무관), 메인보드 칩셋/RAM·디스크 용량은 원문 전체에서 정규식으로
// 값 자체를 찾기 때문에(wmic·PowerShell 표 형식 차이에 영향받지 않음) 포맷 분기 코드가 따로 필요 없다.
import { HARDWARE_MASTER, findMasterMatch } from "../data/hardwareMaster";
import { motherboards } from "../database/motherboard";
import { matchCpuToDb } from "./cpuMatch";
import { matchGpuToDb } from "./gpuMatch";
import { getAllSsds } from "../../src/utils/hardwareLookup";

/** 최신 Windows(11 24H2+, wmic 제거) 대응 1차 안내 명령 — "명령어 복사하기" 버튼이 복사하는 값. */
export const powerShellScanCommand =
  'powershell -NoProfile -Command "Get-CimInstance Win32_Processor | Select-Object Name; Get-CimInstance Win32_VideoController | Select-Object Name; Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product; Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity,Speed; Get-CimInstance Win32_DiskDrive | Select-Object Model,Size"';

/** 구버전 Windows(wmic 제거 전)용 — "구버전 Windows는 이 명령" 접기 섹션에서만 노출. */
export const legacyWmicScanCommand =
  "wmic cpu get name & wmic path win32_VideoController get name & wmic baseboard get product,Manufacturer & wmic memorychip get capacity,speed & wmic diskdrive get model,size";

/** @deprecated powerShellScanCommand를 쓰세요 — 기존 호출부 하위 호환용으로만 유지. */
export const wmiScanCommand = legacyWmicScanCommand;

export interface ParseCommandOutputResult {
  cpuId: string | null;
  gpuId: string | null;
  motherboardChipset: string | null;
  ramCapacity: "8GB" | "16GB" | "32GB" | "64GB" | null;
  ramDetail: string | null;
  /** RAM 용량 라인이 몇 개 인식됐는지(예: 8GB짜리 2개 → 2) — "16GB x2" 같은 표시에 사용 */
  ramModuleCount: number | null;
  ssdCapacity: "256GB" | "512GB" | "1TB" | "2TB" | null;
  ssdDetail: string | null;
  monitorResolution: "FHD" | "QHD" | "4K" | null;
  monitorRefreshRate: number | null;
  cpuLabel: string | null;
  gpuLabel: string | null;
  /** 카탈로그 매칭에 실패했을 때도 원문을 잃지 않도록 보존(인라인 에러 표시용) */
  cpuRaw: string | null;
  gpuRaw: string | null;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const masterSsdCatalog = getAllSsds();

function motherboardChipsetFromText(text: string): string | null {
  const found = motherboards.find((board) => text.toLowerCase().includes(board.chipset.toLowerCase()));
  return found?.chipset ?? null;
}

/**
 * "Name" 헤더 다음에 오는 실제 값 줄을 순서대로 뽑는다 — wmic("Name\n실제값")과
 * PowerShell(기본 테이블 포맷 "Name\n----\n실제값") 둘 다 지원한다. Win32_Processor를
 * 먼저 조회하는 명령 순서를 그대로 따르므로 0번째=CPU, 1번째=GPU.
 */
function extractNameSections(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim());
  const values: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase() !== "name") continue;
    let j = i + 1;
    if (j < lines.length && /^-+$/.test(lines[j])) j++; // PowerShell 밑줄(----) 스킵
    while (j < lines.length && lines[j] === "") j++; // 빈 줄 스킵
    if (j < lines.length && lines[j] !== "") values.push(lines[j]);
  }

  return values;
}

export function parseSpecOutput(rawText: string): ParseCommandOutputResult {
  const lowerRaw = rawText.toLowerCase();
  const normalized = normalizeText(rawText);
  const nameSections = extractNameSections(rawText);
  const cpuRaw = nameSections[0] ?? null;
  const gpuRaw = nameSections[1] ?? null;

  // 1) 카탈로그 전체 대상 매칭(cpuMatch.ts/gpuMatch.ts — 큐레이션 키워드 → 토큰 유사도 2단계).
  //    "Name" 섹션을 못 뽑았으면(포맷이 완전히 다른 텍스트 등) 원문 전체를 대상으로 폴백.
  const cpuMatch = matchCpuToDb(cpuRaw ?? rawText);
  const gpuMatch = matchGpuToDb(gpuRaw ?? rawText);

  // 2) 그래도 실패하면 브랜드만이라도 잡아주는 최후 폴백(기존 동작 유지) — 매칭 실패 시엔
  //    cpuRaw/gpuRaw로 원문이 그대로 보존되므로, 이 폴백은 "완전히 빈손"만 막는 최소 안전망이다.
  const fallbackCpu = !cpuMatch.matched
    ? normalized.includes("intel")
      ? { id: "i5-14400f", label: "Core i5-14400F" }
      : normalized.includes("ryzen") || normalized.includes("amd")
        ? { id: "r7-9700x", label: "Ryzen 7 9700X" }
        : null
    : null;

  const fallbackGpu = !gpuMatch.matched
    ? /(rtx|nvidia)/i.test(lowerRaw)
      ? { id: "rtx4060", label: "GeForce RTX 4060" }
      : /gtx/i.test(lowerRaw)
        ? { id: "gtx1660", label: "GeForce GTX 1660" }
        : null
    : null;

  const matchedBoard = findMasterMatch(HARDWARE_MASTER.MAINBOARD, rawText);
  const extractedBoardFromMaster = matchedBoard
    ? (matchedBoard.matchKeywords.find((keyword) => /[zxbah]\d{3}/i.test(keyword)) ?? matchedBoard.name.match(/[zxbah]\d{3}/i)?.[0] ?? null)
    : null;

  // 최근/구형 세대 칩셋을 폭넓게 커버(기존엔 일부 세대만 있어 실매칭률이 낮았다).
  const chipsetMatch = rawText.match(
    /(Z890|Z790|Z690|Z590|B860|B760|B660|B560|H770|H610|H510|X870|X670|X570|B650|B550|B450|A620|A520)/i
  );

  // RAM 용량 바이트 스캔 — 상한을 128GB(단일 DIMM 상한급)로 좁혀 SSD/HDD 용량(보통 150GB+)과의
  // 오검출 충돌을 줄인다(예: 256GB SSD ≈ 274,877,906,944바이트가 예전 상한 300GB 안에 들어와
  // RAM으로 잘못 집계되던 문제).
  const memoryCapacities = [...rawText.matchAll(/\b(\d{9,13})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 1_000_000_000 && value <= 137_438_953_472);
  const totalMemoryBytes = memoryCapacities.reduce((sum, value) => sum + value, 0);
  const totalMemoryGb = totalMemoryBytes > 0 ? Math.max(4, Math.round(totalMemoryBytes / 1024 / 1024 / 1024)) : 0;
  const parsedRamCapacity = totalMemoryGb >= 64 ? "64GB" : totalMemoryGb >= 32 ? "32GB" : totalMemoryGb >= 16 ? "16GB" : totalMemoryGb > 0 ? "8GB" : null;
  const ramModuleCount = memoryCapacities.length > 0 ? memoryCapacities.length : null;

  const speedMatch = rawText.match(/\b(3200|3600|4800|5200|5600|6000|6400|7200)\b/);
  const speedValue = speedMatch ? Number(speedMatch[1]) : null;
  const guessedDdr = speedValue && speedValue >= 4800 ? "DDR5" : speedValue ? "DDR4" : null;
  const ramDetail = parsedRamCapacity
    ? `${parsedRamCapacity}${guessedDdr ? ` ${guessedDdr}` : ""}${speedValue ? `-${speedValue}` : ""}${ramModuleCount && ramModuleCount > 1 ? ` x${ramModuleCount}` : ""}`
    : null;

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
    cpuId: cpuMatch.matched?.id ?? fallbackCpu?.id ?? null,
    gpuId: gpuMatch.matched?.id ?? fallbackGpu?.id ?? null,
    motherboardChipset,
    ramCapacity: parsedRamCapacity,
    ramDetail,
    ramModuleCount,
    ssdCapacity: parsedSsdCapacity,
    ssdDetail: parsedSsdDetail,
    monitorResolution,
    monitorRefreshRate,
    cpuLabel: cpuMatch.matched?.name ?? fallbackCpu?.label ?? null,
    gpuLabel: gpuMatch.matched?.name ?? fallbackGpu?.label ?? null,
    cpuRaw,
    gpuRaw,
  };
}

/** @deprecated parseSpecOutput()을 쓰세요 — 기존 호출부 하위 호환용으로만 유지. */
export const parseCommandOutput = parseSpecOutput;
