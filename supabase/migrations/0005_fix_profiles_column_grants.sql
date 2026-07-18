-- PC FIT — profiles UPDATE 컬럼 권한 정정 (0003/0004의 컬럼 단위 REVOKE가 실제로는 무효했음)
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new
--
-- PostgreSQL 공식 문서에 명시된 동작: 컬럼 단위 권한은 테이블 단위 권한에 "추가"될 뿐,
-- 이미 있는 테이블 단위 권한을 "차감"하지 않는다. Supabase 프로젝트는 기본적으로
-- `grant all on all tables in schema public to authenticated` 같은 테이블 단위 전체 권한을
-- 이미 갖고 있어서, 0003_password_change_rate_limit.sql과 0004_lock_is_admin_column.sql이 각각
-- 시도한 `revoke update (컬럼) on public.profiles from authenticated`는 실제로는 아무 효과가
-- 없었다 — 0004 적용 후에도 verify:profiles-admin-lockdown 스크립트로 재현해 보니 일반 유저가
-- 자기 세션 토큰으로 is_admin=true PATCH를 보내면 여전히 성공했다(테이블 단위 권한이 그대로
-- 살아 있었기 때문).
--
-- 올바른 방법은 테이블 단위 UPDATE 권한 자체를 걷어낸 뒤, 유저가 정말로 스스로 바꿔도 되는
-- 컬럼(지금은 nickname 하나뿐)만 컬럼 단위로 다시 GRANT하는 것이다. is_admin,
-- password_fail_count, password_fail_locked_until은 이 재부여 목록에서 빠지므로 authenticated
-- role로는 더 이상 어떤 경로로도 바꿀 수 없다 — RLS 정책(profiles_update_own)은 그대로 두되,
-- 이제 그 전에 테이블/컬럼 권한 단계에서 먼저 막힌다. service_role은 이 권한 체계를 완전히
-- 우회하므로 서버 사이드 코드(비밀번호 rate-limit RPC 등)는 영향받지 않는다.
revoke update on public.profiles from authenticated;
grant update (nickname) on public.profiles to authenticated;
