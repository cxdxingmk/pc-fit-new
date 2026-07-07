"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { type ClipboardEvent, useEffect, useMemo, useState } from "react";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { useAuth } from "../../context/AuthContext";
import { useBuild } from "../../context/BuildContext";
import type { UserSavedPc } from "../../types/hardware";
import { HARDWARE_MASTER } from "../../data/hardwareMaster";
import { parseCommandOutput, wmiScanCommand, type ParseCommandOutputResult } from "../../lib/scanParser";
import { readJsonFromStorage, writeJsonToStorage } from "../../lib/localStorageJson";
import MyPageTabs from "../components/MyPageTabs";

const storageKey = "user_pc_spec";
const ramCapacityOptions = ["8GB", "16GB", "32GB", "64GB"] as const;
const ssdCapacityOptions = ["256GB", "512GB", "1TB", "2TB"] as const;
const monitorResolutionOptions = ["FHD", "QHD", "4K"] as const;
const motherboardSeriesOptions = ["Intel Z", "Intel B", "Intel H", "AMD X", "AMD B", "AMD A"] as const;
const motherboardBrandOptions = ["ASUS", "MSI", "GIGABYTE", "ASRock", "BIOSTAR", "기타"] as const;

type LocalSavedPc = UserSavedPc & {
  userId?: string;
  pcName?: string;
  createdAt?: string;
  ramCapacity: string;
  ramCount: number;
  ramDetailedInputEnabled: boolean;
  ramProductName: string;
  ssdCapacityOption: string;
  ssdDetailedInputEnabled: boolean;
  ssdProductName: string;
  mbSeries: string;
  mbDetail: string;
  mbBrand: string;
  mbModelName?: string;
  psuWatt?: string;
  hasCase?: boolean;
  commandScanRawText: string;
  monitorCount: number;
};

const initialSelection = {
  cpuId: cpus[0]?.id ?? "",
  gpuId: gpus[0]?.id ?? "",
  ramCapacity: "16GB",
  ramCount: 2,
  ramDetailedInputEnabled: false,
  ramProductName: "",
  mbSeries: "Intel B",
  mbDetail: "760",
  mbBrand: "ASUS",
  ssdCapacityOption: "1TB",
  ssdDetailedInputEnabled: false,
  ssdProductName: "",
  psuWatt: "850W",
  hasCase: true,
  monitorResolution: "QHD" as const,
  monitorRefreshRate: 144,
  monitorCount: 1,
  commandScanRawText: "",
};

function parseRamCapacityToGb(value: string): number {
  const matched = value.match(/(\d+)/);
  return matched ? Number(matched[1]) : 0;
}

type ScanDerivedState = {
  cpu: string;
  gpu: string;
  ramCapacity: string;
  ramProductName: string;
  ramDetailedInputEnabled: boolean;
  ssdCapacityOption: string;
  ssdProductName: string;
  ssdDetailedInputEnabled: boolean;
  mbSeries: string;
  mbDetail: string;
  monitorResolution: (typeof monitorResolutionOptions)[number];
  monitorRefreshRate: number;
};

// 스캔 결과에서 다음 상태값을 한 번에 파생시키는 순수 함수.
// 예전에는 각 setState 호출 직후 "방금 세팅한 값"을 별도의 let 변수에 다시 대입해가며
// (setState는 비동기라 즉시 읽을 수 없으니) 흉내 내는 방식이었는데, 그 대신 여기서 값을
// 전부 계산해서 반환하면 호출부는 setState와 payload 조립에 항상 이 값만 쓰면 된다.
function resolveScanUpdates(
  result: ParseCommandOutputResult,
  current: ScanDerivedState
): { next: ScanDerivedState; message: string } {
  const next: ScanDerivedState = { ...current };
  const messages: string[] = [];

  if (result.cpuId && cpus.some((item) => item.id === result.cpuId)) {
    next.cpu = result.cpuId;
    messages.push(`CPU 자동 감지: ${result.cpuLabel ?? result.cpuId}`);
  }

  if (result.gpuId && gpus.some((item) => item.id === result.gpuId)) {
    next.gpu = result.gpuId;
    messages.push(`GPU 자동 감지: ${result.gpuLabel ?? result.gpuId}`);
  }

  if (result.motherboardChipset) {
    const normalized = result.motherboardChipset.trim().toUpperCase();
    const matched = normalized.match(/^([ZXBHA])\s*[- ]?(\d{3,4})$/i);
    if (matched) {
      const alpha = matched[1].toUpperCase();
      const vendor = alpha === "X" || alpha === "A" ? "AMD" : "Intel";
      next.mbSeries = `${vendor} ${alpha}`;
      next.mbDetail = matched[2];
    } else {
      next.mbDetail = result.motherboardChipset;
    }
    messages.push(`메인보드 자동 감지: ${result.motherboardChipset}`);
  }

  if (result.ramCapacity) {
    next.ramCapacity = result.ramCapacity;
    messages.push(`RAM 자동 감지: ${result.ramCapacity}`);
  }

  if (result.ramDetail) {
    next.ramDetailedInputEnabled = true;
    next.ramProductName = result.ramDetail;
  }

  if (result.ssdCapacity) {
    next.ssdCapacityOption = result.ssdCapacity;
    messages.push(`SSD 자동 감지: ${result.ssdCapacity}`);
  }

  if (result.ssdDetail) {
    next.ssdDetailedInputEnabled = true;
    next.ssdProductName = result.ssdDetail;
  }

  if (result.monitorResolution) {
    next.monitorResolution = result.monitorResolution;
  }

  if (result.monitorRefreshRate) {
    next.monitorRefreshRate = result.monitorRefreshRate;
  }

  const message =
    messages.length > 0
      ? messages.join(" / ")
      : !result.cpuId && !result.gpuId && !result.motherboardChipset && !result.ramCapacity && !result.ssdCapacity
        ? "핵심 키워드를 찾지 못했어요. CMD 결과 전체를 다시 붙여넣어 주세요."
        : "";

  return { next, message };
}

export default function RegisterPcPage() {
  const { user, mockLogin } = useAuth();
  const { buildData } = useBuild();
  const [savedSnapshot, setSavedSnapshot] = useState<LocalSavedPc | null>(null);
  const [cpu, setCpu] = useState(initialSelection.cpuId);
  const [gpu, setGpu] = useState(initialSelection.gpuId);
  const [ramCapacity, setRamCapacity] = useState(initialSelection.ramCapacity);
  const [ramCount, setRamCount] = useState(initialSelection.ramCount);
  const [ramDetailedInputEnabled, setRamDetailedInputEnabled] = useState(initialSelection.ramDetailedInputEnabled);
  const [ramProductName, setRamProductName] = useState(initialSelection.ramProductName);
  const [mbSeries, setMbSeries] = useState(initialSelection.mbSeries);
  const [mbDetail, setMbDetail] = useState(initialSelection.mbDetail);
  const [mbBrand, setMbBrand] = useState(initialSelection.mbBrand);
  const [ssdCapacityOption, setSsdCapacityOption] = useState(initialSelection.ssdCapacityOption);
  const [ssdDetailedInputEnabled, setSsdDetailedInputEnabled] = useState(initialSelection.ssdDetailedInputEnabled);
  const [ssdProductName, setSsdProductName] = useState(initialSelection.ssdProductName);
  const [psuWatt, setPsuWatt] = useState(initialSelection.psuWatt);
  const [hasCase, setHasCase] = useState(initialSelection.hasCase);
  const [monitorResolution, setMonitorResolution] = useState<(typeof monitorResolutionOptions)[number]>(initialSelection.monitorResolution);
  const [monitorRefreshRate, setMonitorRefreshRate] = useState(initialSelection.monitorRefreshRate);
  const [monitorCount, setMonitorCount] = useState(initialSelection.monitorCount);
  const [commandScanRawText, setCommandScanRawText] = useState(initialSelection.commandScanRawText);
  const [openSection, setOpenSection] = useState<"spec" | "auto" | "manual" | null>(null);

  const [isCommandCopied, setIsCommandCopied] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [scanStatusMessage, setScanStatusMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const parsed = readJsonFromStorage<Partial<LocalSavedPc>>(storageKey);
    if (!parsed) return;

    setSavedSnapshot(parsed as LocalSavedPc);
    if (parsed.cpuId) setCpu(parsed.cpuId);
    if (parsed.gpuId) setGpu(parsed.gpuId);
    if (parsed.ramCapacity) setRamCapacity(parsed.ramCapacity);
    if (typeof parsed.ramCount === "number" && parsed.ramCount >= 1 && parsed.ramCount <= 4) setRamCount(parsed.ramCount);
    if (typeof parsed.ramDetailedInputEnabled === "boolean") setRamDetailedInputEnabled(parsed.ramDetailedInputEnabled);
    if (parsed.ramProductName) setRamProductName(parsed.ramProductName);
    if (parsed.mbSeries) setMbSeries(parsed.mbSeries);
    if (parsed.mbDetail) setMbDetail(parsed.mbDetail);
    if (parsed.mbBrand) setMbBrand(parsed.mbBrand);

    if (!parsed.mbSeries && !parsed.mbDetail && parsed.mbModelName) {
      const model = parsed.mbModelName.trim();
      const matched = model.match(/^(Intel|AMD)?\s*([ZXBHA])\s*[- ]?(\d{3,4})/i);
      if (matched) {
        const vendor = matched[1]?.toUpperCase() === "AMD" ? "AMD" : "Intel";
        const alpha = matched[2].toUpperCase();
        setMbSeries(`${vendor} ${alpha}`);
        setMbDetail(matched[3]);
      } else {
        setMbDetail(model);
      }
    }
    if (parsed.ssdCapacityOption) setSsdCapacityOption(parsed.ssdCapacityOption);
    if (typeof parsed.ssdDetailedInputEnabled === "boolean") setSsdDetailedInputEnabled(parsed.ssdDetailedInputEnabled);
    if (parsed.ssdProductName) setSsdProductName(parsed.ssdProductName);
    if (parsed.psuWatt) setPsuWatt(parsed.psuWatt);
    if (typeof parsed.hasCase === "boolean") setHasCase(parsed.hasCase);
    if (parsed.monitorResolution) setMonitorResolution(parsed.monitorResolution);
    if (parsed.monitorRefreshRate) setMonitorRefreshRate(parsed.monitorRefreshRate);
    if (typeof parsed.monitorCount === "number" && parsed.monitorCount >= 1 && parsed.monitorCount <= 3) setMonitorCount(parsed.monitorCount);
    if (parsed.commandScanRawText) setCommandScanRawText(parsed.commandScanRawText);
  }, []);

  useEffect(() => {
    if (savedSnapshot) return;

    const parts = buildData.existingParts;

    if (parts.RAM.enabled && ramCapacityOptions.includes(parts.RAM.capacity as (typeof ramCapacityOptions)[number])) {
      setRamCapacity(parts.RAM.capacity);
    }

    if (parts.SSD.enabled && ssdCapacityOptions.includes(parts.SSD.capacity as (typeof ssdCapacityOptions)[number])) {
      setSsdCapacityOption(parts.SSD.capacity);
    }

    if (parts.CPU.enabled && parts.CPU.model.trim()) {
      const hit = HARDWARE_MASTER.CPU.find((h) =>
        h.matchKeywords.some((k) => parts.CPU.model.toLowerCase().includes(k.toLowerCase()))
      );
      if (hit) {
        setCpu(hit.mappedId ?? hit.id);
      }
    }

    if (parts.GPU.enabled && parts.GPU.model.trim()) {
      const hit = HARDWARE_MASTER.GPU.find((h) =>
        h.matchKeywords.some((k) => parts.GPU.model.toLowerCase().includes(k.toLowerCase()))
      );
      if (hit) {
        setGpu(hit.mappedId ?? hit.id);
      }
    }
  }, [savedSnapshot, buildData.existingParts]);

  const cpuDropdownOptions = useMemo(
    () => HARDWARE_MASTER.CPU.map((item) => ({ value: item.mappedId ?? item.id, label: item.name })),
    []
  );
  const gpuDropdownOptions = useMemo(
    () => HARDWARE_MASTER.GPU.map((item) => ({ value: item.mappedId ?? item.id, label: item.name })),
    []
  );
  const snapshotCpuName = useMemo(() => cpus.find((item) => item.id === savedSnapshot?.cpuId)?.name ?? "미등록", [savedSnapshot?.cpuId]);
  const snapshotGpuName = useMemo(() => gpus.find((item) => item.id === savedSnapshot?.gpuId)?.name ?? "미등록", [savedSnapshot?.gpuId]);
  const snapshotBoardName = useMemo(() => {
    if (!savedSnapshot) return "미등록";
    const series = savedSnapshot.mbSeries?.trim();
    const detail = savedSnapshot.mbDetail?.trim();
    const brand = savedSnapshot.mbBrand?.trim();

    if (!series && !detail && savedSnapshot.mbModelName) return savedSnapshot.mbModelName;
    if (!series && !detail) return "미등록";

    return `${brand || "브랜드 미지정"} ${series || ""}${detail ? ` ${detail}` : ""}`.trim();
  }, [savedSnapshot]);
  const snapshotRam = useMemo(() => {
    if (!savedSnapshot) return "미등록";
    const count = savedSnapshot.ramCount && savedSnapshot.ramCount > 0 ? savedSnapshot.ramCount : 1;
    const totalGb = parseRamCapacityToGb(savedSnapshot.ramCapacity) * count;
    const base = `${savedSnapshot.ramCapacity} x ${count} (총 ${totalGb}GB)`;
    return savedSnapshot.ramDetail ? `${base} (${savedSnapshot.ramDetail})` : base;
  }, [savedSnapshot]);
  const snapshotSsd = useMemo(() => {
    if (!savedSnapshot) return "미등록";
    return savedSnapshot.ssdDetail ? `${savedSnapshot.ssdCapacity} (${savedSnapshot.ssdDetail})` : savedSnapshot.ssdCapacity;
  }, [savedSnapshot]);
  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2000);
  };

  const handleParsedResult = (result: ParseCommandOutputResult) => {
    const { next, message } = resolveScanUpdates(result, {
      cpu,
      gpu,
      ramCapacity,
      ramProductName,
      ramDetailedInputEnabled,
      ssdCapacityOption,
      ssdProductName,
      ssdDetailedInputEnabled,
      mbSeries,
      mbDetail,
      monitorResolution,
      monitorRefreshRate,
    });

    if (next.cpu !== cpu) setCpu(next.cpu);
    if (next.gpu !== gpu) setGpu(next.gpu);
    if (next.mbSeries !== mbSeries) setMbSeries(next.mbSeries);
    if (next.mbDetail !== mbDetail) setMbDetail(next.mbDetail);
    if (next.ramCapacity !== ramCapacity) setRamCapacity(next.ramCapacity);
    if (next.ramDetailedInputEnabled !== ramDetailedInputEnabled) setRamDetailedInputEnabled(next.ramDetailedInputEnabled);
    if (next.ramProductName !== ramProductName) setRamProductName(next.ramProductName);
    if (next.ssdCapacityOption !== ssdCapacityOption) setSsdCapacityOption(next.ssdCapacityOption);
    if (next.ssdDetailedInputEnabled !== ssdDetailedInputEnabled) setSsdDetailedInputEnabled(next.ssdDetailedInputEnabled);
    if (next.ssdProductName !== ssdProductName) setSsdProductName(next.ssdProductName);
    if (next.monitorResolution !== monitorResolution) setMonitorResolution(next.monitorResolution);
    if (next.monitorRefreshRate !== monitorRefreshRate) setMonitorRefreshRate(next.monitorRefreshRate);

    setScanStatusMessage(message);

    if (user) {
      const autoPayload: LocalSavedPc = {
        id: `pc_${Date.now()}`,
        userId: user.id,
        pcName: `${user.name}의 PC`,
        cpuId: next.cpu,
        gpuId: next.gpu,
        ramCapacity: next.ramCapacity,
        ramCount,
        ramDetail: next.ramDetailedInputEnabled ? next.ramProductName.trim() : undefined,
        ssdCapacity: next.ssdCapacityOption,
        ssdDetail: next.ssdDetailedInputEnabled ? next.ssdProductName.trim() : undefined,
        monitorResolution: next.monitorResolution,
        monitorRefreshRate: next.monitorRefreshRate,
        monitorCount,
        ramDetailedInputEnabled: next.ramDetailedInputEnabled,
        ramProductName: next.ramProductName,
        ssdCapacityOption: next.ssdCapacityOption,
        ssdDetailedInputEnabled: next.ssdDetailedInputEnabled,
        ssdProductName: next.ssdProductName,
        mbSeries: next.mbSeries,
        mbDetail: next.mbDetail,
        mbBrand,
        mbModelName: `${next.mbSeries} ${next.mbDetail}`.trim(),
        psuWatt,
        hasCase,
        commandScanRawText,
      };
      writeJsonToStorage(storageKey, autoPayload);
      setSavedSnapshot(autoPayload);
      setSavedMessage("스캔 결과가 자동으로 등록 및 저장되었습니다.");
      showToast("자동 등록 및 저장이 완료되었습니다.");
    }
  };

  const handleSave = () => {
    if (!user) return;

    const payload: LocalSavedPc = {
      id: `pc_${Date.now()}`,
      userId: user.id,
      pcName: `${user.name}의 PC`,
      cpuId: cpu,
      gpuId: gpu,
      ramCapacity,
      ramCount,
      ramDetail: ramDetailedInputEnabled ? ramProductName.trim() : undefined,
      ssdCapacity: ssdCapacityOption,
      ssdDetail: ssdDetailedInputEnabled ? ssdProductName.trim() : undefined,
      monitorResolution,
      monitorRefreshRate,
      monitorCount,
      ramDetailedInputEnabled,
      ramProductName,
      ssdCapacityOption,
      ssdDetailedInputEnabled,
      ssdProductName,
      mbSeries,
      mbDetail,
      mbBrand,
      mbModelName: `${mbSeries} ${mbDetail}`.trim(),
      commandScanRawText,
    };

    writeJsonToStorage(storageKey, payload);
    setSavedSnapshot(payload);

    setSavedMessage("내 컴퓨터 사양이 저장되었습니다.");
    showToast("변경사항 저장이 완료되었습니다.");
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(wmiScanCommand);
      setIsCommandCopied(true);
      showToast("명령어가 복사되었습니다.");
      window.setTimeout(() => setIsCommandCopied(false), 1500);
    } catch {
      setIsCommandCopied(false);
      showToast("복사에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const handleAutoRegisterFromCommand = () => {
    const parsed = parseCommandOutput(commandScanRawText);
    handleParsedResult(parsed);
  };

  const handleScanTextPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData("text");
    if (!pastedText.trim()) return;

    event.preventDefault();
    setCommandScanRawText(pastedText);

    const parsed = parseCommandOutput(pastedText);
    handleParsedResult(parsed);
    setSavedMessage("붙여넣기 결과를 자동 분석하여 저장했습니다.");
    showToast("붙여넣기와 동시에 자동 등록되었습니다.");
  };

  const handleVideoGuideClick = () => {
    showToast("영상 가이드는 준비 중입니다.");
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Mock Auth</p>
          <h1 className="mt-2 text-3xl font-semibold">마이페이지는 로그인 후 이용 가능합니다.</h1>
          <p className="mt-3 text-sm text-slate-300">임의 로그인으로 테스트 유저 계정에 바로 진입해 내 PC를 저장해 보세요.</p>
          <button
            type="button"
            onClick={mockLogin}
            className="mt-6 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            임의 로그인하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      {toastMessage ? (
        <div className="fixed right-6 top-20 z-[90] rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 shadow-lg shadow-black/40">
          {toastMessage}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <MyPageTabs activeTab="register" />

        <section className="rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:p-6">
          <div className="flex min-h-[66vh] flex-col gap-3">
            <div className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 transition-all duration-300 ${openSection === "spec" ? "flex-[3]" : "flex-1"}`}>
              <button
                type="button"
                onClick={() => setOpenSection((prev) => (prev === "spec" ? null : "spec"))}
                className={`flex w-full items-center justify-between px-5 text-left ${openSection === "spec" ? "py-4" : "h-full min-h-[7.5rem]"}`}
              >
                <span className="text-lg font-semibold text-slate-100">내 PC 사양</span>
                <span className={`text-cyan-300 transition-transform duration-300 ${openSection === "spec" ? "rotate-180" : ""}`}>▾</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openSection === "spec" ? "max-h-[1600px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-5 pb-5">
                  {!savedSnapshot ? (
                    <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-6 text-sm text-slate-300">
                      등록된 하드웨어가 없습니다
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-4 md:flex-row">
                        <div className="flex-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs text-cyan-300">🧠 CPU</p>
                          <p className="mt-2 text-sm text-slate-100">{snapshotCpuName}</p>
                        </div>
                        <div className="flex-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs text-cyan-300">🎮 GPU</p>
                          <p className="mt-2 text-sm text-slate-100">{snapshotGpuName}</p>
                        </div>
                        <div className="flex-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs text-cyan-300">🧩 메인보드</p>
                          <p className="mt-2 text-sm text-slate-100">{snapshotBoardName}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-4 md:flex-row">
                        <div className="flex-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs text-cyan-300">⚡ RAM</p>
                          <p className="mt-2 text-sm text-slate-100">{snapshotRam}</p>
                        </div>
                        <div className="flex-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs text-cyan-300">💾 SSD</p>
                          <p className="mt-2 text-sm text-slate-100">{snapshotSsd}</p>
                        </div>
                        <div className="flex-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <p className="text-xs text-cyan-300">🖥️ 모니터</p>
                          <p className="mt-2 text-sm text-slate-100">
                            {savedSnapshot.monitorResolution} / {savedSnapshot.monitorRefreshRate}Hz / {savedSnapshot.monitorCount ?? 1}대
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 transition-all duration-300 ${openSection === "auto" ? "flex-[3]" : "flex-1"}`}>
              <button
                type="button"
                onClick={() => setOpenSection((prev) => (prev === "auto" ? null : "auto"))}
                className={`flex w-full items-center justify-between px-5 text-left ${openSection === "auto" ? "py-4" : "h-full min-h-[7.5rem]"}`}
              >
                <span className="text-lg font-semibold text-slate-100">내 컴퓨터 자동 등록</span>
                <span className={`text-cyan-300 transition-transform duration-300 ${openSection === "auto" ? "rotate-180" : ""}`}>▾</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openSection === "auto" ? "max-h-[2600px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-5 pb-5">
                  <p className="mb-4 text-sm text-slate-300">CMD 결과 붙여넣기만 하면 주요 부품을 자동 인식해 바로 저장합니다.</p>
                  <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-5">
              <button
                type="button"
                onClick={handleVideoGuideClick}
                className="inline-flex h-10 items-center rounded-md border border-slate-500/60 bg-transparent px-4 text-sm font-medium text-slate-200 transition hover:border-slate-300 hover:text-white"
              >
                영상으로 쉽게 배우기 🎬
              </button>

              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="font-semibold text-slate-100">1단계: 검은창(CMD) 열기</p>
                  <p className="mt-1 leading-6">키보드의 윈도우 키를 누른 채로 R을 누른 뒤, 나오는 작은 창에 cmd라고 적고 엔터를 치세요. (검은색 창이 켜집니다)</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="font-semibold text-slate-100">2단계: 마법 주문 복사하기</p>
                  <p className="mt-1 leading-6">아래 버튼을 누르면 컴퓨터 사양을 찾아내는 명령어가 자동으로 복사됩니다.</p>
                  <div className="mt-2 overflow-x-auto rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-cyan-200">
                    <code className="whitespace-nowrap">{wmiScanCommand}</code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="mt-3 inline-flex h-10 items-center rounded-md border border-cyan-400/40 bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                  >
                    명령어 복사하기 📋
                  </button>
                  {isCommandCopied ? <p className="mt-2 text-xs font-semibold text-emerald-300">복사 완료! 👍</p> : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="font-semibold text-slate-100">3단계: 검은창에 붙여넣고 엔터</p>
                  <p className="mt-1 leading-6">켜진 검은색 창에 마우스 우클릭을 하거나 Ctrl + V를 눌러 붙여넣은 뒤, 엔터(Enter) 키를 탁 치세요.</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="font-semibold text-slate-100">4단계: 결과물 전체 복사하기</p>
                  <p className="mt-1 leading-6">창에 글자들이 주르륵 나타나면, 마우스로 글자 전체를 드래그해서 복사(Ctrl + C)하세요.</p>
                  <button
                    type="button"
                    onClick={() => setIsExampleOpen((prev) => !prev)}
                    className="mt-3 inline-flex h-9 items-center rounded-md border border-slate-600 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
                  >
                    💡 예시 화면 보기
                  </button>
                  {isExampleOpen ? (
                    <pre className="mt-3 overflow-x-auto rounded-md border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200">
{`Name\nAMD Ryzen 7 9700X\n\nName\nNVIDIA GeForce RTX 5070\n\nCapacity      Speed\n17179869184   5600\n17179869184   5600\n\nModel                         Size\nSamsung SSD 990 PRO 1TB       1000202273280`}
                    </pre>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4">
                  <p className="font-semibold text-slate-100">5단계: 아래 칸에 붙여넣고 끝내기</p>
                  <p className="mt-1 leading-6">복사한 글자를 아래 커다란 상자에 붙여넣고 자동 등록 및 저장 버튼만 누르면 내 PC 등록이 안전하게 완료됩니다!</p>
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-medium text-slate-300">CMD 결과 붙여넣기</label>
                <textarea
                  value={commandScanRawText}
                  onChange={(event) => setCommandScanRawText(event.target.value)}
                  onPaste={handleScanTextPaste}
                  placeholder="CMD 실행 결과를 여기에 붙여넣어 주세요."
                  className="mt-2 h-40 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleAutoRegisterFromCommand}
                  className="mt-3 inline-flex h-10 items-center rounded-md bg-cyan-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  자동 등록 및 저장
                </button>
              </div>

              {scanStatusMessage ? (
                <p className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {scanStatusMessage}
                </p>
              ) : null}
            </div>
                </div>
              </div>
            </div>

            <div className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 transition-all duration-300 ${openSection === "manual" ? "flex-[3]" : "flex-1"}`}>
              <button
                type="button"
                onClick={() => setOpenSection((prev) => (prev === "manual" ? null : "manual"))}
                className={`flex w-full items-center justify-between px-5 text-left ${openSection === "manual" ? "py-4" : "h-full min-h-[7.5rem]"}`}
              >
                <span className="text-lg font-semibold text-slate-100">내 PC 직접 입력</span>
                <span className={`text-cyan-300 transition-transform duration-300 ${openSection === "manual" ? "rotate-180" : ""}`}>▾</span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openSection === "manual" ? "max-h-[3200px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-5 pb-5">
                  <div className="space-y-4">
              <label className="block text-sm">
                CPU
                <select value={cpu} onChange={(event) => setCpu(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                  {cpuDropdownOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                GPU
                <select value={gpu} onChange={(event) => setGpu(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                  {gpuDropdownOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                RAM
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
                  <select value={ramCapacity} onChange={(event) => setRamCapacity(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                    {ramCapacityOptions.map((ramOption) => (
                      <option key={ramOption} value={ramOption}>
                        {ramOption}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ramCount}
                    onChange={(event) => setRamCount(Number(event.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                    aria-label="RAM 개수"
                  >
                    {[1, 2, 3, 4].map((countOption) => (
                      <option key={countOption} value={countOption}>
                        {countOption}개
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-xs text-cyan-300">
                  총 RAM 용량: {parseRamCapacityToGb(ramCapacity) * ramCount}GB ({ramCapacity} x {ramCount})
                </p>

                <label className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={ramDetailedInputEnabled}
                    onChange={() => setRamDetailedInputEnabled((prev) => !prev)}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  + 상세 제품명 직접 입력 (더 정밀한 분석)
                </label>

                {ramDetailedInputEnabled ? (
                  <input
                    type="text"
                    value={ramProductName}
                    onChange={(event) => setRamProductName(event.target.value)}
                    placeholder="예: 삼성전자 DDR5-5600"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                ) : null}
              </label>

              <label className="block text-sm">
                SSD
                <select value={ssdCapacityOption} onChange={(event) => setSsdCapacityOption(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                  {ssdCapacityOptions.map((ssdOption) => (
                    <option key={ssdOption} value={ssdOption}>
                      {ssdOption}
                    </option>
                  ))}
                </select>

                <label className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200">
                  <input
                    type="checkbox"
                    checked={ssdDetailedInputEnabled}
                    onChange={() => setSsdDetailedInputEnabled((prev) => !prev)}
                    className="h-4 w-4 rounded border-white/20"
                  />
                  + 상세 제품명 직접 입력 (더 정밀한 분석)
                </label>

                {ssdDetailedInputEnabled ? (
                  <input
                    type="text"
                    value={ssdProductName}
                    onChange={(event) => setSsdProductName(event.target.value)}
                    placeholder="예: SK하이닉스 Gold P31"
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                ) : null}
              </label>

              <label className="block text-sm">
                메인보드 (Motherboard)
                <div className="mt-2 grid grid-cols-12 gap-2">
                  <select
                    value={mbBrand}
                    onChange={(event) => setMbBrand(event.target.value)}
                    className="col-span-3 rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-slate-100"
                  >
                    {motherboardBrandOptions.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>

                  <select
                    value={mbSeries}
                    onChange={(event) => setMbSeries(event.target.value)}
                    className="col-span-4 rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-sm text-slate-100"
                  >
                    {motherboardSeriesOptions.map((series) => (
                      <option key={series} value={series}>
                        {series}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={mbDetail}
                    onChange={(event) => setMbDetail(event.target.value)}
                    placeholder="예: 790"
                    className="col-span-5 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                  />
                </div>
              </label>

              <label className="block text-sm">
                파워 용량
                <input value={psuWatt} onChange={(event) => setPsuWatt(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100" />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block text-sm">
                  모니터 해상도
                  <select value={monitorResolution} onChange={(event) => setMonitorResolution(event.target.value as (typeof monitorResolutionOptions)[number])} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                    {monitorResolutionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  모니터 주사율(Hz)
                  <input type="number" min={60} max={500} step={1} value={monitorRefreshRate} onChange={(event) => setMonitorRefreshRate(Number(event.target.value) || 60)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100" />
                </label>

                <label className="block text-sm">
                  모니터 개수
                  <select
                    value={monitorCount}
                    onChange={(event) => setMonitorCount(Number(event.target.value))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  >
                    {[1, 2, 3].map((countOption) => (
                      <option key={countOption} value={countOption}>
                        {countOption}대
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-3 text-sm">
                  <input type="checkbox" checked={hasCase} onChange={() => setHasCase((value) => !value)} className="h-4 w-4 rounded border-white/20 bg-transparent" />
                  케이스 보유 여부
                </label>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-2xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
                >
                  내 컴퓨터 사양 저장하기
                </button>
              </div>

              <div className="flex justify-end">
                {savedMessage ? <p className="text-xs text-emerald-300">{savedMessage}</p> : null}
              </div>
              </div>
            </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
