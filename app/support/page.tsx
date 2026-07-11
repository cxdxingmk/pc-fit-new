"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { UserProfile } from "../types/user";
import { getStoredUserProfile } from "../lib/userProfileStorage";
import { SectionCard, PrimaryButton } from "../components/pcfit-ui";

type InquiryType = "bug" | "feature" | "general" | "account";
type InquiryStatus = "received" | "waiting" | "done" | "queued";

interface SupportSubmission {
  id: string;
  title: string;
  type: InquiryType;
  content: string;
  createdAt: string;
  status: InquiryStatus;
  source: "support-form";
  submitterProfile?: UserProfile;
  aiPipeline: {
    classification: "pending" | "completed";
    sentiment: "pending" | "positive" | "neutral" | "negative";
    keywords: string[];
    weeklyReportIncluded: boolean;
  };
}

interface FormState {
  title: string;
  type: InquiryType;
  content: string;
}

interface FormErrors {
  type?: string;
  content?: string;
  profile?: string;
}

const STORAGE_KEY = "support_feedback_queue";

const INQUIRY_LABELS: Record<InquiryType, string> = {
  bug: "오류/버그",
  feature: "기능 제안",
  general: "일반 문의",
  account: "계정/결제",
};

const FAQ_CHIPS: { question: string; type: InquiryType }[] = [
  { question: "진단 점수가 이상해요", type: "bug" },
  { question: "내 부품이 목록에 없어요", type: "feature" },
  { question: "자동 등록이 안 돼요", type: "bug" },
  { question: "추천 견적을 바꾸고 싶어요", type: "general" },
];

export default function SupportPage() {
  const [form, setForm] = useState<FormState>({
    title: "",
    type: "bug",
    content: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [submissions, setSubmissions] = useState<SupportSubmission[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const contentFieldRef = useRef<HTMLTextAreaElement | null>(null);

  const statusMeta = useMemo(
    () => ({
      received: { label: "접수 완료", className: "bg-white/[0.06] text-white/60" },
      waiting: { label: "답변 대기", className: "bg-white/[0.06] text-white/60" },
      done: { label: "답변 완료", className: "bg-good/10 text-good" },
    }),
    []
  );

  const normalizedSubmissions = useMemo(() => {
    return submissions.map((item) => {
      const normalizedStatus: Exclude<InquiryStatus, "queued"> = item.status === "queued" ? "received" : item.status;
      return { ...item, status: normalizedStatus };
    });
  }, [submissions]);

  useEffect(() => {
    setProfile(getStoredUserProfile());

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setSubmissions([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as SupportSubmission[];
      setSubmissions(parsed);
    } catch {
      setSubmissions([]);
    }
  }, []);

  function validate(currentForm: FormState): FormErrors {
    const nextErrors: FormErrors = {};

    if (!currentForm.title.trim()) {
      nextErrors.type = "문의 제목을 입력해 주세요.";
    }

    if (!currentForm.type) {
      nextErrors.type = "문의 종류를 선택해 주세요.";
    }

    if (!currentForm.content.trim()) {
      nextErrors.content = "불편했던 상황이나 의견 내용을 입력해 주세요.";
    } else if (currentForm.content.trim().length < 10) {
      nextErrors.content = "내용은 10자 이상 입력해 주세요.";
    }

    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const payload: SupportSubmission = {
      id: `support-${Date.now()}`,
      title: form.title.trim(),
      type: form.type,
      content: form.content.trim(),
      createdAt: new Date().toISOString(),
      status: "received",
      source: "support-form",
      submitterProfile: profile ?? undefined,
      aiPipeline: {
        classification: "pending",
        sentiment: "pending",
        keywords: [],
        weeklyReportIncluded: false,
      },
    };

    // TODO: 추후 AI 에이전트 API와 연동하여 유저 텍스트 실시간 감정 분석 및 키워드 자동 분류(Classification) 파이프라인 연결부

    setIsSubmitting(true);

    try {
      const existingRaw = localStorage.getItem(STORAGE_KEY);
      const existing: SupportSubmission[] = existingRaw ? (JSON.parse(existingRaw) as SupportSubmission[]) : [];
      const nextSubmissions = [payload, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSubmissions));
      setSubmissions(nextSubmissions);

      await new Promise((resolve) => setTimeout(resolve, 700));

      setToastMessage("문의가 정상적으로 접수되었습니다.");
      setForm({ title: "", type: form.type, content: "" });

      setTimeout(() => setToastMessage(null), 2000);
    } catch {
      setToastMessage("전송 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  }

  const handleFaqChipClick = (chip: (typeof FAQ_CHIPS)[number]) => {
    setForm((prev) => ({ ...prev, title: chip.question, type: chip.type }));
    contentFieldRef.current?.focus();
  };

  return (
    <main className="min-h-screen bg-ink px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="px-1">
          <h1 className="text-3xl font-extrabold text-white">무엇을 도와드릴까요?</h1>
          <p className="mt-2 text-sm text-white/50">자주 묻는 질문을 먼저 눌러보세요. 딱 맞는 답이 없으면 아래에 남겨주시면 돼요.</p>
        </header>

        {/* FAQ 칩 — 문의량의 절반은 여기서 해소 */}
        <div className="flex flex-wrap gap-2">
          {FAQ_CHIPS.map((chip) => (
            <button
              key={chip.question}
              type="button"
              onClick={() => handleFaqChipClick(chip)}
              className="rounded-full bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70 ring-1 ring-line transition-colors hover:bg-brand-dim hover:text-brand-soft hover:ring-brand/30"
            >
              {chip.question}
            </button>
          ))}
        </div>

        <SectionCard className="flex flex-col gap-5">
          <div>
            <h2 className="text-[15px] font-bold text-white">새로운 문의하기</h2>
            <p className="mt-1 text-xs text-white/40">현재 선택된 카테고리: {INQUIRY_LABELS[form.type]}</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-white/40">어떤 문의인가요?</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(INQUIRY_LABELS) as InquiryType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, type }))}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                      form.type === type ? "bg-brand text-white shadow-glow" : "bg-white/[0.04] text-white/50 ring-1 ring-line hover:text-white/80"
                    }`}
                  >
                    {INQUIRY_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="title" className="text-xs font-semibold text-white/40">
                제목
              </label>
              <input
                id="title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="예: 추천 결과 페이지가 느려요"
                className="rounded-2xl bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder:text-white/25 ring-1 ring-line outline-none transition-shadow focus:ring-2 focus:ring-brand/60"
              />
              {errors.type ? <p className="text-sm text-bad">{errors.type}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="content" className="text-xs font-semibold text-white/40">
                내용
              </label>
              <textarea
                id="content"
                ref={contentFieldRef}
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="어떤 상황이었는지 편하게 적어주세요. 스크린샷 설명도 좋아요."
                rows={6}
                className="resize-none rounded-2xl bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder:text-white/25 ring-1 ring-line outline-none transition-shadow focus:ring-2 focus:ring-brand/60"
                aria-invalid={Boolean(errors.content)}
              />
              {errors.content ? <p className="text-sm text-bad">{errors.content}</p> : null}
            </div>

            <PrimaryButton full type="submit" disabled={isSubmitting}>
              {isSubmitting ? "문의 등록 중..." : "문의 보내기"}
            </PrimaryButton>
            <p className="text-center text-xs text-white/30">보통 하루 안에 이메일로 답변드려요.</p>
          </form>
        </SectionCard>

        <SectionCard>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-white">내 문의 내역</h2>
            <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold text-white/50">총 {normalizedSubmissions.length}건</span>
          </div>

          {normalizedSubmissions.length === 0 ? (
            <div className="rounded-2xl bg-white/[0.02] py-10 text-center ring-1 ring-line">
              <p className="text-sm text-white/40">아직 남긴 문의가 없어요.</p>
              <p className="mt-1 text-xs text-white/25">궁금한 게 생기면 언제든 편하게 남겨주세요.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {normalizedSubmissions.map((item) => {
                const status = statusMeta[item.status];
                return (
                  <li key={item.id} className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-line">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white/90">{item.title || "제목 없음"}</p>
                        <p className="mt-1 text-xs text-white/40">
                          {INQUIRY_LABELS[item.type]} · {new Date(item.createdAt).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/60">{item.content}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl bg-surface px-5 py-4 text-sm font-medium text-brand-soft shadow-card ring-1 ring-brand/25">
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}
