import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GameCard } from "./pcfit-ui";
import { scoreAllWorkloads, anchorCorrectedFps, anchorCorrectedMessage, getEngineCapFps } from "../lib/workloadScoring";
import { evaluateAllGames } from "../lib/displayMatch";
import { cpus } from "../database/cpu";
import { gpus } from "../database/gpu";
import type { CPU } from "../database/cpu";
import type { GPU } from "../database/gpu";

/**
 * 이전 회귀 테스트(workloadScoring.test.ts)는 GameCard가 쓰는 것과 "같은 이름의" 함수를
 * 직접 호출해 검증했다 — 하지만 GameCard.tsx가 실제로 그 함수 호출 결과를 JSX에 연결하는지는
 * 증명하지 못했다(예: row.message를 계속 쓰고 있어도 테스트는 그린이 나올 수 있었음).
 * 이 파일은 실제 렌더 출력(DOM 텍스트)에서 헤드라인과 설명의 fps 숫자를 파싱해 대조한다.
 */

const FPS_TIERS_MIRROR = [30, 45, 60, 90, 120, 144, 165, 240, 300, 360];
function nearestFpsTierMirror(fps: number): number {
  return FPS_TIERS_MIRROR.reduce((best, t) => (Math.abs(t - fps) < Math.abs(best - fps) ? t : best), FPS_TIERS_MIRROR[0]);
}

const referenceCpu: CPU = cpus.find((c) => c.id === "i9-14900k")!;
const referenceGpu: GPU = gpus.find((g) => g.id === "rtx4070-super")!;
const budgetCpu: CPU = cpus.find((c) => c.id === "r5-5600")!;
const budgetGpu: GPU = gpus.find((g) => g.id === "gtx1660super")!;

const samples: [string, CPU, GPU][] = [
  ["reference (i9-14900K + RTX 4070 SUPER)", referenceCpu, referenceGpu],
  ["budget (Ryzen 5 5600 + GTX 1660 SUPER)", budgetCpu, budgetGpu],
];

describe("GameCard render — headline vs description fps consistency (실제 DOM 텍스트 기준)", () => {
  for (const [label, cpu, gpu] of samples) {
    it(`renders LoL and Elden Ring cards with matching fps numbers — ${label}`, () => {
      const scores = scoreAllWorkloads(cpu, gpu, 16);
      const rows = evaluateAllGames(scores, "QHD", 144, gpu.vram);

      for (const gameId of ["lol", "eldenring"]) {
        const row = rows.find((r) => r.id === gameId);
        expect(row, `${gameId} row not found`).toBeDefined();
        if (!row) continue;

        const { container } = render(<GameCard row={row} />);

        const headlineEl = container.querySelector(".text-2xl");
        const descriptionEl = container.querySelector(".text-\\[13px\\]");
        expect(headlineEl, "헤드라인 요소를 찾지 못함").not.toBeNull();
        expect(descriptionEl, "설명 요소를 찾지 못함").not.toBeNull();

        const headlineText = headlineEl!.textContent ?? "";
        const descriptionText = descriptionEl!.textContent ?? "";

        const corrected = anchorCorrectedFps(row.id, row.estimatedFps);
        expect(corrected, `${gameId}: correctedFps가 null`).not.toBeNull();
        const cap = getEngineCapFps(row.id);
        const expectedMessage = anchorCorrectedMessage(row.id, row, corrected);
        expect(descriptionText, `${gameId} 설명 문구가 anchorCorrectedMessage() 결과와 다름 — render 경로가 다른 소스를 쓰고 있을 가능성`).toBe(
          expectedMessage
        );

        if (cap != null && corrected! >= cap) {
          expect(headlineText, `${gameId} 헤드라인이 엔진 캡 문구를 쓰지 않음: "${headlineText}"`).toContain(`${cap}fps`);
          expect(descriptionText, `${gameId} 설명이 엔진 캡(${cap}fps)을 언급하지 않음: "${descriptionText}"`).toContain(`${cap}fps`);
          continue;
        }

        // 헤드라인은 "low~high" 범위 표기 — correctedFps가 그 범위 안에 있어야 한다.
        const rangeMatch = headlineText.match(/(\d+)~(\d+)/);
        expect(rangeMatch, `${gameId} 헤드라인이 범위 형식이 아님: "${headlineText}"`).not.toBeNull();
        const [low, high] = [Number(rangeMatch![1]), Number(rangeMatch![2])];
        expect(corrected! >= low && corrected! <= high, `${gameId} correctedFps(${corrected})가 헤드라인 범위(${low}~${high}) 밖`).toBe(
          true
        );

        // 설명 문구의 fps 숫자 — PERFECT/GOOD은 correctedFps 그대로, 나머지는 표준 티어로 반올림.
        const descNumbers = [...descriptionText.matchAll(/(\d+)\s*fps/g)].map((m) => Number(m[1]));
        const expectedDescFps = row.status === "PERFECT" || row.status === "GOOD" ? corrected! : nearestFpsTierMirror(corrected!);
        expect(
          descNumbers,
          `${gameId} 설명 문구("${descriptionText}")의 fps 숫자가 헤드라인 범위(${low}~${high}, corrected=${corrected})와 모순됨`
        ).toContain(expectedDescFps);
      }
    });
  }
});
