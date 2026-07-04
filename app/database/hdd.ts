export interface HDD {
  id: string;

  name: string;
  brand: "Seagate" | "Western Digital" | "Toshiba" | "Samsung" | "Hitachi";

  capacity: number; // GB
  rpm: number;
  cache: number; // MB

  formFactor: "3.5" | "2.5";
  interface: "SATA" | "SATA III";

  releaseYear: number;
  priceTier: "budget" | "mid" | "high";
}

export const hdds: HDD[] = [
  {
    id: "seagate-barracuda-2tb",
    name: "Seagate Barracuda 2TB",
    brand: "Seagate",
    capacity: 2000,
    rpm: 7200,
    cache: 256,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2021,
    priceTier: "budget",
  },
  {
    id: "seagate-ironwolf-4tb",
    name: "Seagate IronWolf 4TB",
    brand: "Seagate",
    capacity: 4000,
    rpm: 7200,
    cache: 256,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2020,
    priceTier: "mid",
  },
  {
    id: "seagate-firecuda-2tb",
    name: "Seagate FireCuda 2TB",
    brand: "Seagate",
    capacity: 2000,
    rpm: 7200,
    cache: 256,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2022,
    priceTier: "high",
  },
  {
    id: "wd-blue-2tb",
    name: "Western Digital Blue 2TB",
    brand: "Western Digital",
    capacity: 2000,
    rpm: 5400,
    cache: 256,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2020,
    priceTier: "budget",
  },
  {
    id: "wd-black-4tb",
    name: "Western Digital Black 4TB",
    brand: "Western Digital",
    capacity: 4000,
    rpm: 7200,
    cache: 256,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2021,
    priceTier: "mid",
  },
  {
    id: "wd-red-6tb",
    name: "Western Digital Red 6TB",
    brand: "Western Digital",
    capacity: 6000,
    rpm: 5400,
    cache: 256,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2021,
    priceTier: "high",
  },
  {
    id: "toshiba-p300-2tb",
    name: "Toshiba P300 2TB",
    brand: "Toshiba",
    capacity: 2000,
    rpm: 7200,
    cache: 128,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2019,
    priceTier: "budget",
  },
  {
    id: "toshiba-x300-4tb",
    name: "Toshiba X300 4TB",
    brand: "Toshiba",
    capacity: 4000,
    rpm: 7200,
    cache: 128,
    formFactor: "3.5",
    interface: "SATA III",
    releaseYear: 2019,
    priceTier: "mid",
  },
  {
    id: "samsung-870-evo-1tb",
    name: "Samsung 870 EVO 1TB",
    brand: "Samsung",
    capacity: 1000,
    rpm: 5400,
    cache: 128,
    formFactor: "2.5",
    interface: "SATA III",
    releaseYear: 2020,
    priceTier: "budget",
  },
];
