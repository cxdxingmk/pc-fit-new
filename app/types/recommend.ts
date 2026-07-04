export type PurposeLabel =
  | "game"
  | "work"
  | "video"
  | "stream"
  | "ai"
  | "dev"
  | "etc";

export const purposeLabelMap: Record<PurposeLabel, string> = {
  game: "게임",
  work: "사무",
  video: "영상",
  stream: "방송",
  ai: "AI",
  dev: "개발",
  etc: "기타",
};

export type OwnedPartType =
  | "CPU"
  | "GPU"
  | "RAM"
  | "SSD"
  | "HDD"
  | "Motherboard"
  | "Power";

export const partDisplayNameMap: Record<OwnedPartType, string> = {
  CPU: "CPU",
  GPU: "GPU",
  RAM: "메모리",
  SSD: "SSD",
  HDD: "HDD",
  Motherboard: "메인보드",
  Power: "파워",
};

export type SavedEstimate = {
  id: string;
  title: string;
  createdAt: string;
  parts: {
    cpu: string;
    gpu: string;
    ram: string;
    ssd: string;
    motherboard: string;
    power: string;
  };
  totalPrice: number;
  reasons: string[];
};

export type RecommendationPart = {
  label: string;
  name: string;
  price: number;
};

export type RecommendationResult = {
  id: string;
  cpu: string;
  gpu: string;
  ram: string;
  ssd: string;
  motherboard: string;
  power: string;
  case: string;
  totalPrice: number;
  casePrice: number;
  parts: RecommendationPart[];
  compatibilityScore: number;
  compatibilityDetails: string[];
  warnings: string[];
  finalScore: number;
  reason: string[];
};
