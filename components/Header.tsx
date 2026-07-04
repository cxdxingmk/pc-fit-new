"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../app/context/AuthContext";

export default function Header() {
  const { user, mockLogin, logout } = useAuth();
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!dropdownRef.current) return;
      if (event.target instanceof Node && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
        setIsMessageModalOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/95 text-slate-100 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-xl font-bold tracking-wide text-cyan-300 transition hover:text-cyan-200">
            PC FIT
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-slate-300 md:flex">
            <Link href="/" className="transition hover:text-white">
              홈
            </Link>
            <Link href="/build" className="transition hover:text-white">
              AI 맞춤 PC 구성
            </Link>
            <Link href="/mypage/analysis" className="transition hover:text-white">
              내 PC 분석
            </Link>
          </nav>

          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-900 text-sm font-bold text-cyan-200 transition hover:border-cyan-300 hover:text-white"
                aria-expanded={isDropdownOpen}
                aria-haspopup="menu"
                aria-label="프로필 메뉴 열기"
              >
                {user.name.slice(0, 1)}
              </button>

              {isDropdownOpen ? (
                <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
                  <div className="border-b border-slate-800 px-4 py-3 text-xs text-slate-400">
                    <p className="font-semibold text-slate-200">{user.name}</p>
                    <p className="mt-1">{user.email}</p>
                  </div>

                  <div className="py-2 text-sm">
                    <Link
                      href="/mypage/profile"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-slate-200 transition hover:bg-slate-800"
                    >
                      👤 개인정보 관리
                    </Link>
                    <Link
                      href="/mypage/register-pc"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-slate-200 transition hover:bg-slate-800"
                    >
                      💻 내 PC 등록
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMessageModalOpen(true);
                        setIsDropdownOpen(false);
                      }}
                      className="block w-full px-4 py-2 text-left text-slate-200 transition hover:bg-slate-800"
                    >
                      ✉️ 쪽지함
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        router.push("/support");
                      }}
                      className="block w-full px-4 py-2 text-left text-slate-200 transition hover:bg-slate-800"
                    >
                      🎧 고객센터 & 의견 보내기
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        logout();
                      }}
                      className="block w-full px-4 py-2 text-left text-rose-300 transition hover:bg-slate-800"
                    >
                      🚪 로그아웃
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={mockLogin}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              로그인
            </button>
          )}
        </div>
      </header>

      {isMessageModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h2 className="text-lg font-semibold">쪽지함</h2>
            <p className="mt-3 text-sm text-slate-300">새로운 쪽지가 없습니다. 추후 사내 알림/상담 시스템과 연동될 예정입니다.</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsMessageModalOpen(false)}
                className="rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
