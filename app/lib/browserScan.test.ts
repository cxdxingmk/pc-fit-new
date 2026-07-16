import { describe, expect, it } from "vitest";
import { normalizeGpuName, formatRamApproxDisplay } from "./browserScan";

describe("normalizeGpuName", () => {
  it("ANGLE 래핑 문자열에서 실제 GPU 모델명만 뽑아낸다", () => {
    expect(normalizeGpuName("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)")).toBe("NVIDIA GeForce RTX 4070");
  });

  it("매칭 실패 시 원문을 그대로 반환한다(과도한 손실 방지)", () => {
    expect(normalizeGpuName("Some Unrecognized Renderer String")).toBe("Some Unrecognized Renderer String");
  });
});

// 회귀 가드: navigator.deviceMemory는 fingerprinting 방지를 위해 실제 8GB 이상인 기기도
// 전부 8로 캡을 씌워 보고한다 — 이걸 그대로 "약 8GB"로 보여주면 32GB 기기 사용자에게
// 명백히 틀린 정보를 주게 된다(deviceMemory 신호와 표시 RAM 용량의 모순).
describe("formatRamApproxDisplay — deviceMemory 8GB 캡 정직성", () => {
  it("8(캡에 걸린 값)이면 '8GB 이상'이라고 명시하고 확정처럼 말하지 않는다", () => {
    const result = formatRamApproxDisplay(8);
    expect(result).toContain("이상");
    expect(result).not.toBe("약 8GB");
  });

  it("8 미만(신뢰 가능한 실측치)이면 그대로 근사 표기한다", () => {
    expect(formatRamApproxDisplay(4)).toBe("약 4GB");
    expect(formatRamApproxDisplay(2)).toBe("약 2GB");
  });
});
