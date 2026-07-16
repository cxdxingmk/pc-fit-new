import { describe, expect, it } from "vitest";
import { parseSpecOutput, powerShellScanCommand, legacyWmicScanCommand } from "./scanParser";

const POWERSHELL_SAMPLE = `Name
----
AMD Ryzen 7 9700X

Name
----
NVIDIA GeForce RTX 4070 SUPER

Manufacturer          Product
------------          -------
ASUSTeK COMPUTER INC. TUF GAMING B650-PLUS

Capacity      Speed
--------      -----
17179869184   5600
17179869184   5600

Model                          Size
-----                          ----
Samsung SSD 990 PRO 1TB        1000202273280`;

const WMIC_SAMPLE = `Name
Intel(R) Core(TM) i7-14700K


Name
NVIDIA GeForce RTX 4070 SUPER


Manufacturer  Product
ASUSTeK COMPUTER INC.  TUF GAMING Z790-PLUS


Capacity    Speed
17179869184  5600


Model                          Size
Samsung SSD 990 PRO 1TB   1000202273280`;

describe("parseSpecOutput — 정상 출력", () => {
  it("PowerShell(Get-CimInstance) 포맷에서 CPU/GPU/보드/RAM(합산+매수)/디스크를 모두 인식한다", () => {
    const result = parseSpecOutput(POWERSHELL_SAMPLE);

    expect(result.cpuId).toBe("r7-9700x");
    expect(result.cpuLabel).toMatch(/9700X/i);
    expect(result.gpuId).toBe("rtx4070-super");
    expect(result.gpuLabel).toMatch(/4070 SUPER/i);
    expect(result.motherboardChipset).toBe("B650");
    expect(result.ramCapacity).toBe("32GB"); // 16GB × 2
    expect(result.ramModuleCount).toBe(2);
    expect(result.ramDetail).toContain("x2");
    expect(result.ssdCapacity).toBe("1TB");
    expect(result.ssdDetail).toMatch(/990 PRO/i);
  });

  it("wmic(구버전) 포맷도 동일하게 인식한다 — 명령 포맷과 무관하게 동작해야 한다", () => {
    const result = parseSpecOutput(WMIC_SAMPLE);

    expect(result.cpuId).toBe("i7-14700k");
    expect(result.gpuId).toBe("rtx4070-super");
    expect(result.motherboardChipset).toBe("Z790");
    expect(result.ramCapacity).toBe("16GB");
    expect(result.ramModuleCount).toBe(1);
    expect(result.ssdCapacity).toBe("1TB");
  });
});

describe("parseSpecOutput — 일부 누락", () => {
  it("CPU/GPU만 있고 나머지가 없으면 나머지 필드는 null이고, 인식된 필드는 정확하다", () => {
    const partial = `Name\n----\nIntel(R) Core(TM) i5-14400F\n\nName\n----\nNVIDIA GeForce RTX 4060`;
    const result = parseSpecOutput(partial);

    expect(result.cpuId).toBe("i5-14400f");
    expect(result.gpuId).toBe("rtx4060");
    expect(result.motherboardChipset).toBeNull();
    expect(result.ramCapacity).toBeNull();
    expect(result.ramModuleCount).toBeNull();
    expect(result.ssdCapacity).toBeNull();
  });

  it("GPU 섹션이 통째로 빠지면 gpuId는 null이지만 gpuRaw는 null이다(추출할 값 자체가 없으므로) — cpuId는 영향받지 않는다", () => {
    const cpuOnly = `Name\n----\nAMD Ryzen 5 5600`;
    const result = parseSpecOutput(cpuOnly);

    expect(result.cpuId).toBe("r5-5600");
    expect(result.gpuId).toBeNull();
    expect(result.gpuRaw).toBeNull();
  });

  it("메인보드 칩셋만 인식 못 해도 CPU/GPU 인식에는 영향이 없다(필드별 독립 판정)", () => {
    const noBoardKeyword = `Name\n----\nAMD Ryzen 7 9800X3D\n\nName\n----\nNVIDIA GeForce RTX 5080\n\nManufacturer  Product\n------------  -------\nUnknownVendor MysteryBoard9000`;
    const result = parseSpecOutput(noBoardKeyword);

    expect(result.cpuId).toBe("r7-9800x3d");
    expect(result.gpuId).toBe("rtx5080");
    expect(result.motherboardChipset).toBeNull();
  });
});

describe("parseSpecOutput — 완전 무관한 텍스트", () => {
  it("PC 사양과 무관한 텍스트를 넣으면 모든 필드가 null이고 raw 필드도 비어 매칭 실패가 명확히 드러난다", () => {
    const garbage = "오늘 점심 메뉴는 김치찌개였고 날씨가 맑았다. 저녁엔 영화를 볼 예정이다.";
    const result = parseSpecOutput(garbage);

    expect(result.cpuId).toBeNull();
    expect(result.gpuId).toBeNull();
    expect(result.motherboardChipset).toBeNull();
    expect(result.ramCapacity).toBeNull();
    expect(result.ssdCapacity).toBeNull();
    expect(result.cpuRaw).toBeNull();
    expect(result.gpuRaw).toBeNull();
  });

  it("빈 문자열도 throw 없이 전부 null을 반환한다", () => {
    expect(() => parseSpecOutput("")).not.toThrow();
    const result = parseSpecOutput("");
    expect(result.cpuId).toBeNull();
    expect(result.gpuId).toBeNull();
  });
});

describe("parseSpecOutput — WMI 원문의 브랜드/상표 보일러플레이트로 인한 오매칭 회귀", () => {
  it('"Intel(R) Core(TM) i9-14900K" 같은 원문도 카탈로그의 "Core i9-14900K"와 정확히 매칭되어야 한다(엉뚱한 폴백 i5-14400f로 새면 안 됨)', () => {
    const raw = `Name\n----\nIntel(R) Core(TM) i9-14900K\n\nName\n----\nNVIDIA GeForce RTX 4070 SUPER`;
    const result = parseSpecOutput(raw);

    expect(result.cpuId).toBe("i9-14900k");
    expect(result.cpuId).not.toBe("i5-14400f");
  });

  it('"12th Gen Intel(R) Core(TM) i5-14400F CPU @ 2.50GHz" 형태의 전체 보일러플레이트도 정확히 벗겨내고 매칭한다', () => {
    const raw = `Name\n----\n12th Gen Intel(R) Core(TM) i5-14400F CPU @ 2.50GHz`;
    const result = parseSpecOutput(raw);

    expect(result.cpuId).toBe("i5-14400f");
  });

  it('AMD의 "N-Core Processor" 접미사("AMD Ryzen 5 5600 6-Core Processor")도 노이즈로 벗겨내고 정확히 매칭한다(엉뚱한 폴백 r7-9700x로 새면 안 됨)', () => {
    const raw = "CPU:\nAMD Ryzen 5 5600 6-Core Processor";
    const result = parseSpecOutput(raw);

    expect(result.cpuId).toBe("r5-5600");
    expect(result.cpuId).not.toBe("r7-9700x");
  });
});

describe("parseSpecOutput — 매칭 실패 시 raw 보존", () => {
  it("카탈로그에 없는 CPU/GPU 문자열은 폴백 규칙(intel/ryzen/rtx/gtx)으로도 못 잡으면 원문을 cpuRaw/gpuRaw로 보존한다", () => {
    const obscure = `Name\n----\n어느 미지의 프로세서 X1000\n\nName\n----\n알 수 없는 그래픽 장치`;
    const result = parseSpecOutput(obscure);

    expect(result.cpuId).toBeNull();
    expect(result.cpuRaw).toBe("어느 미지의 프로세서 X1000");
    expect(result.gpuId).toBeNull();
    expect(result.gpuRaw).toBe("알 수 없는 그래픽 장치");
  });
});

describe("parseSpecOutput — 새 포맷(CPU:/SSD:/RAM: 헤더, GPU 미포함)", () => {
  it("(1) 정상 출력 — 조합 A: AMD Ryzen 5 5600 + Samsung 970 EVO Plus 500GB + 32GB DDR4", () => {
    const sample = "CPU:\nAMD Ryzen 5 5600 6-Core Processor\n\nSSD:\nSamsung SSD 970 EVO Plus 500GB\n\nRAM:\nTotal 32 GB (16GB x 2ea / DDR4 3200MHz / Samsung)";
    const result = parseSpecOutput(sample);

    expect(result.cpuId).toBe("r5-5600");
    expect(result.gpuId).toBeNull(); // 새 명령은 GPU를 조회하지 않는다 — 브라우저 자동감지가 대신 처리
    expect(result.ssdCapacity).toBe("512GB");
    expect(result.ssdDetail).toBe("Samsung SSD 970 EVO Plus 500GB");
    expect(result.ramCapacity).toBe("32GB");
    expect(result.ramModuleCount).toBe(2);
    expect(result.ramDetail).toContain("DDR4");
    expect(result.ramMismatch).toBe(false);
    expect(result.cpuIsLaptop).toBe(false);
  });

  it("(1) 정상 출력 — 조합 B: Intel i9-14900K + Samsung 990 PRO 1TB + 64GB DDR5", () => {
    const sample =
      "CPU:\nIntel(R) Core(TM) i9-14900K\n\nSSD:\nSamsung SSD 990 PRO 1TB\n\nRAM:\nTotal 64 GB (32GB x 2ea / DDR5 6000MHz / SK Hynix)";
    const result = parseSpecOutput(sample);

    expect(result.cpuId).toBe("i9-14900k");
    expect(result.ssdCapacity).toBe("1TB");
    expect(result.ramCapacity).toBe("64GB");
    expect(result.ramModuleCount).toBe(2);
    expect(result.ramDetail).toContain("DDR5");
  });

  it("(1) 정상 출력 — 조합 C: 단일 슬롯 RAM(8GB x1)", () => {
    const sample = "CPU:\nAMD Ryzen 7 9800X3D\n\nSSD:\nWD Black SN770 1TB\n\nRAM:\nTotal 8 GB (8GB x 1ea / DDR5 5600MHz / Micron)";
    const result = parseSpecOutput(sample);

    expect(result.cpuId).toBe("r7-9800x3d");
    expect(result.ramCapacity).toBe("8GB");
    expect(result.ramModuleCount).toBe(1);
  });

  it("(2) RAM 슬롯 용량 불일치(8GB+16GB 혼합) — ramMismatch=true, ramCapacity/ramDetail은 null, CPU/SSD는 정상 인식", () => {
    const sample = "CPU:\nIntel(R) Core(TM) i5-14400F\n\nSSD:\nSamsung SSD 990 PRO 1TB\n\nRAM:\nTotal 24 GB (16GB x 2ea / DDR4 3200MHz / Samsung)";
    const result = parseSpecOutput(sample);

    expect(result.ramMismatch).toBe(true);
    expect(result.ramCapacity).toBeNull();
    expect(result.ramDetail).toBeNull();
    expect(result.ramModuleCount).toBeNull();
    expect(result.cpuId).toBe("i5-14400f");
    expect(result.ssdCapacity).toBe("1TB");
  });

  it("(3) DDR3 이하 규격(PowerShell 스크립트의 'DDR3 or Older' 라벨)도 정상 인식한다", () => {
    const sample = "CPU:\nIntel(R) Core(TM) i7-4770K\n\nSSD:\nSamsung SSD 850 EVO 250GB\n\nRAM:\nTotal 16 GB (8GB x 2ea / DDR3 or Older 1600MHz / Kingston)";
    const result = parseSpecOutput(sample);

    expect(result.ramCapacity).toBe("16GB");
    expect(result.ramModuleCount).toBe(2);
    expect(result.ramDetail).toContain("DDR3 or Older");
    expect(result.ramMismatch).toBe(false);
  });

  it("(4) SSD가 여러 대(SSD+HDD 혼재)일 때 SSD로 보이는 줄을 우선 채택한다", () => {
    const sample = "CPU:\nAMD Ryzen 7 9700X\n\nSSD:\nST2000DM008-2FR102\nSamsung SSD 990 PRO 1TB\n\nRAM:\nTotal 32 GB (16GB x 2ea / DDR5 6000MHz / SK Hynix)";
    const result = parseSpecOutput(sample);

    expect(result.ssdDetail).toMatch(/990 PRO/i);
    expect(result.ssdCapacity).toBe("1TB");
  });

  it("(5) CPU 원문에 Laptop/Mobile 키워드가 있으면 cpuIsLaptop=true — 등록 자체는 막지 않는다(cpuId는 계속 시도)", () => {
    const sample = "CPU:\nIntel(R) Core(TM) i7-13700H Mobile\n\nSSD:\nSamsung SSD 990 PRO 1TB\n\nRAM:\nTotal 16 GB (8GB x 2ea / DDR5 5600MHz / Samsung)";
    const result = parseSpecOutput(sample);

    expect(result.cpuIsLaptop).toBe(true);
    expect(result.ssdCapacity).toBe("1TB"); // 노트북 여부와 무관하게 다른 필드는 정상 인식
  });

  it("Laptop/Mobile 키워드가 없으면 cpuIsLaptop=false", () => {
    const sample = "CPU:\nAMD Ryzen 5 5600 6-Core Processor\n\nSSD:\nSamsung SSD 990 PRO 1TB\n\nRAM:\nTotal 16 GB (8GB x 2ea / DDR4 3200MHz / Samsung)";
    const result = parseSpecOutput(sample);

    expect(result.cpuIsLaptop).toBe(false);
  });

  it("(9) 빈 값/손상된 출력 — 'RAM:' 헤더는 있지만 다음 줄이 Total 패턴이 아니면 ramCapacity는 null이고 throw하지 않는다", () => {
    const corrupted = "CPU:\nAMD Ryzen 5 5600\n\nSSD:\nSamsung SSD 990 PRO 1TB\n\nRAM:\n(측정 실패)";
    expect(() => parseSpecOutput(corrupted)).not.toThrow();
    const result = parseSpecOutput(corrupted);
    expect(result.ramCapacity).toBeNull();
    expect(result.ramMismatch).toBe(false);
    expect(result.cpuId).toBe("r5-5600"); // RAM 파싱 실패가 CPU 인식에 영향 주지 않음
  });

  it("새 포맷 텍스트에서도 브랜드명만으로 엉뚱한 카탈로그 SSD와 오매칭되지 않는다(회귀)", () => {
    // 카탈로그에 정확히 없는 모델("970 EVO Plus")이 브랜드("Samsung")만으로 카탈로그의 아무
    // Samsung 항목(예: 990 Pro)과 잘못 매칭되던 버그의 회귀 테스트.
    const sample = "CPU:\nAMD Ryzen 5 5600\n\nSSD:\nSamsung SSD 970 EVO Plus 500GB\n\nRAM:\nTotal 16 GB (8GB x 2ea / DDR4 3200MHz / Samsung)";
    const result = parseSpecOutput(sample);

    expect(result.ssdDetail).toBe("Samsung SSD 970 EVO Plus 500GB");
    expect(result.ssdDetail).not.toMatch(/990/);
    expect(result.ssdCapacity).toBe("512GB");
  });
});

describe("명령어 상수", () => {
  it("PowerShell 안내 명령은 Get-CimInstance 기반이고 wmic을 쓰지 않는다", () => {
    expect(powerShellScanCommand).toContain("Get-CimInstance");
    expect(powerShellScanCommand.toLowerCase()).not.toContain("wmic");
  });

  it("PowerShell 안내 명령은 CPU/SSD/RAM만 조회하고 GPU/메인보드는 조회하지 않는다(GPU는 브라우저가 자동감지)", () => {
    expect(powerShellScanCommand).toContain("Win32_Processor");
    expect(powerShellScanCommand).toContain("Win32_DiskDrive");
    expect(powerShellScanCommand).toContain("Win32_PhysicalMemory");
    expect(powerShellScanCommand).not.toContain("Win32_VideoController");
    expect(powerShellScanCommand).not.toContain("Win32_BaseBoard");
  });

  it("구버전 명령은 wmic 기반으로 그대로 남아있다", () => {
    expect(legacyWmicScanCommand).toContain("wmic");
  });
});
