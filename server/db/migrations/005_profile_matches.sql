-- #260 — 대표 하수인 · 공식 전적/경기 기록. **추가만** 한다: 001~004 는 이미 적용된 DB 가 있어 고치지 않는다(체크섬).
--
-- rep_minion : 로비 대표 하수인(프로필 표현 — 전투·상점·소유권과 무관). 일반 30종 id 만 받는다 — 목록은 서버 코드(ROSTER)가
--   권위라 앱이 검사하고, DB 는 형식만 막는다. 기존 계정은 기본 'M-F1'(새끼 화룡, CJ 확정).
-- match_results : 보드 경기가 시작(IN_PROGRESS)된 온라인 경기의 결과. 좌석(계정)마다 한 행.
--   result  : WIN·LOSS = 공식 전적(기권·연결 종료 몰수 포함) · NO_CONTEST = 기록만(승패 집계 제외). 경기 전 취소·PVE 는 행이 없다.
--   match_id: 경기마다 서버가 만든 무작위 id. UNIQUE(match_id, account_id) + ON CONFLICT DO NOTHING 으로 재시도해도 한 번만 남는다.
--   opponent_nickname : 경기 당시 상대 닉네임(스냅샷). turns : 종료 시점의 경기 턴 번호. duration_ms : 보드 경기 시작 → 서버 결과 확정.
--   승·패 수는 이 행들에서 센다(별도 카운터 없음 — 카운터와 기록이 어긋날 수 없다). 전체 행을 보존한다(화면은 최근 20).
ALTER TABLE accounts ADD COLUMN rep_minion text NOT NULL DEFAULT 'M-F1' CHECK (rep_minion ~ '^M-[A-Z][0-9]{1,2}$');

CREATE TABLE match_results (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  match_id          text NOT NULL CHECK (match_id ~ '^[0-9a-f]{32}$'),
  account_id        bigint NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  result            text NOT NULL CHECK (result IN ('WIN', 'LOSS', 'NO_CONTEST')),
  reason            text NOT NULL CHECK (reason ~ '^[a-z_]{1,32}$'),
  opponent_nickname text,
  turns             integer NOT NULL CHECK (turns >= 0),
  duration_ms       bigint NOT NULL CHECK (duration_ms >= 0),
  ended_at          timestamptz NOT NULL,
  UNIQUE (match_id, account_id)
);
CREATE INDEX match_results_account_idx ON match_results (account_id, ended_at DESC, id DESC);
