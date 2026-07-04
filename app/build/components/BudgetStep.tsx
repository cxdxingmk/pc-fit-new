"use client";

import { ChangeEvent } from "react";
import type { BudgetOption } from "../../context/BuildContext";

type Props = {
  selectedBudget: BudgetOption | null;
  customRaw: string;
  customValue: number | null;
  onPresetSelect: (preset: BudgetOption) => void;
  onCustomChange: (raw: string, value: number | null) => void;
};

const budgetOptions: BudgetOption[] = [
  "100만원 이하",
  "100~150만원",
  "150~200만원",
  "200~300만원",
  "300만원 이상",
  "기타",
];

const formatNumber = (value: string) => {
  const numeric = value.replace(/[^0-9]/g, "");
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default function BudgetStep({
  selectedBudget,
  customRaw,
  customValue,
  onPresetSelect,
  onCustomChange,
}: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-500">3단계 · 예산 설정</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">예산을 선택하거나 직접 입력하세요</h2>
        <p className="mt-2 text-sm text-slate-600">정확한 비용을 알고 있다면 ‘기타’에서 직접 입력할 수 있습니다.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {budgetOptions.map((option) => {
          const active = selectedBudget === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onPresetSelect(option)}
              className={`rounded-3xl border px-5 py-5 text-left transition ${
                active
                  ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{option}</span>
                {active && <span className="rounded-full bg-blue-600 px-3 py-1 text-xs text-white">선택됨</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedBudget === "기타" && (
        <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <label className="block text-sm font-semibold text-slate-900">직접 입력 예산</label>
          <div className="mt-3 flex gap-3">
            <input
              type="text"
              value={customRaw}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const formatted = formatNumber(e.target.value);
                onCustomChange(formatted, Number(formatted.replace(/,/g, "")) || null);
              }}
              placeholder="예: 1,250,000"
              className="w-full rounded-3xl border border-blue-300 bg-white px-4 py-4 text-lg font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="inline-flex items-center rounded-3xl border border-slate-200 bg-slate-100 px-4 text-sm text-slate-700">원</span>
          </div>
          <p className="mt-3 text-sm text-slate-600">숫자만 입력하면 자동으로 천 단위 콤마가 적용됩니다.</p>
        </div>
      )}

      {selectedBudget === "기타" && customValue !== null && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          현재 설정된 예산: <span className="font-semibold">{customValue.toLocaleString()}원</span>
        </div>
      )}
    </section>
  );
}
