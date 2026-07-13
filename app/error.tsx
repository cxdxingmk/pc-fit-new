"use client";

import { useEffect } from "react";

/**
 * 라우트 트리 어딘가에서 런타임 에러가 나면 Next.js가 이 컴포넌트로 대체 렌더링한다.
 * raw 에러 메시지/스택은 절대 화면에 노출하지 않는다 — 콘솔에만 남긴다.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error.tsx] 처리되지 않은 에러", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-ink px-6 text-center text-white">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-xl font-bold">일시적인 문제가 생겼어요</h1>
      <p className="max-w-sm text-sm text-white/60">불편을 드려 죄송해요. 아래 버튼으로 다시 시도해 주세요.</p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          다시 시도
        </button>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="rounded-2xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
        >
          홈으로
        </button>
      </div>
    </main>
  );
}
