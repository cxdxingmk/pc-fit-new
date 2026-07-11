"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { type ClipboardEvent, useEffect, useMemo, useState } from "react";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { motherboards } from "../../database/motherboard";
import { useAuth } from "../../context/AuthContext";
import { useBuild } from "../../context/BuildContext";
import type { UserSavedPc } from "../../types/hardware";
import { HARDWARE_MASTER } from "../../data/hardwareMaster";
import { parseCommandOutput, wmiScanCommand, type ParseCommandOutputResult } from "../../lib/scanParser";
import { readJsonFromStorage, writeJsonToStorage } from "../../lib/localStorageJson";
import { derivePartSeries } from "../../lib/derivePartSeries";
import MyPageTabs from "../components/MyPageTabs";
import Card from "../../../components/ui/Card";
import AccordionSection from "../../../components/ui/AccordionSection";
import CascadingPartSelect from "../../../components/ui/CascadingPartSelect";
import { useCascadingPartSelect } from "../../../components/ui/useCascadingPartSelect";
import DarkSelect from "../../../components/ui/DarkSelect";

const storageKey = "user_pc_spec";
const ramCapacityOptions = ["8GB", "16GB", "32GB", "64GB"] as const;
const ssdCapacityOptions = ["256GB", "512GB", "1TB", "2TB"] as const;
const monitorResolutionOptions = ["FHD", "QHD", "4K"] as const;

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

/** mbSeries("Intel B")+mbDetail("760") 조합에서 실제 motherboards 카탈로그의 chipset("B760")을 복원해
 *  이전 세션에 골랐던 모델을 계층형 셀렉트에 다시 선반영한다. 못 찾으면 그냥 비워둔다(안전한 폴백). */
function findMotherboardIdFromLegacyFields(mbBrand: string, mbSeries: string, mbDetail: string): string | undefined {
  const alpha = mbSeries.trim().split(/\s+/).at(-1) ?? "";
  const chipset = `${alpha}${mbDetail}`.trim().toUpperCase();
  return motherboards.find((mb) => mb.brand === mbBrand && mb.chipset.toUpperCase() === chipset)?.id;
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
  const [openSection, setOpenSection] = useState<"spec" | "auto" | "manual" | null>("manual");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const [isCommandCopied, setIsCommandCopied] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [scanStatusMessage, setScanStatusMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  // 계층형 선택(브랜드 -> 시리즈/칩셋 -> 모델). 최종 선택 시 아래 cpu/gpu/mbBrand/mbSeries/mbDetail
  // state를 "기존과 동일한 형태"로 갱신하는 건 각 핸들러(handleCpuModelSelect 등)가 담당한다.
  const cpuSeriesOf = useMemo(() => (item: (typeof cpus)[number]) => derivePartSeries(item.name), []);
  const gpuSeriesOf = useMemo(() => (item: (typeof gpus)[number]) => derivePartSeries(item.name), []);
  const mbChipsetOf = useMemo(() => (item: (typeof motherboards)[number]) => item.chipset, []);

  const cpuCascade = useCascadingPartSelect(cpus, cpuSeriesOf, cpu);
  const gpuCascade = useCascadingPartSelect(gpus, gpuSeriesOf, gpu);
  const [motherboardInitialId] = useState(() => findMotherboardIdFromLegacyFields(mbBrand, mbSeries, mbDetail));
  const motherboardCascade = useCascadingPartSelect(motherboards, mbChipsetOf, motherboardInitialId);

  const handleCpuModelSelect = (modelId: string) => {
    cpuCascade.selectModel(modelId);
    if (modelId) setCpu(modelId);
  };

  const handleGpuModelSelect = (modelId: string) => {
    gpuCascade.selectModel(modelId);
    if (modelId) setGpu(modelId);
  };

  const handleMotherboardModelSelect = (modelId: string) => {
    motherboardCascade.selectModel(modelId);
    const selected = motherboards.find((mb) => mb.id === modelId);
    if (!selected) return;

    // 기존 mbSeries("Intel B")/mbDetail("760") 형태를 그대로 유지해야 자동 스캔 로직·저장 스냅샷 표시가
    // 동일하게 동작한다. socket으로 Intel/AMD를 가르고, chipset 첫 글자+나머지 숫자로 분해한다
    // (register-pc의 CMD 자동 인식 로직이 쓰는 것과 동일한 관례).
    const vendor = selected.socket.startsWith("LGA") ? "Intel" : "AMD";
    const alpha = selected.chipset.charAt(0);
    const detail = selected.chipset.slice(1);

    setMbBrand(selected.brand);
    setMbSeries(`${vendor} ${alpha}`);
    setMbDetail(detail);
  };

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
      <main className="min-h-screen bg-ink px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-soft">Mock Auth</p>
          <h1 className="mt-2 text-3xl font-semibold">마이페이지는 로그인 후 이용 가능합니다.</h1>
          <p className="mt-3 text-sm text-white/60">임의 로그인으로 테스트 유저 계정에 바로 진입해 내 PC를 저장해 보세요.</p>
          <button
            type="button"
            onClick={mockLogin}
            className="mt-6 rounded-2xl bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            임의 로그인하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink px-6 py-10 text-white">
      {toastMessage ? (
        <div className="fixed right-6 top-20 z-[90] rounded-xl bg-surface px-4 py-2 text-sm font-semibold text-good shadow-card ring-1 ring-good/25">
          {toastMessage}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <MyPageTabs activeTab="register" />

        <div className="flex flex-col gap-4">
          <AccordionSection title="내 PC 사양" isOpen={openSection === "spec"} onToggle={() => setOpenSection((prev) => (prev === "spec" ? null : "spec"))}>
            {!savedSnapshot ? (
              <div className="rounded-xl border border-dashed border-line bg-white/[0.03] px-5 py-6 text-sm text-white/40">
                등록된 하드웨어가 없습니다
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <SpecTile emoji="🧠" label="CPU" value={snapshotCpuName} />
                <SpecTile emoji="🎮" label="GPU" value={snapshotGpuName} />
                <SpecTile emoji="🧩" label="메인보드" value={snapshotBoardName} />
                <SpecTile emoji="⚡" label="RAM" value={snapshotRam} />
                <SpecTile emoji="💾" label="SSD" value={snapshotSsd} />
                <SpecTile
                  emoji="🖥️"
                  label="모니터"
                  value={`${savedSnapshot.monitorResolution} / ${savedSnapshot.monitorRefreshRate}Hz / ${savedSnapshot.monitorCount ?? 1}대`}
                />
              </div>
            )}
          </AccordionSection>

          <AccordionSection title="내 컴퓨터 자동 등록" isOpen={openSection === "auto"} onToggle={() => setOpenSection((prev) => (prev === "auto" ? null : "auto"))}>
            <p className="mb-3 text-sm text-white/60">CMD 결과 붙여넣기만 하면 주요 부품을 자동 인식해 바로 저장합니다.</p>
            <Card className="p-4" muted>
              <button
                type="button"
                onClick={handleVideoGuideClick}
                className="inline-flex h-10 items-center rounded-xl bg-white/[0.04] px-4 text-sm font-medium text-white/75 ring-1 ring-line transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                영상으로 쉽게 배우기 🎬
              </button>

              <div className="mt-3 space-y-3 text-sm text-white/60">
                <Card className="p-3">
                  <p className="font-semibold text-white/90">1단계: 검은창(CMD) 열기</p>
                  <p className="mt-1 leading-6">키보드의 윈도우 키를 누른 채로 R을 누른 뒤, 나오는 작은 창에 cmd라고 적고 엔터를 치세요. (검은색 창이 켜집니다)</p>
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">2단계: 마법 주문 복사하기</p>
                  <p className="mt-1 leading-6">아래 버튼을 누르면 컴퓨터 사양을 찾아내는 명령어가 자동으로 복사됩니다.</p>
                  <div className="mt-2 overflow-x-auto rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-brand-soft ring-1 ring-line">
                    <code className="whitespace-nowrap">{wmiScanCommand}</code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    명령어 복사하기 📋
                  </button>
                  {isCommandCopied ? <p className="mt-2 text-xs font-semibold text-good">복사 완료! 👍</p> : null}
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">3단계: 검은창에 붙여넣고 엔터</p>
                  <p className="mt-1 leading-6">켜진 검은색 창에 마우스 우클릭을 하거나 Ctrl + V를 눌러 붙여넣은 뒤, 엔터(Enter) 키를 탁 치세요.</p>
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">4단계: 결과물 전체 복사하기</p>
                  <p className="mt-1 leading-6">창에 글자들이 주르륵 나타나면, 마우스로 글자 전체를 드래그해서 복사(Ctrl + C)하세요.</p>
                  <button
                    type="button"
                    onClick={() => setIsExampleOpen((prev) => !prev)}
                    className="mt-3 inline-flex h-9 items-center rounded-xl bg-white/[0.04] px-3 text-xs font-semibold text-white/75 ring-1 ring-line transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    💡 예시 화면 보기
                  </button>
                  {isExampleOpen ? (
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-white/[0.03] p-3 text-xs text-white/70 ring-1 ring-line">
{`Name\nAMD Ryzen 7 9700X\n\nName\nNVIDIA GeForce RTX 5070\n\nCapacity      Speed\n17179869184   5600\n17179869184   5600\n\nModel                         Size\nSamsung SSD 990 PRO 1TB       1000202273280`}
                    </pre>
                  ) : null}
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">5단계: 아래 칸에 붙여넣고 끝내기</p>
                  <p className="mt-1 leading-6">복사한 글자를 아래 커다란 상자에 붙여넣고 자동 등록 및 저장 버튼만 누르면 내 PC 등록이 안전하게 완료됩니다!</p>
                </Card>
              </div>

              <div className="mt-4">
                <label htmlFor="scan-raw-text" className="text-sm font-medium text-white/60">
                  CMD 결과 붙여넣기
                </label>
                <textarea
                  id="scan-raw-text"
                  value={commandScanRawText}
                  onChange={(event) => setCommandScanRawText(event.target.value)}
                  onPaste={handleScanTextPaste}
                  placeholder="CMD 실행 결과를 여기에 붙여넣어 주세요."
                  className="mt-2 h-40 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
                <button
                  type="button"
                  onClick={handleAutoRegisterFromCommand}
                  className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  자동 등록 및 저장
                </button>
              </div>

              {scanStatusMessage ? (
                <p className="mt-4 rounded-xl bg-good/10 px-4 py-3 text-sm text-good ring-1 ring-good/25">{scanStatusMessage}</p>
              ) : null}
            </Card>
          </AccordionSection>

          <AccordionSection title="내 PC 직접 입력" isOpen={openSection === "manual"} onToggle={() => setOpenSection((prev) => (prev === "manual" ? null : "manual"))}>
            <div className="space-y-4">
              <CascadingPartSelect title="CPU" state={{ ...cpuCascade, selectModel: handleCpuModelSelect }} />

              <CascadingPartSelect title="GPU" state={{ ...gpuCascade, selectModel: handleGpuModelSelect }} />

              <div>
                <span className="block text-sm font-medium text-white/70">RAM</span>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_140px] gap-3">
                  <DarkSelect aria-label="RAM 용량" value={ramCapacity} onChange={(event) => setRamCapacity(event.target.value)}>
                    {ramCapacityOptions.map((ramOption) => (
                      <option key={ramOption} value={ramOption}>
                        {ramOption}
                      </option>
                    ))}
                  </DarkSelect>
                  <DarkSelect aria-label="RAM 개수" value={ramCount} onChange={(event) => setRamCount(Number(event.target.value))}>
                    {[1, 2, 3, 4].map((countOption) => (
                      <option key={countOption} value={countOption}>
                        {countOption}개
                      </option>
                    ))}
                  </DarkSelect>
                </div>
                <p className="mt-2 text-xs text-brand-soft">
                  총 RAM 용량: {parseRamCapacityToGb(ramCapacity) * ramCount}GB ({ramCapacity} x {ramCount})
                </p>

                <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-white/70 ring-1 ring-line">
                  <input
                    type="checkbox"
                    checked={ramDetailedInputEnabled}
                    onChange={() => setRamDetailedInputEnabled((prev) => !prev)}
                    className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-brand"
                  />
                  + 상세 제품명 직접 입력 (더 정밀한 분석)
                </label>

                {ramDetailedInputEnabled ? (
                  <input
                    type="text"
                    value={ramProductName}
                    onChange={(event) => setRamProductName(event.target.value)}
                    placeholder="예: 삼성전자 DDR5-5600"
                    className="mt-2 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  />
                ) : null}
              </div>

              <AccordionSection
                title="더 정확하게 진단하기 (선택)"
                isOpen={isAdvancedOpen}
                onToggle={() => setIsAdvancedOpen((prev) => !prev)}
              >
                <div className="space-y-4">
                  <div>
                    <span className="block text-sm font-medium text-white/70">SSD</span>
                    <div className="mt-2">
                      <DarkSelect aria-label="SSD 용량" value={ssdCapacityOption} onChange={(event) => setSsdCapacityOption(event.target.value)}>
                        {ssdCapacityOptions.map((ssdOption) => (
                          <option key={ssdOption} value={ssdOption}>
                            {ssdOption}
                          </option>
                        ))}
                      </DarkSelect>
                    </div>

                    <label className="mt-3 flex min-h-11 items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-white/70 ring-1 ring-line">
                      <input
                        type="checkbox"
                        checked={ssdDetailedInputEnabled}
                        onChange={() => setSsdDetailedInputEnabled((prev) => !prev)}
                        className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-brand"
                      />
                      + 상세 제품명 직접 입력 (더 정밀한 분석)
                    </label>

                    {ssdDetailedInputEnabled ? (
                      <input
                        type="text"
                        value={ssdProductName}
                        onChange={(event) => setSsdProductName(event.target.value)}
                        placeholder="예: SK하이닉스 Gold P31"
                        className="mt-2 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      />
                    ) : null}
                  </div>

                  <CascadingPartSelect
                    title="메인보드 (Motherboard)"
                    groupLabel="칩셋"
                    state={{ ...motherboardCascade, selectModel: handleMotherboardModelSelect }}
                  />

                  <div>
                    <label htmlFor="psu-watt" className="block text-sm font-medium text-white/70">
                      파워 용량
                    </label>
                    <input
                      id="psu-watt"
                      value={psuWatt}
                      onChange={(event) => setPsuWatt(event.target.value)}
                      className="mt-2 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="monitor-resolution" className="block text-sm font-medium text-white/70">
                        모니터 해상도
                      </label>
                      <div className="mt-2">
                        <DarkSelect
                          id="monitor-resolution"
                          value={monitorResolution}
                          onChange={(event) => setMonitorResolution(event.target.value as (typeof monitorResolutionOptions)[number])}
                        >
                          {monitorResolutionOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </DarkSelect>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="monitor-refresh-rate" className="block text-sm font-medium text-white/70">
                        모니터 주사율(Hz)
                      </label>
                      <input
                        id="monitor-refresh-rate"
                        type="number"
                        min={60}
                        max={500}
                        step={1}
                        value={monitorRefreshRate}
                        onChange={(event) => setMonitorRefreshRate(Number(event.target.value) || 60)}
                        className="mt-2 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      />
                    </div>

                    <div>
                      <label htmlFor="monitor-count" className="block text-sm font-medium text-white/70">
                        모니터 개수
                      </label>
                      <div className="mt-2">
                        <DarkSelect id="monitor-count" value={monitorCount} onChange={(event) => setMonitorCount(Number(event.target.value))}>
                          {[1, 2, 3].map((countOption) => (
                            <option key={countOption} value={countOption}>
                              {countOption}대
                            </option>
                          ))}
                        </DarkSelect>
                      </div>
                    </div>
                  </div>

                  <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2 text-sm text-white/70 ring-1 ring-line">
                    <input
                      type="checkbox"
                      checked={hasCase}
                      onChange={() => setHasCase((value) => !value)}
                      className="h-4 w-4 rounded border-white/20 bg-white/[0.04] accent-brand"
                    />
                    케이스 보유 여부
                  </label>
                </div>
              </AccordionSection>

              <div className="flex flex-col gap-3 rounded-xl bg-white/[0.03] px-4 py-3 ring-1 ring-line sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-white/40">CPU · GPU · RAM만으로도 바로 진단할 수 있어요.</p>
                <button
                  type="button"
                  onClick={handleSave}
                  className="min-h-11 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
                >
                  내 컴퓨터 사양 저장하기
                </button>
              </div>

              <div className="flex justify-end">
                {savedMessage ? <p className="text-xs text-good">{savedMessage}</p> : null}
              </div>
            </div>
          </AccordionSection>
        </div>
      </div>
    </main>
  );
}

function SpecTile({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <Card className="p-4" muted>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-soft">
        {emoji} {label}
      </p>
      <p className="mt-2 break-words text-sm text-white/85">{value}</p>
    </Card>
  );
}
