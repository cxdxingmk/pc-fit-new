import { createClient } from "./server";
import type { AuthUser } from "../../context/AuthContext";

// getSession()이 아니라 getUser()를 쓴다 — getSession()은 로컬 쿠키만 읽고 재검증하지 않지만,
// getUser()는 Supabase Auth 서버에 실제로 재검증을 요청해 이 값을 신뢰하고 서버 렌더에 써도 안전하다.
//
// 이 함수는 루트 레이아웃(app/layout.tsx)에서 "모든" 페이지 렌더 때 호출된다. 여기서 던지면
// (환경변수 누락, Supabase 도달 실패 등) 전체 라우트가 500/503이 되므로, 실패 시 원문 로그를
// 남기고 "비로그인(null)"으로 안전하게 폴백한다 — 사이트는 살아있고, 원인은 로그에 남는다.
export async function getServerAuthUser(): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
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
  } catch (error) {
    console.error("[getServerAuthUser] 인증 사용자 조회 실패 — 비로그인으로 폴백합니다:", error);
    return null;
  }
}
