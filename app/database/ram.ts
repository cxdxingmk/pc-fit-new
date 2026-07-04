export interface RAM {
  id: string;

  name: string;
  brand: string;

  capacity: number;
  sticks: number;

  speed: number;

  ddr: "DDR4" | "DDR5";

  rgb: boolean;

  xmp: boolean;
  expo: boolean;

  gameScore: number;
  workScore: number;
  aiScore: number;

  priceTier: "budget" | "mid" | "high";
}

export const rams: RAM[] = [
  {
    id: "16-ddr5-5600",
    name: "Samsung DDR5 16GB",
    brand: "Samsung",

    capacity: 16,
    sticks: 1,

    speed: 5600,

    ddr: "DDR5",

    rgb: false,

    xmp: false,
    expo: false,

    gameScore: 70,
    workScore: 68,
    aiScore: 65,

    priceTier: "budget",
  },

  {
    id: "32-ddr5-6000",
    name: "TeamGroup T-Force Delta RGB 32GB",

    brand: "TeamGroup",

    capacity: 32,
    sticks: 2,

    speed: 6000,

    ddr: "DDR5",

    rgb: true,

    xmp: true,
    expo: true,

    gameScore: 90,
    workScore: 88,
    aiScore: 90,

    priceTier: "mid",
  },

  {
    id: "64-ddr5-6400",

    name: "G.Skill Trident Z5 RGB 64GB",

    brand: "G.Skill",

    capacity: 64,
    sticks: 2,

    speed: 6400,

    ddr: "DDR5",

    rgb: true,

    xmp: true,
    expo: true,

    gameScore: 94,
    workScore: 98,
    aiScore: 99,

    priceTier: "high",
  },
  {
    id: "16-ddr4-3200",
    name: "Corsair Vengeance LPX 16GB",
    brand: "Corsair",

    capacity: 16,
    sticks: 2,

    speed: 3200,

    ddr: "DDR4",

    rgb: false,

    xmp: true,
    expo: false,

    gameScore: 65,
    workScore: 62,
    aiScore: 60,

    priceTier: "budget",
  },
  {
    id: "32-ddr4-3600",
    name: "Kingston Fury Beast 32GB",
    brand: "Kingston",

    capacity: 32,
    sticks: 2,

    speed: 3600,

    ddr: "DDR4",

    rgb: false,

    xmp: true,
    expo: false,

    gameScore: 78,
    workScore: 75,
    aiScore: 72,

    priceTier: "mid",
  },
  {
    id: "32-ddr4-3200-rgb",
    name: "G.Skill Trident Z RGB 32GB",
    brand: "G.Skill",

    capacity: 32,
    sticks: 2,

    speed: 3200,

    ddr: "DDR4",

    rgb: true,

    xmp: true,
    expo: false,

    gameScore: 80,
    workScore: 78,
    aiScore: 76,

    priceTier: "high",
  }
];