// AuthContext/BuildContext/register-pc 페이지 등 여러 곳에서 각자
// try/catch JSON.parse + removeItem 보일러플레이트를 반복하고 있던 것을 한 곳으로 모았다.

export function readJsonFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

export function writeJsonToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeFromStorage(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}
