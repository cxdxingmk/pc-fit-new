import { motherboardMasterDb, type MotherboardItem } from "./hardwareMasterDb";

export interface MotherBoard {
  id: string;

  name: string;
  brand: "ASUS" | "MSI" | "GIGABYTE" | "ASRock";

  socket: "AM5" | "AM4" | "LGA1700" | "LGA1851";

  chipset: string;

  ddr: "DDR5" | "DDR4";

  maxMemory: number;

  memorySlots: number;

  pcie: "4.0" | "5.0";

  m2Slots: number;

  wifi: boolean;

  releaseYear: number;

  gameScore: number;
  workScore: number;
  aiScore: number;

  priceTier: "budget" | "mid" | "high";
}

export const motherboards: MotherBoard[] = [
  {
    id: "z890-aorus-master",
    name: "Z890 AORUS MASTER",
    brand: "GIGABYTE",
    socket: "LGA1851",
    chipset: "Z890",
    ddr: "DDR5",
    maxMemory: 256,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 5,
    wifi: true,
    releaseYear: 2025,
    gameScore: 99,
    workScore: 99,
    aiScore: 99,
    priceTier: "high",
  },
  {
    id: "z790-tuf-gaming",
    name: "Z790 TUF Gaming Plus",
    brand: "ASUS",
    socket: "LGA1700",
    chipset: "Z790",
    ddr: "DDR5",
    maxMemory: 128,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 4,
    wifi: true,
    releaseYear: 2023,
    gameScore: 95,
    workScore: 95,
    aiScore: 94,
    priceTier: "high",
  },
  {
    id: "b860-gaming-x",
    name: "B860 Gaming X WiFi",
    brand: "GIGABYTE",
    socket: "LGA1851",
    chipset: "B860",
    ddr: "DDR5",
    maxMemory: 256,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 4,
    wifi: true,
    releaseYear: 2025,
    gameScore: 95,
    workScore: 95,
    aiScore: 95,
    priceTier: "mid",
  },
  {
    id: "b760-aorus-elite",
    name: "B760 AORUS ELITE AX",
    brand: "GIGABYTE",
    socket: "LGA1700",
    chipset: "B760",
    ddr: "DDR5",
    maxMemory: 192,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 4,
    wifi: true,
    releaseYear: 2024,
    gameScore: 90,
    workScore: 90,
    aiScore: 89,
    priceTier: "mid",
  },
  {
    id: "h610m-k",
    name: "H610M-K",
    brand: "ASUS",
    socket: "LGA1700",
    chipset: "H610",
    ddr: "DDR4",
    maxMemory: 64,
    memorySlots: 2,
    pcie: "4.0",
    m2Slots: 2,
    wifi: false,
    releaseYear: 2023,
    gameScore: 72,
    workScore: 72,
    aiScore: 70,
    priceTier: "budget",
  },
  {
    id: "x870e-a-elite",
    name: "X870E APEX",
    brand: "ASUS",
    socket: "AM5",
    chipset: "X870",
    ddr: "DDR5",
    maxMemory: 256,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 4,
    wifi: true,
    releaseYear: 2025,
    gameScore: 98,
    workScore: 98,
    aiScore: 98,
    priceTier: "high",
  },
  {
    id: "x670e-gaming-plus",
    name: "X670E Gaming Plus",
    brand: "MSI",
    socket: "AM5",
    chipset: "X670",
    ddr: "DDR5",
    maxMemory: 128,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 4,
    wifi: true,
    releaseYear: 2023,
    gameScore: 95,
    workScore: 94,
    aiScore: 94,
    priceTier: "high",
  },
  {
    id: "b650m-aorus-elite",
    name: "B650M AORUS ELITE",
    brand: "GIGABYTE",
    socket: "AM5",
    chipset: "B650",
    ddr: "DDR5",
    maxMemory: 192,
    memorySlots: 4,
    pcie: "5.0",
    m2Slots: 4,
    wifi: true,
    releaseYear: 2024,
    gameScore: 93,
    workScore: 92,
    aiScore: 92,
    priceTier: "mid",
  },
  {
    id: "a620m-aorus-elite",
    name: "A620M AORUS ELITE",
    brand: "GIGABYTE",
    socket: "AM5",
    chipset: "A620",
    ddr: "DDR5",
    maxMemory: 96,
    memorySlots: 2,
    pcie: "4.0",
    m2Slots: 2,
    wifi: false,
    releaseYear: 2024,
    gameScore: 80,
    workScore: 79,
    aiScore: 78,
    priceTier: "budget",
  },
  {
    id: "b550m-aorus-pro",
    name: "B550M AORUS PRO",
    brand: "GIGABYTE",
    socket: "AM4",
    chipset: "B550",
    ddr: "DDR4",
    maxMemory: 128,
    memorySlots: 4,
    pcie: "4.0",
    m2Slots: 3,
    wifi: false,
    releaseYear: 2020,
    gameScore: 78,
    workScore: 78,
    aiScore: 74,
    priceTier: "budget",
  },
];

export const motherboardMasterItems: MotherboardItem[] = motherboardMasterDb;