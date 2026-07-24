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
// RAM 가격(price) 갱신 이력: 2025년 하반기부터 삼성전자/SK하이닉스/마이크론이 AI용 HBM 생산에
// 라인을 집중시키며 일반 소비자용 D램 공급이 급감했고, 여기에 2026년 에너지 위기 여파까지 겹쳐
// 시세가 몇 달 새 4~6배 폭등했다(다나와 실측, 2026-07 기준) — 아래 6개 기존 항목의 가격은
// 이 폭등 이전 시세로 고정돼 있던 걸 최신 시세로 갱신한 값이다. 브랜드별 편차가 큰 항목은
// 프리미엄 최상급 라인업을 제외한 5~7개 보급형~중급형 브랜드 시세의 중앙값을, 편차가 작은
// 항목은 조사한 범위의 중간값을 대표값으로 썼다.
export const rams: RAM[] = [
  {
    // 저가형 iGPU CPU(Core i3-14100 등 LGA1700/DDR5) 경로에서도 저렴한 RAM 옵션을 쓸 수 있게
    // 추가 — 지금 랭킹상으론 AMD 5600G(DDR4) 쪽이 저가 사무용으로 더 자주 뽑히지만, 카탈로그
    // 완전성 차원에서 DDR5 플랫폼도 8GB 저가 옵션을 갖춰둔다.
    id: "8-ddr5-5600",
    name: "8GB DDR5-5600",
    brand: "범용",

    capacity: 8,
    sticks: 1,

    speed: 5600,

    ddr: "DDR5",

    rgb: false,

    xmp: false,
    expo: false,

    gameScore: 60,
    workScore: 54,
    aiScore: 48,

    price: 170_000,
    priceTier: "budget",
  },
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

    price: 340_000,
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

    price: 690_000,
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

    price: 1_475_000,
    priceTier: "high",
  },
  {
    id: "8-ddr4-3200",
    name: "8GB DDR4-3200",
    brand: "범용",

    capacity: 8,
    sticks: 1,

    speed: 3200,

    ddr: "DDR4",

    rgb: false,

    xmp: true,
    expo: false,

    gameScore: 55,
    workScore: 48,
    aiScore: 42,

    price: 87_500,
    priceTier: "budget",
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

    price: 190_000,
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

    price: 177_000,
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

    price: 163_300,
    priceTier: "high",
  }
];
