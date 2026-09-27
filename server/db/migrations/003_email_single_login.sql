-- #259 CJ QA REVISE (2026-09-27) — 이메일 재설정 · 단일 로그인. **추가만** 한다: 002 는 이미 적용된 DB 가 있어 고치지 않고,
-- 기존 계정·세션·데이터를 지우지 않는다. 적용 직후 계정마다 최신 유효 세션 **하나만** 유효하다(아래 세션 정리 — 행은 남는다).
--
-- login_gen : 로그인 세대. 로그인 성공·비밀번호 재설정이 1 올린다. 세션은 발급 당시 세대를 들고, 계정 세대와 같을 때만 유효하다
--   → 마지막 로그인만 산다(커밋·스냅샷 순서와 무관 — 같은 행 UPDATE 가 행 잠금으로 직렬화된다).
-- email / email_norm : 가입 필수(기존 계정은 NULL — 로그인 뒤 한 번 등록). 중복 판정은 소문자 전체 주소(email_norm)만 쓴다.
--   제공자별 규칙(Gmail 점·+ 접기)은 적용하지 않는다 — 다른 사람의 주소를 같은 주소로 합치지 않기 위해.
-- recovery_* : 복구 코드 제도는 폐기됐다(CJ 2026-09-27). 열은 기존 데이터 보존을 위해 남기고 NOT NULL 만 푼다(새 계정은 NULL).
-- password_resets : 계정당 1행. 6자리 코드는 HMAC(프로세스 비밀 키)만, 재설정 허가(grant)는 sha256 만 저장한다. 원문은 어디에도 없다.
ALTER TABLE accounts
  ADD COLUMN login_gen integer NOT NULL DEFAULT 0,
  ADD COLUMN email text,
  ADD COLUMN email_norm text,
  ALTER COLUMN recovery_hash DROP NOT NULL,
  ALTER COLUMN recovery_expires_at DROP NOT NULL,
  ADD CONSTRAINT accounts_email_chk CHECK (
    (email IS NULL AND email_norm IS NULL)
    OR (char_length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$' AND email_norm = lower(email)));
CREATE UNIQUE INDEX accounts_email_norm_key ON accounts (email_norm);

ALTER TABLE sessions ADD COLUMN login_gen integer NOT NULL DEFAULT 0;

-- 002 는 계정당 세션 개수를 막지 않아 기기별 세션이 여럿일 수 있다. 단일 로그인으로 넘어가는 이 순간에 계정마다 **하나만** 남긴다:
-- 만료 전이고 자격 세대가 현재인 세션 중 created_at(002 의 DEFAULT now() = 그 세션을 만든 로그인·가입·재설정 문장의 시각)이 가장
-- 최신인 것. 동률이면 expires_at, 그다음 token_hash 내림차순(결정적). 만료·옛 자격 세션은 후보가 아니다.
-- 행은 지우지 않는다 — 계정 세대를 1 로 올리고 남길 세션에만 1 을 적어, 나머지는 세대 불일치로 무효가 된다(계정·비밀번호 보존).
UPDATE accounts SET login_gen = 1;
UPDATE sessions SET login_gen = 1 WHERE token_hash IN (
  SELECT DISTINCT ON (s.account_id) s.token_hash
  FROM sessions s JOIN accounts a ON a.id = s.account_id AND a.credential_gen = s.credential_gen
  WHERE s.expires_at > now()
  ORDER BY s.account_id, s.created_at DESC, s.expires_at DESC, s.token_hash DESC);

CREATE TABLE password_resets (
  account_id       bigint PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
  code_hash        text,
  code_expires_at  timestamptz,
  attempts         integer NOT NULL DEFAULT 0,
  sent_at          timestamptz NOT NULL,
  send_count       integer NOT NULL,
  window_start     timestamptz NOT NULL,
  grant_hash       text,
  grant_expires_at timestamptz,
  grant_gen        integer
);
