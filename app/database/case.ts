export interface Case {
  id: string;

  name: string;
  brand: "Lian Li" | "Corsair" | "NZXT" | "Fractal" | "Phanteks" | "Cooler Master";

  formFactor: "ATX" | "mATX" | "Mini-ITX";
  glass: boolean;
  airflow: "high" | "medium" | "low";

  releaseYear: number;
  priceTier: "budget" | "mid" | "high";
}

export const cases: Case[] = [
  {
    id: "lian-li-o11-dynamic",
    name: "Lian Li O11 Dynamic",
    brand: "Lian Li",
    formFactor: "ATX",
    glass: true,
    airflow: "medium",
    releaseYear: 2020,
    priceTier: "high",
  },
  {
    id: "lian-li-lancool-ii",
    name: "Lian Li Lancool II",
    brand: "Lian Li",
    formFactor: "ATX",
    glass: true,
    airflow: "high",
    releaseYear: 2021,
    priceTier: "mid",
  },
  {
    id: "corsair-4000d",
    name: "Corsair 4000D",
    brand: "Corsair",
    formFactor: "ATX",
    glass: false,
    airflow: "medium",
    releaseYear: 2020,
    priceTier: "mid",
  },
  {
    id: "corsair-5000x",
    name: "Corsair 5000X",
    brand: "Corsair",
    formFactor: "ATX",
    glass: true,
    airflow: "high",
    releaseYear: 2022,
    priceTier: "high",
  },
  {
    id: "nzxt-h510",
    name: "NZXT H510",
    brand: "NZXT",
    formFactor: "ATX",
    glass: true,
    airflow: "low",
    releaseYear: 2019,
    priceTier: "budget",
  },
  {
    id: "nzxt-h710",
    name: "NZXT H710",
    brand: "NZXT",
    formFactor: "ATX",
    glass: true,
    airflow: "medium",
    releaseYear: 2020,
    priceTier: "mid",
  },
  {
    id: "fractal-define-7",
    name: "Fractal Design Define 7",
    brand: "Fractal",
    formFactor: "ATX",
    glass: false,
    airflow: "medium",
    releaseYear: 2020,
    priceTier: "high",
  },
  {
    id: "phanteks-eclipse-p500a",
    name: "Phanteks Eclipse P500A",
    brand: "Phanteks",
    formFactor: "ATX",
    glass: true,
    airflow: "high",
    releaseYear: 2021,
    priceTier: "high",
  },
  {
    id: "cooler-master-masterbox-540",
    name: "Cooler Master MasterBox 540",
    brand: "Cooler Master",
    formFactor: "ATX",
    glass: true,
    airflow: "high",
    releaseYear: 2022,
    priceTier: "mid",
  },
];
