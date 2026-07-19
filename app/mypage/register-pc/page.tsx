"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { type ClipboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { motherboards } from "../../database/motherboard";
import { useAuth } from "../../context/AuthContext";
import { useBuild } from "../../context/BuildContext";
import { HARDWARE_MASTER } from "../../data/hardwareMaster";
import { parseSpecOutput, powerShellScanCommand, legacyWmicScanCommand, type ParseCommandOutputResult } from "../../lib/scanParser";
import { getSavedPcSpec, upsertSavedPcSpec, type SavedPcSpec, type UpsertSavedPcSpecInput } from "../../lib/pcSpecs";
import { savePendingScanSpec, readPendingScanSpec, clearPendingScanSpec } from "../../lib/pendingScanSpec";
import { REFRESH_RATE_STEPS, snapToNearestRefreshRate } from "../../lib/refreshRateSteps";
import { parseRamCapacityToGb, totalRamGb } from "../../lib/ramCapacity";
import { derivePartSeries } from "../../lib/derivePartSeries";
import MyPageTabs from "../components/MyPageTabs";
import Card from "../../../components/ui/Card";
import AccordionSection from "../../../components/ui/AccordionSection";
import CascadingPartSelect from "../../../components/ui/CascadingPartSelect";
import { useCascadingPartSelect } from "../../../components/ui/useCascadingPartSelect";
import DarkSelect from "../../../components/ui/DarkSelect";
import GpuAutoDetect from "../../../components/GpuAutoDetect";

const ramCapacityOptions = ["8GB", "16GB", "32GB", "64GB"] as const;
const ssdCapacityOptions = ["256GB", "512GB", "1TB", "2TB"] as const;
const monitorResolutionOptions = ["FHD", "QHD", "4K"] as const;

// CPU/GPU/메인보드/파워는 사용자가 실제로 확인 없이 저장할 경우 잘못된 사양이 조용히 등록될
// 수 있어(예: 실제론 안 쓰는 i9-14900K가 기본값으로 저장) 일부러 빈 값으로 시작한다 — CPU/GPU는
// handleSave에서 필수 검증하고, 메인보드/파워는 "선택" 항목이라 빈 값 그대로 저장을 허용한다.
const initialSelection = {
  cpuId: "",
  gpuId: "",
  ramCapacity: "16GB",
  ramCount: 2,
  ramDetailedInputEnabled: false,
  ramProductName: "",
  mbSeries: "",
  mbDetail: "",
  mbBrand: "",
  ssdCapacityOption: "1TB",
  ssdDetailedInputEnabled: false,
  ssdProductName: "",
  psuWatt: "",
  hasCase: true,
  monitorResolution: "QHD" as const,
  monitorRefreshRate: 144,
  monitorCount: 1,
  commandScanRawText: "",
};


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
  /** 모듈 1개당 용량("16GB") — 총 용량은 ramCount를 곱해야 한다 */
  ramCapacity: string;
  ramCount: number;
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
): { next: ScanDerivedState; message: string; hasAnyMatch: boolean } {
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
    // 개수도 함께 반영해야 총 용량이 맞는다 — 예전엔 개수가 폼 기본값(2)에 그대로 남아
    // "16GB짜리 1개"를 스캔해도 "x 2 (총 32GB)"로 표시되는 식의 불일치가 났다.
    // RAM 개수 셀렉트는 1~4만 지원하므로 그 범위로 클램프한다(원문 그대로는 ramDetail에 남는다).
    if (result.ramModuleCount && result.ramModuleCount > 0) {
      next.ramCount = Math.min(4, result.ramModuleCount);
    }
    const totalGb = totalRamGb(result.ramCapacity, next.ramCount);
    messages.push(`RAM 자동 감지: ${result.ramCapacity} x ${next.ramCount} (총 ${totalGb}GB)`);
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
    // 스캔에서 읽힌 임의 주사율도 여기서 표준 단계로 맞춰둔다 — 이 next 값이 폼 상태와
    // DB 저장(buildInputFromNext) 양쪽에 그대로 쓰이므로, 원천에서 한 번만 정규화한다.
    next.monitorRefreshRate = snapToNearestRefreshRate(result.monitorRefreshRate);
  }

  const hasAnyMatch = messages.length > 0;
  const message = hasAnyMatch
    ? messages.join(" / ")
    : buildUnrecognizedLinesMessage(result);

  return { next, message, hasAnyMatch };
}

/** 어떤 항목을 못 읽었는지 구체적으로 알려준다(원문 일부도 함께 보여줘 사용자가 스스로 판단할 수 있게). */
function buildUnrecognizedLinesMessage(result: ParseCommandOutputResult): string {
  const unrecognized: string[] = [];
  if (!result.cpuId) unrecognized.push(result.cpuRaw ? `CPU("${result.cpuRaw}")` : "CPU");
  if (!result.gpuId) unrecognized.push(result.gpuRaw ? `GPU("${result.gpuRaw}")` : "GPU");
  if (!result.motherboardChipset) unrecognized.push("메인보드");
  if (!result.ramCapacity) unrecognized.push("RAM");
  if (!result.ssdCapacity) unrecognized.push("SSD");

  if (unrecognized.length === 0) return "";
  return `다음 항목을 인식하지 못했어요: ${unrecognized.join(", ")}. PowerShell 결과 전체를 다시 붙여넣어 주세요.`;
}

export default function RegisterPcPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { buildData } = useBuild();
  const [savedSnapshot, setSavedSnapshot] = useState<SavedPcSpec | null>(null);
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
  const [isLegacyCommandOpen, setIsLegacyCommandOpen] = useState(false);
  const [isLegacyCommandCopied, setIsLegacyCommandCopied] = useState(false);
  const [isExampleOpen, setIsExampleOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [scanStatusMessage, setScanStatusMessage] = useState("");
  const [scanErrorMessage, setScanErrorMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  // GPU는 CMD 명령으로 조회하지 않는다 — 브라우저 WebGL 자동감지(GpuAutoDetect) 결과를 여기 보관한다.
  const [gpuAutoDetectedId, setGpuAutoDetectedId] = useState<string | null>(null);
  const [gpuAutoDetectedRaw, setGpuAutoDetectedRaw] = useState<string | null>(null);
  const gpuIsLaptop = gpuAutoDetectedRaw ? /\b(laptop|mobile)\b/i.test(gpuAutoDetectedRaw) : false;

  // CMD 붙여넣기 파싱 성공 시 곧바로 저장하지 않고, "이 사양으로 등록할까요?" 확인을 먼저 거친다.
  const [pendingConfirm, setPendingConfirm] = useState<{ result: ParseCommandOutputResult; next: ScanDerivedState } | null>(null);
  const [noSaveNotice, setNoSaveNotice] = useState("");

  // 계층형 선택(브랜드 -> 시리즈/칩셋 -> 모델). 최종 선택 시 아래 cpu/gpu/mbBrand/mbSeries/mbDetail
  // state를 "기존과 동일한 형태"로 갱신하는 건 각 핸들러(handleCpuModelSelect 등)가 담당한다.
  const cpuSeriesOf = useMemo(() => (item: (typeof cpus)[number]) => derivePartSeries(item.name), []);
  const gpuSeriesOf = useMemo(() => (item: (typeof gpus)[number]) => derivePartSeries(item.name), []);
  const mbChipsetOf = useMemo(() => (item: (typeof motherboards)[number]) => item.chipset, []);

  const cpuCascade = useCascadingPartSelect(cpus, cpuSeriesOf, cpu);
  const gpuCascade = useCascadingPartSelect(gpus, gpuSeriesOf, gpu);
  const cpuFieldRef = useRef<HTMLDivElement>(null);
  const gpuFieldRef = useRef<HTMLDivElement>(null);
  const [cpuMissingError, setCpuMissingError] = useState("");
  const [gpuMissingError, setGpuMissingError] = useState("");
  const [motherboardInitialId] = useState(() => findMotherboardIdFromLegacyFields(mbBrand, mbSeries, mbDetail));
  const motherboardCascade = useCascadingPartSelect(motherboards, mbChipsetOf, motherboardInitialId);

  const handleCpuModelSelect = (modelId: string) => {
    cpuCascade.selectModel(modelId);
    if (modelId) {
      setCpu(modelId);
      setCpuMissingError("");
    }
  };

  const handleGpuModelSelect = (modelId: string) => {
    gpuCascade.selectModel(modelId);
    if (modelId) {
      setGpu(modelId);
      setGpuMissingError("");
    }
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
    if (!isExampleOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExampleOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExampleOpen]);

  // pcSpecs/pendingScanSpec에서 읽어온 값을 폼 상태(useState들)에 그대로 반영하는 공용 헬퍼.
  // 마운트 시 기존 등록값 복원, 확인 플로우의 예/아니요, 로그인 후 대기 중이던 값 자동 반영까지
  // 전부 같은 필드 동기화 로직을 쓰므로 여기 한 곳에만 둔다.
  const applySpecToForm = (fields: UpsertSavedPcSpecInput) => {
    // setCpu/setGpu를 직접 부르지 않고 handleCpuModelSelect/handleGpuModelSelect를 거친다 —
    // 그래야 CascadingPartSelect의 브랜드/시리즈 상태도 함께 재동기화된다(그렇지 않으면 "직접
    // 입력" 아코디언을 열었을 때 모델은 맞는데 브랜드/시리즈 드롭다운이 빈 값으로 보이는
    // 문제가 생긴다 — 이전 세션에서 고쳤던 useCascadingPartSelect 버그와 같은 종류).
    if (fields.cpuId) handleCpuModelSelect(fields.cpuId);
    if (fields.gpuId) handleGpuModelSelect(fields.gpuId);
    if (fields.ramCapacity) setRamCapacity(fields.ramCapacity);
    if (fields.ramCount >= 1 && fields.ramCount <= 4) setRamCount(fields.ramCount);
    setRamDetailedInputEnabled(fields.ramDetailedInputEnabled);
    if (fields.ramProductName) setRamProductName(fields.ramProductName);
    if (fields.mbSeries) setMbSeries(fields.mbSeries);
    if (fields.mbDetail) setMbDetail(fields.mbDetail);
    if (fields.mbBrand) setMbBrand(fields.mbBrand);
    if (fields.ssdCapacity) setSsdCapacityOption(fields.ssdCapacity);
    setSsdDetailedInputEnabled(fields.ssdDetailedInputEnabled);
    if (fields.ssdProductName) setSsdProductName(fields.ssdProductName);
    if (fields.psuWatt) setPsuWatt(fields.psuWatt);
    setHasCase(fields.hasCase);
    if (fields.monitorResolution) setMonitorResolution(fields.monitorResolution as (typeof monitorResolutionOptions)[number]);
    // 예전 자유 입력(60~500, 1씩 증감) 시절에 저장된 비표준 값(예: 200Hz)이 그대로 오면
    // 셀렉트에 맞는 option이 없어 빈칸으로 보이므로, 가장 가까운 표준 단계로 맞춘다.
    if (fields.monitorRefreshRate) setMonitorRefreshRate(snapToNearestRefreshRate(fields.monitorRefreshRate));
    if (fields.monitorCount >= 1 && fields.monitorCount <= 3) setMonitorCount(fields.monitorCount);
    if (fields.commandScanRawText) setCommandScanRawText(fields.commandScanRawText);
  };

  useEffect(() => {
    let cancelled = false;

    getSavedPcSpec().then((parsed) => {
      if (cancelled || !parsed) return;
      setSavedSnapshot(parsed);
      applySpecToForm(parsed);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 복원
  }, []);

  // "예, 등록할게요" 선택 후 비로그인이라 로그인으로 보냈던 값을, 로그인 완료 후 돌아왔을 때
  // 자동으로 이어서 저장한다(재입력 불필요).
  useEffect(() => {
    if (!user) return;
    const pending = readPendingScanSpec();
    if (!pending) return;

    clearPendingScanSpec();
    applySpecToForm(pending);

    upsertSavedPcSpec(pending).then(({ error }) => {
      if (error) {
        setScanErrorMessage(error);
        return;
      }
      setSavedSnapshot({
        id: "pc_spec",
        ramDetail: pending.ramDetailedInputEnabled ? pending.ramProductName.trim() : undefined,
        ssdDetail: pending.ssdDetailedInputEnabled ? pending.ssdProductName.trim() : undefined,
        ...pending,
      });
      setSavedMessage("로그인 완료! 이전에 스캔한 사양이 자동으로 등록됐어요.");
      showToast("로그인 완료! 사양이 자동으로 등록됐어요.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- user가 로그인 상태로 바뀌는 순간에만 1회 실행
  }, [user]);

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

    if (!series && !detail) return "미등록";

    return `${brand || "브랜드 미지정"} ${series || ""}${detail ? ` ${detail}` : ""}`.trim();
  }, [savedSnapshot]);
  const snapshotRam = useMemo(() => {
    if (!savedSnapshot) return "미등록";
    const count = savedSnapshot.ramCount && savedSnapshot.ramCount > 0 ? savedSnapshot.ramCount : 1;
    const totalGb = totalRamGb(savedSnapshot.ramCapacity, count);
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

  // pendingConfirm.next를 실제 UpsertSavedPcSpecInput 형태로 변환 — 확인("예")과 화면 반영("아니요")
  // 양쪽에서 공유한다.
  const buildInputFromNext = (next: ScanDerivedState): UpsertSavedPcSpecInput => ({
    cpuId: next.cpu,
    gpuId: next.gpu,
    ramCapacity: next.ramCapacity,
    ramCount: next.ramCount,
    ramDetailedInputEnabled: next.ramDetailedInputEnabled,
    ramProductName: next.ramProductName,
    ssdCapacity: next.ssdCapacityOption,
    ssdDetailedInputEnabled: next.ssdDetailedInputEnabled,
    ssdProductName: next.ssdProductName,
    mbSeries: next.mbSeries,
    mbDetail: next.mbDetail,
    mbBrand,
    psuWatt,
    hasCase,
    monitorResolution: next.monitorResolution,
    monitorRefreshRate: next.monitorRefreshRate,
    monitorCount,
    commandScanRawText,
  });

  const handleParsedResult = (result: ParseCommandOutputResult): boolean => {
    const { next, message, hasAnyMatch } = resolveScanUpdates(result, {
      cpu,
      gpu,
      ramCapacity,
      ramCount,
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

    // 아무것도 인식 못 했으면 붙여넣은 내용은 그대로 두고(절대 지우지 않음) 인라인 에러만 보여준다 —
    // 이 경우엔 확인 단계 자체를 띄우지 않는다.
    if (!hasAnyMatch) {
      setScanErrorMessage(message);
      setScanStatusMessage("");
      setPendingConfirm(null);
      return false;
    }
    setScanErrorMessage("");
    setScanStatusMessage(message);
    setNoSaveNotice("");
    // 곧바로 저장/반영하지 않고 "이 사양으로 등록할까요?" 확인 카드를 먼저 띄운다.
    setPendingConfirm({ result, next });
    return true;
  };

  const handleConfirmYes = async () => {
    if (!pendingConfirm) return;
    const input = buildInputFromNext(pendingConfirm.next);
    applySpecToForm(input);

    if (!user) {
      // 값을 잃지 않도록 세션스토리지에 잠깐 보관하고 로그인으로 보낸다 — 로그인 완료 후
      // register-pc로 돌아오면 위쪽 useEffect가 자동으로 이어서 저장한다.
      savePendingScanSpec(input);
      setPendingConfirm(null);
      router.push("/login");
      return;
    }

    const { error } = await upsertSavedPcSpec(input);
    if (error) {
      setScanErrorMessage(error);
      setPendingConfirm(null);
      return;
    }

    setSavedSnapshot({
      id: savedSnapshot?.id ?? "pc_spec",
      ramDetail: input.ramDetailedInputEnabled ? input.ramProductName.trim() : undefined,
      ssdDetail: input.ssdDetailedInputEnabled ? input.ssdProductName.trim() : undefined,
      ...input,
    });
    setSavedMessage("내 PC로 등록됐어요.");
    showToast("등록이 완료됐어요.");
    setPendingConfirm(null);
  };

  const handleConfirmNo = () => {
    if (!pendingConfirm) return;
    const input = buildInputFromNext(pendingConfirm.next);
    // DB에는 저장하지 않고 현재 화면(폼 상태)에만 일회성으로 반영한다.
    applySpecToForm(input);
    setPendingConfirm(null);
    setNoSaveNotice("이번 사양은 저장되지 않아요. 지금 화면에서만 확인할 수 있어요 — 새로고침하거나 페이지를 벗어나면 사라져요.");
    showToast("이번 사양은 저장되지 않아요.");
  };

  const handleSave = async () => {
    if (!user) {
      showToast("등록하려면 로그인이 필요해요.");
      router.push("/login");
      return;
    }

    const nextCpuMissingError = cpu ? "" : "CPU를 선택해 주세요.";
    const nextGpuMissingError = gpu ? "" : "GPU를 선택해 주세요.";
    setCpuMissingError(nextCpuMissingError);
    setGpuMissingError(nextGpuMissingError);

    if (nextCpuMissingError || nextGpuMissingError) {
      const firstInvalidField = nextCpuMissingError ? cpuFieldRef.current : gpuFieldRef.current;
      firstInvalidField?.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("필수 항목을 선택해 주세요.");
      return;
    }

    const input = {
      cpuId: cpu,
      gpuId: gpu,
      ramCapacity,
      ramCount,
      ramDetailedInputEnabled,
      ramProductName,
      ssdCapacity: ssdCapacityOption,
      ssdDetailedInputEnabled,
      ssdProductName,
      mbSeries,
      mbDetail,
      mbBrand,
      psuWatt,
      hasCase,
      monitorResolution,
      monitorRefreshRate,
      monitorCount,
      commandScanRawText,
    };

    const { error } = await upsertSavedPcSpec(input);
    if (error) {
      showToast(error);
      return;
    }

    setSavedSnapshot({
      id: savedSnapshot?.id ?? "pc_spec",
      ramDetail: input.ramDetailedInputEnabled ? input.ramProductName.trim() : undefined,
      ssdDetail: input.ssdDetailedInputEnabled ? input.ssdProductName.trim() : undefined,
      ...input,
    });

    setSavedMessage("내 컴퓨터 사양이 저장되었습니다.");
    showToast("변경사항 저장이 완료되었습니다.");
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(powerShellScanCommand);
      setIsCommandCopied(true);
      showToast("명령어가 복사되었습니다.");
      window.setTimeout(() => setIsCommandCopied(false), 2000);
    } catch {
      setIsCommandCopied(false);
      showToast("복사에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const handleCopyLegacyCommand = async () => {
    try {
      await navigator.clipboard.writeText(legacyWmicScanCommand);
      setIsLegacyCommandCopied(true);
      showToast("구버전 명령어가 복사되었습니다.");
      window.setTimeout(() => setIsLegacyCommandCopied(false), 2000);
    } catch {
      setIsLegacyCommandCopied(false);
      showToast("복사에 실패했습니다. 다시 시도해 주세요.");
    }
  };

  const handleAutoRegisterFromCommand = () => {
    if (!commandScanRawText.trim()) {
      setScanErrorMessage("붙여넣은 내용이 없어요 — PowerShell 결과를 먼저 붙여넣어 주세요.");
      return;
    }
    const parsed = parseSpecOutput(commandScanRawText);
    handleParsedResult(parsed);
  };

  const handleScanTextPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = event.clipboardData.getData("text");
    if (!pastedText.trim()) return;

    event.preventDefault();
    setCommandScanRawText(pastedText);

    const parsed = parseSpecOutput(pastedText);
    const succeeded = handleParsedResult(parsed);
    if (succeeded) {
      showToast("붙여넣은 내용을 분석했어요 — 아래에서 등록 여부를 확인해 주세요.");
    }
  };

  // 확인 카드에 보여줄 값들 — pendingConfirm이 있을 때만 계산한다.
  const confirmCpuLabel = pendingConfirm ? (pendingConfirm.result.cpuLabel ?? pendingConfirm.result.cpuRaw ?? "인식하지 못했어요") : "";
  const confirmSsdLabel = pendingConfirm ? (pendingConfirm.result.ssdDetail ?? pendingConfirm.result.ssdCapacity ?? "인식하지 못했어요") : "";
  const confirmGpuLabel = pendingConfirm ? (gpus.find((g) => g.id === pendingConfirm.next.gpu)?.name ?? "선택된 그래픽카드가 없어요") : "";
  const confirmRamLabel = pendingConfirm
    ? pendingConfirm.result.ramMismatch
      ? null
      : (pendingConfirm.result.ramDetail ?? pendingConfirm.result.ramCapacity ?? "인식하지 못했어요")
    : "";
  const confirmIsLaptop = pendingConfirm ? pendingConfirm.result.cpuIsLaptop || gpuIsLaptop : false;

  const handleVideoGuideClick = () => {
    showToast("영상 가이드는 준비 중입니다.");
  };

  return (
    <main className="min-h-screen bg-ink px-6 py-10 text-white">
      {toastMessage ? (
        <div className="fixed right-6 top-20 z-[90] rounded-xl bg-surface px-4 py-2 text-sm font-semibold text-good shadow-card ring-1 ring-good/25">
          {toastMessage}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <MyPageTabs activeTab="register" />

        <p className="rounded-xl bg-white/[0.03] px-4 py-2.5 text-xs text-white/50 ring-1 ring-line">
          현재 데스크탑 PC를 기준으로 진단합니다.
        </p>

        {!user ? (
          <div className="rounded-2xl bg-brand/10 px-4 py-3 text-sm text-brand-soft ring-1 ring-brand/25">
            로그인 없이도 사양을 스캔하고 확인할 수 있어요. 내 PC로 등록하려면{" "}
            <Link href="/login" className="font-semibold underline underline-offset-2 hover:text-white">
              로그인
            </Link>
            이 필요해요.
          </div>
        ) : null}

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
            <p className="mb-3 text-sm text-white/60">CMD 결과 붙여넣기만 하면 주요 부품을 자동 인식합니다.</p>

            {gpuAutoDetectedId ? (
              <div className="mb-3 flex items-center gap-2 rounded-2xl bg-good/10 p-4 text-sm font-semibold text-good ring-1 ring-good/25">
                <span aria-hidden="true">✓</span>
                <span>그래픽카드는 이미 자동으로 인식했어요 — 아래 명령어 결과로는 CPU·RAM·SSD만 채워주세요.</span>
              </div>
            ) : (
              <div className="mb-3">
                <GpuAutoDetect
                  onGpuSelected={(gpuId, rawGpu) => {
                    handleGpuModelSelect(gpuId);
                    setGpuAutoDetectedId(gpuId);
                    setGpuAutoDetectedRaw(rawGpu);
                  }}
                />
              </div>
            )}

            <p className="mb-3 rounded-xl bg-white/[0.03] px-4 py-2.5 text-xs leading-relaxed text-white/50 ring-1 ring-line">
              이 명령어는 CPU·그래픽카드·메모리·저장장치의 모델명만 확인하며, 개인 파일이나 다른 정보는 조회하지 않습니다.
            </p>

            <Card className="p-4" muted>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleVideoGuideClick}
                  className="inline-flex h-10 items-center rounded-xl bg-white/[0.04] px-4 text-sm font-medium text-white/75 ring-1 ring-line transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  영상으로 쉽게 따라하기 🎬
                </button>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-warn/10 px-2.5 py-1 text-xs font-semibold text-warn ring-1 ring-warn/25">
                  영상 가이드는 준비 중입니다
                </span>
              </div>

              <div className="mt-3 space-y-3 text-sm text-white/60">
                <Card className="p-3">
                  <p className="font-semibold text-white/90">1단계: PowerShell 열기</p>
                  <p className="mt-1 leading-6">키보드의 윈도우 키를 누른 채로 X를 누른 뒤, 나오는 목록에서 "Windows PowerShell" 또는 "터미널"을 클릭하세요. (파란색 또는 검은색 창이 켜집니다)</p>
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">2단계: 마법 주문 복사하기</p>
                  <p className="mt-1 leading-6">아래 버튼을 누르면 CPU·메모리·저장장치를 찾아내는 명령어가 자동으로 복사됩니다(그래픽카드는 이미 위에서 자동으로 확인했어요).</p>
                  <div className="mt-2 overflow-x-auto rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-brand-soft ring-1 ring-line">
                    <code className="whitespace-nowrap">{powerShellScanCommand}</code>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    {isCommandCopied ? "복사됨 ✓" : "명령어 복사하기 📋"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLegacyCommandOpen((prev) => !prev)}
                    aria-expanded={isLegacyCommandOpen}
                    className="mt-3 block text-xs font-semibold text-white/45 underline decoration-dotted transition hover:text-white/70"
                  >
                    구버전 Windows(10 이하)는 이 명령을 쓰세요 {isLegacyCommandOpen ? "▲" : "▼"}
                  </button>
                  {isLegacyCommandOpen ? (
                    <div className="mt-2 space-y-2">
                      <div className="overflow-x-auto rounded-xl bg-white/[0.03] px-3 py-2 text-xs text-white/60 ring-1 ring-line">
                        <code className="whitespace-nowrap">{legacyWmicScanCommand}</code>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyLegacyCommand}
                        className="inline-flex h-9 items-center rounded-xl bg-white/[0.04] px-3 text-xs font-semibold text-white/75 ring-1 ring-line transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        {isLegacyCommandCopied ? "복사됨 ✓" : "구버전 명령어 복사하기 📋"}
                      </button>
                      <p className="text-xs leading-5 text-white/40">이 명령은 "cmd"라고 검색해 나오는 검은 창에 붙여넣어야 해요(PowerShell 아님).</p>
                    </div>
                  ) : null}
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">3단계: PowerShell 창에 붙여넣고 엔터</p>
                  <p className="mt-1 leading-6">켜진 창에 마우스 우클릭을 하거나 Ctrl + V를 눌러 붙여넣은 뒤, 엔터(Enter) 키를 탁 치세요.</p>
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">4단계: 결과물 전체 복사하기</p>
                  <p className="mt-1 leading-6">창에 글자들이 주르륵 나타나면, 마우스로 글자 전체를 드래그해서 복사(Ctrl + C)하세요.</p>
                  <button
                    type="button"
                    onClick={() => setIsExampleOpen(true)}
                    className="mt-3 inline-flex h-9 items-center rounded-xl bg-white/[0.04] px-3 text-xs font-semibold text-white/75 ring-1 ring-line transition hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    💡 예시 화면 보기
                  </button>
                  {isExampleOpen ? (
                    <div
                      role="presentation"
                      onClick={() => setIsExampleOpen(false)}
                      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
                    >
                      <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="scan-example-modal-title"
                        onClick={(event) => event.stopPropagation()}
                        className="w-full max-w-lg rounded-2xl bg-surface p-4 ring-1 ring-line"
                      >
                        <div className="flex items-center justify-between">
                          <p id="scan-example-modal-title" className="text-sm font-semibold text-white/90">
                            결과 화면 예시
                          </p>
                          <button
                            type="button"
                            onClick={() => setIsExampleOpen(false)}
                            aria-label="닫기"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            ✕
                          </button>
                        </div>
                        <pre className="mt-3 overflow-x-auto rounded-xl bg-white/[0.03] p-3 text-xs text-white/70 ring-1 ring-line">
{`CPU:\nAMD Ryzen 5 5600 6-Core Processor\n\nSSD:\nSamsung SSD 970 EVO Plus 500GB\n\nRAM:\nTotal 32 GB (16GB x 2ea / DDR4 3200MHz / Samsung)`}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </Card>

                <Card className="p-3">
                  <p className="font-semibold text-white/90">5단계: 아래 칸에 붙여넣고 끝내기</p>
                  <p className="mt-1 leading-6">복사한 글자를 아래 커다란 상자에 붙여넣고 사양 확인하기 버튼을 누르면, 인식된 부품을 보여드리고 등록 여부를 물어봐요.</p>
                </Card>
              </div>

              <div className="mt-4">
                <label htmlFor="scan-raw-text" className="text-sm font-medium text-white/60">
                  CMD 결과 붙여넣기
                </label>
                <textarea
                  id="scan-raw-text"
                  value={commandScanRawText}
                  onChange={(event) => {
                    setCommandScanRawText(event.target.value);
                    setScanErrorMessage("");
                  }}
                  onPaste={handleScanTextPaste}
                  placeholder="PowerShell 실행 결과를 여기에 붙여넣어 주세요."
                  aria-invalid={scanErrorMessage ? true : undefined}
                  className="mt-2 h-40 w-full rounded-xl bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 ring-1 ring-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
                <button
                  type="button"
                  onClick={handleAutoRegisterFromCommand}
                  className="mt-3 inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  사양 확인하기
                </button>
              </div>

              {scanErrorMessage ? (
                <p role="alert" className="mt-4 rounded-xl bg-bad/10 px-4 py-3 text-sm text-bad ring-1 ring-bad/25">
                  {scanErrorMessage}
                </p>
              ) : noSaveNotice ? (
                <p className="mt-4 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn ring-1 ring-warn/25">{noSaveNotice}</p>
              ) : null}

              {pendingConfirm ? (
                <Card className="mt-4 p-4" muted>
                  <p className="text-sm font-semibold text-white/90">인식된 부품</p>
                  {scanStatusMessage ? <p className="mt-1 text-xs text-white/40">{scanStatusMessage}</p> : null}

                  {confirmIsLaptop ? (
                    <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-xs font-medium text-warn ring-1 ring-warn/25">
                      노트북 사양으로 보여요 — 현재는 데스크탑 PC 기준으로만 정확한 진단을 제공해요.
                    </p>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <ConfirmSpecTile emoji="🧠" label="CPU" value={confirmCpuLabel} source="방금 입력한 내용에서 인식" />
                    <ConfirmSpecTile emoji="🎮" label="GPU" value={confirmGpuLabel} source="자동 감지됨 · 브라우저 확인" />
                    <ConfirmSpecTile
                      emoji="⚡"
                      label="RAM"
                      value={confirmRamLabel ?? "램 용량이 서로 달라 자동 인식이 어려워요"}
                      source={confirmRamLabel ? "방금 입력한 내용에서 인식" : "직접 입력해 주세요"}
                    />
                    <ConfirmSpecTile emoji="💾" label="SSD" value={confirmSsdLabel} source="방금 입력한 내용에서 인식" />
                  </div>

                  <p className="mt-4 text-sm font-medium text-white/85">이 사양으로 내 PC 등록할까요?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleConfirmYes}
                      className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      예, 등록할게요
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmNo}
                      className="inline-flex h-10 items-center rounded-xl bg-white/[0.06] px-4 text-sm font-semibold text-white/75 ring-1 ring-line transition hover:bg-white/[0.1]"
                    >
                      아니요, 이번만 볼게요
                    </button>
                  </div>
                </Card>
              ) : scanStatusMessage ? (
                <p className="mt-4 rounded-xl bg-good/10 px-4 py-3 text-sm text-good ring-1 ring-good/25">{scanStatusMessage}</p>
              ) : null}
            </Card>
          </AccordionSection>

          <AccordionSection title="내 PC 직접 입력" isOpen={openSection === "manual"} onToggle={() => setOpenSection((prev) => (prev === "manual" ? null : "manual"))}>
            <div className="space-y-4">
              <div ref={cpuFieldRef}>
                <CascadingPartSelect title="CPU" state={{ ...cpuCascade, selectModel: handleCpuModelSelect }} error={cpuMissingError} />
              </div>

              <div ref={gpuFieldRef}>
                <CascadingPartSelect title="GPU" state={{ ...gpuCascade, selectModel: handleGpuModelSelect }} error={gpuMissingError} />
              </div>

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
                  총 RAM 용량: {totalRamGb(ramCapacity, ramCount)}GB ({ramCapacity} x {ramCount})
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
                      <div className="mt-2">
                        <DarkSelect
                          id="monitor-refresh-rate"
                          value={monitorRefreshRate}
                          onChange={(event) => setMonitorRefreshRate(Number(event.target.value))}
                        >
                          {REFRESH_RATE_STEPS.map((hz) => (
                            <option key={hz} value={hz}>
                              {hz}Hz
                            </option>
                          ))}
                        </DarkSelect>
                      </div>
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

/** 확인 카드용 부품 타일 — 값 출처(자동 감지/방금 입력한 내용에서 인식 등)를 배지로 함께 보여준다. */
function ConfirmSpecTile({ emoji, label, value, source }: { emoji: string; label: string; value: string; source: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-line">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-soft">
        {emoji} {label}
      </p>
      <p className="mt-1.5 break-words text-sm text-white/85">{value}</p>
      <span className="mt-1.5 inline-flex rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-white/45">{source}</span>
    </div>
  );
}
