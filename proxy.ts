import type { NextRequest } from "next/server";
import { updateSession } from "@/app/lib/supabase/middleware";

// Next.js 16부터 middleware.ts/middleware가 proxy.ts/proxy로 이름이 바뀌었다 — 기능은 동일하다.
export async function proxy(request: NextRequest) {
  const { supabaseResponse } = await updateSession(request);
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
