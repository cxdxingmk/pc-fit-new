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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  const mockLogin = useCallback(() => {
    setUser(mockUser);
    router.push("/mypage/register-pc");
  }, [router]);

  const logout = useCallback(() => {
    setUser(null);
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
