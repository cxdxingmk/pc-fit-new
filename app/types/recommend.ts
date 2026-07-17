import type { CompatibilityWarning } from "../lib/compatibility";

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
  warnings: CompatibilityWarning[];
  finalScore: number;
  reason: string[];
  /** cpu/gpu/ram/ssd/motherboard는 표시용 이름이라 카탈로그 역참조가 불안정해서(동명이인·문자열
   *  가공 등) 실제 카탈로그 id를 별도로 들고 다닌다 — /my-pc?spec= 퍼머링크 생성에 필요. */
  partIds: {
    cpu: string;
    gpu: string;
    ram: string;
    ssd: string;
    motherboard: string;
    psuWattage: number;
  };
};
