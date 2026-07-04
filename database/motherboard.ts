export interface MotherBoard {
  id: string;
  name: string;
  brand: string;
  socket: string;
  ddr: "DDR4" | "DDR5";
  pcie: "4.0" | "5.0";
  m2Slots: number;
  priceTier: "budget" | "mid" | "high";
  gameScore: number;
  workScore: number;
  aiScore: number;
}

export const motherboards: MotherBoard[] = [
  {
    id: "msi-b650-gaming-plus",
    name: "MSI B650 Gaming Plus WiFi",
    brand: "MSI",
    socket: "AM5",
    ddr: "DDR5",
    pcie: "5.0",
    m2Slots: 3,
    priceTier: "mid",
    gameScore: 92,
    workScore: 91,
    aiScore: 90,
  },
  {
    id: "msi-z890",
    name: "MSI Z890 Tomahawk WiFi",
    brand: "MSI",
    socket: "LGA1851",
    ddr: "DDR5",
    pcie: "5.0",
    m2Slots: 5,
    priceTier: "high",
    gameScore: 99,
    workScore: 99,
    aiScore: 99,
  },
];
