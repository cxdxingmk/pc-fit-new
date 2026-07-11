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

/** 그룹 라벨("RTX 40", "RX 9000", "Ryzen 7", "B760" 등)에 박힌 첫 숫자를 세대/티어 기준으로 삼아
 *  오름차순(오래된 것 -> 최신) 정렬한다. 숫자가 없는 라벨("기타" 등)은 항상 맨 뒤로 보낸다. */
function extractLeadingNumber(label: string): number {
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function sortByGeneration(labels: string[]): string[] {
  return [...labels].sort((a, b) => extractLeadingNumber(a) - extractLeadingNumber(b));
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
    return sortByGeneration(uniqueInOrder(items.filter((item) => item.brand === brand).map(getGroupLabel)));
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
