"use client";

import { useMemo, useState } from "react";

export interface CascadeItem {
  id: string;
  name: string;
  brand: string;
}

export interface UseCascadingPartSelectResult<T extends CascadeItem> {
  brand: string;
  group: string;
  modelId: string;
  brandOptions: string[];
  groupOptions: string[];
  modelOptions: T[];
  selectBrand: (brand: string) => void;
  selectGroup: (group: string) => void;
  selectModel: (modelId: string) => void;
  selectedItem: T | undefined;
}

function uniqueInOrder<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const ordered: T[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      ordered.push(value);
    }
  }
  return ordered;
}

/**
 * 브랜드 -> 그룹(시리즈/칩셋) -> 모델 3단 계층 선택 상태를 관리한다.
 * getGroupLabel을 무엇으로 넘기느냐에 따라 CPU/GPU(시리즈 파싱)와 메인보드(chipset 필드)
 * 양쪽에 모두 재사용할 수 있다.
 */
export function useCascadingPartSelect<T extends CascadeItem>(
  items: T[],
  getGroupLabel: (item: T) => string,
  initialModelId?: string
): UseCascadingPartSelectResult<T> {
  const initialItem = useMemo(() => items.find((item) => item.id === initialModelId), [items, initialModelId]);

  const [brand, setBrand] = useState(initialItem?.brand ?? "");
  const [group, setGroup] = useState(() => (initialItem ? getGroupLabel(initialItem) : ""));
  const [modelId, setModelId] = useState(initialModelId ?? "");

  const brandOptions = useMemo(() => uniqueInOrder(items.map((item) => item.brand)), [items]);

  const groupOptions = useMemo(() => {
    if (!brand) return [];
    return uniqueInOrder(items.filter((item) => item.brand === brand).map(getGroupLabel));
  }, [items, brand, getGroupLabel]);

  const modelOptions = useMemo(() => {
    if (!brand || !group) return [];
    return items.filter((item) => item.brand === brand && getGroupLabel(item) === group);
  }, [items, brand, group, getGroupLabel]);

  const selectBrand = (nextBrand: string) => {
    setBrand(nextBrand);
    setGroup("");
    setModelId("");
  };

  const selectGroup = (nextGroup: string) => {
    setGroup(nextGroup);
    setModelId("");
  };

  const selectedItem = useMemo(() => items.find((item) => item.id === modelId), [items, modelId]);

  return {
    brand,
    group,
    modelId,
    brandOptions,
    groupOptions,
    modelOptions,
    selectBrand,
    selectGroup,
    selectModel: setModelId,
    selectedItem,
  };
}
