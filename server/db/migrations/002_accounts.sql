-- #259 — 아이디 계정 · 닉네임 · 세션 · 1회용 복구 코드. 비밀 값(비밀번호·복구 코드·세션 토큰)은 **해시만** 저장한다.
--
-- user_id  : 로그인 아이디(비공개). 소문자 a-z·숫자·밑줄 4~20자 — 앱이 소문자로 정규화해 넣는다.
-- nickname : 공개 표시 이름(아이디와 별개, 필수). 완성형 한글 음절·ASCII 영문·숫자·밑줄 2~12자, 영문 대소문자 무시 유일
--   (CJ 2026-09-26 확정). 앱이 NFC 정규화 뒤 같은 규칙으로 검사하고, DB CHECK 가 한 번 더 막는다.
-- password_hash / recovery_hash : scrypt (authoritative/accounts.js hashSecret) — 원문은 어디에도 남지 않는다.
-- recovery_hash 는 항상 하나가 살아 있다 — 쓰거나 재발급하는 순간 새 코드의 해시로 **원자적으로 교체**된다(1회용).
-- recovery_expires_at : 발급 후 365일(CJ 확정). 지나면 그 코드는 복구에 쓸 수 없다 — 로그인 상태에서 재발급한다.
-- recovery_attempts / recovery_locked_until : 복구 시도 상한(5회 → 1시간 잠금). 시도는 검증 **전에** 원자적으로
--   예약한다(동시 요청 묶음으로 상한을 건너뛰는 대입을 막는다).
-- sessions.token_hash : 세션 토큰의 sha256. DB 가 유출돼도 살아 있는 세션을 그대로 쓸 수 없다.
-- credential_gen : 자격(비밀번호) 세대. 복구 재설정이 1 올린다. 세션은 발급 당시 세대를 들고, 계정 세대와 같을 때만 유효하다 —
--   옛 비밀번호 검증을 마친 로그인이 재설정보다 늦게 세션을 써도(스냅샷·커밋 순서와 무관하게) 그 세션은 죽어 있다(#259 보안 REVISE).
CREATE TABLE accounts (
  id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id               text NOT NULL UNIQUE CHECK (user_id ~ '^[a-z0-9_]{4,20}$'),
  nickname              text NOT NULL CHECK (nickname ~ '^[가-힣A-Za-z0-9_]{2,12}$'),
  password_hash         text NOT NULL,
  recovery_hash         text NOT NULL,
  recovery_expires_at   timestamptz NOT NULL,
  recovery_attempts     integer NOT NULL DEFAULT 0,
  recovery_locked_until timestamptz,
  credential_gen        integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX accounts_nickname_key ON accounts (lower(nickname));

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  account_id bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  credential_gen integer NOT NULL
);
CREATE INDEX sessions_account_idx ON sessions (account_id);
