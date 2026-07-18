-- PC FIT — 비밀번호 변경 무차별 대입 방지용 실패 카운터
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new

-- ── profiles.password_fail_count / password_fail_locked_until ───────────
alter table public.profiles
  add column password_fail_count smallint not null default 0,
  add column password_fail_locked_until timestamptz;

-- 이 두 컬럼은 "현재 비밀번호 5회 이상 오답 시 5분 잠금" 카운터라, 일반 유저가
-- profiles_update_own 정책(0001_init.sql, auth.uid() = id)을 통해 REST로 직접 0으로
-- 리셋하거나 잠금을 풀 수 있으면 rate limit 자체가 무의미해진다. 컬럼 단위로 UPDATE 권한을
-- 걷어내고, 아래 두 SECURITY DEFINER 함수로만 값이 바뀌게 한다(함수는 소유자 권한으로 실행돼
-- 이 REVOKE와 무관하게 동작함 — is_admin()/mark_support_inquiry_read()와 같은 원리).
revoke update (password_fail_count, password_fail_locked_until) on public.profiles from authenticated;

-- 현재 비밀번호 검증에 실패했을 때 호출한다. 이전 잠금이 이미 풀린 상태였다면(잠금 시각이
-- 과거) 카운트를 1부터 새로 시작한다 — 그렇지 않으면 잠금이 풀린 뒤에도 계속 6, 7, 8...로
-- 누적되어 단 한 번의 실패로 다시 잠기는 문제가 생긴다. row 잠금(for update)으로 동시 요청
-- 경쟁 상태를 막는다.
create or replace function public.record_password_attempt_failure()
returns table (fail_count smallint, locked_until timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count smallint;
  v_locked_until timestamptz;
begin
  select p.password_fail_count, p.password_fail_locked_until
  into v_count, v_locked_until
  from public.profiles p
  where p.id = auth.uid()
  for update;

  if v_locked_until is not null and v_locked_until <= v_now then
    v_count := 0;
    v_locked_until := null;
  end if;

  v_count := v_count + 1;
  if v_count >= 5 then
    v_locked_until := v_now + interval '5 minutes';
  end if;

  update public.profiles p
  set password_fail_count = v_count, password_fail_locked_until = v_locked_until
  where p.id = auth.uid();

  return query select v_count, v_locked_until;
end;
$$;

revoke all on function public.record_password_attempt_failure() from public;
grant execute on function public.record_password_attempt_failure() to authenticated;

-- 현재 비밀번호 검증에 성공하면(비밀번호를 실제로 바꾸든 안 바꾸든) 카운터를 리셋한다.
create or replace function public.reset_password_attempts()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set password_fail_count = 0, password_fail_locked_until = null
  where id = auth.uid();
end;
$$;

revoke all on function public.reset_password_attempts() from public;
grant execute on function public.reset_password_attempts() to authenticated;
