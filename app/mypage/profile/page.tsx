"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import MyPageTabs from "../components/MyPageTabs";
import type { UserProfile } from "../../types/user";
import { buildDefaultUserProfile, getStoredUserProfile, saveUserProfile, validateUserProfile } from "../../lib/userProfileStorage";

export default function MyPageProfilePage() {
  const { user, mockLogin } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(buildDefaultUserProfile(user));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    if (!user) return;

    const existingProfile = getStoredUserProfile();
    if (existingProfile) {
      setProfile(existingProfile);
      return;
    }

    setProfile(buildDefaultUserProfile(user));
  }, [user]);

  const handleSaveProfile = () => {
    const errors = validateUserProfile(profile);
    setValidationErrors(errors);

    if (errors.length > 0) {
      setSavedMessage("");
      return;
    }

    saveUserProfile(profile);
    setSavedMessage("개인정보가 안전하게 저장되었습니다. 고객센터 의견 제출 시 자동 연동됩니다.");
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/10 p-8 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Mock Auth</p>
          <h1 className="mt-2 text-3xl font-semibold">마이페이지는 로그인 후 이용 가능합니다.</h1>
          <p className="mt-3 text-sm text-slate-300">임의 로그인 후 개인정보 관리 탭에서 연락처를 등록해 주세요.</p>
          <button
            type="button"
            onClick={mockLogin}
            className="mt-6 rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            임의 로그인하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <MyPageTabs activeTab="profile" />

        <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-black/50">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Privacy Profile</p>
          <h1 className="mt-2 text-3xl font-semibold">개선된 개인정보 관리</h1>
          <p className="mt-3 text-sm text-slate-300">
            고객센터 의견 제출 시 이름/연락처/이메일을 자동 연동합니다. 문의 폼에서는 개인정보를 다시 입력할 필요가 없습니다.
          </p>

          <div className="mt-8 grid gap-5">
            <label className="block text-sm">
              이름
              <input
                type="text"
                value={profile.name}
                onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100"
                placeholder="예: 홍길동"
              />
            </label>

            <label className="block text-sm">
              휴대폰 번호
              <input
                type="text"
                value={profile.phone}
                onChange={(event) => setProfile((prev) => ({ ...prev, phone: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100"
                placeholder="예: 010-1234-5678"
              />
            </label>

            <label className="block text-sm">
              이메일
              <input
                type="email"
                value={profile.email}
                onChange={(event) => setProfile((prev) => ({ ...prev, email: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100"
                placeholder="예: myname@example.com"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={profile.isMarketingAgreed}
                onChange={() => setProfile((prev) => ({ ...prev, isMarketingAgreed: !prev.isMarketingAgreed }))}
                className="h-4 w-4 rounded border-white/20"
              />
              기프티콘 이벤트/업데이트 알림 수신에 동의합니다.
            </label>
          </div>

          {validationErrors.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              {validationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          {savedMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{savedMessage}</div>
          ) : null}

          <button
            type="button"
            onClick={handleSaveProfile}
            className="mt-8 w-full rounded-2xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            개인정보 저장하기
          </button>
        </section>
      </div>
    </main>
  );
}
