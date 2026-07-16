/**
 * 개발용 dev@pcfit.local 계정을 Supabase Admin API로 생성한다.
 * 사용법: npm run seed:dev-user (먼저 supabase/migrations/0001_init.sql이 적용돼 있어야 한다 —
 * profiles 행은 auth.users insert 트리거가 자동으로 만든다)
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const DEV_EMAIL = "dev@pcfit.local";
const DEV_NICKNAME = "개발용유저";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("프로덕션 환경에서는 개발용 계정을 생성할 수 없습니다.");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 .env.local에 필요합니다.");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    console.error("기존 사용자 조회 실패:", listError.message);
    process.exit(1);
  }

  const password = process.env.DEV_SEED_PASSWORD || "devpassword123!";
  const existingUser = existing.users.find((u) => u.email === DEV_EMAIL);

  if (existingUser) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, { password });
    if (updateError) {
      console.error("기존 개발용 계정 비밀번호 갱신 실패:", updateError.message);
      process.exit(1);
    }
    console.log(`${DEV_EMAIL} 이미 존재해 비밀번호만 최신 설정값으로 맞췄습니다.`);
    return;
  }

  const { error } = await admin.auth.admin.createUser({
    email: DEV_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { nickname: DEV_NICKNAME },
  });

  if (error) {
    console.error("개발용 계정 생성 실패:", error.message);
    process.exit(1);
  }

  console.log(`${DEV_EMAIL} 생성 완료 (password: ${password})`);
}

main();
