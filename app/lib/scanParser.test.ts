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

describe("명령어 상수", () => {
  it("PowerShell 안내 명령은 Get-CimInstance 기반이고 wmic을 쓰지 않는다", () => {
    expect(powerShellScanCommand).toContain("Get-CimInstance");
    expect(powerShellScanCommand.toLowerCase()).not.toContain("wmic");
  });

  it("구버전 명령은 wmic 기반으로 그대로 남아있다", () => {
    expect(legacyWmicScanCommand).toContain("wmic");
  });
});
