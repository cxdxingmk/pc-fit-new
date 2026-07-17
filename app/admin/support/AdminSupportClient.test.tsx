import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { AdminSupportInquiry } from "@/app/lib/supportInquiries";
import AdminSupportClient from "./AdminSupportClient";

const getAllInquiriesForAdminMock = vi.fn(async () => [] as AdminSupportInquiry[] | null);
const answerSupportInquiryMock = vi.fn(async (_id: string, _reply: string) => ({ error: null as string | null }));

vi.mock("@/app/lib/supportInquiries", () => ({
  getAllInquiriesForAdmin: () => getAllInquiriesForAdminMock(),
  answerSupportInquiry: (id: string, reply: string) => answerSupportInquiryMock(id, reply),
}));

const PENDING: AdminSupportInquiry = {
  id: "inq-1",
  userId: "user-1",
  authorNickname: "홍길동",
  subject: "로그인이 안돼요",
  message: "비밀번호 재설정이 안돼요.",
  status: "pending",
  adminReply: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  answeredAt: null,
  userRead: true,
};

const ANSWERED: AdminSupportInquiry = {
  id: "inq-2",
  userId: "user-2",
  authorNickname: "김철수",
  subject: "추천 결과가 느려요",
  message: "느려요.",
  status: "answered",
  adminReply: "이미 답변했습니다.",
  createdAt: "2026-06-30T00:00:00.000Z",
  answeredAt: "2026-06-30T01:00:00.000Z",
  userRead: false,
};

describe("AdminSupportClient", () => {
  beforeEach(() => {
    getAllInquiriesForAdminMock.mockClear();
    getAllInquiriesForAdminMock.mockResolvedValue([]);
    answerSupportInquiryMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("문의가 없으면 안내 문구를 보여준다", async () => {
    render(<AdminSupportClient />);
    expect(await screen.findByText("접수된 문의가 없어요.")).toBeTruthy();
  });

  it("문의 목록을 렌더하고 답변대기/답변완료 배지를 보여준다", async () => {
    getAllInquiriesForAdminMock.mockResolvedValue([PENDING, ANSWERED]);
    render(<AdminSupportClient />);

    expect(await screen.findByText("로그인이 안돼요")).toBeTruthy();
    expect(screen.getByText("추천 결과가 느려요")).toBeTruthy();
    expect(screen.getByText("답변대기")).toBeTruthy();
    expect(screen.getByText("답변완료")).toBeTruthy();
  });

  it("문의를 선택하면 상세와 답변 입력창이 나타난다", async () => {
    getAllInquiriesForAdminMock.mockResolvedValue([PENDING]);
    render(<AdminSupportClient />);

    fireEvent.click(await screen.findByText("로그인이 안돼요"));

    expect(screen.getByText("비밀번호 재설정이 안돼요.")).toBeTruthy();
    expect(screen.getAllByText("홍길동", { exact: false }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("답변 작성")).toBeTruthy();
  });

  it("답변을 입력하고 제출하면 answerSupportInquiry를 호출하고 목록을 새로고침한다", async () => {
    getAllInquiriesForAdminMock.mockResolvedValueOnce([PENDING]);
    getAllInquiriesForAdminMock.mockResolvedValueOnce([{ ...PENDING, status: "answered", adminReply: "해결했습니다." }]);
    render(<AdminSupportClient />);

    fireEvent.click(await screen.findByText("로그인이 안돼요"));
    fireEvent.change(screen.getByLabelText("답변 작성"), { target: { value: "해결했습니다." } });
    fireEvent.click(screen.getByRole("button", { name: "답변 등록" }));

    await waitFor(() => expect(answerSupportInquiryMock).toHaveBeenCalledWith("inq-1", "해결했습니다."));
    await waitFor(() => expect(getAllInquiriesForAdminMock).toHaveBeenCalledTimes(2));
  });

  it("답변이 비어 있으면 답변 등록 버튼이 비활성화된다", async () => {
    getAllInquiriesForAdminMock.mockResolvedValue([PENDING]);
    render(<AdminSupportClient />);

    fireEvent.click(await screen.findByText("로그인이 안돼요"));

    const submitButton = screen.getByRole("button", { name: "답변 등록" }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });
});
