"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import MyPageTabs from "../components/MyPageTabs";
import type { UserProfile } from "../../types/user";
import { buildDefaultUserProfile, getStoredUserProfile, saveUserProfile, validateUserProfile } from "../../lib/userProfileStorage";

const EMAIL_DOMAIN_OPTIONS = [
  { label: "네이버", value: "naver.com" },
  { label: "구글", value: "gmail.com" },
  { label: "다음", value: "daum.com" },
  { label: "직접 입력", value: "custom" },
] as const;

type EmailDomainOption = (typeof EMAIL_DOMAIN_OPTIONS)[number]["value"];

function formatPhoneNumber(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.startsWith("02")) {
    if (digits.length <= 5) {
      return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    }
    if (digits.length <= 9) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function splitEmail(email: string): { id: string; domain: EmailDomainOption; customDomain: string } {
  const [idPart = "", domainPart = ""] = email.trim().split("@");
  const normalizedDomain = domainPart.toLowerCase();
  const predefined = EMAIL_DOMAIN_OPTIONS.find((option) => option.value !== "custom" && option.value === normalizedDomain);

  if (!normalizedDomain) {
    return { id: idPart, domain: "naver.com", customDomain: "naver.com" };
  }

  if (predefined) {
    return { id: idPart, domain: predefined.value, customDomain: predefined.value };
  }

  return { id: idPart, domain: "custom", customDomain: normalizedDomain };
}

function getProfileInitial(profile: UserProfile, fallbackName?: string): string {
  const source = profile.nickname.trim() || profile.name.trim() || (fallbackName ?? "").trim();
  return source ? source.slice(0, 1).toUpperCase() : "U";
}

export default function MyPageProfilePage() {
  const { user, mockLogin } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(buildDefaultUserProfile(user));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [imageError, setImageError] = useState("");
  const [emailId, setEmailId] = useState("");
  const [emailDomain, setEmailDomain] = useState<EmailDomainOption>("naver.com");
  const [customEmailDomain, setCustomEmailDomain] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const profileInitial = useMemo(() => getProfileInitial(profile, user?.name), [profile, user?.name]);

  useEffect(() => {
    if (!user) return;

    const existingProfile = getStoredUserProfile();
    if (existingProfile) {
      setProfile(existingProfile);
      const emailParts = splitEmail(existingProfile.email);
      setEmailId(emailParts.id);
      setEmailDomain(emailParts.domain);
      setCustomEmailDomain(emailParts.customDomain);
      return;
    }

    const defaultProfile = buildDefaultUserProfile(user);
    setProfile(defaultProfile);
    const emailParts = splitEmail(defaultProfile.email);
    setEmailId(emailParts.id);
    setEmailDomain(emailParts.domain);
    setCustomEmailDomain(emailParts.customDomain);
  }, [user]);

  useEffect(() => {
    const activeDomain = customEmailDomain.trim();
    const mergedEmail = emailId.trim() && activeDomain ? `${emailId.trim()}@${activeDomain}` : emailId.trim();
    setProfile((prev) => {
      if (prev.email === mergedEmail) return prev;
      return { ...prev, email: mergedEmail };
    });
  }, [emailId, emailDomain, customEmailDomain]);

  const handleEmailDomainSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const selected = event.target.value as EmailDomainOption;
    setEmailDomain(selected);

    if (selected !== "custom") {
      setCustomEmailDomain(selected);
    }
  };

  const handlePhoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(event.target.value);
    setProfile((prev) => ({ ...prev, phone: formatted }));
  };

  const handleProfileImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("이미지 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError("이미지 파일은 5MB 이하만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setProfile((prev) => ({ ...prev, profileImageDataUrl: result }));
      setImageError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = () => {
    const errors = validateUserProfile(profile);
    const domainForValidation = customEmailDomain.trim();

    if (emailDomain === "custom" && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainForValidation)) {
      errors.push("직접 입력한 이메일 도메인 형식이 올바르지 않습니다.");
    }

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
      <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Mock Auth</p>
          <h1 className="mt-2 text-3xl font-semibold">마이페이지는 로그인 후 이용 가능합니다.</h1>
          <p className="mt-3 text-sm text-slate-600">임의 로그인 후 개인정보 관리 탭에서 연락처를 등록해 주세요.</p>
          <button
            type="button"
            onClick={mockLogin}
            className="mt-6 rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            임의 로그인하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <MyPageTabs activeTab="profile" />

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Privacy Profile</p>
          <h1 className="mt-2 text-3xl font-semibold">개선된 개인정보 관리</h1>
          <p className="mt-3 text-sm text-slate-600">
            고객센터 의견 제출 시 이름/연락처/이메일을 자동 연동합니다. 문의 폼에서는 개인정보를 다시 입력할 필요가 없습니다.
          </p>

          <div className="mt-8 flex items-center gap-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-slate-300 bg-slate-100">
              {profile.profileImageDataUrl ? (
                <Image src={profile.profileImageDataUrl} alt="프로필 이미지" width={80} height={80} className="h-full w-full object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-100 text-2xl font-semibold text-slate-700">{profileInitial}</div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-800">프로필 사진</p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  사진 업로드
                </button>
                <button
                  type="button"
                  onClick={() => setProfile((prev) => ({ ...prev, profileImageDataUrl: "" }))}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400"
                >
                  사진 삭제
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProfileImageUpload} className="hidden" />
              </div>
              <p className="text-xs text-slate-500">JPG, PNG, WebP 파일을 업로드할 수 있습니다. (최대 5MB)</p>
              {imageError ? <p className="text-xs text-rose-600">{imageError}</p> : null}
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">이름</span>
              <input
                type="text"
                value={profile.name}
                onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                placeholder="예: 홍길동"
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-700">닉네임</span>
              <input
                type="text"
                value={profile.nickname}
                onChange={(event) => setProfile((prev) => ({ ...prev, nickname: event.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                placeholder="예: FIT매니저"
              />
            </label>

            <label className="block text-sm">
              <span className="font-semibold text-slate-700">휴대폰 번호</span>
              <input
                type="text"
                value={profile.phone}
                onChange={handlePhoneChange}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500"
                placeholder="예: 010-1234-5678"
                inputMode="numeric"
                maxLength={13}
              />
            </label>

            <div className="block text-sm">
              <p className="font-semibold text-slate-700">이메일</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={emailId}
                  onChange={(event) => setEmailId(event.target.value.replace(/\s/g, ""))}
                  className="h-10 min-w-[180px] flex-1 rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500"
                  placeholder="아이디"
                />
                <span className="h-10 shrink-0 px-1 leading-10 text-slate-500">@</span>
                <input
                  type="text"
                  value={customEmailDomain}
                  onChange={(event) => setCustomEmailDomain(event.target.value.replace(/\s/g, ""))}
                  disabled={emailDomain !== "custom"}
                  className={`h-10 min-w-[180px] flex-1 rounded-md border px-3 text-slate-900 outline-none transition focus:border-blue-500 ${
                    emailDomain === "custom" ? "border-slate-300 bg-white" : "border-slate-300 bg-slate-50 text-slate-500"
                  }`}
                  placeholder="도메인"
                />
                <select
                  value={emailDomain}
                  onChange={handleEmailDomainSelect}
                  className="h-10 min-w-[140px] rounded-md border border-slate-300 bg-white px-3 text-slate-900 outline-none transition focus:border-blue-500"
                >
                  <option value="naver.com">naver.com</option>
                  <option value="gmail.com">gmail.com</option>
                  <option value="daum.com">daum.com</option>
                  <option value="custom">직접 입력</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-slate-500">저장되는 이메일: {profile.email || "-"}</p>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={profile.isMarketingAgreed}
                onChange={() => setProfile((prev) => ({ ...prev, isMarketingAgreed: !prev.isMarketingAgreed }))}
                className="h-4 w-4 rounded border-slate-300"
              />
              기프티콘 이벤트/업데이트 알림 수신에 동의합니다.
            </label>
          </div>

          {validationErrors.length > 0 ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {validationErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          {savedMessage ? (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{savedMessage}</div>
          ) : null}

          <button
            type="button"
            onClick={handleSaveProfile}
            className="mt-8 w-full rounded-2xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            개인정보 저장하기
          </button>
        </section>
      </div>
    </main>
  );
}
