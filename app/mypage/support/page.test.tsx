import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { AuthUser } from "../../context/AuthContext";
import type { SupportInquiry } from "../../lib/supportInquiries";
import MyPageSupportPage from "./page";

const routerPushMock = vi.fn();
const getMyInquiriesMock = vi.fn(async () => [] as SupportInquiry[] | null);
const markSupportInquiryReadMock = vi.fn(async (_id: string) => ({ error: null as string | null }));

let mockUser: AuthUser | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPushMock, replace: vi.fn() }),
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, isLoading: false, logout: vi.fn() }),
}));

vi.mock("../../lib/supportInquiries", () => ({
  getMyInquiries: () => getMyInquiriesMock(),
  markSupportInquiryRead: (id: string) => markSupportInquiryReadMock(id),
}));

const ANSWERED_UNREAD: SupportInquiry = {
  id: "inq-1",
  subject: "추천 결과가 느려요",
  message: "상세 내용입니다.",
  status: "answered",
  adminReply: "확인 후 개선했습니다.",
  createdAt: "2026-07-01T00:00:00.000Z",
  answeredAt: "2026-07-02T00:00:00.000Z",
  userRead: false,
};

const PENDING: SupportInquiry = {
  id: "inq-2",
  subject: "로그인이 안돼요",
  message: "비밀번호 재설정이 안돼요.",
  status: "pending",
  adminReply: null,
  createdAt: "2026-07-03T00:00:00.000Z",
  answeredAt: null,
  userRead: true,
};

describe("/mypage/support 내 문의내역", () => {
  beforeEach(() => {
    mockUser = null;
    routerPushMock.mockClear();
    getMyInquiriesMock.mockClear();
    getMyInquiriesMock.mockResolvedValue([]);
    markSupportInquiryReadMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("비로그인 상태면 로그인 유도 화면만 보여준다", () => {
    render(<MyPageSupportPage />);
    expect(screen.getByText("내 문의내역은 로그인 후 이용 가능합니다.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "로그인하러 가기" }));
    expect(routerPushMock).toHaveBeenCalledWith("/login");
  });

  it("답변완료 + 미열람 문의에는 새 답변 배지가 보인다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    getMyInquiriesMock.mockResolvedValue([ANSWERED_UNREAD, PENDING]);
    render(<MyPageSupportPage />);

    expect(await screen.findByText("새 답변")).toBeTruthy();
    expect(screen.getByText("답변대기")).toBeTruthy();
  });

  it("새 답변 배지가 있는 항목을 열면 markSupportInquiryRead를 호출하고 배지가 사라진다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    getMyInquiriesMock.mockResolvedValue([ANSWERED_UNREAD]);
    render(<MyPageSupportPage />);

    const item = await screen.findByText("추천 결과가 느려요");
    fireEvent.click(item);

    await waitFor(() => expect(markSupportInquiryReadMock).toHaveBeenCalledWith("inq-1"));
    expect(screen.queryByText("새 답변")).toBeNull();
    expect(screen.getByText("확인 후 개선했습니다.")).toBeTruthy();
  });

  it("답변대기 항목을 열어도 markSupportInquiryRead를 호출하지 않는다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    getMyInquiriesMock.mockResolvedValue([PENDING]);
    render(<MyPageSupportPage />);

    const item = await screen.findByText("로그인이 안돼요");
    fireEvent.click(item);

    expect(screen.getByText("아직 답변 대기 중이에요.")).toBeTruthy();
    expect(markSupportInquiryReadMock).not.toHaveBeenCalled();
  });

  it("문의가 없으면 안내 문구를 보여준다", async () => {
    mockUser = { id: "user-1", email: "test@example.com", name: "테스트유저", isAdmin: false };
    getMyInquiriesMock.mockResolvedValue([]);
    render(<MyPageSupportPage />);

    expect(await screen.findByText("아직 남긴 문의가 없어요.")).toBeTruthy();
  });
});
