"use client";

import { useCallback, useState } from "react";
import { readJsonFromStorage, writeJsonToStorage, removeFromStorage } from "./localStorageJson";

// localStorage에 그대로 대응되는 "독립적인" 하나의 상태값에만 써라 (예: 로그인 유저).
// BuildContext의 savedEstimates처럼 더 큰 상태 객체 안에 중첩된 필드라면 이 훅으로 감싸지 말 것 -
// 훅 내부 state와 부모 state, 두 개의 소스오브트루스가 생겨 서로 어긋날 수 있다.
// 그런 경우엔 readJsonFromStorage/writeJsonToStorage만 갖다 쓰는 게 안전하다.
export function useLocalStorageState<T>(
  key: string,
  defaultValue: T,
  validate?: (value: unknown) => value is T
) {
  const [value, setValue] = useState<T>(() => {
    const parsed = readJsonFromStorage<unknown>(key);
    if (parsed === null) return defaultValue;
    if (validate && !validate(parsed)) {
      removeFromStorage(key);
      return defaultValue;
    }
    return parsed as T;
  });

  const setStoredValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: T) => T)(prev) : next;
        writeJsonToStorage(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  const clearStoredValue = useCallback(() => {
    removeFromStorage(key);
    setValue(defaultValue);
  }, [key, defaultValue]);

  return [value, setStoredValue, clearStoredValue] as const;
}
