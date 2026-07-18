import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import BudgetRangeSlider from "./BudgetRangeSlider";

afterEach(() => cleanup());

const formatWon = (value: number) => `${Math.round(value / 10000).toLocaleString()}만원`;

describe("BudgetRangeSlider — 키보드 조작", () => {
  it("구간 A(500만원 미만) 안에서 오른쪽 화살표를 누르면 10만원 단위로 증가한다", () => {
    const onChange = vi.fn();
    render(
      <BudgetRangeSlider valueMin={1_000_000} valueMax={3_000_000} onChange={onChange} formatValue={formatWon} />
    );

    fireEvent.keyDown(screen.getByLabelText("최소 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_100_000, max: 3_000_000 });
  });

  it("구간 B(500만원 초과) 안에서 오른쪽 화살표를 누르면 50만원 단위로 증가한다", () => {
    const onChange = vi.fn();
    render(
      <BudgetRangeSlider valueMin={1_000_000} valueMax={7_000_000} onChange={onChange} formatValue={formatWon} />
    );

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_000_000, max: 7_500_000 });
  });

  it("경계(500만원)에서 왼쪽 화살표를 누르면 구간 A step(10만원)만큼 감소한다", () => {
    const onChange = vi.fn();
    render(
      <BudgetRangeSlider valueMin={1_000_000} valueMax={5_000_000} onChange={onChange} formatValue={formatWon} />
    );

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_000_000, max: 4_900_000 });
  });

  it("경계(500만원)에서 오른쪽 화살표를 누르면 구간 B step(50만원)만큼 증가한다", () => {
    const onChange = vi.fn();
    render(
      <BudgetRangeSlider valueMin={1_000_000} valueMax={5_000_000} onChange={onChange} formatValue={formatWon} />
    );

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 1_000_000, max: 5_500_000 });
  });

  it("Home/End 키로 각각 최소/최대 끝값으로 이동한다", () => {
    const onChange = vi.fn();
    render(
      <BudgetRangeSlider valueMin={2_000_000} valueMax={4_000_000} onChange={onChange} formatValue={formatWon} />
    );

    fireEvent.keyDown(screen.getByLabelText("최소 예산"), { key: "Home" });
    expect(onChange).toHaveBeenCalledWith({ min: 500_000, max: 4_000_000 });

    fireEvent.keyDown(screen.getByLabelText("최대 예산"), { key: "End" });
    expect(onChange).toHaveBeenCalledWith({ min: 2_000_000, max: 10_000_000 });
  });

  it("최소 손잡이가 최대 손잡이를 넘어서지 못하도록 최소 간격(10만원)을 유지한다", () => {
    const onChange = vi.fn();
    render(
      <BudgetRangeSlider valueMin={2_950_000} valueMax={3_000_000} onChange={onChange} formatValue={formatWon} />
    );

    fireEvent.keyDown(screen.getByLabelText("최소 예산"), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith({ min: 2_900_000, max: 3_000_000 });
  });
});

describe("BudgetRangeSlider — 눈금 라벨", () => {
  it("100만원 단위(+양끝) 라벨만 노출하고, 10만원 단위 라벨은 노출하지 않는다", () => {
    render(<BudgetRangeSlider valueMin={1_500_000} valueMax={2_500_000} onChange={vi.fn()} formatValue={formatWon} />);

    expect(screen.getByText("50만원")).toBeTruthy();
    expect(screen.getByText("300만원")).toBeTruthy();
    expect(screen.getByText("1,000만원")).toBeTruthy();
    expect(screen.queryByText("60만원")).toBeNull();
    expect(screen.queryByText("110만원")).toBeNull();
  });
});
