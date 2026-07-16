import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // getUser()와 createServerClient() 사이에 다른 코드를 넣지 않는다 — 세션 토큰이 만료 직전이면
  // 이 호출이 갱신 쿠키를 큐에 쌓고, 그 갱신이 supabaseResponse에 실제로 반영돼야 한다.
  await supabase.auth.getUser();

  return { supabaseResponse };
}
