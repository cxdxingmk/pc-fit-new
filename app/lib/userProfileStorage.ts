import type { UserProfile } from "../types/user";

export const USER_PROFILE_STORAGE_KEY = "user_profile";

interface AuthLikeUser {
  name: string;
  email: string;
}

export function buildDefaultUserProfile(user: AuthLikeUser | null): UserProfile {
  return {
    name: user?.name ?? "",
    phone: "",
    email: user?.email ?? "",
    isMarketingAgreed: false,
  };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  return /^(\+?\d{1,3}[-\s]?)?(01[0-9]|\d{2,3})[-\s]?\d{3,4}[-\s]?\d{4}$/.test(phone.trim());
}

export function validateUserProfile(profile: UserProfile): string[] {
  const errors: string[] = [];

  if (!profile.name.trim()) {
    errors.push("이름을 입력해 주세요.");
  }

  if (!profile.phone.trim()) {
    errors.push("휴대폰 번호를 입력해 주세요.");
  } else if (!isValidPhone(profile.phone)) {
    errors.push("휴대폰 번호 형식이 올바르지 않습니다.");
  }

  if (!profile.email.trim()) {
    errors.push("이메일을 입력해 주세요.");
  } else if (!isValidEmail(profile.email)) {
    errors.push("이메일 형식이 올바르지 않습니다.");
  }

  return errors;
}

export function getStoredUserProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;

    if (typeof parsed.name !== "string" || typeof parsed.phone !== "string" || typeof parsed.email !== "string") {
      return null;
    }

    return {
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email,
      isMarketingAgreed: Boolean(parsed.isMarketingAgreed),
    };
  } catch {
    return null;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
