-- v0.4.16 싱글 진행 저장(#324 튜토리얼 · #322 무제한 AI) — **추가만** 한다: 001~005 는 이미 적용된 DB 가 있어 고치지 않는다(체크섬).
--
-- 진행은 브라우저 로컬 AI 경기 결과의 자기신고다(CJ 2026-10-30 — 위조 가능 수용). 서버 승패 판정·공식 전적(match_results)·재화와 무관하다.
-- tutorial_done_at : 튜토리얼 완료(정상 종료 또는 스킵) 처음 저장 시각. NULL = 미완료. 앱이 COALESCE 로 한 번만 쓴다.
-- ai_cleared_tier  : 무제한 AI 최고 클리어 단계. 0 없음 · 1 브론즈 · 2 실버 · 3 골드. 앱이 GREATEST 로만 올린다(단조).
--   v0.4.16 은 3단계만 연다 — 상위 단계는 이 CHECK 를 새 마이그레이션으로 넓힐 때까지 저장할 수 없다.
-- 이관(CJ 2026-10-30): 이 파일이 적용되는 순간 있던 계정은 튜토리얼 완료로 간주한다(AI 클리어는 없음). 이후 가입은 미완료.
ALTER TABLE accounts
  ADD COLUMN tutorial_done_at timestamptz,
  ADD COLUMN ai_cleared_tier integer NOT NULL DEFAULT 0 CHECK (ai_cleared_tier BETWEEN 0 AND 3);
UPDATE accounts SET tutorial_done_at = now();
