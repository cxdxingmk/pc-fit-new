import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCascadingPartSelect, type CascadeItem } from "./useCascadingPartSelect";

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
