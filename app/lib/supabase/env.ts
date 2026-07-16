// Supabase 필수 환경변수를 한 곳에서 읽고 검증한다.
// process.env.X! (non-null 단언)로 바로 넘기면, 값이 없을 때 supabase-js 내부에서
// "Your project's URL and Key are required..."라는 애매한 에러가 나서 어떤 변수가 빠졌는지
// 로그만 봐선 알기 어렵다. 여기서 먼저 검증해 "어떤 변수가 없는지"를 명시적으로 던진다
// (특히 Vercel처럼 .env.local이 배포되지 않는 환경에서 설정 누락을 빨리 잡기 위함).
export function getSupabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (missing.length > 0) {
    throw new Error(
      `[supabase] 필수 환경변수가 없습니다: ${missing.join(", ")}. ` +
        `로컬은 .env.local, 배포는 Vercel 프로젝트 설정(Settings → Environment Variables)에 값을 넣고 재배포하세요.`
    );
  }

  return { url: url as string, anonKey: anonKey as string };
}
