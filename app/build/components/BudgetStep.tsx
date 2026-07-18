"use client";

import { ChangeEvent, useState } from "react";
import BudgetRangeSlider from "../../../components/ui/BudgetRangeSlider";
import { BUDGET_SLIDER_MAX, BUDGET_SLIDER_MIN } from "../../context/BuildContext";
import type { BudgetMode, BudgetOption, BudgetRange } from "../../context/BuildContext";

type Props = {
  mode: BudgetMode;
  selectedBudget: BudgetOption | null;
  exactValue: number | null;
  range: BudgetRange | null;
  onModeChange: (mode: BudgetMode) => void;
  onPresetSelect: (preset: BudgetOption) => void;
  onExactChange: (value: number | null) => void;
  onRangeChange: (range: BudgetRange) => void;
};

const budgetOptions: BudgetOption[] = ["100만원 이하", "100~150만원", "150~200만원", "200~300만원", "300만원 이상"];

const formatWon = (value: number) => `${Math.round(value / 10000).toLocaleString()}만원`;

const formatThousands = (value: string) => {
  const numeric = value.replace(/[^0-9]/g, "");
  return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export default function BudgetStep({ mode, selectedBudget, exactValue, range, onModeChange, onPresetSelect, onExactChange, onRangeChange }: Props) {
  const [exactRaw, setExactRaw] = useState(exactValue !== null ? formatThousands(String(exactValue)) : "");

  const handleExactChange = (e: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatThousands(e.target.value);
    setExactRaw(formatted);
    const numeric = Number(formatted.replace(/,/g, "")) || null;
    // 서비스가 다루는 범위(50만원~1000만원) 밖이면 아직 확정하지 않는다 — 추천 로직에 비정상적인
    // 값이 들어가지 않도록, 범위 안으로 들어올 때까지는 경고만 보여주고 onExactChange는 null로 둔다.
    if (numeric !== null && (numeric < BUDGET_SLIDER_MIN || numeric > BUDGET_SLIDER_MAX)) {
      onExactChange(null);
      return;
    }
    onExactChange(numeric);
  };

  const exactOutOfRange = (() => {
    const numeric = Number(exactRaw.replace(/,/g, ""));
    if (!exactRaw || Number.isNaN(numeric)) return false;
    return numeric < BUDGET_SLIDER_MIN || numeric > BUDGET_SLIDER_MAX;
  })();

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-400">3단계 · 예산 설정</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">예산을 선택하거나 직접 입력하세요</h2>
        <p className="mt-2 text-sm text-slate-300">정확한 금액을 알고 있거나 애매한 구간을 원하면 아래에서 직접 지정할 수 있습니다.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {budgetOptions.map((option) => {
          const active = mode === "preset" && selectedBudget === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onPresetSelect(option)}
              className={`rounded-3xl border px-5 py-5 text-left transition ${
                active
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-sm"
                  : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{option}</span>
                {active && <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs text-white">선택됨</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        또는 직접 지정
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onModeChange("exact")}
          className={`rounded-3xl border px-5 py-4 text-left transition ${
            mode === "exact"
              ? "border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-sm"
              : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"
          }`}
        >
          <span className="font-semibold">정확한 금액 입력</span>
          <p className="mt-1 text-xs text-slate-400">원하는 예산을 정확히 알고 있을 때</p>
        </button>
        <button
          type="button"
          onClick={() => {
            onModeChange("range");
            // 슬라이더는 텍스트 입력과 달리 항상 값이 "보이는" 채로 시작하므로, 탭을 누른 즉시
            // 화면에 보이는 기본 범위를 실제로도 커밋해 화면과 상태가 어긋나지 않게 한다.
            if (!range) onRangeChange({ min: 1_500_000, max: 2_500_000 });
          }}
          className={`rounded-3xl border px-5 py-4 text-left transition ${
            mode === "range"
              ? "border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-sm"
              : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"
          }`}
        >
          <span className="font-semibold">범위로 선택</span>
          <p className="mt-1 text-xs text-slate-400">위 구간 사이 애매한 범위를 지정할 때</p>
        </button>
      </div>

      {mode === "exact" && (
        <div className="mt-6 rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-5">
          <label className="block text-sm font-semibold text-slate-100">정확한 예산 (원)</label>
          <div className="mt-3 flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              value={exactRaw}
              onChange={handleExactChange}
              placeholder="예: 2,370,000"
              className="w-full rounded-3xl border border-slate-700 bg-slate-800 px-4 py-4 text-lg font-semibold text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none"
            />
            <span className="inline-flex items-center rounded-3xl border border-white/10 bg-slate-800 px-4 text-sm text-slate-300">원</span>
          </div>
          {exactOutOfRange ? (
            <p className="mt-3 text-sm font-semibold text-rose-400">
              {formatWon(BUDGET_SLIDER_MIN)} ~ {formatWon(BUDGET_SLIDER_MAX)} 사이 금액만 입력할 수 있습니다.
            </p>
          ) : exactValue !== null ? (
            <p className="mt-3 text-sm text-slate-300">
              설정된 예산: <span className="font-semibold text-cyan-300">{exactValue.toLocaleString()}원</span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-400">숫자만 입력하면 자동으로 천 단위 콤마가 적용됩니다.</p>
          )}
        </div>
      )}

      {mode === "range" && (
        <div className="mt-6 rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-6">
          <label className="block text-sm font-semibold text-slate-100">예산 범위 지정</label>
          <p className="mt-1 text-xs text-slate-300">
            {formatWon(BUDGET_SLIDER_MIN)} ~ {formatWon(BUDGET_SLIDER_MAX)} 사이에서 10만원 단위로 조정할 수 있습니다. 금액 칩을
            클릭하면 직접 입력할 수도 있습니다.
          </p>
          <div className="mt-5">
            <BudgetRangeSlider
              valueMin={range?.min ?? 1_500_000}
              valueMax={range?.max ?? 2_500_000}
              onChange={onRangeChange}
              formatValue={formatWon}
              minLabel="최소 예산"
              maxLabel="최대 예산"
            />
          </div>
        </div>
      )}
    </section>
  );
}
