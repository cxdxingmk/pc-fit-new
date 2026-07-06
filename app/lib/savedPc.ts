import type { UserSavedPc } from "../types/hardware";

const storageKey = "user_pc_spec";

export function getSavedPc(): UserSavedPc | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSavedPc>;
    if (!parsed.cpuId || !parsed.gpuId || !parsed.ramCapacity || !parsed.ssdCapacity || !parsed.monitorResolution || !parsed.monitorRefreshRate) {
      return null;
    }
    return {
      id: parsed.id ?? "saved-pc",
      cpuId: parsed.cpuId,
      gpuId: parsed.gpuId,
      ramCapacity: parsed.ramCapacity,
      ramDetail: parsed.ramDetail,
      ssdCapacity: parsed.ssdCapacity,
      ssdDetail: parsed.ssdDetail,
      monitorResolution: parsed.monitorResolution,
      monitorRefreshRate: parsed.monitorRefreshRate,
    };
  } catch {
    return null;
  }
}
