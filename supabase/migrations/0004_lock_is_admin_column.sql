-- PC FIT — profiles.is_admin 자기 승격(self-escalation) 차단
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new
--
-- 긴급 보안 수정: profiles_update_own 정책(0001_init.sql, using/with check: auth.uid() = id)은
-- "행" 단위로만 걸려 있고 컬럼을 구분하지 않는다 — 그래서 로그인한 유저라면 누구나 자기
-- 세션 토큰으로 아래처럼 REST를 직접 호출해 스스로 관리자가 될 수 있었다:
--   PATCH {SUPABASE_URL}/rest/v1/profiles?id=eq.<자기id>
--   Authorization: Bearer <자기 access_token>
--   { "is_admin": true }
-- 앱 UI(마이페이지)에 그런 기능이 없다는 것과 실제로 막혀 있다는 것은 전혀 다른 문제다.

-- 0003_password_change_rate_limit.sql에서 rate-limit 컬럼에 썼던 것과 정확히 같은 방식(컬럼
-- 단위 REVOKE)을 그대로 적용한다 — RLS 정책 자체는 건드리지 않아 닉네임 등 다른 컬럼의 자기
-- 행 update는 계속 허용되고, is_admin 컬럼만 authenticated 역할의 UPDATE 권한에서 걷어낸다.
-- 이후 is_admin은 RLS와 컬럼 권한을 모두 우회하는 service_role 키(서버 사이드 전용) 또는
-- Supabase 대시보드(Table Editor)에서만 바꿀 수 있다. 기존 행의 is_admin 값 자체는 이 REVOKE로
-- 전혀 바뀌지 않는다 — 오직 "앞으로 이 컬럼을 누가 바꿀 수 있는지"만 좁힌다.
revoke update (is_admin) on public.profiles from authenticated;
