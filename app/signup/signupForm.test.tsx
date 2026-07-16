import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import SignupPage from "./page";

// 서버 액션(actions.ts는 "use server" + supabase/next-headers 의존)은 jsdom에서 실행할 수 없으므로 목으로 대체.
vi.mock("./actions", () => ({
  signup: vi.fn(async () => undefined),
}));

const PW = "abcd1234";

function getPasswordField() {
  return screen.getByPlaceholderText("8자 이상 입력하세요") as HTMLInputElement;
}
function getConfirmField() {
  return screen.getByPlaceholderText("비밀번호를 한 번 더 입력하세요") as HTMLInputElement;
}
function getSubmit() {
  return screen.getByRole("button", { name: "회원가입" }) as HTMLButtonElement;
}
function getAgreeCheckbox() {
  return screen.getByRole("checkbox") as HTMLInputElement;
}

describe("회원가입 폼 UX", () => {
  afterEach(() => cleanup());

  it("(1) 눈 아이콘을 누르면 비밀번호가 평문(text)으로, 다시 누르면 다시 숨김(password)으로 토글된다", () => {
    render(<SignupPage />);
    const passwordField = getPasswordField();
    expect(passwordField.type).toBe("password");

    // 비밀번호 칸의 눈 버튼만 스코프해서 클릭(확인 칸에도 같은 버튼이 있으므로 within으로 한정)
    const passwordGroup = passwordField.closest("div")!.parentElement as HTMLElement;
    const toggle = within(passwordGroup).getByRole("button", { name: "비밀번호 보기" });
    fireEvent.click(toggle);
    expect(passwordField.type).toBe("text");
    expect(within(passwordGroup).getByRole("button", { name: "비밀번호 숨기기" })).toBeTruthy();

    fireEvent.click(within(passwordGroup).getByRole("button", { name: "비밀번호 숨기기" }));
    expect(passwordField.type).toBe("password");
  });

  it("(2) 확인 칸에 일치하는 값을 입력하고 약관에 동의하면 '비밀번호가 일치해요'가 뜨고 제출이 활성화된다", () => {
    render(<SignupPage />);
    fireEvent.change(getPasswordField(), { target: { value: PW } });
    fireEvent.change(getConfirmField(), { target: { value: PW } });
    fireEvent.click(getAgreeCheckbox());

    expect(screen.getByText("비밀번호가 일치해요")).toBeTruthy();
    expect(getSubmit().disabled).toBe(false);
  });

  it("(3) 확인 칸에 불일치 값을 입력하면 '비밀번호가 일치하지 않아요'가 뜨고 제출이 비활성화된다", () => {
    render(<SignupPage />);
    fireEvent.change(getPasswordField(), { target: { value: PW } });
    fireEvent.change(getConfirmField(), { target: { value: "different1" } });

    expect(screen.getByText("비밀번호가 일치하지 않아요.")).toBeTruthy();
    expect(getSubmit().disabled).toBe(true);
  });

  it("확인 칸이 비어 있으면 일치/불일치 문구를 아예 표시하지 않는다", () => {
    render(<SignupPage />);
    fireEvent.change(getPasswordField(), { target: { value: PW } });

    expect(screen.queryByText("비밀번호가 일치해요")).toBeNull();
    expect(screen.queryByText("비밀번호가 일치하지 않아요.")).toBeNull();
  });

  it("규칙 안내('영문, 숫자 포함 8자 이상')가 항상 보이고, 규칙 위반 시 blur 후 인라인 에러로 바뀐다", () => {
    render(<SignupPage />);
    expect(screen.getByText("영문, 숫자 포함 8자 이상")).toBeTruthy();

    const passwordField = getPasswordField();
    fireEvent.change(passwordField, { target: { value: "abcdefgh" } }); // 숫자 없음
    fireEvent.blur(passwordField);

    expect(screen.getByText("영문과 숫자를 포함해 8자 이상 입력해 주세요.")).toBeTruthy();
  });

  it("두 비밀번호 칸은 autoComplete='new-password'라 비밀번호 관리자 오토필 오작동(확인 칸에 다른 값 채워짐)을 막는다", () => {
    render(<SignupPage />);
    expect(getPasswordField().getAttribute("autocomplete")).toBe("new-password");
    expect(getConfirmField().getAttribute("autocomplete")).toBe("new-password");
  });
});

describe("회원가입 약관 동의", () => {
  afterEach(() => cleanup());

  function fillValidPasswords() {
    fireEvent.change(getPasswordField(), { target: { value: PW } });
    fireEvent.change(getConfirmField(), { target: { value: PW } });
  }

  it("체크박스가 있고 기본은 비동의(unchecked) 상태다", () => {
    render(<SignupPage />);
    expect(getAgreeCheckbox().checked).toBe(false);
  });

  it("개인정보처리방침/이용약관 링크가 각각 /privacy, /terms로 연결된다", () => {
    render(<SignupPage />);
    expect(screen.getByRole("link", { name: "개인정보 수집·이용" }).getAttribute("href")).toBe("/privacy");
    expect(screen.getByRole("link", { name: "이용약관" }).getAttribute("href")).toBe("/terms");
  });

  it("비밀번호가 일치해도 약관에 동의하지 않으면 제출 버튼이 비활성화된다", () => {
    render(<SignupPage />);
    fillValidPasswords();

    expect(getAgreeCheckbox().checked).toBe(false);
    expect(getSubmit().disabled).toBe(true);
  });

  it("체크박스를 누르면 제출이 활성화되고, 다시 누르면 비활성화된다", () => {
    render(<SignupPage />);
    fillValidPasswords();

    fireEvent.click(getAgreeCheckbox());
    expect(getSubmit().disabled).toBe(false);

    fireEvent.click(getAgreeCheckbox());
    expect(getSubmit().disabled).toBe(true);
  });

  it("문구 안 링크를 클릭해도 label의 기본 토글 전파 때문에 체크 상태가 원치 않게 바뀌지 않는다", () => {
    // <label htmlFor>로 감싼 텍스트 안에 <Link>가 있으면, 링크 클릭 시 브라우저가 그 클릭을
    // label에 연결된 체크박스 토글로도 전달한다 — onClick의 stopPropagation으로 막았는지 검증.
    render(<SignupPage />);
    expect(getAgreeCheckbox().checked).toBe(false);

    fireEvent.click(screen.getByRole("link", { name: "개인정보 수집·이용" }));
    expect(getAgreeCheckbox().checked).toBe(false); // 클릭 전과 동일 — 링크 클릭이 체크박스에 영향 없어야 함

    fireEvent.click(getAgreeCheckbox());
    expect(getAgreeCheckbox().checked).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "이용약관" }));
    expect(getAgreeCheckbox().checked).toBe(true); // 이미 체크된 상태도 링크 클릭으로 풀리면 안 됨
  });
});
