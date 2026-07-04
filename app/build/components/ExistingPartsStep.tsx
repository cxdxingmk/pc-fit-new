"use client";

import { useMemo, type ReactNode } from "react";
import { cpus } from "../../database/cpu";
import { motherboards } from "../../database/motherboard";
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
const powerWattageOptions = ["500W", "600W", "650W", "700W", "750W", "800W", "850W", "1000W", "1000W 이상"] as const;
const motherboardSeriesGroups: ReadonlyArray<{ label: string; chipsets: readonly string[] }> = [
  { label: "인텔 최고급형 (Z890 / Z790)", chipsets: ["Z890", "Z790"] },
  { label: "인텔 중급형 (B860 / B760)", chipsets: ["B860", "B760"] },
  { label: "인텔 보급형 (H610)", chipsets: ["H610"] },
  { label: "AMD 최고급형 (X870 / X670)", chipsets: ["X870", "X670"] },
  { label: "AMD 중급형 (B650)", chipsets: ["B650"] },
  { label: "AMD 보급형 (A620)", chipsets: ["A620"] },
];

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

    const motherboardModelsBySeries = motherboardSeriesGroups.reduce((acc, group) => {
      acc[group.label] = motherboards
        .filter((board) => group.chipsets.includes(board.chipset))
        .map((board) => board.name);
      return acc;
    }, {} as Record<string, readonly string[]>);

    return {
      cpu: {
        brands: cpuBrandOptions,
        modelsByBrand: cpuModelsByBrand,
      },
      motherboard: {
        seriesOptions: motherboardSeriesGroups,
        modelsBySeries: motherboardModelsBySeries,
      },
    };
  }, []);

  const renderToggleCard = (title: string, description: string, enabled: boolean, onToggle: () => void, children: ReactNode) => (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white p-4">
        <div>
          <p className="text-lg font-semibold text-slate-900">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <label className="flex items-center gap-3 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={enabled} onChange={onToggle} className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
          보유 중
        </label>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${enabled ? "max-h-[1000px] px-4 py-5" : "max-h-0 px-4 py-0"}`}>
        {enabled && children}
      </div>
    </div>
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-500">2단계 · 보유 부품 입력</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">보유 부품 기준으로 더 정확한 세트를 추천합니다</h2>
        <p className="mt-2 text-sm text-slate-600">
          체크한 항목만 입력하면 됩니다. CPU와 메인보드는 제조사 → 모델로, SSD/HDD/파워는 규격만 빠르게 선택할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-4">
        {renderToggleCard(
          "CPU",
          "제조사와 실제 모델을 선택하면 소켓 호환까지 바로 반영됩니다.",
          existingParts.CPU.enabled,
          () => updateExistingPart("CPU", { enabled: !existingParts.CPU.enabled, brand: existingParts.CPU.enabled ? "" : existingParts.CPU.brand, model: existingParts.CPU.enabled ? "" : existingParts.CPU.model }),
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-700">제조사</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {partOptions.cpu.brands.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => updateExistingPart("CPU", { brand, model: "" })}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.CPU.brand === brand ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>

            {existingParts.CPU.brand && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-700">모델명</p>
                <select
                  value={existingParts.CPU.model}
                  onChange={(event) => updateExistingPart("CPU", { model: event.target.value })}
                  className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
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
          "SSD",
          "저장 용량 기준으로 빠르게 선택합니다.",
          existingParts.SSD.enabled,
          () => updateExistingPart("SSD", { enabled: !existingParts.SSD.enabled, capacity: existingParts.SSD.enabled ? "" : existingParts.SSD.capacity }),
          <div className="grid gap-2 sm:grid-cols-2">
            {ssdCapacityOptions.map((capacity) => (
              <button
                key={capacity}
                type="button"
                onClick={() => updateExistingPart("SSD", { capacity })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.SSD.capacity === capacity ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
              >
                {capacity}
              </button>
            ))}
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
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.HDD.capacity === capacity ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
              >
                {capacity}
              </button>
            ))}
          </div>
        )}

        {renderToggleCard(
          "메인보드",
          "칩셋 시리즈로 먼저 선택한 뒤, 해당 시리즈의 표준 규격 모델을 고릅니다.",
          existingParts.Motherboard.enabled,
          () => updateExistingPart("Motherboard", { enabled: !existingParts.Motherboard.enabled, series: existingParts.Motherboard.enabled ? "" : existingParts.Motherboard.series, model: existingParts.Motherboard.enabled ? "" : existingParts.Motherboard.model }),
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-slate-700">칩셋 시리즈</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {partOptions.motherboard.seriesOptions.map((series) => (
                  <button
                    key={series.label}
                    type="button"
                    onClick={() => updateExistingPart("Motherboard", { series: series.label, model: "" })}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.Motherboard.series === series.label ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
                  >
                    {series.label}
                  </button>
                ))}
              </div>
            </div>

            {existingParts.Motherboard.series && (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-700">표준 모델명</p>
                <select
                  value={existingParts.Motherboard.model}
                  onChange={(event) => updateExistingPart("Motherboard", { model: event.target.value })}
                  className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">모델을 선택하세요</option>
                  {partOptions.motherboard.modelsBySeries[existingParts.Motherboard.series].map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}
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
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${existingParts.Power.wattage === wattage ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
              >
                {wattage}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-slate-900">케이스</p>
              <p className="mt-1 text-sm text-slate-500">보유 여부에 따라 케이스 비용을 포함하거나 제외합니다.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${caseOwnership === "owned" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"}`}>
              <input type="radio" name="caseOwnership" checked={caseOwnership === "owned"} onChange={() => setCaseOwnership("owned")} className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500" />
              케이스 보유 중
            </label>
            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${caseOwnership === "none" ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700"}`}>
              <input type="radio" name="caseOwnership" checked={caseOwnership === "none"} onChange={() => setCaseOwnership("none")} className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500" />
              케이스 없음 (신규 구매)
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
