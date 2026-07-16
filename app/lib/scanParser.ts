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

/**
 * 최신 Windows(11 24H2+, wmic 제거) 대응 1차 안내 명령 — "명령어 복사하기" 버튼이 복사하는 값.
 * GPU는 이 명령으로 조회하지 않는다 — 브라우저 WebGL 자동감지(GpuAutoDetect)가 이미 처리하므로
 * CPU/SSD/RAM만 읽는다. RAM은 PowerShell 쪽에서 총용량·개당용량·개수·규격·속도·제조사까지 미리
 * 계산해 "Total {N} GB ({M}GB x {K}ea / {규격} {속도}MHz / {제조사})" 한 줄로 출력한다 —
 * parseSpecOutput()이 이 한 줄만 정규식으로 읽으면 되므로 원문 전체를 바이트 단위로 스캔하던
 * 예전 방식보다 훨씬 정확하다.
 */
export const powerShellScanCommand =
  "Write-Host 'CPU:'; Get-CimInstance Win32_Processor | % Name; Write-Host '`nSSD:'; Get-CimInstance Win32_DiskDrive | % Model; Write-Host '`nRAM:'; $m = Get-CimInstance Win32_PhysicalMemory; $count = $m.Count; $cap = [Math]::Round(($m | Measure-Object Capacity -Sum).Sum / 1GB); $each = [Math]::Round($m[0].Capacity / 1GB); $speed = $m[0].ConfiguredClockSpeed; $mfg = $m[0].Manufacturer; $v = $m[0].SMBIOSMemoryType; $ddr = switch($v){26{'DDR4'} 34{'DDR5'} default{'DDR3 or Older'}}; Write-Host ('Total ' + $cap + ' GB (' + $each + 'GB x ' + $count + 'ea / ' + $ddr + ' ' + $speed + 'MHz / ' + $mfg + ')' )";

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
  /** RAM 슬롯 용량이 서로 달라(예: 8GB+16GB 혼합) 총용량=개당×개수가 안 맞는 경우 — 이때는
   *  ramCapacity/ramDetail을 자동 확정하지 않고 이 플래그로 "직접 입력해 주세요" 안내를 띄운다. */
  ramMismatch: boolean;
  /** CPU 원문에 "Laptop"/"Mobile" 키워드가 포함되어 있으면(노트북 사양) true — 등록은 막지 않고 안내만 한다. */
  cpuIsLaptop: boolean;
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

interface NewFormatSections {
  cpuLine: string | null;
  ssdLines: string[];
  ramLine: string | null;
}

/** RAM 요약 한 줄 "Total {N} GB ({M}GB x {K}ea / {규격} {속도}MHz / {제조사})" 파싱 결과. */
interface ParsedRamSummary {
  totalGb: number;
  eachGb: number;
  count: number;
  ddrLabel: string;
  speed: number;
  manufacturer: string;
}

const RAM_TOTAL_LINE_PATTERN = /^Total\s+(\d+)\s*GB\s*\(\s*(\d+)\s*GB\s*x\s*(\d+)\s*ea\s*\/\s*(.+?)\s+(\d+)\s*MHz\s*\/\s*(.+?)\s*\)$/i;

/**
 * "CPU:"/"SSD:"/"RAM:" 헤더 기반 새 포맷(powerShellScanCommand)을 감지해 섹션별 원문을 뽑는다.
 * "CPU:" 헤더 자체가 없으면 새 포맷이 아니라고 보고 null을 반환해 레거시 파싱 경로로 넘긴다.
 */
function extractNewFormatSections(rawText: string): NewFormatSections | null {
  const lines = rawText.split(/\r?\n/).map((line) => line.trim());
  const headerIndex = (label: string) => lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());

  const cpuIdx = headerIndex("CPU:");
  if (cpuIdx === -1) return null;

  const ssdIdx = headerIndex("SSD:");
  const ramIdx = headerIndex("RAM:");

  const cpuLine = lines.slice(cpuIdx + 1).find((line) => line !== "") ?? null;

  let ssdLines: string[] = [];
  if (ssdIdx !== -1) {
    const end = ramIdx !== -1 && ramIdx > ssdIdx ? ramIdx : lines.length;
    ssdLines = lines.slice(ssdIdx + 1, end).filter((line) => line !== "");
  }

  const ramLine = ramIdx !== -1 ? (lines.slice(ramIdx + 1).find((line) => line !== "") ?? null) : null;

  return { cpuLine, ssdLines, ramLine };
}

function parseRamTotalLine(ramLine: string): ParsedRamSummary | null {
  const matched = ramLine.match(RAM_TOTAL_LINE_PATTERN);
  if (!matched) return null;

  return {
    totalGb: Number(matched[1]),
    eachGb: Number(matched[2]),
    count: Number(matched[3]),
    ddrLabel: matched[4].trim(),
    speed: Number(matched[5]),
    manufacturer: matched[6].trim(),
  };
}

function roundToRamBucket(totalGb: number): "8GB" | "16GB" | "32GB" | "64GB" | null {
  if (totalGb >= 64) return "64GB";
  if (totalGb >= 32) return "32GB";
  if (totalGb >= 16) return "16GB";
  if (totalGb > 0) return "8GB";
  return null;
}

function pickPreferredSsdLine(lines: string[]): string | undefined {
  const ssdLooking = lines.find((line) =>
    /ssd|nvme|m\.2|samsung|western|wd|hynix|crucial|kingston|p41|sn770|990|kc3000|m480/i.test(line)
  );
  return ssdLooking ?? lines[0];
}

export function parseSpecOutput(rawText: string): ParseCommandOutputResult {
  const lowerRaw = rawText.toLowerCase();
  const normalized = normalizeText(rawText);
  const nameSections = extractNameSections(rawText);
  // "CPU:"/"SSD:"/"RAM:" 헤더 새 포맷이 있으면 그쪽을 우선하고, 없으면(구버전 wmic/PowerShell
  // "Name" 헤더 포맷) 레거시 경로로 자연스럽게 폴백한다.
  const newFormatSections = extractNewFormatSections(rawText);
  const cpuRaw = newFormatSections?.cpuLine ?? nameSections[0] ?? null;
  const gpuRaw = nameSections[1] ?? null;
  const cpuIsLaptop = cpuRaw ? /\b(laptop|mobile)\b/i.test(cpuRaw) : false;

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

  // RAM 용량 바이트 스캔(레거시 wmic/PowerShell "Name" 포맷용) — 상한을 128GB(단일 DIMM 상한급)로
  // 좁혀 SSD/HDD 용량(보통 150GB+)과의 오검출 충돌을 줄인다(예: 256GB SSD ≈ 274,877,906,944바이트가
  // 예전 상한 300GB 안에 들어와 RAM으로 잘못 집계되던 문제).
  const memoryCapacities = [...rawText.matchAll(/\b(\d{9,13})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 1_000_000_000 && value <= 137_438_953_472);
  const totalMemoryBytes = memoryCapacities.reduce((sum, value) => sum + value, 0);
  const totalMemoryGb = totalMemoryBytes > 0 ? Math.max(4, Math.round(totalMemoryBytes / 1024 / 1024 / 1024)) : 0;
  const legacyRamCapacity = roundToRamBucket(totalMemoryGb);
  const legacyRamModuleCount = memoryCapacities.length > 0 ? memoryCapacities.length : null;

  const speedMatch = rawText.match(/\b(3200|3600|4800|5200|5600|6000|6400|7200)\b/);
  const speedValue = speedMatch ? Number(speedMatch[1]) : null;
  const guessedDdr = speedValue && speedValue >= 4800 ? "DDR5" : speedValue ? "DDR4" : null;
  const legacyRamDetail = legacyRamCapacity
    ? `${legacyRamCapacity}${guessedDdr ? ` ${guessedDdr}` : ""}${speedValue ? `-${speedValue}` : ""}${legacyRamModuleCount && legacyRamModuleCount > 1 ? ` x${legacyRamModuleCount}` : ""}`
    : null;

  // 새 포맷("RAM:" 헤더 + "Total N GB (MGB x Kea / 규격 속도MHz / 제조사)" 한 줄)을 우선 사용한다.
  const parsedRamSummary = newFormatSections?.ramLine ? parseRamTotalLine(newFormatSections.ramLine) : null;
  const ramMismatch = parsedRamSummary ? parsedRamSummary.eachGb * parsedRamSummary.count !== parsedRamSummary.totalGb : false;

  const parsedRamCapacity = parsedRamSummary ? (ramMismatch ? null : roundToRamBucket(parsedRamSummary.totalGb)) : legacyRamCapacity;
  const ramModuleCount = parsedRamSummary ? (ramMismatch ? null : parsedRamSummary.count) : legacyRamModuleCount;
  const ramDetail = parsedRamSummary
    ? ramMismatch
      ? null
      : `${parsedRamSummary.eachGb}GB x${parsedRamSummary.count} / ${parsedRamSummary.ddrLabel} ${parsedRamSummary.speed}MHz`
    : legacyRamDetail;

  const preferredSsdLine = newFormatSections
    ? pickPreferredSsdLine(newFormatSections.ssdLines)
    : rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => /ssd|nvme|m\.2|samsung|western|wd|hynix|crucial|kingston|p41|sn770|990|kc3000|m480/i.test(line));

  const preferredSsdText = preferredSsdLine ?? rawText;
  const normalizedPreferredSsdText = normalizeText(preferredSsdText);
  // 브랜드명만 일치해도 "매칭"으로 치면(예: "Samsung SSD 970 EVO Plus 500GB") 카탈로그의 첫 번째
  // Samsung 항목("990 Pro 1TB" 등 전혀 다른 모델)으로 잘못 확정되는 버그가 있었다 — 브랜드 뒤에
  // "SSD"/"NVMe" 같은 단어가 끼어들어 모델 전체 문자열 매칭은 실패하면서도, 브랜드만으로는
  // 통과되던 것. 이제 모델명 전체가 통으로 들어있거나(원래 로직), 브랜드+모델의 "브랜드를 뺀
  // 나머지 식별 부분"(제품라인+용량)이 원문에 함께 들어있어야만 매칭으로 인정한다.
  const matchedSsd = masterSsdCatalog.find((item) => {
    const normalizedModel = normalizeText(item.model);
    if (normalizedPreferredSsdText.includes(normalizedModel)) return true;

    const normalizedBrand = normalizeText(item.manufacturer);
    const modelTail = item.model.startsWith(item.manufacturer) ? item.model.slice(item.manufacturer.length).trim() : item.model;
    const normalizedModelTail = normalizeText(modelTail);
    return (
      normalizedModelTail.length > 0 &&
      normalizedPreferredSsdText.includes(normalizedBrand) &&
      normalizedPreferredSsdText.includes(normalizedModelTail)
    );
  });

  const diskSizes = [...rawText.matchAll(/\b(\d{11,14})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 150_000_000_000);
  const largestDiskBytes = diskSizes.length > 0 ? Math.max(...diskSizes) : 0;

  // 새 포맷의 SSD 모델명엔 용량이 바이트가 아니라 텍스트로 박혀 있다(예: "...970 EVO Plus 500GB") —
  // 큐레이션 카탈로그에 없는 모델이어도 이 텍스트만으로 용량 등급을 추정할 수 있다.
  const ssdLineSizeMatch = preferredSsdLine?.match(/(\d+(?:\.\d+)?)\s*(TB|GB)\b/i);
  const ssdLineSizeGb = ssdLineSizeMatch
    ? Number(ssdLineSizeMatch[1]) * (ssdLineSizeMatch[2].toUpperCase() === "TB" ? 1000 : 1)
    : 0;

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
            : ssdLineSizeGb >= 1800
              ? "2TB"
              : ssdLineSizeGb >= 900
                ? "1TB"
                : ssdLineSizeGb >= 450
                  ? "512GB"
                  : ssdLineSizeGb > 0
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

  // 480/540Hz 같은 최신 고주사율 패널까지 인식 범위를 넓힌다. 200처럼 표준 단계가 아닌 값이
  // 잡혀도 호출부(resolveScanUpdates)가 가장 가까운 표준 단계로 맞추므로 그대로 둔다.
  const refreshMatch = rawText.match(/\b(60|75|100|120|144|165|180|200|240|360|480|540)\s*hz\b/i);
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
    ramMismatch,
    cpuIsLaptop,
  };
}

/** @deprecated parseSpecOutput()을 쓰세요 — 기존 호출부 하위 호환용으로만 유지. */
export const parseCommandOutput = parseSpecOutput;
