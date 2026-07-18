import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Supabase Auth엔 "이 비밀번호가 현재 비밀번호와 같은지"만 확인하는 API가 따로 없다 — 그 자격
 * 증명으로 signInWithPassword를 한 번 더 호출해 성공 여부로 판단하는 게 표준적인 방법이다.
 * 쿠키에 세션을 저장하는 서버 클라이언트(app/lib/supabase/server.ts)가 아니라 매번 새로 만드는
 * persistSession:false anon 클라이언트를 써서, 이 검증 호출이 현재 로그인 세션의 쿠키를
 * 건드리지 않게 한다.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<boolean> {
  const { url, anonKey } = getSupabaseEnv();
  const throwawayClient = createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await throwawayClient.auth.signInWithPassword({ email, password });
  return !error;
}
