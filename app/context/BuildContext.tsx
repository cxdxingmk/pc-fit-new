"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { createContext, useContext, useEffect, useState } from "react";
import type { SavedEstimate } from "../types/recommend";
import type { ExistingPartsState, CaseOwnershipOption, PurposeType } from "../types/build";
import { readJsonFromStorage, writeJsonToStorage } from "../lib/localStorageJson";

const SAVED_ESTIMATES_STORAGE_KEY = "pc_fit_saved_estimates";

export type { PurposeType };
export type BudgetOption =
  | "100만원 이하"
  | "100~150만원"
  | "150~200만원"
  | "200~300만원"
  | "300만원 이상"
  | "기타";
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
  preset: BudgetOption | null;
  customRaw: string;
  customValue: number | null;
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
  setBudgetPreset: (preset: BudgetOption) => void;
  setBudgetCustom: (customRaw: string, customValue: number | null) => void;
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
    preset: null,
    customRaw: "",
    customValue: null,
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

  const setBudgetPreset = (preset: BudgetOption) => {
    setBuildData((prev) => ({
      ...prev,
      budget: {
        preset,
        customRaw: preset === "기타" ? prev.budget.customRaw : "",
        customValue: preset === "기타" ? prev.budget.customValue : null,
      },
      answers: { ...prev.answers, 3: [preset] },
    }));
  };

  const setBudgetCustom = (customRaw: string, customValue: number | null) => {
    setBuildData((prev) => ({
      ...prev,
      budget: {
        preset: "기타",
        customRaw,
        customValue,
      },
      answers: {
        ...prev.answers,
        3: [customValue ? `${customValue.toLocaleString()}원` : "기타"],
      },
    }));
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
        setBudgetPreset,
        setBudgetCustom,
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
