// HDD 카탈로그 — register-pc의 "HDD 모델 (선택)" 드롭다운에서만 쓰인다.
// SSD(app/database/ssd.ts)와 달리 gameScore/workScore/aiScore 같은 성능 점수 필드가 없다 —
// 이 앱의 성능 시뮬레이션·추천 엔진 어디에도 HDD가 입력으로 들어가지 않기 때문에(HDD는 순수
// 대용량 보관용 취급) 근거 없는 점수를 지어내지 않는다. 아래 필드는 전부 제조사 공식
// 스펙시트에 실제로 나오는 객관적 수치(RPM/캐시/인터페이스/용량/순차 읽기·쓰기 속도)만 담았고,
// 마케팅 문구나 리뷰 사이트의 코멘트는 옮겨 적지 않았다. priceTier도 SSD와 동일하게 대략적인
// 시세 구간만 표시하는 용도이며, recommender.ts의 priceTierToPrice 등 실제 가격 계산 로직에는
// 연결돼 있지 않다(HDD는 이 앱의 신규 구매 견적에 아예 포함되지 않는 항목이라 — recommender.test.ts
// "HDD는 어떤 추천 견적의 부품 목록에도 노출되지 않는다" 참고).
export interface HDD {
  id: string;

  name: string;
  brand: "Seagate" | "WD" | "Toshiba";

  capacity: number; // GB

  interface: "SATA III";

  rpm: number; // 회전수(RPM) — 일부 저용량/저전력 모델은 제조사가 정확한 값 대신 "5400 RPM class"처럼 등급으로만 공개한다
  cacheMb: number; // 캐시 용량(MB)

  readSpeed: number; // 순차 읽기 속도(MB/s), 제조사 스펙시트 기준
  writeSpeed: number; // 순차 쓰기 속도(MB/s), 제조사 스펙시트 기준

  releaseYear: number;

  priceTier: "budget" | "mid" | "high";
}

export const hdds: HDD[] = [
  {
    id: "barracuda-1tb",
    name: "Seagate BarraCuda 1TB (ST1000DM010)",
    brand: "Seagate",
    capacity: 1000,
    interface: "SATA III",
    rpm: 7200,
    cacheMb: 64,
    readSpeed: 220,
    writeSpeed: 220,
    releaseYear: 2017,
    priceTier: "budget",
  },
  {
    id: "barracuda-2tb",
    name: "Seagate BarraCuda 2TB (ST2000DM008)",
    brand: "Seagate",
    capacity: 2000,
    interface: "SATA III",
    rpm: 7200,
    cacheMb: 256,
    readSpeed: 220,
    writeSpeed: 220,
    releaseYear: 2017,
    priceTier: "budget",
  },
  {
    id: "barracuda-4tb",
    name: "Seagate BarraCuda 4TB (ST4000DM004)",
    brand: "Seagate",
    capacity: 4000,
    interface: "SATA III",
    rpm: 5400, // 제조사 스펙시트 표기: "5400 RPM class"
    cacheMb: 256,
    readSpeed: 190,
    writeSpeed: 190,
    releaseYear: 2017,
    priceTier: "mid",
  },
  {
    id: "wd-blue-1tb",
    name: "WD Blue 1TB (WD10EZEX)",
    brand: "WD",
    capacity: 1000,
    interface: "SATA III",
    rpm: 7200,
    cacheMb: 64,
    readSpeed: 150,
    writeSpeed: 150,
    releaseYear: 2013,
    priceTier: "budget",
  },
  {
    id: "wd-blue-2tb",
    name: "WD Blue 2TB (WD20EZBX)",
    brand: "WD",
    capacity: 2000,
    interface: "SATA III",
    rpm: 7200,
    cacheMb: 256,
    readSpeed: 175,
    writeSpeed: 175,
    releaseYear: 2019,
    priceTier: "budget",
  },
  {
    id: "wd-black-1tb",
    name: "WD Black 1TB (WD1003FZEX)",
    brand: "WD",
    capacity: 1000,
    interface: "SATA III",
    rpm: 7200,
    cacheMb: 64,
    readSpeed: 150,
    writeSpeed: 150,
    releaseYear: 2013,
    priceTier: "mid",
  },
  {
    id: "toshiba-p300-1tb",
    name: "Toshiba P300 1TB (HDWD110)",
    brand: "Toshiba",
    capacity: 1000,
    interface: "SATA III",
    rpm: 7200,
    cacheMb: 64,
    readSpeed: 150,
    writeSpeed: 150,
    releaseYear: 2016,
    priceTier: "budget",
  },
  {
    id: "toshiba-p300-2tb",
    name: "Toshiba P300 2TB (HDWD120)",
    brand: "Toshiba",
    capacity: 2000,
    interface: "SATA III",
    rpm: 7200,
    cacheMb: 128,
    readSpeed: 150,
    writeSpeed: 150,
    releaseYear: 2016,
    priceTier: "budget",
  },
];
