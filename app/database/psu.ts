export interface PSU {
  id: string;

  name: string;
  brand: "Seasonic" | "Corsair" | "Antec" | "Cooler Master" | "Thermaltake" | "Be Quiet!";

  wattage: number;
  efficiency: "80 PLUS Bronze" | "80 PLUS Gold" | "80 PLUS Platinum" | "80 PLUS Titanium";
  modularity: "full" | "semi" | "non-modular";
  formFactor: "ATX" | "SFX";

  releaseYear: number;
  priceTier: "budget" | "mid" | "high";
}

export const psus: PSU[] = [
  {
    id: "seasonic-focus-gx-650",
    name: "Seasonic Focus GX-650",
    brand: "Seasonic",
    wattage: 650,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2023,
    priceTier: "mid",
  },
  {
    id: "seasonic-focus-gx-750",
    name: "Seasonic Focus GX-750",
    brand: "Seasonic",
    wattage: 750,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2022,
    priceTier: "high",
  },
  {
    id: "corsair-rm850x",
    name: "Corsair RM850x",
    brand: "Corsair",
    wattage: 850,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2021,
    priceTier: "high",
  },
  {
    id: "antec-hcg-850-gold",
    name: "Antec HCG-850 Gold",
    brand: "Antec",
    wattage: 850,
    efficiency: "80 PLUS Gold",
    modularity: "semi",
    formFactor: "ATX",
    releaseYear: 2022,
    priceTier: "mid",
  },
  {
    id: "cooler-master-v850-sfx",
    name: "Cooler Master V850 SFX",
    brand: "Cooler Master",
    wattage: 850,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "SFX",
    releaseYear: 2023,
    priceTier: "high",
  },
  {
    id: "thermaltake-toughpower-gf1-750",
    name: "Thermaltake Toughpower GF1 750W",
    brand: "Thermaltake",
    wattage: 750,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2022,
    priceTier: "mid",
  },
  {
    id: "be-quiet-dark-power-pro-12-850",
    name: "Be Quiet! Dark Power Pro 12 850W",
    brand: "Be Quiet!",
    wattage: 850,
    efficiency: "80 PLUS Titanium",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2023,
    priceTier: "high",
  },
  {
    id: "corsair-rm1000e",
    name: "Corsair RM1000e",
    brand: "Corsair",
    wattage: 1000,
    efficiency: "80 PLUS Gold",
    modularity: "full",
    formFactor: "ATX",
    releaseYear: 2024,
    priceTier: "high",
  },
];
