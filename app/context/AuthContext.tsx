"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorageState } from "../lib/useLocalStorageState";

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

function isAuthUser(value: unknown): value is AuthUser {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      "name" in value &&
      "email" in value
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser, clearUser] = useLocalStorageState<AuthUser | null>(authStorageKey, null, isAuthUser);

  const mockLogin = useCallback(() => {
    setUser(mockUser);
    router.push("/mypage/register-pc");
  }, [router, setUser]);

  const logout = useCallback(() => {
    clearUser();
    router.push("/");
  }, [router, clearUser]);

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
