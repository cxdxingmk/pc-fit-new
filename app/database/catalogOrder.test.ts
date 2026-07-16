import { describe, expect, it } from "vitest";
import { curatedCpus } from "./cpu";
import { curatedGpus } from "./gpu";

/**
 * 회귀 가드: curatedCpus/curatedGpus가 세대·티어와 무관하게 뒤섞여 있던 문제
 * (예: r5-9600x(2024)와 r5-5600x(2020)가 바로 옆에, RTX 40 SUPER/50시리즈 다음에
 * RTX 30이 왔다가 다시 RTX 40 베이스로 내려가는 등)를 재발 방지한다. 최신→과거
 * (releaseYear 내림차순)이 유지되는지만 확인한다 — 동일 연도 내 순서는 자유.
 */
function expectNonIncreasingByReleaseYear(items: { id: string; releaseYear: number }[]) {
  for (let i = 1; i < items.length; i++) {
    expect(
      items[i].releaseYear,
      `${items[i - 1].id}(${items[i - 1].releaseYear}) 다음에 ${items[i].id}(${items[i].releaseYear})가 와서 최신→과거 순서가 깨짐`
    ).toBeLessThanOrEqual(items[i - 1].releaseYear);
  }
}

describe("curatedCpus/curatedGpus 세대·티어 정렬", () => {
  it("curatedCpus는 releaseYear 내림차순이다", () => {
    expectNonIncreasingByReleaseYear(curatedCpus);
  });

  it("curatedGpus는 releaseYear 내림차순이다", () => {
    expectNonIncreasingByReleaseYear(curatedGpus);
  });
});
