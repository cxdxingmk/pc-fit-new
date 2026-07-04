export interface CPU {
  id: string;
  name: string;
  brand: "AMD" | "Intel";
  socket: string;
  cores: number;
  threads: number;
  ddr: "DDR4" | "DDR5";
  pcie: "4.0" | "5.0";
  priceTier: "budget" | "mid" | "high" | "enthusiast";
  // baseline scores (may be overridden by benchmark mapping)
  gameScore: number;
  workScore: number;
  aiScore: number;
}

export const cpus: CPU[] = [
  {
    id: "i5-14600kf",
    name: "Intel Core i5-14600KF",
    brand: "Intel",
    socket: "LGA1700",
    cores: 14,
    threads: 20,
    ddr: "DDR5",
    pcie: "5.0",
    priceTier: "mid",
    gameScore: 91,
    workScore: 91,
    aiScore: 84,
  },
  {
    id: "r7-9800x3d",
    name: "Ryzen 7 9800X3D",
    brand: "AMD",
    socket: "AM5",
    cores: 8,
    threads: 16,
    ddr: "DDR5",
    pcie: "5.0",
    priceTier: "high",
    gameScore: 100,
    workScore: 92,
    aiScore: 87,
  },
  {
    id: "r5-7500f",
    name: "Ryzen 5 7500F",
    brand: "AMD",
    socket: "AM5",
    cores: 6,
    threads: 12,
    ddr: "DDR5",
    pcie: "5.0",
    priceTier: "budget",
    gameScore: 86,
    workScore: 80,
    aiScore: 70,
  },
];
