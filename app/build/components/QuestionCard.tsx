"use client";

import { useState } from "react";

type Props = {
  title: string;
  options: string[];
  multiple: boolean;
  selected: string[];
  onSelect: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  current: number;
  total: number;
};

export default function QuestionCard({
  title,
  options,
  multiple,
  selected,
  onSelect,
  onNext,
  onBack,
  current,
  total,
}: Props) {
  const [etc, setEtc] = useState("");

  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow">

      {/* 진행률 */}
      <p className="mb-2 text-sm text-gray-500">
        {current + 1} / {total}
      </p>

      <div className="mb-6 h-2 rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{
            width: `${((current + 1) / total) * 100}%`,
          }}
        />
      </div>

      <h2 className="mb-8 text-3xl font-bold">{title}</h2>

      <div className="space-y-4">
        {options.map((option) => (
          <div key={option}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                selected.includes(option)
                  ? "border-blue-600 bg-blue-100"
                  : "hover:bg-blue-50"
              }`}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                checked={selected.includes(option)}
                onChange={() => onSelect(option)}
              />

              <span>{option}</span>
            </label>

            {option === "기타" && selected.includes("기타") && (
              <input
                value={etc}
                onChange={(e) => setEtc(e.target.value)}
                placeholder="직접 입력해주세요"
                className="mt-2 w-full rounded-lg border p-3"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 flex gap-4">
        <button
          onClick={onBack}
          disabled={current === 0}
          className="w-full rounded-xl border py-4 disabled:opacity-40"
        >
          ← 이전
        </button>

        <button
          disabled={selected.length === 0}
          onClick={onNext}
          className="w-full rounded-xl bg-blue-600 py-4 font-bold text-white disabled:bg-gray-300"
        >
          다음 →
        </button>
      </div>
    </div>
  );
}