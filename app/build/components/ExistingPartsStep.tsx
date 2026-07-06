"use client";

import { useMemo, type ReactNode } from "react";
import { cpus } from "../../database/cpu";
import { gpus } from "../../database/gpu";
import { motherboards } from "../../database/motherboard";
import { rams } from "../../database/ram";
import { ssds } from "../../database/ssd";
import type { ExistingPartsState, CaseOwnershipOption } from "../../types/build";

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

function matchBrand(typed: string, catalog: { name: string; brand: string }[]): string {
  const q = typed.trim().toLowerCase();
  if (!q) return "";
  const hit = catalog.find((x) => x.name.toLowerCase().includes(q) || q.includes(x.name.toLowerCase()));
  return hit?.brand ?? "";
}

export default function ExistingPartsStep({
  existingParts,
  updateExistingPart,
  caseOwnership,
  setCaseOwnership,
}: Props) {
  const partOptions = useMemo(() => {
    const cpuModelsByBrand = cpuBrandOptions.reduce((acc, brand) => {
      acc[brand] = cpus
        .filter((cpu) => cpu.brand === brand)
        .map((cpu) => cpu.name);
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
      acc[brand] = gpus
        .filter((gpu) => gpu.brand === brand)
        .sort((a, b) => b.releaseYear - a.releaseYear)
        .map((gpu) => gpu.name);
      return acc;
    }, {} as Record<string, readonly string[]>);

    return {
      cpu: {
        brands: cpuBrandOptions,
        modelsByBrand: cpuModelsByBrand,
      },
      gpu: {
        brands: gpuBrands,
        modelsByBrand: gpuModelsByBrand,
      },
      motherboard: {
        seriesOptions: motherboardSeriesOptions,
        detailBySeries: motherboardDetailBySeries,
      },
    };
  }, []);

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
          "규격/용량 입력과 함께 모델명과 제조사를 선택 입력할 수 있습니다.",
          existingParts.RAM.enabled,
          () => updateExistingPart("RAM", { enabled: !existingParts.RAM.enabled, ddr: existingParts.RAM.enabled ? "" : existingParts.RAM.ddr, capacity: existingParts.RAM.enabled ? "" : existingParts.RAM.capacity, brand: existingParts.RAM.enabled ? "" : (existingParts.RAM.brand ?? ""), model: existingParts.RAM.enabled ? "" : existingParts.RAM.model }),
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-300">메모리 규격</p>
                <div className="grid gap-2 grid-cols-2">
                  {ramDdrOptions.map((ddr) => (
                    <button
                      key={ddr}
                      type="button"
                      onClick={() => updateExistingPart("RAM", { ddr })}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.RAM.ddr === ddr ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"}`}
                    >
                      {ddr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-300">용량</p>
                <select
                  value={existingParts.RAM.capacity}
                  onChange={(event) => updateExistingPart("RAM", { capacity: event.target.value as ExistingPartsState["RAM"]["capacity"] })}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-100 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">용량 선택</option>
                  {ramCapacityOptions.map((capacity) => (
                    <option key={capacity} value={capacity}>{capacity}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                모델명
                <input
                  type="text"
                  value={existingParts.RAM.model}
                  onChange={(event) => {
                    const nextModel = event.target.value;
                    const matchedBrand = matchBrand(nextModel, rams.map((ram) => ({ name: ram.name, brand: ram.brand })));
                    updateExistingPart("RAM", { model: nextModel, brand: matchedBrand });
                  }}
                  placeholder="예: DDR5-5600 CL46"
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                브랜드 (자동완성)
                <input
                  type="text"
                  value={existingParts.RAM.brand ?? ""}
                  onChange={(event) => updateExistingPart("RAM", { brand: event.target.value })}
                  placeholder="예: 삼성전자, SK하이닉스"
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </label>
            </div>
          </div>
        )}

        {renderToggleCard(
          "SSD",
          "저장 용량과 함께 모델명/제조사를 선택 입력으로 추가할 수 있습니다.",
          existingParts.SSD.enabled,
          () => updateExistingPart("SSD", { enabled: !existingParts.SSD.enabled, capacity: existingParts.SSD.enabled ? "" : existingParts.SSD.capacity, brand: existingParts.SSD.enabled ? "" : (existingParts.SSD.brand ?? ""), model: existingParts.SSD.enabled ? "" : existingParts.SSD.model }),
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {ssdCapacityOptions.map((capacity) => (
                <button
                  key={capacity}
                  type="button"
                  onClick={() => updateExistingPart("SSD", { capacity })}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.SSD.capacity === capacity ? "border-cyan-500 bg-cyan-500/10 text-cyan-300" : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"}`}
                >
                  {capacity}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                모델명
                <input
                  type="text"
                  value={existingParts.SSD.model}
                  onChange={(event) => {
                    const nextModel = event.target.value;
                    const matchedBrand = matchBrand(nextModel, ssds.map((ssd) => ({ name: ssd.name, brand: ssd.brand })));
                    updateExistingPart("SSD", { model: nextModel, brand: matchedBrand });
                  }}
                  placeholder="예: 980 PRO"
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                브랜드 (자동완성)
                <input
                  type="text"
                  value={existingParts.SSD.brand ?? ""}
                  onChange={(event) => updateExistingPart("SSD", { brand: event.target.value })}
                  placeholder="예: 삼성전자, WD"
                  className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                />
              </label>
            </div>
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
