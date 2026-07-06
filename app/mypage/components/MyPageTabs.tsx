"use client";

import Link from "next/link";

interface MyPageTabsProps {
  activeTab: "profile" | "register" | "analysis";
}

export default function MyPageTabs({ activeTab }: MyPageTabsProps) {
  return (
    <nav className="rounded-2xl border border-white/10 bg-slate-900/70 p-2" aria-label="마이페이지 메뉴">
      <ul className="grid gap-2 sm:grid-cols-2">
        <li>
          <Link
            href="/mypage/register-pc"
            className={`block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
              activeTab === "register" ? "bg-cyan-500 text-slate-950" : "bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            💻 내 PC 등록
          </Link>
        </li>
        <li>
          <Link
            href="/mypage/analysis"
            className={`block rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
              activeTab === "analysis" ? "bg-cyan-500 text-slate-950" : "bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            📊 내 PC 분석
          </Link>
        </li>
      </ul>
    </nav>
  );
}
