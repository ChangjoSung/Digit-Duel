-- 튜토리얼 REVISE(CJ 2026-10-30 승인) — 기본(basic)·심화(advanced) 카테고리 진행. **추가만** 한다: 001~006 은 이미 적용된 DB 가 있어 고치지 않는다(체크섬).
--
-- 카테고리 경계만 저장한다(단계·레슨 진행 없음). 여전히 로컬 결과의 자기신고(②) — 공식 전적·보상과 무관.
-- tutorial_basic     : NULL 미결 · 'completed' · 'skipped'. tutorial_basic_at = 처음 정해진 시각(종류와 함께만 있다).
-- tutorial_advanced  : NULL 미결 · 'completed' · 'skipped'. 시각은 tutorial_done_at(006) — 심화가 정해질 때만 함께 채운다(= 싱글 해금).
-- 이관(백필 UPDATE 없음 — 행을 고치지 않는다): 종류가 NULL 인데 tutorial_done_at 이 있으면 앱이 'exempt'(옛 v1 완료 · 새 학습 시청 증거 아님)로
--   읽는다. 006 이 완료로 둔 기존 계정과, 롤백한 옛 서버가 이후 쓴 완료가 같은 규칙으로 면제가 된다. tutorial_done_at NULL 계정은 미결 그대로.
-- 롤백: 옛 서버는 이 열을 모른다(무시). 옛 서버의 tutorial_done_at 쓰기는 아래 CHECK 를 어기지 않는다.
ALTER TABLE accounts
  ADD COLUMN tutorial_basic text CHECK (tutorial_basic IN ('completed', 'skipped')),
  ADD COLUMN tutorial_basic_at timestamptz,
  ADD COLUMN tutorial_advanced text CHECK (tutorial_advanced IN ('completed', 'skipped')),
  ADD CONSTRAINT accounts_tutorial_basic_at_chk CHECK ((tutorial_basic IS NULL) = (tutorial_basic_at IS NULL)),
  ADD CONSTRAINT accounts_tutorial_advanced_chk CHECK (tutorial_advanced IS NULL OR (tutorial_basic IS NOT NULL AND tutorial_done_at IS NOT NULL));
