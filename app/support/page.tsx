"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "../types/user";
import { getStoredUserProfile } from "../lib/userProfileStorage";

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

  const selectedTypeLabel = useMemo(() => INQUIRY_LABELS[form.type], [form.type]);

  const statusMeta = useMemo(
    () => ({
      received: {
        label: "접수 완료",
        className: "bg-slate-100 text-slate-600",
      },
      waiting: {
        label: "답변 대기",
        className: "bg-slate-100 text-slate-600",
      },
      done: {
        label: "답변 완료",
        className: "bg-blue-50 text-blue-600",
      },
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-blue-600">고객센터</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">문의하기</h1>
          <p className="mt-2 text-sm text-slate-600">문의 등록과 내 문의 내역을 한 화면에서 확인할 수 있습니다.</p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">새로운 문의하기</h2>
              <p className="mt-2 text-sm text-slate-600">현재 선택된 카테고리: {selectedTypeLabel}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium text-slate-900">
                  제목
                </label>
                <input
                  id="title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="예: 추천 결과 페이지가 느려요"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
                />
                {errors.type ? <p className="text-sm text-rose-500">{errors.type}</p> : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="type" className="text-sm font-medium text-slate-900">
                  카테고리
                </label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(event) => {
                    const nextType = event.target.value as InquiryType;
                    setForm((prev) => ({ ...prev, type: nextType }));
                  }}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-600"
                >
                  <option value="bug">오류/버그</option>
                  <option value="feature">기능 제안</option>
                  <option value="general">일반 문의</option>
                  <option value="account">계정/결제</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="content" className="text-sm font-medium text-slate-900">
                  내용
                </label>
                <textarea
                  id="content"
                  value={form.content}
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, content: event.target.value }));
                  }}
                  placeholder="문제 상황, 기대 동작, 재현 방법 등을 입력해 주세요."
                  rows={7}
                  className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-600"
                  aria-invalid={Boolean(errors.content)}
                />
                {errors.content ? <p className="text-sm text-rose-500">{errors.content}</p> : null}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isSubmitting ? "문의 등록 중..." : "문의 등록"}
              </button>
              <p className="text-xs text-slate-400">문의 접수 시 개인정보 처리방침에 동의한 것으로 간주됩니다.</p>
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">내가 접수한 문의 내역</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                총 {normalizedSubmissions.length}건
              </span>
            </div>

            {normalizedSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
                <p className="text-sm text-slate-600">아직 접수한 문의가 없습니다.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {normalizedSubmissions.map((item) => {
                  const status = statusMeta[item.status];
                  return (
                    <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.title || "제목 없음"}</p>
                          <p className="mt-1 text-xs text-slate-500">{INQUIRY_LABELS[item.type]} · {new Date(item.createdAt).toLocaleString("ko-KR")}</p>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{item.content}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-blue-200 bg-white px-5 py-4 text-sm font-medium text-blue-700 shadow-xl">
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}
