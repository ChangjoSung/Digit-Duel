# #259 서버 계정 인증 — Jupiter 구현 보고

- 작성: 2026-09-26 Jupiter(Claude `claude-opus-5-5`, Ponytail full) · 1차 dispatch `ctx_6806038c9033` / task `task_1e4a4be86895`
  · 후속 dispatch `ctx_1677b6e910db` / task `task_d6ee225b153a` (9장 — 닉네임 CJ 확정 규칙 · 열린 WS 세션 종료 · 공개 배포 Origin 스킴 · #264 링크 CI 차단)
  · 보안 REVISE 수리 dispatch `ctx_8ad5f386a952` / task `task_d35c07119147` (10장 — 옛 자격 로그인·재발급·WS 조회 경합)
  · CJ QA REVISE dispatch `ctx_59a87090fdcb` / task `task_6d0a1d96270f` (11장 — 2026-09-27 단일 로그인·이메일 재설정·복구 코드 폐기·같은 계정 금지)
  · 이메일 중복 허용 dispatch `ctx_ad1ad80c47e5` / task `task_32a952df2238` (12장 — 2026-09-27 CJ 이메일 비유일·재설정 아이디+이메일 쌍·004)
  · 아이디 전용 재설정 dispatch `ctx_f9743718c9f1` / task `task_3f469c4349ff` (13장 — 2026-09-27 CJ 최신 재설정 입력 = 아이디만)
  · 재설정 완료 쿠키 후속 dispatch `ctx_092a40e06500` / task `task_e55f14a4176f` (13.5 — Saturn MEDIUM: 다른 계정 쿠키 보존)
- 작업 트리: `issue-259-accounts` (브랜치 `ChangjoSung/issue-259-accounts`, 기준 `fafc619` — #250 포함)
- 범위: 서버(`server/authoritative`·DB 마이그레이션·테스트·서버 API 문서)만. 클라이언트·Unity·Notion·GitHub·Git 쓰기·배포·Render 생성은 하지 않았다.
- 표기: **[확정]** CJ 결정·실측 · **[추론]** Jupiter 판단(바꿀 수 있음) · **[미확정]** 검증하지 못함 · **[기획 필요]**

> **2026-09-27 현재 계약은 13장 + 12장 + 11장이다.** 13장이 12장의 재설정 입력(`request{userId,email}`·`verify{userId,email,code}`·맞든 틀리든 같은 202)을 **대체**한다 — 12장 재설정 행은 이력이다. 12장이 11장의 이메일 유일·이메일만으로 하는 재설정(`request{email}`·`verify{email,code}`·`E_EMAIL_TAKEN`)을 **대체**한다. 2~3·10장의 복구 코드(발급·365일·재발급·`/recover`·`/recovery-code`)와 "기기별 독립 세션"은 CJ 결정으로 **폐기·대체**됐다. 나머지(닉네임·전송·CSRF·세대 가드·열린 WS 폐기·단일 로그인)는 유지.

## 13. 아이디 전용 재설정 (dispatch `ctx_f9743718c9f1` / task `task_3f469c4349ff`, 2026-09-27)

Preflight(GO 전, Mercury 확인): 세션 JSONL `356905f0-…4aa4.jsonl` · 모델 `claude-opus-5-5` high · `--dangerously-skip-permissions` · Ponytail full. Git 명령 없음.

### 13.1 계약 [확정 — CJ 2026-09-27 최신 · Mars API 합의]

| 항목 | 내용 |
| --- | --- |
| 요청 | `request {userId}` — 이메일 입력 없음(실려 와도 무시). 순서: 형식 밖·없는 아이디 → **404 `E_ID_NOT_FOUND`** + `message:'존재하지 않는 아이디입니다'`(재설정 행·메일 없음, 메일 설정보다 먼저) → 이메일 없는 기존 계정 **409 `E_EMAIL_REQUIRED`**(주소를 지어내지 않음) → 메일 미설정 503 `E_MAIL_UNAVAILABLE` → 재발송 간격·24시간 상한 **429 `E_RATE_LIMITED`** → DB 에 등록된 그 계정 주소로 발송을 **기다린 뒤** 202 `{ok:true}`(주소 미반환). 발송 실패는 코드를 치우고 503 `E_MAIL_UNAVAILABLE`(원문 없음). 아이디 필드가 없거나 빈 값이면 400 |
| 확인 | `verify {userId, code}` — 그 아이디 계정 행의 코드만. 틀림·만료·재사용·상한·없는 아이디는 같은 401 `E_CODE_INVALID` |
| 완료 | `complete {resetToken, newPassword}` 무변경 — 직전 비밀번호 409 문구·전 세션 폐기·자동 로그인 없음 |
| 유지 | 코드 10분·1회(CAS)·코드당 5회·재발송 60초·계정당 24시간 10통·허가 10분·HMAC 저장·IP 예산·전송/CSRF·단일 로그인. 같은 이메일 여러 계정 허용, 교차 계정 코드/허가 불가 |

### 13.2 변경 (서버만 — 마이그레이션·의존성·클라이언트 무수정)

| 파일 | 내용 |
| --- | --- |
| `server/authoritative/accounts.js` | `resetRequest({userId})` 위 순서 · `findAccount` 로 존재·`has_email` 확인 · `pgStore.startReset(accountId, …)` = `WHERE id = $1 AND email IS NOT NULL`(발송 주소는 같은 문장에서 DB 가 준 등록 주소) · `verifyReset(userId, …)` 에서 `email_norm` 조건 제거 · 발송 await · 테스트 훅 `onSendSettled` 삭제 · `ID_NOT_FOUND_MSG` export |
| `server/authoritative/test/test-issue259-accounts.js` | 메모리 대역 같은 계약 · 6·6b·7·8절을 아이디 전용으로(404 문구·메일 미설정보다 404 먼저·실린 이메일 무시·429·발송 실패 503·`E_EMAIL_REQUIRED`) |
| `server/authoritative/test/smoke-issue259-pg.js` | 재설정 요청 본문에서 `email` 제거(1줄) |
| `server/README.md` | API 표·재설정·메일·오류 일반화 문단 |

### 13.3 검증

| 실행 | 결과 |
| --- | --- |
| `node authoritative/test/test-issue259-accounts.js`(메모리, 1회) | **exit 0 · 110 passed, 0 failed** |
| 같은 파일 + `DD_TEST_DATABASE_URL`(스크래치 `initdb` 새 클러스터 127.0.0.1:55473 trust, 실행 후 정지 — **CJ 55459·8081·SMTP 미접촉**) | **exit 0 · 120 passed, 0 failed** — SQL 파라미터 재번호 위험 때문에 1회 |
| `smoke-issue259-pg.js`(같은 스크래치 DB, `DD_SMTP_URL`·`DD_MAIL_FROM` 제거) | **exit 0 · 17 passed, 0 failed** |

메일은 모두 주입 대역(실제 SMTP·계정·설정 무접촉). `npm test` 전체는 돌리지 않았다(범위 밖 파일 무수정).

### 13.4 남은 한계

- [추론] `E_ID_NOT_FOUND` 는 CJ 결정대로 아이디 존재를 알려 준다 — 열거 속도는 IP 예산(버스트 20·초당 1)만 묶는다.
- [추론] 발송을 기다리므로 SMTP 가 느리면 요청이 최대 연결 10초+소켓 20초 걸린다.
- [미확정] 실제 받은편지함 발송은 여전히 미검증(CJ SMTP 미사용). 클라이언트 문구 매핑은 Mars 소관.

### 13.5 후속 — 재설정 완료가 다른 계정 쿠키를 지우던 문제 (dispatch `ctx_092a40e06500` / task `task_e55f14a4176f`)

- [확정 — Saturn MEDIUM 실측] B 로 로그인한 브라우저에서 A 를 재설정하면 완료 200 이 `dd_sid` Max-Age=0 을 보내 B 가 서버 세션은 유효한데 브라우저에서 로그아웃됐다.
- 수정(`accounts.js`만, SQL·스키마·의존성 무변경): `resetComplete(body, carried)` 가 완료 **전에** `resolve(carried)` 로 들고 온 세션을 보고,
  그 세션이 없거나·무효이거나·재설정 계정의 것일 때만 `clear`. A 의 모든 세션·소켓 폐기(세대 revoke), 자동 로그인 없음, 실패 응답(401·409·400)의 무삭제, 로그인·가입·로그아웃 규칙은 그대로.
- 회귀(실제 HTTP, 6b절): B 쿠키를 든 A 완료 → 200·Set-Cookie 없음 · 같은 쿠키로 허가 재사용 401·Set-Cookie 없음 · A 옛 세션 무효·B 유효 · 쿠키 없는 B 완료 → 삭제 쿠키만·새 세션 없음·B 무효·A 유효. 자기 쿠키를 든 완료의 Max-Age=0 은 기존 6절 항목이 계속 확인.
- 검증: 메모리 `test-issue259-accounts.js` 1회 **exit 0 · 111 passed, 0 failed**. PG 는 재실행하지 않았다 — SQL 무변경이라 13.3 의 PG 120/0·스모크 17/0 증거를 재사용한다([추론] `resolve` 는 기존 `findSession` 조회 그대로).

## 12. 이메일 중복 허용 — 이력(재설정 입력은 13장이 대체) (dispatch `ctx_ad1ad80c47e5` / task `task_32a952df2238`, 2026-09-27)

Preflight(GO 전 보고, Mercury 확인): claude.exe PID 27284 명령줄 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions`(부모 cmd 38080 ← Orca daemon-host 1.4.205 PID 14752) · 세션 JSONL `25a9132c-…d0.jsonl` 에 `model: claude-opus-5-5`·`permissionMode: bypassPermissions`·이 task/dispatch id · Ponytail full(SessionStart hook). 작업 트리 HEAD `fafc619`(preflight 때 읽기 전용 `git rev-parse HEAD` 1회 — Worker Git 읽기 금지 규칙 위반이라 여기 밝힌다. 그 뒤 Git 명령 없음).

### 12.1 계약 [확정 — CJ·PD]

| 항목 | 내용 |
| --- | --- |
| 이메일 | 가입 **필수 유지**, **유일하지 않다** — 여러 계정이 같은 주소를 쓸 수 있다. 로그인 아이디·닉네임 유일은 그대로. 기존 계정의 첫 이메일 등록도 다른 계정이 쓰는 주소를 받는다. `E_EMAIL_TAKEN` 은 더 이상 나오지 않는다 |
| 재설정 요청 | `request {userId, email}` — 정확한 정규화 아이디(유일)로 한 계정을 찾고 그 계정의 등록 이메일(소문자 전체 주소)이 같을 때만 그 계정 행에 코드를 건다. 맞든 틀리든 같은 202. 아이디·이메일 형식이 틀리거나 빠지면 400 `E_BAD_INPUT` — **이메일만으로는 어떤 계정도 고르지 않는다** |
| 코드 확인 | `verify {userId, email, code}` — 같은 쌍의 그 계정 행의 코드만 본다. 틀린 코드·없는 아이디·맞지 않는 쌍·아이디 없음은 같은 401 `E_CODE_INVALID`. 코드·시도·허가는 그 한 계정에 묶인다 |
| 완료 | `complete {resetToken, newPassword}` 그대로 — 허가가 그 한 계정에 묶여 있다 |
| 유지 | 10분 TTL·1회 사용(CAS)·코드당 5회·재발송 60초·계정당 24시간 10통·허가 10분·직전 비밀번호 409 문구·전 세션 폐기·자동 로그인 없음·전송(TLS/루프백)·CSRF·IP 예산·일반화 응답. 단일 로그인·60초 재접속·좌석 계정 바인딩 무수정 |

### 12.2 변경 (서버만)

| 파일 | 내용 |
| --- | --- |
| `server/db/migrations/004_email_not_unique.sql` (신규, sha256 `7c1f38e0faae0339…`) | `DROP INDEX accounts_email_norm_key;` 한 줄. 행 변경 없음. `email_norm` 과 CHECK(`= lower(email)`)는 대조 키로 남긴다. 조회가 아이디(유일 인덱스)로 가서 이메일 인덱스는 다시 만들지 않았다 |
| 001·002·003 | **무수정** — sha256 `f358d96b8d61da66…` · `ad46699758242b05…`(로컬 QA 보고의 002 값과 같음) · `9f04799899519b5a…` |
| `server/authoritative/accounts.js` | `pgStore.startReset(userId, email, …)`·`verifyReset(userId, email, …)` 가 `WHERE user_id = $ AND email_norm = $` · `resetRequest`/`resetVerify` 가 `normalizeUserId` 필수 · `taken()`·가입·`setEmail` 에서 이메일 중복 분기 제거 |
| `server/authoritative/test/test-issue259-accounts.js` | 메모리 대역도 같은 계약(아이디+이메일 쌍) · 기존 재설정 시나리오를 쌍으로 · 중복 이메일 기대 뒤집기 · 새 6b 절(아래) |
| `server/authoritative/test/smoke-issue259-pg.js` | 기동 로그·`schema_migrations` 에 004 · 재설정 요청 본문에 아이디 |
| `server/README.md` | API 표·형식·재설정·오류 일반화·저장(004) 갱신 |

### 12.3 검증 — 격리 PG(스크래치 클러스터, 55471 · trust · 매 실행 표 DROP 후 재적용. **CJ PG 55459·8081 미접촉**)

격리 클러스터는 QA 폴더의 `pg18\bin`(18.4) 실행 파일로 스크래치 디렉터리에 `initdb` 한 새 데이터 디렉터리다(CJ `pgdata` 아님).

| 단계 | 결과 |
| --- | --- |
| 기준(수정 전 코드·수정 전 테스트) | PG **109/0** · 메모리 **100/0** |
| **RED** — 새 테스트 + 옛 `accounts.js`·001~003 | PG **exit 1 · 105 passed, 13 failed** — 중복 이메일 가입 201(2) · 이메일만 요청 400 · 쌍/아이디 없음 401 동일 · 004 같은 email_norm 2행 · 쌍의 등록 주소로만 발송 · 교차 계정 코드 401 · A 재설정/B 무영향 4건 · 기존 계정 중복 이메일 첫 등록 · (연쇄) 변경 불가 |
| **GREEN** — 새 코드·004 | PG **exit 0 · 118 passed, 0 failed** · 메모리 **exit 0 · 108 passed, 0 failed** |
| `smoke-issue259-pg.js`(실서버 프로세스, `DD_DB_MIGRATE_ON_START=1` 로 001~004) | **17 passed, 0 failed** — 004 적용 로그·`schema_migrations 001,002,003,004`·단일 로그인·A/B 재접속·재시작 뒤 세션 |
| `npm test`(server 전체, 1회) | **exit 0** — #259 108/0 · authoritative 50 · security-gaps 104 · issue237-economy 109 · #264 DB 회귀 등 전부 0 failed |
| 스크래치 `verify-004-on-003.js`(CJ DB 모양 재현: 001~003 적용 + 계정·세션 행 → 004 **단독** 적용) | 004 전 중복 이메일 23505 · 적용 = `004_email_not_unique.sql` 하나 · 원장 001~003 행(체크섬·applied_at) 불변 · 계정·세션 **모든 열** 전후 동일 · 004 뒤 중복 이메일 삽입 성공 · 아이디·닉네임 중복은 여전히 23505 · `verify()` 통과 |

새 6b 절: A·B 가 같은 이메일(대소문자만 다름)로 가입 201 · [pg] 같은 `email_norm` 2행 · 요청마다 그 쌍의 등록 주소(원형)로만 1통 · 다른 계정 코드는 같은 이메일이어도 401(양방향) · A 재설정 완료 · A 허가 재사용 401 · A 재설정은 A 세션만 끊고 B 세션 유지 · B 의 코드는 A 재설정 뒤에도 살아 확인됨 · B 비밀번호 그대로·A 만 새 비밀번호. 6절 보강: 아이디 없는 요청 400(메일 없음) · 다른 계정 주소와의 쌍 요청 202·메일 없음 · 쌍/아이디 없음 확인 401 동일. 재사용(코드·허가) 거부는 기존 항목 그대로 통과.

### 12.4 운영 도구 (저장소 밖 `C:\Users\pc_77\orca\qa\Digit-Duel\issue-259-local` — 설명만, 저장소 파일 아님)

> **현재 운영 도구·안전장치·격리 확인의 원본은 [local-qa-service.md](local-qa-service.md) 6~7장이다**(후속 dispatch `ctx_46b87f15e92b` / task `task_edd4a177ee8b`, 14:11 KST — 도구만, 제품·테스트·001~004 무수정·SHA 동일).
> 그 dispatch 에서 바뀐 것: `cold-backup.ps1`(004 전 **콜드 복사** — pg_dump 없음, Mercury 선택 B) · `launch-hidden.ps1`(WMI 숨김 독립 기동 — 서비스 탭 닫힘 관찰 대응) ·
> `smtp-setup.ps1` ACL 선확인·자기 임시 파일만(실패 시 저장 안 함·기존 파일 보존) · `start.ps1` 깨진 설정 고정 문구 중단·자격 증명 환경 변수 `try/finally` 삭제(Saturn 지적). 아래 표는 13:58 시점 기록이다.

| 도구 | 변경 | 시험(스크래치에서만) |
| --- | --- | --- |
| `start.ps1` (sha256 `d1334f9de80e1d76…`, 원본 `backup\start.ps1.pre-004-20260927` = `3fe15b322e35c7de…`) | ① **콜드 스타트 준비 게이트**: PG 가 리슨해도 복구 중이면 로그인을 거부해(서버 로그 `오류 코드 57P03` 실측) 서버 기동 게이트가 exit 1 이었다. Node 전에 준비를 기다린다. `pg18\bin` 에 **`pg_isready` 가 없어**(embedded 빌드 — initdb·pg_ctl·postgres 뿐) `pg_ctl -w` 가 쓰는 같은 신호를 본다: `postmaster.pid` 1행 PID 가 살아 있고 8행이 `ready`. 이미 리슨 중이어도 검사, 120초 초과면 중단 ② **SMTP 주입**: `secrets\smtp.json {smtpUrl, mailFrom}` 이 있으면 서버 자식에게만 `DD_SMTP_URL`/`DD_MAIL_FROM` 을 넘기고 곧바로 지운다. 없으면 기존처럼 미설정(503). 값은 출력하지 않는다 | 파서 오류 0 · 실제 `Wait-PgReady` 를 AST 로 뽑아 실행: 살아 있는 `ready` → 통과 · `starting` → 시간 초과 · 죽은 PID + `ready`(옛 잠금 파일) → 시간 초과 · 파일 없음 → 시간 초과 |
| `smtp-setup.ps1` (신규, `3dcbff515420f63b…`) | 매개변수 없는 대화형(명령줄·셸 이력에 비밀 없음). 비밀번호는 `Read-Host -AsSecureString`(가림). 사전 설정: 직접 입력 / **Gmail(`smtp.gmail.com:465`, 앱 비밀번호 — 로컬 QA 입력 선택지일 뿐 제공자 선택 아님)**. 465 → `smtps://`, 그 밖 → `smtp://`(서버가 STARTTLS 강제). 아이디·비밀번호 URL 인코딩, BOM 없는 UTF-8, 파일 ACL 을 현재 사용자 전용으로. 출력은 "설정됨"뿐. **발송하지 않는다** | 가짜 값(`example.test`)으로 `Read-Host` 대역 실행: 출력에 값 없음 · URL 인코딩 왕복 · ACL `pc_77:(F)` 만 · 서버 `smtpMailer` 가 받아 `requireTLS`·인증 디코드 · Gmail → `smtps://…@smtp.gmail.com:465` · 덮어쓰기 N → 그대로. 가짜 파일은 지웠다. 실제 콘솔 가림 입력은 파이프로 대신할 수 없어 CJ 실행 때 확인 |
| `ops-004.js` (신규, `a0a115e8c8b8d433…`, `ops-003.js` 에서 파생) | 기본 = **읽기 전용** 상태 출력 · `apply` 일 때만: 정확히 001·002·003(체크섬 = 파일)이어야 004 적용, 이미 004 면 검증만. 모든 표(accounts·sessions·db_meta·password_resets)의 **모든 열** 행 다이제스트(sha256 앞 16자)·개수·원장 체크섬·이메일 유일 인덱스 유무·이메일 없는 계정 수·공유 주소 수만 출력(원문·해시·토큰 없음). 개수는 실행 시점 실측(가정 없음 — CJ 가 QA 중 계정을 늘렸다). `DD_OPS_CFG` 로 격리 설정 파일 경로만 바꿀 수 있다 | 격리 클러스터에 001~003 + 행 시드 → 읽기 전용 exit 0(무변경) → `apply` exit 0(적용 004, 모든 표 다이제스트 동일, 체크섬 001~004 = 파일, 인덱스 제거) → 재실행 검증만 exit 0. **CJ DB 에는 실행하지 않았다** |

### 12.5 남은 게이트·미확정

- **[확정] CJ DB 004 적용 — 2026-09-27 14:22 KST** (dispatch `ctx_7e886adb01a4` / task `task_89f402545ed9`, Saturn 최종 PASS 뒤 Mercury ops GO): 콜드 복사(1300 파일 차이 0, 사용자 전용) → PG 숨김 기동 → `ops-004.js` 읽기 전용(accounts 4 · sessions 2 · db_meta 3 · password_resets 0, 001~003 체크섬 = 파일) → `apply` 1회(모든 열 다이제스트 전후 동일, 001~004 체크섬 = 파일, 이메일 유일 인덱스 제거) → 서버 숨김 기동·`/readyz ok (db)`. 상세·PID·해시는 [local-qa-service.md](local-qa-service.md) 머리말. 그 전 dispatch 들은 CJ DB 를 건드리지 않았다. 13:23 기동분이 정상 종료 줄 없이 사라진 원인은 미확정(같은 문서 6장).
- **[미확정] 실제 메일 — 받은편지함 게이트 남음**: SMTP 제공자·보낸 사람 주소는 CJ 미정. 자격 증명 없이 실제 발송은 하지 않았다. 로컬 QA 가 `smtp-setup.ps1` 로 설정돼 받은편지함에 코드가 오더라도 그것은 **로컬 준비**일 뿐 Render 배포 준비가 아니다 — **Render Free 는 외부 SMTP 포트 25·465·587 을 막는다**(render.com/docs/free, Mercury 전달). 운영 발송은 제공자·포트/HTTP API 결정 뒤 따로 검증해야 한다.
- **[확정·Mars 의존] 클라이언트**: 재설정 1·2단계 본문에 `userId` 가 필요하다(`request {userId, email}` · `verify {userId, email, code}`). 이메일만 보내는 클라는 400/401 을 받는다. `E_EMAIL_TAKEN` 안내는 더 이상 쓰이지 않는다. 클라 파일은 수정하지 않았다(Mars 소관).
- **[추론] 보안 성질**: 같은 주소를 가진 여러 계정 중 **요청자가 아이디를 아는 계정**만 재설정할 수 있다. 주소 소유자가 권위라는 11.4 의 성질은 그대로(주소를 가진 사람은 그 주소로 등록된 계정의 아이디를 알면 재설정할 수 있다). 코드 요청 202 는 쌍 일치 여부를 드러내지 않는다.
- **되돌리기**: 코드 되돌림 + 적용된 DB 라면 `CREATE UNIQUE INDEX accounts_email_norm_key ON accounts (email_norm);` 와 `DELETE FROM schema_migrations WHERE version = '004'` — 그 사이 중복 이메일이 생겼으면 인덱스 생성이 실패하므로 먼저 중복을 사람이 정리해야 한다(데이터 판단).

## 11. CJ QA REVISE (dispatch `ctx_59a87090fdcb` / task `task_6d0a1d96270f`, 2026-09-27)

Mercury GO(변경 포함)로 착수. Preflight: `claude-opus-5-5` · effort requested high / effective null(워커 안에서 footer 관측 불가 — Mercury JSONL 23:14:14Z 로 Opus 5.5/high 확인) · bypass(full access) · Ponytail full.

### 11.1 원인 — 확정/추론

| 증상 | 판정 |
| --- | --- |
| 다른 로그인이 옛 기기를 끊지 않음 | **[확정·코드]** 로그인 = 세션 추가만, 폐기는 로그아웃·재설정에만 있었다 |
| "다른 계정이 같게 보임 · 재접속 실패" | **[확정·CJ/Mars]** CJ 는 **같은 브라우저 프로필의 Orca 탭 두 개**로 시험했다 — 쿠키 병(`dd_sid`)·`localStorage` 좌석 기록 공유. B 로그인이 A 쿠키를 덮고 A 좌석 기록을 지워, A 탭은 화면만 A 이고 요청은 B → A 좌석 재접속은 쿠키 B ≠ 좌석 A 로 `E_SEAT_TOKEN_INVALID`. **클라이언트 계정 전환 처리 결함(Mars 소관)**. **[확정·코드]** 서버 신원 출처는 WS 업그레이드 시점 쿠키 하나이고, 닉네임은 어떤 게임 프레임에도 없어(클라는 "나/상대"만) 서버 권위 신원을 보여 줄 수단이 없었다 |
| 분리된 두 쿠키 병 | **[확정·테스트]** 서버 바인딩은 올바르다 — A·B 생성/참가 → 양쪽 단절 → 각자 60초 안 재접속, 신원 분리 유지(단일 로그인과 **별개 테스트**, 메모리·실PG·실서버 스모크) |
| 같은 계정 대전 | **[확정·코드]** 막지 않았다(이전 [추론]) |

### 11.2 구현 (서버만 · 새 의존성 nodemailer 1개 — Mercury 승인)

| | 내용 |
| --- | --- |
| 003 (추가만) | `003_email_single_login.sql` — `accounts.login_gen`·`email`·`email_norm`(유일 — **004 로 해제, 12장**, CHECK `= lower(email)`)·복구 열 NOT NULL 해제, `sessions.login_gen`, `password_resets`(계정당 1행). 002 무수정. 적용 순간 계정마다 최신 유효 세션 1개만 유효(행·계정 보존 — 11.5) |
| 단일 로그인 | 로그인 = 한 문장 `UPDATE login_gen+1 WHERE credential_gen = 검증세대` → 그 세대 세션 삽입 + 다른 세션 삭제. 세션 유효 = `credential_gen`·`login_gen` 둘 다 일치 → 동시 로그인은 정확히 하나만 산다. 실패 로그인은 DB 쓰기·폐기 없음 |
| 세대 인지 폐기 | 폐기 기술자 `{accountId, belowLoginGen}` — 그 계정의 **더 낮은 세대**만 끊는다(열린 소켓·진행 중 업그레이드 조회 둘 다). 늦게 끝난 옛 로그인의 폐기가 최신 소켓/조회를 건드리지 못한다. 로그인 교체는 `E_SESSION_ENDED` + `reason:'login_replaced'` + 4003, 그 밖은 reason 없음 |
| 들고 온 쿠키 | 로그인·가입 **성공 뒤에만** 요청이 들고 온 다른 세션을 지우고 `{sessionHash}` 로 그 소켓을 끊는다(다른 계정이어도). 실패는 그대로 둔다 |
| 같은 계정 금지 | `j-`/`p-` 에서 상대 좌석 계정 = 나 → `E_SAME_ACCOUNT`(방·초대 코드 변경 전). 로비 전역 1좌석 규칙은 넣지 않음(Mercury Q1) |
| 공개 닉네임 | 첫 프레임·`room_state` 에 `players:[닉0, 닉1]`(없으면 null). 아이디·이메일·계정 id 는 싣지 않음 |
| 복구 코드 폐기 | `/recover`·`/recovery-code` 삭제(404), 어디서도 발급 안 함 |
| 이메일 | **(12장이 대체 — 이제 비유일)** 가입 필수 · ASCII 254자 · 중복 키 = 소문자 전체 주소(Gmail 점·+ 접기 없음) · 가입 소유 확인 없음(Mercury Q2). 기존 계정은 로그인+현재 비밀번호로 **이메일 없을 때만 1회** 등록(`POST /api/auth/email`), 변경 경로 없음. `hasEmail` 을 가입·로그인·세션 응답에 |
| 재설정 | **(12장이 대체 — 이제 `request{userId,email}`·`verify{userId,email,code}`)** `request{email}` → 항상 202(메일 미설정은 계정 무관 503 `E_MAIL_UNAVAILABLE`) · `verify{email,code}` → `{resetToken}` / 401 `E_CODE_INVALID` · `complete{resetToken,newPassword}` → 200 `{ok:true}` + 쿠키 삭제·전 세션 폐기·자동 로그인 없음 / 409 `E_SAME_PASSWORD` `'직전 비밀번호와 같습니다'`(허가 유지, 서버 scrypt 비교) / 401 `E_RESET_INVALID` |
| 코드 보안 | `crypto.randomInt` 6자리 · HMAC-SHA256(프로세스 키, DB·로그 없음 — ponytail: 재시작 시 대기 코드 무효, 다중 인스턴스면 공유 비밀) · 확인은 한 문장(맞으면 CAS 소비+허가, 틀리면 시도+1) · 완료는 한 문장(허가 CAS 소비+비밀번호+두 세대+1+세션 삭제) · 발송은 응답과 분리, 실패 시 코드 CAS 삭제·원문 오류 삼킴. **PD 구현 기본값**: 10분 · 재발송 60초 · 코드당 5회 · 계정당 24시간 10통 · 허가 10분 |
| 메일 전송 | nodemailer 10.0.10(MIT-0, 의존성 0, Node ≥20 — 공식 문서 nodemailer.com/smtp 기준 `createTransport({url, requireTLS})`, `sendMail` 은 콜백 없으면 Promise). `DD_SMTP_URL`+`DD_MAIL_FROM` 둘 다 있어야 켜짐, `smtp://` 는 STARTTLS 강제, 타임아웃 10/10/20초. 기동 로그는 설정됨/미설정만 |
| 유지 | 기존 `credential_gen` 로그인·재설정 경합 가드, 로그인 시도 제한, IP 예산, 전송·CSRF, DB fail-closed, 60초 유예, 좌석 계정 바인딩 |

### 11.3 검증 (각 1회, 고친 FAIL 만 재실행)

| 명령 | 결과 |
| --- | --- |
| `node authoritative/test/test-issue259-accounts.js` (메모리) | 첫 실행 크래시(테스트 도우미가 500ms 테스트 세션의 `Max-Age=0` 쿠키를 "삭제"로 오판) → 도우미 수정 → 1 FAIL(IP 예산 429, 테스트 순서) → 수정 → **95/0**, nodemailer 실경로 2건 추가 후 **exit 0 · 97 passed, 0 failed** |
| 같은 파일 + 새 embedded PG 18.4(스크래치, 매 실행 새 DB — **CJ DB 아님**; 001·002 적용 → 003 이전 계정·세션 삽입 → 003 적용) | 1 FAIL(pg 전용 조회가 다른 계정 행까지 셈 — 테스트 결함) → 수정 → **exit 0 · 100 passed, 0 failed** |
| `smoke-issue259-pg.js` (실서버 프로세스 + 새 PG) | **exit 0 · 17 passed, 0 failed** — 게이트·001~003 적용·메일 미설정 로그·같은 계정 참가 거부·players·A/B 단절→각자 재접속·다른 곳 로그인 login_replaced·재설정 503·재시작 뒤 세션 |
| 변형(mutation) — 폐기 세대 무시 / 같은 계정 가드 제거 / 진행 중 조회 폐기 제거 | 각각 **R1·R2 FAIL / 같은 계정 5건 FAIL / R3 FAIL** 재현, 원복 후 `cmp` 일치 |
| `npm test` (server 전체) | **exit 0** — authoritative 50 · security-gaps 104 · issue237-economy 109 · #264 DB 회귀 · #259 95 등 전부 통과 |
| `DD_ECONOMY=0 node demo/test/integration/smoke_public_live.js 2` · `smoke_public_eco_live.js` | 첫 실행은 **Mars 진행 중 `demo/js/network.js` 의 `opened` 중복 선언(SyntaxError)** 로 클라 로드 실패 — 서버 원인 아님, 코디네이터에 보고. Mars 수정(08:31) 뒤 **exit 0 · 23/0 · 31/0** |
| `tools/docs/docs_link_check.js` | 문제 0건 |

테스트 항목: 이메일 형식·중복(대소문자)·점/+ 비접기 · 복구 경로 404 · 비밀 경로 원격 평문 거부 5종 · 로그인 교체(옛 세션 무효) · 실패 로그인 무영향 · 동시 로그인 1개만 유효 · 같은 계정 참가 거부 뒤 초대 유효 · players · 프레임에 아이디/이메일/id 없음 · 탈취 거부 · A/B 재접속·교차 거부 · 열린 소켓 login_replaced · 들고 온 쿠키 실패 무영향/성공 시 폐기 · 절대 만료 · R1~R4 경합 · 메일 미설정 503 동일 · 202 동일·등록 주소로만 발송·응답에 코드 없음 · [pg] HMAC 만 저장 · 재발송 간격 · 틀린 코드/없는 주소 동일 401 · 새 코드가 옛 코드 무효화 · 동시 확인 1회 · 재사용 401 · 직전 비밀번호 409 정확 문구·세션/소켓 무영향 · 동시 완료 1회 · 완료 후 쿠키 삭제·무자동로그인·소켓 종료 · 5회 뒤 맞는 코드 401 · 만료 401 · 발송 실패 202·코드 폐기·비밀번호 불변 · 24시간 10통 · 기존 계정(003 이전 세션 유효·hasEmail false·등록 규칙 5종) · DB 장애 503.

### 11.4 운영 조치·미확정

- **[확정] QA 서비스**: GO 직후 `stop.ps1 -ServerOnly` 실행 — 8081 은 이미 미기동이었고 QA Postgres(55459)도 이미 내려가 있었다(`postmaster.pid` 의 PID 8876 없음, `postgres.log` 마지막 07:59 KST, 종료 로그 없음 → 비정상 종료 [추론]). QA pg18 에 `pg_dump` 가 없어 **정지 상태 데이터 디렉터리 콜드 복사**를 저장소 밖 QA 폴더 `backup\pgdata-cold-pre-003-20260927-081718` 에 만들었다(1298파일 · 67,255,326B 원본 일치). PG·서버 재기동 안 함, CJ DB 에 003 미적용·테스트 미실행 — 적용·재기동은 Mercury 통합/QA GO 뒤.
- **[미확정] 실제 메일**: SMTP 설정이 없어(CJ 확인) 받은편지함 발송은 검증하지 않았다. 주입 전송·닿지 않는 SMTP reject 까지만 증명 — **자격 증명 전에는 이메일 재설정 운영 준비 완료라고 말할 수 없다**. 실제 SMTP 의 STARTTLS·인증·스팸 분류는 설정 후 1회 받은편지함 QA 필요.
- **[추론] 한계**: 폐기 알림·OTP 키는 프로세스 단위(인스턴스 1개 전제). 로그인 제한기는 메모리. 가입 `E_ID_TAKEN`/`E_EMAIL_TAKEN` 은 존재를 드러낸다(가입 UX). 이메일 소유 미확인이라 오등록 주소의 주인이 재설정으로 그 계정을 가져갈 수 있다(주소 주인이 권위 — PD 수용).
- **클라이언트 영향(Mars)**: 새 가입 필드 `email`, `hasEmail`, 재설정 3단계, `E_SAME_ACCOUNT`, `players`, `E_SESSION_ENDED.reason`, 복구 코드 UI 제거. 같은 프로필 계정 전환 처리(좌석 기록 공유)는 클라 결함으로 Mars 소관.
- **변경 파일(이번)**: `server/db/migrations/003_email_single_login.sql`(신규) · `server/authoritative/accounts.js` · `server/authoritative/server.js` · `server/authoritative/protocol.js` · `server/authoritative/test/test-issue259-accounts.js` · `server/authoritative/test/smoke-issue259-pg.js` · `server/package.json` · `server/package-lock.json` · `server/README.md` · 이 보고서. 되돌리기: 코드 되돌림 + 적용된 DB 라면 003 롤백 SQL 이 필요하다(새 열·표 DROP — 이메일·재설정 데이터 소실, 002 데이터는 보존).

### 11.5 Saturn MEDIUM 2건 수리 (dispatch `ctx_75492d244be9` / task `task_02c9762a81eb`, 2026-09-27)

Preflight: `claude-opus-5-5` · effort high(settings) · requested/effective null(워커 안에서 footer 관측 불가 — Mercury JSONL 23:52 로 Opus 5.5/high 확인) · bypass · Ponytail full. Mercury GO 뒤 수정.

| 지적 | 원인 [확정] | 수리 |
| --- | --- | --- |
| F1 003 이 002 의 중복 세션을 전부 살려 둠 | 002 는 계정당 세션 수 제한이 없었고 003 은 모든 행을 `login_gen 0` = 계정 0 으로 둬 다음 로그인 전까지 전부 유효 | 003(아직 CJ DB 미적용이라 003 만 수정, 004 없음)에 `UPDATE accounts SET login_gen = 1` + 계정마다 **만료 전·`credential_gen` 현재** 세션 중 `created_at DESC, expires_at DESC, token_hash DESC` 첫 행만 `login_gen = 1`. 행 삭제 없음 — 나머지는 세대 불일치로 무효. 시각 증거: 002 `sessions.created_at DEFAULT now()` = 세션을 만든 로그인·가입·재설정 문장의 트랜잭션 시각, `expires_at` = 그 시각 + 고정 30일(순서 동일), 동률은 해시로 결정적 |
| F2 SMTP URL 질의가 TLS 강제를 덮음 | nodemailer 10.0.10 `createTransport` 가 URL 파싱 결과를 옵션 **위에** 병합하고(dist/cjs/nodemailer.js 70-73, smtp-transport 66-72) 질의 키가 임의 옵션(secure·requireTLS·ignoreTLS·tls.*·debug/logger·service …)을 설정(shared/index.js 309-338) | URL 을 nodemailer 에 넘기지 않는다: WHATWG `URL` 로 smtp:/smtps: 만, 질의·프래그먼트·경로(루트 `/` 제외)·깨진 인코딩이면 null(= 503 E_MAIL_UNAVAILABLE, 값·오류 미출력). 명시 옵션 `{host, port, secure: smtps, requireTLS: !smtps, ignoreTLS: false, auth, 타임아웃}` |

검증(한 스위트·새 가드만, 넓은 스위트 반복 없음 — npm/라이브 증거는 11.3 재사용):

| 단계 | 결과 |
| --- | --- |
| RED 메모리 — 새 테스트 + **옛 accounts.js** | exit 1 · 99/1 — 위험 URL 6개(requireTLS/ignoreTLS·secure·tls.rejectUnauthorized·debug/logger·opportunisticTLS·service)가 최종 옵션에 그대로 |
| RED 새 PG — 새 테스트 + **옛 003** | exit 1 · 106/3 — 위 1건 + `{"A":200,…,"T":200,"U":200}`(더 오래된 유효 세션·동률 두 행 모두 유효) |
| GREEN 메모리 | exit 0 · **100 passed, 0 failed** |
| GREEN 새 PG(스크래치 embedded PG 18.4, 매 실행 새 DB — CJ 55459·8081 미접촉) | exit 0 · **109 passed, 0 failed** |
| 실제 nodemailer 설정 탐침 1회(네트워크·비밀 없음, example.test) | Saturn URL `smtp://example.test:587?requireTLS=false&ignoreTLS=true` → 메일 꺼짐(503) · `smtp://…:587` → `secure false · requireTLS true · ignoreTLS false` · `smtps://…:465` → `secure true` · 최종 옵션에 `url` 없음 |
| 002 SHA-256 | `ad46699758242b05…` 불변 · `git diff --check`(읽기 전용, Mercury 허가) exit 0 · 추적 안 되는 새 파일은 후행 공백·충돌 표식·EOF 수동 검사 |

새 테스트: [pg] 계정1 = 더 오래된 유효(A)·최신 유효(L, 유일 생존)·더 최신 만료(E)·가장 최신 옛 자격(C), 계정2 = `created_at`·`expires_at` 동률 2행(해시 큰 쪽만) · 기존 세션 행 전부 바이트 동일·계정 비밀번호·자격 세대 보존. SMTP = 실제 nodemailer 가 만든 전송의 최종 옵션(위험 URL 9종 거부 또는 안전, smtp:// STARTTLS 필수·인증 디코드, smtps:// TLS·루트 `/` 허용).

- **[미확정] 실제 메일**: 여전히 받은편지함 발송은 검증하지 않았다(SMTP 자격 증명 없음). 설정 조합·주입 전송까지만 증명.
- **[확정] 운영**: 이 수리 dispatch 에서는 CJ DB 를 건드리지 않았다. Saturn 최종 LOCAL PASS 뒤 운영 dispatch `ctx_5c5b353e32c6` 가 2026-09-27 09:06 KST 에 로컬 QA DB 에 003 을 한 번 적용하고(기존 계정 2·세션 1·db_meta 3 행 다이제스트 전후 동일, 유효 세션 계정당 ≤1) Orca 서비스 터미널에서 서버를 다시 열었다 — [local-qa-service.md](local-qa-service.md).
- **수리 변경 파일**: `server/db/migrations/003_email_single_login.sql` · `server/authoritative/accounts.js` · `server/authoritative/test/test-issue259-accounts.js` · `server/README.md` · 이 보고서.


## 1. #264 선행분 이식과 의존 관계

#264(Render Postgres 연결)는 아직 통합 전이라, 형제 작업 트리 `issue-264-render-db-current` 의 **커밋되지 않은 서버 변경을 그대로 복사**한 뒤 그 위에 #259 를 얹었다.
이식 전 두 트리의 서버 차이는 아래 8개 파일뿐이었고(`diff -rq`, node_modules 제외), `server.js` 차이도 #264 hunk(DB require · `/readyz` · 기동 게이트 · `listen()` 분리)만이었다.

**이식 기준 SHA256 (#264 원본 = 이식 직후 #259 트리, 8파일 묶음 해시 `e03f4e1e…96e0` 양쪽 동일)**

| 파일 (`server/`) | #264 원본 SHA256 | #259 최종 상태 |
| --- | --- | --- |
| `db.js` | `857958fc…71255a` | 동일(무수정) |
| `db-migrate.js` | `5b4b41de…3dedd8b` | 동일(무수정) |
| `db/migrations/001_db_meta.sql` | `f358d96b…0bb898` | 동일(무수정) |
| `package-lock.json` | `29e74ad7…468b46f8b` | 동일(무수정) |
| `test-db.js` | `445ccbf1…d709d5e4` | #259 수정 → `dd61ffb1…934a5519` |
| `package.json` | `379f9582…735be2a3` | #259 수정 → `1231039e…abec48` |
| `README.md` | `6003a951…33363d9` | #259 수정 → `15a056aa…7374d5a8` (#264 보고서 링크를 코드 표기로 바꾼 1줄 포함 — 9장) |
| `authoritative/server.js` | `312b374b…a7b05` | #259 수정 → `80b3f774…09207263` |

**재정렬(rebase) 방법**: #264 가 먼저 통합되면, 위 4개 무수정 파일은 #264 커밋과 바이트가 같으므로 사라지고, 남는 #259 델타는
① 새 파일 5개(`authoritative/accounts.js` · `db/migrations/002_accounts.sql` · `authoritative/test/test-issue259-accounts.js` · `authoritative/test/smoke-issue259-pg.js` · 이 보고서)
② 수정 4개(`server.js` · `package.json` · `README.md` · `test-db.js`)의 #259 hunk + #264 이전부터 있던 `authoritative/protocol.js` 한 줄(오류 코드 등록) 뿐이다. #264 원본이 통합 전에 바뀌면 위 SHA 와 비교해 차이를 먼저 확인한다.
**#264 보고서 링크 [확정 · 9장에서 해소]**: 이식한 #264 README 가 이 브랜치에 없는 #264 Jupiter 보고서를 상대 링크로 가리켜 문서 링크 CI 가
실패했다. #264 이력을 복사하지 않고, 이 브랜치 README 의 그 한 줄을 **링크 없는 코드 표기**(경로 + "#264 통합과 함께 들어온다")로 바꿨다.
→ #264 통합 뒤 재정렬할 때 이 README hunk 는 **#264 쪽(링크) 을 채택**하면 된다(#259 는 이 줄에 다른 의도가 없다).
작업 트리가 CRLF(autocrlf=true)라 `package.json` 줄끝을 CRLF 로 맞춰 두었다(새 테스트·SQL 파일은 LF — 커밋 시 정규화된다).

`test-db.js` 수정 이유 **[확정]**: #264 는 "계정 스키마가 섞이지 않았다"를 모든 마이그레이션에 대해 금지하는 범위 가드였다. #259 가 그 스키마를
정당하게 추가하므로 가드를 "001 에는 계정 스키마 없음 · 방/경기 영속화 스키마는 여전히 없음"으로 좁혔다. 나머지 #264 검사는 그대로다.

## 2. 구현 요약

| 항목 | 내용 |
| --- | --- |
| API | `POST /api/auth/signup` · `login` · `logout` · `recover` · `recovery-code`, `GET /api/auth/session` (계약 전문: `server/README.md` "계정 · 로그인 (#259)") |
| 저장 | `002_accounts.sql` — `accounts`(user_id·nickname·password_hash·recovery_hash·recovery_expires_at·recovery_attempts·recovery_locked_until), `sessions`(token_hash·account_id·expires_at) |
| 해시 | 비밀번호·복구 코드 = Node `crypto.scrypt`(N=16384,r=8,p=1, 16B salt, **비동기** — 게임 루프 비차단). 세션 토큰(32B 난수) = sha256. 원문은 어디에도 저장·로그되지 않는다 |
| 원자성 | 가입+세션, 복구(CAS 로 옛 코드 소비 + 새 코드 + 비밀번호 + 그 계정 세션 전부 삭제 + 새 세션)는 **SQL 한 문장(CTE)**. 반쪽 상태 없음 |
| 복구 시도 상한 | 시도는 검증 **전에** `UPDATE … RETURNING` 으로 원자 예약 → 동시 추측 묶음도 5회에서 멈춘다(실제 Postgres 에서 확인) |
| 로그인 상한 | 아이디 키 15분 10회(존재하지 않는 아이디도 동일하게 잠김), 검증 전 예약. + 비밀 값 요청은 IP당 버스트 20·초당 1 |
| 오류 | 로그인·복구 실패는 한 가지 응답(`401 E_AUTH_FAILED`)·같은 scrypt 비용(없는 아이디는 더미 해시와 비교) |
| 쿠키 | `dd_sid`: `HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000`, HTTPS 면 `Secure`. 토큰은 본문에 싣지 않는다 |
| 전송 | 비밀 값 요청은 HTTPS 또는 루프백만. 공개 배포는 `X-Forwarded-Proto: https` **와** `Origin` 의 `https:` 스킴을 둘 다 요구(9장). LAN 평문 = `403 E_INSECURE_TRANSPORT` |
| CSRF | POST + `application/json` + 같은 출처 `Origin` 필수, 본문 2KB 상한. 기존 GET/HEAD 전용 정적 경로는 그대로(POST 405) |
| DB 권위 | DB 없음 = `503 E_ACCOUNTS_DISABLED`, DB 장애 = `503 E_ACCOUNTS_UNAVAILABLE`(원문 오류 비노출). 메모리·SQLite 대체 없음. 기동 게이트(#264)가 002 미적용이면 listen 하지 않는다 |
| WS 바인딩 | DB 서버에서 생성·참가·재접속 업그레이드는 세션 필수(없음 401 · DB 장애 503). 좌석에 계정 id 를 묶고, 재접속은 **같은 계정 세션**일 때만. 다른 계정 + 훔친 좌석 토큰 = `E_SEAT_TOKEN_INVALID`(토큰 오답과 같은 응답), 좌석 회전·교체 **전에** 거부해 원래 연결을 밀어내지 않는다 |
| 열린 WS 세션 종료 | 로그아웃(그 세션 소켓)·재설정(그 계정 전 소켓)·30일 절대 만료 시 `E_SESSION_ENDED` + close 4003, 끝난 소켓 프레임은 처리하지 않는다. 좌석은 60초 유예(9장) |

새 의존성 없음(`pg`·`ws` 는 기존, 인증 프레임워크 없음). `room.js`·`lobby.js`·엔진은 수정하지 않았다 — 좌석 계정은 `server.js` 가 `room.seats[n].accountId` 로 붙인다. `protocol.js` 는 오류 코드 목록에 `E_SESSION_ENDED` 한 줄만 등록했다(목록은 문서용 — 런타임 검사에 쓰이지 않는다).

## 3. CJ 결정 반영 (코디네이터 답변 2026-09-25/26)

| 결정 **[확정]** | 반영 |
| --- | --- |
| 세션 = 로그인 시점부터 절대 30일, 기기별 독립, 로그아웃은 현재 기기만 | `POLICY.sessionTtlMs` · 개수 상한 없음 · `logout` 은 그 토큰 행만 삭제 |
| 로그인 ID 와 별도 **필수 닉네임**(공개 표시 이름) | `accounts.nickname` NOT NULL, 가입 필수 |
| 닉네임 형식(2026-09-26): **완성형 한글 음절 U+AC00–U+D7A3 · ASCII 영문 · 숫자 · `_` 만, 2~12자, NFC 정규화**, 낱자모(`ㄱ`) 불가, 영문 대소문자만 다르면 **같은 닉네임**(`Orca`=`orca`), 중복 금지 | `NICKNAME_RE = /^[가-힣A-Za-z0-9_]{2,12}$/`(NFC 뒤 검사) + 002 CHECK 같은 정규식 + `lower(nickname)` 유일 인덱스 → `409 E_NICKNAME_TAKEN` |
| 복구 코드: 가입 시 1회 표시 · 해시만 저장 · 1회용 · **발급 후 365일 만료**(CJ 확정 — 코디네이터 첫 답의 '무기한'을 정정) · 재발급은 로그인+현재 비밀번호 · 5회 실패 1시간 잠금 · 이메일/ID 단독 재설정 없음 | 그대로. 가입·재설정·재발급 응답에 `recoveryCodeExpiresAt`(ISO 8601) 표시. 만료 코드는 일반 실패 응답. 초안의 세션 10개 상한은 CJ 답변에 따라 제거 |
| 재설정 시 모든 세션 폐기 | 복구 CTE 가 그 계정 세션 전부 삭제 |
| 아이디 소문자 a-z0-9_ 4~20, 비밀번호 8~128 | 앱 검증 + DB CHECK(아이디) |
| DB 서버의 멀티플레이는 로그인 필수, 무DB 는 로컬 회귀/개발용 | WS 게이트. 아래 4장 경계 참조 |

## 4. 의도한 경계와 남은 판단

- **닉네임 형식·비교는 [확정]**(3장). 비교를 `lower()` 로 구현한 것은 CJ 의 "영문 대소문자만 다르면 같은 닉네임"을 옮긴 **구현 해석**이다 — 허용 문자가 ASCII 영문·한글·숫자·`_` 뿐이라 `lower()` 가 바꾸는 것은 ASCII 대문자뿐이다. 닉네임 **변경 가능 여부**는 정해지지 않았다 **[기획 필요]**(현재 변경 API 없음). 규칙이 바뀌면 `NICKNAME_RE` 와 002 CHECK 를 같이 고친다(002 가 어디에도 적용되기 전이면 파일 수정, 이후면 003).
- **[확정] 로비 목록(`l-`)은 로그인 없이** 열린다(읽기 전용). 로그인 필수는 좌석을 얻는 연결에만 건다.
- **[추론] PVE 로그인 필수는 서버가 강제할 수 없다** — PVE 는 서버를 거치지 않는다. Mars 클라이언트가 DB 서버 접속 시 로그인 게이트로 구현해야 한다(계약은 코디네이터에게 전달함, msg_84b8571b8226).
- **[확정] 배포 순서 주의**: DB 붙은 서버에 로그인 UI 없는 현행 클라이언트를 올리면 온라인 방 생성·참가가 401 로 막힌다. Mars 계정 화면과 함께 배포해야 한다.
- **[추론] 닉네임은 아직 방/대전 화면 프레임에 싣지 않았다** — 방·경기 프로토콜 변경이 필요하고 요청 범위(인증)가 아니다. 상대 닉네임 표시가 필요하면 별도 요청.
- **[추론] 같은 계정이 자기 방에 참가(양 좌석 동일 계정)** 는 막지 않았다(기존 의미 유지). 막아야 하면 [기획 필요].
- **[추론] 세션 폐기 알림은 이 프로세스 안에서만 퍼진다** — 로그아웃·재설정이 DB 에 기록된 뒤 같은 프로세스의 열린 소켓을 끊는다(9장). Render 인스턴스 1개 전제이고, 여러 인스턴스로 늘리면 주기적 DB 재확인이나 pub/sub 이 필요하다(`server.js` `ponytail:` 주석).
- **[추론] 로그인 시도 제한은 메모리**라 재시작 시 풀린다(복구 잠금은 DB 라 유지). 공개 배포에서는 IP 가 프록시 하나로 보여 IP당 예산이 인스턴스 공유가 된다(#217 과 같은 한계).
- **[추론] 만료 세션 정리**는 그 계정이 다시 로그인할 때만 한다. 버려진 계정의 만료 행은 남는다 — 쌓이면 주기 정리 추가.
- **[확정] 무DB 경로**: `DATABASE_URL` 없는 서버는 기존 오프라인·LAN·로컬 동작 그대로(기존 테스트·CI 스모크 전부 통과).

## 5. 검증

| 검사 | 결과 |
| --- | --- |
| `node authoritative/test/test-issue259-accounts.js` (메모리 대역) | **108 passed, 0 failed** (후속 dispatch 기준) |
| 같은 파일 + `DD_TEST_DATABASE_URL`(실제 Postgres, `pgStore`+마이그레이션) | **108 passed, 0 failed** (메모리 전용 1건 ↔ pg 전용 2건: DB 비밀 원문 없음 · 002 CHECK 가 `ㄱㄴ`·`日本`·`a b`·`x` 를 23514 로 거부) |
| `smoke-issue259-pg.js` (실제 서버 프로세스 + 실제 Postgres, 2클라이언트) | **13 passed, 0 failed** — 미적용 DB exit 1 · `DD_DB_MIGRATE_ON_START=1` 로 001·002 적용 후 listen · `/readyz ok (db)` · 두 계정 가입 → 생성·초대 참가 → 배치·준비 → play · 다른 계정+훔친 토큰 거부 · 같은 계정 재접속 play 유지 · 재시작 후 세션 복원 · `schema_migrations` 001,002 |
| `npm test` (서버 전체: 기존 19개 + test-db + #259) | **전부 통과** — authoritative 50 · security-gaps 104 · public-deploy · issue237-economy 109 · #264 DB 회귀 등 |
| CI 스모크 `DD_ECONOMY=0 node demo/test/integration/smoke_public_live.js 2` | **23 passed, 0 failed** (CI 와 같은 env. env 없이 돌리면 match start 타임아웃 — CI 가 명시하는 전제) |
| CI 스모크 `node demo/test/integration/smoke_public_eco_live.js` | **31 passed, 0 failed** |
| 잠금 파일 | `package-lock.json` 은 #264 원본과 바이트 동일, `npm ci` 성공 · `npm ci --dry-run` "up to date" · `npm ls --all` 정상(`pg@8.23.0`·`ws@8.21.3`) |
| 문서 링크 `tools/docs/docs_link_check.js` | **문제 0건** (문서 254개 · 내부 링크 1201건) — 9장 수정 후 |
| 변형(mutation) 확인 | 메시지 가드 제거 시 절대 만료 2건 FAIL, 폐기 알림 제거 시 로그아웃·재설정 4건 FAIL → 새 테스트가 실제로 잡는다(원복 후 `cmp` 일치) |
| `diff --check` 상당 | Worker Git 명령 금지라 git 대신 변경 파일 전수에 후행 공백·충돌 표식·EOF 개행 검사 — 위반 0 |

실제 Postgres 는 저장소 밖(스크래치 디렉터리)에 설치한 `embedded-postgres` 18.4 로 돌렸다 — 저장소 의존성에 추가하지 않았다.
검사 항목(테스트 파일이 덮는 것): 해시 형식·원문 미저장·가입/중복 아이디/대소문자 무시 중복 닉네임/입력 검증 6종·세션 복원/위조 토큰·
Origin 없음/다른 출처/비JSON/2KB 초과/메서드/모르는 경로·원격 평문 거부·HTTPS Secure 쿠키·IP당 예산 429·로그인 일반 오류·아이디별
상한·동시 추측 상한·기기별 로그아웃·WS 무세션/위조 세션 401·로비 무로그인·탈취 토큰 거부 + 원래 좌석 유지·같은 계정 재접속·
로그아웃 세션 WS 401·복구 일반 오류·ID 단독 불가·1회용·재설정 시 전 세션 폐기·동시 같은 코드 1회만 성공·5회 잠금과 해제·재발급 로그인/비밀번호
요구·재발급 후 옛 코드 무효·365일 만료 표시·만료 코드 거부와 재발급 회복·DB 장애 시 가입/로그인/세션/WS 전부 503(원문 미노출)·DB 복구 후 세션 유지·무DB 서버 기존 경로.
후속 추가: 닉네임 허용/거부 16종(NFD 한글·낱자모·한자·전각·악센트·반각 가나·제로폭·아랍 숫자·길이)·전송 판정 7종(엣지 HTTPS 허용 · HTTP Origin+위조 XFP 거부 ·
XFP 없음/http · Origin 없음/깨짐 · 로컬 루프백만 · 비공개 배포에서 XFP 무시 · 로컬 TLS)·열린 WS 세션 종료(로그아웃 이 기기만 · 다른 기기 유지 · 재로그인 후 유예 안 재접속 ·
재설정 시 전 기기 · 재설정 새 세션으로 재접속 · 절대 만료 뒤 첫 명령 거부 + 4003 · 만료 쿠키 업그레이드 401 · DB 장애 중 로그아웃 503·소켓 유지·새 업그레이드 503·절대 만료는 계속 적용).

## 6. 검증하지 못한 것 **[미확정]**

- **Render 실배포·Render Postgres**: 생성·결제·배포 금지 범위라 하지 않았다. 내부/외부 URL TLS, `X-Forwarded-Proto` 를 Render 엣지가 실제로 `https` 로 덮어쓰는지, Render 의 HTTP→HTTPS 리디렉트, 실제 쿠키 `Secure` 동작은 실배포에서 확인해야 한다.
- **Postgres 버전**: 로컬 확인은 18.4 뿐이다. 사용한 기능(identity 열·데이터 변경 CTE·`lower()` 식 유일 인덱스·interval 캐스트)은 12+ 에 있다 — Render 버전에서의 실측은 아님.
- **실제 브라우저**: 쿠키가 WS 업그레이드에 실리는지(같은 출처 `SameSite=Strict`)는 `ws` 클라이언트로만 확인했다. 브라우저 확인은 Mars 클라이언트 통합 때.
- **부하**: scrypt 동시 처리량·Free 인스턴스 CPU 에서의 응답 시간은 재지 않았다.
- **공개 배포 전송 전제**: 컨테이너가 Render 엣지로만 닿고 엣지가 `X-Forwarded-Proto` 를 덮어쓴다는 것은 배포 설정의 성질이라 코드·테스트로 증명하지 못한다. 두 헤더(XFP·Origin)는 증거가 아니라 전제 위의 판정이다.
- **4003 클라이언트 처리**: 서버 계약만 정했다. 클라이언트가 4003 에서 자동 재접속을 멈추고 로그인으로 보내는지는 Mars 구현·브라우저 확인 대상(계약 전달 msg_b079227d8ce6).

## 7. 변경 파일

- 이식(#264 원본과 동일): `server/db.js` · `server/db-migrate.js` · `server/db/migrations/001_db_meta.sql` · `server/package-lock.json`
- 이식 후 #259 수정: `server/authoritative/server.js` · `server/package.json` · `server/README.md` · `server/test-db.js`
- 기존 파일 수정: `server/authoritative/protocol.js`(오류 코드 `E_SESSION_ENDED` 등록 1줄)
- 신규: `server/authoritative/accounts.js` · `server/db/migrations/002_accounts.sql` · `server/authoritative/test/test-issue259-accounts.js` · `server/authoritative/test/smoke-issue259-pg.js` · 이 보고서

## 8. 되돌리기(rollback)

- 코드: 이 브랜치의 #259 델타를 되돌리면 #264 상태(계정 없음)로 돌아간다. DB 없는 서버는 애초에 영향이 없다.
- DB: 002 는 새 표 2개만 만든다. 적용된 DB 에서 되돌리려면 `DROP TABLE sessions, accounts; DELETE FROM schema_migrations WHERE version = '002';` (계정 데이터 소실 — QA 용 재생성 가능 데이터 전제). 코드만 되돌리고 DB 를 두면 #264 러너가 "코드가 모르는 버전 002" 로 기동을 막는다(의도된 fail-closed).

## 9. 후속 수정 (dispatch `ctx_1677b6e910db`, 2026-09-26)

| # | 지적 | 수정 | 검증 |
| --- | --- | --- | --- |
| 1 | 닉네임 정규식이 `\p{L}\p{N}` 이라 다른 문자 체계를 받았고, 보고서가 형식을 [추론]으로 적었다 | CJ 확정 규칙 그대로: NFC 정규화 뒤 `^[가-힣A-Za-z0-9_]{2,12}$`(U+AC00–U+D7A3 · ASCII 영문·숫자·`_`), 002 CHECK 도 같은 정규식으로 교체(종전 `char_length` 만), `lower()` 유일 인덱스 유지. README·보고서 [확정] | 허용 3·NFD 1·거부 14종 + pg CHECK 4종 23514 |
| 2 | 업그레이드 뒤 `ws.ddAccount` 만 보관 → 로그아웃·재설정·절대 만료 뒤에도 열린 소켓이 명령 가능 | 세션 해시·만료 시각을 소켓에 싣고 ① 모든 프레임 앞에서 만료·폐기 확인 ② 로그아웃/재설정이 **DB 에 기록된 뒤** 해당 소켓(`sessionHash` / `accountId`)에 `E_SESSION_ENDED` + close 4003 ③ 30초 정리 주기가 명령 없는 만료 소켓도 끊는다. 소켓이 닫히면 기존 `socketClosed` → 60초 유예 그대로(#237), 좌석 계정 바인딩 그대로 | 5b 절 14건 + 변형 확인 6건 FAIL 재현 |
| — | (추가 지적) 공개 배포에서 `X-Forwarded-Proto` 하나로 HTTPS 를 판정 — 평문 HTTP Origin + 위조 XFP 가 비밀번호 경로에 닿았다 | `accounts.transport()`: 공개 배포는 XFP `https` **와** `Origin` `https:` 스킴 둘 다 요구. 직접 컨테이너 접근 불가라는 배포 전제를 코드 주석·README 에 명시(헤더는 증명이 아님) | 전송 판정 7종 |
| 3 | 이 브랜치에 없는 #264 보고서를 README 가 상대 링크로 가리켜 문서 링크 CI 실패 | README 그 줄을 링크 없는 코드 표기로 바꿈(#264 이력 복사 없음). 재정렬 시 #264 쪽 채택(1장) | `docs_link_check` 문제 0건 |

설계 선택 **[추론]**: 매 명령마다 DB 로 세션을 재확인하는 대신, 만료는 소켓에 실은 절대 만료 시각으로(DB 없이도 적용), 폐기는 폐기를 일으키는
유일한 경로(로그아웃·재설정 — 둘 다 이 프로세스)에서 직접 알린다. 명령 경로에 DB 왕복·비동기가 생기지 않는다. DB 장애 중에는 폐기를 기록할
수 없으므로 로그아웃이 503 이고 세션·소켓은 그대로다(DB 가 권위 — 기록 안 된 폐기를 적용한 척하지 않는다). 한계는 4장(인스턴스 1개).

클라이언트 영향: 새 close 4003 / `E_SESSION_ENDED` 계약과 닉네임 규칙을 코디네이터 경유 Mars 에 전달했다(msg_b079227d8ce6). 클라이언트 파일은 수정하지 않았다.

후속 게이트: `npm test` 전부 통과(#259 108/108 · issue237-economy 109 · authoritative 50 · security-gaps 104 · public-deploy · #264 DB 회귀 등) ·
실제 Postgres 18.4 `test-issue259-accounts.js` 108/108 · `smoke-issue259-pg.js` 13/13 · CI 스모크 `smoke_public_live` (DD_ECONOMY=0) 23/23 · `smoke_public_eco_live` 31/31 · 문서 링크 0건.

## 10. 보안 REVISE 수리 (dispatch `ctx_8ad5f386a952`, 2026-09-26)

### 10.1 경과 — 초기 통과와 REVISE 를 구분한다

| 단계 | 근거 | 결과 |
| --- | --- | --- |
| 초기(9장 후속까지) | `test-issue259-accounts.js` 메모리 대역 / 실제 PG | **108 passed, 0 failed** / **108 passed, 0 failed** — 이 스위트에는 아래 경합 순서가 없었다 |
| 보안 REVISE | Saturn `ctx_bc57846fd734` (Mercury 경유) | 옛 비밀번호 검증을 마친 로그인의 `addSession` 을 복구 재설정·세션 전부 삭제 뒤로 미루면 `reset 200 · oldPasswordLogin 200 · oldPasswordSessionValidAfterReset=true`. 추가로 `server.js` 업그레이드 세션 조회(폐기 전 상태) vs 소켓 등록(폐기 알림 뒤) 경합 HIGH |
| Jupiter 독립 재현(수정 전, 저장소 무변경) | 스크래치 `repro_race.js`(실제 `accounts.js` + 지연 저장소) | `{"reset":200,"oldPasswordLogin":200,"oldPasswordSessionValidAfterReset":true}` 재현. **형제 결함 확인**: 복구 코드 재발급도 같은 모양 → `{"reset":200,"oldPasswordReissue":200,"attackerResetWithReissuedCode":200}` — 옛 비밀번호+옛 세션을 쥔 쪽이 피해자 재설정 뒤에도 살아 있는 복구 코드를 얻어 다시 재설정할 수 있었다 |
| 수정 전 회귀 실행 | 새 5c 절을 넣고 **수정 전 코드**로 `node authoritative/test/test-issue259-accounts.js` | **exit 1 · 114 passed, 5 failed** — ①옛 비밀번호 로그인 `login 200 valid true` ②옛 비밀번호 재발급 `reissue 200 stolenReset 200` ③(②의 결과) 재설정 새 코드 사용 불가 ④로그아웃 전 시작 조회 `upgrade 101` ⑤재설정 전 시작 조회 `upgrade 101` |
| A·B 만 적용 | 같은 명령 | **exit 1 · 117 passed, 2 failed** — ④⑤ 남음(A 만으로는 WS 조회 경합이 닫히지 않는다) |
| A·B·C 적용 | 같은 명령 | **exit 0 · 119 passed, 0 failed** |

### 10.2 근본 원인 [확정]

`login` = `findAccount` → 비동기 scrypt 검증 → **조건 없는** `addSession`. 복구 재설정은 한 문장 CTE 로 비밀번호 교체 + 세션 전부 삭제를 하지만
그 삭제는 **그 문장의 스냅샷에 보이는 세션만** 지운다. 그래서 재설정 뒤에(또는 READ COMMITTED 에서 겹쳐 — 세션 FK 가 거는 `FOR KEY SHARE`
는 비밀번호 UPDATE 의 `FOR NO KEY UPDATE` 를 막지 않는다) 들어간 옛 비밀번호 세션이 살아남았다. `reissueRecovery` 도 검증 → 조건 없는
`replaceRecovery` 로 같은 모양이었다. WS 는 업그레이드 조회가 DB 에서 폐기 전 행을 읽은 뒤, 폐기 알림(`endSessions`)이 끝나고 나서 소켓이
등록되면 알림이 그 소켓을 보지 못했다.

### 10.3 수정 (새 라이브러리·구조 없음)

| | 수정 | 왜 모든 순서에서 닫히나 |
| --- | --- | --- |
| A 로그인 | `accounts.credential_gen`(기본 0)·`sessions.credential_gen` 추가. 복구 재설정이 `credential_gen + 1` 하고 새 세션을 새 세대로 넣는다. `findSession` 은 `s.credential_gen = a.credential_gen` 일 때만 유효. `findAccount` 가 세대를 돌려주고, `addSession(id, gen, sess)` 은 `INSERT … SELECT … WHERE id AND credential_gen = gen` — 0행이면 로그인 `401 E_AUTH_FAILED`(쿠키 없음) | 세션 유효성이 조회 시점의 **세대 비교**라 삽입·커밋 순서와 무관하다. 재설정이 먼저 커밋되면 조건 삽입이 0행 → 401. 정말로 겹쳐 옛 세대로 들어가도 그 세션은 즉시 무효(로그인→재설정 순서로 선형화) |
| B 재발급 | `replaceRecovery(id, gen, …)` 을 `WHERE id AND credential_gen = gen` 조건 UPDATE 로. 0행이면 `401 E_AUTH_FAILED` | 같은 행 UPDATE 는 행 잠금으로 직렬화되고 뒤 문장이 조건을 새 행 버전으로 다시 본다. 재설정 먼저 → 재발급 0행. 재발급 먼저 → 재설정의 `recovery_hash` CAS 0행(옛 코드 소진) — 1회용 유지 |
| C WS | `server.js`: 업그레이드마다 조회 기록 `{revoked: []}` 을 `pendingLookups` 에 넣고, `endSessions` 가 진행 중 기록 전부에 폐기(`sessionHash`/`accountId`)를 쌓는다. 조회가 끝나면 기록을 빼고, 결과 세션·계정이 쌓인 폐기에 걸리면 401 | 폐기 알림과 조회 완료 콜백은 같은 JS 스레드의 사건이라 순서가 둘 중 하나다 — 조회가 먼저면 소켓이 이미 `wss.clients` 에 있어 알림이 끊고, 알림이 먼저면 기록이 거부한다. 기록의 수명 = 그 조회의 수명(시계·시간 정리 없음, `Date.now` 동률 오탐 없음). 알림 뒤 **시작된** 조회는 커밋된 DB(삭제·새 세대)를 읽어 스스로 무효 |

변하지 않은 것: 일반 오류(없는 아이디·틀린 비밀번호·경합 패배 모두 `401 E_AUTH_FAILED`)·로그인 시도 제한(성공한 쓰기 뒤에만 초기화)·DB 실패 fail-closed
(`addSession` 실패 = `503`·쿠키 없음)·복구 1회용·9장의 열린 WS 폐기(E_SESSION_ENDED + 4003)·60초 유예·좌석 계정 바인딩.

### 10.4 수리 검증 — 명령·횟수·종료 코드

| 명령 | 결과 |
| --- | --- |
| `node authoritative/test/test-issue259-accounts.js` (메모리 대역) | **exit 0 · 119 passed, 0 failed** |
| 스크래치 `pg/run.mjs` → `DD_TEST_DATABASE_URL=…(embedded PG 18.4, 새 DB) node authoritative/test/test-issue259-accounts.js` | **exit 0 · 120 passed, 0 failed** (pg 전용: 옛 세대 세션 행을 직접 커밋해도 `GET /api/auth/session` 401) |
| 같은 러너 `node authoritative/test/smoke-issue259-pg.js` | **13 passed, 0 failed** (002 새 열 포함 기동 게이트·재시작 후 세션 복원) |
| `npm test` (server — `server.js` WS 경계 변경에 따른 1회) | **exit 0** — #259 119/0 · authoritative 50 · security-gaps 104 · issue237-economy 109 · public-deploy · #264 DB 회귀 등 전부 통과 |
| `DD_ECONOMY=0 node demo/test/integration/smoke_public_live.js 2` | **exit 0 · 23/0** |
| `node demo/test/integration/smoke_public_eco_live.js` | **exit 0 · 31/0** |

새 5c 절 항목: 재설정보다 늦은 옛 비밀번호 로그인 401·쿠키 없음·유효 세션 없음 · 재설정 뒤 새 비밀번호 로그인과 재설정 응답 세션 정상 ·
[pg] 옛 세대 세션 행 무효 · 세션 쓰기 DB 실패 503·쿠키 없음 · 재설정보다 늦은 옛 비밀번호 재발급 401·코드 없음 · 재설정 새 코드 1회 사용 ·
로그아웃/재설정 전에 시작된 업그레이드 조회 401 · 재설정 응답 세션·새 로그인 세션으로 방 생성·명령(오탐 없음) · 다른 계정 로그아웃과 겹친 조회는 통과.
경합 순서는 저장소 메서드 한 번을 붙잡는 `holdOnce`(테스트 안 도구)로 결정적으로 만든다 — 시간 경합에 기대지 않는다.

### 10.5 한계·전제

- **[확정] 002 제자리 수정**: 002 는 배포되지 않은 마이그레이션이라 파일을 고쳤다. 적용된 곳은 이 작업의 **로컬 스크래치 embedded Postgres 테스트 DB 뿐**이며 매 실행 새로 만든다(`DROP … ; up`). Render·운영 DB 는 생성·배포된 적이 없다. 002 가 어디든 적용된 뒤라면 003 으로 추가해야 한다.
- **[추론] 단일 인스턴스 전제**: C 의 폐기 기록과 9장의 열린 소켓 폐기 알림은 이 프로세스 안에서만 퍼진다. 다만 A 의 세대 비교는 DB 에 있으므로 새 연결·재접속·세션 조회는 인스턴스 수와 무관하게 막힌다 — 여러 인스턴스로 늘리면 남는 틈은 "다른 인스턴스에 이미 열린 소켓"뿐이다.
- **[추론] 옛 세대 세션 행**은 무효지만 즉시 지우지 않는다(계정의 다음 재설정·만료 정리 때 사라진다). 공간 문제일 뿐 보안 문제는 아니다.
- **[미확정]** Render·실브라우저·운영 Postgres 버전에서의 실측은 여전히 없다(6장).
