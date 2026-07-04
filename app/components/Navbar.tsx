"use client";

import Link from "next/link";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, mockLogin, logout } = useAuth();
  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-2xl font-bold text-blue-600"
        >
          PC FIT
        </Link>

        <nav className="flex gap-8">
          <Link href="/" className="hover:text-blue-600">
            홈
          </Link>

          <Link href="/build" className="hover:text-blue-600">
            AI 맞춤 PC 구성
          </Link>

          <Link href="/analyze" className="hover:text-blue-600">
            내 PC 분석
          </Link>

          <Link href="/mypage/register-pc" className="hover:text-blue-600">
            마이페이지
          </Link>
        </nav>

        {user ? (
          <button onClick={logout} className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700">
            로그아웃
          </button>
        ) : (
          <button onClick={mockLogin} className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            로그인
          </button>
        )}
      </div>
    </header>
  );
}