import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import BudgetRangeSlider from "./BudgetRangeSlider";

afterEach(() => cleanup());

const formatWon = (value: number) => `${Math.round(value / 10000).toLocaleString()}만원`;

describe("BudgetRangeSlider — 키보드 조작(전 구간 10만원 단위로 통일)", () => {
  it("오른쪽 화살표를 누르면 10만원 증가한다(저예산 구간)", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_000_000} valueMax={3_000_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.keyDown(screen.getByLabelText("최소 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_100_000, max: 3_000_000 });
  });

  it("오른쪽 화살표를 누르면 10만원 증가한다(고예산 구간에서도 동일 — 구간별 step 차등 없음)", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_000_000} valueMax={7_000_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_000_000, max: 7_100_000 });
  });

  it("500만원 근방에서도 여전히 10만원 단위로만 움직인다(이전 세션의 구간 B 50만원 step 제거 확인)", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_000_000} valueMax={5_000_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_000_000, max: 5_100_000 });

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_000_000, max: 4_900_000 });
  });

  it("Home/End 키로 각각 최소/최대 끝값으로 이동한다", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={2_000_000} valueMax={4_000_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.keyDown(screen.getByLabelText("최소 예산"), { key: "Home" });
    expect(onChange).toHaveBeenCalledWith({ min: 500_000, max: 4_000_000 });

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "End" });
    expect(onChange).toHaveBeenCalledWith({ min: 2_000_000, max: 10_000_000 });
  });

  it("최소 손잡이가 최대 손잡이를 넘어서지 못하도록 최소 간격(10만원)을 유지한다", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={2_950_000} valueMax={3_000_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.keyDown(screen.getByLabelText("최소 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 2_900_000, max: 3_000_000 });
  });
});

describe("BudgetRangeSlider — 계층형 눈금 라벨", () => {
  it("100만원 단위(+양끝) 라벨만 노출하고, 10만원 단위 라벨은 노출하지 않는다", () => {
    render(<BudgetRangeSlider valueMin={1_500_000} valueMax={2_500_000} onChange={vi.fn()} formatValue={formatWon} />);

    expect(screen.getByText("50만원")).toBeTruthy();
    expect(screen.getByText("300만원")).toBeTruthy();
    expect(screen.getByText("1,000만원")).toBeTruthy();
    expect(screen.queryByText("60만원")).toBeNull();
    expect(screen.queryByText("110만원")).toBeNull();
  });
});

describe("BudgetRangeSlider — 금액 칩 직접 입력", () => {
  it("칩을 클릭하면 입력창으로 바뀌고, 만원 단위 숫자를 입력해 Enter로 확정하면 값이 반영된다", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_500_000} valueMax={2_500_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.click(screen.getByRole("button", { name: "150만원" }));
    const input = screen.getByLabelText("최소 예산 직접 입력(만원 단위)") as HTMLInputElement;
    expect(input.value).toBe("150");

    fireEvent.change(input, { target: { value: "180" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith({ min: 1_800_000, max: 2_500_000 });
  });

  it("blur로도 확정되며, 범위를 벗어난 값은 경계값으로 clamp된다", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_500_000} valueMax={2_500_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.click(screen.getByRole("button", { name: "250만원" }));
    const input = screen.getByLabelText("최대 예산 직접 입력(만원 단위)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "99999" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith({ min: 1_500_000, max: 10_000_000 });
  });

  it("10만원 단위가 아닌 값을 입력하면 반올림된다", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_500_000} valueMax={2_500_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.click(screen.getByRole("button", { name: "150만원" }));
    const input = screen.getByLabelText("최소 예산 직접 입력(만원 단위)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "156" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith({ min: 1_600_000, max: 2_500_000 });
  });

  it("문자 등 숫자로 해석할 수 없는 값을 입력하면 onChange를 호출하지 않고 이전 값을 유지한다", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_500_000} valueMax={2_500_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.click(screen.getByRole("button", { name: "150만원" }));
    const input = screen.getByLabelText("최소 예산 직접 입력(만원 단위)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "150만원" })).toBeTruthy();
  });

  it("최소값 입력이 최대값을 넘으면 최대값 기준 최소 간격으로 clamp된다", () => {
    const onChange = vi.fn();
    render(<BudgetRangeSlider valueMin={1_500_000} valueMax={2_500_000} onChange={onChange} formatValue={formatWon} />);

    fireEvent.click(screen.getByRole("button", { name: "150만원" }));
    const input = screen.getByLabelText("최소 예산 직접 입력(만원 단위)") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "500" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith({ min: 2_400_000, max: 2_500_000 });
  });
});
