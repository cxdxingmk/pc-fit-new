-- PC FIT — pc_specs에 HDD 필드 추가 (SSD/HDD 개별 자동 감지 지원)
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new
--
-- ssd_capacity/ssd_detail과 짝을 이루는 hdd_capacity/hdd_detail(_enabled)을 추가한다.
-- SSD와 달리 HDD는 선택 항목이라(모든 PC에 HDD가 있는 건 아님) hdd_capacity는 not null 제약을
-- 걸지 않는다 — null이 곧 "선택 안 함"이다. 기존 행은 전부 hdd_capacity=null(선택 안 함)로
-- 시작하므로 기본값 지정이 필요 없다.
alter table public.pc_specs
  add column hdd_capacity text,
  add column hdd_detail_enabled boolean not null default false,
  add column hdd_detail text;
