"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { createSupportInquiry } from "../lib/supportInquiries";
import { SectionCard, PrimaryButton } from "../components/pcfit-ui";

interface FormErrors {
  subject?: string;
  message?: string;
}

const MIN_MESSAGE_LENGTH = 10;

export default function SupportPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="min-h-screen bg-ink px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
          <h1 className="mt-2 text-3xl font-semibold">고객센터는 로그인 후 이용 가능합니다.</h1>
          <p className="mt-3 text-sm text-white/60">로그인 후 문의를 남겨 주세요.</p>
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

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!subject.trim()) {
      nextErrors.subject = "문의 제목을 입력해 주세요.";
    }
    if (!message.trim()) {
      nextErrors.message = "문의 내용을 입력해 주세요.";
    } else if (message.trim().length < MIN_MESSAGE_LENGTH) {
      nextErrors.message = `내용은 ${MIN_MESSAGE_LENGTH}자 이상 입력해 주세요.`;
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    const { error } = await createSupportInquiry({ subject: subject.trim(), message: message.trim() });
    setIsSubmitting(false);

    if (error) {
      setToastMessage(error);
      window.setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    setSubject("");
    setMessage("");
    setToastMessage("문의가 정상적으로 접수되었습니다.");
    window.setTimeout(() => setToastMessage(null), 2500);
  }

  return (
    <main className="min-h-screen bg-ink px-6 py-12 text-white">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="px-1">
          <h1 className="text-3xl font-extrabold text-white">무엇을 도와드릴까요?</h1>
          <p className="mt-2 text-sm text-white/50">
            궁금한 점이나 불편했던 점을 남겨주시면 확인 후 답변드려요.{" "}
            <Link href="/mypage/support" className="font-semibold text-brand-soft underline underline-offset-2 hover:text-white">
              내 문의내역 보기
            </Link>
          </p>
        </header>

        <SectionCard className="flex flex-col gap-5">
          <h2 className="text-[15px] font-bold text-white">새로운 문의하기</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="subject" className="text-xs font-semibold text-white/40">
                제목
              </label>
              <input
                id="subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="예: 추천 결과 페이지가 느려요"
                className="rounded-2xl bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder:text-white/25 ring-1 ring-line outline-none transition-shadow focus:ring-2 focus:ring-brand/60"
                aria-invalid={Boolean(errors.subject)}
              />
              {errors.subject ? <p className="text-sm text-bad">{errors.subject}</p> : null}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="message" className="text-xs font-semibold text-white/40">
                내용
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="어떤 상황이었는지 편하게 적어주세요. 스크린샷 설명도 좋아요."
                rows={6}
                className="resize-none rounded-2xl bg-white/[0.04] px-4 py-3.5 text-sm text-white placeholder:text-white/25 ring-1 ring-line outline-none transition-shadow focus:ring-2 focus:ring-brand/60"
                aria-invalid={Boolean(errors.message)}
              />
              {errors.message ? <p className="text-sm text-bad">{errors.message}</p> : null}
            </div>

            <PrimaryButton full type="submit" disabled={isSubmitting}>
              {isSubmitting ? "문의 등록 중..." : "문의 보내기"}
            </PrimaryButton>
            <p className="text-center text-xs text-white/30">보통 하루 안에 답변드려요.</p>
          </form>
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
