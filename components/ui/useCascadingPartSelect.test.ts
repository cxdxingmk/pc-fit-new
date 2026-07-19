import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCascadingPartSelect, sortModelsByNumber, type CascadeItem } from "./useCascadingPartSelect";

interface TestItem extends CascadeItem {
  series: string;
}

const items: TestItem[] = [
  { id: "nvidia-4070", name: "RTX 4070", brand: "NVIDIA", series: "RTX 40" },
  { id: "nvidia-4090", name: "RTX 4090", brand: "NVIDIA", series: "RTX 40" },
  { id: "amd-7800xt", name: "RX 7800 XT", brand: "AMD", series: "RX 7000" },
  { id: "amd-9070xt", name: "RX 9070 XT", brand: "AMD", series: "RX 9000" },
];

const getSeries = (item: TestItem) => item.series;

// 회귀 가드: brand/group이 마운트 시 1회만 초기화되고 selectModel()이 modelId만 갱신하던
// 버그 — 자동감지/퍼머링크 복원처럼 "다른 브랜드의 모델"로 프로그램적으로 바뀌면 modelOptions가
// 옛 brand/group 기준으로 필터링돼 셀렉트가 빈 값처럼 보였다.
describe("useCascadingPartSelect — selectModel 브랜드/그룹 재동기화", () => {
  it("초기 모델과 다른 브랜드의 모델로 selectModel()을 호출하면 brand/group도 함께 갱신된다", () => {
    const { result } = renderHook(() => useCascadingPartSelect(items, getSeries, "nvidia-4070"));

    expect(result.current.brand).toBe("NVIDIA");
    expect(result.current.group).toBe("RTX 40");

    act(() => {
      result.current.selectModel("amd-9070xt");
    });

    expect(result.current.brand, "브랜드가 재동기화되지 않음").toBe("AMD");
    expect(result.current.group, "그룹(시리즈)이 재동기화되지 않음").toBe("RX 9000");
    expect(result.current.modelId).toBe("amd-9070xt");
  });

  it("재동기화 후 modelOptions에 새로 선택한 모델이 실제로 포함된다(안 그러면 <select>가 빈 값처럼 보임)", () => {
    const { result } = renderHook(() => useCascadingPartSelect(items, getSeries, "nvidia-4070"));

    act(() => {
      result.current.selectModel("amd-9070xt");
    });

    const modelIds = result.current.modelOptions.map((item) => item.id);
    expect(modelIds, `modelOptions=${JSON.stringify(modelIds)}에 amd-9070xt가 없음`).toContain("amd-9070xt");
    expect(result.current.selectedItem?.id).toBe("amd-9070xt");
  });

  it("같은 브랜드·그룹 내에서 모델만 바꾸는 일반적인 흐름은 그대로 동작한다(회귀 없음)", () => {
    const { result } = renderHook(() => useCascadingPartSelect(items, getSeries, "nvidia-4070"));

    act(() => {
      result.current.selectModel("nvidia-4090");
    });

    expect(result.current.brand).toBe("NVIDIA");
    expect(result.current.group).toBe("RTX 40");
    expect(result.current.modelId).toBe("nvidia-4090");
  });

  it("selectBrand/selectGroup은 여전히 하위 선택을 초기화한다(기존 동작 유지)", () => {
    const { result } = renderHook(() => useCascadingPartSelect(items, getSeries, "nvidia-4070"));

    act(() => {
      result.current.selectBrand("AMD");
    });
    expect(result.current.group).toBe("");
    expect(result.current.modelId).toBe("");

    act(() => {
      result.current.selectGroup("RX 9000");
    });
    expect(result.current.modelId).toBe("");
    expect(result.current.modelOptions.map((i) => i.id)).toEqual(["amd-9070xt"]);
  });
});

// 회귀 가드: "직접 입력" 모델 드롭다운이 "5080, 5070, 5050, 5060..."처럼 뒤섞여 있던 문제 —
// modelOptions는 필터만 하고 정렬은 안 했었다.
describe("sortModelsByNumber — 같은 그룹 안 모델 번호 오름차순 정렬", () => {
  it("GeForce RTX 50 시리즈: 뒤섞인 입력도 50→60→70→80→90 오름차순으로 정렬된다", () => {
    const names = ["GeForce RTX 5080", "GeForce RTX 5050", "GeForce RTX 5090", "GeForce RTX 5070", "GeForce RTX 5060"];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted).toEqual(["GeForce RTX 5050", "GeForce RTX 5060", "GeForce RTX 5070", "GeForce RTX 5080", "GeForce RTX 5090"]);
  });

  it("같은 번호대에서 접미사 없는 베이스 모델이 Ti/SUPER 변형보다 먼저 온다", () => {
    const names = ["GeForce RTX 5060 Ti", "GeForce RTX 5060", "GeForce RTX 4070 Ti SUPER", "GeForce RTX 4070 SUPER", "GeForce RTX 4070 Ti", "GeForce RTX 4070"];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted).toEqual([
      "GeForce RTX 4070",
      "GeForce RTX 4070 SUPER",
      "GeForce RTX 4070 Ti",
      "GeForce RTX 4070 Ti SUPER",
      "GeForce RTX 5060",
      "GeForce RTX 5060 Ti",
    ]);
  });

  it("예시 순서(50, 60, 60 Ti, 70, 70 Ti, 80, 80 SUPER, 90, 90 D)를 정확히 재현한다", () => {
    const names = [
      "GeForce RTX 5090 D",
      "GeForce RTX 5080 SUPER",
      "GeForce RTX 5070 Ti",
      "GeForce RTX 5060 Ti",
      "GeForce RTX 5090",
      "GeForce RTX 5080",
      "GeForce RTX 5070",
      "GeForce RTX 5060",
      "GeForce RTX 5050",
    ];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted).toEqual([
      "GeForce RTX 5050",
      "GeForce RTX 5060",
      "GeForce RTX 5060 Ti",
      "GeForce RTX 5070",
      "GeForce RTX 5070 Ti",
      "GeForce RTX 5080",
      "GeForce RTX 5080 SUPER",
      "GeForce RTX 5090",
      "GeForce RTX 5090 D",
    ]);
  });

  it("'D V2'처럼 'D' 뒤에 버전 토큰이 더 붙는 중국 시장 변형도 base/D와 같은 최하위 순위로 취급된다(실제 버그: 'D V2'가 'D'보다 앞에 옴)", () => {
    const names = ["GeForce RTX 5090 D V2", "GeForce RTX 5090", "GeForce RTX 5090 D"];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted[0]).toBe("GeForce RTX 5090");
    expect(sorted.slice(1)).toEqual(expect.arrayContaining(["GeForce RTX 5090 D", "GeForce RTX 5090 D V2"]));
  });

  it("같은 모델·접미사 안에서는 VRAM 용량 오름차순으로 정렬된다", () => {
    const names = ["GeForce RTX 5060 Ti 16GB", "GeForce RTX 5060 Ti 8GB"];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted).toEqual(["GeForce RTX 5060 Ti 8GB", "GeForce RTX 5060 Ti 16GB"]);
  });

  it("AMD Radeon 계열에도 같은 원칙이 적용된다(XT가 베이스보다 뒤)", () => {
    const names = ["Radeon RX 9070 XT", "Radeon RX 9060 XT", "Radeon RX 9070", "Radeon RX 9060"];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted).toEqual(["Radeon RX 9060", "Radeon RX 9060 XT", "Radeon RX 9070", "Radeon RX 9070 XT"]);
  });

  it("CPU 목록에도 동일한 함수를 재사용할 수 있다(Ryzen 9000 시리즈 번호 오름차순)", () => {
    const names = ["Ryzen 9 9950X", "Ryzen 5 9600X", "Ryzen 7 9800X3D", "Ryzen 7 9700X"];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted).toEqual(["Ryzen 5 9600X", "Ryzen 7 9700X", "Ryzen 7 9800X3D", "Ryzen 9 9950X"]);
  });

  it("Ryzen 9 9800 앞의 한 자리 등급 숫자(9)를 모델 번호로 착각하지 않는다", () => {
    const names = ["Core Ultra 9 285K", "Core Ultra 7 265K"];
    const sorted = sortModelsByNumber(names, (n) => n);
    expect(sorted).toEqual(["Core Ultra 7 265K", "Core Ultra 9 285K"]);
  });
});
