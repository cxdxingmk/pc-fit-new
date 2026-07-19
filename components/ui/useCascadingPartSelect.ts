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

// 같은 그룹(시리즈/세대) 안에서 모델을 번호 오름차순으로 정렬할 때 쓰는 접미사 우선순위 —
// 같은 번호대에서 "베이스 모델"이 항상 먼저 오고, 그 다음 변형이 성능/등급 순으로 이어지게 한다
// (예: 5060 -> 5060 Ti, 4070 -> 4070 SUPER -> 4070 Ti -> 4070 Ti SUPER). "D"(중국 시장向 컷다운
// 변형, 예: RTX 5090 D)는 같은 번호의 다른 변형보다 항상 뒤로 보낸다 — 실제로 더 낮은 사양이다.
const SUFFIX_RANK: Record<string, number> = {
  "": 0,
  SUPER: 1,
  X: 1,
  K: 1,
  F: 1,
  TI: 2,
  XT: 2,
  X3D: 2,
  KF: 3,
  "TI SUPER": 3,
  XTX: 3,
  D: 9,
};

function suffixRank(suffix: string): number {
  const key = suffix.trim().toUpperCase().replace(/\s+/g, " ");
  if (key in SUFFIX_RANK) return SUFFIX_RANK[key];
  // "D V2"처럼 "D" 뒤에 추가 버전 토큰이 붙는 중국 시장 변형 계열은 정확히 "D"와 일치하지
  // 않아도 같은(항상 맨 뒤) 취급을 받아야 한다.
  if (/^D(\s|$)/.test(key)) return SUFFIX_RANK.D;
  return 5;
}

/** 이름 문자열에 박힌 용량(예: "16GB", "16 GB")을 추출한다 — 같은 모델/접미사 안에서 용량
 *  변형(예: "RTX 5060 Ti 8GB" vs "RTX 5060 Ti 16GB")을 오름차순으로 가르는 3순위 키로 쓴다. */
function extractCapacityGb(label: string): number {
  const match = label.match(/(\d+)\s*GB\b/i);
  return match ? Number(match[1]) : 0;
}

export interface ModelSortKey {
  baseNumber: number;
  suffixRank: number;
  capacityGb: number;
}

// /build의 "보유 부품" 화면(브랜드→모델, 시리즈 단계 없이 그 브랜드의 전 세대를 한 번에 보여줌)은
// 자동 추정 카탈로그에 섞여 있는 "GeForce RTX 3070 Ti 8 GB GA102"처럼 다이 코드네임(GA102,
// AD104 등)이 뒤에 붙은 이름까지 그대로 정렬 대상이 된다 — "마지막 3자리 이상 숫자"만 보면
// "GA102"의 "102"를 모델 번호로 잘못 집어(코드네임은 항상 글자+숫자가 공백 없이 붙어 있다)
// 목록 맨 앞에 튀어나오는 버그가 있었다. RTX/GTX/GT/RX 뒤에 바로 오는 숫자가 있으면 그걸
// 최우선으로 쓴다(코드네임은 이 키워드 뒤에 오지 않으므로 안전) — 이런 키워드가 없는 이름
// (CPU, Intel Arc의 "A770" 등)에서만 "3자리 이상 숫자 중 마지막 것" 방식으로 폴백한다.
const SERIES_NUMBER_PATTERN = /(?:RTX|GTX|GT|RX)\s?(\d{3,5})/i;

/**
 * "GeForce RTX 5060 Ti 16GB", "Radeon RX 9070 XT", "Ryzen 7 9800X3D", "Core Ultra 9 285K"처럼
 * 브랜드/제품군이 섞인 모델명에서 (모델 번호, 접미사 등급, 용량) 정렬 키를 뽑는다.
 */
export function parseModelSortKey(name: string): ModelSortKey {
  const seriesMatch = name.match(SERIES_NUMBER_PATTERN);

  let baseNumberStr: string | undefined;
  let numberIndex = -1;

  if (seriesMatch) {
    baseNumberStr = seriesMatch[1];
    numberIndex = seriesMatch.index! + seriesMatch[0].length - baseNumberStr.length;
  } else {
    // RTX/GTX/GT/RX 접두가 없는 이름(CPU, Intel Arc 등) — "3자리 이상 숫자 중 마지막 것"을
    // 모델 번호로 본다. CPU 이름 앞쪽의 "Ryzen 9"/"Core Ultra 9"/"Core i5" 같은 한 자리 등급
    // 숫자와 실제 모델 번호를 구분하기 위함이다(항상 모델 번호가 뒤에 옴).
    const digitRuns = [...name.matchAll(/\d+/g)].filter((m) => m[0].length >= 3);
    const last = digitRuns[digitRuns.length - 1];
    if (last) {
      baseNumberStr = last[0];
      numberIndex = last.index!;
    }
  }

  if (!baseNumberStr) {
    return { baseNumber: Number.POSITIVE_INFINITY, suffixRank: 0, capacityGb: 0 };
  }

  const trailing = name.slice(numberIndex + baseNumberStr.length);
  const suffix = trailing.replace(/\d+\s*GB\b/i, "").trim();

  return {
    baseNumber: Number(baseNumberStr),
    suffixRank: suffixRank(suffix),
    capacityGb: extractCapacityGb(trailing),
  };
}

/** CPU/GPU 공용 — 같은 브랜드·그룹(시리즈) 안에서 모델을 번호 → 접미사 등급 → 용량 순으로
 *  오름차순 정렬한다. 드롭다운이 "5080, 5070, 5050, 5060..." 처럼 뒤섞여 보이던 문제를 고친다. */
export function sortModelsByNumber<T>(items: T[], getName: (item: T) => string): T[] {
  return [...items].sort((a, b) => {
    const keyA = parseModelSortKey(getName(a));
    const keyB = parseModelSortKey(getName(b));
    if (keyA.baseNumber !== keyB.baseNumber) return keyA.baseNumber - keyB.baseNumber;
    if (keyA.suffixRank !== keyB.suffixRank) return keyA.suffixRank - keyB.suffixRank;
    return keyA.capacityGb - keyB.capacityGb;
  });
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
    const filtered = items.filter((item) => item.brand === brand && getGroupLabel(item) === group);
    return sortModelsByNumber(filtered, (item) => item.name);
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

  // brand/group은 브랜드→시리즈→모델 드롭다운을 직접 조작할 때만 갱신되고, modelId가
  // 외부에서(자동감지 매칭, 퍼머링크 복원, 사양 리셋 등) 바뀌면 그대로 안 따라와서 새 모델의
  // 브랜드/시리즈가 아닌 옛 값으로 modelOptions가 필터링돼 셀렉트가 빈 값처럼 보이는 버그가
  // 있었다. selectModel은 항상 이 함수로 호출되므로(직접 setModelId를 쓰지 않음), 여기서
  // brand/group도 함께 재동기화하면 원인을 근본적으로 없앤다 — 일반적인 계층 선택 흐름에서는
  // 이미 같은 brand/group의 모델을 고르는 것이라 사실상 no-op이라 기존 동작에 영향이 없다.
  const selectModel = (nextModelId: string) => {
    const item = items.find((i) => i.id === nextModelId);
    if (item) {
      setBrand(item.brand);
      setGroup(getGroupLabel(item));
    }
    setModelId(nextModelId);
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
    selectModel,
    selectedItem,
  };
}
