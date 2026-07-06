"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { type ClipboardEvent, useEffect, useMemo, useState } from "react";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { useAuth } from "../../context/AuthContext";
import { useBuild } from "../../context/BuildContext";
import type { UserSavedPc } from "../../types/hardware";
import { HARDWARE_MASTER } from "../../data/hardwareMaster";
import { parseCommandOutput, wmiScanCommand, type ParseCommandOutputResult } from "../../../components/PcScannerModal";
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
};

const initialSelection = {
  cpuId: cpus[0]?.id ?? "",
  gpuId: gpus[0]?.id ?? "",
  ramCapacity: "16GB",
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
  commandScanRawText: "",
};

export default function RegisterPcPage() {
  const { user, mockLogin } = useAuth();
  const { buildData } = useBuild();
  const [savedSnapshot, setSavedSnapshot] = useState<LocalSavedPc | null>(null);
  const [cpu, setCpu] = useState(initialSelection.cpuId);
  const [gpu, setGpu] = useState(initialSelection.gpuId);
  const [ramCapacity, setRamCapacity] = useState(initialSelection.ramCapacity);
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
  const [commandScanRawText, setCommandScanRawText] = useState(initialSelection.commandScanRawText);

  const [isAutoRegisterOpen, setIsAutoRegisterOpen] = useState(false);
  const [isManualInputOpen, setIsManualInputOpen] = useState(false);
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false);
  const [isCommandCopied, setIsCommandCopied] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [scanStatusMessage, setScanStatusMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const existing = window.localStorage.getItem(storageKey);
    if (!existing) return;

    try {
      const parsed = JSON.parse(existing) as Partial<LocalSavedPc>;
      setSavedSnapshot(parsed as LocalSavedPc);
      if (parsed.cpuId) setCpu(parsed.cpuId);
      if (parsed.gpuId) setGpu(parsed.gpuId);
      if (parsed.ramCapacity) setRamCapacity(parsed.ramCapacity);
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
      if (parsed.commandScanRawText) setCommandScanRawText(parsed.commandScanRawText);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
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
    return savedSnapshot.ramDetail ? `${savedSnapshot.ramCapacity} (${savedSnapshot.ramDetail})` : savedSnapshot.ramCapacity;
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
    let message = "";
    let nextCpu = cpu;
    let nextGpu = gpu;
    let nextRamCapacity = ramCapacity;
    let nextRamProductName = ramProductName;
    let nextRamDetailEnabled = ramDetailedInputEnabled;
    let nextSsdCapacityOption = ssdCapacityOption;
    let nextSsdProductName = ssdProductName;
    let nextSsdDetailEnabled = ssdDetailedInputEnabled;
    let nextMbSeries = mbSeries;
    let nextMbDetail = mbDetail;
    let nextMonitorResolution = monitorResolution;
    let nextMonitorRefreshRate = monitorRefreshRate;

    if (result.cpuId && cpus.some((item) => item.id === result.cpuId)) {
      setCpu(result.cpuId);
      nextCpu = result.cpuId;
      message += `CPU 자동 감지: ${result.cpuLabel ?? result.cpuId}`;
    }

    if (result.gpuId && gpus.some((item) => item.id === result.gpuId)) {
      setGpu(result.gpuId);
      nextGpu = result.gpuId;
      message += `${message ? " / " : ""}GPU 자동 감지: ${result.gpuLabel ?? result.gpuId}`;
    }

    if (result.motherboardChipset) {
      const normalized = result.motherboardChipset.trim().toUpperCase();
      const matched = normalized.match(/^([ZXBHA])\s*[- ]?(\d{3,4})$/i);
      if (matched) {
        const alpha = matched[1].toUpperCase();
        const detail = matched[2];
        const vendor = alpha === "X" || alpha === "A" ? "AMD" : "Intel";
        const nextSeriesValue = `${vendor} ${alpha}`;
        setMbSeries(nextSeriesValue);
        setMbDetail(detail);
        nextMbSeries = nextSeriesValue;
        nextMbDetail = detail;
      } else {
        setMbDetail(result.motherboardChipset);
        nextMbDetail = result.motherboardChipset;
      }
      message += `${message ? " / " : ""}메인보드 자동 감지: ${result.motherboardChipset}`;
    }

    if (result.ramCapacity) {
      setRamCapacity(result.ramCapacity);
      nextRamCapacity = result.ramCapacity;
      message += `${message ? " / " : ""}RAM 자동 감지: ${result.ramCapacity}`;
    }

    if (result.ramDetail) {
      setRamDetailedInputEnabled(true);
      setRamProductName(result.ramDetail);
      nextRamDetailEnabled = true;
      nextRamProductName = result.ramDetail;
    }

    if (result.ssdCapacity) {
      setSsdCapacityOption(result.ssdCapacity);
      nextSsdCapacityOption = result.ssdCapacity;
      message += `${message ? " / " : ""}SSD 자동 감지: ${result.ssdCapacity}`;
    }

    if (result.ssdDetail) {
      setSsdDetailedInputEnabled(true);
      setSsdProductName(result.ssdDetail);
      nextSsdDetailEnabled = true;
      nextSsdProductName = result.ssdDetail;
    }

    if (result.monitorResolution) {
      setMonitorResolution(result.monitorResolution);
      nextMonitorResolution = result.monitorResolution;
    }

    if (result.monitorRefreshRate) {
      setMonitorRefreshRate(result.monitorRefreshRate);
      nextMonitorRefreshRate = result.monitorRefreshRate;
    }

    if (!result.cpuId && !result.gpuId && !result.motherboardChipset && !result.ramCapacity && !result.ssdCapacity) {
      message = "핵심 키워드를 찾지 못했어요. CMD 결과 전체를 다시 붙여넣어 주세요.";
    }

    setScanStatusMessage(message);

    if (typeof window !== "undefined" && user) {
      const autoPayload: LocalSavedPc = {
        id: `pc_${Date.now()}`,
        userId: user.id,
        pcName: `${user.name}의 PC`,
        cpuId: nextCpu,
        gpuId: nextGpu,
        ramCapacity: nextRamCapacity,
        ramDetail: nextRamDetailEnabled ? nextRamProductName.trim() : undefined,
        ssdCapacity: nextSsdCapacityOption,
        ssdDetail: nextSsdDetailEnabled ? nextSsdProductName.trim() : undefined,
        monitorResolution: nextMonitorResolution,
        monitorRefreshRate: nextMonitorRefreshRate,
        ramDetailedInputEnabled: nextRamDetailEnabled,
        ramProductName: nextRamProductName,
        ssdCapacityOption: nextSsdCapacityOption,
        ssdDetailedInputEnabled: nextSsdDetailEnabled,
        ssdProductName: nextSsdProductName,
        mbSeries: nextMbSeries,
        mbDetail: nextMbDetail,
        mbBrand,
        mbModelName: `${nextMbSeries} ${nextMbDetail}`.trim(),
        psuWatt,
        hasCase,
        commandScanRawText,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(autoPayload));
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
      ramDetail: ramDetailedInputEnabled ? ramProductName.trim() : undefined,
      ssdCapacity: ssdCapacityOption,
      ssdDetail: ssdDetailedInputEnabled ? ssdProductName.trim() : undefined,
      monitorResolution,
      monitorRefreshRate,
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

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }

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

        <section className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <button
            type="button"
            onClick={() => setIsSnapshotOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={isSnapshotOpen}
            aria-controls="saved-pc-snapshot"
          >
            <span className="text-lg font-semibold text-slate-100">내 PC 사양</span>
            <svg
              className={`h-5 w-5 text-slate-300 transition-transform duration-200 ${isSnapshotOpen ? "rotate-180" : "rotate-0"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div
            id="saved-pc-snapshot"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${isSnapshotOpen ? "mt-6 max-h-[1200px] opacity-100" : "max-h-0 opacity-0"}`}
          >
            {!savedSnapshot ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-6 text-sm text-slate-300">
                등록된 하드웨어가 없습니다
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs text-cyan-300">🧠 CPU</p>
                  <p className="mt-2 text-sm text-slate-100">{snapshotCpuName}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs text-cyan-300">🎮 GPU</p>
                  <p className="mt-2 text-sm text-slate-100">{snapshotGpuName}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs text-cyan-300">🧩 메인보드</p>
                  <p className="mt-2 text-sm text-slate-100">{snapshotBoardName}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs text-cyan-300">⚡ RAM</p>
                  <p className="mt-2 text-sm text-slate-100">{snapshotRam}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs text-cyan-300">💾 SSD</p>
                  <p className="mt-2 text-sm text-slate-100">{snapshotSsd}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <p className="text-xs text-cyan-300">🖥️ 모니터</p>
                  <p className="mt-2 text-sm text-slate-100">{savedSnapshot.monitorResolution} / {savedSnapshot.monitorRefreshRate}Hz</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <h1 className="text-3xl font-semibold">내 컴퓨터 사양 등록</h1>
          <p className="mt-3 text-sm font-normal leading-6 text-slate-400">
            로그인 후 내 PC를 등록하시면 사양 정보가 계정에 안전하게 저장되어, 기기가 바뀌어도 언제 어디서나 실시간으로 불러올 수 있습니다.
          </p>

          <button
            type="button"
            onClick={() => setIsAutoRegisterOpen((prev) => !prev)}
            className="mt-6 flex w-full items-center justify-between text-left"
            aria-expanded={isAutoRegisterOpen}
            aria-controls="auto-register-guide"
          >
            <span className="text-xl font-semibold text-slate-100">내 컴퓨터 자동 등록</span>
            <svg
              className={`h-5 w-5 text-slate-300 transition-transform duration-200 ${isAutoRegisterOpen ? "rotate-180" : "rotate-0"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <div
            id="auto-register-guide"
            className={`overflow-hidden transition-all duration-300 ease-in-out ${isAutoRegisterOpen ? "mt-6 max-h-[2600px] opacity-100" : "max-h-0 opacity-0"}`}
          >
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
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <button
              type="button"
              onClick={() => setIsManualInputOpen((prev) => !prev)}
              className="flex w-full items-center justify-between text-left"
              aria-expanded={isManualInputOpen}
              aria-controls="manual-pc-form"
            >
              <h2 className="text-xl font-semibold">내 PC 직접 입력</h2>
              <svg
                className={`h-5 w-5 text-slate-300 transition-transform duration-200 ${isManualInputOpen ? "rotate-180" : "rotate-0"}`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <div
              id="manual-pc-form"
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isManualInputOpen ? "mt-6 max-h-[2400px] opacity-100" : "max-h-0 opacity-0"}`}
            >
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
                <select value={ramCapacity} onChange={(event) => setRamCapacity(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                  {ramCapacityOptions.map((ramOption) => (
                    <option key={ramOption} value={ramOption}>
                      {ramOption}
                    </option>
                  ))}
                </select>

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

              <div className="grid gap-4 md:grid-cols-2">
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
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <input type="checkbox" checked={hasCase} onChange={() => setHasCase((value) => !value)} className="h-4 w-4 rounded border-white/20 bg-transparent" />
                케이스 보유 여부
              </label>

              <div className="flex items-center justify-end gap-3">
                {savedMessage ? <p className="text-xs text-emerald-300">{savedMessage}</p> : null}
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-400"
                >
                  변경사항 저장하기
                </button>
              </div>
              </div>
            </div>
        </section>
      </div>
    </main>
  );
}
