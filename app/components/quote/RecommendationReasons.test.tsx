import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RecommendationReasonsToggle, RecommendationReasonsPanel } from "./RecommendationReasons";

afterEach(() => {
  cleanup();
});

describe("RecommendationReasonsToggle / RecommendationReasonsPanel", () => {
  it("toggle의 aria-controls가 panel의 id와 일치한다(스크린리더 연결)", () => {
    render(
      <div>
        <RecommendationReasonsToggle open={false} onToggle={vi.fn()} panelId="reasons-panel-1" />
        <RecommendationReasonsPanel reasons={["이유 1"]} open={false} panelId="reasons-panel-1" />
      </div>
    );

    const toggle = screen.getByRole("button", { name: /추천 이유/ });
    expect(toggle.getAttribute("aria-controls")).toBe("reasons-panel-1");
    expect(document.getElementById("reasons-panel-1")).not.toBeNull();
  });

  it("패널이 토글 버튼 안에 중첩되지 않는다(TOP1 줄바꿈 회귀의 원인이었던 구조) — 형제로 렌더된다", () => {
    const { container } = render(
      <div className="flex flex-nowrap items-center gap-2">
        <RecommendationReasonsToggle open={false} onToggle={vi.fn()} panelId="reasons-panel-2" />
      </div>
    );

    // 버튼 행 안에는 토글 버튼만 있어야 하고, role="region" 패널은 그 안에 없어야 한다.
    expect(container.querySelector('[role="region"]')).toBeNull();
    expect(container.querySelectorAll("button").length).toBe(1);
  });

  it("open=true면 버튼이 aria-expanded=true를 반영한다", () => {
    render(<RecommendationReasonsToggle open={true} onToggle={vi.fn()} panelId="reasons-panel-3" />);
    expect(screen.getByRole("button", { name: /추천 이유/ }).getAttribute("aria-expanded")).toBe("true");
  });

  it("reasons 배열의 각 항목을 패널에 렌더한다", () => {
    render(<RecommendationReasonsPanel reasons={["첫 번째 이유", "두 번째 이유"]} open={true} panelId="reasons-panel-4" />);
    expect(screen.getByText("첫 번째 이유")).toBeTruthy();
    expect(screen.getByText("두 번째 이유")).toBeTruthy();
  });
});
