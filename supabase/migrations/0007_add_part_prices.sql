-- PC FIT — 네이버 쇼핑 기반 부품 가격 갱신 파이프라인용 저장소
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new
--
-- 이번 단계는 "네이버 쇼핑에서 가격을 가져와 저장"까지만 — /build 추천 엔진(recommender.ts)이
-- 이 값을 실제로 읽어 쓰게 만드는 건 후속 작업이다. recommender.ts는 지금 클라이언트에서 정적
-- app/database/*.ts 배열만 읽고 서버/DB 조회가 전혀 없어서, 이 테이블을 읽게 하려면 별도의
-- 조회 계층이 필요하다.
create table public.part_prices (
  id uuid primary key default gen_random_uuid(),
  part_type text not null check (part_type in ('cpu','gpu','ram','ssd','hdd','motherboard','psu')),
  catalog_id text not null,
  price_krw integer not null,
  sample_count integer not null,
  updated_at timestamptz not null default now(),
  unique (part_type, catalog_id)
);
alter table public.part_prices enable row level security;

-- public 대상 select/insert 정책 없음 — 전부 service_role만 접근(RLS를 완전히 우회함).
-- recommender.ts 등에서 이 값을 실제로 읽어 쓰게 되면(후속 작업) 그때 알맞은 select 정책을 추가한다.

create trigger set_part_prices_updated_at before update on public.part_prices
  for each row execute function public.set_updated_at();
