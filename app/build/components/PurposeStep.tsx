"use client";

import type { PurposeType } from "../../context/BuildContext";

type PurposeOption = {
  value: PurposeType;
  label: string;
  description: string;
};

const purposeOptions: PurposeOption[] = [
  { value: "gaming", label: "게임", description: "높은 프레임과 그래픽 품질에 최적화" },
  { value: "work", label: "사무", description: "문서, 오피스, 웹서핑 등 기본 업무에 적합" },
  { value: "video", label: "영상", description: "편집과 렌더링 작업에 최적화" },
  { value: "stream", label: "방송", description: "스트리밍과 멀티태스킹에 유리합니다" },
  { value: "ai", label: "AI", description: "모델 학습과 추론 성능을 중심으로" },
  { value: "dev", label: "개발", description: "개발환경과 컴파일 작업에 적합" },
  { value: "etc", label: "기타", description: "위 항목에 없거나 복합 용도인 경우" },
];

type Props = {
  selectedPurposes: PurposeType[];
  purposeText: string;
  onTogglePurpose: (purpose: PurposeType) => void;
  onPurposeTextChange: (text: string) => void;
};

export default function PurposeStep({
  selectedPurposes,
  purposeText,
  onTogglePurpose,
  onPurposeTextChange,
}: Props) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-500">1단계 · 용도 선택</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-900">어떤 용도로 PC를 사용하나요?</h2>
        <p className="mt-2 text-sm text-slate-600">여러 가지를 동시에 선택할 수 있으며, ‘기타’ 선택 시 추가 입력창이 나타납니다.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {purposeOptions.map((option) => {
          const active = selectedPurposes.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onTogglePurpose(option.value)}
              className={`group rounded-3xl border px-5 py-5 text-left transition ${
                active
                  ? "border-blue-600 bg-blue-50 shadow-sm"
                  : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold text-slate-900">{option.label}</span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {active ? "선택됨" : "선택"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{option.description}</p>
            </button>
          );
        })}
      </div>

      {selectedPurposes.includes("etc") && (
        <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 transition-all duration-300">
          <label className="block text-sm font-semibold text-slate-900">기타 용도 상세</label>
          <input
            type="text"
            value={purposeText}
            onChange={(e) => onPurposeTextChange(e.target.value)}
            placeholder="예: 3D 모델링 + 스트리밍"
            className="mt-3 w-full rounded-3xl border border-blue-300 bg-white px-4 py-4 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-3 text-sm text-slate-600">기타 용도를 입력하면 추천 로직에 반영됩니다.</p>
        </div>
      )}
    </section>
  );
}
