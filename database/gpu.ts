export interface GPU {
  id: string;
  name: string;
  brand: "NVIDIA" | "AMD" | "Intel";
  vram: number;
  pcie: "4.0" | "5.0";
  priceTier: "budget" | "mid" | "high" | "enthusiast";
  gameScore: number;
  workScore: number;
  aiScore: number;
}

export const gpus: GPU[] = [
  {
    id: "rtx4070super",
    name: "GeForce RTX 4070 SUPER",
    brand: "NVIDIA",
    vram: 12,
    pcie: "4.0",
    priceTier: "mid",
    gameScore: 90,
    workScore: 88,
    aiScore: 90,
  },
  {
    id: "rtx5070",
    name: "GeForce RTX 5070",
    brand: "NVIDIA",
    vram: 12,
    pcie: "5.0",
    priceTier: "high",
    gameScore: 95,
    workScore: 93,
    aiScore: 95,
  },
  {
    id: "rtx4060",
    name: "GeForce RTX 4060",
    brand: "NVIDIA",
    vram: 8,
    pcie: "4.0",
    priceTier: "budget",
    gameScore: 75,
    workScore: 70,
    aiScore: 72,
  },
];
