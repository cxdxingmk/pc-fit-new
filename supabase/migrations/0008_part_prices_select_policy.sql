-- PC FIT — part_prices에 읽기 전용 공개 접근 허용 (recommender.ts가 실시간 가격을 읽을 수 있도록)
-- Supabase 대시보드 SQL Editor에서 실행하세요: https://supabase.com/dashboard/project/_/sql/new
--
-- /build는 로그인 없이도 견적을 볼 수 있는 화면이라(비로그인 사용자도 recommend()를 호출한다)
-- SELECT는 공개로 연다. INSERT/UPDATE/DELETE는 여전히 service_role만 가능하다 — 0007에서
-- 의도적으로 아무 정책도 안 걸어둔 그대로이며, 이 마이그레이션은 select만 추가한다. 가격 숫자
-- 자체는 민감정보가 아니므로 공개 read가 안전하다.
create policy "part_prices_select_public" on public.part_prices for select using (true);
