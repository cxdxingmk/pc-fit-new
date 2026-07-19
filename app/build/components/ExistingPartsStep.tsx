"use client";

import { useMemo, useState, type ReactNode } from "react";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { motherboards } from "../../database/motherboard";
import { getAllRams, getAllSsds, searchRamsByKeyword, searchSsdsByKeyword } from "../../../src/utils/hardwareLookup";
import type { ExistingPartsState, CaseOwnershipOption } from "../../types/build";
import { sortModelsByNumber } from "../../../components/ui/useCascadingPartSelect";

type Props = {
  existingParts: ExistingPartsState;
  updateExistingPart: <K extends keyof ExistingPartsState>(
    part: K,
    patch: Partial<ExistingPartsState[K]>
  ) => void;
  caseOwnership: CaseOwnershipOption;
  setCaseOwnership: (ownership: CaseOwnershipOption) => void;
};

const cpuBrandOptions = ["Intel", "AMD"] as const;
const ssdCapacityOptions = ["512GB", "1TB", "2TB", "4TB 이상"] as const;
const hddCapacityOptions = ["1TB", "2TB", "4TB", "8TB 이상"] as const;
const ramCapacityOptions = ["8GB", "16GB", "32GB", "64GB", "128GB"] as const;
const ramDdrOptions = ["DDR4", "DDR5"] as const;
const powerWattageOptions = ["500W", "600W", "650W", "700W", "750W", "800W", "850W", "1000W", "1000W 이상"] as const;
const motherboardSeriesOptions = ["Intel Z", "Intel B", "Intel H", "AMD X", "AMD B", "AMD A"] as const;
const motherboardBrandOptions = ["ASUS", "MSI", "GIGABYTE", "ASRock", "BIOSTAR", "기타"] as const;

function toRamCapacityOption(capacityGb: number): ExistingPartsState["RAM"]["capacity"] | "" {
  if (capacityGb >= 128) return "128GB";
  if (capacityGb >= 64) return "64GB";
  if (capacityGb >= 32) return "32GB";
  if (capacityGb >= 16) return "16GB";
  if (capacityGb >= 8) return "8GB";
  return "";
}

function toSsdCapacityOption(capacityGb: number): ExistingPartsState["SSD"]["capacity"] | "" {
  if (capacityGb >= 3800) return "4TB 이상";
  if (capacityGb >= 1800) return "2TB";
  if (capacityGb >= 900) return "1TB";
  if (capacityGb >= 450) return "512GB";
  return "";
}

export default function ExistingPartsStep({
  existingParts,
  updateExistingPart,
  caseOwnership,
  setCaseOwnership,
}: Props) {
  const [ramSearch, setRamSearch] = useState("");
  const [ssdSearch, setSsdSearch] = useState("");

  const partOptions = useMemo(() => {
    const cpuModelsByBrand = cpuBrandOptions.reduce((acc, brand) => {
      acc[brand] = sortModelsByNumber(
        cpus.filter((cpu) => cpu.brand === brand),
        (cpu) => cpu.name
      ).map((cpu) => cpu.name);
      return acc;
    }, {} as Record<string, readonly string[]>);

    const motherboardDetailBySeries = motherboardSeriesOptions.reduce((acc, series) => {
      const alpha = series.split(" ")[1];
      acc[series] = motherboards
        .filter((board) => board.chipset.startsWith(alpha))
        .map((board) => board.chipset.replace(alpha, ""))
        .filter(Boolean);
      return acc;
    }, {} as Record<string, readonly string[]>);

    const gpuBrands = Array.from(new Set(gpus.map((gpu) => gpu.brand)));
    const gpuModelsByBrand = gpuBrands.reduce((acc, brand) => {
      // 이 화면은 브랜드→모델 2단계라 시리즈로 먼저 묶지 않는다 — 그런데 이 카탈로그의 모델
      // 번호는 세대가 올라갈수록 값도 커지도록 매겨져 있어(GTX 900대→1000번대→RTX 20/30/40/
      // 50번대, RX 500→5000→6000→7000→9000번대) 번호 오름차순 정렬 하나만으로 세대별 묶임과
      // 숫자 순서가 동시에 맞아떨어진다. releaseYear 내림차순 정렬은 "5090, 5080, 5070,
      // 5050, 5060..."처럼 뒤섞이고 동일 연도 안에서도 세대가 묶이지 않는 문제가 있었다.
      acc[brand] = sortModelsByNumber(
        gpus.filter((gpu) => gpu.brand === brand),
        (gpu) => gpu.name
      ).map((gpu) => gpu.name);
      return acc;
    }, {} as Record<string, readonly string[]>);

    const allRams = getAllRams();
    const allSsds = getAllSsds();
    const ramBrands = Array.from(new Set(allRams.map((ram) => ram.manufacturer))).sort();
    const ssdBrands = Array.from(new Set(allSsds.map((ssd) => ssd.manufacturer))).sort();
    const matchedRams = searchRamsByKeyword(ramSearch)
      .filter((ram) => !existingParts.RAM.brand || ram.manufacturer === existingParts.RAM.brand)
      .sort((a, b) => b.speedMtps - a.speedMtps || b.capacityGb - a.capacityGb);
    const matchedSsds = searchSsdsByKeyword(ssdSearch)
      .filter((ssd) => !existingParts.SSD.brand || ssd.manufacturer === existingParts.SSD.brand)
      .sort((a, b) => b.readSpeedMbps - a.readSpeedMbps || b.capacityGb - a.capacityGb);

    return {
      cpu: {
        brands: cpuBrandOptions,
        modelsByBrand: cpuModelsByBrand,
      },
      gpu: {
        brands: gpuBrands,
        modelsByBrand: gpuModelsByBrand,
      },
      ram: {
        brands: ramBrands,
        models: matchedRams,
      },
      ssd: {
        brands: ssdBrands,
        models: matchedSsds,
      },
      motherboard: {
        seriesOptions: motherboardSeriesOptions,
        detailBySeries: motherboardDetailBySeries,
      },
    };
  }, [existingParts.RAM.brand, existingParts.SSD.brand, ramSearch, ssdSearch]);

  const renderToggleCard = (title: string, description: string, enabled: boolean, onToggle: () => void, children: ReactNode) => (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-slate-800/60 p-4">
        <div>
          <p className="text-lg font-semibold text-slate-100">{title}</p>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-300">
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            className="h-5 w-5 rounded border-white/20 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
          />
          보유 중
        </label>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${enabled ? "max-h-[1200px] px-4 py-5" : "max-h-0 px-4 py-0"}`}>
        {enabled && children}
      </div>
    </div>
  );

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/40">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-400">2단계 · 보유 부품 입력</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">보유 부품 기준으로 더 정확한 세트를 추천합니다</h2>
        <p className="mt-2 text-sm text-slate-400">체크한 항목만 입력하면 됩니다. 제조사 항목은 선택 입력이라 원할 때만 채우면 됩니다.</p>
      </div>

      <div className="grid gap-4">
        {renderToggleCard(
          "CPU",
          "제조사와 실제 모델을 선택하면 소켓 호환까지 바로 반영됩니다.",
          existingParts.CPU.enabled,
          () => updateExistingPart("CPU", { enabled: !existingParts.CPU.enabled, brand: existingParts.CPU.enabled ? "" : existingParts.CPU.brand, model: existingParts.CPU.enabled ? "" : existingParts.CPU.model }),
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-300">제조사</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {partOptions.cpu.brands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => updateExistingPart("CPU", { brand, model: "" })}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.CPU.brand === brand ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"}`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>

            {existingParts.CPU.brand && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-300">모델명</p>
                <select
                  value={existingParts.CPU.model}
                  onChange={(event) => updateExistingPart("CPU", { model: event.target.value })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">모델을 선택하세요</option>
                  {partOptions.cpu.modelsByBrand[existingParts.CPU.brand].map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {renderToggleCard(
          "GPU",
          "그래픽카드는 브랜드와 모델명을 함께 입력하면 분석 정확도가 올라갑니다.",
          existingParts.GPU.enabled,
          () => updateExistingPart("GPU", { enabled: !existingParts.GPU.enabled, brand: existingParts.GPU.enabled ? "" : existingParts.GPU.brand, manufacturer: existingParts.GPU.enabled ? "" : existingParts.GPU.manufacturer, model: existingParts.GPU.enabled ? "" : existingParts.GPU.model }),
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-300">브랜드</p>
              <select
                value={existingParts.GPU.brand}
                onChange={(event) => updateExistingPart("GPU", { brand: event.target.value as ExistingPartsState["GPU"]["brand"], model: "" })}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">브랜드를 선택하세요</option>
                {partOptions.gpu.brands.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            {existingParts.GPU.brand && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-300">모델명</p>
                <select
                  value={existingParts.GPU.model}
                  onChange={(event) => updateExistingPart("GPU", { model: event.target.value })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">모델을 선택하세요</option>
                  {partOptions.gpu.modelsByBrand[existingParts.GPU.brand].map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {renderToggleCard(
          "RAM",
          "CPU/GPU와 동일하게 검색 후 모델 선택으로 규격/용량을 자동 반영합니다.",
          existingParts.RAM.enabled,
          () => updateExistingPart("RAM", { enabled: !existingParts.RAM.enabled, ddr: existingParts.RAM.enabled ? "" : existingParts.RAM.ddr, capacity: existingParts.RAM.enabled ? "" : existingParts.RAM.capacity, brand: existingParts.RAM.enabled ? "" : (existingParts.RAM.brand ?? ""), model: existingParts.RAM.enabled ? "" : existingParts.RAM.model }),
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm text-slate-300">
                브랜드
                <select
                  value={existingParts.RAM.brand}
                  onChange={(event) => updateExistingPart("RAM", { brand: event.target.value, model: "" })}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">전체 브랜드</option>
                  {partOptions.ram.brands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300 sm:col-span-2">
                모델 검색
                <input
                  type="text"
                  value={ramSearch}
                  onChange={(event) => setRamSearch(event.target.value)}
                  placeholder="예: DDR5 5600, Samsung"
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-300">
              모델 선택
              <select
                value={existingParts.RAM.model}
                onChange={(event) => {
                  const selected = partOptions.ram.models.find((ram) => ram.model === event.target.value);
                  if (!selected) {
                    updateExistingPart("RAM", { model: event.target.value });
                    return;
                  }
                  updateExistingPart("RAM", {
                    model: selected.model,
                    brand: selected.manufacturer,
                    ddr: selected.type,
                    capacity: toRamCapacityOption(selected.capacityGb),
                  });
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">모델을 선택하세요</option>
                {partOptions.ram.models.map((ram) => (
                  <option key={ram.model} value={ram.model}>
                    {ram.model} ({ram.type} / {ram.capacityGb}GB / {ram.speedMtps}MT/s)
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                메모리 규격
                <select
                  value={existingParts.RAM.ddr}
                  onChange={(event) => updateExistingPart("RAM", { ddr: event.target.value as ExistingPartsState["RAM"]["ddr"] })}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">규격 선택</option>
                  {ramDdrOptions.map((ddr) => (
                    <option key={ddr} value={ddr}>{ddr}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                용량
                <select
                  value={existingParts.RAM.capacity}
                  onChange={(event) => updateExistingPart("RAM", { capacity: event.target.value as ExistingPartsState["RAM"]["capacity"] })}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">용량 선택</option>
                  {ramCapacityOptions.map((capacity) => (
                    <option key={capacity} value={capacity}>{capacity}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        )}

        {renderToggleCard(
          "SSD",
          "CPU/GPU와 동일하게 검색 후 모델 선택으로 용량/브랜드를 자동 반영합니다.",
          existingParts.SSD.enabled,
          () => updateExistingPart("SSD", { enabled: !existingParts.SSD.enabled, capacity: existingParts.SSD.enabled ? "" : existingParts.SSD.capacity, brand: existingParts.SSD.enabled ? "" : (existingParts.SSD.brand ?? ""), model: existingParts.SSD.enabled ? "" : existingParts.SSD.model }),
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm text-slate-300">
                브랜드
                <select
                  value={existingParts.SSD.brand}
                  onChange={(event) => updateExistingPart("SSD", { brand: event.target.value, model: "" })}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">전체 브랜드</option>
                  {partOptions.ssd.brands.map((brand) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                용량 필터
                <select
                  value={existingParts.SSD.capacity}
                  onChange={(event) => updateExistingPart("SSD", { capacity: event.target.value as ExistingPartsState["SSD"]["capacity"] })}
                  className="rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">전체 용량</option>
                  {ssdCapacityOptions.map((capacity) => (
                    <option key={capacity} value={capacity}>{capacity}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                모델 검색
                <input
                  type="text"
                  value={ssdSearch}
                  onChange={(event) => setSsdSearch(event.target.value)}
                  placeholder="예: Gen4, Samsung"
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-300">
              모델 선택
              <select
                value={existingParts.SSD.model}
                onChange={(event) => {
                  const selected = partOptions.ssd.models.find((ssd) => ssd.model === event.target.value);
                  if (!selected) {
                    updateExistingPart("SSD", { model: event.target.value });
                    return;
                  }
                  updateExistingPart("SSD", {
                    model: selected.model,
                    brand: selected.manufacturer,
                    capacity: toSsdCapacityOption(selected.capacityGb),
                  });
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
              >
                <option value="">모델을 선택하세요</option>
                {partOptions.ssd.models
                  .filter((ssd) => !existingParts.SSD.capacity || toSsdCapacityOption(ssd.capacityGb) === existingParts.SSD.capacity)
                  .map((ssd) => (
                    <option key={ssd.model} value={ssd.model}>
                      {ssd.model} ({ssd.deviceType} / {ssd.capacityGb}GB)
                    </option>
                  ))}
              </select>
            </label>
          </div>
        )}

        {renderToggleCard(
          "HDD",
          "대용량 보관용 HDD는 용량 규격만 선택하면 됩니다.",
          existingParts.HDD.enabled,
          () => updateExistingPart("HDD", { enabled: !existingParts.HDD.enabled, capacity: existingParts.HDD.enabled ? "" : existingParts.HDD.capacity }),
          <div className="grid gap-2 sm:grid-cols-2">
            {hddCapacityOptions.map((capacity) => (
              <button
                key={capacity}
                type="button"
                onClick={() => updateExistingPart("HDD", { capacity })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.HDD.capacity === capacity ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"}`}
              >
                {capacity}
              </button>
            ))}
          </div>
        )}

        {renderToggleCard(
          "메인보드",
          "칩셋 시리즈, 세부 제품명, 제조사를 한 번에 입력하면 호환 분석 정확도가 높아집니다.",
          existingParts.Motherboard.enabled,
          () => updateExistingPart("Motherboard", { enabled: !existingParts.Motherboard.enabled, series: existingParts.Motherboard.enabled ? "" : existingParts.Motherboard.series, manufacturer: existingParts.Motherboard.enabled ? "" : existingParts.Motherboard.manufacturer, model: existingParts.Motherboard.enabled ? "" : existingParts.Motherboard.model }),
          <div className="grid gap-4">
            <p className="text-sm font-semibold text-slate-300">브랜드 / 칩셋 시리즈 / 세부 제품명</p>
            <div className="grid grid-cols-12 gap-2">
              <select
                value={existingParts.Motherboard.manufacturer}
                onChange={(event) => updateExistingPart("Motherboard", { manufacturer: event.target.value })}
                className="col-span-3 rounded-2xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-slate-100"
              >
                <option value="">브랜드 선택</option>
                {motherboardBrandOptions.map((brand) => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>

              <select
                value={existingParts.Motherboard.series}
                onChange={(event) => updateExistingPart("Motherboard", { series: event.target.value, model: "" })}
                className="col-span-4 rounded-2xl border border-slate-700 bg-slate-800 px-3 py-3 text-sm text-slate-100"
              >
                <option value="">시리즈 선택</option>
                {partOptions.motherboard.seriesOptions.map((series) => (
                  <option key={series} value={series}>{series}</option>
                ))}
              </select>

              <input
                type="text"
                list="motherboard-detail-list"
                value={existingParts.Motherboard.model}
                onChange={(event) => updateExistingPart("Motherboard", { model: event.target.value })}
                placeholder="예: 790, 650, 610"
                className="col-span-5 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <datalist id="motherboard-detail-list">
                {(existingParts.Motherboard.series
                  ? partOptions.motherboard.detailBySeries[existingParts.Motherboard.series] ?? []
                  : ["890", "790", "760", "610", "870", "670", "650", "620"]
                ).map((detail) => (
                  <option key={detail} value={detail} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {renderToggleCard(
          "파워",
          "정격 와트 수만 선택하면 전력 호환성을 바로 반영합니다.",
          existingParts.Power.enabled,
          () => updateExistingPart("Power", { enabled: !existingParts.Power.enabled, wattage: existingParts.Power.enabled ? "" : existingParts.Power.wattage }),
          <div className="grid gap-2 sm:grid-cols-2">
            {powerWattageOptions.map((wattage) => (
              <button
                key={wattage}
                type="button"
                onClick={() => updateExistingPart("Power", { wattage })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.Power.wattage === wattage ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"}`}
              >
                {wattage}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-100">케이스</p>
              <p className="mt-1 text-sm text-slate-400">보유 여부에 따라 케이스 비용을 포함하거나 제외합니다.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${caseOwnership === "owned" ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>
              <input type="radio" name="caseOwnership" checked={caseOwnership === "owned"} onChange={() => setCaseOwnership("owned")} className="h-4 w-4 border-white/20 text-cyan-500 focus:ring-cyan-500" />
              케이스 보유 중
            </label>
            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${caseOwnership === "none" ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-slate-900/70 text-slate-300"}`}>
              <input type="radio" name="caseOwnership" checked={caseOwnership === "none"} onChange={() => setCaseOwnership("none")} className="h-4 w-4 border-white/20 text-cyan-500 focus:ring-cyan-500" />
              케이스 없음 (신규 구매)
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
