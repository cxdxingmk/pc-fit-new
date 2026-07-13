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
  { value: "dev", label: "개발", description: "Docker 인프라 구동, 대규모 프로젝트 컴파일, 게임 엔진 빌드에 최적화" },
  { value: "cad", label: "건축/3D/CAD", description: "AutoCAD, Blender, Maya 등 3D 모델링/설계 작업에 최적화" },
  { value: "etc", label: "기타", description: "위 항목에 없거나 복합 용도인 경우" },
];

const videoSoftwareOptions = ["Premiere Pro", "After Effects", "DaVinci Resolve"] as const;

type Props = {
  selectedPurposes: PurposeType[];
  purposeText: string;
  videoSoftware: string[];
  videoSoftwareCustomText: string;
  onTogglePurpose: (purpose: PurposeType) => void;
  onPurposeTextChange: (text: string) => void;
  onToggleVideoSoftware: (software: string) => void;
  onVideoSoftwareCustomTextChange: (text: string) => void;
  /** 최소 1개 선택 없이 다음 단계로 넘어가려 했을 때 잠깐 흔들어 미선택 상태를 직관적으로 알린다. */
  shake?: boolean;
};

export default function PurposeStep({
  selectedPurposes,
  purposeText,
  videoSoftware,
  videoSoftwareCustomText,
  onTogglePurpose,
  onPurposeTextChange,
  onToggleVideoSoftware,
  onVideoSoftwareCustomTextChange,
  shake = false,
}: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-sm">
      <div className="mb-6">
        <p className="text-sm font-semibold text-slate-400">1단계 · 용도 선택</p>
        <h2 className="mt-3 text-2xl font-bold text-slate-100">어떤 용도로 PC를 사용하나요?</h2>
        <p className="mt-2 text-sm text-slate-300">여러 가지를 동시에 선택할 수 있으며, ‘기타’ 선택 시 추가 입력창이 나타납니다.</p>
      </div>

      <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${shake ? "animate-shake" : ""}`}>
        {purposeOptions.map((option) => {
          const active = selectedPurposes.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onTogglePurpose(option.value)}
              className={`group flex h-full flex-col rounded-3xl border px-5 py-5 text-left transition ${
                active
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-300 shadow-sm"
                  : "border-white/10 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:bg-cyan-500/10"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold text-slate-100">{option.label}</span>
                <span
                  className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    active ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-300"
                  }`}
                >
                  {active ? "선택됨" : "선택"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-300">{option.description}</p>
            </button>
          );
        })}
      </div>

      {selectedPurposes.includes("video") && (
        <div className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-5 transition-all duration-300">
          <label className="block text-sm font-semibold text-slate-900">영상/편집 소프트웨어 프리셋</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {videoSoftwareOptions.map((software) => {
              const selected = videoSoftware.includes(software);
              return (
                <button
                  key={software}
                  type="button"
                  onClick={() => onToggleVideoSoftware(software)}
                  className={`rounded-full px-3 py-2 text-sm font-medium transition ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >
                  {software}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-900">직접 입력</label>
            <input
              type="text"
              value={videoSoftwareCustomText}
              onChange={(event) => onVideoSoftwareCustomTextChange(event.target.value)}
              placeholder="예: VEGAS Pro, Nuke"
              className="mt-2 w-full rounded-2xl border border-blue-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {selectedPurposes.includes("etc") && (
        <div className="mt-6 rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-5 transition-all duration-300">
          <label className="block text-sm font-semibold text-slate-100">기타 용도 상세</label>
          <input
            type="text"
            value={purposeText}
            onChange={(e) => onPurposeTextChange(e.target.value)}
            placeholder="예: 3D 모델링 + 스트리밍"
            className="mt-3 w-full rounded-3xl border border-slate-700 bg-slate-800 px-4 py-4 text-slate-100 shadow-sm focus:border-cyan-400 focus:outline-none"
          />
          <p className="mt-3 text-sm text-slate-300">기타 용도를 입력하면 추천 로직에 반영됩니다.</p>
        </div>
      )}
    </section>
  );
}
