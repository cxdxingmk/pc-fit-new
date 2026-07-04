export interface SSD {
  id: string;
  name: string;
  brand: string;
  capacity: number; // GB
  interface: "PCIe 4.0" | "PCIe 5.0";
  readSpeed: number;
  writeSpeed: number;
  priceTier: "budget" | "mid" | "high";
  gameScore: number;
  workScore: number;
  aiScore: number;
}

export const ssds: SSD[] = [
  {
    id: "990pro-1tb",
    name: "Samsung 990 PRO 1TB",
    brand: "Samsung",
    capacity: 1000,
    interface: "PCIe 4.0",
    readSpeed: 7450,
    writeSpeed: 6900,
    priceTier: "high",
    gameScore: 98,
    workScore: 99,
    aiScore: 98,
  },
  {
    id: "sn770-1tb",
    name: "WD Black SN770 1TB",
    brand: "WD",
    capacity: 1000,
    interface: "PCIe 4.0",
    readSpeed: 5150,
    writeSpeed: 4900,
    priceTier: "budget",
    gameScore: 85,
    workScore: 80,
    aiScore: 75,
  },
];
