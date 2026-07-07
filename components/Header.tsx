"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../app/context/AuthContext";
import { getStoredUserProfile, USER_PROFILE_STORAGE_KEY, USER_PROFILE_UPDATED_EVENT } from "../app/lib/userProfileStorage";
import type { UserProfile } from "../app/types/user";

let cachedProfileRaw: string | null = null;
let cachedProfileSnapshot: UserProfile | null = null;

function getStoredProfileSnapshot(): UserProfile | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
  if (raw === cachedProfileRaw) {
    return cachedProfileSnapshot;
  }

  cachedProfileRaw = raw;
  cachedProfileSnapshot = getStoredUserProfile();
  return cachedProfileSnapshot;
}

function getAvatarInitial(profile: UserProfile | null, fallbackName: string): string {
  if (profile?.nickname.trim()) {
    return profile.nickname.trim().slice(0, 1).toUpperCase();
  }
  if (profile?.name.trim()) {
    return profile.name.trim().slice(0, 1).toUpperCase();
  }
  return fallbackName.slice(0, 1).toUpperCase();
}

export default function Header() {
  const { user, mockLogin, logout } = useAuth();
  const router = useRouter();
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const storedProfile = useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};

      const handleStorage = (event: StorageEvent) => {
        if (event.key !== USER_PROFILE_STORAGE_KEY) return;
        onStoreChange();
      };
      const handleProfileUpdate = () => onStoreChange();

      window.addEventListener("storage", handleStorage);
      window.addEventListener(USER_PROFILE_UPDATED_EVENT, handleProfileUpdate as EventListener);
      return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(USER_PROFILE_UPDATED_EVENT, handleProfileUpdate as EventListener);
      };
    },
    () => getStoredProfileSnapshot(),
    () => null
  );

  const activeProfile: UserProfile | null = user ? storedProfile : null;
  const profileName = activeProfile?.nickname.trim() || user?.name || "";
  const profileEmail = activeProfile?.email || user?.email || "";
  const profileImage = activeProfile?.profileImageDataUrl || "";
  const profileInitial = getAvatarInitial(activeProfile, user?.name ?? "U");

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

          {isMounted && user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-cyan-400/40 bg-slate-900 text-sm font-bold text-cyan-200 transition hover:border-cyan-300 hover:text-white"
                aria-expanded={isDropdownOpen}
                aria-haspopup="menu"
                aria-label="프로필 메뉴 열기"
              >
                {profileImage ? (
                  <Image src={profileImage} alt="프로필 이미지" width={40} height={40} className="h-full w-full object-cover" unoptimized />
                ) : (
                  profileInitial
                )}
              </button>

              {isDropdownOpen ? (
                <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50">
                  <div className="border-b border-slate-800 px-4 py-4">
                    <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-200">
                      테스트 기업 유저
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-sm font-bold text-slate-100">
                        {profileImage ? (
                          <Image src={profileImage} alt="프로필 이미지" width={44} height={44} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          profileInitial
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-white">{profileName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{profileEmail}</p>
                      </div>
                    </div>
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
                        setIsDropdownOpen(false);
                        router.push("/support");
                      }}
                      className="block w-full px-4 py-2 text-left text-slate-200 transition hover:bg-slate-800"
                    >
                      🎧 고객센터
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

    </>
  );
}
