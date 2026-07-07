/**
 * HARDWARE_MASTER_PRESETS
 * ------------------------------------------------------------------
 * 2017-01-01 이후 출시된 상업용/조립용 '데스크탑' CPU·GPU 물리 사양 마스터 데이터.
 *
 * 데이터 출처 및 처리 방침 (법무/신뢰성 검토용 요약)
 *  1) 1차 원천: 제조사 공개 물리 사양(코어/스레드/클럭/VRAM/스트림·CUDA 코어/출시연도)만 추출.
 *     PassMark 'CPU Mark', 3DMark, UserBenchmark 등 제3자 산출 '성능 점수'는 원본에도 없었고
 *     포함하지도 않았다. 벤치마크 사이트의 URL/ID 등 출처 식별자도 전부 제거했다.
 *  2) 노트북/모바일 파생 라인업은 제외했다 (접미사 U/M/H/HX/HK/Y/Z/P, 'Mobile' 등 표기,
 *     Chromebook/Surface OEM 변형 포함).
 *  3) [2차 보완] 원본 CSV에 행은 존재하지만 Cores/Threads/Clock 값이 비어 있던 12~13세대
 *     인텔 데스크탑 모델은 Intel ARK 공식 스펙으로 보완했다 (아래 '_source: ark_gapfill').
 *  4) [수동 추가] 14세대(Raptor Lake Refresh) 데스크탑 라인업은 원본 CSV에 행 자체가 없어
 *     Intel ARK 공식 스펙으로 신규 추가했다 (아래 '_source: ark_manual_addition').
 *     ⚠️ 이 두 그룹은 '스크레이핑 원본'이 아닌 '수동 보완 데이터'이므로, 신규 모델 출시 시
 *     주기적으로 Intel ARK/AMD.com/NVIDIA.com 공식 스펙과 재대조(재검증)할 것을 권장한다.
 *  5) GPU는 동일 실물 카드의 리비전/코드네임 변형(GDDR5X, TU106, GA104, Rev.2, OEM 등)을
 *     모델명 기준으로 병합해 대표 1건만 남겼다 (검색 UX 개선 목적, 중복 제거).
 *  6) 서비스 내부 '성능 점수'는 이 물리 사양을 입력으로 자체 로직에서 산출한다
 *     (제3자 벤치마크 점수의 재게시가 아니다).
 * ------------------------------------------------------------------
 */

export interface CPUData {
  model: string;
  cores: number;
  threads: number;
  baseClockGhz: number;
  releaseYear: number;
}

export interface GPUData {
  model: string;
  manufacturer: "NVIDIA" | "AMD" | "Intel";
  cudaOrStreamCores: number;
  vramGb: number;
  releaseYear: number;
}

export interface RAMData {
  model: string;
  manufacturer: "Samsung" | "SK Hynix" | "Micron" | "TeamGroup" | "KLEVV" | "G.Skill";
  type: "DDR4" | "DDR5";
  capacityGb: number;
  speedMtps: number;
  releaseYear: number;
}

export interface SSDData {
  model: string;
  manufacturer: "Samsung" | "SK Hynix" | "Micron" | "Western Digital" | "SanDisk" | "TeamGroup";
  deviceType: "SATA" | "PCIe Gen3 NVMe" | "PCIe Gen4 NVMe" | "PCIe Gen5 NVMe";
  capacityGb: number;
  readSpeedMbps: number;
  writeSpeedMbps: number;
  releaseYear: number;
}

export const HARDWARE_MASTER_PRESETS = {
  cpus: {
    "AMD Ryzen 3 1200": { model: "AMD Ryzen 3 1200", cores: 4, threads: 4, baseClockGhz: 3.1, releaseYear: 2017 },
    "AMD Ryzen 3 1300X": { model: "AMD Ryzen 3 1300X", cores: 4, threads: 4, baseClockGhz: 3.5, releaseYear: 2017 },
    "AMD Ryzen 3 2200G": { model: "AMD Ryzen 3 2200G", cores: 4, threads: 4, baseClockGhz: 3.5, releaseYear: 2018 },
    "AMD Ryzen 3 2200GE": { model: "AMD Ryzen 3 2200GE", cores: 4, threads: 4, baseClockGhz: 3.2, releaseYear: 2018 },
    "AMD Ryzen 3 2300X": { model: "AMD Ryzen 3 2300X", cores: 4, threads: 4, baseClockGhz: 3.5, releaseYear: 2019 },
    "AMD Ryzen 3 3100": { model: "AMD Ryzen 3 3100", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2020 },
    "AMD Ryzen 3 3200G": { model: "AMD Ryzen 3 3200G", cores: 4, threads: 4, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 3 3200GE": { model: "AMD Ryzen 3 3200GE", cores: 4, threads: 4, baseClockGhz: 3.3, releaseYear: 2020 },
    "AMD Ryzen 3 3250C": { model: "AMD Ryzen 3 3250C", cores: 2, threads: 4, baseClockGhz: 2.6, releaseYear: 2021 },
    "AMD Ryzen 3 3300X": { model: "AMD Ryzen 3 3300X", cores: 4, threads: 8, baseClockGhz: 3.8, releaseYear: 2020 },
    "AMD Ryzen 3 4100": { model: "AMD Ryzen 3 4100", cores: 4, threads: 8, baseClockGhz: 3.8, releaseYear: 2022 },
    "AMD Ryzen 3 4300G": { model: "AMD Ryzen 3 4300G", cores: 4, threads: 8, baseClockGhz: 3.8, releaseYear: 2020 },
    "AMD Ryzen 3 4300GE": { model: "AMD Ryzen 3 4300GE", cores: 4, threads: 8, baseClockGhz: 3.5, releaseYear: 2020 },
    "AMD Ryzen 3 5300G": { model: "AMD Ryzen 3 5300G", cores: 4, threads: 8, baseClockGhz: 4.0, releaseYear: 2021 },
    "AMD Ryzen 3 5300GE": { model: "AMD Ryzen 3 5300GE", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2021 },
    "AMD Ryzen 3 PRO 1200": { model: "AMD Ryzen 3 PRO 1200", cores: 4, threads: 4, baseClockGhz: 3.1, releaseYear: 2017 },
    "AMD Ryzen 3 PRO 1300": { model: "AMD Ryzen 3 PRO 1300", cores: 4, threads: 4, baseClockGhz: 3.5, releaseYear: 2017 },
    "AMD Ryzen 3 PRO 2100GE": { model: "AMD Ryzen 3 PRO 2100GE", cores: 2, threads: 4, baseClockGhz: 3.2, releaseYear: 2019 },
    "AMD Ryzen 3 PRO 2200G": { model: "AMD Ryzen 3 PRO 2200G", cores: 4, threads: 4, baseClockGhz: 3.5, releaseYear: 2018 },
    "AMD Ryzen 3 PRO 2200GE": { model: "AMD Ryzen 3 PRO 2200GE", cores: 4, threads: 4, baseClockGhz: 3.2, releaseYear: 2018 },
    "AMD Ryzen 3 PRO 3200G": { model: "AMD Ryzen 3 PRO 3200G", cores: 4, threads: 4, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 3 PRO 3200GE": { model: "AMD Ryzen 3 PRO 3200GE", cores: 4, threads: 4, baseClockGhz: 3.3, releaseYear: 2019 },
    "AMD Ryzen 3 PRO 4200G": { model: "AMD Ryzen 3 PRO 4200G", cores: 4, threads: 8, baseClockGhz: 3.8, releaseYear: 2021 },
    "AMD Ryzen 3 PRO 4200GE": { model: "AMD Ryzen 3 PRO 4200GE", cores: 4, threads: 8, baseClockGhz: 1.7, releaseYear: 2020 },
    "AMD Ryzen 3 PRO 4350G": { model: "AMD Ryzen 3 PRO 4350G", cores: 4, threads: 8, baseClockGhz: 3.8, releaseYear: 2020 },
    "AMD Ryzen 3 PRO 4350GE": { model: "AMD Ryzen 3 PRO 4350GE", cores: 4, threads: 8, baseClockGhz: 3.5, releaseYear: 2020 },
    "AMD Ryzen 3 PRO 4355GE": { model: "AMD Ryzen 3 PRO 4355GE", cores: 4, threads: 8, baseClockGhz: 3.5, releaseYear: 2023 },
    "AMD Ryzen 3 PRO 5350G": { model: "AMD Ryzen 3 PRO 5350G", cores: 4, threads: 8, baseClockGhz: 4.0, releaseYear: 2021 },
    "AMD Ryzen 3 PRO 5350GE": { model: "AMD Ryzen 3 PRO 5350GE", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2021 },
    "AMD Ryzen 5 1400": { model: "AMD Ryzen 5 1400", cores: 4, threads: 8, baseClockGhz: 3.2, releaseYear: 2017 },
    "AMD Ryzen 5 1500X": { model: "AMD Ryzen 5 1500X", cores: 4, threads: 8, baseClockGhz: 3.5, releaseYear: 2017 },
    "AMD Ryzen 5 1600": { model: "AMD Ryzen 5 1600", cores: 6, threads: 12, baseClockGhz: 3.2, releaseYear: 2017 },
    "AMD Ryzen 5 1600X": { model: "AMD Ryzen 5 1600X", cores: 6, threads: 12, baseClockGhz: 3.6, releaseYear: 2017 },
    "AMD Ryzen 5 2400G": { model: "AMD Ryzen 5 2400G", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2018 },
    "AMD Ryzen 5 2400GE": { model: "AMD Ryzen 5 2400GE", cores: 4, threads: 8, baseClockGhz: 3.2, releaseYear: 2018 },
    "AMD Ryzen 5 2500X": { model: "AMD Ryzen 5 2500X", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 5 2600": { model: "AMD Ryzen 5 2600", cores: 6, threads: 12, baseClockGhz: 3.4, releaseYear: 2018 },
    "AMD Ryzen 5 2600X": { model: "AMD Ryzen 5 2600X", cores: 6, threads: 12, baseClockGhz: 3.6, releaseYear: 2018 },
    "AMD Ryzen 5 3350G": { model: "AMD Ryzen 5 3350G", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2020 },
    "AMD Ryzen 5 3350GE": { model: "AMD Ryzen 5 3350GE", cores: 4, threads: 8, baseClockGhz: 3.3, releaseYear: 2020 },
    "AMD Ryzen 5 3400G": { model: "AMD Ryzen 5 3400G", cores: 4, threads: 8, baseClockGhz: 3.7, releaseYear: 2019 },
    "AMD Ryzen 5 3400GE": { model: "AMD Ryzen 5 3400GE", cores: 4, threads: 8, baseClockGhz: 3.3, releaseYear: 2020 },
    "AMD Ryzen 5 3500": { model: "AMD Ryzen 5 3500", cores: 6, threads: 6, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 5 3500C": { model: "AMD Ryzen 5 3500C", cores: 4, threads: 8, baseClockGhz: 2.1, releaseYear: 2021 },
    "AMD Ryzen 5 3500X": { model: "AMD Ryzen 5 3500X", cores: 6, threads: 6, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 5 3600": { model: "AMD Ryzen 5 3600", cores: 6, threads: 12, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 5 3600X": { model: "AMD Ryzen 5 3600X", cores: 6, threads: 12, baseClockGhz: 3.8, releaseYear: 2019 },
    "AMD Ryzen 5 3600XT": { model: "AMD Ryzen 5 3600XT", cores: 6, threads: 12, baseClockGhz: 3.8, releaseYear: 2020 },
    "AMD Ryzen 5 4400G": { model: "AMD Ryzen 5 4400G", cores: 6, threads: 12, baseClockGhz: 3.7, releaseYear: 2023 },
    "AMD Ryzen 5 4500": { model: "AMD Ryzen 5 4500", cores: 6, threads: 12, baseClockGhz: 3.6, releaseYear: 2022 },
    "AMD Ryzen 5 4600G": { model: "AMD Ryzen 5 4600G", cores: 6, threads: 12, baseClockGhz: 3.7, releaseYear: 2020 },
    "AMD Ryzen 5 4600GE": { model: "AMD Ryzen 5 4600GE", cores: 6, threads: 12, baseClockGhz: 3.3, releaseYear: 2020 },
    "AMD Ryzen 5 5500": { model: "AMD Ryzen 5 5500", cores: 6, threads: 12, baseClockGhz: 3.6, releaseYear: 2022 },
    "AMD Ryzen 5 5600": { model: "AMD Ryzen 5 5600", cores: 6, threads: 12, baseClockGhz: 3.5, releaseYear: 2022 },
    "AMD Ryzen 5 5600G": { model: "AMD Ryzen 5 5600G", cores: 6, threads: 12, baseClockGhz: 3.9, releaseYear: 2021 },
    "AMD Ryzen 5 5600GE": { model: "AMD Ryzen 5 5600GE", cores: 6, threads: 12, baseClockGhz: 3.4, releaseYear: 2021 },
    "AMD Ryzen 5 5600X": { model: "AMD Ryzen 5 5600X", cores: 6, threads: 12, baseClockGhz: 3.7, releaseYear: 2020 },
    "AMD Ryzen 5 7600": { model: "AMD Ryzen 5 7600", cores: 6, threads: 12, baseClockGhz: 3.8, releaseYear: 2023 },
    "AMD Ryzen 5 7600X": { model: "AMD Ryzen 5 7600X", cores: 6, threads: 12, baseClockGhz: 4.7, releaseYear: 2022 },
    "AMD Ryzen 5 PRO 1500": { model: "AMD Ryzen 5 PRO 1500", cores: 4, threads: 8, baseClockGhz: 3.5, releaseYear: 2017 },
    "AMD Ryzen 5 PRO 1600": { model: "AMD Ryzen 5 PRO 1600", cores: 6, threads: 12, baseClockGhz: 3.2, releaseYear: 2017 },
    "AMD Ryzen 5 PRO 2400G": { model: "AMD Ryzen 5 PRO 2400G", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2018 },
    "AMD Ryzen 5 PRO 2400GE": { model: "AMD Ryzen 5 PRO 2400GE", cores: 4, threads: 8, baseClockGhz: 3.2, releaseYear: 2018 },
    "AMD Ryzen 5 PRO 2600": { model: "AMD Ryzen 5 PRO 2600", cores: 6, threads: 12, baseClockGhz: 3.4, releaseYear: 2018 },
    "AMD Ryzen 5 PRO 3350G": { model: "AMD Ryzen 5 PRO 3350G", cores: 4, threads: 8, baseClockGhz: 3.6, releaseYear: 2020 },
    "AMD Ryzen 5 PRO 3350GE": { model: "AMD Ryzen 5 PRO 3350GE", cores: 4, threads: 4, baseClockGhz: 3.3, releaseYear: 2020 },
    "AMD Ryzen 5 PRO 3400G": { model: "AMD Ryzen 5 PRO 3400G", cores: 4, threads: 8, baseClockGhz: 3.7, releaseYear: 2019 },
    "AMD Ryzen 5 PRO 3400GE": { model: "AMD Ryzen 5 PRO 3400GE", cores: 4, threads: 8, baseClockGhz: 3.3, releaseYear: 2019 },
    "AMD Ryzen 5 PRO 3600": { model: "AMD Ryzen 5 PRO 3600", cores: 6, threads: 12, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 5 PRO 4400G": { model: "AMD Ryzen 5 PRO 4400G", cores: 6, threads: 12, baseClockGhz: 3.7, releaseYear: 2020 },
    "AMD Ryzen 5 PRO 4400GE": { model: "AMD Ryzen 5 PRO 4400GE", cores: 6, threads: 12, baseClockGhz: 3.3, releaseYear: 2020 },
    "AMD Ryzen 5 PRO 4650G": { model: "AMD Ryzen 5 PRO 4650G", cores: 6, threads: 12, baseClockGhz: 3.7, releaseYear: 2020 },
    "AMD Ryzen 5 PRO 4650GE": { model: "AMD Ryzen 5 PRO 4650GE", cores: 6, threads: 12, baseClockGhz: 3.3, releaseYear: 2020 },
    "AMD Ryzen 5 PRO 4655G": { model: "AMD Ryzen 5 PRO 4655G", cores: 6, threads: 12, baseClockGhz: 3.7, releaseYear: 2023 },
    "AMD Ryzen 5 PRO 5645": { model: "AMD Ryzen 5 PRO 5645", cores: 6, threads: 12, baseClockGhz: 3.7, releaseYear: 2022 },
    "AMD Ryzen 5 PRO 5650G": { model: "AMD Ryzen 5 PRO 5650G", cores: 6, threads: 12, baseClockGhz: 3.9, releaseYear: 2021 },
    "AMD Ryzen 5 PRO 5650GE": { model: "AMD Ryzen 5 PRO 5650GE", cores: 6, threads: 12, baseClockGhz: 3.4, releaseYear: 2021 },
    "AMD Ryzen 7 1700": { model: "AMD Ryzen 7 1700", cores: 8, threads: 16, baseClockGhz: 3.0, releaseYear: 2017 },
    "AMD Ryzen 7 1700X": { model: "AMD Ryzen 7 1700X", cores: 8, threads: 16, baseClockGhz: 3.4, releaseYear: 2017 },
    "AMD Ryzen 7 1800X": { model: "AMD Ryzen 7 1800X", cores: 8, threads: 16, baseClockGhz: 3.6, releaseYear: 2017 },
    "AMD Ryzen 7 2700": { model: "AMD Ryzen 7 2700", cores: 8, threads: 16, baseClockGhz: 3.2, releaseYear: 2018 },
    "AMD Ryzen 7 2700E": { model: "AMD Ryzen 7 2700E", cores: 8, threads: 16, baseClockGhz: 2.8, releaseYear: 2019 },
    "AMD Ryzen 7 2700X": { model: "AMD Ryzen 7 2700X", cores: 8, threads: 16, baseClockGhz: 3.7, releaseYear: 2018 },
    "AMD Ryzen 7 3700C": { model: "AMD Ryzen 7 3700C", cores: 4, threads: 8, baseClockGhz: 2.3, releaseYear: 2022 },
    "AMD Ryzen 7 3700X": { model: "AMD Ryzen 7 3700X", cores: 8, threads: 16, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 7 3800X": { model: "AMD Ryzen 7 3800X", cores: 8, threads: 16, baseClockGhz: 3.9, releaseYear: 2019 },
    "AMD Ryzen 7 3800XT": { model: "AMD Ryzen 7 3800XT", cores: 8, threads: 16, baseClockGhz: 3.9, releaseYear: 2020 },
    "AMD Ryzen 7 4700G": { model: "AMD Ryzen 7 4700G", cores: 8, threads: 16, baseClockGhz: 3.6, releaseYear: 2020 },
    "AMD Ryzen 7 4700GE": { model: "AMD Ryzen 7 4700GE", cores: 8, threads: 16, baseClockGhz: 3.1, releaseYear: 2020 },
    "AMD Ryzen 7 5700": { model: "AMD Ryzen 7 5700", cores: 8, threads: 16, baseClockGhz: 3.7, releaseYear: 2022 },
    "AMD Ryzen 7 5700G": { model: "AMD Ryzen 7 5700G", cores: 8, threads: 16, baseClockGhz: 3.8, releaseYear: 2021 },
    "AMD Ryzen 7 5700GE": { model: "AMD Ryzen 7 5700GE", cores: 8, threads: 16, baseClockGhz: 3.2, releaseYear: 2021 },
    "AMD Ryzen 7 5700X": { model: "AMD Ryzen 7 5700X", cores: 8, threads: 16, baseClockGhz: 3.4, releaseYear: 2022 },
    "AMD Ryzen 7 5800": { model: "AMD Ryzen 7 5800", cores: 8, threads: 16, baseClockGhz: 3.4, releaseYear: 2021 },
    "AMD Ryzen 7 5800X": { model: "AMD Ryzen 7 5800X", cores: 8, threads: 16, baseClockGhz: 3.8, releaseYear: 2020 },
    "AMD Ryzen 7 5800X3D": { model: "AMD Ryzen 7 5800X3D", cores: 8, threads: 16, baseClockGhz: 3.4, releaseYear: 2022 },
    "AMD Ryzen 7 7700": { model: "AMD Ryzen 7 7700", cores: 8, threads: 16, baseClockGhz: 3.8, releaseYear: 2023 },
    "AMD Ryzen 7 7700X": { model: "AMD Ryzen 7 7700X", cores: 8, threads: 16, baseClockGhz: 4.5, releaseYear: 2022 },
    "AMD Ryzen 7 7800X3D": { model: "AMD Ryzen 7 7800X3D", cores: 8, threads: 16, baseClockGhz: 4.2, releaseYear: 2023 },
    "AMD Ryzen 7 PRO 1700": { model: "AMD Ryzen 7 PRO 1700", cores: 8, threads: 16, baseClockGhz: 3.0, releaseYear: 2017 },
    "AMD Ryzen 7 PRO 1700X": { model: "AMD Ryzen 7 PRO 1700X", cores: 8, threads: 16, baseClockGhz: 3.4, releaseYear: 2017 },
    "AMD Ryzen 7 PRO 2700": { model: "AMD Ryzen 7 PRO 2700", cores: 8, threads: 16, baseClockGhz: 3.2, releaseYear: 2018 },
    "AMD Ryzen 7 PRO 2700X": { model: "AMD Ryzen 7 PRO 2700X", cores: 8, threads: 16, baseClockGhz: 3.7, releaseYear: 2018 },
    "AMD Ryzen 7 PRO 3700": { model: "AMD Ryzen 7 PRO 3700", cores: 8, threads: 16, baseClockGhz: 3.6, releaseYear: 2019 },
    "AMD Ryzen 7 PRO 4700G": { model: "AMD Ryzen 7 PRO 4700G", cores: 8, threads: 16, baseClockGhz: 3.6, releaseYear: 2020 },
    "AMD Ryzen 7 PRO 4750G": { model: "AMD Ryzen 7 PRO 4750G", cores: 8, threads: 16, baseClockGhz: 3.6, releaseYear: 2020 },
    "AMD Ryzen 7 PRO 4750GE": { model: "AMD Ryzen 7 PRO 4750GE", cores: 8, threads: 16, baseClockGhz: 3.1, releaseYear: 2020 },
    "AMD Ryzen 7 PRO 5750G": { model: "AMD Ryzen 7 PRO 5750G", cores: 8, threads: 16, baseClockGhz: 3.8, releaseYear: 2021 },
    "AMD Ryzen 7 PRO 5750GE": { model: "AMD Ryzen 7 PRO 5750GE", cores: 8, threads: 16, baseClockGhz: 3.2, releaseYear: 2021 },
    "AMD Ryzen 7 PRO 5845": { model: "AMD Ryzen 7 PRO 5845", cores: 8, threads: 16, baseClockGhz: 3.4, releaseYear: 2022 },
    "AMD Ryzen 9 3900": { model: "AMD Ryzen 9 3900", cores: 12, threads: 24, baseClockGhz: 3.1, releaseYear: 2019 },
    "AMD Ryzen 9 3900X": { model: "AMD Ryzen 9 3900X", cores: 12, threads: 24, baseClockGhz: 3.8, releaseYear: 2019 },
    "AMD Ryzen 9 3900XT": { model: "AMD Ryzen 9 3900XT", cores: 12, threads: 24, baseClockGhz: 3.8, releaseYear: 2020 },
    "AMD Ryzen 9 3950X": { model: "AMD Ryzen 9 3950X", cores: 16, threads: 32, baseClockGhz: 3.5, releaseYear: 2019 },
    "AMD Ryzen 9 5900": { model: "AMD Ryzen 9 5900", cores: 12, threads: 24, baseClockGhz: 3.0, releaseYear: 2021 },
    "AMD Ryzen 9 5900X": { model: "AMD Ryzen 9 5900X", cores: 12, threads: 24, baseClockGhz: 3.7, releaseYear: 2020 },
    "AMD Ryzen 9 5950X": { model: "AMD Ryzen 9 5950X", cores: 16, threads: 32, baseClockGhz: 3.4, releaseYear: 2020 },
    "AMD Ryzen 9 7900": { model: "AMD Ryzen 9 7900", cores: 12, threads: 24, baseClockGhz: 3.7, releaseYear: 2023 },
    "AMD Ryzen 9 7900X": { model: "AMD Ryzen 9 7900X", cores: 12, threads: 24, baseClockGhz: 4.7, releaseYear: 2022 },
    "AMD Ryzen 9 7900X3D": { model: "AMD Ryzen 9 7900X3D", cores: 12, threads: 24, baseClockGhz: 4.4, releaseYear: 2023 },
    "AMD Ryzen 9 7950X": { model: "AMD Ryzen 9 7950X", cores: 16, threads: 32, baseClockGhz: 4.5, releaseYear: 2022 },
    "AMD Ryzen 9 7950X3D": { model: "AMD Ryzen 9 7950X3D", cores: 16, threads: 32, baseClockGhz: 4.2, releaseYear: 2023 },
    "AMD Ryzen 9 PRO 3900": { model: "AMD Ryzen 9 PRO 3900", cores: 12, threads: 24, baseClockGhz: 3.1, releaseYear: 2019 },
    "AMD Ryzen 9 PRO 5945": { model: "AMD Ryzen 9 PRO 5945", cores: 12, threads: 24, baseClockGhz: 3.0, releaseYear: 2022 },
    "AMD Ryzen Threadripper 1900X": { model: "AMD Ryzen Threadripper 1900X", cores: 8, threads: 16, baseClockGhz: 3.8, releaseYear: 2017 },
    "AMD Ryzen Threadripper 1920": { model: "AMD Ryzen Threadripper 1920", cores: 12, threads: 24, baseClockGhz: 3.2, releaseYear: 2021 },
    "AMD Ryzen Threadripper 1920X": { model: "AMD Ryzen Threadripper 1920X", cores: 12, threads: 24, baseClockGhz: 3.5, releaseYear: 2017 },
    "AMD Ryzen Threadripper 1950X": { model: "AMD Ryzen Threadripper 1950X", cores: 16, threads: 32, baseClockGhz: 3.4, releaseYear: 2017 },
    "AMD Ryzen Threadripper 2920X": { model: "AMD Ryzen Threadripper 2920X", cores: 12, threads: 24, baseClockGhz: 3.5, releaseYear: 2018 },
    "AMD Ryzen Threadripper 2950X": { model: "AMD Ryzen Threadripper 2950X", cores: 16, threads: 32, baseClockGhz: 3.5, releaseYear: 2018 },
    "AMD Ryzen Threadripper 2970WX": { model: "AMD Ryzen Threadripper 2970WX", cores: 24, threads: 48, baseClockGhz: 3.0, releaseYear: 2018 },
    "AMD Ryzen Threadripper 2990WX": { model: "AMD Ryzen Threadripper 2990WX", cores: 32, threads: 64, baseClockGhz: 3.0, releaseYear: 2018 },
    "AMD Ryzen Threadripper 2990X": { model: "AMD Ryzen Threadripper 2990X", cores: 32, threads: 64, baseClockGhz: 3.4, releaseYear: 2018 },
    "AMD Ryzen Threadripper 3960X": { model: "AMD Ryzen Threadripper 3960X", cores: 24, threads: 48, baseClockGhz: 3.8, releaseYear: 2019 },
    "AMD Ryzen Threadripper 3970X": { model: "AMD Ryzen Threadripper 3970X", cores: 32, threads: 64, baseClockGhz: 3.7, releaseYear: 2019 },
    "AMD Ryzen Threadripper 3990X": { model: "AMD Ryzen Threadripper 3990X", cores: 64, threads: 128, baseClockGhz: 2.9, releaseYear: 2020 },
    "AMD Ryzen Threadripper PRO 3945WX": { model: "AMD Ryzen Threadripper PRO 3945WX", cores: 12, threads: 24, baseClockGhz: 4.0, releaseYear: 2020 },
    "AMD Ryzen Threadripper PRO 3955WX": { model: "AMD Ryzen Threadripper PRO 3955WX", cores: 16, threads: 32, baseClockGhz: 3.9, releaseYear: 2020 },
    "AMD Ryzen Threadripper PRO 3975WX": { model: "AMD Ryzen Threadripper PRO 3975WX", cores: 32, threads: 64, baseClockGhz: 3.5, releaseYear: 2020 },
    "AMD Ryzen Threadripper PRO 3995WX": { model: "AMD Ryzen Threadripper PRO 3995WX", cores: 64, threads: 128, baseClockGhz: 2.7, releaseYear: 2020 },
    "AMD Ryzen Threadripper PRO 5945WX": { model: "AMD Ryzen Threadripper PRO 5945WX", cores: 12, threads: 24, baseClockGhz: 4.1, releaseYear: 2022 },
    "AMD Ryzen Threadripper PRO 5955WX": { model: "AMD Ryzen Threadripper PRO 5955WX", cores: 16, threads: 32, baseClockGhz: 4.0, releaseYear: 2022 },
    "AMD Ryzen Threadripper PRO 5965WX": { model: "AMD Ryzen Threadripper PRO 5965WX", cores: 24, threads: 48, baseClockGhz: 3.8, releaseYear: 2022 },
    "AMD Ryzen Threadripper PRO 5975WX": { model: "AMD Ryzen Threadripper PRO 5975WX", cores: 32, threads: 64, baseClockGhz: 3.6, releaseYear: 2022 },
    "AMD Ryzen Threadripper PRO 5995WX": { model: "AMD Ryzen Threadripper PRO 5995WX", cores: 64, threads: 128, baseClockGhz: 2.7, releaseYear: 2022 },
    "Intel Core i3-12100": { model: "Intel Core i3-12100", cores: 4, threads: 8, baseClockGhz: 3.3, releaseYear: 2022 },
    "Intel Core i3-12100F": { model: "Intel Core i3-12100F", cores: 4, threads: 8, baseClockGhz: 3.3, releaseYear: 2022 },
    "Intel Core i3-12100T": { model: "Intel Core i3-12100T", cores: 4, threads: 8, baseClockGhz: 2.2, releaseYear: 2022 },
    "Intel Core i3-12100TE": { model: "Intel Core i3-12100TE", cores: 4, threads: 8, baseClockGhz: 2.1, releaseYear: 2022 },
    "Intel Core i3-12300": { model: "Intel Core i3-12300", cores: 4, threads: 8, baseClockGhz: 3.5, releaseYear: 2022 },
    "Intel Core i3-12300T": { model: "Intel Core i3-12300T", cores: 4, threads: 8, baseClockGhz: 2.3, releaseYear: 2022 },
    "Intel Core i3-13100": { model: "Intel Core i3-13100", cores: 4, threads: 8, baseClockGhz: 3.4, releaseYear: 2023 },
    "Intel Core i3-13100F": { model: "Intel Core i3-13100F", cores: 4, threads: 8, baseClockGhz: 3.4, releaseYear: 2023 },
    "Intel Core i3-13100T": { model: "Intel Core i3-13100T", cores: 4, threads: 8, baseClockGhz: 2.5, releaseYear: 2023 },
    "Intel Core i5-12400": { model: "Intel Core i5-12400", cores: 6, threads: 12, baseClockGhz: 2.5, releaseYear: 2022 },
    "Intel Core i5-12400F": { model: "Intel Core i5-12400F", cores: 6, threads: 12, baseClockGhz: 2.5, releaseYear: 2022 },
    "Intel Core i5-12400T": { model: "Intel Core i5-12400T", cores: 6, threads: 12, baseClockGhz: 1.8, releaseYear: 2022 },
    "Intel Core i5-12490F": { model: "Intel Core i5-12490F", cores: 6, threads: 12, baseClockGhz: 3.0, releaseYear: 2022 },
    "Intel Core i5-12500": { model: "Intel Core i5-12500", cores: 6, threads: 12, baseClockGhz: 3.0, releaseYear: 2022 },
    "Intel Core i5-12500E": { model: "Intel Core i5-12500E", cores: 6, threads: 12, baseClockGhz: 2.9, releaseYear: 2023 },
    "Intel Core i5-12500T": { model: "Intel Core i5-12500T", cores: 6, threads: 12, baseClockGhz: 2.0, releaseYear: 2022 },
    "Intel Core i5-12500TE": { model: "Intel Core i5-12500TE", cores: 6, threads: 12, baseClockGhz: 1.9, releaseYear: 2022 },
    "Intel Core i5-12600": { model: "Intel Core i5-12600", cores: 6, threads: 12, baseClockGhz: 3.3, releaseYear: 2022 },
    "Intel Core i5-12600K": { model: "Intel Core i5-12600K", cores: 10, threads: 16, baseClockGhz: 3.7, releaseYear: 2021 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-12600KF": { model: "Intel Core i5-12600KF", cores: 10, threads: 16, baseClockGhz: 3.7, releaseYear: 2021 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-12600T": { model: "Intel Core i5-12600T", cores: 6, threads: 12, baseClockGhz: 2.1, releaseYear: 2022 },
    "Intel Core i5-13400": { model: "Intel Core i5-13400", cores: 10, threads: 16, baseClockGhz: 2.5, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13400F": { model: "Intel Core i5-13400F", cores: 10, threads: 16, baseClockGhz: 2.5, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13400T": { model: "Intel Core i5-13400T", cores: 10, threads: 16, baseClockGhz: 1.3, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13490F": { model: "Intel Core i5-13490F", cores: 10, threads: 16, baseClockGhz: 2.5, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13500": { model: "Intel Core i5-13500", cores: 14, threads: 20, baseClockGhz: 2.5, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13500T": { model: "Intel Core i5-13500T", cores: 14, threads: 20, baseClockGhz: 1.6, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13600": { model: "Intel Core i5-13600", cores: 14, threads: 20, baseClockGhz: 2.7, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13600K": { model: "Intel Core i5-13600K", cores: 14, threads: 20, baseClockGhz: 3.5, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13600KF": { model: "Intel Core i5-13600KF", cores: 14, threads: 20, baseClockGhz: 3.5, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-13600T": { model: "Intel Core i5-13600T", cores: 14, threads: 20, baseClockGhz: 1.8, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i5-14400": { model: "Intel Core i5-14400", cores: 10, threads: 16, baseClockGhz: 2.5, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i5-14400F": { model: "Intel Core i5-14400F", cores: 10, threads: 16, baseClockGhz: 2.5, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i5-14500": { model: "Intel Core i5-14500", cores: 14, threads: 20, baseClockGhz: 2.6, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i5-14600": { model: "Intel Core i5-14600", cores: 14, threads: 20, baseClockGhz: 2.7, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i5-14600K": { model: "Intel Core i5-14600K", cores: 14, threads: 20, baseClockGhz: 3.5, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i5-14600KF": { model: "Intel Core i5-14600KF", cores: 14, threads: 20, baseClockGhz: 3.5, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i7-12700": { model: "Intel Core i7-12700", cores: 12, threads: 20, baseClockGhz: 2.1, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-12700E": { model: "Intel Core i7-12700E", cores: 12, threads: 20, baseClockGhz: 2.1, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-12700F": { model: "Intel Core i7-12700F", cores: 12, threads: 20, baseClockGhz: 2.1, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-12700K": { model: "Intel Core i7-12700K", cores: 12, threads: 20, baseClockGhz: 3.6, releaseYear: 2021 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-12700KF": { model: "Intel Core i7-12700KF", cores: 12, threads: 20, baseClockGhz: 3.6, releaseYear: 2021 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-12700T": { model: "Intel Core i7-12700T", cores: 12, threads: 20, baseClockGhz: 1.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-12700TE": { model: "Intel Core i7-12700TE", cores: 12, threads: 20, baseClockGhz: 1.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-13700": { model: "Intel Core i7-13700", cores: 16, threads: 24, baseClockGhz: 2.1, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-13700F": { model: "Intel Core i7-13700F", cores: 16, threads: 24, baseClockGhz: 2.1, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-13700K": { model: "Intel Core i7-13700K", cores: 16, threads: 24, baseClockGhz: 3.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-13700KF": { model: "Intel Core i7-13700KF", cores: 16, threads: 24, baseClockGhz: 3.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-13700T": { model: "Intel Core i7-13700T", cores: 16, threads: 24, baseClockGhz: 1.4, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i7-14700": { model: "Intel Core i7-14700", cores: 20, threads: 28, baseClockGhz: 2.1, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i7-14700F": { model: "Intel Core i7-14700F", cores: 20, threads: 28, baseClockGhz: 2.1, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i7-14700K": { model: "Intel Core i7-14700K", cores: 20, threads: 28, baseClockGhz: 3.4, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i7-14700KF": { model: "Intel Core i7-14700KF", cores: 20, threads: 28, baseClockGhz: 3.4, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i9-12900": { model: "Intel Core i9-12900", cores: 16, threads: 24, baseClockGhz: 2.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-12900E": { model: "Intel Core i9-12900E", cores: 16, threads: 24, baseClockGhz: 2.3, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-12900F": { model: "Intel Core i9-12900F", cores: 16, threads: 24, baseClockGhz: 2.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-12900K": { model: "Intel Core i9-12900K", cores: 16, threads: 24, baseClockGhz: 3.2, releaseYear: 2021 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-12900KF": { model: "Intel Core i9-12900KF", cores: 16, threads: 24, baseClockGhz: 3.2, releaseYear: 2021 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-12900KS": { model: "Intel Core i9-12900KS", cores: 16, threads: 24, baseClockGhz: 3.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-12900T": { model: "Intel Core i9-12900T", cores: 16, threads: 24, baseClockGhz: 1.4, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-13900": { model: "Intel Core i9-13900", cores: 16, threads: 32, baseClockGhz: 2.0, releaseYear: 2023 },
    "Intel Core i9-13900F": { model: "Intel Core i9-13900F", cores: 24, threads: 32, baseClockGhz: 2.0, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-13900K": { model: "Intel Core i9-13900K", cores: 24, threads: 32, baseClockGhz: 3.0, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-13900KF": { model: "Intel Core i9-13900KF", cores: 24, threads: 32, baseClockGhz: 3.0, releaseYear: 2022 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-13900KS": { model: "Intel Core i9-13900KS", cores: 24, threads: 32, baseClockGhz: 3.2, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-13900T": { model: "Intel Core i9-13900T", cores: 24, threads: 32, baseClockGhz: 1.1, releaseYear: 2023 },  // supplemented: ark_gapfill (Intel ARK)
    "Intel Core i9-14900": { model: "Intel Core i9-14900", cores: 24, threads: 32, baseClockGhz: 2.0, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i9-14900F": { model: "Intel Core i9-14900F", cores: 24, threads: 32, baseClockGhz: 2.0, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i9-14900K": { model: "Intel Core i9-14900K", cores: 24, threads: 32, baseClockGhz: 3.2, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i9-14900KF": { model: "Intel Core i9-14900KF", cores: 24, threads: 32, baseClockGhz: 3.2, releaseYear: 2023 },  // supplemented: ark_manual_addition (Intel ARK)
    "Intel Core i9-14900KS": { model: "Intel Core i9-14900KS", cores: 24, threads: 32, baseClockGhz: 3.2, releaseYear: 2024 },  // supplemented: ark_manual_addition (Intel ARK)
  } as Record<string, CPUData>,

  gpus: {
    "AMD Radeon RX 5300": { model: "AMD Radeon RX 5300 OEM", manufacturer: "AMD", cudaOrStreamCores: 1408, vramGb: 3, releaseYear: 2020 },
    "AMD Radeon RX 5300 XT": { model: "AMD Radeon RX 5300 XT OEM", manufacturer: "AMD", cudaOrStreamCores: 1408, vramGb: 4, releaseYear: 2019 },
    "AMD Radeon RX 550": { model: "AMD Radeon RX 550", manufacturer: "AMD", cudaOrStreamCores: 512, vramGb: 2, releaseYear: 2017 },
    "AMD Radeon RX 550 512SP": { model: "AMD Radeon RX 550 512SP", manufacturer: "AMD", cudaOrStreamCores: 512, vramGb: 2, releaseYear: 2017 },
    "AMD Radeon RX 550 640SP": { model: "AMD Radeon RX 550 640SP", manufacturer: "AMD", cudaOrStreamCores: 640, vramGb: 2, releaseYear: 2017 },
    "AMD Radeon RX 5500": { model: "AMD Radeon RX 5500 OEM", manufacturer: "AMD", cudaOrStreamCores: 1408, vramGb: 4, releaseYear: 2019 },
    "AMD Radeon RX 5500 XT": { model: "AMD Radeon RX 5500 XT", manufacturer: "AMD", cudaOrStreamCores: 1408, vramGb: 4, releaseYear: 2019 },
    "AMD Radeon RX 550X": { model: "AMD Radeon RX 550X", manufacturer: "AMD", cudaOrStreamCores: 512, vramGb: 4, releaseYear: 2018 },
    "AMD Radeon RX 550X 640SP": { model: "AMD Radeon RX 550X 640SP", manufacturer: "AMD", cudaOrStreamCores: 640, vramGb: 2, releaseYear: 2018 },
    "AMD Radeon RX 560": { model: "AMD Radeon RX 560", manufacturer: "AMD", cudaOrStreamCores: 1024, vramGb: 4, releaseYear: 2017 },
    "AMD Radeon RX 560 896SP": { model: "AMD Radeon RX 560 896SP", manufacturer: "AMD", cudaOrStreamCores: 896, vramGb: 4, releaseYear: 2017 },
    "AMD Radeon RX 560 XT": { model: "AMD Radeon RX 560 XT", manufacturer: "AMD", cudaOrStreamCores: 1792, vramGb: 4, releaseYear: 2019 },
    "AMD Radeon RX 5600": { model: "AMD Radeon RX 5600 OEM", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 6, releaseYear: 2020 },
    "AMD Radeon RX 5600 XT": { model: "AMD Radeon RX 5600 XT", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 6, releaseYear: 2020 },
    "AMD Radeon RX 560D": { model: "AMD Radeon RX 560D", manufacturer: "AMD", cudaOrStreamCores: 896, vramGb: 4, releaseYear: 2017 },
    "AMD Radeon RX 560DX": { model: "AMD Radeon RX 560DX", manufacturer: "AMD", cudaOrStreamCores: 896, vramGb: 4, releaseYear: 2018 },
    "AMD Radeon RX 560X": { model: "AMD Radeon RX 560X", manufacturer: "AMD", cudaOrStreamCores: 1024, vramGb: 4, releaseYear: 2018 },
    "AMD Radeon RX 570": { model: "AMD Radeon RX 570", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 4, releaseYear: 2017 },
    "AMD Radeon RX 5700": { model: "AMD Radeon RX 5700", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 8, releaseYear: 2019 },
    "AMD Radeon RX 5700 XT": { model: "AMD Radeon RX 5700 XT", manufacturer: "AMD", cudaOrStreamCores: 2560, vramGb: 8, releaseYear: 2019 },
    "AMD Radeon RX 570X": { model: "AMD Radeon RX 570X", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 8, releaseYear: 2018 },
    "AMD Radeon RX 580": { model: "AMD Radeon RX 580", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 8, releaseYear: 2017 },
    "AMD Radeon RX 580 2048SP": { model: "AMD Radeon RX 580 2048SP", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 4, releaseYear: 2018 },
    "AMD Radeon RX 580G": { model: "AMD Radeon RX 580G", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 8, releaseYear: 2018 },
    "AMD Radeon RX 580X": { model: "AMD Radeon RX 580X", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 8, releaseYear: 2018 },
    "AMD Radeon RX 590": { model: "AMD Radeon RX 590", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 8, releaseYear: 2018 },
    "AMD Radeon RX 640": { model: "AMD Radeon RX 640 OEM", manufacturer: "AMD", cudaOrStreamCores: 640, vramGb: 4, releaseYear: 2020 },
    "AMD Radeon RX 6400": { model: "AMD Radeon RX 6400", manufacturer: "AMD", cudaOrStreamCores: 768, vramGb: 4, releaseYear: 2022 },
    "AMD Radeon RX 6500 XT": { model: "AMD Radeon RX 6500 XT", manufacturer: "AMD", cudaOrStreamCores: 1024, vramGb: 4, releaseYear: 2022 },
    "AMD Radeon RX 6600": { model: "AMD Radeon RX 6600", manufacturer: "AMD", cudaOrStreamCores: 1792, vramGb: 8, releaseYear: 2021 },
    "AMD Radeon RX 6600 LE": { model: "AMD Radeon RX 6600 LE", manufacturer: "AMD", cudaOrStreamCores: 1792, vramGb: 8, releaseYear: 2023 },
    "AMD Radeon RX 6600 XT": { model: "AMD Radeon RX 6600 XT", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 8, releaseYear: 2021 },
    "AMD Radeon RX 6650 XT": { model: "AMD Radeon RX 6650 XT", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 8, releaseYear: 2022 },
    "AMD Radeon RX 6700": { model: "AMD Radeon RX 6700", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 10, releaseYear: 2021 },
    "AMD Radeon RX 6700 XT": { model: "AMD Radeon RX 6700 XT", manufacturer: "AMD", cudaOrStreamCores: 2560, vramGb: 12, releaseYear: 2021 },
    "AMD Radeon RX 6750 GRE 10 GB": { model: "AMD Radeon RX 6750 GRE 10 GB", manufacturer: "AMD", cudaOrStreamCores: 2304, vramGb: 10, releaseYear: 2023 },
    "AMD Radeon RX 6750 GRE 12 GB": { model: "AMD Radeon RX 6750 GRE 12 GB", manufacturer: "AMD", cudaOrStreamCores: 2560, vramGb: 12, releaseYear: 2023 },
    "AMD Radeon RX 6750 XT": { model: "AMD Radeon RX 6750 XT", manufacturer: "AMD", cudaOrStreamCores: 2560, vramGb: 12, releaseYear: 2022 },
    "AMD Radeon RX 6800": { model: "AMD Radeon RX 6800", manufacturer: "AMD", cudaOrStreamCores: 3840, vramGb: 16, releaseYear: 2020 },
    "AMD Radeon RX 6800 XT": { model: "AMD Radeon RX 6800 XT", manufacturer: "AMD", cudaOrStreamCores: 4608, vramGb: 16, releaseYear: 2020 },
    "AMD Radeon RX 6900 XT": { model: "AMD Radeon RX 6900 XT", manufacturer: "AMD", cudaOrStreamCores: 5120, vramGb: 16, releaseYear: 2020 },
    "AMD Radeon RX 6950 XT": { model: "AMD Radeon RX 6950 XT", manufacturer: "AMD", cudaOrStreamCores: 5120, vramGb: 16, releaseYear: 2022 },
    "AMD Radeon RX 7400": { model: "AMD Radeon RX 7400", manufacturer: "AMD", cudaOrStreamCores: 1792, vramGb: 8, releaseYear: 2025 },
    "AMD Radeon RX 7600": { model: "AMD Radeon RX 7600", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 8, releaseYear: 2023 },
    "AMD Radeon RX 7600 XT": { model: "AMD Radeon RX 7600 XT", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 16, releaseYear: 2024 },
    "AMD Radeon RX 7650 GRE": { model: "AMD Radeon RX 7650 GRE", manufacturer: "AMD", cudaOrStreamCores: 2048, vramGb: 8, releaseYear: 2025 },
    "AMD Radeon RX 7700": { model: "AMD Radeon RX 7700", manufacturer: "AMD", cudaOrStreamCores: 2560, vramGb: 16, releaseYear: 2025 },
    "AMD Radeon RX 7700 XT": { model: "AMD Radeon RX 7700 XT", manufacturer: "AMD", cudaOrStreamCores: 3456, vramGb: 12, releaseYear: 2023 },
    "AMD Radeon RX 7800 XT": { model: "AMD Radeon RX 7800 XT", manufacturer: "AMD", cudaOrStreamCores: 3840, vramGb: 16, releaseYear: 2023 },
    "AMD Radeon RX 7900 GRE": { model: "AMD Radeon RX 7900 GRE", manufacturer: "AMD", cudaOrStreamCores: 5120, vramGb: 16, releaseYear: 2023 },
    "AMD Radeon RX 7900 XT": { model: "AMD Radeon RX 7900 XT", manufacturer: "AMD", cudaOrStreamCores: 5376, vramGb: 20, releaseYear: 2022 },
    "AMD Radeon RX 7900 XTX": { model: "AMD Radeon RX 7900 XTX", manufacturer: "AMD", cudaOrStreamCores: 6144, vramGb: 24, releaseYear: 2022 },
    "AMD Radeon RX Vega 56": { model: "AMD Radeon RX Vega 56", manufacturer: "AMD", cudaOrStreamCores: 3584, vramGb: 8, releaseYear: 2017 },
    "AMD Radeon RX Vega 64": { model: "AMD Radeon RX Vega 64", manufacturer: "AMD", cudaOrStreamCores: 4096, vramGb: 8, releaseYear: 2017 },
    "Intel Arc A310": { model: "Intel Arc A310", manufacturer: "Intel", cudaOrStreamCores: 768, vramGb: 4, releaseYear: 2022 },
    "Intel Arc A350": { model: "Intel Arc A350", manufacturer: "Intel", cudaOrStreamCores: 768, vramGb: 4, releaseYear: 2022 },
    "Intel Arc A380": { model: "Intel Arc A380", manufacturer: "Intel", cudaOrStreamCores: 1024, vramGb: 6, releaseYear: 2022 },
    "Intel Arc A580": { model: "Intel Arc A580", manufacturer: "Intel", cudaOrStreamCores: 3072, vramGb: 8, releaseYear: 2023 },
    "Intel Arc A750": { model: "Intel Arc A750", manufacturer: "Intel", cudaOrStreamCores: 3584, vramGb: 8, releaseYear: 2022 },
    "Intel Arc A770": { model: "Intel Arc A770", manufacturer: "Intel", cudaOrStreamCores: 4096, vramGb: 16, releaseYear: 2022 },
    "Intel Arc B570": { model: "Intel Arc B570", manufacturer: "Intel", cudaOrStreamCores: 2304, vramGb: 10, releaseYear: 2025 },
    "Intel Arc B580": { model: "Intel Arc B580", manufacturer: "Intel", cudaOrStreamCores: 2560, vramGb: 12, releaseYear: 2024 },
    "Intel Arc Pro A40": { model: "Intel Arc Pro A40", manufacturer: "Intel", cudaOrStreamCores: 1024, vramGb: 6, releaseYear: 2022 },
    "Intel Arc Pro A50": { model: "Intel Arc Pro A50", manufacturer: "Intel", cudaOrStreamCores: 1024, vramGb: 6, releaseYear: 2022 },
    "Intel Arc Pro A60": { model: "Intel Arc Pro A60", manufacturer: "Intel", cudaOrStreamCores: 2048, vramGb: 12, releaseYear: 2023 },
    "Intel Arc Pro B50": { model: "Intel Arc Pro B50", manufacturer: "Intel", cudaOrStreamCores: 2048, vramGb: 16, releaseYear: 2025 },
    "Intel Arc Pro B60": { model: "Intel Arc Pro B60", manufacturer: "Intel", cudaOrStreamCores: 2560, vramGb: 24, releaseYear: 2025 },
    "NVIDIA GeForce GTX 1050 3 GB": { model: "NVIDIA GeForce GTX 1050 3 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 768, vramGb: 3, releaseYear: 2018 },
    "NVIDIA GeForce GTX 1060 5 GB": { model: "NVIDIA GeForce GTX 1060 5 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 1280, vramGb: 5, releaseYear: 2017 },
    "NVIDIA GeForce GTX 1060 6 GB": { model: "NVIDIA GeForce GTX 1060 6 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 1280, vramGb: 6, releaseYear: 2017 },
    "NVIDIA GeForce GTX 1070": { model: "NVIDIA GeForce GTX 1070 GDDR5X", manufacturer: "NVIDIA", cudaOrStreamCores: 1920, vramGb: 8, releaseYear: 2018 },
    "NVIDIA GeForce GTX 1070 Ti": { model: "NVIDIA GeForce GTX 1070 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 2432, vramGb: 8, releaseYear: 2017 },
    "NVIDIA GeForce GTX 1080 11Gbps": { model: "NVIDIA GeForce GTX 1080 11Gbps", manufacturer: "NVIDIA", cudaOrStreamCores: 2560, vramGb: 8, releaseYear: 2017 },
    "NVIDIA GeForce GTX 1080 Ti": { model: "NVIDIA GeForce GTX 1080 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 3584, vramGb: 11, releaseYear: 2017 },
    "NVIDIA GeForce GTX 1630": { model: "NVIDIA GeForce GTX 1630", manufacturer: "NVIDIA", cudaOrStreamCores: 512, vramGb: 4, releaseYear: 2022 },
    "NVIDIA GeForce GTX 1650": { model: "NVIDIA GeForce GTX 1650", manufacturer: "NVIDIA", cudaOrStreamCores: 896, vramGb: 4, releaseYear: 2019 },
    "NVIDIA GeForce GTX 1650 SUPER": { model: "NVIDIA GeForce GTX 1650 SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 1280, vramGb: 4, releaseYear: 2019 },
    "NVIDIA GeForce GTX 1660": { model: "NVIDIA GeForce GTX 1660", manufacturer: "NVIDIA", cudaOrStreamCores: 1408, vramGb: 6, releaseYear: 2019 },
    "NVIDIA GeForce GTX 1660 SUPER": { model: "NVIDIA GeForce GTX 1660 SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 1408, vramGb: 6, releaseYear: 2019 },
    "NVIDIA GeForce GTX 1660 Ti": { model: "NVIDIA GeForce GTX 1660 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 1536, vramGb: 6, releaseYear: 2019 },
    "NVIDIA GeForce RTX 2060": { model: "NVIDIA GeForce RTX 2060", manufacturer: "NVIDIA", cudaOrStreamCores: 1920, vramGb: 6, releaseYear: 2019 },
    "NVIDIA GeForce RTX 2060 12 GB": { model: "NVIDIA GeForce RTX 2060 12 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 2176, vramGb: 12, releaseYear: 2021 },
    "NVIDIA GeForce RTX 2060 SUPER": { model: "NVIDIA GeForce RTX 2060 SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 2176, vramGb: 8, releaseYear: 2019 },
    "NVIDIA GeForce RTX 2070": { model: "NVIDIA GeForce RTX 2070", manufacturer: "NVIDIA", cudaOrStreamCores: 2304, vramGb: 8, releaseYear: 2018 },
    "NVIDIA GeForce RTX 2070 SUPER": { model: "NVIDIA GeForce RTX 2070 SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 2560, vramGb: 8, releaseYear: 2019 },
    "NVIDIA GeForce RTX 2080": { model: "NVIDIA GeForce RTX 2080", manufacturer: "NVIDIA", cudaOrStreamCores: 2944, vramGb: 8, releaseYear: 2018 },
    "NVIDIA GeForce RTX 2080 SUPER": { model: "NVIDIA GeForce RTX 2080 SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 3072, vramGb: 8, releaseYear: 2019 },
    "NVIDIA GeForce RTX 2080 Ti": { model: "NVIDIA GeForce RTX 2080 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 4352, vramGb: 11, releaseYear: 2018 },
    "NVIDIA GeForce RTX 3050": { model: "NVIDIA GeForce RTX 3050 OEM", manufacturer: "NVIDIA", cudaOrStreamCores: 2304, vramGb: 8, releaseYear: 2022 },
    "NVIDIA GeForce RTX 3050 4 GB": { model: "NVIDIA GeForce RTX 3050 4 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 2048, vramGb: 4, releaseYear: 2022 },
    "NVIDIA GeForce RTX 3050 6 GB": { model: "NVIDIA GeForce RTX 3050 6 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 2304, vramGb: 6, releaseYear: 2024 },
    "NVIDIA GeForce RTX 3050 8 GB": { model: "NVIDIA GeForce RTX 3050 8 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 2560, vramGb: 8, releaseYear: 2022 },
    "NVIDIA GeForce RTX 3060 12 GB": { model: "NVIDIA GeForce RTX 3060 12 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 3584, vramGb: 12, releaseYear: 2021 },
    "NVIDIA GeForce RTX 3060 3840SP": { model: "NVIDIA GeForce RTX 3060 3840SP", manufacturer: "NVIDIA", cudaOrStreamCores: 3840, vramGb: 6, releaseYear: 2021 },
    "NVIDIA GeForce RTX 3060 8 GB": { model: "NVIDIA GeForce RTX 3060 8 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 3584, vramGb: 8, releaseYear: 2022 },
    "NVIDIA GeForce RTX 3060 Ti": { model: "NVIDIA GeForce RTX 3060 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 4864, vramGb: 8, releaseYear: 2020 },
    "NVIDIA GeForce RTX 3070": { model: "NVIDIA GeForce RTX 3070", manufacturer: "NVIDIA", cudaOrStreamCores: 5888, vramGb: 8, releaseYear: 2020 },
    "NVIDIA GeForce RTX 3070 Ti": { model: "NVIDIA GeForce RTX 3070 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 6144, vramGb: 8, releaseYear: 2021 },
    "NVIDIA GeForce RTX 3070 Ti 8 GB": { model: "NVIDIA GeForce RTX 3070 Ti 8 GB GA102", manufacturer: "NVIDIA", cudaOrStreamCores: 6144, vramGb: 8, releaseYear: 2022 },
    "NVIDIA GeForce RTX 3080": { model: "NVIDIA GeForce RTX 3080", manufacturer: "NVIDIA", cudaOrStreamCores: 8704, vramGb: 10, releaseYear: 2020 },
    "NVIDIA GeForce RTX 3080 12 GB": { model: "NVIDIA GeForce RTX 3080 12 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 8960, vramGb: 12, releaseYear: 2022 },
    "NVIDIA GeForce RTX 3080 Ti": { model: "NVIDIA GeForce RTX 3080 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 10240, vramGb: 12, releaseYear: 2021 },
    "NVIDIA GeForce RTX 3080 Ti 20 GB": { model: "NVIDIA GeForce RTX 3080 Ti 20 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 10240, vramGb: 20, releaseYear: 2022 },
    "NVIDIA GeForce RTX 3090": { model: "NVIDIA GeForce RTX 3090", manufacturer: "NVIDIA", cudaOrStreamCores: 10496, vramGb: 24, releaseYear: 2020 },
    "NVIDIA GeForce RTX 3090 Ti": { model: "NVIDIA GeForce RTX 3090 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 10752, vramGb: 24, releaseYear: 2022 },
    "NVIDIA GeForce RTX 4010": { model: "NVIDIA GeForce RTX 4010", manufacturer: "NVIDIA", cudaOrStreamCores: 768, vramGb: 4, releaseYear: 2024 },
    "NVIDIA GeForce RTX 4060": { model: "NVIDIA GeForce RTX 4060", manufacturer: "NVIDIA", cudaOrStreamCores: 3072, vramGb: 8, releaseYear: 2023 },
    "NVIDIA GeForce RTX 4060 Ti": { model: "NVIDIA GeForce RTX 4060 Ti AD104", manufacturer: "NVIDIA", cudaOrStreamCores: 4352, vramGb: 8, releaseYear: 2024 },
    "NVIDIA GeForce RTX 4060 Ti 16 GB": { model: "NVIDIA GeForce RTX 4060 Ti 16 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 4352, vramGb: 16, releaseYear: 2023 },
    "NVIDIA GeForce RTX 4060 Ti 8 GB": { model: "NVIDIA GeForce RTX 4060 Ti 8 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 4352, vramGb: 8, releaseYear: 2023 },
    "NVIDIA GeForce RTX 4070": { model: "NVIDIA GeForce RTX 4070", manufacturer: "NVIDIA", cudaOrStreamCores: 5888, vramGb: 12, releaseYear: 2023 },
    "NVIDIA GeForce RTX 4070 SUPER": { model: "NVIDIA GeForce RTX 4070 SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 7168, vramGb: 12, releaseYear: 2024 },
    "NVIDIA GeForce RTX 4070 Ti": { model: "NVIDIA GeForce RTX 4070 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 7680, vramGb: 12, releaseYear: 2023 },
    "NVIDIA GeForce RTX 4070 Ti SUPER": { model: "NVIDIA GeForce RTX 4070 Ti SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 8448, vramGb: 16, releaseYear: 2024 },
    "NVIDIA GeForce RTX 4080": { model: "NVIDIA GeForce RTX 4080", manufacturer: "NVIDIA", cudaOrStreamCores: 9728, vramGb: 16, releaseYear: 2022 },
    "NVIDIA GeForce RTX 4080 SUPER": { model: "NVIDIA GeForce RTX 4080 SUPER", manufacturer: "NVIDIA", cudaOrStreamCores: 10240, vramGb: 16, releaseYear: 2024 },
    "NVIDIA GeForce RTX 4090": { model: "NVIDIA GeForce RTX 4090", manufacturer: "NVIDIA", cudaOrStreamCores: 16384, vramGb: 24, releaseYear: 2022 },
    "NVIDIA GeForce RTX 4090 D": { model: "NVIDIA GeForce RTX 4090 D", manufacturer: "NVIDIA", cudaOrStreamCores: 14592, vramGb: 24, releaseYear: 2023 },
    "NVIDIA GeForce RTX 5050": { model: "NVIDIA GeForce RTX 5050", manufacturer: "NVIDIA", cudaOrStreamCores: 2560, vramGb: 8, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5060": { model: "NVIDIA GeForce RTX 5060", manufacturer: "NVIDIA", cudaOrStreamCores: 3840, vramGb: 8, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5060 Ti 16 GB": { model: "NVIDIA GeForce RTX 5060 Ti 16 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 4608, vramGb: 16, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5060 Ti 8 GB": { model: "NVIDIA GeForce RTX 5060 Ti 8 GB", manufacturer: "NVIDIA", cudaOrStreamCores: 4608, vramGb: 8, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5070": { model: "NVIDIA GeForce RTX 5070", manufacturer: "NVIDIA", cudaOrStreamCores: 6144, vramGb: 12, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5070 Ti": { model: "NVIDIA GeForce RTX 5070 Ti", manufacturer: "NVIDIA", cudaOrStreamCores: 8960, vramGb: 16, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5080": { model: "NVIDIA GeForce RTX 5080", manufacturer: "NVIDIA", cudaOrStreamCores: 10752, vramGb: 16, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5090": { model: "NVIDIA GeForce RTX 5090", manufacturer: "NVIDIA", cudaOrStreamCores: 21760, vramGb: 32, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5090 D": { model: "NVIDIA GeForce RTX 5090 D", manufacturer: "NVIDIA", cudaOrStreamCores: 21760, vramGb: 32, releaseYear: 2025 },
    "NVIDIA GeForce RTX 5090 D V2": { model: "NVIDIA GeForce RTX 5090 D V2", manufacturer: "NVIDIA", cudaOrStreamCores: 21760, vramGb: 24, releaseYear: 2025 },
  } as Record<string, GPUData>,

  ram: {
    "Samsung DDR4-2666 UDIMM 8GB": { model: "Samsung DDR4-2666 UDIMM 8GB", manufacturer: "Samsung", type: "DDR4", capacityGb: 8, speedMtps: 2666, releaseYear: 2017 },
    "Samsung DDR4-2666 UDIMM 16GB": { model: "Samsung DDR4-2666 UDIMM 16GB", manufacturer: "Samsung", type: "DDR4", capacityGb: 16, speedMtps: 2666, releaseYear: 2017 },
    "Samsung DDR4-3200 UDIMM 8GB": { model: "Samsung DDR4-3200 UDIMM 8GB", manufacturer: "Samsung", type: "DDR4", capacityGb: 8, speedMtps: 3200, releaseYear: 2018 },
    "Samsung DDR4-3200 UDIMM 16GB": { model: "Samsung DDR4-3200 UDIMM 16GB", manufacturer: "Samsung", type: "DDR4", capacityGb: 16, speedMtps: 3200, releaseYear: 2018 },
    "Samsung DDR4-3200 UDIMM 32GB": { model: "Samsung DDR4-3200 UDIMM 32GB", manufacturer: "Samsung", type: "DDR4", capacityGb: 32, speedMtps: 3200, releaseYear: 2019 },
    "SK Hynix DDR4-2666 UDIMM 8GB": { model: "SK Hynix DDR4-2666 UDIMM 8GB", manufacturer: "SK Hynix", type: "DDR4", capacityGb: 8, speedMtps: 2666, releaseYear: 2017 },
    "SK Hynix DDR4-2666 UDIMM 16GB": { model: "SK Hynix DDR4-2666 UDIMM 16GB", manufacturer: "SK Hynix", type: "DDR4", capacityGb: 16, speedMtps: 2666, releaseYear: 2017 },
    "SK Hynix DDR4-3200 UDIMM 8GB": { model: "SK Hynix DDR4-3200 UDIMM 8GB", manufacturer: "SK Hynix", type: "DDR4", capacityGb: 8, speedMtps: 3200, releaseYear: 2018 },
    "SK Hynix DDR4-3200 UDIMM 16GB": { model: "SK Hynix DDR4-3200 UDIMM 16GB", manufacturer: "SK Hynix", type: "DDR4", capacityGb: 16, speedMtps: 3200, releaseYear: 2018 },
    "SK Hynix DDR4-3200 UDIMM 32GB": { model: "SK Hynix DDR4-3200 UDIMM 32GB", manufacturer: "SK Hynix", type: "DDR4", capacityGb: 32, speedMtps: 3200, releaseYear: 2019 },
    "Micron (Crucial) DDR4-2666 UDIMM 8GB": { model: "Micron (Crucial) DDR4-2666 UDIMM 8GB", manufacturer: "Micron", type: "DDR4", capacityGb: 8, speedMtps: 2666, releaseYear: 2017 },
    "Micron (Crucial) DDR4-2666 UDIMM 16GB": { model: "Micron (Crucial) DDR4-2666 UDIMM 16GB", manufacturer: "Micron", type: "DDR4", capacityGb: 16, speedMtps: 2666, releaseYear: 2017 },
    "Micron (Crucial) DDR4-3200 UDIMM 8GB": { model: "Micron (Crucial) DDR4-3200 UDIMM 8GB", manufacturer: "Micron", type: "DDR4", capacityGb: 8, speedMtps: 3200, releaseYear: 2018 },
    "Micron (Crucial) DDR4-3200 UDIMM 16GB": { model: "Micron (Crucial) DDR4-3200 UDIMM 16GB", manufacturer: "Micron", type: "DDR4", capacityGb: 16, speedMtps: 3200, releaseYear: 2018 },
    "Micron (Crucial) DDR4-3200 UDIMM 32GB": { model: "Micron (Crucial) DDR4-3200 UDIMM 32GB", manufacturer: "Micron", type: "DDR4", capacityGb: 32, speedMtps: 3200, releaseYear: 2019 },
    "Samsung DDR5-4800 UDIMM 16GB": { model: "Samsung DDR5-4800 UDIMM 16GB", manufacturer: "Samsung", type: "DDR5", capacityGb: 16, speedMtps: 4800, releaseYear: 2021 },
    "Samsung DDR5-4800 UDIMM 32GB": { model: "Samsung DDR5-4800 UDIMM 32GB", manufacturer: "Samsung", type: "DDR5", capacityGb: 32, speedMtps: 4800, releaseYear: 2021 },
    "Samsung DDR5-5600 UDIMM 16GB": { model: "Samsung DDR5-5600 UDIMM 16GB", manufacturer: "Samsung", type: "DDR5", capacityGb: 16, speedMtps: 5600, releaseYear: 2022 },
    "Samsung DDR5-5600 UDIMM 32GB": { model: "Samsung DDR5-5600 UDIMM 32GB", manufacturer: "Samsung", type: "DDR5", capacityGb: 32, speedMtps: 5600, releaseYear: 2022 },
    "Samsung DDR5-6400 UDIMM 16GB": { model: "Samsung DDR5-6400 UDIMM 16GB", manufacturer: "Samsung", type: "DDR5", capacityGb: 16, speedMtps: 6400, releaseYear: 2023 },
    "Samsung DDR5-6400 UDIMM 32GB": { model: "Samsung DDR5-6400 UDIMM 32GB", manufacturer: "Samsung", type: "DDR5", capacityGb: 32, speedMtps: 6400, releaseYear: 2023 },
    "SK Hynix DDR5-4800 UDIMM 16GB": { model: "SK Hynix DDR5-4800 UDIMM 16GB", manufacturer: "SK Hynix", type: "DDR5", capacityGb: 16, speedMtps: 4800, releaseYear: 2021 },
    "SK Hynix DDR5-4800 UDIMM 32GB": { model: "SK Hynix DDR5-4800 UDIMM 32GB", manufacturer: "SK Hynix", type: "DDR5", capacityGb: 32, speedMtps: 4800, releaseYear: 2021 },
    "SK Hynix DDR5-5600 UDIMM 16GB": { model: "SK Hynix DDR5-5600 UDIMM 16GB", manufacturer: "SK Hynix", type: "DDR5", capacityGb: 16, speedMtps: 5600, releaseYear: 2022 },
    "SK Hynix DDR5-5600 UDIMM 32GB": { model: "SK Hynix DDR5-5600 UDIMM 32GB", manufacturer: "SK Hynix", type: "DDR5", capacityGb: 32, speedMtps: 5600, releaseYear: 2022 },
    "SK Hynix DDR5-6400 UDIMM 16GB": { model: "SK Hynix DDR5-6400 UDIMM 16GB", manufacturer: "SK Hynix", type: "DDR5", capacityGb: 16, speedMtps: 6400, releaseYear: 2023 },
    "SK Hynix DDR5-6400 UDIMM 32GB": { model: "SK Hynix DDR5-6400 UDIMM 32GB", manufacturer: "SK Hynix", type: "DDR5", capacityGb: 32, speedMtps: 6400, releaseYear: 2023 },
    "Micron (Crucial) DDR5-4800 UDIMM 16GB": { model: "Micron (Crucial) DDR5-4800 UDIMM 16GB", manufacturer: "Micron", type: "DDR5", capacityGb: 16, speedMtps: 4800, releaseYear: 2021 },
    "Micron (Crucial) DDR5-4800 UDIMM 32GB": { model: "Micron (Crucial) DDR5-4800 UDIMM 32GB", manufacturer: "Micron", type: "DDR5", capacityGb: 32, speedMtps: 4800, releaseYear: 2021 },
    "Micron (Crucial) DDR5-5600 UDIMM 16GB": { model: "Micron (Crucial) DDR5-5600 UDIMM 16GB", manufacturer: "Micron", type: "DDR5", capacityGb: 16, speedMtps: 5600, releaseYear: 2022 },
    "Micron (Crucial) DDR5-5600 UDIMM 32GB": { model: "Micron (Crucial) DDR5-5600 UDIMM 32GB", manufacturer: "Micron", type: "DDR5", capacityGb: 32, speedMtps: 5600, releaseYear: 2022 },
    "Micron (Crucial) DDR5-6400 UDIMM 16GB": { model: "Micron (Crucial) DDR5-6400 UDIMM 16GB", manufacturer: "Micron", type: "DDR5", capacityGb: 16, speedMtps: 6400, releaseYear: 2023 },
    "Micron (Crucial) DDR5-6400 UDIMM 32GB": { model: "Micron (Crucial) DDR5-6400 UDIMM 32GB", manufacturer: "Micron", type: "DDR5", capacityGb: 32, speedMtps: 6400, releaseYear: 2023 },
    "TeamGroup DDR5-6000 CL30 XMP/EXPO 16GB": { model: "TeamGroup DDR5-6000 CL30 XMP/EXPO 16GB", manufacturer: "TeamGroup", type: "DDR5", capacityGb: 16, speedMtps: 6000, releaseYear: 2022 },
    "TeamGroup DDR5-6000 CL30 XMP/EXPO 32GB": { model: "TeamGroup DDR5-6000 CL30 XMP/EXPO 32GB", manufacturer: "TeamGroup", type: "DDR5", capacityGb: 32, speedMtps: 6000, releaseYear: 2022 },
    "TeamGroup DDR5-7200 CL34 XMP/EXPO 16GB": { model: "TeamGroup DDR5-7200 CL34 XMP/EXPO 16GB", manufacturer: "TeamGroup", type: "DDR5", capacityGb: 16, speedMtps: 7200, releaseYear: 2023 },
    "TeamGroup DDR5-7200 CL34 XMP/EXPO 32GB": { model: "TeamGroup DDR5-7200 CL34 XMP/EXPO 32GB", manufacturer: "TeamGroup", type: "DDR5", capacityGb: 32, speedMtps: 7200, releaseYear: 2023 },
    "TeamGroup DDR5-8000 CL38 XMP/EXPO 16GB": { model: "TeamGroup DDR5-8000 CL38 XMP/EXPO 16GB", manufacturer: "TeamGroup", type: "DDR5", capacityGb: 16, speedMtps: 8000, releaseYear: 2023 },
    "TeamGroup DDR5-8000 CL38 XMP/EXPO 32GB": { model: "TeamGroup DDR5-8000 CL38 XMP/EXPO 32GB", manufacturer: "TeamGroup", type: "DDR5", capacityGb: 32, speedMtps: 8000, releaseYear: 2023 },
    "G.Skill DDR5-6000 CL30 XMP/EXPO 16GB": { model: "G.Skill DDR5-6000 CL30 XMP/EXPO 16GB", manufacturer: "G.Skill", type: "DDR5", capacityGb: 16, speedMtps: 6000, releaseYear: 2022 },
    "G.Skill DDR5-6000 CL30 XMP/EXPO 32GB": { model: "G.Skill DDR5-6000 CL30 XMP/EXPO 32GB", manufacturer: "G.Skill", type: "DDR5", capacityGb: 32, speedMtps: 6000, releaseYear: 2022 },
    "G.Skill DDR5-7200 CL34 XMP/EXPO 16GB": { model: "G.Skill DDR5-7200 CL34 XMP/EXPO 16GB", manufacturer: "G.Skill", type: "DDR5", capacityGb: 16, speedMtps: 7200, releaseYear: 2023 },
    "G.Skill DDR5-7200 CL34 XMP/EXPO 32GB": { model: "G.Skill DDR5-7200 CL34 XMP/EXPO 32GB", manufacturer: "G.Skill", type: "DDR5", capacityGb: 32, speedMtps: 7200, releaseYear: 2023 },
    "G.Skill DDR5-8000 CL38 XMP/EXPO 16GB": { model: "G.Skill DDR5-8000 CL38 XMP/EXPO 16GB", manufacturer: "G.Skill", type: "DDR5", capacityGb: 16, speedMtps: 8000, releaseYear: 2023 },
    "G.Skill DDR5-8000 CL38 XMP/EXPO 32GB": { model: "G.Skill DDR5-8000 CL38 XMP/EXPO 32GB", manufacturer: "G.Skill", type: "DDR5", capacityGb: 32, speedMtps: 8000, releaseYear: 2023 },
    "KLEVV DDR5-6000 CL30 XMP/EXPO 16GB": { model: "KLEVV DDR5-6000 CL30 XMP/EXPO 16GB", manufacturer: "KLEVV", type: "DDR5", capacityGb: 16, speedMtps: 6000, releaseYear: 2022 },
    "KLEVV DDR5-6000 CL30 XMP/EXPO 32GB": { model: "KLEVV DDR5-6000 CL30 XMP/EXPO 32GB", manufacturer: "KLEVV", type: "DDR5", capacityGb: 32, speedMtps: 6000, releaseYear: 2022 },
    "KLEVV DDR5-7200 CL34 XMP/EXPO 16GB": { model: "KLEVV DDR5-7200 CL34 XMP/EXPO 16GB", manufacturer: "KLEVV", type: "DDR5", capacityGb: 16, speedMtps: 7200, releaseYear: 2023 },
    "KLEVV DDR5-7200 CL34 XMP/EXPO 32GB": { model: "KLEVV DDR5-7200 CL34 XMP/EXPO 32GB", manufacturer: "KLEVV", type: "DDR5", capacityGb: 32, speedMtps: 7200, releaseYear: 2023 },
    "KLEVV DDR5-8000 CL38 XMP/EXPO 16GB": { model: "KLEVV DDR5-8000 CL38 XMP/EXPO 16GB", manufacturer: "KLEVV", type: "DDR5", capacityGb: 16, speedMtps: 8000, releaseYear: 2023 },
    "KLEVV DDR5-8000 CL38 XMP/EXPO 32GB": { model: "KLEVV DDR5-8000 CL38 XMP/EXPO 32GB", manufacturer: "KLEVV", type: "DDR5", capacityGb: 32, speedMtps: 8000, releaseYear: 2023 },
    "TeamGroup DDR5-6000 CL30 XMP/EXPO 64GB (32GBx2)": { model: "TeamGroup DDR5-6000 CL30 XMP/EXPO 64GB (32GBx2)", manufacturer: "TeamGroup", type: "DDR5", capacityGb: 64, speedMtps: 6000, releaseYear: 2023 },
    "G.Skill DDR5-6000 CL30 XMP/EXPO 64GB (32GBx2)": { model: "G.Skill DDR5-6000 CL30 XMP/EXPO 64GB (32GBx2)", manufacturer: "G.Skill", type: "DDR5", capacityGb: 64, speedMtps: 6000, releaseYear: 2023 },
    "KLEVV DDR5-6000 CL30 XMP/EXPO 64GB (32GBx2)": { model: "KLEVV DDR5-6000 CL30 XMP/EXPO 64GB (32GBx2)", manufacturer: "KLEVV", type: "DDR5", capacityGb: 64, speedMtps: 6000, releaseYear: 2023 },
  } as Record<string, RAMData>,

  ssd: {
    "Samsung 990 Pro 1TB": { model: "Samsung 990 Pro 1TB", manufacturer: "Samsung", deviceType: "PCIe Gen4 NVMe", capacityGb: 1000, readSpeedMbps: 7450, writeSpeedMbps: 6900, releaseYear: 2022 },
    "Samsung 990 Pro 2TB": { model: "Samsung 990 Pro 2TB", manufacturer: "Samsung", deviceType: "PCIe Gen4 NVMe", capacityGb: 2000, readSpeedMbps: 7450, writeSpeedMbps: 6900, releaseYear: 2022 },
    "Samsung 990 Pro 4TB": { model: "Samsung 990 Pro 4TB", manufacturer: "Samsung", deviceType: "PCIe Gen4 NVMe", capacityGb: 4000, readSpeedMbps: 7450, writeSpeedMbps: 6900, releaseYear: 2023 },
    "Samsung 9100 Pro 1TB": { model: "Samsung 9100 Pro 1TB", manufacturer: "Samsung", deviceType: "PCIe Gen5 NVMe", capacityGb: 1000, readSpeedMbps: 14700, writeSpeedMbps: 13300, releaseYear: 2025 },
    "Samsung 9100 Pro 2TB": { model: "Samsung 9100 Pro 2TB", manufacturer: "Samsung", deviceType: "PCIe Gen5 NVMe", capacityGb: 2000, readSpeedMbps: 14700, writeSpeedMbps: 13400, releaseYear: 2025 },
    "Samsung 9100 Pro 4TB": { model: "Samsung 9100 Pro 4TB", manufacturer: "Samsung", deviceType: "PCIe Gen5 NVMe", capacityGb: 4000, readSpeedMbps: 14800, writeSpeedMbps: 13400, releaseYear: 2025 },
    "Samsung 9100 Pro 8TB": { model: "Samsung 9100 Pro 8TB", manufacturer: "Samsung", deviceType: "PCIe Gen5 NVMe", capacityGb: 8000, readSpeedMbps: 14800, writeSpeedMbps: 13400, releaseYear: 2025 },
    "Samsung 980 250GB": { model: "Samsung 980 250GB", manufacturer: "Samsung", deviceType: "PCIe Gen3 NVMe", capacityGb: 250, readSpeedMbps: 2900, writeSpeedMbps: 1300, releaseYear: 2020 },
    "Samsung 980 500GB": { model: "Samsung 980 500GB", manufacturer: "Samsung", deviceType: "PCIe Gen3 NVMe", capacityGb: 500, readSpeedMbps: 3100, writeSpeedMbps: 2600, releaseYear: 2020 },
    "Samsung 980 1TB": { model: "Samsung 980 1TB", manufacturer: "Samsung", deviceType: "PCIe Gen3 NVMe", capacityGb: 1000, readSpeedMbps: 3500, writeSpeedMbps: 3000, releaseYear: 2020 },
    "SK hynix Platinum P41 500GB": { model: "SK hynix Platinum P41 500GB", manufacturer: "SK Hynix", deviceType: "PCIe Gen4 NVMe", capacityGb: 500, readSpeedMbps: 7000, writeSpeedMbps: 3800, releaseYear: 2022 },
    "SK hynix Platinum P41 1TB": { model: "SK hynix Platinum P41 1TB", manufacturer: "SK Hynix", deviceType: "PCIe Gen4 NVMe", capacityGb: 1000, readSpeedMbps: 7000, writeSpeedMbps: 6500, releaseYear: 2022 },
    "SK hynix Platinum P41 2TB": { model: "SK hynix Platinum P41 2TB", manufacturer: "SK Hynix", deviceType: "PCIe Gen4 NVMe", capacityGb: 2000, readSpeedMbps: 7000, writeSpeedMbps: 6500, releaseYear: 2022 },
    "SK hynix Platinum P51 500GB": { model: "SK hynix Platinum P51 500GB", manufacturer: "SK Hynix", deviceType: "PCIe Gen5 NVMe", capacityGb: 500, readSpeedMbps: 14700, writeSpeedMbps: 13400, releaseYear: 2025 },
    "SK hynix Platinum P51 1TB": { model: "SK hynix Platinum P51 1TB", manufacturer: "SK Hynix", deviceType: "PCIe Gen5 NVMe", capacityGb: 1000, readSpeedMbps: 14700, writeSpeedMbps: 13400, releaseYear: 2025 },
    "SK hynix Platinum P51 2TB": { model: "SK hynix Platinum P51 2TB", manufacturer: "SK Hynix", deviceType: "PCIe Gen5 NVMe", capacityGb: 2000, readSpeedMbps: 14700, writeSpeedMbps: 13400, releaseYear: 2025 },
    "SK hynix Gold P31 500GB": { model: "SK hynix Gold P31 500GB", manufacturer: "SK Hynix", deviceType: "PCIe Gen3 NVMe", capacityGb: 500, readSpeedMbps: 3500, writeSpeedMbps: 3100, releaseYear: 2020 },
    "SK hynix Gold P31 1TB": { model: "SK hynix Gold P31 1TB", manufacturer: "SK Hynix", deviceType: "PCIe Gen3 NVMe", capacityGb: 1000, readSpeedMbps: 3500, writeSpeedMbps: 3200, releaseYear: 2020 },
    "SK hynix Gold P31 2TB": { model: "SK hynix Gold P31 2TB", manufacturer: "SK Hynix", deviceType: "PCIe Gen3 NVMe", capacityGb: 2000, readSpeedMbps: 3500, writeSpeedMbps: 3200, releaseYear: 2020 },
    "WD_BLACK SN850X 1TB": { model: "WD_BLACK SN850X 1TB", manufacturer: "Western Digital", deviceType: "PCIe Gen4 NVMe", capacityGb: 1000, readSpeedMbps: 7300, writeSpeedMbps: 6300, releaseYear: 2022 },
    "WD_BLACK SN850X 2TB": { model: "WD_BLACK SN850X 2TB", manufacturer: "Western Digital", deviceType: "PCIe Gen4 NVMe", capacityGb: 2000, readSpeedMbps: 7300, writeSpeedMbps: 6300, releaseYear: 2022 },
    "WD_BLACK SN850X 4TB": { model: "WD_BLACK SN850X 4TB", manufacturer: "Western Digital", deviceType: "PCIe Gen4 NVMe", capacityGb: 4000, readSpeedMbps: 7300, writeSpeedMbps: 6300, releaseYear: 2022 },
    "WD Blue SN580 500GB": { model: "WD Blue SN580 500GB", manufacturer: "Western Digital", deviceType: "PCIe Gen4 NVMe", capacityGb: 500, readSpeedMbps: 2000, writeSpeedMbps: 1700, releaseYear: 2023 },
    "WD Blue SN580 1TB": { model: "WD Blue SN580 1TB", manufacturer: "Western Digital", deviceType: "PCIe Gen4 NVMe", capacityGb: 1000, readSpeedMbps: 4150, writeSpeedMbps: 4150, releaseYear: 2023 },
    "WD Blue SN580 2TB": { model: "WD Blue SN580 2TB", manufacturer: "Western Digital", deviceType: "PCIe Gen4 NVMe", capacityGb: 2000, readSpeedMbps: 4150, writeSpeedMbps: 4150, releaseYear: 2023 },
    "Crucial T500 500GB": { model: "Crucial T500 500GB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 500, readSpeedMbps: 7200, writeSpeedMbps: 5700, releaseYear: 2023 },
    "Crucial T500 1TB": { model: "Crucial T500 1TB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 1000, readSpeedMbps: 7300, writeSpeedMbps: 6800, releaseYear: 2023 },
    "Crucial T500 2TB": { model: "Crucial T500 2TB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 2000, readSpeedMbps: 7400, writeSpeedMbps: 7000, releaseYear: 2023 },
    "Crucial T500 4TB": { model: "Crucial T500 4TB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 4000, readSpeedMbps: 7300, writeSpeedMbps: 7000, releaseYear: 2024 },
    "Crucial P3 Plus 500GB": { model: "Crucial P3 Plus 500GB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 500, readSpeedMbps: 5000, writeSpeedMbps: 3600, releaseYear: 2022 },
    "Crucial P3 Plus 1TB": { model: "Crucial P3 Plus 1TB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 1000, readSpeedMbps: 5000, writeSpeedMbps: 3600, releaseYear: 2022 },
    "Crucial P3 Plus 2TB": { model: "Crucial P3 Plus 2TB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 2000, readSpeedMbps: 5000, writeSpeedMbps: 3600, releaseYear: 2022 },
    "Crucial P3 Plus 4TB": { model: "Crucial P3 Plus 4TB", manufacturer: "Micron", deviceType: "PCIe Gen4 NVMe", capacityGb: 4000, readSpeedMbps: 5000, writeSpeedMbps: 3600, releaseYear: 2022 },
    "TEAMGROUP MP44L 250GB": { model: "TEAMGROUP MP44L 250GB", manufacturer: "TeamGroup", deviceType: "PCIe Gen4 NVMe", capacityGb: 250, readSpeedMbps: 4650, writeSpeedMbps: 1500, releaseYear: 2024 },
    "TEAMGROUP MP44L 500GB": { model: "TEAMGROUP MP44L 500GB", manufacturer: "TeamGroup", deviceType: "PCIe Gen4 NVMe", capacityGb: 500, readSpeedMbps: 5000, writeSpeedMbps: 4000, releaseYear: 2024 },
    "TEAMGROUP MP44L 1TB": { model: "TEAMGROUP MP44L 1TB", manufacturer: "TeamGroup", deviceType: "PCIe Gen4 NVMe", capacityGb: 1000, readSpeedMbps: 5000, writeSpeedMbps: 4500, releaseYear: 2024 },
    "TEAMGROUP MP44L 2TB": { model: "TEAMGROUP MP44L 2TB", manufacturer: "TeamGroup", deviceType: "PCIe Gen4 NVMe", capacityGb: 2000, readSpeedMbps: 4800, writeSpeedMbps: 4400, releaseYear: 2024 },
    "Samsung 870 EVO 250GB": { model: "Samsung 870 EVO 250GB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 250, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2021 },
    "Samsung 870 EVO 500GB": { model: "Samsung 870 EVO 500GB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 500, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2021 },
    "Samsung 870 EVO 1TB": { model: "Samsung 870 EVO 1TB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 1000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2021 },
    "Samsung 870 EVO 2TB": { model: "Samsung 870 EVO 2TB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 2000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2021 },
    "Samsung 870 EVO 4TB": { model: "Samsung 870 EVO 4TB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 4000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2021 },
    "Samsung 870 QVO 1TB": { model: "Samsung 870 QVO 1TB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 1000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2020 },
    "Samsung 870 QVO 2TB": { model: "Samsung 870 QVO 2TB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 2000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2020 },
    "Samsung 870 QVO 4TB": { model: "Samsung 870 QVO 4TB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 4000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2020 },
    "Samsung 870 QVO 8TB": { model: "Samsung 870 QVO 8TB", manufacturer: "Samsung", deviceType: "SATA", capacityGb: 8000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2020 },
    "Crucial BX500 240GB": { model: "Crucial BX500 240GB", manufacturer: "Micron", deviceType: "SATA", capacityGb: 240, readSpeedMbps: 540, writeSpeedMbps: 500, releaseYear: 2019 },
    "Crucial BX500 480GB": { model: "Crucial BX500 480GB", manufacturer: "Micron", deviceType: "SATA", capacityGb: 480, readSpeedMbps: 540, writeSpeedMbps: 500, releaseYear: 2019 },
    "Crucial BX500 1TB": { model: "Crucial BX500 1TB", manufacturer: "Micron", deviceType: "SATA", capacityGb: 1000, readSpeedMbps: 540, writeSpeedMbps: 500, releaseYear: 2019 },
    "Crucial BX500 2TB": { model: "Crucial BX500 2TB", manufacturer: "Micron", deviceType: "SATA", capacityGb: 2000, readSpeedMbps: 540, writeSpeedMbps: 500, releaseYear: 2019 },
    "WD Blue 3D NAND SATA 500GB": { model: "WD Blue 3D NAND SATA 500GB", manufacturer: "Western Digital", deviceType: "SATA", capacityGb: 500, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2019 },
    "WD Blue 3D NAND SATA 1TB": { model: "WD Blue 3D NAND SATA 1TB", manufacturer: "Western Digital", deviceType: "SATA", capacityGb: 1000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2019 },
    "WD Blue 3D NAND SATA 2TB": { model: "WD Blue 3D NAND SATA 2TB", manufacturer: "Western Digital", deviceType: "SATA", capacityGb: 2000, readSpeedMbps: 560, writeSpeedMbps: 530, releaseYear: 2019 },
    "SanDisk Plus SATA SSD 480GB": { model: "SanDisk Plus SATA SSD 480GB", manufacturer: "SanDisk", deviceType: "SATA", capacityGb: 480, readSpeedMbps: 535, writeSpeedMbps: 450, releaseYear: 2019 },
    "SanDisk Plus SATA SSD 1TB": { model: "SanDisk Plus SATA SSD 1TB", manufacturer: "SanDisk", deviceType: "SATA", capacityGb: 1000, readSpeedMbps: 535, writeSpeedMbps: 450, releaseYear: 2019 },
    "SanDisk Plus SATA SSD 2TB": { model: "SanDisk Plus SATA SSD 2TB", manufacturer: "SanDisk", deviceType: "SATA", capacityGb: 2000, readSpeedMbps: 535, writeSpeedMbps: 450, releaseYear: 2019 },
  } as Record<string, SSDData>,
};
