"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import MyPageTabs from "../components/MyPageTabs";
import type { UserProfile } from "../../types/user";
import { buildDefaultUserProfile, getStoredUserProfile, saveUserProfile, validateUserProfile } from "../../lib/userProfileStorage";
import { SectionCard, PrimaryButton } from "../../components/pcfit-ui";
import DarkSelect from "../../../components/ui/DarkSelect";

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

interface SettingRow {
  label: string;
  value?: string;
  caption?: string;
  onClick?: () => void;
  danger?: boolean;
}

function SettingsList({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-white/35">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {rows.map((r, i) => (
          <button
            key={r.label}
            type="button"
            onClick={r.onClick}
            className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] ${i > 0 ? "border-t border-line" : ""}`}
          >
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${r.danger ? "text-bad" : "text-white/90"}`}>{r.label}</p>
              {r.caption && <p className="mt-0.5 text-xs text-white/35">{r.caption}</p>}
            </div>
            {r.value && <span className="max-w-[45%] truncate text-sm text-white/40">{r.value}</span>}
            <svg className="h-4 w-4 shrink-0 text-white/25" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MyPageProfilePage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(buildDefaultUserProfile(user));
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [imageError, setImageError] = useState("");
  const [emailId, setEmailId] = useState("");
  const [emailDomain, setEmailDomain] = useState<EmailDomainOption>("naver.com");
  const [customEmailDomain, setCustomEmailDomain] = useState("");
  const [isAccountEditOpen, setIsAccountEditOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2000);
  };

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

  const handleToggleMarketing = () => {
    const next = { ...profile, isMarketingAgreed: !profile.isMarketingAgreed };
    setProfile(next);
    saveUserProfile(next);
  };

  if (!user) {
    return (
      <main className="min-h-screen bg-ink px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-3xl bg-surface p-8 shadow-card ring-1 ring-line">
          <h1 className="mt-2 text-3xl font-semibold">마이페이지는 로그인 후 이용 가능합니다.</h1>
          <p className="mt-3 text-sm text-white/60">로그인 후 개인정보 관리 탭에서 연락처를 등록해 주세요.</p>
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

  return (
    <main className="min-h-screen bg-ink px-6 py-10 text-white">
      {toastMessage ? (
        <div className="fixed right-6 top-20 z-[90] rounded-xl bg-surface px-4 py-2 text-sm font-semibold text-brand-soft shadow-card ring-1 ring-brand/25">
          {toastMessage}
        </div>
      ) : null}

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <MyPageTabs activeTab="profile" />

        <div className="flex flex-col gap-8 py-4">
          {/* 프로필 헤더 — 폼이 아니라 '내 상태' 요약 */}
          <div className="flex items-center gap-4 px-1">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-dim text-xl font-bold text-brand-soft ring-1 ring-brand/20">
              {profile.profileImageDataUrl ? (
                <Image src={profile.profileImageDataUrl} alt="프로필 이미지" width={64} height={64} className="h-full w-full object-cover" unoptimized />
              ) : (
                profileInitial
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold text-white">{profile.nickname || profile.name || user.name}</p>
              <p className="truncate text-sm text-white/40">{profile.email || "이메일 미등록"}</p>
            </div>
          </div>

          <SettingsList
            title="계정"
            rows={[
              {
                label: "프로필 사진·닉네임",
                value: profile.nickname || "미설정",
                caption: "다른 화면에서 보이는 이름이에요",
                onClick: () => setIsAccountEditOpen((prev) => !prev),
              },
              { label: "휴대폰 번호", value: profile.phone || "미등록", onClick: () => setIsAccountEditOpen(true) },
              { label: "이메일", value: profile.email || "미등록", onClick: () => setIsAccountEditOpen(true) },
            ]}
          />

          {isAccountEditOpen && (
            <SectionCard className="flex flex-col gap-5 !p-6">
              <div className="flex items-center gap-5">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-brand-dim ring-1 ring-brand/20">
                  {profile.profileImageDataUrl ? (
                    <Image src={profile.profileImageDataUrl} alt="프로필 이미지" width={80} height={80} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-brand-soft">{profileInitial}</div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white/80">프로필 사진</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-xl bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/75 ring-1 ring-line transition hover:bg-white/[0.08]"
                    >
                      사진 업로드
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfile((prev) => ({ ...prev, profileImageDataUrl: "" }))}
                      className="rounded-xl bg-white/[0.05] px-3 py-2 text-sm font-semibold text-white/50 ring-1 ring-line transition hover:bg-white/[0.08]"
                    >
                      사진 삭제
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleProfileImageUpload} className="hidden" />
                  </div>
                  <p className="text-xs text-white/35">JPG, PNG, WebP 파일을 업로드할 수 있습니다. (최대 5MB)</p>
                  {imageError ? <p className="text-xs text-bad">{imageError}</p> : null}
                </div>
              </div>

              <div className="grid gap-5">
                <label className="block text-sm">
                  <span className="font-semibold text-white/70">이름</span>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(event) => setProfile((prev) => ({ ...prev, name: event.target.value }))}
                    className="mt-2 w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-white outline-none ring-1 ring-line transition focus:ring-2 focus:ring-brand"
                    placeholder="예: 홍길동"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-semibold text-white/70">닉네임</span>
                  <input
                    type="text"
                    value={profile.nickname}
                    onChange={(event) => setProfile((prev) => ({ ...prev, nickname: event.target.value }))}
                    className="mt-2 w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-white outline-none ring-1 ring-line transition focus:ring-2 focus:ring-brand"
                    placeholder="예: FIT매니저"
                  />
                </label>

                <label className="block text-sm">
                  <span className="font-semibold text-white/70">휴대폰 번호</span>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={handlePhoneChange}
                    className="mt-2 w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-white outline-none ring-1 ring-line transition focus:ring-2 focus:ring-brand"
                    placeholder="예: 010-1234-5678"
                    inputMode="numeric"
                    maxLength={13}
                  />
                </label>

                <div className="block text-sm">
                  <p className="font-semibold text-white/70">이메일</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={emailId}
                      onChange={(event) => setEmailId(event.target.value.replace(/\s/g, ""))}
                      className="h-11 min-w-[160px] flex-1 rounded-xl bg-white/[0.04] px-3 text-white outline-none ring-1 ring-line transition focus:ring-2 focus:ring-brand"
                      placeholder="아이디"
                    />
                    <span className="h-11 shrink-0 px-1 leading-11 text-white/40">@</span>
                    <input
                      type="text"
                      value={customEmailDomain}
                      onChange={(event) => setCustomEmailDomain(event.target.value.replace(/\s/g, ""))}
                      disabled={emailDomain !== "custom"}
                      className="h-11 min-w-[160px] flex-1 rounded-xl bg-white/[0.04] px-3 text-white outline-none ring-1 ring-line transition focus:ring-2 focus:ring-brand disabled:text-white/30"
                      placeholder="도메인"
                    />
                    <div className="w-36">
                      <DarkSelect value={emailDomain} onChange={handleEmailDomainSelect}>
                        <option value="naver.com">naver.com</option>
                        <option value="gmail.com">gmail.com</option>
                        <option value="daum.com">daum.com</option>
                        <option value="custom">직접 입력</option>
                      </DarkSelect>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-white/35">저장되는 이메일: {profile.email || "-"}</p>
                </div>
              </div>

              {validationErrors.length > 0 ? (
                <div className="rounded-2xl bg-bad/10 p-4 text-sm text-bad ring-1 ring-bad/25">
                  {validationErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              ) : null}

              {savedMessage ? <div className="rounded-2xl bg-good/10 p-4 text-sm text-good ring-1 ring-good/25">{savedMessage}</div> : null}

              <PrimaryButton full onClick={handleSaveProfile}>
                개인정보 저장하기
              </PrimaryButton>
            </SectionCard>
          )}

          <SettingsList
            title="알림"
            rows={[
              {
                label: "이벤트·업데이트 알림",
                value: profile.isMarketingAgreed ? "켜짐" : "꺼짐",
                caption: "새 기능이 나오면 알려드려요",
                onClick: handleToggleMarketing,
              },
            ]}
          />

          <SettingsList
            title="지원"
            rows={[
              { label: "고객센터 문의하기", caption: "궁금한 점을 남겨주시면 답변드려요", onClick: () => router.push("/support") },
              { label: "개인정보 처리방침", onClick: () => showToast("준비 중인 기능이에요.") },
              { label: "로그아웃", danger: true, onClick: logout },
            ]}
          />
        </div>
      </div>
    </main>
  );
}
