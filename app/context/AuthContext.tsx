"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
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

  const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", user.id).single();

  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.nickname ?? user.email?.split("@")[0] ?? "",
  };
}

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser: AuthUser | null }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [isLoading, setIsLoading] = useState(false);

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
