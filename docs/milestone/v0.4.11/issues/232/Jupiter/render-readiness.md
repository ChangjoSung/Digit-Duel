# #232 Render 배포 준비 점검 — Jupiter (읽기 전용 감사)

- 작성: 2026-09-28 14:03 KST · Jupiter(Claude `claude-opus-5-5` high · bypass · Ponytail full) · task_f501d9f6cd1b / ctx_456c8246df4f
- 대상 소스: `issue-238-game-ui` 작업 트리 (세션 시작 스냅샷 HEAD `e1bfdc2` + 미커밋 변경 — Worker Git 명령 미사용, 파일 직접 읽기)
- 비교 대상: `issue-264-render-db-current` 작업 트리(2026-09-25 22:52 최종 수정)
- 범위: 감사만. 제품 코드·계정·PG·SMTP·환경변수·브라우저·서버·Git·Render 자원 **무변경**. 이 문서 1개만 작성.
- 표기: **[확정]** 코드/공식 문서로 확인 · **[추론]** 근거 있는 추정 · **[미확정]** Dashboard·실배포 필요

## 1. #264 변경분이 이미 들어 있나 — 결론: 들어 있다, 옛 서버를 복사하지 말 것

| 항목 | 결과 |
|---|---|
| 264 에만 있는 server 파일 | **0개** [확정] |
| 238 에만 있는 server 파일 | accounts.js · resultOutbox.js · migrations 002~005 · #259~#263·#238 테스트 [확정] |
| 내용 차이(`\r` 제거 후 sha256) | `db.js` `15dae46f11e1`, `db-migrate.js` `5b4b41defc2e` — **259·264·238 세 트리 동일** [확정]. `001_db_meta.sql`·`db-migrate.js` 원본 바이트 차이는 줄바꿈(CRLF/LF)뿐 |
| `server.js` | 238 이 264 의 상위 집합(DB 기동 게이트·`/readyz`·`DD_DB_MIGRATE_ON_START` + 계정·아웃박스) [확정] |
| PR269 포함 여부 | 259 트리의 db 계층이 264 와 동일하므로 #264 런타임은 #259(PR269) 계보로 이미 넘어갔다 [추론 — 커밋 단위 대조는 Mercury Git 읽기 필요] |

→ 264 트리에서 가져올 **런타임 코드는 없다**. 264 의 남은 가치는 `docs/milestone/v0.4.11/issues/264/**` 기록뿐이다(보존 여부는 Mercury 정리 판단).

## 2. Render 준비 판정표

기준 공식 문서: [Free](https://render.com/docs/free) · [Web Services](https://render.com/docs/web-services) (2026-09-28 조회)

| # | 항목 | 코드 | 판정 |
|---|---|---|---|
| 1 | PORT / 0.0.0.0 | `server.js:39` `DD_AUTH_PORT‖PORT‖8081` · `server.js:46` + `security.js:53` 공개 배포 옵트인이면 기본 bind `0.0.0.0`. 공식: 0.0.0.0 필수·PORT 기본 10000 | **코드 GO** [확정] — `DD_AUTH_PORT` 를 Render 에 넣지 말 것 |
| 2 | HTTP+WS 단일 출처 | 같은 `http.Server` 에 정적·`/api/auth·profile`·`/healthz`·`/readyz`, upgrade 는 `/` 만(`server.js:246-263`). 공식: WebSocket 지원 | **코드 GO** [확정] |
| 3 | Host/Origin/TLS 신뢰 | `DD_AUTH_PUBLIC_DEPLOY=1`+`DD_AUTH_PUBLIC_HOST` 없으면 exit 1(`server.js:598-600`). 피어 IP 미검사, Host 허용목록·Origin 동일출처(`security.js:298`). 비밀 경로는 `X-Forwarded-Proto: https` **그리고** `Origin` https 일 때만(`accounts.js:577-586`). 공식: LB 가 TLS 종료·HTTPS 자동 리다이렉트·XFP 헤더 제공 | **코드 GO** [확정] · 실제 배정 도메인 = `DD_AUTH_PUBLIC_HOST` **설정 대기** [미확정]. XFP 경로 자동 테스트 없음(§4) |
| 4 | DATABASE_URL·스키마 005 fail-closed·readiness | URL 있으면 연결→(옵트인 시 up)→`verify` 통과 전 listen 안 함, 실패 exit 1(`server.js:605-626`, `db-migrate.js:127`). `/healthz`=프로세스, `/readyz`=DB 왕복(`server.js:145-160`). 내부 URL `dpg-…-a` 평문 허용, 외부 호스트는 TLS 강등 거부(`db.js`) | **코드 GO** [확정]. Render Shell 이 없는 Free 에서는 `DD_DB_MIGRATE_ON_START=1` 필요 — **설정 대기** |
| 5 | 계정·프로필 영속 vs 방·아웃박스 | 계정·세션·재설정·전적 = PG(002~005). 방·경기 = 메모리. 결과 아웃박스 = 로컬 파일(`server.js:86-91`, 기본 `server/data/`). 공식: Free 는 재배포·재시작·휴면 시 파일 소실, 영구 디스크 불가 | **알려진 한계** [확정] — DB 장애 중 재시작된 미저장 결과는 Free 에서 잃는다(`resultOutbox.js:4`, README:220 에 이미 명시). 진행 중 경기는 재시작·휴면마다 소실 |
| 6 | 재시작·재접속 | SIGTERM 처리기 없음 → 기본 즉시 종료 [확정]. 아웃박스는 줄마다 fsync 라 같은 디스크면 복구, 기동 시 `flushPending`(`server.js:615-617`). EPOCH 가 매 기동 새로 생겨 옛 좌석 토큰 재개 불가 [확정]. 공식: Free 는 15분 무수신(HTTP·WS 메시지 포함) 휴면, "언제든 재시작 가능" | **한계 수용 필요** — 코드 결함 아님. 휴면 복귀 시 약 1분 지연 [공식 요약·Mercury #264 기록] |
| 7 | 단일 인스턴스 | 방·로비·IP 한도·아웃박스가 프로세스 메모리/로컬 파일 — 수평 확장 불가 [확정]. 공식: 무중단 배포 중 구·신 인스턴스가 잠깐 겹친다 [추론: 겹침 동안 구 인스턴스의 방은 신 인스턴스로 옮겨지지 않음] | **제약** — 인스턴스 수 1 고정, 확장 금지를 운영 규칙으로 |
| 8 | build/start/정적 루트/네이티브 의존성 | `npm ci --prefix server`·`npm start --prefix server`(`render.yaml:57-58`). 정적 루트 = 저장소 `demo/`(`server.js:52`), 엔진이 `demo/js/*.js` 를 런타임에 읽음(`engine.js:3-5`) → **Root Directory = 저장소 루트 필수**. 의존성 nodemailer·pg·ws 모두 순수 JS(lock 에 install script 없음) | **코드 GO** [확정]. `engines` 미지정 → Render 기본 Node 버전 사용 [미확정] |
| 9 | 마이그레이션 | 기동 게이트가 001~005 전부·체크섬 일치를 요구 | **조건부 위험 — §3 F1** |
| 10 | SMTP | `DD_SMTP_URL`+`DD_MAIL_FROM` 둘 다 있을 때만 메일 켬(`accounts.js:108-121`). 포트 기본 587/465. 전송 실패 시 코드 폐기 후 503 `E_MAIL_UNAVAILABLE`(`accounts.js:439-446`) | **Free 에서 불가** [확정 — 공식: Free Web 은 25·465·587 외부 전송 차단]. 코드는 fail-closed 로 안전하게 503. 비밀번호 재설정은 Free Web 에서 동작하지 않는다 |
| 11 | 요금제 | `render.yaml:55` `plan: free`, PG 는 Blueprint 에 없음 | **CJ 결정 대기** — Free PG 는 생성 30일 뒤 만료(+14일 유예 후 삭제)·백업 없음 [확정]. 실제 plan·branch·auto-deploy 는 PD Dashboard 조회 몫 |

## 3. 구체 결함·권고 (최소 범위)

**F1 — 마이그레이션 체크섬이 줄바꿈에 민감 (조건부 기동 차단)**
- 근거 [확정]: `db-migrate.js:37,47-48` 가 `.sql` 원본 바이트 그대로 sha256. 이 PC 는 `~/.gitconfig` `core.autocrlf=true`, `.gitattributes` 에 `server/db/**` 규칙 없음. 238 트리의 001~005 는 모두 CRLF, 264 트리 001 은 LF.
- 실패 시나리오 [추론: 저장소 blob 은 LF]: Windows 체크아웃에서 `npm run db:migrate` 를 Render DB 외부 URL 로 실행 → 원장에 CRLF 해시 기록 → Render(Linux, LF 체크아웃)가 기동 시 `verify` 에서 "내용이 바뀐 마이그레이션" → exit 1, 서비스가 뜨지 않는다. 반대로 Render 에서 `DD_DB_MIGRATE_ON_START=1` 로 적용하면 문제없다.
- 권고: **지금은 설정으로 회피** — Render DB 마이그레이션은 Render 기동(`DD_DB_MIGRATE_ON_START=1`)으로만 적용하고 Windows 에서 원격 `db:migrate` 금지. 코드 수정이 필요해지면 소유자 Jupiter, 1줄: `loadMigrations` 에서 해시 전 `sql.replace(/\r\n/g, '\n')` + `test-db.js` 단언 1개(CRLF·LF 같은 해시). 단, 이미 Windows 에서 적용한 로컬 QA DB 는 그 뒤 재생성 필요. Mercury 가 `git ls-files --eol server/db/migrations` 로 blob 줄바꿈을 확인하면 [추론]이 [확정]이 된다.

**F2 — `render.yaml` 이 현재 서버보다 낡았다 (문서·설정, 코드 결함 아님)**
- `render.yaml:11-12` 주석이 엔진의 `demo/test/shared/harness.js` require 를 전제로 서술 — #245 이후 실제는 `demo/js/*.js`(결론 "루트 디렉터리 = 저장소 루트"는 그대로 맞음).
- `envVars` 에 `DATABASE_URL`(fromDatabase)·`DD_DB_MIGRATE_ON_START`·`DD_SMTP_URL`/`DD_MAIL_FROM`·`DD_RESULT_OUTBOX` 가 없다. Blueprint 를 실제로 쓰는지 [미확정] — Dashboard 직접 설정이면 PD 조회값이 원본.
- 권고: 배포 승인 시 Mercury/Jupiter 가 주석 1곳 정정 + 실제 채택 환경변수만 반영. 지금 추가하지 않는다(YAGNI — plan·DB 결정 전).

**F3 — 자동 배포 트리거 확인 필요 (운영 게이트)**
- `render.yaml:60` `autoDeployTrigger: checksPass`. 서비스의 배포 브랜치가 `milestone/v0.4.11` 또는 `dev` 이면 이번 통합 병합이 곧 배포가 된다. PD Dashboard 조회에서 branch=main(또는 auto-deploy off)인지 먼저 확인하고, 아니면 병합 전 auto-deploy 를 끄는 것을 CJ 에 질의. [미확정]

**F4 — Free Web 에서는 비밀번호 재설정 메일 불가 (플랜 결정)**
- Gmail 앱 비밀번호 SMTP(587/465)는 Free Web 에서 차단된다 [확정]. 코드 선택지는 (a) 유료 Web(Starter 이상) 또는 (b) HTTPS API 메일 발송 추가. (b)는 새 공급자·새 코드라 **[기획 필요]/CJ 결정** — 이 감사는 공급자를 바꾸지 않았다. Free 로 가면 재설정 요청은 503 이 정상 동작이다.

코드 차단 결함(배포 전 필수 수정)은 **없음**. F1 은 설정 규칙으로 회피 가능하므로 에스컬레이션하지 않는다.

## 4. 통합 후 fresh Saturn 용 로컬 공개배포 시뮬레이션 QA 계획 (최소)

재사용: 기존 `test-public-deploy.js`(무DB 공개 배포·Host 게이트)는 중복 실행하지 않는다. 새로 볼 것은 **공개 배포 + DB + TLS 전달 헤더** 조합뿐이다. 임시 embedded PG(스크래치패드) · 비공개 임시 아웃박스 경로 · 실제 SMTP/Render 미사용.

1. **기동 게이트**: `PORT=10000 DD_AUTH_PUBLIC_DEPLOY=1 DD_AUTH_PUBLIC_HOST=dd-qa.example DATABASE_URL=<빈 임시 PG> DD_DB_MIGRATE_ON_START=1 npm start --prefix server` → listen `0.0.0.0:10000`, 로그 "001~005 적용", `/readyz` = `ok (db)`. 같은 DB 로 `DD_DB_MIGRATE_ON_START` 없이 재기동 → 적용 0·정상 기동. 원장에서 005 행 하나 지우고 재기동 → exit 1(미적용).
2. **F1 재현**: 001 파일을 LF↔CRLF 로 바꾼 사본 디렉터리로 `verify` 호출 → 현재 코드는 drift 로 실패함을 기록(수정 여부는 CJ/PD 판단 전 관찰만).
3. **프록시 신뢰**: `Host: dd-qa.example` 없는/다른 Host → 400. 회원가입 POST 에 `X-Forwarded-Proto: https`+`Origin: https://dd-qa.example` → 성공, XFP 누락 또는 Origin `http://` → 403 `E_INSECURE_TRANSPORT`, 다른 Origin → 403.
4. **단일 출처 WS**: 같은 Host 로 로그인 후 `ws://127.0.0.1:10000/` upgrade(Host·Origin 헤더 지정) → 방 생성·입장, 다른 Origin → 403.
5. **메일 차단 모사**: `DD_SMTP_URL=smtp://u:p@127.0.0.1:<닫힌 포트>` → 재설정 요청 503 `E_MAIL_UNAVAILABLE`, 재설정 코드 행 폐기, 로그에 자격 원문 없음. 미설정 시 기동 로그 "미설정".
6. **재시작 수명주기**: 경기 1판 종료 직후 PG 중지 → 결과가 아웃박스에 남음 → 서버 재기동(같은 아웃박스 경로)+PG 복구 → 전적 1회만 기록. 아웃박스 파일 삭제(=Free 재배포 모사) 후 재기동 → 그 결과는 사라짐을 **한계로 기록**(FAIL 아님). 재기동 후 옛 좌석 토큰 재개는 거부되는지 확인.
7. **Git 무변경·리스너 종료**: 테스트 후 임시 PG·서버 프로세스 종료, 파일 수정 0.

판정 기준: 1·3·4·5 는 PASS 필수. 2·6 은 관찰 기록(한계 확인). 실 Render·실 HTTPS·실 브라우저 인터넷 경로는 **배포 미시험**으로 남긴다.

## 5. 상태 요약

| 구분 | 내용 |
|---|---|
| 코드 GO | PORT/bind · 단일 출처 HTTP+WS · Host/Origin/XFP 경계 · DB fail-closed 기동·`/readyz` · 빌드/시작 명령 · 순수 JS 의존성 |
| 설정 대기 | 실제 도메인→`DD_AUTH_PUBLIC_HOST` · `DATABASE_URL`(내부 URL) · `DD_DB_MIGRATE_ON_START=1` · SMTP(유료 Web 에서만 의미) · 인스턴스 1 · auto-deploy 브랜치 |
| CJ 결정 | Free vs 유료(Web SMTP·영구 디스크, PG 만료·백업) · 메일 경로(F4) |
| 배포 미시험 | 실제 Render 기동·HTTPS·WS·휴면 복귀·재배포 중 겹침 |
