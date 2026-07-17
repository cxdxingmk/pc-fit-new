/**
 * support_inquiries RLS 라이브 검증 스크립트 (0002_admin_and_support_inquiries.sql이 이미
 * 적용된 실제 Supabase 프로젝트 대상). 서비스 롤은 유저 3명(userA/userB/admin) 준비와 뒷정리에만
 * 쓰고, 실제 RLS 검증은 각자 signInWithPassword로 로그인한 anon 클라이언트로 수행한다
 * (서비스 롤 클라이언트는 RLS를 완전히 우회하므로 그걸로 검증하면 아무것도 증명하지 못한다).
 *
 * 사용법: npm run verify:support-rls
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

async function signInAnon(supabaseUrl: string, anonKey: string, email: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`로그인 실패(${email}): ${error.message}`);
  return client;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 필요합니다.");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emailA = `verify-usera-${RUN_ID}@pcfit.local`;
  const emailB = `verify-userb-${RUN_ID}@pcfit.local`;
  const emailAdmin = `verify-admin-${RUN_ID}@pcfit.local`;
  const createdUserIds: string[] = [];

  try {
    // ── 준비: 유저 3명 생성(userA, userB, admin) ──────────────────────────
    for (const [email, nickname] of [
      [emailA, "검증유저A"],
      [emailB, "검증유저B"],
      [emailAdmin, "검증관리자"],
    ] as const) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { nickname },
      });
      if (error || !data.user) throw new Error(`테스트 계정 생성 실패(${email}): ${error?.message}`);
      createdUserIds.push(data.user.id);
    }
    const [userAId, userBId, adminId] = createdUserIds;

    const { error: adminFlagError } = await admin.from("profiles").update({ is_admin: true }).eq("id", adminId);
    if (adminFlagError) throw new Error(`admin 플래그 설정 실패: ${adminFlagError.message}`);

    const clientA = await signInAnon(supabaseUrl, anonKey, emailA);
    const clientB = await signInAnon(supabaseUrl, anonKey, emailB);
    const clientAdmin = await signInAnon(supabaseUrl, anonKey, emailAdmin);

    // ── 1) userA insert 성공 ────────────────────────────────────────────
    const { data: inserted, error: insertError } = await clientA
      .from("support_inquiries")
      .insert({ user_id: userAId, subject: "userA 문의", message: "userA가 작성한 문의입니다." })
      .select("id")
      .single();
    ok("userA가 본인 문의를 insert할 수 있다", !insertError && Boolean(inserted?.id), insertError?.message);
    const inquiryAId = inserted?.id as string;

    const { data: insertedB } = await clientB
      .from("support_inquiries")
      .insert({ user_id: userBId, subject: "userB 문의", message: "userB가 작성한 문의입니다." })
      .select("id")
      .single();
    const inquiryBId = insertedB?.id as string;

    // ── 2) userB가 userA의 행을 select하면 빈 결과 ─────────────────────
    const { data: crossSelect } = await clientB.from("support_inquiries").select("id").eq("id", inquiryAId);
    ok("userB는 userA의 문의를 select할 수 없다(RLS)", (crossSelect?.length ?? 0) === 0, crossSelect);

    // ── 3) userA가 본인 행을 직접 update 시도 → update 정책 없음(0행) ──
    const { data: directUpdate } = await clientA
      .from("support_inquiries")
      .update({ subject: "위조 시도" })
      .eq("id", inquiryAId)
      .select("id");
    ok("일반 유저는 support_inquiries를 직접 update할 수 없다(0행)", (directUpdate?.length ?? 0) === 0, directUpdate);

    // ── 4) mark_support_inquiry_read: 남의 행이면 조용히 0행 ───────────
    await clientA.rpc("mark_support_inquiry_read", { inquiry_id: inquiryBId });
    const { data: bRowAfterForeignRead } = await admin.from("support_inquiries").select("user_read").eq("id", inquiryBId).single();
    ok("userA가 userB 행에 mark_support_inquiry_read를 호출해도 영향 없다", bRowAfterForeignRead?.user_read === true, bRowAfterForeignRead);

    // ── 5) admin이 전체 select(닉네임 임베드 포함) ──────────────────────
    const { data: adminList, error: adminListError } = await clientAdmin
      .from("support_inquiries")
      .select("id, subject, profiles(nickname)")
      .in("id", [inquiryAId, inquiryBId]);
    const adminSeesBoth = (adminList?.length ?? 0) === 2;
    ok("admin은 전체 문의를 select할 수 있다(닉네임 임베드 포함)", adminSeesBoth && !adminListError, adminListError?.message ?? adminList);
    const embeddedNickname = (adminList as unknown as { profiles: { nickname: string } | null }[] | null)?.find(
      (row) => row
    )?.profiles?.nickname;
    ok("admin select 결과에 profiles(nickname) 임베드가 채워진다", Boolean(embeddedNickname), adminList);

    // ── 6) admin이 userB 행에 답변(update) 성공 ─────────────────────────
    const answeredAt = new Date().toISOString();
    const { data: adminUpdate, error: adminUpdateError } = await clientAdmin
      .from("support_inquiries")
      .update({ status: "answered", admin_reply: "확인했습니다.", answered_at: answeredAt, user_read: false })
      .eq("id", inquiryBId)
      .select("id");
    ok("admin은 문의에 답변(update)할 수 있다", (adminUpdate?.length ?? 0) === 1 && !adminUpdateError, adminUpdateError?.message);

    // ── 7) userB(비관리자)가 같은 update 시도 → 실패(0행) ──────────────
    const { data: userBSelfUpdate } = await clientB
      .from("support_inquiries")
      .update({ admin_reply: "위조 답변" })
      .eq("id", inquiryBId)
      .select("id");
    ok("userB 본인도 관리자 없이는 답변을 update할 수 없다(0행)", (userBSelfUpdate?.length ?? 0) === 0, userBSelfUpdate);

    // ── 8) userB 재조회로 status/admin_reply/answered_at/user_read 확인 ─
    const { data: userBView } = await clientB
      .from("support_inquiries")
      .select("status, admin_reply, answered_at, user_read")
      .eq("id", inquiryBId)
      .single();
    ok(
      "userB가 재조회하면 status=answered, admin_reply/answered_at이 채워지고 user_read=false다",
      userBView?.status === "answered" && userBView?.admin_reply === "확인했습니다." && userBView?.user_read === false,
      userBView
    );

    // ── 9) userB가 mark_support_inquiry_read(본인 행) 호출 → user_read=true ─
    const { error: markReadError } = await clientB.rpc("mark_support_inquiry_read", { inquiry_id: inquiryBId });
    const { data: userBAfterRead } = await clientB.from("support_inquiries").select("user_read").eq("id", inquiryBId).single();
    ok("userB가 본인 행을 열람 처리하면 user_read가 true로 바뀐다", !markReadError && userBAfterRead?.user_read === true, markReadError?.message ?? userBAfterRead);

    console.log(failures === 0 ? "\n모든 검증 통과." : `\n${failures}건 실패.`);
  } finally {
    // ── 뒷정리 ───────────────────────────────────────────────────────
    await admin.from("support_inquiries").delete().in("user_id", createdUserIds);
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("검증 스크립트 실행 실패:", error);
  process.exit(1);
});
