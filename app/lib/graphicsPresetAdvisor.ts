/**
 * "설치 없이" 최적화 가이드 — 게임별 그래픽 옵션 추천.
 *
 * 새 게임별 최소/권장 사양 DB를 두지 않는다 — displayMatch.ts의 evaluateAllGames()가 이미
 * CPU/GPU gameScore만으로 해상도·주사율별 {status, bottleneck, vramHit}를 계산해주므로,
 * 이 파일은 그 출력을 "옵션 프리셋 + 해상도/업스케일링 조언" 문구로 번역하는 얇은 매핑 레이어다.
 */
import type { DisplayMatchRow } from "./displayMatch";
import type { GPU } from "../database/gpu";

export type PresetLabel = "최상" | "높음" | "중간" | "낮음";

export interface GraphicsPresetAdvice {
  presetLabel: PresetLabel;
  /** null이면 지금 해상도를 유지해도 된다는 뜻 */
  resolutionAdvice: string | null;
  /** null이면 업스케일링을 켤 필요(또는 지원 기술)가 없다는 뜻 */
  upscalingAdvice: string | null;
  note: string;
}

/** DLSS > XeSS > FSR 순으로 우선 추천 — DLSS가 대체로 화질 손실이 가장 적고, FSR은 브랜드 무관하게 열려있어 최후 폴백으로 둔다. */
function pickUpscalingTech(gpu: GPU): string | null {
  if (gpu.dlss) return "DLSS";
  if (gpu.xess) return "XeSS";
  if (gpu.fsr) return "FSR";
  return null;
}

export function recommendGraphicsPreset(row: DisplayMatchRow, gpu: GPU): GraphicsPresetAdvice {
  const upscaling = pickUpscalingTech(gpu);
  const rtNote = gpu.rayTracing ? " 레이트레이싱을 켜도 여유로워요." : "";

  switch (row.status) {
    case "PERFECT":
      return {
        presetLabel: "최상",
        resolutionAdvice: null,
        upscalingAdvice: null,
        note: `${row.label}: 최상 옵션으로 여유롭게 즐길 수 있어요.${rtNote}`,
      };

    case "GOOD":
      return {
        presetLabel: "높음",
        resolutionAdvice: null,
        upscalingAdvice: null,
        note: `${row.label}: 높음 옵션이 무난해요.`,
      };

    case "LACK_GPU":
      return {
        presetLabel: "중간",
        resolutionAdvice: row.vramHit ? "그래픽카드 메모리가 부족해요 — 해상도를 한 단계 낮추는 것도 방법이에요." : "옵션을 중간으로 낮추면 프레임이 안정돼요.",
        upscalingAdvice: upscaling ? `${upscaling}를 켜면 화질 손실을 줄이면서 프레임을 확보할 수 있어요.` : null,
        note: `${row.label}: 그래픽카드가 아쉬워요 — 옵션을 중간으로 낮추는 걸 권장해요.`,
      };

    case "LACK_CPU":
      return {
        presetLabel: "중간",
        resolutionAdvice: null,
        upscalingAdvice: null,
        note: `${row.label}: CPU가 병목이에요 — 그래픽 옵션을 낮춰도 프레임이 크게 오르지 않을 수 있어요. 시작프로그램·백그라운드 프로그램 정리가 더 효과적이에요.`,
      };

    case "CRITICAL":
      return {
        presetLabel: "낮음",
        resolutionAdvice: "해상도를 낮추는 걸 권장해요.",
        upscalingAdvice: upscaling ? `${upscaling}를 꼭 켜세요 — 그래도 쾌적한 프레임은 어려울 수 있어요.` : null,
        note: `${row.label}: 낮음 옵션으로도 버거울 수 있어요 — 업그레이드를 고려해보세요.`,
      };
  }
}
