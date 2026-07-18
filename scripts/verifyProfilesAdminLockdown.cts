/**
 * profiles.is_admin 자기 승격(self-escalation) 차단 라이브 검증 스크립트
 * (0004_lock_is_admin_column.sql이 이미 적용된 실제 Supabase 프로젝트 대상).
 *
 * 서비스 롤은 테스트 유저 생성/뒷정리와 "실제 DB 값 재확인"에만 쓰고, 취약점 재현/차단 확인
 * 자체는 반드시 anon 키 + signInWithPassword로 로그인한 일반 유저 세션 토큰으로 REST를 직접
 * 호출해서 수행한다 — 서비스 롤 클라이언트나 supabase-js의 PostgREST 빌더로 확인하면 RLS/컬럼
 * 권한을 우회하므로 아무것도 증명하지 못한다.
 *
 * 사용법: npm run verify:profiles-admin-lockdown
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const RUN_ID = Date.now();
const PASSWORD = "verify1234";

let failures = 0;

function ok(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`✅ ${label}`);
    return;
  }
  failures += 1;
  console.error(`❌ ${label}`, detail ?? "");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 필요합니다.");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `verify-escalation-${RUN_ID}@pcfit.local`;
  let userId: string | undefined;

  try {
    // ── 준비: 일반(비관리자) 테스트 유저 1명 생성 ─────────────────────────
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nickname: "검증유저" },
    });
    if (createError || !created.user) throw new Error(`테스트 유저 생성 실패: ${createError?.message}`);
    userId = created.user.id;

    // ── anon 키 + 로그인으로 "실제 공격자와 동일한" 세션 토큰 확보 ────────
    const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signInData, error: signInError } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (signInError || !signInData.session) throw new Error(`로그인 실패: ${signInError?.message}`);
    const accessToken = signInData.session.access_token;

    // ── 1) 자기 세션 토큰으로 is_admin=true 직접 REST PATCH 시도 → 거부돼야 한다 ──
    const escalateRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ is_admin: true }),
    });
    const { data: afterEscalate } = await admin.from("profiles").select("is_admin").eq("id", userId).single();
    ok(
      "일반 유저가 자기 세션 토큰으로 is_admin=true PATCH를 시도하면 실제 DB에 반영되지 않는다",
      afterEscalate?.is_admin === false,
      { status: escalateRes.status, dbValue: afterEscalate?.is_admin }
    );

    // ── 2) 닉네임처럼 "정상적으로 허용돼야 하는" 컬럼 수정은 여전히 된다 ───
    const probeNickname = `qa-probe-${RUN_ID}`;
    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ nickname: probeNickname }),
    });
    const { data: afterNickname } = await admin.from("profiles").select("nickname").eq("id", userId).single();
    ok("같은 계정의 nickname 수정은 여전히 정상 동작한다(is_admin만 막혀야 한다)", afterNickname?.nickname === probeNickname, afterNickname);

    console.log(failures === 0 ? "\n모든 검증 통과." : `\n${failures}건 실패.`);
  } finally {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("검증 스크립트 실행 실패:", error);
  process.exit(1);
});
