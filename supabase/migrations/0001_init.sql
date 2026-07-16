-- PC FIT — profiles + pc_specs 초기 스키마
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new

create extension if not exists pgcrypto;

-- ── profiles ─────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- insert 정책 없음 — 프로필 생성은 아래 handle_new_user 트리거가 security definer로 전담한다.

-- ── pc_specs ─────────────────────────────────────────────────────────────
create table public.pc_specs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,

  cpu_id text not null,
  gpu_id text not null,

  ram_capacity text not null,
  ram_count smallint not null default 1,
  ram_detail_enabled boolean not null default false,
  ram_detail text,

  ssd_capacity text not null,
  ssd_detail_enabled boolean not null default false,
  ssd_detail text,

  mb_brand text,
  mb_series text,
  mb_detail text,

  psu_watt text,
  has_case boolean not null default true,

  monitor_resolution text not null,
  monitor_refresh_rate integer not null,
  monitor_count smallint not null default 1,

  command_scan_raw_text text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pc_specs enable row level security;

create policy "pc_specs_select_own" on public.pc_specs
  for select using (auth.uid() = user_id);

create policy "pc_specs_insert_own" on public.pc_specs
  for insert with check (auth.uid() = user_id);

create policy "pc_specs_update_own" on public.pc_specs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "pc_specs_delete_own" on public.pc_specs
  for delete using (auth.uid() = user_id);

-- ── updated_at 자동 갱신 ──────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_pc_specs_updated_at
  before update on public.pc_specs
  for each row execute function public.set_updated_at();

-- ── 회원가입 시 profiles 행 자동 생성 ─────────────────────────────────────
-- signUp()의 options.data.nickname → auth.users.raw_user_meta_data->>'nickname'
-- security definer 필수: 이 시점엔 아직 auth.uid() 세션이 없어 RLS를 우회해야 insert가 가능하다.
-- set search_path = public: security definer 함수의 search_path 하이재킹 방지(Supabase 권장 패턴).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nickname'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
