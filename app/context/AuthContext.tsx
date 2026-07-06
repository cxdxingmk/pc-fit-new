"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  mockLogin: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const mockUser: AuthUser = {
  id: "user_01",
  name: "테스트 기업 유저",
  email: "ceo@test.com",
};

const authStorageKey = "pc_fit_auth_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(authStorageKey);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as AuthUser;
      return parsed?.id && parsed?.name && parsed?.email ? parsed : null;
    } catch {
      window.localStorage.removeItem(authStorageKey);
      return null;
    }
  });

  const mockLogin = useCallback(() => {
    setUser(mockUser);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(authStorageKey, JSON.stringify(mockUser));
    }
    router.push("/mypage/register-pc");
  }, [router]);

  const logout = useCallback(() => {
    setUser(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(authStorageKey);
    }
    router.push("/");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      mockLogin,
      logout,
    }),
    [user, mockLogin, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
