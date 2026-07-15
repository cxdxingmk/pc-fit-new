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

  /** 실거래가(KRW). recommender.ts는 이 값을 priceTier보다 우선 사용한다 — 용량/규격/클럭이
   *  천차만별인데 4단계 티어 하나로만 묶으면(예: "mid"=50만원) 8GB든 64GB든 같은 값이 나온다. */
  price: number;

  priceTier: "budget" | "mid" | "high";
}

// 특정 제품명을 강제하지 않고 "용량+규격+클럭"으로 일반화한다 — 실제로는 어느 브랜드든
// 스펙만 같으면 성능·가격이 사실상 동등하고(레이턴시 타이밍 차이는 이 카탈로그의 목적상
// 무시할 만큼 작음), CMD 자동 등록 결과도 브랜드 없이 이 형식으로 매칭되므로 표기를 통일한다.
export const rams: RAM[] = [
  {
    id: "16-ddr5-5600",
    name: "16GB DDR5-5600",
    brand: "범용",

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

    price: 65_000,
    priceTier: "budget",
  },

  {
    id: "32-ddr5-6000",
    name: "32GB DDR5-6000 (16GB x2)",
    brand: "범용",

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

    price: 135_000,
    priceTier: "mid",
  },

  {
    id: "64-ddr5-6400",
    name: "64GB DDR5-6400 (32GB x2)",
    brand: "범용",

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

    price: 280_000,
    priceTier: "high",
  },
  {
    id: "16-ddr4-3200",
    name: "16GB DDR4-3200 (8GB x2)",
    brand: "범용",

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

    price: 45_000,
    priceTier: "budget",
  },
  {
    id: "32-ddr4-3600",
    name: "32GB DDR4-3600 (16GB x2)",
    brand: "범용",

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

    price: 85_000,
    priceTier: "mid",
  },
  {
    id: "32-ddr4-3200-rgb",
    name: "32GB DDR4-3200 RGB (16GB x2)",
    brand: "범용",

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

    price: 95_000,
    priceTier: "high",
  }
];
