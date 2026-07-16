"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { getMyInquiries, markSupportInquiryRead, type SupportInquiry } from "../../lib/supportInquiries";
import MyPageTabs from "../components/MyPageTabs";
import Container from "@/components/layout/Container";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

export default function MyPageSupportPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [inquiries, setInquiries] = useState<SupportInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    getMyInquiries().then((data) => {
      if (cancelled) return;
      setInquiries(data ?? []);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleToggle = (inquiry: SupportInquiry) => {
    const opening = expandedId !== inquiry.id;
    setExpandedId(opening ? inquiry.id : null);

    if (opening && inquiry.status === "answered" && !inquiry.userRead) {
      // 낙관적 갱신 — 서버 응답을 기다리지 않고 배지부터 없앤다(실패해도 다음 방문 시 다시 시도됨).
      setInquiries((prev) => prev.map((item) => (item.id === inquiry.id ? { ...item, userRead: true } : item)));
      markSupportInquiryRead(inquiry.id);
    }
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-ink px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
          <h1 className="mt-2 text-3xl font-semibold">내 문의내역은 로그인 후 이용 가능합니다.</h1>
          <p className="mt-3 text-sm text-white/60">로그인 후 남기신 문의와 답변을 확인할 수 있어요.</p>
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mt-6 rounded-2xl bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-soft"
          >
            로그인하러 가기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-slate-100">
      <Container className="flex flex-col gap-6">
        <MyPageTabs activeTab="support" />

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/50">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">My Support</p>
          <h1 className="mt-2 text-3xl font-semibold">내 문의내역</h1>

          {isLoading ? null : inquiries.length === 0 ? (
            <div className="mt-6 rounded-2xl bg-white/[0.02] py-10 text-center ring-1 ring-white/10">
              <p className="text-sm text-white/40">아직 남긴 문의가 없어요.</p>
            </div>
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {inquiries.map((inquiry) => {
                const isExpanded = expandedId === inquiry.id;
                const showNewBadge = inquiry.status === "answered" && !inquiry.userRead;
                return (
                  <li key={inquiry.id} className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10">
                    <button
                      type="button"
                      onClick={() => handleToggle(inquiry)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-start justify-between gap-3 p-4 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white/90">{inquiry.subject}</p>
                        <p className="mt-1 text-xs text-white/40">{formatDate(inquiry.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {showNewBadge ? (
                          <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">새 답변</span>
                        ) : null}
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            inquiry.status === "answered" ? "bg-good/10 text-good" : "bg-white/[0.06] text-white/60"
                          }`}
                        >
                          {inquiry.status === "answered" ? "답변완료" : "답변대기"}
                        </span>
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-white/10 p-4">
                        <p className="text-sm leading-6 text-white/70">{inquiry.message}</p>
                        {inquiry.status === "answered" ? (
                          <div className="mt-4 rounded-xl bg-brand/10 p-4 ring-1 ring-brand/25">
                            <p className="text-xs font-semibold text-brand-soft">관리자 답변</p>
                            <p className="mt-2 text-sm leading-6 text-white/80">{inquiry.adminReply}</p>
                            {inquiry.answeredAt ? <p className="mt-2 text-xs text-white/30">{formatDate(inquiry.answeredAt)}</p> : null}
                          </div>
                        ) : (
                          <p className="mt-4 text-xs text-white/30">아직 답변 대기 중이에요.</p>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </Container>
    </main>
  );
}
