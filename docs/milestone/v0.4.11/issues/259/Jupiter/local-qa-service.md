# #259 로컬 계정 QA 서비스 — 운영 보고

## 현재 운영 메타데이터 — 2026-09-27 16:36 KST Mercury

- 아이디만으로 비밀번호 찾기 서버·화면 수리와 fresh Saturn LOCAL PASS(서버111/클라이언트208) 후 기존 도구로 Node만 재시작했다. 서버 PID20592, PG PID34176(55459), 주소 **http://127.0.0.1:8081/**. 숨김 bootstrap41872 종료 뒤 페이지/healthz/readyz200·무쿠키 session401, account.js33519B·SHA`4519F50DD47B881D…`=작업 파일을 확인했다.
- 실제 서버에는 유효하지 않은 ID `!`만 보내 계정 조회·메일 없이404 `E_ID_NOT_FOUND`·“존재하지 않는 아이디입니다”를 확인했다. SMTP 개인 설정 로드와15:43 인증 PASS 증거 유지, 실제 메일 발송·코드 발급·계정 생성/삭제·로그인·비밀번호 변경0. 15:52 이후 CJ 가입 데이터는 보존하며 현재 개수를 재조회하지 않았다. 후속 CJ가 최종 QA PASS를 전달해 이번 로컬 흐름의 CJ 재검수는 완료로 기록한다. 기존 DB·SMTP·백업 유지. 실제 수신 시각이나 로그는 별도 관측하지 않았고 배포 발송 검증은 남아 있다.
- 상세 모델·QA·수리·정산 근거는 [Mercury 원장](../Mercury/report.md)의 현재 항목을 따른다. 아래 계정0/세션0/재설정0은 삭제 직후15:52의 이력이며 지금의 데이터 개수를 뜻하지 않는다.

## 15:52 계정 정리 — 이력

- 현재 상태 기준: **2026-09-27 15:52 KST** Jupiter(Claude `claude-opus-5-5` · effort high · bypass · Ponytail full — claude.exe PID 37364 명령줄
  `--model claude-opus-5-5 --effort high --dangerously-skip-permissions`, 세션 JSONL `8a810821-…` model·effort·permissionMode) · dispatch `ctx_ddb81aa7d8a3` /
  task `task_4d7d789c47f1` — **CJ 15:45 명시 승인에 따른 테스트 계정 정리(Mercury GO)**. 삭제한 것은 **계정 행 4개**(와 연결 세션)이지 DB·자원 4개가 아니다.
- **지금 상태 [확정]: QA 서비스 실행 중 · 계정 0 · 세션 0 · 재설정 0** — 깨끗한 가입부터 QA 가능. SMTP 설정 그대로(인증 PASS 는 15:43 결과 재사용, 재검사·발송 없음).

| 단계 | 결과 [확정] (값·ID·이메일·해시 미출력, 개수·다이제스트 앞 16자·PID 만) |
| --- | --- |
| 서버 정지 | `stop.ps1 -ServerOnly` → node 680 종료. Postgres **34176 그대로**(14:21:48 기동) |
| 사전 읽기 | 001~004 체크섬 = 파일 · FK `sessions→accounts`·`password_resets→accounts` 모두 ON DELETE CASCADE · 사용자 트리거 0 · accounts 4 · sessions 2 · password_resets 0 · db_meta 3 |
| 트랜잭션 1회 | `LOCK accounts, sessions, password_resets` → 정확히 4 확인(아니면 ROLLBACK·중단) → 연결 세션·재설정 먼저, 그다음 계정 삭제 → **삭제 accounts 4 · sessions 2 · password_resets 0** → COMMIT 전 세 표 0 확인 → COMMIT |
| 불변 | db_meta 3행 다이제스트 `4bba912ca1c80f3b` · schema_migrations 4행 `4b17be35e6828762` 전후 동일 · `verify` 통과 · 스키마·마이그레이션·백업·파일 변경 없음 |
| 재기동 | `launch-hidden.ps1` 부트스트랩 40748(종료) → node **42508**(15:51:09) 8081 ← cmd 22456 ← 10480(종료) · 로그 `postgres: ready`·`mail: secrets\smtp.json loaded`·`SMTP 설정됨` — 메모리 속 방·좌석·캐시 비움 |
| HTTP | `GET /`·`/healthz`·`/readyz` 200 · `/api/auth/session`(쿠키 없음) 401 · 읽기 전용 재조회 세 표 0 |

- 실제 메일 발송 0 · 가입 0 · 로그인 0 · 재설정 코드 0. 받은편지함 도착은 여전히 CJ QA 게이트다.
- 직전 기준: **2026-09-27 15:43 KST** Jupiter(Claude `claude-opus-5-5` · effort high · bypass · Ponytail full — claude.exe PID 27848 명령줄
  `--model claude-opus-5-5 --effort high --dangerously-skip-permissions`, 세션 JSONL `3cefefcb-…` 의 model·effort·permissionMode, Mercury 가 GO 직전 composer·footer 확인)
  · dispatch `ctx_5981bbe55add` / task `task_85282b9e6fc2` — **SMTP 설정 확인 전용**. 제품·테스트·마이그레이션·QA 도구 무수정, 새 파일 없음.
- **15:43 상태 (역사): QA 서비스 실행 중 · 재설정 메일 SMTP 설정됨·연결/인증 PASS** — **http://127.0.0.1:8081/** (루프백) · Postgres `127.0.0.1:55459`.
  **[미확정] 받은편지함 도착은 미검증** — 연결·인증 PASS 는 메일이 실제로 도착한다는 증명이 아니다(실제 발송 없음).
- **SMTP 확인 [확정]** (메일 발송·계정 생성·로그인·재설정 코드 발급·DB 조회 없음, 값·주소·비밀번호 미출력):

| 단계 | 결과 |
| --- | --- |
| 설정 저장 | CJ 가 `secrets\smtp.json` 저장(15:36:18). ACL = `pc_77:FullControl` 하나(상속 없음). 형식·필드 유효(Mercury 확인 — Gmail SMTPS 465) |
| 서버 재시작 [Mercury 실측] | 기존 도구로 `stop.ps1 -ServerOnly` → 숨김 기동. 옛 node 24520 종료, 새 node **PID 680**(15:38:35) 8081. Postgres **PID 34176 그대로**(14:21:48 기동, 55459). 재시작 1회 |
| 부모 독립 [확정] | 8081 = node 680 ← cmd 10420 ← 11192(종료) · 55459 = postgres 34176 ← cmd 24632 ← 24444(종료). 부트스트랩이 끝난 뒤 독립, Orca·워커 셸과 부모 관계 없음 |
| 설정 로그 [확정] | 필터한 고정 문구만 확인(로그 원문 미열람): `start-hidden.log` 최신 `mail: secrets\smtp.json loaded …` → `server: http://127.0.0.1:8081/` · `server.log` 최신 `비밀번호 재설정 메일: SMTP 설정됨`(이전 두 기동분은 `미설정`) |
| `transport.verify()` 1회 [확정] | 설치된 nodemailer **10.0.10**. 제품 `smtpMailer()` 가 `smtpOptions()`(내보내지 않음)로 만든 전송을 그대로 잡아 검사 — 저장된 설정을 프로세스 메모리에서만 읽음(명령줄·환경·파일 없음). 결과 **VERIFY_PASS** — DNS·TLS·접속·AUTH 성공. `sendMail` 호출 없음. 이때 출력한 `requireTLS=false ignoreTLS=true` 는 **필드 값이 아니라 단언 결과**(`requireTLS===true`·`ignoreTLS===false`)였다 — 라벨 오기 |
| 옵션 실제 값 [확정] | 네트워크 없는 재포착 1회(`verify` 재실행 없음): `createTransport` 인자 1개 = 제품 옵션 객체. 필드 `secure=true` · `requireTLS=false`(465 암시적 TLS라 제품이 STARTTLS 요구를 끔) · `ignoreTLS=false` · `port=465` · `url`·`service`·`tls` 없음 · debug·logger 미설정 · 인증 user/pass 문자열 · 제한 10000/10000/20000 ms. 제품 키 9개 모두 전송 옵션에 같은 값(`auth` 만 nodemailer 가 같은 값으로 복제), 전송 쪽 추가 키 0 |
| HTTP [Mercury 실측 재사용] | 재시작 뒤 `GET /`·`/healthz`·`/readyz` 200 · `/api/auth/session`(쿠키 없음) 401 |
| 재설정 요청 형식 오류 [확정] | 같은 출처 `POST /api/auth/password-reset/request {}` → **400 `E_BAD_INPUT`**(이전 503 `E_MAIL_UNAVAILABLE`) — 메일 게이트 통과, 입력 검사에서 끝남(계정 조회·코드·발송 없음). Origin 헤더 없는 첫 시도 2건은 403 `E_BAD_ORIGIN`(DB·메일 전 단계) |

- **이전 운영 14:22 (역사)** — dispatch `ctx_7e886adb01a4` / task `task_89f402545ed9`, Saturn 최종 PASS(14:20:38) 뒤 Mercury ops GO. 그 시점 SMTP 는 미설정이었다(아래 표의 `mail: not configured`·503 은 당시 값):

| 단계 | 결과 |
| --- | --- |
| 멈춤 확인 | 8081·55459 리슨 없음 · `postmaster.pid` PID 37644(상태 `ready` 로 남은 옛 파일) 프로세스 없음 · postgres/node 프로세스 0. 잠금 파일은 지우지 않았다 |
| ① 콜드 복사(pg_dump 아님) | `backup\pgdata-cold-pre-004-20260927-142128` · **1300 / 1300 파일 · 66,821,647 B · 차이 0** · 매니페스트 sha256 `29A2970EEC680BA6` · ACL = `pc_77:FullControl` 하나(상속 차단, 안쪽 파일도 사용자 전용). 003 이전 백업·`start.ps1` 백업 2개 그대로 |
| ② PG 숨김 기동 | `launch-hidden.ps1 -PgOnly` → WMI 부트스트랩 PID 13956(종료됨) · postmaster **PID 34176**, `postmaster.pid` 상태 `ready`. Postgres 가 13:33:16 이후 비정상 종료분을 자동 복구(redo → end-of-recovery checkpoint → ready, 14:21:49) — 초기화 없음 |
| ③ `ops-004.js` 읽기 전용 | 001·002·003 체크섬 = 파일 · 실제 개수 **accounts 4 · sessions 2 · db_meta 3 · password_resets 0** · 이메일 없는 계정 2 · 공유 주소 0 · 이메일 유일 인덱스 있음 |
| ③ `ops-004.js apply`(1회) | 적용 `004_email_not_unique.sql` · 전후 모든 열 다이제스트 동일 — accounts `ddfb5de80b836d77` · sessions `00cef9b6427078c2` · db_meta `4bba912ca1c80f3b` · password_resets `e3b0c44298fc1c14`(빈 표) · 001~004 체크섬 = 파일 · 이메일 유일 인덱스 **없음** · `ALL_ROWS_PRESERVED true` |
| ④ 서버 숨김 기동 | 부트스트랩 PID 37916(종료됨) · `start-hidden.log`: `postgres: ready` → `mail: not configured` → `server: http://127.0.0.1:8081/` · 서버 로그 "DB 사용 … 연결·스키마 확인 완료" · 기동 게이트(001~004) 통과 |
| 부모 독립 | 8081 = node **PID 24520** ← cmd 21608 ← 17420(종료) · 55459 = postgres **PID 34176** ← cmd 24632 ← 24444(종료). 두 계보 모두 WMI 로 띄운 부트스트랩 아래이고 워커·Orca 터미널 셸과 부모 관계 없음 |
| HTTP | `GET /` 200(`js/account.js` 참조) · `/healthz` 200 `ok` · `/readyz` 200 `ok (db)` · `/api/auth/session`(쿠키 없음) 401 `E_NO_SESSION` · `/js/account.js` 200 **33,002 B, sha256 `4ad01949490ff3e4…` = 작업 트리 파일** · `POST /api/auth/password-reset/request {}` 503 `E_MAIL_UNAVAILABLE`(메일 미설정 — 계정 조회 전에 끝남) |

- **한계**: Windows 서비스·예약 작업·자동 시작 없음 — **PC 로그오프·재부팅 시 멈춘다** → `launch-hidden.ps1 -PgOnly` 뒤 `launch-hidden.ps1` 로 다시 켠다(5장). 실제 메일 받은편지함은 미검증(SMTP 설정·인증은 PASS, 발송 안 함).
- 이전 기준: 09:06 KST `ctx_5c5b353e32c6` — 003 적용·서비스 기동(3장, 역사) · 13:58 `ctx_ad1ad80c47e5` — 004·도구 준비(보고서 12장) · 14:11~14:19 `ctx_46b87f15e92b`·`ctx_7e886adb01a4` 1단계 — 도구 안전장치(6~7장).
- 표기: **[확정]** 실측 · **[추론]** 판단 · **[미확정]** 확인 못 함

## 1. 주소와 범위

| 항목 | 값 |
| --- | --- |
| QA 주소 | **http://127.0.0.1:8081/** — 이 PC 에서만 열린다(루프백 HTTP, LAN·터널·방화벽 개방·공개 없음) |
| 소스 | `issue-259-accounts` 작업 트리(HEAD `fafc619` + 커밋되지 않은 #259 최종본). `server/authoritative/server.js` 가 `demo/` 클라이언트를 직접 서빙 |
| 범위 | #259 계정 기능 로컬 QA — 이메일 필수 가입·단일 로그인(다른 곳 로그인 시 이전 기기 로그아웃)·기존 계정 이메일 등록·같은 계정 대전 금지·상대 닉네임 표시·온라인 방 로그인 필수. 경제 경기 기본 ON |
| 범위 밖 | **받은편지함 도착 미검증**(15:36 CJ 가 Gmail SMTP 를 `smtp-setup.ps1` 로 로컬 저장, 서버 `SMTP 설정됨`, `transport.verify()` 연결·인증 PASS — 머리말 표. 실제 재설정 메일은 보내 보지 않았다. Gmail 은 로컬 QA 입력일 뿐 제공자 결정이 아니다. 로컬 받은편지함 확인은 Render 발송 준비가 아니다: Render Free 는 외부 SMTP 포트 25·465·587 을 막는다) · **HTTPS 아님**(루프백 HTTP 라서 비밀번호 입력이 허용된다. LAN 주소로 열면 `403 E_INSECURE_TRANSPORT` — 설계대로) · **#263 최신 타이머 미통합** — 30/60초 타이머·마일스톤 전체 판정 주소가 아니다 · Render·실배포 QA 는 별도 게이트 |

## 2. 두 계정으로 대전하는 법 (A/B)

**서로 다른 브라우저 프로필**로 연다 — 예: Chrome 일반 창 + Chrome 시크릿 창, 또는 Chrome + Edge. 같은 프로필의 **탭 두 개(Orca 탭 두 개 포함)는 쿠키를
함께 써서** 두 번째 로그인이 첫 번째 계정을 밀어낸다(이번 CJ 신고의 원인 — 클라이언트 계정 전환 처리는 Mars 소관). 한 계정은 한 곳에서만 로그인된다
(단일 로그인) — 다른 창에서 같은 계정으로 로그인하면 먼저 창은 로그아웃된다. 같은 계정으로 자기 방에 참가할 수 없다(`E_SAME_ACCOUNT`).

## 3. 이번 운영 결과 [확정]

### 3.1 재개 전 상태·백업

| 확인 | 결과 |
| --- | --- |
| 리슨 | 8081·55459 모두 없음(서버·Postgres 정지) |
| 옛 잠금 | `pgdata\postmaster.pid` = PID 8876 — 해당 PID 프로세스 없음(`Get-Process`·`tasklist` 양쪽 확인). 파일은 지우지 않았고 Postgres 가 기동 시 스스로 교체했다 |
| 콜드 백업 | `backup\pgdata-cold-pre-003-20260927-081718` ↔ 현재 `pgdata` **파일별 SHA-256 전수 비교: 1298 / 1298, 차이 0**, 67,255,326 B — 백업은 정확히 003 이전·정지 상태 그대로다(보존, 지우지 않음) |
| 기동 복구 | Postgres 로그: 비정상 종료(마지막 정상 07:59:26 KST) 뒤 자동 복구 — redo 완료·end-of-recovery checkpoint·ready. 초기화·리셋 없음 |

### 3.2 003 적용 (한 번) — 기존 데이터 보존

QA 폴더의 일회성 도구 `ops-003.js` 가 비밀을 `secrets\local.json` 에서 **자기 프로세스 안에서만** 읽어 연결했다(명령줄·환경변수·로그·출력에 없음).
출력은 개수·SHA-256 다이제스트 앞 16자·참/거짓뿐이다(원문·해시 값·토큰·개인정보 없음). 다이제스트는 002 이전부터 있던 **모든 열**의 행 전체를 기본키 순으로 묶은 값이다.

| 항목 | 적용 전 | 적용 후 |
| --- | --- | --- |
| 마이그레이션 | 001·002 (체크섬 = 현재 파일) | 001·002·**003** (셋 다 체크섬 = 현재 파일, `verify` 통과) · 002 파일 SHA `ad46699758242b05…` 불변 |
| `accounts` | 2행 · `fcebe671eec1bd78` | 2행 · `fcebe671eec1bd78` (동일) |
| `sessions` | 1행 · `31878d5d3a9168dd` | 1행 · `31878d5d3a9168dd` (동일 — 행 삭제·변경 없음) |
| `db_meta` | 3행 · `8a2fd7f804876661` | 3행 · `8a2fd7f804876661` (동일) |
| 공개 표 | accounts · db_meta · schema_migrations · sessions | + `password_resets`(빈 표) |
| 단일 세션 | — | 계정별 유효 세션 최대 1(유효 1 · 규칙상 최신 후보 1 · 일치 1 · 여럿 유효 계정 0) |
| 이메일 | — | 기존 2계정 모두 이메일 없음 → 로그인 뒤 `hasEmail:false` 안내, 로그인 + 현재 비밀번호로 한 번 등록 |

허용된 변경은 003 의 새 열(`login_gen`·`email`·`email_norm`)·새 표뿐이다. 서버 기동 뒤 같은 도구의 검증 모드로 다시 확인해 위 표와 같았다.
CJ 비밀번호는 재설정·사용하지 않았고, 프로브 계정은 만들지 않았다.

### 3.3 HTTP 확인 (서버 기동 뒤 1회)

| 요청 | 결과 |
| --- | --- |
| `GET /` | 200, `js/account.js` 참조 |
| `GET /js/account.js` | 200, 32,175 B, sha256 `02e2826cf97e4e4c…` = 작업 트리 `demo/js/account.js` |
| `GET /healthz` · `GET /readyz` | 200 `ok` · 200 `ok (db)` |
| `GET /api/auth/session` (쿠키 없음) | 401 `E_NO_SESSION` |
| `POST /api/auth/password-reset/request` | 503 `E_MAIL_UNAVAILABLE` (SMTP 미설정 — 기동 로그 "재설정 메일: 미설정") |
| `POST /api/auth/recover` (폐기된 복구 코드) | 404 `E_NOT_FOUND` |

제품·테스트·CI·패키지 파일 255개 SHA 목록과 HEAD `fafc619` 가 작업 전후 동일했다(Saturn 이 동결한 소스 그대로).

## 4. 서비스 구성 — 누가 프로세스를 들고 있나

| 구성 | 위치·상태 |
| --- | --- |
| 서비스 터미널 | Orca 터미널 **`DD-259-QA-SERVICE`** (핸들 `term_766067c3-100a-4a1d-95c4-2e9a955fd280`, 워커 터미널과 별개). 명령 `powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File …\start.ps1 -PgOnly` 로 Postgres 를 켜고, 같은 셸 프롬프트에서 `& …\start.ps1` 로 서버를 켰다. `-NoExit` 라 셸이 계속 살아 있다 |
| Postgres | 18.4, `127.0.0.1:55459` SCRAM, `pg_ctl` 로 숨김 기동(보이는 콘솔 없음), 데이터 `pgdata\`, DB `digit_duel_qa` |
| 서버 | `node authoritative\server.js` (작업 디렉터리 `issue-259-accounts\server`), `127.0.0.1:8081`, 숨김 `cmd /c` 래퍼, 로그 `logs\server.log` |
| 프로세스 계보 [확정] | node → cmd → 서비스 PowerShell(`-NoExit start.ps1`) → Orca 터미널 셸 → Orca daemon-host. Postgres 는 같은 서비스 셸이 부른 `pg_ctl` 이 띄웠다(`pg_ctl` 은 정상 종료). 워커(Claude 도구) 셸과 부모 관계가 없고, 도구 프로세스가 끝난 뒤에도 두 리슨이 살아 있음을 확인했다 |
| 비밀 | `secrets\local.json`(현재 사용자 전용 ACL 유지). `DATABASE_URL` 은 `start.ps1` 이 서버 자식에게만 넘기고 지운다. SMTP 변수는 `start.ps1` 이 명시적으로 지운다 |
| `start.ps1` 수정 | 09:06: `exit 0` 두 곳 → `return`(서비스 셸이 `-NoExit` 로 남도록), 원본 `backup\start.ps1.pre-service-20260927`. **13:58**: ① Node 전 **Postgres 준비 게이트** — 콜드 스타트 복구 중 로그인 거부(`57P03`)로 서버가 exit 1 하던 문제. `pg_isready` 가 `pg18\bin` 에 없어 `postmaster.pid`(살아 있는 PID + 8행 `ready`, `pg_ctl -w` 와 같은 신호)를 최대 120초 기다린다 ② `secrets\smtp.json` 이 있을 때만 서버 자식에게 `DD_SMTP_URL`/`DD_MAIL_FROM` 을 넘기고 곧바로 지운다(값 미출력). 직전 원본 `backup\start.ps1.pre-004-20260927` |
| `smtp-setup.ps1`(신규) | 대화형·가림 입력으로 `secrets\smtp.json {smtpUrl, mailFrom}` 작성(현재 사용자 전용 ACL). 매개변수 없음(비밀이 명령줄·이력에 안 남음), 값·발송 없음 |
| `ops-004.js`(신규) | `ops-003.js` 파생. 기본 읽기 전용, `apply` 일 때만 정확히 001·002·003 위에 004 한 번. 개수·다이제스트·체크섬·참/거짓만 출력 |
| 이전 중단 원인 | **[미확정]** 07시대 서비스는 Jupiter 워커의 Claude 도구 셸에서 `Start-Process` 로 시작됐고 그 도구·작업의 수명과 묶였을 가능성이 있다 **[추론]** — 증명하지 못했다. 그래서 원인을 단정하지 않고, 프로세스를 워커와 무관한 Orca 서비스 터미널 아래로 옮겼다 |

한계: Windows 서비스·작업 스케줄러 등록은 하지 않았다. **PC 재부팅·로그오프·Orca 종료·서비스 터미널 탭 닫기** 시 멈출 수 있다 — 그때는 5장으로 다시 켠다.
**현재(13:23 기동분 정지 뒤)**: 서비스 터미널 방식은 쓰지 않는다 — 탭이 닫히며 멈췄을 가능성(6장, 미확정) 때문에 다음 기동은 `launch-hidden.ps1`(7장). 이 4장 표는 09:06 구성 기록이다.

## 5. 시작·중지·재시작 (비밀 값 없이)

새 PowerShell 에서(오래 살아야 하는 기동은 `launch-hidden.ps1`):

```powershell
cd C:\Users\pc_77\orca\qa\Digit-Duel\issue-259-local
powershell -NoProfile -ExecutionPolicy Bypass -File .\start.ps1               # Postgres(꺼져 있으면) + 서버(8081 이 비어 있으면)
powershell -NoProfile -ExecutionPolicy Bypass -File .\stop.ps1 -ServerOnly    # 서버만 중지(DB 유지)
powershell -NoProfile -ExecutionPolicy Bypass -File .\stop.ps1                # 서버 + Postgres 중지(데이터는 pgdata 에 남는다)
# 재시작 = stop.ps1 -ServerOnly 뒤 start.ps1  (코드 변경을 반영하려면 서버 재시작 필요)
powershell -NoProfile -ExecutionPolicy Bypass -File .\launch-hidden.ps1      # start.ps1 을 탭과 무관한 숨김 프로세스로(-PgOnly 가능) — 오래 살아야 하면 이것
powershell -NoProfile -ExecutionPolicy Bypass -File .\cold-backup.ps1        # PG 정지 상태에서만 pgdata 콜드 복사(사용자 전용 폴더)
powershell -NoProfile -ExecutionPolicy Bypass -File .\smtp-setup.ps1         # (선택) 재설정 메일 설정 — 가림 입력, 값 미출력. 적용은 서버 재시작 뒤
node ops-004.js                                                              # 읽기 전용 상태 / `node ops-004.js apply` 는 Mercury GO 뒤에만
```

- 메일을 끄려면 `secrets\smtp.json` 을 지우고 서버를 재시작한다. Gmail 사전 설정은 로컬 QA 입력 선택지일 뿐 제공자 결정이 아니다(앱 비밀번호 필요).

- `start.ps1` 을 직접 부르면 부른 셸이 부모가 되어 그 셸·탭과 함께 멈출 수 있다. 오래 살아야 하면 `launch-hidden.ps1`(부모 = WMI 호스트). 로그오프·재부팅에는 멈춘다.
- `stop.ps1` 은 그 포트를 가진 프로세스의 명령줄이 `authoritative\server.js` 일 때만 끈다. 서버를 재시작해도 계정·세션은 DB 에 남는다(진행 중 **방**은 무효 — 설계대로).
- 초기화·계정 삭제는 자동화하지 않았다(데이터 삭제는 사람 판단 — 15:52 계정 4개 정리도 CJ 명시 승인 뒤 1회 수동 트랜잭션). 003 이전 상태가 필요하면 정지 뒤 콜드 백업으로 되돌린다 — 그 판단도 사람이 한다.

## 6. 13:23 기동분 정지 관찰 — 원인 미확정 (읽기 전용 조사, 14:0x KST)

| 확인 | 결과 |
| --- | --- |
| 서비스 터미널 | Mercury 관찰: `term_d519113d…` connected=false · writable=false · `exitCause.kind=operator_close`(Mercury 가 닫지 않았다). 누가·왜 닫았는지는 **[미확정]** |
| Postgres 로그 | 13:23:14 PID 37644 기동 → 13:23:15 `the database system is starting up`(복구 중 접속 거부 1건) → 13:23:15 크래시 복구 후 ready → 13:30·13:31 CJ 가입 시도의 중복 오류 2건 → **마지막 줄 13:33:16 checkpoint**. 정상 종료 줄(`shutting down`·`database system is shut down`) **없음** |
| 잠금 파일 | `pgdata\postmaster.pid` 가 PID 37644 · 상태 `ready` 그대로 남아 있고 **그 PID 프로세스는 없다** — 정상 종료가 아니라 프로세스가 사라졌다 **[확정]**. 파일은 지우지 않았다(다음 기동 때 Postgres 가 스스로 교체) |
| Windows 이벤트 | 13:30~14:05 System 로그에 종료·예기치 않은 종료(1074·6006·6008·41 등) 없음 |
| 원인 | **[추론]** 서비스 셸(Orca 터미널 탭) 종료가 그 탭 아래 프로세스(`pg_ctl` 로 띄운 postgres, `cmd` 래퍼 node)를 함께 끝냈을 가능성. 증명하지 못했다 — 단정하지 않는다. 이 dispatch 가 끈 것은 아니다(작업 시작 전부터 리슨 없음) |
| 개인정보 주의 | `postgres.log` 의 제약 위반 `DETAIL` 줄에 가입 시도의 아이디·이메일 값이 평문으로 남는다(Postgres 기본 로그). 값은 여기 옮기지 않았다. 로그 폴더도 아래 ACL 과 같다 |
| 폴더 권한 | QA 폴더·`backup\`·`pgdata\`(상속)에 `CodexSandboxUsers:(RX)` 가 있다 — 003 이전 콜드 백업도 그 그룹이 읽을 수 있다(바꾸지 않았다, 판단 필요). `secrets\` 는 현재 사용자 전용. 새 `cold-backup.ps1` 은 자기 폴더를 사용자 전용으로 만든다 |

**대응(도구만, 기동 안 함)** — 서비스가 Orca 탭 수명에 묶이지 않게 `launch-hidden.ps1` 을 만들었다(7장). 한계: Windows 서비스·예약 작업·자동 시작은 넣지 않았다 —
**PC 로그오프·재부팅 시 멈춘다**. `stop.ps1` 은 그대로 프로세스 단위(포트 소유 PID 확인 뒤 종료)다.

## 7. 운영 도구 — 안전장치와 격리 확인 (14:11 KST, 스크래치에서만 — Mercury 후속 2건·Saturn 지적 1건 반영 뒤)

| 도구 (SHA-256 앞 16자) | 안전장치 | 격리 확인 |
| --- | --- | --- |
| `cold-backup.ps1`(신규, `1aa483435936ab5d`) | **콜드 복사**(pg_dump 아님 — `pg18\bin` 에 pg_dump 없음, Mercury 선택 B). QA 포트 리슨 없음 **그리고** `postmaster.pid` 의 PID 가 살아 있지 않을 때만. 잠금 파일을 지우지 않는다. 새 폴더 `backup\pgdata-cold-pre-004-<시각>` 을 **데이터 복사 전에** 사용자 전용(상속 끊음)으로 만들고 ACL 을 다시 읽어 확인, 실패면 **아직 빈 그 폴더만 비재귀 삭제**(`[IO.Directory]::Delete` — 내용이 있으면 실패할 뿐 지우지 않는다)하고 아무것도 복사하지 않는다. 경로 조작은 `-LiteralPath`, `local.json` 파싱 실패는 고정 문구. 복사 뒤 파일별 SHA-256·크기·개수 전수 비교, 출력은 경로·개수·바이트·매니페스트 해시뿐 | 멈춘 스크래치 클러스터: `files 998 / 998, bytes 42343306, differences 0` · ACL = 현재 사용자 1개 / 살아 있는 PID 잠금 파일 → 거부·폴더 안 생김 / `icacls` 실패 대역 → 고정 문구·폴더 없음 |
| `smtp-setup.ps1`(`f2e7b1ce4a838943`) | 비밀을 쓰기 **전에** 자기 임시 파일을 `CreateNew` 로 만든다 — 이미 `smtp.json.tmp` 가 있으면 덮거나 지우지 않고 중단. 그 파일을 사용자 전용으로 만들고 `icacls` 종료 코드와 `Get-Acl` 을 확인 → 실패면 자기 임시 파일만 삭제·"NOT saved"·기존 `smtp.json` 그대로. 성공하면 쓰고 교체. 경로 조작은 `-LiteralPath` | `icacls` 실패 대역: "NOT saved"·기존 파일 유지·임시 파일 없음 / 사용자 `smtp.json.tmp` 가 있을 때: 중단·그 파일과 기존 `smtp.json` 모두 그대로 (직전 dispatch: 값 미출력·URL 왕복·서버 파싱·Gmail 사전 설정) |
| `start.ps1`(`fee65bf549e024da`) | 준비 게이트(직전) + `local.json`·`smtp.json` 이 깨졌거나 필수 값이 비면 **고정 문구**로 중단(`ConvertFrom-Json` 오류는 원문 조각을 인용하므로 삼킨다). **Saturn 지적 수리**: 자격 증명 환경 변수(`DATABASE_URL`·`DD_SMTP_URL`·`DD_MAIL_FROM`) 설정·`smtp.json` 파싱·서버 실행을 `try/finally` 로 묶어 **어느 경로로 끝나든**(파싱 오류·실행 실패·성공) 지운다 — 살아 있는 셸에서 직접 불러도 남지 않는다 | 사본 폴더 + 스크래치 클러스터: ① 정상 `smtp.json` + 없는 서버 폴더로 **실행 강제 실패** → 세 변수 모두 남지 않음·출력에 값 없음 ② 자격 증명 모양의 깨진 JSON → 고정 문구·변수 남지 않음·18081 리슨 없음 |
| `launch-hidden.ps1`(신규, `2af807d83a0aa8b5`) | `Win32_Process.Create`(WMI)로 `start.ps1` 을 숨김(SW_HIDE) 실행 — 부모가 WMI 호스트라 호출한 셸·Orca 터미널이 닫혀도 무관. 명령줄에 비밀 없음. 출력은 `logs\start-hidden.log`. WMI 반환값·PID 만 출력, 실패면 중단 | 스크래치 탐침 스크립트: ReturnValue 0 · PID 출력 · 탐침의 부모 `cmd.exe` · 조부모 **`WmiPrvSE.exe`** · 로그에 탐침 출력 |
| `ops-004.js`(`7f0f81d890c9fb93`, 5,031 B) | 기본 읽기 전용 · `apply` 는 정확히 001~003(체크섬 = 파일)일 때만 · accounts·sessions·password_resets·db_meta **모든 열** 다이제스트·실행 시점 개수 · 비밀은 프로세스 안에서만(명령줄·환경·로그 없음). **Saturn 지적 수리(14:18)**: 설정 파일 `JSON.parse` 가 최상위에서 예외를 내면 Node 가 입력 조각(비밀번호 포함 가능)을 인용해 출력할 수 있었다 → 파싱·형식 검사(`pgPort` 정수, `user`·`password`·`database` 문자열)를 **연결 전에** 하고 실패는 고정 문구·exit 1. 같은 모양이던 `ops-003.js`(역사 도구, `2a9d6c95ec981de1`)도 같은 가드 | 직전 dispatch 격리 확인(읽기 전용 → 적용 → 재실행 검증만, 모두 exit 0) + 자격 증명 모양의 깨진 가짜 설정(`DD_OPS_CFG`): exit 1 · 고정 문구만 · 값 미출력 · 연결 없음. `ops-003.js` 는 문법 검사만. 실제 `local.json` 이 새 형식 검사를 통과함(형식만 확인, 값 미출력) |

- **[미확정] 실제 받은편지함**: SMTP 제공자·자격 증명 없음(CJ 미정) — 실제 발송은 하지 않았고, 설정 도구의 성공은 메일 도착 증명이 아니다. Render Free 는 외부 SMTP 포트 25·465·587 을 막는다.
- `secrets\` 에는 여전히 `local.json` 하나뿐이다(보존). 콘솔 문자 깨짐을 피하려고 도구 네 개는 ASCII 만 쓴다(PowerShell 5.1 은 BOM 없는 UTF-8 을 ANSI 로 읽는다).

## 8. 이전 기록 — 2026-09-27 07:01 상태 (역사, 현재 아님)

dispatch `ctx_4cb8a50ca037` / task `task_d0cd810fb75c`: 001·002 만 적용된 빈 DB 에 서버를 띄우고 일회용 `qa_probe` 계정으로 가입·로그인·로그아웃을 확인한 뒤
그 계정을 지워 "계정 0 · 세션 0" 으로 넘겼다. 당시 계약은 **복구 코드·기기별 독립 세션**이었고(현재 폐기), 서버·Postgres 는 워커 도구 셸에서 시작됐다.
그 뒤 계정 2개가 생겼고(CJ QA 로 만든 것으로 추정 **[추론]** — 원문은 보지 않았다), 08:1x 확인 때 서버·Postgres 는 이미 내려가 있었다(`postmaster.pid` PID 8876 없음 — 3.1).
