# #260 Jupiter(Server) 결과 — 프로필 · 대표 하수인 · 공식 전적

2026-09-27 · Jupiter(Claude Opus 5.5 high · bypass · Ponytail full) · Git 쓰기 없음(Mercury 소관)

## 판정 (현재)
구현 완료(서버 범위) — dispatch `ctx_bc4db297c6dc` Saturn REVISE 수리(보관소 Windows ACL). Saturn 재검수·CI·CJ QA 전.

| 차수 | dispatch | 판정 |
|---|---|---|
| 1차 | `ctx_5e5db3b24a88` | **REVISE**(PD) — 보류 목록이 메모리였다: 상한 1000 초과 시 가장 오래된 결과 삭제, 제약 위반(23xxx) 결과 삭제, DB 장애 중 재시작·크래시 시 유실. 완료된 공식 결과를 잃을 수 있어 수용 불가. |
| 2차 | `ctx_3f87b31151ef` | 파일 아웃박스로 교체(아래). |
| 2차 QA | Saturn `ctx_65736465adf3` | **REVISE** — Windows 에서 chmod 0700/0600 은 ACL 을 바꾸지 않는다. 새 보관 폴더가 상위 상속 ACE 를 받아 다른 주체 9개(Modify 포함)가 읽고 쓸 수 있었다. |
| 3차 | `ctx_bc4db297c6dc` | 새 폴더 ACL 잠금 + 기존 폴더·파일 검사·fail-closed(아래). |

## 확정 계약
- `GET /api/profile` → `{nickname, representativeMinion, stats:{wins,losses}, matches:[최근 20 {result WIN|LOSS|NO_CONTEST, reason, opponentNickname, turns, durationMs, endedAt}], pendingMatches}` — `pendingMatches` = 그 계정이 들어 있는 미저장 결과 수(정수). **`/api/profile/matches` 는 제거**(404).
- `POST /api/profile/representative {minionId}` → `{representativeMinion}` (1차와 같음). WS `reps:[좌석0, 좌석1]` 입장 때 고정(1차와 같음).
- 기록: `_finalize` 가 IN_PROGRESS 를 떠날 때 1회. 종료 시각 = 확정 순간의 벽시계(상점·재접속 대기 포함), 재생해도 원래 값.
- **아웃박스**(`server/authoritative/resultOutbox.js`): 결과 확정 → 결과 프레임 전 동기 append+fsync → DB 한 문장(두 좌석 행, `ON CONFLICT (match_id, account_id) DO NOTHING`) → 성공한 항목만 tmp+fsync+rename 으로 제거. 30초 sweep·기동 직후 재생. 재생은 멱등(정확히 한 번).
  - 상한 200: 넘어도 버리지 않고 새 공식 경기(WS create/join/joinPublic)를 `E_RESULTS_BACKLOG` 로 거부. 재접속은 허용. 파일 쓰기 실패도 같은 차단 + 메모리 보관 + 다음 sweep 에 전체 재작성.
  - 제약 위반: 버리지 않고 아웃박스에 보존, 한 번 로그(수동 확인).
  - 깨진·형식 밖 줄: 기동 때 `<파일>.bad` 에 원문 append+fsync 후 좋은 항목만 재작성. 보존 실패 = 기동 실패(원본 무수정).
  - 경로 `DD_RESULT_OUTBOX`(체크아웃 밖 비공개 영속 디스크, 새 폴더 0700·파일 0600).
  - **보관소 권한(3차)**: 새로 만든 폴더만 잠근다 — Windows 는 `icacls /inheritance:r /grant:r *<현재 사용자 SID>:(OI)(CI)F`(안의 파일·`.bad`·`.tmp` 는 상속). 이미 있는 폴더와 파일·`.bad`·`.tmp` 는 **검사만** 한다: POSIX 는 소유자=프로세스 + group/other 비트 0, Windows 는 Allow ACE·소유자가 현재 사용자·SYSTEM(S-1-5-18)·Administrators(S-1-5-32-544)뿐. 넓으면 `E_OUTBOX_INSECURE`, 검사 자체 실패는 `E_OUTBOX_ACL_CHECK` — 둘 다 기동 거부이며 데이터·ACL 을 고치거나 지우지 않는다. 폴더를 잠근 **뒤에** 파일 존재를 봐서 잠그기 전 틈에 생긴 파일도 걸린다. 도구: Windows PowerShell 5.1 `Get-Acl` + `icacls`(System32 절대 경로, `child_process`, 의존성 없음). 미설정 = `server/data/match-results-outbox.jsonl`(`server/.gitignore` 에 `data/`). 열 수 없으면 DB 켠 서버는 exit 1.
  - 로그: 오류 코드·건수만(계정 id·경로·DB 원문 없음). DB 장애 중 프로필 503 `E_ACCOUNTS_UNAVAILABLE`.

## 파일 (3차)
- `server/authoritative/resultOutbox.js` — `checkPrivate`(새 폴더 잠금·기존 검사) 추가. 재생·상한·`.bad`·fsync·원자 교체 무변경
- `server/authoritative/server.js` — 기동 실패 로그에 `E_OUTBOX_INSECURE` 뜻 추가(동작 무변경)
- `server/authoritative/test/test-issue260-profile.js` — D5 실패 파일을 비공개 폴더 안으로(mkdtemp 폴더는 Temp ACL 상속), D7~D9 추가
- `server/README.md` · 이 보고서

## 파일 (2차)
- `server/authoritative/resultOutbox.js` — 재작성(아래 무감독 파일 검토 반영)
- `server/authoritative/accounts.js` — 메모리 보류 목록·`PENDING_MAX`·`matchHistory`·`/api/profile/matches` 제거, `createAccounts(store, policy, mailer, outbox)`, `resultsBlocked()`
- `server/authoritative/server.js` — 아웃박스 열기(fail-closed), `E_RESULTS_BACKLOG` 게이트, 기동 재생
- `server/authoritative/test/test-issue260-profile.js` — C7·C9 기대 갱신, D1~D6 추가
- `server/.gitignore`(`data/`) · `server/README.md`
- `005_profile_matches.sql` 무변경(001~004 무변경)

## 무감독 정정 파일 (보존·검토)
1차 보고(17:38) 뒤 옛 터미널이 settle 후 `server/authoritative/resultOutbox.js`(17:40, sha256 `6c85b903…4b9ea0`)를 만들었다. 어디에도 연결되지 않은 파일이었다. 원본은 [unsupervised-resultOutbox.orig.txt](unsupervised-resultOutbox.orig.txt)(같은 해시)로 보존했고 삭제하지 않았다. 검토 결과: 방향은 맞으나 ① 파일 쓰기 실패 시 메모리에도 넣지 않아 유실 ② 재생 시 형식 검사 없음 ③ 제거 재작성 실패가 호출자로 throw ④ 차단 신호 없음 → 재작성했다. 같은 시각대 다른 경로(`demo/js/lobby.js`·`demo/test/regression/smoke_issue260.js`·`tools/qa/issue260_local.js`·Mars 보고서)는 Mars 소관이라 건드리지 않았다.

## 검사 3차 (변경 위험만 · 1회)
| 명령 | 결과 |
|---|---|
| `node authoritative/test/test-issue260-profile.js` (메모리 · 실제 Windows 10 ACL) | 62 passed, 0 failed |

- D7 새 경로(`new/deep/`) 생성 → 폴더 `True|<내 SID>`(상속 차단·나만) · 파일 `False|<내 SID>`(상속) · 다시 열어 재생 1건. D1~D5(생성·쓰기·재시작·재생·상한·`.bad`) 같은 실행에서 통과.
- D8 이미 있는 폴더에 Authenticated Users Modify(`(OI)(CI)M`) + 사용자 데이터 → `E_OUTBOX_INSECURE`, 파일 내용·폴더/파일 icacls 출력 전후 동일, `.bad`·`.tmp` 없음.
- D9 비공개 폴더 안 파일에 Authenticated Users Read → 같은 거부·무변경. POSIX 분기(0755·0644)는 같은 테스트에 있으나 **이 기계에서 실행하지 못했다**(Windows 뿐) — CI B(Linux)에서 돈다.
- 스크래치 프로브: Temp 바로 아래(이 기계 Temp 는 다른 SID 7개 Modify 상속) 경로는 거부, 새 하위 폴더는 `pc_77:(OI)(CI)(F)` 하나.
- 라이브 QA 보관소(`qa/.../issue-260-local/data` · 파일) 읽기 전용 Get-Acl: 소유자·Allow 모두 현재 사용자 하나 → 새 규칙 통과. 파일·ACL·8081/8082 서버·005·CJ DB 무접촉.
- PG 재실행 없음 — 권한 검사는 DB 경로와 무관하고 D 절은 메모리 대역에서 돈다. 전체 CI 반복 없음.

## 검사 2차 (각 1회, 변경 위험만)
| 명령 | 결과 |
|---|---|
| `node authoritative/test/test-issue260-profile.js` (메모리) | 58 passed, 0 failed · exit 0 |
| 같은 명령 + `DD_TEST_DATABASE_URL`(격리 PG 18.4 · 55474 · 스크래치 data dir · 종료 확인) | 58 passed, 0 failed · exit 0 |
| `node authoritative/test/test-issue259-accounts.js` (메모리 — createAccounts·WS 연결 경로 변경분) | 111 passed, 0 failed · exit 0 |

D1 반환 전 파일 기록 · D2 상한 초과 무손실+`E_RESULTS_BACKLOG` · D3 재시작 재생·원래 시각/시간/턴·크래시 재생 정확히 한 번 · D4 깨진 줄 `.bad` 보존·중복 없음·줄바꿈 없는 끝 줄 · D5 쓰기 실패 메모리 보관/차단/복구·열 수 없는 경로 fail-closed · D6 로그 비노출.
1차 증거 재사용(무변경 경로): 서버 `npm test` exit 0, #259 PG 121. 전체 스위트는 다시 돌리지 않았다.

## 남은 문제 · 한계
- [확정] Windows 검사는 기동 때 PowerShell 을 1~2번 띄운다(측정 0.2~0.3초). PowerShell 이 없거나 막힌 Windows 는 `E_OUTBOX_ACL_CHECK` 로 기동하지 않는다(fail-closed).
- [확정] 이미 있는 넓은 기본 경로(`server/data/`)는 운영자가 직접 좁혀야 기동한다 — 서버가 고치지 않는다. 이 체크아웃에는 `server/data/` 가 없다.
- [추론] 검사는 기동 때 한 번이다. 기동 뒤 다른 관리자 권한 주체가 ACL 을 넓히는 것은 막지 못한다(POSIX root 와 같은 한계).
- [기획 필요 · Mars] `reason:server_error`(와 `server_restart`·`both_disconnected`)는 005 CHECK 가 받는 내부 코드로 저장·응답한다(서버 무변경). 화면 문구는 `demo/js/lobby.js:131` `REASON` 에 없어 "경기 종료"로 보인다 — 한국어 매핑은 클라이언트(Mars) 소관이라 손대지 않았다. 문구 안(추론): server_error "서버 오류로 무효", server_restart "서버 재시작으로 무효", both_disconnected "양쪽 연결 끊김으로 무효".
- 절차 공개: GO 전 preflight 중 읽기 전용 `git rev-parse` 1회(Worker Git 읽기 금지 위반, 이후 Git 없음). 구현 중 문법 확인 목적으로 `node -e "require('./authoritative/server.js')"` 를 실수로 1회 실행 — DB 환경 없이 즉시 종료, 남은 프로세스·`server/data/` 생성 없음(확인).
- [확정] 같은 디스크가 남는 동안만 지킨다. Render Free 처럼 재배포마다 파일 시스템이 사라지는 곳에서는 DB 장애 중 재배포된 미저장 결과를 잃는다 — 영속 디스크 전 배포에서 이 보장을 주장하지 않는다(README). Render DB 연동은 미배포.
- [확정] 한 파일 = 한 서버 프로세스. 재시작 직후 전 프로세스가 아직 살아 있으면 안 된다.
- [추론] 이미 SETUP 인 방은 차단 뒤에도 시작될 수 있어 상한은 방 수만큼 넘을 수 있다(버리지는 않음).
- Mars: `demo/js/network.js` 는 `E_RESULTS_BACKLOG` 를 모르고 `loadFail` 로 보인다 — 문구 매핑은 Mars 소관. 헬퍼의 `DD_RESULT_OUTBOX` 경로는 확정 계약과 일치(변경 불필요). Mars dispatch `ctx_33feeabb1f03` 가 완료 상태라 계약은 run 메일함(msg_95117f6279d4)으로 전달했다.
- 배포 게이트: 005 적용 필요(`DD_DB_MIGRATE_ON_START=1` 또는 `db:migrate`). 영향 필수 CI: B.
