import { createClient } from "@supabase/supabase-js";

// scripts/seedDevUser.cts 등 로컬 스크립트가 이미 쓰던 service-role 클라이언트 생성 방식을
// app/ 안에서 재사용 가능한 형태로 뽑아냈다. app/lib/supabase/server.ts(쿠키 기반 SSR 클라이언트,
// 로그인 유저 세션 전제)와 달리 이건 RLS를 완전히 우회하는 관리자 권한 클라이언트라 — 로그인
// 세션이 없는 서버-투-서버 호출(예: 봇 → /api/admin/update-prices)에서만 써야 한다.
export function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
