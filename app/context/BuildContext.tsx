"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useContext, useEffect, useState } from "react";
import type { SavedEstimate } from "../types/recommend";
import type { ExistingPartsState, CaseOwnershipOption, PurposeType, BudgetRange } from "../types/build";
import { readJsonFromStorage, writeJsonToStorage } from "../lib/localStorageJson";

export type { BudgetRange };

/** 예산 범위 슬라이더("범위로 선택")와 "정확한 금액 입력" 둘 다 이 하한/상한을 공유한다.
 *  슬라이더 자체의 구간별 step은 components/ui/budgetRangeScale.ts가 담당한다(전 구간 균일하지 않음). */
export const BUDGET_SLIDER_MIN = 500_000;
export const BUDGET_SLIDER_MAX = 10_000_000;

/** 고정 구간 버튼도 결과적으로 슬라이더와 동일한 {min,max} 형태로 귀결시켜, 추천 로직에
 *  전달되는 데이터 형식을 하나로 통일한다. */
const PRESET_BUDGET_RANGES: Record<string, BudgetRange> = {
  "100만원 이하": { min: BUDGET_SLIDER_MIN, max: 1_000_000 },
  "100~150만원": { min: 1_000_000, max: 1_500_000 },
  "150~200만원": { min: 1_500_000, max: 2_000_000 },
  "200~300만원": { min: 2_000_000, max: 3_000_000 },
  "300만원 이상": { min: 3_000_000, max: BUDGET_SLIDER_MAX },
};

const SAVED_ESTIMATES_STORAGE_KEY = "pc_fit_saved_estimates";

export type { PurposeType };
export type BudgetOption =
  | "100만원 이하"
  | "100~150만원"
  | "150~200만원"
  | "200~300만원"
  | "300만원 이상";

/** 예산을 정하는 세 가지 독립된 방식 — 서로 나란한 선택지이며 서로를 하위/상위로 두지 않는다.
 *  preset/range → {min,max}(하한 강제 + 상한 소프트 페널티), exact → 단일 목표값(상한만 소프트 페널티). */
export type BudgetMode = "preset" | "exact" | "range";
export type EntryMode = "select" | "manual";
export type OwnedPartType =
  | "CPU"
  | "GPU"
  | "RAM"
  | "SSD"
  | "HDD"
  | "Motherboard"
  | "Power";

export type OwnedPartDetail = {
  enabled: boolean;
  mode: EntryMode;
  brand: string;
  model: string;
  value: string;
};

export type OwnedPartsState = Record<OwnedPartType, OwnedPartDetail>;

export type BudgetState = {
  mode: BudgetMode;
  preset: BudgetOption | null;
  /** mode === "exact"일 때만 의미 있는 단일 목표값. */
  exactValue: number | null;
  /** mode === "preset" | "range"일 때만 의미 있는 {min,max}. */
  range: BudgetRange | null;
};

export type BuildData = {
  purposes: PurposeType[];
  purposeText: string;
  videoSoftware: string[];
  videoSoftwareCustomText: string;
  ownedParts: OwnedPartsState;
  existingParts: ExistingPartsState;
  caseOwnership: CaseOwnershipOption;
  budget: BudgetState;
  answers: Record<number, string[]>;
  savedEstimates: SavedEstimate[];
};

type BuildContextType = {
  buildData: BuildData;
  setBuildData: React.Dispatch<React.SetStateAction<BuildData>>;
  togglePurpose: (purpose: PurposeType) => void;
  setPurposeText: (text: string) => void;
  toggleVideoSoftware: (software: string) => void;
  setVideoSoftwareCustomText: (text: string) => void;
  setBudgetMode: (mode: BudgetMode) => void;
  setBudgetPreset: (preset: BudgetOption) => void;
  setBudgetExact: (value: number | null) => void;
  setBudgetRange: (range: BudgetRange) => void;
  toggleOwnedPart: (part: OwnedPartType) => void;
  updateOwnedPart: (
    part: OwnedPartType,
    patch: Partial<OwnedPartDetail>
  ) => void;
  updateExistingPart: <K extends keyof ExistingPartsState>(
    part: K,
    patch: Partial<ExistingPartsState[K]>
  ) => void;
  setCaseOwnership: (ownership: CaseOwnershipOption) => void;
  saveEstimate: (estimate: SavedEstimate) => void;
};

const BuildContext = createContext<BuildContextType | undefined>(undefined);

const initialOwnedParts: OwnedPartsState = {
  CPU: { enabled: false, mode: "select", brand: "", model: "", value: "" },
  GPU: { enabled: false, mode: "select", brand: "", model: "", value: "" },
  RAM: { enabled: false, mode: "select", brand: "", model: "", value: "" },
  SSD: { enabled: false, mode: "select", brand: "", model: "", value: "" },
  HDD: { enabled: false, mode: "select", brand: "", model: "", value: "" },
  Motherboard: { enabled: false, mode: "select", brand: "", model: "", value: "" },
  Power: { enabled: false, mode: "select", brand: "", model: "", value: "" },
};

const initialExistingParts: ExistingPartsState = {
  CPU: { enabled: false, brand: "", model: "" },
  GPU: { enabled: false, brand: "", manufacturer: "", model: "" },
  RAM: { enabled: false, ddr: "", capacity: "", brand: "", model: "" },
  SSD: { enabled: false, capacity: "", brand: "", model: "" },
  HDD: { enabled: false, capacity: "" },
  Motherboard: { enabled: false, series: "", manufacturer: "", model: "" },
  Power: { enabled: false, wattage: "" },
};

const initialBuildData: BuildData = {
  purposes: [],
  purposeText: "",
  videoSoftware: [],
  videoSoftwareCustomText: "",
  ownedParts: initialOwnedParts,
  existingParts: initialExistingParts,
  caseOwnership: "owned",
  budget: {
    mode: "preset",
    preset: null,
    exactValue: null,
    range: null,
  },
  answers: {},
  savedEstimates: [],
};

function getOwnedPartsLabels(parts: OwnedPartsState) {
  return Object.entries(parts)
    .filter(([, detail]) => detail.enabled)
    .map(([part]) => part as OwnedPartType);
}

function purposeLabel(value: PurposeType, text: string) {
  switch (value) {
    case "gaming":
      return "게임";
    case "work":
      return "사무";
    case "video":
      return "영상";
    case "stream":
      return "방송";
    case "ai":
      return "AI";
    case "dev":
      return "개발";
    case "cad":
      return "건축/3D/CAD";
    case "etc":
      return text ? `기타: ${text}` : "기타";
    default:
      return "";
  }
}

function normalizePurposeLabels(purposes: PurposeType[], text: string) {
  return purposes.map((value) => purposeLabel(value, text)).filter(Boolean);
}

export function BuildProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [buildData, setBuildData] = useState<BuildData>(initialBuildData);

  useEffect(() => {
    const saved = readJsonFromStorage<SavedEstimate[]>(SAVED_ESTIMATES_STORAGE_KEY);
    if (!saved) return;
    setBuildData((prev) => ({ ...prev, savedEstimates: saved }));
  }, []);

  const togglePurpose = (purpose: PurposeType) => {
    setBuildData((prev) => {
      if (purpose === "etc") {
        const next: PurposeType[] = prev.purposes.includes("etc") ? [] : ["etc"];
        return {
          ...prev,
          purposes: next,
          answers: {
            ...prev.answers,
            1: normalizePurposeLabels(next, next.length ? prev.purposeText : ""),
          },
        };
      }

      const next: PurposeType[] = prev.purposes.includes(purpose)
        ? prev.purposes.filter((item) => item !== purpose)
        : [...prev.purposes.filter((item) => item !== "etc"), purpose];

      return {
        ...prev,
        purposes: next,
        answers: {
          ...prev.answers,
          1: normalizePurposeLabels(next, next.includes("etc") ? prev.purposeText : ""),
        },
      };
    });
  };

  // 탭만 전환 — 값 자체(answers[3])는 건드리지 않는다. "정확한 금액 입력" 탭은 처음엔 빈 채로
  // 열리는 게 자연스러워서(아직 아무 숫자도 입력 안 함), 탭 전환과 값 확정을 분리해야 한다.
  const setBudgetMode = (mode: BudgetMode) => {
    setBuildData((prev) => ({ ...prev, budget: { ...prev.budget, mode } }));
  };

  const setBudgetPreset = (preset: BudgetOption) => {
    setBuildData((prev) => {
      const range = PRESET_BUDGET_RANGES[preset];
      const target = Math.round((range.min + range.max) / 2);
      return {
        ...prev,
        budget: { mode: "preset", preset, exactValue: null, range },
        // answers[3]은 추천 로직(pickBudgetTarget)이 숫자 문자열로 그대로 파싱하는 값 — 프리셋도
        // 결과적으로 {min,max}의 중간값을 여기 태운다(실제 하한/상한은 budget.range로 별도 전달됨).
        answers: { ...prev.answers, 3: [String(target)] },
      };
    });
  };

  /** "정확한 금액 입력" — 입력값을 ±10% range로 변환해 "범위로 선택"과 동일한 하한 강제 +
   *  다양성 필터 경로를 타게 한다. exactValue는 별도로 남겨서(range와 다름) TOP1을 이 금액에
   *  가장 가까운 조합으로 우선 배치하는 데 쓴다(recommender.ts의 preferredBudgetTarget). */
  const setBudgetExact = (value: number | null) => {
    setBuildData((prev) => {
      const range = value !== null ? { min: Math.round(value * 0.9), max: Math.round(value * 1.1) } : null;
      return {
        ...prev,
        budget: { mode: "exact", preset: null, exactValue: value, range },
        answers: { ...prev.answers, 3: value !== null ? [String(value)] : [] },
      };
    });
  };

  const setBudgetRange = (range: BudgetRange) => {
    setBuildData((prev) => {
      const target = Math.round((range.min + range.max) / 2);
      return {
        ...prev,
        budget: { mode: "range", preset: null, exactValue: null, range },
        answers: { ...prev.answers, 3: [String(target)] },
      };
    });
  };

  const setPurposeText = (text: string) => {
    setBuildData((prev) => ({
      ...prev,
      purposeText: text,
      answers: {
        ...prev.answers,
        1: normalizePurposeLabels(prev.purposes, text),
      },
    }));
  };

  const toggleVideoSoftware = (software: string) => {
    setBuildData((prev) => {
      const next = prev.videoSoftware.includes(software)
        ? prev.videoSoftware.filter((item) => item !== software)
        : [...prev.videoSoftware, software];

      return {
        ...prev,
        videoSoftware: next,
        answers: {
          ...prev.answers,
          5: [...next, prev.videoSoftwareCustomText].filter(Boolean),
        },
      };
    });
  };

  const setVideoSoftwareCustomText = (text: string) => {
    setBuildData((prev) => ({
      ...prev,
      videoSoftwareCustomText: text,
      answers: {
        ...prev.answers,
        5: [...prev.videoSoftware, text].filter(Boolean),
      },
    }));
  };

  const toggleOwnedPart = (part: OwnedPartType) => {
    setBuildData((prev) => {
      const current = prev.ownedParts[part];
      const nextEnabled = !current.enabled;
      const nextParts = {
        ...prev.ownedParts,
        [part]: {
          ...current,
          enabled: nextEnabled,
          value: nextEnabled ? current.value : "",
          mode: nextEnabled ? current.mode : "select",
        },
      };
      return {
        ...prev,
        ownedParts: nextParts,
        answers: { ...prev.answers, 2: getOwnedPartsLabels(nextParts) },
      };
    });
  };

  const updateOwnedPart = (
    part: OwnedPartType,
    patch: Partial<OwnedPartDetail>
  ) => {
    setBuildData((prev) => {
      const current = prev.ownedParts[part];
      const nextParts = {
        ...prev.ownedParts,
        [part]: {
          ...current,
          ...patch,
          model:
            patch.brand && patch.brand !== current.brand ? "" : patch.model ?? current.model,
        },
      };
      return {
        ...prev,
        ownedParts: nextParts,
        answers: { ...prev.answers, 2: getOwnedPartsLabels(nextParts) },
      };
    });
  };

  const updateExistingPart = <K extends keyof ExistingPartsState>(
    part: K,
    patch: Partial<ExistingPartsState[K]>
  ) => {
    setBuildData((prev) => ({
      ...prev,
      existingParts: {
        ...prev.existingParts,
        [part]: {
          ...prev.existingParts[part],
          ...patch,
        },
      },
    }));
  };

  const setCaseOwnership = (ownership: CaseOwnershipOption) => {
    setBuildData((prev) => ({
      ...prev,
      caseOwnership: ownership,
      answers: { ...prev.answers, 4: [ownership] },
    }));
  };

  const saveEstimate = (estimate: SavedEstimate) => {
    setBuildData((prev) => {
      const exists = prev.savedEstimates.some((item) => item.id === estimate.id);
      const nextEstimates = exists ? prev.savedEstimates : [estimate, ...prev.savedEstimates];
      writeJsonToStorage(SAVED_ESTIMATES_STORAGE_KEY, nextEstimates);
      return {
        ...prev,
        savedEstimates: nextEstimates,
      };
    });
  };

  return (
    <BuildContext.Provider
      value={{
        buildData,
        setBuildData,
        togglePurpose,
        setPurposeText,
        toggleVideoSoftware,
        setVideoSoftwareCustomText,
        setBudgetMode,
        setBudgetPreset,
        setBudgetExact,
        setBudgetRange,
        toggleOwnedPart,
        updateOwnedPart,
        updateExistingPart,
        setCaseOwnership,
        saveEstimate,
      }}
    >
      {children}
    </BuildContext.Provider>
  );
}

export function useBuild() {
  const context = useContext(BuildContext);

  if (!context) {
    throw new Error("useBuild는 BuildProvider 안에서 사용해야 합니다.");
  }

  return context;
}
