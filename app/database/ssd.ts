export interface SSD {
  id: string;

  name: string;
  brand: "Samsung" | "WD" | "SK hynix" | "Crucial" | "Kingston" | "MSI" | "Seagate";

  capacity: number; // GB

  interface: "PCIe 4.0" | "PCIe 5.0";

  formFactor: "M.2 2280";

  readSpeed: number; // MB/s
  writeSpeed: number; // MB/s

  dram: boolean;

  nand: "TLC" | "QLC";

  tbw: number;

  releaseYear: number;

  gameScore: number;
  workScore: number;
  aiScore: number;

  priceTier: "budget" | "mid" | "high";
}

export const ssds: SSD[] = [
  {
    // 정책: 새로 구매하는 SSD는 예산/견적 성격과 무관하게 항상 512GB로 고정한다
    // (recommender.ts의 selectFixedSsd 참고) — 이 카탈로그에서 유일한 512GB 항목이다.
    id: "sn770-512gb",
    name: "WD Black SN770 500GB",
    brand: "WD",
    capacity: 512,
    interface: "PCIe 4.0",
    formFactor: "M.2 2280",
    readSpeed: 5000,
    writeSpeed: 4000,
    dram: false,
    nand: "TLC",
    tbw: 300,
    releaseYear: 2022,
    gameScore: 80,
    workScore: 75,
    aiScore: 70,
    priceTier: "budget",
  },
  {
    id: "sn770-1tb",
    name: "WD Black SN770 1TB",
    brand: "WD",
    capacity: 1000,
    interface: "PCIe 4.0",
    formFactor: "M.2 2280",
    readSpeed: 5150,
    writeSpeed: 4900,
    dram: false,
    nand: "TLC",
    tbw: 600,
    releaseYear: 2022,
    gameScore: 85,
    workScore: 80,
    aiScore: 75,
    priceTier: "budget",
  },

  {
    id: "p41-1tb",
    name: "SK hynix Platinum P41 1TB",
    brand: "SK hynix",
    capacity: 1000,
    interface: "PCIe 4.0",
    formFactor: "M.2 2280",
    readSpeed: 7000,
    writeSpeed: 6500,
    dram: true,
    nand: "TLC",
    tbw: 750,
    releaseYear: 2022,
    gameScore: 95,
    workScore: 96,
    aiScore: 93,
    priceTier: "high",
  },

  {
    id: "990pro-1tb",
    name: "Samsung 990 PRO 1TB",
    brand: "Samsung",
    capacity: 1000,
    interface: "PCIe 4.0",
    formFactor: "M.2 2280",
    readSpeed: 7450,
    writeSpeed: 6900,
    dram: true,
    nand: "TLC",
    tbw: 600,
    releaseYear: 2022,
    gameScore: 98,
    workScore: 99,
    aiScore: 98,
    priceTier: "high",
  },

  {
    id: "t500-1tb",
    name: "Crucial T500 1TB",
    brand: "Crucial",
    capacity: 1000,
    interface: "PCIe 4.0",
    formFactor: "M.2 2280",
    readSpeed: 7400,
    writeSpeed: 7000,
    dram: true,
    nand: "TLC",
    tbw: 600,
    releaseYear: 2023,
    gameScore: 97,
    workScore: 98,
    aiScore: 96,
    priceTier: "high",
  },

  {
    id: "kc3000-1tb",
    name: "Kingston KC3000 1TB",
    brand: "Kingston",
    capacity: 1000,
    interface: "PCIe 4.0",
    formFactor: "M.2 2280",
    readSpeed: 7000,
    writeSpeed: 6000,
    dram: true,
    nand: "TLC",
    tbw: 800,
    releaseYear: 2022,
    gameScore: 94,
    workScore: 95,
    aiScore: 92,
    priceTier: "mid",
  },

  {
    id: "m480pro-2tb",
    name: "MSI SPATIUM M480 PRO 2TB",
    brand: "MSI",
    capacity: 2000,
    interface: "PCIe 4.0",
    formFactor: "M.2 2280",
    readSpeed: 7400,
    writeSpeed: 7000,
    dram: true,
    nand: "TLC",
    tbw: 1400,
    releaseYear: 2023,
    gameScore: 97,
    workScore: 97,
    aiScore: 96,
    priceTier: "high",
  }
];