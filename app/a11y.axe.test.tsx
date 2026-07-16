import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import axe from "axe-core";
import InfoTooltip from "@/components/ui/InfoTooltip";
import CascadingPartSelect from "@/components/ui/CascadingPartSelect";
import { useCascadingPartSelect } from "@/components/ui/useCascadingPartSelect";
import { cpus } from "@/app/database/cpu";
import MyPageAnalysisPage from "./mypage/analysis/page";

/**
 * E-10: role=tablist/tab/aria-selected 보강 + InfoTooltip 모바일 onClick 토글이
 * 실제로 axe-core 기준 "critical" 영향도 위반을 만들지 않는지 검증한다.
 * 이 저장소엔 Playwright 등 실브라우저 도구가 없어 jsdom 렌더 결과에 axe-core를 직접 돌린다
 * (완전한 브라우저 검증은 아니지만 ARIA role/속성 오용 같은 정적 결함은 동일하게 잡아낸다).
 */
async function expectNoCriticalViolations(container: HTMLElement) {
  const results = await axe.run(container);
  const critical = results.violations.filter((violation) => violation.impact === "critical");
  expect(critical, JSON.stringify(critical, null, 2)).toHaveLength(0);
}

function CpuCascadeHarness({ error }: { error?: string }) {
  const state = useCascadingPartSelect(cpus, (item) => item.name.split(" ")[0], undefined);
  return <CascadingPartSelect title="CPU" state={state} error={error} />;
}

describe("axe-core critical violations", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("InfoTooltip has no critical a11y violations (closed and opened via click)", async () => {
    const { container } = render(<InfoTooltip content="설명 텍스트" />);
    await expectNoCriticalViolations(container);

    fireEvent.click(screen.getByRole("button", { name: "자세한 설명" }));
    await expectNoCriticalViolations(container);
  });

  it("CascadingPartSelect has no critical a11y violations with and without an inline error", async () => {
    const { container: withoutError } = render(<CpuCascadeHarness />);
    await expectNoCriticalViolations(withoutError);

    const { container: withError } = render(<CpuCascadeHarness error="CPU를 선택해 주세요." />);
    await expectNoCriticalViolations(withError);
  });

  it("analysis page's tablist/tab/tabpanel structure has no critical a11y violations", async () => {
    vi.useFakeTimers();
    window.localStorage.setItem(
      "user_pc_spec",
      JSON.stringify({
        id: "test-pc",
        cpuId: cpus[0].id,
        gpuId: "gtx1660super",
        ramCapacity: "16GB",
        ssdCapacity: "1TB",
        monitorResolution: "QHD",
        monitorRefreshRate: 144,
      }),
    );

    const { container } = render(<MyPageAnalysisPage />);
    fireEvent.click(screen.getByRole("button", { name: /실시간 성능 체크 시작/ }));
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    vi.useRealTimers();

    expect(screen.getByRole("tablist", { name: "분석 카테고리" })).toBeTruthy();
    await expectNoCriticalViolations(container);
  });
});
