import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/app/lib/supabase/middleware";

// Next.js 16부터 middleware.ts/middleware가 proxy.ts/proxy로 이름이 바뀌었다 — 기능은 동일하다.
// 세션 갱신은 matcher에 걸린 "모든" 요청에서 실행되므로, 여기서 던지면(예: 환경변수 누락,
// Supabase 도달 실패) 해당 페이지 전체가 503이 된다. 세션 갱신은 "있으면 좋은" 부가 기능이지
// 페이지 렌더의 필수 전제가 아니므로, 실패해도 원문 로그를 남기고 요청은 그대로 통과시킨다
// (인증이 실제로 필요한 페이지는 각자 getServerAuthUser 결과로 판단한다).
export async function proxy(request: NextRequest) {
  try {
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  } catch (error) {
    console.error("[proxy] 세션 갱신 실패 — 요청은 그대로 통과시킵니다:", error);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
