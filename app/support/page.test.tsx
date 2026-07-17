import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { AuthUser } from "../context/AuthContext";
import SupportPage from "./page";

const routerPushMock = vi.fn();
const createSupportInquiryMock = vi.fn(async (_input: { subject: string; message: string }) => ({ error: null as string | null }));

let mockUser: AuthUser | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn() }),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, isLoading: false, logout: vi.fn() }),
}));

vi.mock("../lib/supportInquiries", () => ({
  createSupportInquiry: (input: { subject: string; message: string }) => createSupportInquiryMock(input),
}));

describe("/support 문의 제출", () => {
  beforeEach(() => {
    mockUser = null;
    routerPushMock.mockClear();
    createSupportInquiryMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("비로그인 상태면 로그인 유도 화면만 보여준다", () => {
    render(<SupportPage />);
    expect(screen.getByText("고객센터는 로그인 후 이용 가능합니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "로그인하러 가기" }));
    expect(routerPushMock).toHaveBeenCalledWith("/login");
  });

  it("제목이 비어 있으면 제출하지 않고 에러 문구를 보여준다", () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "충분히 긴 문의 내용입니다." } });
    fireEvent.click(screen.getByRole("button", { name: "문의 보내기" }));

    expect(screen.getByText("문의 제목을 입력해 주세요.")).toBeTruthy();
    expect(createSupportInquiryMock).not.toHaveBeenCalled();
  });

  it("내용이 10자 미만이면 제출하지 않고 에러 문구를 보여준다", () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "제목입니다" } });
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "짧음" } });
    fireEvent.click(screen.getByRole("button", { name: "문의 보내기" }));

    expect(screen.getByText("내용은 10자 이상 입력해 주세요.")).toBeTruthy();
    expect(createSupportInquiryMock).not.toHaveBeenCalled();
  });

  it("유효한 입력이면 createSupportInquiry를 호출하고 성공 토스트 후 폼을 비운다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "추천 결과가 느려요" } });
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "충분히 긴 문의 내용입니다." } });
    fireEvent.click(screen.getByRole("button", { name: "문의 보내기" }));

    await waitFor(() => expect(createSupportInquiryMock).toHaveBeenCalledTimes(1));
    expect(createSupportInquiryMock).toHaveBeenCalledWith({ subject: "추천 결과가 느려요", message: "충분히 긴 문의 내용입니다." });
    expect(await screen.findByText("문의가 정상적으로 접수되었습니다.")).toBeTruthy();
    expect((screen.getByLabelText("제목") as HTMLInputElement).value).toBe("");
  });

  it("createSupportInquiry가 에러를 반환하면 실패 토스트를 보여준다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    createSupportInquiryMock.mockResolvedValueOnce({ error: "문의 등록에 실패했어요. 다시 시도해 주세요." });
    render(<SupportPage />);

    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "추천 결과가 느려요" } });
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "충분히 긴 문의 내용입니다." } });
    fireEvent.click(screen.getByRole("button", { name: "문의 보내기" }));

    expect(await screen.findByText("문의 등록에 실패했어요. 다시 시도해 주세요.")).toBeTruthy();
  });
});
