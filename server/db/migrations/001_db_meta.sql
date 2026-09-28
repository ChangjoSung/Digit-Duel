-- #264 — QA용 최소 스키마. 계정·로그인(#259)과 방·경기 영속화는 **여기에 없다**(별도 승인 범위).
--
-- 이 마이그레이션이 만드는 것은 "이 DB 가 무엇이고 언제 만료되는지"를 DB 안에 적어 두는 한 장의
-- 표뿐이다. #264 완료 조건이 요구하는 것이 그것이다 — 무료 Postgres 는 생성 30일 뒤 만료(+14일
-- 유예) · 관리형 백업 없음이라, 만료일이 어딘가에 적혀 있지 않으면 백업 시점을 아무도 모른다.
-- 동시에 이 표는 연결·마이그레이션·pg_dump·복원을 한 줄로 왕복 검증할 수 있는 대상이 된다.
CREATE TABLE IF NOT EXISTS db_meta (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 값은 운영자가 채운다: node db-migrate.js meta <key> <value>
INSERT INTO db_meta (key, value) VALUES
  ('purpose',              'Digit Duel limited QA (#264) - recreatable test data only'),
  ('free_tier_created_at', 'unset'),
  ('free_tier_expires_at', 'unset')
ON CONFLICT (key) DO NOTHING;
