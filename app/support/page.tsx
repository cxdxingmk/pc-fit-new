"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "../types/user";
import { getStoredUserProfile, validateUserProfile } from "../lib/userProfileStorage";

type InquiryType = "bug" | "feature" | "general";

interface SupportSubmission {
  id: string;
  type: InquiryType;
  content: string;
  createdAt: string;
  status: "queued";
  source: "support-form";
  submitterProfile: UserProfile;
  aiPipeline: {
    classification: "pending" | "completed";
    sentiment: "pending" | "positive" | "neutral" | "negative";
    keywords: string[];
    weeklyReportIncluded: boolean;
  };
}

interface FormState {
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
  bug: "🐛 프로그램 오류/스캔 실패",
  feature: "✨ 이런 기능이 생겼으면 좋겠어요",
  general: "❓ 일반 문의 및 기타 의견",
};

export default function SupportPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    type: "bug",
    content: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileValidationErrors, setProfileValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedTypeLabel = useMemo(() => INQUIRY_LABELS[form.type], [form.type]);
  const hasUsableProfile = useMemo(() => Boolean(profile) && profileValidationErrors.length === 0, [profile, profileValidationErrors]);

  useEffect(() => {
    const existingProfile = getStoredUserProfile();
    setProfile(existingProfile);
    setProfileValidationErrors(existingProfile ? validateUserProfile(existingProfile) : ["개인정보 관리 탭에 이름/휴대폰/이메일을 먼저 저장해 주세요."]);
  }, []);

  function validate(currentForm: FormState): FormErrors {
    const nextErrors: FormErrors = {};

    if (!currentForm.type) {
      nextErrors.type = "문의 종류를 선택해 주세요.";
    }

    if (!hasUsableProfile) {
      nextErrors.profile = "개인정보 관리 탭에서 유저 프로필을 먼저 저장해 주세요.";
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
      type: form.type,
      content: form.content.trim(),
      createdAt: new Date().toISOString(),
      status: "queued",
      source: "support-form",
      submitterProfile: profile as UserProfile,
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify([payload, ...existing]));

      await new Promise((resolve) => setTimeout(resolve, 700));

      setToastMessage("소중한 의견이 개발 본부에 전달되었습니다. AI 분석 후 빠르게 개선하겠습니다!");

      setTimeout(() => {
        router.push("/");
      }, 1300);
    } catch {
      setToastMessage("전송 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-r from-amber-500 to-orange-600 p-6 shadow-2xl shadow-orange-950/40">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-50/90">고객센터 이벤트</p>
          <h1 className="mt-2 text-xl font-bold leading-snug text-white sm:text-2xl">
            불편한 점을 알려주시면 AI 주치의가 고쳐드립니다! ☕ 서비스 개선 및 오류 제보가 업데이트에 반영되면 스타벅스 커피 기프티콘을 쏩니다!
          </h1>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/30 sm:p-8">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-100">🎧 고객센터 & 의견 보내기</h2>
            <p className="mt-2 text-sm text-slate-400">현재 선택된 문의 종류: {selectedTypeLabel}</p>
          </div>

          <div className="mb-5 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-slate-200">
            <p className="font-semibold text-cyan-200">개인정보 자동 연동 안내</p>
            {profile ? (
              <p className="mt-2 text-slate-300">
                {profile.name} / {profile.phone} / {profile.email}
              </p>
            ) : (
              <p className="mt-2 text-slate-300">저장된 개인정보가 없습니다. 의견 제출 전 마이페이지에서 먼저 등록해 주세요.</p>
            )}
            <Link href="/mypage/profile" className="mt-3 inline-flex rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700">
              👤 개선된 개인정보 관리 탭으로 이동
            </Link>
          </div>

          {profileValidationErrors.length > 0 ? (
            <div className="mb-5 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {profileValidationErrors.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="space-y-2">
              <label htmlFor="type" className="text-sm font-medium text-slate-200">
                문의 종류
              </label>
              <select
                id="type"
                value={form.type}
                onChange={(event) => {
                  const nextType = event.target.value as InquiryType;
                  setForm((prev) => ({ ...prev, type: nextType }));
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-orange-400"
              >
                <option value="bug">🐛 프로그램 오류/스캔 실패</option>
                <option value="feature">✨ 이런 기능이 생겼으면 좋겠어요</option>
                <option value="general">❓ 일반 문의 및 기타 의견</option>
              </select>
              {errors.type ? <p className="text-sm text-rose-300">{errors.type}</p> : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="content" className="text-sm font-medium text-slate-200">
                내용
              </label>
              <textarea
                id="content"
                value={form.content}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, content: event.target.value }));
                }}
                placeholder="컴퓨터 부품 용어를 잘 모르셔도 괜찮아요! 어떤 상황에서 불편하셨는지 편하게 적어주세요."
                rows={6}
                className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-orange-400"
                aria-invalid={Boolean(errors.content)}
              />
              {errors.content ? <p className="text-sm text-rose-300">{errors.content}</p> : null}
            </div>

            {errors.profile ? <p className="text-sm text-rose-300">{errors.profile}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting || !hasUsableProfile}
              className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-orange-500/60"
            >
              {isSubmitting ? "전송 중..." : "💌 개선 의견 제출하고 커피 응모하기"}
            </button>
          </form>
        </section>
      </div>

      {toastMessage ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-emerald-400/30 bg-slate-900/95 px-5 py-4 text-sm font-medium text-emerald-200 shadow-2xl shadow-black/60">
          {toastMessage}
        </div>
      ) : null}
    </main>
  );
}
