"use client";

import { useState } from "react";
import { HARDWARE_MASTER, findMasterMatch } from "../app/data/hardwareMaster";
import { motherboards } from "../app/database/motherboard";
import { ssds } from "../app/database/ssd";

export const wmiScanCommand = "wmic cpu get name & wmic path win32_VideoController get name & wmic baseboard get product,Manufacturer & wmic memorychip get capacity,speed & wmic diskdrive get model,size";

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

interface PcScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scanText: string;
  setScanText: (value: string) => void;
  onParsed: (result: ParseCommandOutputResult) => void;
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
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

  const matchedSsd = ssds.find((item) => {
    const name = item.name.toLowerCase();
    const brand = item.brand.toLowerCase();
    return (preferredSsdLine ?? lowerRaw).toLowerCase().includes(name.replace(/[^a-z0-9]/g, "")) || (preferredSsdLine ?? lowerRaw).toLowerCase().includes(brand);
  });

  const diskSizes = [...rawText.matchAll(/\b(\d{11,14})\b/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 150_000_000_000);
  const largestDiskBytes = diskSizes.length > 0 ? Math.max(...diskSizes) : 0;

  const parsedSsdCapacity = matchedSsd
    ? matchedSsd.capacity >= 2000
      ? "2TB"
      : matchedSsd.capacity >= 1000
        ? "1TB"
        : matchedSsd.capacity >= 500
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

  const parsedSsdDetail = matchedSsd?.name ?? preferredSsdLine ?? null;

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

function motherboardChipsetFromText(text: string): string | null {
  const found = motherboards.find((board) => text.toLowerCase().includes(board.chipset.toLowerCase()));
  return found?.chipset ?? null;
}

function StepBadge({ number }: { number: number }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-xl font-black text-slate-950 shadow-lg shadow-cyan-500/30">
      {number}
    </div>
  );
}

export default function PcScannerModal({ isOpen, onClose, scanText, setScanText, onParsed }: PcScannerModalProps) {
  const [copyDone, setCopyDone] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(wmiScanCommand);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 1600);
    } catch {
      setCopyDone(false);
    }
  };

  const handleParseAndApply = () => {
    const parsed = parseCommandOutput(scanText);
    onParsed(parsed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-5xl rounded-3xl border border-slate-700 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/60 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black leading-snug text-cyan-200 md:text-3xl">
            어려운 부품 이름은 몰라도 괜찮아요! 1분 만에 컴퓨터가 알아서 다 찾아드립니다 📋
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            닫기
          </button>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-start gap-4">
              <StepBadge number={1} />
              <div>
                <p className="text-lg font-extrabold leading-relaxed">
                  1. 키보드에서 윈도우 로고 키 + R을 같이 누른 후, 나오는 창에 cmd를 적고 엔터를 쳐주세요.
                </p>
                <p className="mt-3 text-base text-slate-300">화면에 검은색 창이 하나 뜨실 거예요!</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-start gap-4">
              <StepBadge number={2} />
              <div className="w-full">
                <p className="text-lg font-extrabold leading-relaxed">2. 아래 파란색 버튼을 눌러 명령어를 복사해 주세요.</p>
                <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-cyan-200">
                  {wmiScanCommand}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="mt-4 w-full rounded-2xl bg-cyan-500 px-5 py-4 text-lg font-black text-slate-950 transition hover:bg-cyan-400"
                >
                  내용 복사하기 📋
                </button>
                {copyDone ? <p className="mt-3 text-base font-semibold text-emerald-300">복사 완료!</p> : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 md:col-span-2">
            <div className="flex items-start gap-4">
              <StepBadge number={3} />
              <div>
                <p className="text-lg font-extrabold leading-relaxed">
                  3. 방금 켠 검은색 창에 마우스 우클릭을 하거나 Ctrl + V를 눌러 붙여넣고 엔터를 치세요.
                </p>
                <p className="mt-3 text-base text-slate-300">
                  그 다음, 검은 창에 나온 결과 글자들을 마우스로 싹 긁어서 복사(Ctrl + C)해 주세요.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 md:col-span-2">
            <div className="flex items-start gap-4">
              <StepBadge number={4} />
              <div className="w-full">
                <p className="text-lg font-extrabold leading-relaxed">4. 복사한 글자들을 아래 박스에 붙여넣어 주세요!</p>
                <textarea
                  value={scanText}
                  onChange={(event) => setScanText(event.target.value)}
                  placeholder="여기에 검은 창 결과 글자들을 붙여넣어 주세요 (Ctrl + V)"
                  className="mt-4 h-48 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-base text-slate-100 placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleParseAndApply}
          className="mt-7 w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-cyan-500 px-6 py-4 text-xl font-black text-slate-950 transition hover:brightness-110"
        >
          ✨ 내 컴퓨터 성능 확인하기
        </button>

        <p className="mt-3 text-center text-sm text-slate-400">
          버튼을 누르면 CPU, GPU, 메인보드, RAM, SSD를 자동 인식해서 한 번에 세팅합니다.
        </p>
      </div>
    </div>
  );
}
