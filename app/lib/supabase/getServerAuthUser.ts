import { createClient } from "./server";
import type { AuthUser } from "../../context/AuthContext";

// getSession()이 아니라 getUser()를 쓴다 — getSession()은 로컬 쿠키만 읽고 재검증하지 않지만,
// getUser()는 Supabase Auth 서버에 실제로 재검증을 요청해 이 값을 신뢰하고 서버 렌더에 써도 안전하다.
export async function getServerAuthUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
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
