"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchAuthUser(supabase: ReturnType<typeof createClient>): Promise<AuthUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("nickname, is_admin").eq("id", user.id).single();

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.nickname ?? user.email?.split("@")[0] ?? "",
    isAdmin: profile?.is_admin ?? false,
  };
}

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: AuthUser | null }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);

  // useState(initialUser)는 "최초 렌더"에만 쓰이고, 이후 부모(루트 레이아웃)가 router.refresh()로
  // 새 initialUser를 내려줘도 이미 마운트된 이 컴포넌트는 그 prop 변화를 스스로 반영하지 않는다
  // (로그인 서버 액션 → router.refresh()+push() 이후에도 헤더가 로그인 전 상태로 남던 원인).
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      setIsLoading(true);
      fetchAuthUser(supabase)
        .then(setUser)
        .finally(() => setIsLoading(false));
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
  }, [router]);

  const value = useMemo<AuthContextValue>(() => ({ user, isLoading, logout }), [user, isLoading, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
