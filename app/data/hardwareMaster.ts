export interface MasterHardwareItem {
  id: string;
  name: string;
  score?: number;
  matchKeywords: string[];
  mappedId?: string;
}

export const HARDWARE_MASTER = {
  CPU: [
    { id: "intel_14400f", name: "인텔 코어i5-14세대 14400F", score: 75, matchKeywords: ["14400F", "i5-14400F"], mappedId: "i5-14400f" },
    { id: "amd_7500f", name: "AMD 라이젠5-5세대 7500F", score: 78, matchKeywords: ["7500F", "Ryzen 5 7500F"], mappedId: "r7-7500f" },
    { id: "amd_9800x3d", name: "AMD 라이젠7-5세대 9800X3D", score: 100, matchKeywords: ["9800X3D", "Ryzen 7 9800X3D"], mappedId: "r7-9800x3d" },
    { id: "intel_14700k", name: "인텔 코어i7-14세대 14700K", score: 90, matchKeywords: ["14700K", "i7-14700K"], mappedId: "i7-14700k" },
    { id: "amd_9700x", name: "AMD 라이젠7-5세대 9700X", score: 88, matchKeywords: ["9700X", "Ryzen 7 9700X"], mappedId: "r7-9700x" }
  ] as MasterHardwareItem[],
  GPU: [
    { id: "nvidia_4060", name: "NVIDIA 지포스 RTX 4060", score: 65, matchKeywords: ["4060", "RTX 4060"], mappedId: "rtx4060" },
    { id: "nvidia_4070_super", name: "NVIDIA 지포스 RTX 4070 SUPER", score: 85, matchKeywords: ["4070 SUPER", "RTX 4070 SUPER"], mappedId: "rtx4070-super" },
    { id: "amd_7800xt", name: "AMD 라데온 RX 7800 XT", score: 82, matchKeywords: ["7800 XT", "RX 7800XT"], mappedId: "rx7800xt" },
    { id: "nvidia_3060", name: "NVIDIA 지포스 RTX 3060", score: 58, matchKeywords: ["3060", "RTX 3060"], mappedId: "rtx3060" },
    { id: "nvidia_5080", name: "NVIDIA 지포스 RTX 5080", score: 98, matchKeywords: ["5080", "RTX 5080"], mappedId: "rtx5080" }
  ] as MasterHardwareItem[],
  MAINBOARD: [
    { id: "mb_b650", name: "MSI MAG B650 토마호크", matchKeywords: ["B650", "MAG B650"] },
    { id: "mb_h610", name: "ASUS PRIME H610M", matchKeywords: ["H610", "PRIME H610M"] },
    { id: "mb_b760", name: "GIGABYTE B760 AORUS ELITE", matchKeywords: ["B760", "AORUS B760"] },
    { id: "mb_z790", name: "ASUS TUF Z790", matchKeywords: ["Z790", "TUF Z790"] }
  ] as MasterHardwareItem[]
} as const;

export function normalizeMasterText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findMasterMatch(items: readonly MasterHardwareItem[], rawText: string) {
  const lowerRaw = rawText.toLowerCase();
  const normalized = normalizeMasterText(rawText);

  for (const item of items) {
    for (const keyword of item.matchKeywords) {
      const normalizedKeyword = normalizeMasterText(keyword);
      if (lowerRaw.includes(keyword.toLowerCase()) || normalized.includes(normalizedKeyword)) {
        return item;
      }
    }
  }

  return null;
}
