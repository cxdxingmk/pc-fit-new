"use client";

import { useEffect, useState } from "react";
import { getAllInquiriesForAdmin, answerSupportInquiry, type AdminSupportInquiry } from "@/app/lib/supportInquiries";
import Container from "@/components/layout/Container";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

export default function AdminSupportClient() {
  const [inquiries, setInquiries] = useState<AdminSupportInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const loadInquiries = () => {
    setIsLoading(true);
    getAllInquiriesForAdmin().then((data) => {
      setInquiries(data ?? []);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  const selected = inquiries.find((item) => item.id === selectedId) ?? null;

  const handleSelect = (inquiry: AdminSupportInquiry) => {
    setSelectedId(inquiry.id);
    setReply(inquiry.adminReply ?? "");
  };

  const handleSubmitReply = async () => {
    if (!selected || !reply.trim()) return;

    setIsSubmitting(true);
    const { error } = await answerSupportInquiry(selected.id, reply.trim());
    setIsSubmitting(false);

    if (error) {
      setToastMessage(error);
      window.setTimeout(() => setToastMessage(""), 2500);
      return;
    }

    setToastMessage("답변이 등록됐어요.");
    window.setTimeout(() => setToastMessage(""), 2500);
    loadInquiries();
  };

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <Container className="flex flex-col gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold">고객센터 문의 관리</h1>
        </div>

        {isLoading ? (
          <p className="text-sm text-white/40">불러오는 중...</p>
        ) : inquiries.length === 0 ? (
          <div className="rounded-2xl bg-white/[0.02] py-10 text-center ring-1 ring-white/10">
            <p className="text-sm text-white/40">접수된 문의가 없어요.</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <ul className="flex flex-col gap-2">
              {inquiries.map((inquiry) => (
                <li key={inquiry.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(inquiry)}
                    className={`flex w-full items-start justify-between gap-3 rounded-2xl p-4 text-left ring-1 transition ${
                      selectedId === inquiry.id ? "bg-brand/10 ring-brand/40" : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white/90">{inquiry.subject}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {inquiry.authorNickname} · {formatDate(inquiry.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        inquiry.status === "answered" ? "bg-good/10 text-good" : "bg-warn/10 text-warn"
                      }`}
                    >
                      {inquiry.status === "answered" ? "답변완료" : "답변대기"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <section className="rounded-2xl bg-white/[0.03] p-6 ring-1 ring-white/10">
              {!selected ? (
                <p className="text-sm text-white/40">왼쪽 목록에서 문의를 선택해 주세요.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs text-white/40">
                      {selected.authorNickname} · {formatDate(selected.createdAt)}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">{selected.subject}</h2>
                  </div>
                  <p className="rounded-xl bg-slate-950 p-4 text-sm leading-6 text-white/70 ring-1 ring-white/10">{selected.message}</p>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="admin-reply" className="text-xs font-semibold text-white/40">
                      답변 작성
                    </label>
                    <textarea
                      id="admin-reply"
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      rows={6}
                      placeholder="답변 내용을 입력해 주세요."
                      className="resize-none rounded-xl bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-white/25 ring-1 ring-white/10 outline-none transition-shadow focus:ring-2 focus:ring-brand/60"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSubmitReply}
                    disabled={isSubmitting || !reply.trim()}
                    className="inline-flex h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSubmitting ? "등록 중..." : selected.status === "answered" ? "답변 수정" : "답변 등록"}
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </Container>

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl bg-surface px-5 py-4 text-center text-sm font-medium text-brand-soft shadow-card ring-1 ring-brand/25">
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}
