"use client";

import { useEffect, useMemo, useState } from "react";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { motherboards } from "../../database/motherboard";
import { useAuth } from "../../context/AuthContext";
import type { UserSavedPc } from "../../types/hardware";
import { HARDWARE_MASTER } from "../../data/hardwareMaster";
import PcScannerModal, { type ParseCommandOutputResult } from "../../../components/PcScannerModal";
import MyPageTabs from "../components/MyPageTabs";

const storageKey = "user_pc_spec";
const ramCapacityOptions = ["8GB", "16GB", "32GB", "64GB"] as const;
const ssdCapacityOptions = ["256GB", "512GB", "1TB", "2TB"] as const;
const monitorResolutionOptions = ["FHD", "QHD", "4K"] as const;

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
  mbChipsetAlpha?: "Z" | "X" | "B" | "A";
  mbChipsetNumber?: string;
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
  mbChipsetAlpha: "Z" as const,
  mbChipsetNumber: motherboards[0]?.chipset ?? "890",
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
  const [savedSnapshot, setSavedSnapshot] = useState<LocalSavedPc | null>(null);
  const [cpu, setCpu] = useState(initialSelection.cpuId);
  const [gpu, setGpu] = useState(initialSelection.gpuId);
  const [ramCapacity, setRamCapacity] = useState(initialSelection.ramCapacity);
  const [ramDetailedInputEnabled, setRamDetailedInputEnabled] = useState(initialSelection.ramDetailedInputEnabled);
  const [ramProductName, setRamProductName] = useState(initialSelection.ramProductName);
  const [mbChipsetAlpha, setMbChipsetAlpha] = useState<"Z" | "X" | "B" | "A">(initialSelection.mbChipsetAlpha);
  const [mbChipsetNumber, setMbChipsetNumber] = useState(initialSelection.mbChipsetNumber);
  const [ssdCapacityOption, setSsdCapacityOption] = useState(initialSelection.ssdCapacityOption);
  const [ssdDetailedInputEnabled, setSsdDetailedInputEnabled] = useState(initialSelection.ssdDetailedInputEnabled);
  const [ssdProductName, setSsdProductName] = useState(initialSelection.ssdProductName);
  const [psuWatt, setPsuWatt] = useState(initialSelection.psuWatt);
  const [hasCase, setHasCase] = useState(initialSelection.hasCase);
  const [monitorResolution, setMonitorResolution] = useState<(typeof monitorResolutionOptions)[number]>(initialSelection.monitorResolution);
  const [monitorRefreshRate, setMonitorRefreshRate] = useState(initialSelection.monitorRefreshRate);
  const [commandScanRawText, setCommandScanRawText] = useState(initialSelection.commandScanRawText);

  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
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
      if (parsed.mbChipsetAlpha) setMbChipsetAlpha(parsed.mbChipsetAlpha as "Z" | "X" | "B" | "A");
      if (parsed.mbChipsetNumber) setMbChipsetNumber(parsed.mbChipsetNumber);
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

  const selectedCpu = useMemo(() => cpus.find((item) => item.id === cpu) ?? cpus[0], [cpu]);
  const selectedGpu = useMemo(() => gpus.find((item) => item.id === gpu) ?? gpus[0], [gpu]);
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
    if (!savedSnapshot?.mbChipsetAlpha || !savedSnapshot?.mbChipsetNumber) return "미등록";
    const chipset = `${savedSnapshot.mbChipsetAlpha}${savedSnapshot.mbChipsetNumber}`;
    return motherboards.find((item) => item.chipset.toUpperCase() === chipset.toUpperCase())?.name ?? chipset;
  }, [savedSnapshot?.mbChipsetAlpha, savedSnapshot?.mbChipsetNumber]);
  const snapshotRam = useMemo(() => {
    if (!savedSnapshot) return "미등록";
    return savedSnapshot.ramDetail ? `${savedSnapshot.ramCapacity} (${savedSnapshot.ramDetail})` : savedSnapshot.ramCapacity;
  }, [savedSnapshot]);
  const snapshotSsd = useMemo(() => {
    if (!savedSnapshot) return "미등록";
    return savedSnapshot.ssdDetail ? `${savedSnapshot.ssdCapacity} (${savedSnapshot.ssdDetail})` : savedSnapshot.ssdCapacity;
  }, [savedSnapshot]);
  const finalRamSpec = ramDetailedInputEnabled && ramProductName.trim().length > 0 ? `${ramCapacity} (${ramProductName.trim()})` : ramCapacity;
  const finalSsdSpec = ssdDetailedInputEnabled && ssdProductName.trim().length > 0 ? `${ssdCapacityOption} (${ssdProductName.trim()})` : ssdCapacityOption;

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
    let nextMbChipsetAlpha = mbChipsetAlpha;
    let nextMbChipsetNumber = mbChipsetNumber;
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
      const parsedAlpha = result.motherboardChipset.slice(0, 1).toUpperCase();
      const parsedNumber = result.motherboardChipset.slice(1);
      if (["Z", "X", "B", "A"].includes(parsedAlpha) && parsedNumber.length > 0) {
        setMbChipsetAlpha(parsedAlpha as "Z" | "X" | "B" | "A");
        setMbChipsetNumber(parsedNumber);
        nextMbChipsetAlpha = parsedAlpha as "Z" | "X" | "B" | "A";
        nextMbChipsetNumber = parsedNumber;
        message += `${message ? " / " : ""}메인보드 자동 감지: ${result.motherboardChipset}`;
      }
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
        mbChipsetAlpha: nextMbChipsetAlpha,
        mbChipsetNumber: nextMbChipsetNumber,
        psuWatt,
        hasCase,
        commandScanRawText,
      };
      window.localStorage.setItem(storageKey, JSON.stringify(autoPayload));
      setSavedSnapshot(autoPayload);
      setSavedMessage("스캔 결과가 자동으로 등록 및 저장되었습니다.");
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
      commandScanRawText,
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }

    setSavedSnapshot(payload);

    setSavedMessage("내 컴퓨터 사양이 저장되었습니다.");
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
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <MyPageTabs activeTab="register" />

        <section className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">My Hardware Snapshot</p>
          <h2 className="mt-2 text-3xl font-semibold">현재 등록된 내 PC 정보 🖥️</h2>

          {!savedSnapshot ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/20 bg-black/20 px-5 py-6 text-sm text-slate-300">
              등록된 하드웨어가 없습니다
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">My Page</p>
          <h1 className="mt-2 text-3xl font-semibold">내 컴퓨터 사양 등록</h1>
          <p className="mt-3 text-sm text-slate-300">선택한 부품은 브라우저의 로컬 스토리지에 저장되어 다음 방문 때도 자동으로 복원됩니다.</p>

          <div className="mt-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <h2 className="text-2xl font-bold text-cyan-200">내 PC 사양 자동 인식</h2>
            <p className="mt-2 text-base text-slate-300">컴퓨터를 잘 몰라도 4단계만 따라 하면 CPU/GPU가 자동 선택됩니다.</p>
            <button
              type="button"
              onClick={() => setIsScanModalOpen(true)}
              className="mt-5 rounded-2xl bg-cyan-500 px-6 py-3 text-base font-black text-slate-950 transition hover:bg-cyan-400"
            >
              1분 자동 등록 시작하기
            </button>

            {scanStatusMessage ? (
              <p className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                {scanStatusMessage}
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">2. 보유 부품 입력 폼</h2>
            <div className="mt-6 space-y-4">
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

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  메인보드 알파벳 라인
                  <select value={mbChipsetAlpha} onChange={(event) => setMbChipsetAlpha(event.target.value as "Z" | "X" | "B" | "A")} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100">
                    <option value="Z">Z</option>
                    <option value="X">X</option>
                    <option value="B">B</option>
                    <option value="A">A</option>
                  </select>
                </label>

                <label className="block text-sm">
                  메인보드 세대 번호
                  <input value={mbChipsetNumber} onChange={(event) => setMbChipsetNumber(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-100" />
                </label>
              </div>

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
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">저장 미리보기</h2>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">선택한 CPU</p>
                <p className="mt-1">{selectedCpu?.name}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">선택한 GPU</p>
                <p className="mt-1">{selectedGpu?.name}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">메인보드</p>
                <p className="mt-1">{mbChipsetAlpha}{mbChipsetNumber}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">RAM / SSD</p>
                <p className="mt-1">RAM: {finalRamSpec}</p>
                <p className="mt-1">SSD: {finalSsdSpec}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">모니터 한계</p>
                <p className="mt-1">해상도: {monitorResolution}</p>
                <p className="mt-1">최대 주사율: {monitorRefreshRate}Hz</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-semibold text-white">저장 상태</p>
                <p className="mt-1">{savedMessage || "아직 저장되지 않았습니다."}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSave}
              className="mt-8 w-full rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              내 컴퓨터 사양 저장하기
            </button>
          </div>
        </section>
      </div>

      <PcScannerModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        scanText={commandScanRawText}
        setScanText={setCommandScanRawText}
        onParsed={handleParsedResult}
      />
    </main>
  );
}
