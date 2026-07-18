import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import PasswordChangeForm from "./PasswordChangeForm";
import type { ChangePasswordState } from "./actions";

const changePasswordMock = vi.fn<(prevState: ChangePasswordState, formData: FormData) => Promise<ChangePasswordState>>(
  async () => undefined
);

vi.mock("./actions", () => ({
  changePassword: (prevState: ChangePasswordState, formData: FormData) => changePasswordMock(prevState, formData),
}));

afterEach(() => {
  cleanup();
  changePasswordMock.mockClear();
});

function getField(placeholder: string) {
  return screen.getByPlaceholderText(placeholder) as HTMLInputElement;
}

describe("PasswordChangeForm — 기본 검증", () => {
  it("현재 비밀번호가 비어 있거나 새 비밀번호 규칙 미충족이면 제출 버튼이 비활성화된다", () => {
    render(<PasswordChangeForm />);
    const submit = screen.getByRole("button", { name: "비밀번호 변경" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(getField("현재 비밀번호를 입력하세요"), { target: { value: "oldPass1" } });
    fireEvent.change(getField("8자 이상, 영문+숫자 포함"), { target: { value: "short" } });
    fireEvent.change(getField("새 비밀번호를 한 번 더 입력하세요"), { target: { value: "short" } });
    expect(submit.disabled).toBe(true);
  });

  it("새 비밀번호와 확인이 일치하면 제출 버튼이 활성화된다", () => {
    render(<PasswordChangeForm />);
    fireEvent.change(getField("현재 비밀번호를 입력하세요"), { target: { value: "oldPass1" } });
    fireEvent.change(getField("8자 이상, 영문+숫자 포함"), { target: { value: "newPass1" } });
    fireEvent.change(getField("새 비밀번호를 한 번 더 입력하세요"), { target: { value: "newPass1" } });

    const submit = screen.getByRole("button", { name: "비밀번호 변경" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(false);
  });

  it("새 비밀번호와 확인이 다르면 불일치 문구가 뜨고 제출이 비활성화된다", () => {
    render(<PasswordChangeForm />);
    fireEvent.change(getField("현재 비밀번호를 입력하세요"), { target: { value: "oldPass1" } });
    fireEvent.change(getField("8자 이상, 영문+숫자 포함"), { target: { value: "newPass1" } });
    fireEvent.change(getField("새 비밀번호를 한 번 더 입력하세요"), { target: { value: "different1" } });

    expect(screen.getByText("비밀번호가 일치하지 않아요.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "비밀번호 변경" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("PasswordChangeForm — 강도 표시", () => {
  it("새 비밀번호 입력 중 강도 라벨이 실시간으로 표시된다", () => {
    render(<PasswordChangeForm />);
    const newPasswordField = getField("8자 이상, 영문+숫자 포함");

    fireEvent.change(newPasswordField, { target: { value: "abcdefg1" } });
    expect(screen.getByText("비밀번호 강도: 약함")).toBeTruthy();

    fireEvent.change(newPasswordField, { target: { value: "Abcdefghijkl12!" } });
    expect(screen.getByText("비밀번호 강도: 강함")).toBeTruthy();
  });

  it("새 비밀번호 칸이 비어 있으면 강도 표시를 하지 않는다", () => {
    render(<PasswordChangeForm />);
    expect(screen.queryByText(/비밀번호 강도/)).toBeNull();
  });
});

describe("PasswordChangeForm — 규칙 위반 안내", () => {
  it("blur 전에는 규칙 힌트만 보이고, blur 후 규칙 위반 시 에러 문구로 바뀐다", () => {
    render(<PasswordChangeForm />);
    const newPasswordField = getField("8자 이상, 영문+숫자 포함");

    fireEvent.change(newPasswordField, { target: { value: "short" } });
    expect(screen.getByText("영문, 숫자 포함 8자 이상")).toBeTruthy();

    fireEvent.blur(newPasswordField);
    expect(screen.getByText("영문과 숫자를 포함해 8자 이상 입력해 주세요.")).toBeTruthy();
  });
});

describe("PasswordChangeForm — 성공 화면", () => {
  it("변경에 성공하면 완료 화면을 보여주고 onSuccess를 호출하며, 닫기를 누르면 onDismiss를 호출한다", async () => {
    changePasswordMock.mockResolvedValue({ success: true });
    const onSuccess = vi.fn();
    const onDismiss = vi.fn();

    render(<PasswordChangeForm onSuccess={onSuccess} onDismiss={onDismiss} />);
    fireEvent.change(getField("현재 비밀번호를 입력하세요"), { target: { value: "oldPass1" } });
    fireEvent.change(getField("8자 이상, 영문+숫자 포함"), { target: { value: "newPass1" } });
    fireEvent.change(getField("새 비밀번호를 한 번 더 입력하세요"), { target: { value: "newPass1" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));

    const successHeading = await screen.findByText("비밀번호 변경 완료");
    expect(successHeading).toBeTruthy();
    expect(onSuccess).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("실패하면 에러 메시지를 표시한다", async () => {
    changePasswordMock.mockResolvedValue({ error: "현재 비밀번호가 올바르지 않아요." });

    render(<PasswordChangeForm />);
    fireEvent.change(getField("현재 비밀번호를 입력하세요"), { target: { value: "wrongPass1" } });
    fireEvent.change(getField("8자 이상, 영문+숫자 포함"), { target: { value: "newPass1" } });
    fireEvent.change(getField("새 비밀번호를 한 번 더 입력하세요"), { target: { value: "newPass1" } });
    fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("현재 비밀번호가 올바르지 않아요.")).toBeTruthy();
  });
});
