// "신규 구매로 추천/가격 수집할 가치가 있는가"를 부품군별로 판정하는 공용 규칙 모음.
// recommender.ts(/build 추천)와 partPricing.ts(/가격갱신 가격 수집 대상)가 이 파일 하나를
// 공유한다 — "무엇이 너무 오래됐는가"는 두 곳에서 같은 답을 내야 하는 하나의 질문이라
// 별도 모듈로 뽑았다(recommender.ts는 하위호환을 위해 같은 이름으로 재수출한다).
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";
import type { RAM } from "../database/ram";
import type { SSD } from "../database/ssd";
import type { MotherBoard } from "../database/motherboard";
import type { PSU } from "../database/psu";

// ── GPU ──────────────────────────────────────────────────────────────────────
// RTX 30번대/RX 6000번대 이하 세대는 이미 단종돼 신품 유통이 매우 제한적이고, 있어도
// 신세대보다 비싸게 팔리는 가격 역전이 흔하다(추천 후보에서도, 가격 수집 대상에서도 부적절) —
// RTX 40번대/RX 7000번대(RDNA3)부터를 최신 세대로 본다.
//
// releaseYear만으로는 부족하다 — 실제로 겪은 문제: 병합 카탈로그의 "GeForce RTX 3050 4 GB"는
// releaseYear가 2022라서 releaseYear>=2022 기준만 쓰면 30번대인데도 "최신"으로 잘못 통과된다
// (RTX 30번대 중 일부는 40번대와 같은 해에도 출시됐다). 그래서 모델명에 박혀 있는 세대 번호
// 자체(RTX/GTX의 두 자리 세대 접두, RX의 천 단위 세대)를 1차 기준으로 삼고, 그 패턴에 안
// 걸리는 브랜드(Intel Arc 등 — 아직 구세대가 존재하지 않음)만 releaseYear로 폴백한다.
// 모델명을 하나하나 나열해 배제하는 게 아니라 "세대 번호가 몇 이상인가"라는 규칙 하나로
// 판정하므로, RTX 50xx/60xx나 RX 8xxx/9xxx 이후 신세대가 카탈로그에 추가돼도 코드 수정 없이
// 자동으로 통과한다. 보유 부품으로 지정하는 경로(ownedParts.ts)는 이 제한과 무관하게 전
// 세대를 허용한다 — 이미 가진 부품 진단에는 세대 제한이 의미가 없다.
const MIN_NVIDIA_RTX_SERIES = 40; // RTX 40번대부터
const MIN_AMD_RX_SERIES = 7; // RX 7000번대(RDNA3, RTX 40세대와 동시대)부터
export const MIN_NEW_PURCHASE_GPU_RELEASE_YEAR = 2022; // 위 패턴에 안 걸리는 브랜드용 폴백 기준

function deriveNvidiaGpuSeries(name: string): number | null {
  const rtxMatch = name.match(/RTX\s?(\d{2})\d{2}/i); // "RTX 4070 SUPER" -> 40, "RTX 3050 4 GB" -> 30
  if (rtxMatch) return Number(rtxMatch[1]);
  if (/\bGTX\b/i.test(name)) return 0; // GTX는 전부 RTX 이전 세대다.
  return null;
}

function deriveAmdGpuSeries(name: string): number | null {
  const rxMatch = name.match(/RX\s?(\d)\d{3}\b/i); // "RX 7900 XTX" -> 7, "RX 6800 XT" -> 6
  if (rxMatch) return Number(rxMatch[1]);
  if (/RX\s?[3-5]\d{2}\b/i.test(name)) return -1; // RX 590/580/570/560 등 3자리(Polaris 이전) — 가장 오래됨
  return null;
}

// 중국 내수 시장 전용 수출규제 컷다운 변형(예: "RTX 5090 D", "RTX 5090 D V2" — 코어를 깎은 버전).
// 세대 필터는 정상 통과하지만 국내 유통이 없어 "신규 구매" 추천/가격 수집으로 부적절하고, 자동
// 추정 파이프라인(estimateTgp)이 이례적으로 많은 코어 수를 선형식에 그대로 대입해 TGP를
// 비현실적으로 부풀리는 문제까지 겹친다 — 신규 구매 후보에서 아예 제외한다.
function isChinaRestrictedGpuVariant(name: string): boolean {
  return /\bD(\s+V\d+)?$/i.test(name.trim());
}

export function isNewPurchaseEligibleGpu(gpu: GPU): boolean {
  if (isChinaRestrictedGpuVariant(gpu.name)) return false;

  const nvidiaSeries = deriveNvidiaGpuSeries(gpu.name);
  if (nvidiaSeries !== null) return nvidiaSeries >= MIN_NVIDIA_RTX_SERIES;

  const amdSeries = deriveAmdGpuSeries(gpu.name);
  if (amdSeries !== null) return amdSeries >= MIN_AMD_RX_SERIES;

  // Intel Arc 등 세대 접두 패턴이 없는 브랜드 — 아직 구세대가 존재하지 않으므로 releaseYear로만 판단.
  return gpu.releaseYear >= MIN_NEW_PURCHASE_GPU_RELEASE_YEAR;
}

// ── CPU ──────────────────────────────────────────────────────────────────────
// CPU는 GPU만큼 세대 교체가 빠르지 않다 — 예를 들어 Ryzen 5 5600(2020, AM4)은 지금도 AMD가
// 계속 신품으로 파는 예산형 스테디셀러라, GPU와 같은 기준(2022)을 그대로 적용하면 실제로
// 살 수 있는 합리적인 예산 픽까지 부당하게 제외하게 된다. 2019년 이전(Ryzen 1000~3000번대와
// 그에 준하는 구세대 Intel)은 실질적으로 신품 유통이 끊긴 지 오래라 확실히 제외한다. GPU와
// 달리 CPU 카탈로그 전수 조사에서는 releaseYear가 실제 세대와 어긋나는 사례가 발견되지
// 않아 releaseYear 단독 기준으로 충분하다.
export const MIN_NEW_PURCHASE_CPU_RELEASE_YEAR = 2020;

export function isNewPurchaseEligibleCpu(cpu: CPU): boolean {
  return cpu.releaseYear >= MIN_NEW_PURCHASE_CPU_RELEASE_YEAR;
}

// ── RAM ──────────────────────────────────────────────────────────────────────
// releaseYear 필드가 없어(카탈로그가 "용량+규격+클럭"으로 일반화돼 있어 특정 출시 시점을
// 안 가짐) ddr/speed로 대신 판단한다. DDR5는 전부 통과, DDR4는 실제로 여전히 활발히 유통되는
// 3200MHz 이상만 통과 — 2133/2400/2666 같은 구형 저클럭 키트가 카탈로그에 추가될 경우를 대비한
// 안전장치다(현재 카탈로그엔 이보다 낮은 클럭이 없어 지금 당장 영향은 없음).
const MIN_DDR4_SPEED_FOR_NEW_PURCHASE = 3200;

export function isNewPurchaseEligibleRam(ram: RAM): boolean {
  if (ram.ddr === "DDR5") return true;
  return ram.speed >= MIN_DDR4_SPEED_FOR_NEW_PURCHASE;
}

// ── SSD ──────────────────────────────────────────────────────────────────────
// 2021년 이전(PCIe Gen3 시대)은 카탈로그에 없지만, 향후 그런 항목이 추가될 경우를 대비한
// 안전장치 — 지금 카탈로그는 전부 2022~2023년 PCIe 4.0이라 현재는 영향이 없다.
export const MIN_NEW_PURCHASE_SSD_RELEASE_YEAR = 2021;

export function isNewPurchaseEligibleSsd(ssd: SSD): boolean {
  return ssd.releaseYear >= MIN_NEW_PURCHASE_SSD_RELEASE_YEAR;
}

// ── 메인보드 ──────────────────────────────────────────────────────────────────
// 지금 카탈로그의 가장 오래된 항목(2020년 B550)이 여전히 활발히 신품 유통되는 AM4 보급형
// 보드라 이 기준을 그대로 하한으로 삼는다 — 지금은 영향이 없고, 향후 H410/B360/X470처럼
// 실질적으로 단종된 구형 칩셋이 추가될 경우를 대비한 안전장치다.
export const MIN_NEW_PURCHASE_MOTHERBOARD_RELEASE_YEAR = 2020;

export function isNewPurchaseEligibleMotherboard(mb: MotherBoard): boolean {
  return mb.releaseYear >= MIN_NEW_PURCHASE_MOTHERBOARD_RELEASE_YEAR;
}

// ── PSU ──────────────────────────────────────────────────────────────────────
// 지금 카탈로그(2021~2025년)에는 영향이 없는 안전장치 — 향후 구형 PSU가 추가될 경우를 대비한다.
export const MIN_NEW_PURCHASE_PSU_RELEASE_YEAR = 2020;

export function isNewPurchaseEligiblePsu(psu: PSU): boolean {
  return psu.releaseYear >= MIN_NEW_PURCHASE_PSU_RELEASE_YEAR;
}

// ── HDD ──────────────────────────────────────────────────────────────────────
// 의도적으로 필터 없음 — GPU/CPU와 달리 HDD 제품군(Seagate BarraCuda, WD Blue/Black, Toshiba
// P300 등)은 모델의 releaseYear가 오래돼도 단종되지 않고 수년~십수 년간 계속 신품으로 유통되는
// 경우가 흔하다. "출시 연도가 오래됨"이 "더 이상 못 삼"을 의미하지 않는 카테고리라 releaseYear
// 기준 배제를 적용하지 않는다.
