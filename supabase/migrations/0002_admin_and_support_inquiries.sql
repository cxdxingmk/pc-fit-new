-- PC FIT — 관리자 권한(profiles.is_admin) + 고객 문의(support_inquiries) 스키마
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new

-- ── profiles.is_admin ────────────────────────────────────────────────────
-- 관리자 지정은 이번엔 UI 없이 Supabase 대시보드(Table Editor)에서 수동으로만 진행한다.
alter table public.profiles add column is_admin boolean not null default false;

-- ── 관리자 여부 판별 헬퍼 ────────────────────────────────────────────────
-- profiles 테이블 "자기 자신"에 걸리는 정책(아래 profiles_select_admin) 안에서 profiles를
-- 직접 서브쿼리하면 "infinite recursion detected in policy" 에러가 난다 — Postgres가 같은
-- 테이블을 참조하는 정책을 정적으로 감지해 거부한다(실제 재귀 여부와 무관). security definer
-- 함수로 감싸면 내부 쿼리가 함수 소유자 권한으로 RLS를 우회해 실행되므로 이 문제를 피한다 —
-- handle_new_user()와 동일한 원리.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Postgres는 함수 생성 시 기본적으로 PUBLIC(익명 포함)에 EXECUTE를 준다 — 명시적으로 좁힌다.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- support_inquiries 관리자 목록 화면에서 .select("*, profiles(nickname)")로 "다른" 유저의
-- 닉네임을 조인해야 하므로, 관리자에게 profiles 전체 select를 허용한다.
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

-- ── support_inquiries ────────────────────────────────────────────────────
-- user_id는 auth.users(id)가 아니라 public.profiles(id)를 참조한다 — PostgREST는 public
-- 스키마 안의 FK 관계만 임베드할 수 있고 auth.users는 노출 스키마 밖이라, 관리자 목록에서
-- profiles(nickname)를 조인하려면 이 FK가 필요하다. profiles.id가 이미 1:1로
-- auth.users(id)를 참조하므로(handle_new_user 트리거) 데이터 정합성 손실은 없다.
create table public.support_inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,

  subject text not null,
  message text not null,

  status text not null default 'pending' check (status in ('pending', 'answered')),
  admin_reply text,
  answered_at timestamptz,

  -- 기본값 true: 갓 등록된 문의는 "새 답변"이 아니므로 배지가 필요 없다.
  -- 관리자가 답변하면 false로 내려가고, 유저가 열람하면 mark_support_inquiry_read()로 true로 복구된다.
  user_read boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.support_inquiries enable row level security;

create policy "support_inquiries_select_own" on public.support_inquiries
  for select using (auth.uid() = user_id);

create policy "support_inquiries_select_admin" on public.support_inquiries
  for select using (public.is_admin());

-- insert: 본인 명의 + "미답변" 상태로만 생성 가능하도록 강제한다. with check를
-- (auth.uid() = user_id) 하나로만 두면 유저가 status='answered' + admin_reply='가짜 답변' +
-- answered_at=now()로 직접 위조 insert할 수 있어 반드시 필요하다.
create policy "support_inquiries_insert_own" on public.support_inquiries
  for insert with check (
    auth.uid() = user_id
    and status = 'pending'
    and admin_reply is null
    and answered_at is null
  );

-- update: 일반 유저용 정책은 의도적으로 없음(요구사항 그대로 — 답변 작성은 관리자만).
-- user_read 반전은 아래 mark_support_inquiry_read() 함수로만 허용한다.
create policy "support_inquiries_update_admin" on public.support_inquiries
  for update using (public.is_admin()) with check (public.is_admin());

-- ── updated_at 자동 갱신 (0001_init.sql의 공유 함수 재사용) ────────────────
create trigger set_support_inquiries_updated_at
  before update on public.support_inquiries
  for each row execute function public.set_updated_at();

-- ── 본인 문의의 user_read만 true로 뒤집는 좁은 예외 ──────────────────────
-- 테이블 전체엔 유저 update 정책이 없지만, "답변을 읽었다" 표시만은 유저 본인이 할 수 있어야
-- 한다 — 이 함수 하나만 허용해 그 좁은 경우를 뺀 나머지(status/admin_reply 위조 등)는 계속 막는다.
create or replace function public.mark_support_inquiry_read(inquiry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_inquiries
  set user_read = true
  where id = inquiry_id and user_id = auth.uid();
end;
$$;

revoke all on function public.mark_support_inquiry_read(uuid) from public;
grant execute on function public.mark_support_inquiry_read(uuid) to authenticated;
