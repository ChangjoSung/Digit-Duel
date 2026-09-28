# Digit Dual PVP 릴레이 서버

1:1 자동 매칭·릴레이 서버 + 데모 클라이언트(`../demo`) 정적 서빙.
서버는 게임 내용을 해석하지 않는 비권위 릴레이이며, 클라이언트는 시드 락스텝으로 동기화한다.

## 실행

Windows 는 실행기를 더블클릭한다. 모드는 실행기가 결정하고, 창 제목과 배너에 현재 모드가 표시된다.

| 실행기 | 모드 | 접속 허용 대상 |
| --- | --- | --- |
| `서버시작.bat` | 로컬 전용 (기본) | 서버를 켠 이 PC 만 |
| `LAN서버시작.bat` | LAN 공개 | 같은 공유기의 사설 대역만 |

두 실행기는 각각 목적이 하나로 고정돼 있다. 모드를 바꾸는 옵션은 없고, **어느 파일을 더블클릭했는지가
곧 모드다.** LAN 공개는 환경 변수를 영구 설정하지 않으므로 그 창이 살아 있는 동안만 유효하고, 창을
닫으면 다음 실행은 다시 로컬 전용이다. Windows 방화벽 규칙·포트포워딩·브라우저 설정은 어느 실행기도
바꾸지 않는다.

최초 실행 시 의존성은 자동 설치되고, 설치가 실패하면 서버를 띄우지 않는다.

터미널에서 직접 실행하려면(코드 접속 릴레이): `npm install` 후 `npm run start:relay` (로컬 전용) · `npm run start:relay:lan` (LAN 공개).

### 공개 대전 서버 (#217 서버 권위, 기본 8081)

공개 로비·서버 권위 대전은 별도 서버 `authoritative/server.js` 가 맡는다. 게임 페이지도 이 서버가 직접 서빙하므로
**`http://127.0.0.1:8081` 을 브라우저로 열면** 페이지의 기본 접속 주소가 곧 이 서버다(접속 코드 없음).

| 실행 | 모드 |
| --- | --- |
| `공개서버시작.bat` · `npm start` | 공개 대전 — 로컬 전용 |
| `공개LAN서버시작.bat` · `npm run start:lan` | 공개 대전 — LAN 공개(사설 대역만) |

두 서버는 포트가 달라(릴레이 8080 · 공개 8081) 동시에 켤 수 있다. 프로토콜·검증 범위는
`docs/milestone/v0.4.10/issues/217/Jupiter/protocol.md` 가 원본이다.

#### 공개 배포(WAN) 옵트인 — Render 등 리버스 프록시 뒤 (#217 deploy-readiness)

기본(미설정)은 위 로컬/LAN 동작 그대로다. 아래 옵트인은 `authoritative/server.js` 전용이며 코드 접속
릴레이(`server.js`)에는 영향이 없다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | (없음) | 플랫폼(Render 등)이 주입하는 포트. `DD_AUTH_PORT` 가 없을 때만 쓴다 |
| `DD_AUTH_PORT` | `8081` | 명시하면 `PORT` 보다 우선(기존 로컬/LAN 실행기·문서 그대로) |
| `DD_AUTH_PUBLIC_DEPLOY` | (없음) | `1` 이면 리버스 프록시 뒤 배포 모드. 소켓 피어 IP 검사를 건너뛰고 Host·Origin·좌석 토큰만으로 막는다. `DD_AUTH_PUBLIC_HOST` 없이 켜면 기동을 중단한다 |
| `DD_AUTH_PUBLIC_HOST` | (없음) | 배포 도메인. 스킴·포트·경로 없이 호스트명만(`my-service.onrender.com`). 형식이 어긋나거나 사설/루프백 주소면 기동을 중단한다 |
| `DD_AUTH_BIND` | 옵트인별 기본값 | 명시 지정 시 IP 리터럴만(위 릴레이 규칙과 동일 판정 함수 공유) |

```
DD_AUTH_PUBLIC_DEPLOY=1 DD_AUTH_PUBLIC_HOST=<배정된 도메인> npm start
# 저장소 루트에서 그대로 실행하려면(Render Start Command와 같은 형태): npm start --prefix server
```

`DD_AUTH_PUBLIC_DEPLOY=1` 인 배포에서는 소켓의 직접 피어(`creatorIp` 포함)가 항상 리버스 프록시이지
실제 클라이언트가 아니므로, `httpBuckets`·`upgradeBuckets`·`connectionsByIp`·`authLimiter`·
`Lobby.maxOpenPublicPerIp` 의 "IP당" 한도가 실제로는 이 인스턴스 전체가 나눠 쓰는 **공유 한도**가
된다(가용성 저하일 뿐 인증 우회는 아니다). 런타임 임의 완화 없이 현재 코드 기본값을 그대로 적으면:
동시에 열려 있는(대기 중) 공개 방은 **인스턴스 전체 통틀어 2개**(`maxOpenPublicPerIp`, 기본값 — 서로
다른 사용자 둘이 각자 방을 열면 셋째 사용자의 "새 방 만들기"부터 거부된다), WebSocket 동시 연결 전체
64·공유 한도당 8(`DD_AUTH_MAX_CONNECTIONS`/`_PER_IP`), 정적 HTTP 버스트 288 토큰(초당 96 회복),
WS 업그레이드 분당 60회, 인증 실패 5분에 10회로 차단. `X-Forwarded-For` 로 원 클라이언트 IP를 복원해
이 한도들을 사람 단위로 세분화하는 방식은 프록시가 그 헤더를 조작 불가하게 덮어쓰는지 이 프로젝트가
검증하지 못했으므로 **임의로 신뢰하지 않는다.**

**클라이언트 주소 판정 재확인(정정)**: 공개 방(생성·목록·참가·재개)은 전부 `netOpenCredentialSocket()`
한 곳만 거치며(`demo/index.html`), 이 함수는 `netPublicAddr()`(= `location.host`)에 `location.protocol`
기준으로 `ws:`/`wss:`를 붙일 뿐 도메인 이름을 거부하는 판정(`netParseAddr`)을 전혀 거치지 않는다. 그
판정은 위 "클라이언트 쪽 목적지 제한 (#63)"에 적힌 **구 코드 접속 릴레이**(수동 주소 입력, `server.js`
8080 전용) UI에만 쓰인다 — 의도된 설계이고 이 공개 배포 경로와는 무관하다. 즉 **공개 방 기능은 도메인
배포 자체로 막히지 않으며, 이를 풀기 위한 별도 클라이언트 수정이나 CJ 승인은 필요하지 않다.** 다만 이
경로가 실제 인터넷 클라이언트 ↔ Render 배포 사이에서 브라우저로 끝까지 검증된 적은 이 세션에서 없다 —
실배포 후 실제 접속 확인이 남은 항목이다. 전체 근거는
[`docs/milestone/v0.4.10/issues/217/Jupiter/deploy-readiness.md`](../docs/milestone/v0.4.10/issues/217/Jupiter/deploy-readiness.md)에 있다.

#### QA용 Postgres 연결 (선택 · #264)

`DATABASE_URL` 이 **없으면 DB 기능은 전부 꺼져 있고 위 동작이 그대로다** — 오프라인·LAN·현재 배포는
아무 것도 달라지지 않는다. 방·경기 영속화는 이 범위에 없다(별도 승인). `DATABASE_URL` 이 있으면 아래 계정(#259)이 켜진다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `DATABASE_URL` | (없음) | `postgres://…` DSN. **Git·Issue·로그에 적지 않는다** — 플랫폼 환경변수로만 주입한다 |
| `DD_DB_CA_CERT` | (없음) | 플랫폼 CA 가 시스템 신뢰 저장소에 없을 때 쓸 CA 파일 경로 |
| `DD_DB_POOL_MAX` | `3` | 커넥션 풀 상한 (Free Postgres 연결 수가 넉넉하지 않다) |
| `DD_DB_CONNECT_TIMEOUT_MS` | `10000` | 연결 시도 제한 |
| `DD_DB_MIGRATE_ON_START` | (없음) | `1` 이면 기동 시 미적용 마이그레이션을 적용한다. Free 인스턴스에는 셸이 없어 남겨 둔 옵트인이며, 기본은 **적용하지 않고 검사만** 한다 |
| `DD_SMTP_URL` | (없음) | #259 비밀번호 재설정 메일용 SMTP `smtp://user:pass@host:587`(STARTTLS 필수) 또는 `smtps://…:465`(처음부터 TLS). **질의(`?…`)·프래그먼트·경로가 있으면 잘못된 설정으로 메일을 끈다**(503). 자격 증명이 들어 있다 — **Git·Issue·로그에 적지 않는다** |
| `DD_MAIL_FROM` | (없음) | 재설정 메일 보낸 사람 주소. `DD_SMTP_URL` 과 **둘 다** 있어야 메일이 켜진다(없으면 재설정 요청 503 `E_MAIL_UNAVAILABLE`) |

TLS 는 호스트 종류와 `sslmode` 로 정한다. 호스트 분류는 **허용 목록**이다 — 어느 칸에도 들지 않는 호스트는
평문으로도 TLS 로도 붙지 않고 기동을 멈춘다.

| 호스트 | `sslmode` 미지정·`disable`·`allow` | `require`·`prefer` | `verify-ca`·`verify-full` |
| --- | --- | --- | --- |
| 내부: Render 내부 URL 형태 `dpg-<영숫자>-a`(Render 연결 문서의 예시 형식 — 실배포 URL 로는 미확인) · `localhost` · `127.0.0.1` · `[::1]` | 평문 | 암호화 on · 인증서 검증은 `DD_DB_CA_CERT` 가 있을 때만(없으면 미검증임을 기동 로그에 적는다) | 검증 on |
| 외부: 점으로 이은 DNS 이름 · IPv4 리터럴(사설 포함) · `[::1]` 밖의 모든 IPv6 리터럴 | 미지정은 **검증 on**, `disable`·`allow` 는 **기동 중단 (`ssl_downgrade`)** | `require` 는 **검증 on**, `prefer` 는 **기동 중단** | **검증 on** |
| 그 밖 — 다른 한 단어 이름(`db`·`postgres`), resolver 가 IPv4 로 읽는 비정규 숫자(`0x08080808`·`0177.1`), 밑줄·퍼센트 인코딩 등 | **기동 중단 (`bad_host`)** | ← | ← |

`sslmode` 는 libpq 가 아는 여섯 값만 받는다. 오타(`requre`)·`pg` 전용 값(`no-verify`)·빈 값·중복 지정은 호스트와 무관하게
**기동 중단 (`bad_sslmode`)** 이다 — 모르는 값을 평문으로 해석하지 않는다. DSN 파싱이나 퍼센트 디코딩이 실패하면
`malformed` 로 멈추고, 오류 문구에는 사유 코드만 남는다(DSN 조각을 싣지 않는다).

Render 공식 문서는 내부 연결도 TLS 를 받아들이지만 인증서가 self-signed 라고 설명한다 — 그래서 내부
`require` 를 평문으로 깎지 않고 "암호화만" 으로 올린다. `DD_DB_CA_CERT` 를 지정했는데 읽을 수 없으면
조용히 시스템 CA 로 내려가지 않고 거부한다(`ca_unreadable`).

DSN 은 `pg` 에 `connectionString` 으로 넘기지 않고 직접 파싱해 개별 필드로 넘긴다 — `pg` 는
connectionString 파싱 결과를 명시 옵션 위에 덮어써서, DSN 의 `?sslmode=disable` 이 켜 둔 TLS 를 끌 수 있다.

fail-closed 세 층 — ① `DATABASE_URL` 이 있는데 연결·스키마 확인이 실패하면 **listen 하지 않고 종료**한다,
② `db.query()` 는 비활성·설정 오류·장애를 전부 reject 한다(빈 결과로 바꾸지 않는다), ③ `/readyz` 가 DB
왕복을 실제로 해 보고 실패 시 503 을 낸다. `/healthz` 는 DB 와 무관하게 200 `ok` 를 유지한다 — 플랫폼
헬스체크가 DB 로 흔들리면 DB 장애가 재시작 루프가 된다.

```
npm run db:status          # 적용/미적용/불일치 (DB 변경 없음)
npm run db:migrate         # 미적용 마이그레이션 적용
node db-migrate.js meta free_tier_expires_at 2026-10-25   # 무료 DB 만료일 기록
```

마이그레이션은 `db/migrations/NNN_snake_case.sql` 이고, 적용 이력은 DB 의 `schema_migrations` 에 남는다.
이미 적용된 파일을 고치면(체크섬 불일치) 적용을 거부한다 — 과거 파일을 수정하지 말고 새 번호를 추가한다.
`db:status` 와 기동 게이트는 **읽기 전용**이다(원장 표조차 만들지 않는다). 원장 생성·적용은 `db:migrate`
안에서만 일어나고, 그 구간 전체가 연결 하나를 체크아웃해 `pg_advisory_lock` 으로 직렬화된다 —
`pg` 의 advisory lock 은 세션(연결) 단위라 풀에서 매번 다른 연결로 잠그면 아무것도 막지 못한다.
백업·복원·만료 운영 절차는 #264 Jupiter 보고서(`docs/milestone/v0.4.11/issues/264/Jupiter/report.md` — #264 통합과 함께
저장소에 들어온다)가 원본이다.

#### 계정 · 로그인 (#259 — `DATABASE_URL` 이 있는 서버에서만)

**경계**: DB 가 있는 서버는 온라인 방 **생성(`c-`/`cp-`)·참가(`j-`/`p-`)·재접속(`r-`)** 업그레이드에 로그인 세션을 요구한다
(없거나 무효 = 401, DB 장애 = 503 — 무계정으로 통과시키지 않는다). 로비 목록(`l-`)은 읽기 전용이라 로그인 없이 된다.
DB 가 없는 서버(오프라인·LAN·로컬 회귀)는 계정 없이 기존 그대로이고, 계정 API 는 `503 E_ACCOUNTS_DISABLED` 다.
그래서 **로그인 UI 가 없는 클라이언트를 DB 붙은 서버에 올리면 온라인 방에 들어갈 수 없다** — 클라이언트 계정 화면과 함께 배포한다.

좌석은 그 좌석을 얻은 계정에 묶인다. 재접속은 좌석 토큰 + **같은 계정의 세션**이어야 한다 — 다른 계정 세션으로 남의
좌석 토큰을 내면 토큰이 틀린 것과 같은 `E_SEAT_TOKEN_INVALID` 로 거부되고, 원래 좌석은 밀려나지 않는다. 60초 재접속 유예·
방/경기 의미는 그대로다. **같은 계정은 자기 방의 상대 좌석에 참가할 수 없다**(`j-`/`p-` → `error E_SAME_ACCOUNT` + close 1008,
방·초대 코드는 그대로). 첫 프레임(`room_opened`/`room_joined`/`room_resumed`)과 `room_state` 푸시에 **서버 권위 공개 닉네임**
`players: [좌석0, 좌석1]`(빈 좌석·계정 없는 서버 = `null`)을 싣는다 — 로그인 아이디·이메일·계정 id 는 게임 프레임에 싣지 않는다.

**단일 로그인**(CJ 2026-09-27): 로그인에 성공하면 그 계정의 **이전 세션은 전부 무효**가 되고 열린 소켓은 `error E_SESSION_ENDED`
(`reason: 'login_replaced'`) + `close 4003` 으로 끝난다. 실패한 로그인은 아무도 끊지 않는다. 로그인·가입이 **다른 세션 쿠키를 들고**
성공하면(같은 브라우저에서 계정 전환) 그 들고 온 세션도 지우고 그 소켓을 끊는다(`reason` 없음). 그 밖의 종료 — **로그아웃**(그 세션의
소켓만) · **비밀번호 재설정**(그 계정의 모든 소켓) · **30일 절대 만료** — 도 같은 `E_SESSION_ENDED` + 4003 이다(`reason` 없음).
끝난 소켓의 프레임은 읽기 명령까지 처리하지 않는다. 좌석은 일반 단절처럼 60초 유예에 들어가 같은 계정의 새 세션으로 재접속할 수 있다.
클라이언트는 4003 에서 자동 재접속하지 말고 로그인 화면으로 보낸다. 폐기 알림은 DB 에 기록된 **뒤에만** 일어나고(DB 장애로 로그아웃이
503 이면 세션도 소켓도 그대로), 이 프로세스 안에서만 퍼진다(인스턴스 1개 전제). 절대 만료는 DB 없이 서버 시계로 적용한다.

| 요청 | 본문 | 성공 | 실패 |
| --- | --- | --- | --- |
| `POST /api/auth/signup` | `{userId, nickname, password, email}` | 201 `{userId, nickname, hasEmail:true}` + 쿠키 | 400 `E_BAD_INPUT` · 409 `E_ID_TAKEN` / `E_NICKNAME_TAKEN` |
| `POST /api/auth/login` | `{userId, password}` | 200 `{userId, nickname, hasEmail}` + 쿠키(이전 세션 무효) | 401 `E_AUTH_FAILED` · 429 `E_RATE_LIMITED` |
| `POST /api/auth/logout` | `{}` | 200 `{ok:true}` + 쿠키 삭제 | |
| `GET /api/auth/session` | | 200 `{userId, nickname, hasEmail}` | 401 `E_NO_SESSION` |
| `POST /api/auth/email` | `{password, email}` (로그인 상태, 이메일 없는 기존 계정만) | 200 `{ok:true, hasEmail:true}` | 401 `E_NO_SESSION` / `E_AUTH_FAILED` · 409 `E_EMAIL_ALREADY_SET` |
| `POST /api/auth/password-reset/request` | `{userId}` (이메일은 받지 않는다) | 202 `{ok:true}` — **등록 이메일로 발송이 끝난 뒤에만**(주소는 응답에 없다) | 검사 순서: 404 `{error:'E_ID_NOT_FOUND', message:'존재하지 않는 아이디입니다'}`(없는 아이디 — 메일 설정보다 먼저) · 409 `E_EMAIL_REQUIRED`(이메일 없는 기존 계정) · 503 `E_MAIL_UNAVAILABLE`(메일 미설정·발송 실패) · 429 `E_RATE_LIMITED`(재발송 간격·24시간 상한) · 400 `E_BAD_INPUT`(아이디 빠짐) |
| `POST /api/auth/password-reset/verify` | `{userId, code}` | 200 `{resetToken}`(메모리에만 둘 것, 10분) | 401 `E_CODE_INVALID`(틀림·만료·재사용·상한·없는 아이디 모두) |
| `POST /api/auth/password-reset/complete` | `{resetToken, newPassword}` | 200 `{ok:true}` — 자동 로그인 없음(다시 로그인). 쿠키는 이 브라우저의 세션이 재설정 계정의 것이거나 없을·무효일 때만 삭제(다른 계정 로그인은 유지) | 409 `{error:'E_SAME_PASSWORD', message:'직전 비밀번호와 같습니다'}`(허가 유지) · 401 `E_RESET_INVALID` · 400 `E_BAD_INPUT` |

공통: 503 `E_ACCOUNTS_DISABLED`(DB 없는 서버) / 503 `E_ACCOUNTS_UNAVAILABLE`(DB 장애 — 원문 오류는 싣지 않는다) /
403 `E_INSECURE_TRANSPORT` / 403 `E_BAD_ORIGIN` / 415·400 `E_BAD_INPUT` / 429 `E_RATE_LIMITED`. 복구 코드 경로(`/recover`·`/recovery-code`)는
폐기됐다(404, CJ 2026-09-27).

#### 프로필 · 대표 하수인 · 전적 (#260 — 같은 계정 경계: 세션 쿠키, POST 는 같은 출처 Origin + JSON)

| 경로 | 본문 | 성공 | 오류 |
|---|---|---|---|
| `GET /api/profile` | | 200 `{nickname, representativeMinion, stats:{wins, losses}, matches:[최근 20], pendingMatches}` | 401 `E_NO_SESSION` |
| `POST /api/profile/representative` | `{minionId}` | 200 `{representativeMinion}` — **다음에 들어가는 방부터** | 400 `E_BAD_INPUT`(일반 30종 ROSTER 밖 — 전설·왕·동료 불가) · 401 |

- `matches[i]` = `{result:'WIN'|'LOSS'|'NO_CONTEST', reason, opponentNickname, turns, durationMs, endedAt}` 최신순. `reason` = WIN/LOSS 는 엔진 `winType`
  (`king`·`edge`·`wipe`·`resign`) 또는 `forfeit`(연결 종료 몰수), NO_CONTEST 는 `both_disconnected`·`server_error`·`server_restart`.
- 기록 대상: **보드 경기가 시작된(IN_PROGRESS) 온라인 경기만**, 서버 확정 순간(`room._finalize`) 좌석(계정)마다 1행(`005` `match_results`, `UNIQUE(match_id, account_id)`).
  승·패는 행에서 센다(NO_CONTEST 제외). 경기 전 취소·PVE 는 행이 없다. 시간 = 보드 시작 → 결과 확정(상점·재접속 대기 포함).
- WS 좌석 프레임(`players` 가 있는 모든 프레임)에 `reps:[좌석0, 좌석1]` — 좌석에 들어갈 때의 대표 하수인으로 고정되고 재접속해도 바뀌지 않는다.
  공개 방 목록(`lobby_rooms`)에는 전적이 없다(#261 부터 행에 공개 닉네임·대표만 — 아래).

#### 멀티 방 이름 · 공개 목록 · 실측 핑 (#261)

- **방 이름**: 생성 소켓(`cp-`/`c-`)만 같은 WS 주소에 `?rn=<encodeURIComponent(이름)>` 을 붙인다(credential 토큰은 64자 ASCII 라 한글 이름을 싣지 못한다).
  원문 전체가 완성형 한글·영문·숫자·공백(U+0020)·`_`·`-` 이어야 하고(그 밖의 문자는 지우지 않고 거부), 앞뒤 공백 제거·연속 공백 1칸 정리 뒤 2~20자.
  `rn` 이 1개가 아니거나 틀리면 세션 확인 뒤 `error E_BAD_ROOM_NAME` + close 1008 — 방을 만들지 않는다. `rn` 이 **없는** 옛 생성만 `방 <번호>`.
  이름은 생성 때 고정·중복 허용(방 번호로 구분). 첫 프레임(`room_opened`/`room_joined`/`room_resumed`)에 `roomName`.
- **목록 행** `{roomId, roomName, state:'OPEN'|'SETUP'|'IN_PROGRESS', seats:'1/2'|'2/2', ageSec, label, players:[닉|null,닉|null], reps:[id|null,id|null]}` —
  공개 방의 그 세 상태만, 참가 대기 먼저·그 안에서 최신 먼저. 비공개·종료·취소·무효·닫힌 방은 없다. 계정 id·아이디·이메일·토큰·초대 코드·IP·가방·배치·전투 정보는 싣지 않는다.
  참가(`p-<id>`)는 여전히 공개 `OPEN` 만 — 목록이 낡았어도 서버가 `E_ROOM_NOT_FOUND` 로 거부한다. 검색은 클라이언트가 `roomName` 으로 거른다.
- **실측 핑**: 로비 전용(`l-`) 소켓에 `{v:1,t:'rtt',n}`(n = 0~2147483647 정수) → 즉시 `{v:1,type:'rtt',n}`. 틀린 n 은 답하지 않는다. 좌석 소켓의 `rtt` 는 무시(seq 불변).
  연결 생존 ping/pong(30초)과 별개이고 경기·타이머·재접속 유예를 바꾸지 않는다. 측정 주기·3초 실패 판정은 클라이언트 몫.

#### 경기 중 이모티콘 (#262)

- 좌석 소켓 `{v:1,t:'emote',requestId,seatToken,tokenGen,id}` — `id` 는 `hello`·`nice`·`wow`·`think`·`oops`·`gg`(`protocol.js` `EMOTE_IDS`). 게임 명령 경로가 아니다:
  중복 제거 캐시·`handleCommand`·`revision`·`seq`·`room_state`·시계·DB·재생 어디에도 닿지 않고, 저장·재전송하지 않는다(놓친 것은 사라진다).
- 성공: 보낸 쪽 `{v:1,type:'emote',epoch,roomId,from,id,requestId,cooldownMs:5000}`, 상대 `{v:1,type:'emote',epoch,roomId,from,id}`(requestId 없음). `seq` 없음.
- 거부(보낸 쪽만, `seq` 없음 · 일반 `error` 가 아니다): `{v:1,type:'emote_result',ok:false,requestId,code,retryMs?}` —
  `E_BAD_ENVELOPE`(허용 밖 id · 값은 되돌려 보내지 않는다) · `E_SEAT_TOKEN_INVALID` · `E_TOKEN_GEN_STALE` · `E_ILLEGAL_ACTION`(SETUP·IN_PROGRESS·FINISHED 가 아님) ·
  `E_PAUSED`(상대 좌석이 연결돼 있지 않음 — 단절·결과 화면 이탈 포함) · `E_RATE_LIMITED`+`retryMs`. 거부는 쿨다운을 쓰지 않는다.
- 쿨다운 5초는 서버 시계로 좌석에 붙는다 — 새로고침·재접속해도 이어지며 `room_resumed.emoteRetryMs`(남은 ms)로 알린다.
- 첫 프레임·`room_state`·명령 응답에 `peerConnected`(상대 좌석 연결 여부, 서버 권위)를 싣는다 — 클라이언트는 이 값으로 전송 버튼을 막는다.
- 결과 아웃박스(`authoritative/resultOutbox.js`): 서버가 결과를 확정하면 결과 프레임을 보내기 **전에** 로컬 JSONL 파일에 한 줄 append + fsync 하고,
  DB 에 들어간 것(두 좌석 행을 한 문장으로 — 원자적)이 확인된 뒤에만 그 줄을 지운다(임시 파일 + fsync + rename). DB 장애·제약 위반·프로세스 재시작 중에도
  완료된 결과를 **버리지 않는다** — 30초마다·기동 직후 다시 쓰고, `UNIQUE(match_id, account_id)` + `ON CONFLICT DO NOTHING` 이라 재생해도 한 번만 남는다.
  - 경로: `DD_RESULT_OUTBOX`(체크아웃 밖 비공개·영속 디스크 권장 — 파일에 계정 id 가 있다. 새 폴더 0700·파일 0600, Windows 는 새 폴더의 상속을 끊고 현재 사용자만 허용하는 ACL). 없으면 `server/data/match-results-outbox.jsonl`(`.gitignore`).
    열거나 쓸 수 없으면 DB 켠 서버는 기동하지 않는다. 이미 있는 폴더·파일(`.bad`·`.tmp` 포함)은 검사만 한다 — 다른 계정 권한이 있으면
    (POSIX group/other 비트 · Windows 현재 사용자·SYSTEM·Administrators 밖의 허용 ACE·소유자) `E_OUTBOX_INSECURE` 로 기동을 거부하고 권한·데이터를 고치지 않는다.
  - 깨진·형식 밖 줄은 기동 때 `<파일>.bad` 에 덧붙여 보존하고 로그한다(수동 확인). 제약 위반으로 거부된 결과도 아웃박스에 남는다(한 번 로그 · 수동 확인).
  - 미저장 결과가 200경기 이상이거나 파일 쓰기가 실패한 상태면 새 공식 경기(방 생성·참가)를 WS `E_RESULTS_BACKLOG` 로 거부한다. 진행 중 경기·재접속은 그대로다.
  - 프로필 `pendingMatches`(정수) = 그 계정이 들어 있는 미저장 결과 수. DB 장애 중 프로필은 503 `E_ACCOUNTS_UNAVAILABLE`. 로그는 오류 코드·건수만(계정 id·원문 없음).
  - **한계**: 같은 디스크가 남는 동안만 지킨다. 재배포마다 파일 시스템이 사라지는 호스트(Render Free 등)에서는 DB 장애 중 재배포·재시작된 미저장 결과를 잃는다 —
    그런 곳에서는 영속 디스크를 붙이기 전까지 이 보장을 주장하지 않는다. 한 파일은 한 서버 프로세스만 쓴다.
- 배포: 기동 게이트가 `005` 적용을 요구한다(`DD_DB_MIGRATE_ON_START=1` 또는 `npm run db:migrate`).

- **형식**: 아이디 = 소문자 `a-z`·숫자·`_` 4~20자(입력은 소문자로 정규화, 비공개 로그인 ID) · 닉네임 = **완성형 한글 음절
  (U+AC00–U+D7A3)·ASCII 영문·숫자·`_` 2~12자**, NFC 정규화 뒤 검사, 낱자모(`ㄱ`)·다른 문자 체계·공백·기호 불가, 영문 대소문자만
  다른 닉네임은 같은 닉네임(`Orca`=`orca` → `E_NICKNAME_TAKEN`) — CJ 2026-09-26 확정, DB CHECK 로도 막는다 · 비밀번호 8~128자 ·
  이메일 = ASCII `local@domain.tld` 254자 이하(앞뒤 공백만 제거하고 입력 그대로 저장·발송). 가입 필수지만 **유일하지 않다**(CJ 2026-09-27 · `004`) —
  여러 계정이 같은 주소를 쓸 수 있고 유일한 것은 아이디·닉네임뿐이다. `email_norm` 은 소문자 전체 주소이고 Gmail 점·`+` 같은 제공자별 접기는
  하지 않는다. 가입 시 소유 확인 메일은 없다(PD 기본값 — 메일 설정 없이도 가입).
- **기존 계정**(003 이전, 이메일 없음): 로그인·게임은 그대로(`hasEmail:false` 로 안내만), 로그인 + 현재 비밀번호로 이메일을 **한 번** 등록한다
  (다른 계정이 쓰는 주소도 된다).
  이미 이메일이 있는 계정의 주소 변경 경로는 아직 없다.
- **세션**: 쿠키 `dd_sid` — `HttpOnly; SameSite=Strict; Path=/`, HTTPS 면 `Secure`. 로그인 시점부터 **절대 30일**(써도 연장하지
  않는다), 계정당 마지막 로그인 하나만 유효. 토큰은 응답 본문에 싣지 않고 DB 에는 sha256 만 남는다.
- **비밀번호 재설정**(CJ 2026-09-27 최신 — 아이디만 입력, 복구 코드 대체): **아이디만** 넣는다. 서버가 먼저 아이디 존재를 확인해 없으면
  `404 E_ID_NOT_FOUND`(재설정 행·메일 없음), 있으면 **DB 에 등록된 그 계정의 이메일로만** **6자리 숫자 코드**(CSPRNG)를 보낸다 — 요청에 실린
  주소는 쓰지 않고 응답에도 주소를 돌려주지 않는다. 이메일 없는 기존 계정은 `409 E_EMAIL_REQUIRED`(주소를 지어내지 않는다 — 로그인 뒤 등록).
  게임 안에서 아이디·코드 확인 → 서버가 준 재설정 허가(256비트, sha256 만 저장)로 새 비밀번호. 코드·시도·허가는 그 한 계정의 행에만 묶이고,
  같은 주소를 쓰는 다른 계정의 비밀번호·세션·코드는 건드리지 않는다.
  PD 구현 기본값: 코드 **10분** · 재발송 **60초** 간격(간격 안 요청은 `429`, 메일은
  안 보냄) · 코드당 틀린 시도 **5회**면 그 코드 무효 · 계정당 **24시간 10통** · 허가 **10분**. 새 코드는 옛 코드를 즉시 무효로 한다.
  코드는 **HMAC-SHA256(프로세스마다 새로 만드는 키)** 만 DB 에 남는다 — 원문·키는 DB·로그·응답 어디에도 없다(서버를 재시작하면 대기 중
  코드는 무효 — 다시 요청). 코드 확인은 한 SQL 문장으로 소비(1회)·허가 발급·시도 증가를 원자적으로 하고, 완료는 허가 소비·비밀번호
  교체·세대 증가·세션 전부 삭제를 한 문장으로 한다. 새 비밀번호가 **직전(현재) 비밀번호와 같으면** 서버가 scrypt 로 비교해 409 로
  거부하고 계정·허가는 그대로다. 요청은 발송을 **기다린 뒤** 202 를 준다 — 발송이 실패하면 그 코드를 치우고 `503 E_MAIL_UNAVAILABLE`(첫 화면에 머문다, 원문 오류 없음).
- **메일 전송**(범용 SMTP — [nodemailer](https://nodemailer.com/smtp), 새 의존성 1개): `DD_SMTP_URL`(`smtp://` 는 STARTTLS 강제, `smtps://` 는
  처음부터 TLS · 사용자·비밀번호는 URL 인코딩) 과 `DD_MAIL_FROM` 이 **둘 다** 있어야 켜진다. 없거나 잘못되면 **있는 아이디**의 재설정 요청이
  `503 E_MAIL_UNAVAILABLE`(없는 아이디는 먼저 404). 기동 로그는 "SMTP 설정됨/미설정"만 찍고 값·오류는 찍지 않는다(잘못된 URL 도 "미설정"으로 보인다).
  URL 은 nodemailer 에 넘기지 않는다 — nodemailer 는 URL 질의로 `requireTLS`·`ignoreTLS`·`secure`·`tls.*`·`debug`·`service` 를 덮을 수 있어서,
  서버가 호스트·포트·계정만 뽑고 TLS 옵션(`secure`/`requireTLS`, `ignoreTLS:false`)은 고정한다. 인증서 검증을 끄거나 평문으로 낮추는 설정 경로는 없다. **현재 메일 설정이 없으므로 실제 받은편지함
  발송은 검증되지 않았다** — 자격 증명이 주어지기 전에는 이메일 재설정이 운영 준비됐다고 말할 수 없다.
- **오류는 일반화**: 틀린 비밀번호·없는 아이디(로그인), 틀림·만료·재사용 코드·없는 아이디(코드 확인)는 같은 응답이다. 가입의
  `E_ID_TAKEN`·`E_NICKNAME_TAKEN` 과 재설정 요청의 `E_ID_NOT_FOUND`(CJ 2026-09-27 — 아이디 존재를 알려 준다, IP 예산이 열거 속도를 묶는다)는 존재를 드러낸다.
- **시도 제한**: 로그인·이메일 등록 실패는 아이디별 15분 10회(없는 아이디도 똑같이 잠긴다, 검증 전에 센다 — 메모리라 재시작하면 풀린다).
  비밀번호·코드·이메일을 싣는 요청은 IP당 버스트 20·초당 1 예산. 공개 배포에서는 IP 가 프록시 하나로 보여 이 예산이 인스턴스 공유다.
- **전송**: 비밀번호·코드·이메일을 싣는 요청은 HTTPS 이거나 이 PC(루프백)에서만 받는다 — LAN 평문 HTTP 는 `403 E_INSECURE_TRANSPORT`.
  공개 배포(`DD_AUTH_PUBLIC_DEPLOY=1`)는 TLS 가 엣지에서 끝나므로 `X-Forwarded-Proto: https` **와** 브라우저 `Origin` 의 `https:` 스킴을
  **둘 다** 요구한다(평문 HTTP 페이지 Origin + 위조 XFP 는 거부). 헤더는 전송 보안의 증명이 아니다 — 컨테이너가 플랫폼 엣지를 통해서만
  닿는다는 배포 전제 위에서만 성립한다.
- **CSRF**: 상태를 바꾸는 요청은 POST + `Content-Type: application/json` + 같은 출처 `Origin` 필수, 본문 2KB 상한.
- **저장**: `002_accounts.sql`(계정·세션) + **`003_email_single_login.sql`**(추가만 — 002 는 적용된 DB 가 있어 고치지 않는다):
  `accounts.login_gen`·`email`·`email_norm`(유일)·복구 열 NULL 허용, `sessions.login_gen`, `password_resets`(계정당 1행). 003 은 계정·비밀번호·세션 행을
  지우지 않고, 적용 순간 계정마다 **만료 전·현재 자격 세대 세션 중 `created_at`(002 의 로그인 시각) 최신 1개만** 유효로 남긴다(동률은
  `expires_at` → `token_hash` 내림차순). 나머지 기존 세션은 세대 불일치로 무효가 되고 그 기기는 다시 로그인한다.
  **`004_email_not_unique.sql`**(추가만 — 003 은 적용된 DB 가 있어 고치지 않는다): 이메일 유일 인덱스 `accounts_email_norm_key` 하나만 지운다(행 변경 없음).
- **세대 — 경합이 옛 권한을 되살리지 못한다**: 세션은 발급 당시 `credential_gen`(재설정이 올림)·`login_gen`(로그인·재설정이 올림)이 계정의
  현재 값과 **둘 다** 같을 때만 유효하다. 세대는 같은 행 UPDATE 로만 올라 행 잠금으로 직렬화되므로, 동시 로그인은 정확히 하나만 살고,
  옛 비밀번호 검증을 마친 로그인이 재설정보다 늦게 끝나면 `401 E_AUTH_FAILED` 다. 소켓 폐기도 세대를 본다 — 로그인 폐기는 "그 계정의
  **그 세대보다 낮은** 세션"만 끊으므로, 늦게 도착한 옛 로그인의 폐기가 더 새 로그인의 소켓이나 진행 중 업그레이드를 끊지 못한다.
  WS 업그레이드의 세션 조회가 도는 동안 도착한 폐기는 그 조회에 기록돼, 폐기 전 상태를 읽은 조회로는 소켓이 인가되지 않는다(401).

설계·검증 근거는 [`docs/milestone/v0.4.11/issues/259/Jupiter/report.md`](../docs/milestone/v0.4.11/issues/259/Jupiter/report.md) 가 원본이다.

기동하면 콘솔에 **접속 주소**와 **접속 코드**가 서로 다른 줄에 따로 출력된다.

```
PvP relay server listening on 127.0.0.1:8080 (루프백 전용)
  클라이언트: ...\demo
  접속 주소: http://127.0.0.1:8080
  LAN 공개가 필요하면 DD_LAN=1 로 기동하세요 (기본은 이 PC 전용).

  접속 코드: 5F65J3YKGD
```

**주소와 코드는 절대 한 줄로 합치지 않는다.** 코드가 붙은 URL 을 한 번 만들어 두면 그대로 복사돼
브라우저 주소창·방문 기록·`Referer` 헤더·프록시 액세스 로그에 비밀값이 남는다. 그래서 서버는
쿼리스트링·쿠키·리다이렉트를 일절 쓰지 않는다.

### 접속 절차

1. 위 **접속 주소**를 브라우저로 연다. 페이지 자체는 인증이 없다 — 나가는 것은 저장소에 그대로
   들어 있는 데모 클라이언트뿐이고 비밀값이 아니다.
2. 클라이언트의 **[서버 주소]** 칸에 서버 주소를, **[접속 코드]** 칸에 콘솔의 코드를 각각 입력한다.
   두 칸은 분리되어 있다. 코드를 주소 칸에 붙여 넣지 않는다.
3. 접속하면 코드는 WebSocket 업그레이드의 하위 프로토콜 헤더로만 전송된다.

보호 대상은 페이지가 아니라 **상대와의 릴레이 세션**이고, 인증 경계는 WebSocket 업그레이드 한 곳뿐이다.

### 접속 코드 전달 방식 — 하위 프로토콜

코드는 오직 `Sec-WebSocket-Protocol` 헤더로만 전달한다. 클라이언트는 토큰을 **정확히 2개**,
`[공개 마커, 접속 코드]` 순서로 제시한다.

```js
new WebSocket('ws://<서버주소>/', ['digit-duel.v1', accessCode]);
```

- `digit-duel.v1` 은 **공개 마커**다. 비밀값이 아니며, 서버가 응답에 되돌려주는 유일한 값이다.
- 서버는 코드를 검증만 하고 **절대 선택·반향하지 않는다.** 코드를 선택하면 응답
  `Sec-WebSocket-Protocol: <코드>` 로 비밀값이 그대로 돌아가 클라이언트 `ws.protocol` 과
  중계 프록시 로그에 남는다. 접속 성공 시 `ws.protocol` 은 항상 `digit-duel.v1` 이다.
- 마커를 따로 두는 이유: 클라이언트가 하위 프로토콜을 제시했는데 서버가 하나도 고르지 않으면
  브라우저와 `ws` 클라이언트가 핸드셰이크를 실패로 처리한다. 그래서 되돌려줘도 안전한 값을 둔다.
- 토큰을 2개로 못 박는 이유: 여러 개를 나열할 수 있으면 한 번의 핸드셰이크로 코드를 여러 개
  대입해 실패 횟수 제한을 우회할 수 있다.

### 노출 범위 — 로컬 기본 · LAN 옵트인 · 외부망 없음

| 모드 | 바인드 | 접속 허용 대상 |
| --- | --- | --- |
| 기본 | `127.0.0.1` | 이 PC 만 |
| `DD_LAN=1` | `0.0.0.0` | 같은 공유기의 사설 대역만 (10.x · 172.16~31.x · 192.168.x · 링크 로컬) |

```
npm run start:relay:lan    # 또는  node server.js --lan  /  DD_LAN=1 npm run start:relay
```

Windows 에서는 `LAN서버시작.bat` 더블클릭이 위 `node server.js --lan` 과 같은 경로다.

**외부망(WAN) 공개 경로는 없다.** LAN 모드에서도 피어 IP 가 사설 대역이 아니면 HTTP·WebSocket 모두
거부한다(공인 IP 는 항상 거부). 포트포워딩·터널로 외부에 노출하는 것은 지원 범위 밖이며,
이 서버의 위협 모델(내부망 전용)을 벗어난다.

LAN 모드에서는 콘솔이 내부망 주소를 추가로 출력한다. 상대에게는 그 **주소**와 **코드**를 따로 전달한다.

### 환경 변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `PORT` | `8080` | 대기 포트. `0` 이면 임의 포트 |
| `DD_LAN` | (없음) | `1` 이면 LAN 공개(0.0.0.0 바인드). 미설정 시 루프백 전용 |
| `DD_BIND` | 위에 따름 | 바인드 주소 직접 지정. **IP 리터럴만** — 아래 표 참조 |
| `DD_ACCESS_CODE` | 런타임 생성 | 접속 코드 고정. 아래 규칙을 어기면 기동 중단. **저장소에 커밋하지 않는다** |
| `DD_MAX_CONNECTIONS` | `16` | 동시 WebSocket 연결 총량 |
| `DD_MAX_CONNECTIONS_PER_IP` | `4` | IP당 동시 연결 수 |

#### 기동 fail-closed — 잘못된 설정은 서버가 뜨지 않는다

설정이 어긋나면 `listen` 하기 **전에** 종료 코드 1 로 중단한다. 잘못된 설정으로 일단 뜬 서버는
안내문(“루프백 전용”·“코드 인증”)과 실제 노출이 어긋난 채로 돌아가기 때문이다. 실패 메시지에는
사유만 싣고 **코드 값 자체는 출력하지 않는다.**

`DD_ACCESS_CODE` — 미설정(또는 빈 값)이면 런타임 생성. 설정했다면 다음을 모두 만족해야 한다.
코드는 `Sec-WebSocket-Protocol` 토큰으로만 전달되므로, 그 통로가 실어 나를 수 없는 값은
“설정은 했는데 아무도 못 붙는” 조용한 고장이 된다.

| 조건 | 거부 사유 |
| --- | --- |
| 공백 없음 (앞뒤 공백도 트림하지 않고 거부) | `whitespace` |
| ASCII 출력 가능 문자만 (제어 문자·한글 등 불가) | `non_ascii` |
| 8자 이상 64자 이하 | `too_short` · `too_long` |
| RFC 7230 토큰 문자만 — 쉼표·세미콜론·따옴표 불가 | `bad_char` |
| 공개 마커 `digit-duel.v1` 과 다를 것 (대소문자 무관) | `public_marker` |

`DD_BIND` — 노출 정책(`DD_LAN`)과 대조한다. 호스트명은 받지 않고 IP 리터럴만 허용한다.

| `DD_LAN` | 허용 | 거부 |
| --- | --- | --- |
| 미설정 (루프백 전용) | `127.0.0.1` · `::1` 등 명시적 루프백 | `0.0.0.0`·`::`(`wildcard_without_lan`), 그 밖의 모든 주소(`not_loopback`) |
| `1` (LAN 공개) | `0.0.0.0` · `::` · 사설 대역 주소 | 공인 주소(`not_private`) |

옵트인 없이 `DD_BIND=0.0.0.0` 을 조용히 받아들이면 “이 PC 전용”이라고 안내하면서 실제로는 모든
인터페이스에서 listen 하게 된다. 피어 검사(`peerAllowed`)가 뒤에서 한 번 더 거르지만, 그건 이미
열린 소켓에 붙은 상대를 돌려보내는 것이지 소켓을 안 여는 것이 아니다.

## 보안 설계 (#62)

| 영역 | 조치 |
| --- | --- |
| 노출 범위 | 기본 `127.0.0.1` 바인드, LAN 공개는 `DD_LAN=1` 명시적 옵트인, 외부망 경로 없음 |
| 기동 검사 | 잘못된 `DD_ACCESS_CODE`(공백·비ASCII·과길이·토큰 밖 문자·공개 마커)와 정책에 어긋난 `DD_BIND`(옵트인 없는 와일드카드·비루프백, LAN 모드의 공인 주소)는 `listen` 전에 종료. 실패 메시지에 코드 값을 싣지 않음 |
| 피어 검사 | 루프백 전용 모드에서는 루프백만, LAN 모드에서는 사설 대역만. 공인 IP는 항상 거부 |
| 인증 | 기동마다 새로 생성한 10자 접속 코드(약 49비트). `Sec-WebSocket-Protocol` 헤더 단일 경로 — URL·쿼리·쿠키·리다이렉트를 쓰지 않는다. 상수시간 비교, 실패 10회/5분 시 IP 차단, 실패 응답에 사유를 싣지 않음 |
| 코드 반향 금지 | 응답 하위 프로토콜로는 공개 마커 `digit-duel.v1` 만 선택. 비밀 코드는 어떤 응답에도 실리지 않는다 |
| HTTP | `GET`/`HEAD` 외 405. Host 헤더 검증(DNS 리바인딩 차단). Origin 있는 요청은 동일 출처만. URL 길이 상한. IP당 요청 속도 제한 — 예산은 클라이언트의 고정 프리로드 집합에서 역산한다 (아래 #201 절) |
| 정적 경로 | 경로 이탈(`..`·`%2F` 로 감춘 구분자)·이중 인코딩·널/제어 문자·역슬래시·숨김 파일·확장자 밖 파일·심볼릭 링크 탈출·디렉터리 거부 |
| WebSocket | 핸드셰이크 단계에서 피어·Host·경로·Origin·인증·연결 수·업그레이드 속도 검사 후에만 승격. WebSocket 은 CORS 보호가 없어 Origin 검사가 필수다 |
| 메시지 | 바이너리 거부(1003), 16KB 상한(1009), UTF-8·JSON 객체 검증, 최상위 `t` 문자열 필수, **예약 키 `type` 금지**, 중첩 깊이·키 수·배열 길이 상한, 초당 40건·128KB 토큰 버킷, 위반 5회 시 종료(1008) |
| 헤더 | CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP/CORP, `Cache-Control: no-store`, `X-Robots-Tag` |

`type` 예약 키 차단이 핵심이다. 서버 제어 프레임(`waiting`·`matched`·`opponent_left`)이 `type` 을 쓰는데,
클라이언트는 `type:"opponent_left"` 수신 시 몰수패 처리를 한다. 차단이 없으면 상대가 그 프레임을
그대로 중계시켜 상대를 임의로 패배시킬 수 있다. 게임 프로토콜(`{t:"hello"|"hello2"|"a", …}`)은
그대로 통과하며, 서버는 여전히 내용을 해석하지 않는다.

### 정적 서빙 요청 예산 (#201)

정적 서빙의 IP당 요청 예산은 **클라이언트 한 번의 페이지 로드가 내보내는 고정 요청 수**에서
역산한다. `demo/index.html` 의 `artPreload` 는 페이지를 열 때마다 정체와 무관한 고정 집합을
한꺼번에 요청한다 (정보 은닉 규격 7.10.3) — `index.html` 1 + CSS/JS 9 + 하수인 20종 ×
`{icon,battle}` 40 + 왕·동료 2종 × `{icon64,battle256}` 4 = **54 건**.

```
pageLoadRequests    = 57   // 54 + 부수 요청(favicon.ico · 설명창 portrait) 여유 3
concurrentPageLoads = 6    // 같은 IP 에서 겹칠 수 있는 로드 수
httpBurst     = 57 × 6 = 342
httpReqPerSec = 57 × 2 = 114  // 초당 전량 로드 2회분이 회복된다
```

상수는 `security.js` 의 `STATIC_BUDGET` 에 있다. 자산이 늘면 같이 올려야 하는 계약이라 순수 모듈에
두고, `npm run test:static` 이 실제 자산 수와 대조한다 — 코퍼스가 예산을 넘기면 CI 가 깨진다.

종전 값(버스트 60 · 초당 30)은 자산 요청을 겨우 담아 같은 IP 에서 로드가 겹치면 수십 건이 `429` 가 됐고,
클라이언트가 그 실패를 그 종의 영구 실패로 기록해 **아트가 일부만 빠져 보였다**(#201). `<img>` 의
`onerror` 는 상태 코드를 주지 않아 클라이언트에서는 `429` 와 `404` 가 구분되지 않는다.

**제한을 끈 것이 아니다.** 여전히 IP당 유한한 토큰 버킷이고, 한 IP 가 받을 수 있는 정적 파일은 최대
`342 + 114 × 경과초`다. 두 값은 고정값이라 env 설정 표면이 늘지 않았다. 이 버킷은 **인증 경계가 아니다** —
WebSocket 업그레이드는 별도 버킷(`upgradeBuckets`, 분당 60)과 `AttemptLimiter`(5분 10회 실패 시 IP
차단)가 막으므로 접속 코드 무차별 대입 노출면은 넓어지지 않았고, 메서드·Host·Origin·경로·심볼릭
링크·확장자 검사와 응답 헤더도 그대로다.

재현 수치·베이스라인 대조·변이 검출 결과와 채택하지 않은 대안(`Retry-After`, 정적 캐시 정책)은
[HotFix #201 Jupiter 보고서](../docs/hotfix/201/Jupiter/report.md)에 있다.

### 남은 트레이드오프

- **CSP `unsafe-inline`**: JS·CSS 본문은 외부 파일이지만 `demo/index.html` 의 `on*`·`style` 속성이
  남아 있어 제거하면 클라이언트가 깨진다. 속성 외부화·nonce 도입은 후속 과제.
- **평문 링크**: 접속 코드는 URL 이 아니라 `Sec-WebSocket-Protocol` 헤더로 가지만, TLS 가 없는
  `ws://` 에서는 그 헤더도 평문이다. 같은 LAN 에서 패킷을 관찰할 수 있는 상대에게는 코드도 대국
  트래픽도 기밀이 아니다. 헤더를 쓰는 목적은 도청 방지가 아니라, 코드가 주소창·방문 기록·`Referer`·
  프록시 액세스 로그처럼 **오래 남는 곳**에 복사되지 않게 하는 것이다.
- **코드의 유일한 표시 지점**: 코드는 서버를 켠 터미널에 운영자 전달용으로 한 번 출력된다. 그 터미널
  기록을 캡처·공유하면 코드도 함께 나간다 — 노출됐다면 재기동이 가장 빠른 무효화 방법이다(기동마다
  새 코드).
- **`file://` 직접 열기 경로**: html 파일을 직접 열어 서버에 붙는 흐름은 Origin(`null`)이 서버와 달라
  거부된다. 서버가 서빙하는 `http://<서버주소>` 페이지로 접속하는 흐름을 사용한다. 클라이언트는
  `file://` 로 열렸을 때 메뉴에 그 사실과 대안 주소를 표시한다 (#63).
- **클라이언트 쪽 목적지 제한 (#63)**: 코드는 주소 칸이 가리키는 서버로 전송되므로, 클라이언트
  (`demo/index.html`·`test-client.html`)는 `localhost` 와 루프백·사설·링크로컬 **IP 리터럴**만 접속
  대상으로 인정하고 도메인 이름·공인 IP·`user:pw@호스트` 는 소켓 생성 전에 거부한다. 서버의
  `isAllowedHost` 정책과 같은 범위라, 정상 서버가 그 밖에 있을 수 없다.
- **`test-client.html`**: 주소·접속 코드 분리 입력과 `[digit-duel.v1, code]` 하위 프로토콜 제시로
  갱신했다 (#63). 다만 이 파일은 정적 서빙 루트(`../demo`) 밖에 있어 `file://` 로 열면 Origin 이
  거부된다 — 쓰려면 `demo/` 로 복사해 `http://<서버주소>/test-client.html` 로 연다. 이 파일의 목적지·
  코드 방어 경계는 `node demo/test/regression/smoke_testclient.js` 가, 서버 쪽 계약은 `npm test` 가 덮는다.

## 테스트

```
npm test              # 아래 다섯 다
npm run test:protocol # 매칭 / 양방향 릴레이 / 이탈 알림 / 대기 슬롯 정리
npm run test:security # 인증·경로·헤더·한도·메시지 검증 (단위 + 통합)
npm run test:config   # 기동 설정 fail-closed 경계 (DD_ACCESS_CODE·DD_BIND)
npm run test:launcher # 원클릭 실행기 계약 (Windows 전용, 다른 OS 에서는 SKIP)
npm run test:static   # 정적 서빙 요청 예산 (#201) — 프리로드 전량 200 · 남발은 여전히 429
npm run test:db       # #264 DSN·TLS·마이그레이션·fail-closed (Postgres 없이)
npm run test:accounts # #259 계정·단일 로그인·이메일 코드 재설정·WS 좌석 계정 바인딩 (Postgres 없이 — 메모리 대역, 메일은 주입 전송)
npm run test:profile  # #260 프로필·대표 하수인·전적 기록(1회)·파일 아웃박스(상한·제약 위반·재시작 재생·깨진 줄·쓰기 실패)·WS reps (메모리 대역, DD_TEST_DATABASE_URL 이면 실제 Postgres)
npm run test:lobby    # #261 방 이름 경계·목록 상태/순서/공개 필드·참가 경합·시작된 방 참가 거부·재접속 roomName·rtt 왕복 (DB 없음)
npm run test:emotes   # #262 이모티콘 허용 ID·전용 응답·연타·토큰 펜싱·상대 단절/재접속 쿨다운 유지·단계별 전송·게임 상태 불변 (DB 없음)
```

실제 Postgres 로 같은 계정 시나리오를 돌리려면(그 DB 의 표를 지운다 — 전용 테스트 DB 에만):
`DD_TEST_DATABASE_URL=postgres://… npm run test:accounts` · 서버 프로세스 2클라이언트 스모크(기동 게이트·재시작 뒤 세션 유지):
`DD_TEST_DATABASE_URL=postgres://… node authoritative/test/smoke-issue259-pg.js`.

`test-security.js` 가 덮는 범위:

- **단위(I/O 없음)** — IP 정규화·루프백/사설 판정, 상수시간 코드 비교, 정적 경로 판정(이탈·이중
  인코딩·역슬래시·숨김 파일·제어 문자·확장자), 릴레이 봉투 검증(바이너리·예약 키 `type`·크기·JSON·
  중첩 깊이), 하위 프로토콜 파서와 선택기(공개 마커만 선택, 코드는 절대 선택하지 않음)
- **통합(임의 포트 실서버)** — HTTP 메서드·경로·보안 헤더, 코드 미제시/오답 거부, 토큰 3개 거부,
  쿼리스트링 코드 거부, `[마커, 코드]` 접속 성립과 응답에 코드가 반향되지 않음, IP당 연결 수 한도,
  초과 페이로드(1009)·바이너리(1003) 종료, 정상 매칭·릴레이

`test-config.js` 가 덮는 범위:

- **단위** — `DD_ACCESS_CODE` 판정(공백·비ASCII·제어 문자·길이·쉼표/세미콜론·공개 마커),
  `DD_BIND` 판정(옵트인 유무별 허용·거부, IPv6 정규화)
- **기동** — 위 위반 설정 8종이 각각 종료 코드 1 로 중단하고 `listen` 하지 않으며 실패 로그에
  코드 값을 남기지 않음, 정상 설정(`DD_BIND=127.0.0.1` + 유효 코드)은 그대로 기동함

`test-launcher.js` 가 덮는 범위 (#75):

- 공백·한글이 섞인 임시 폴더에 두 실행기를 복사하고, `server.js` 자리에 argv 를 찍는 스텁을 둔 뒤
  더블클릭과 같은 방식으로 호출한다 — `서버시작.bat` 은 인자 없이, `LAN서버시작.bat` 은 `--lan` 정확히
  1개로 기동, 둘 다 실행기 폴더로 이동하고 `DD_LAN` 환경 변수를 남기지 않음, `server.js` 종료 코드 전파
- **고정 목적 계약** — 호출 방식이 달라져도 각 실행기의 모드와 `server.js` 에 넘어가는 인자가 그대로다.
  실행기가 외부 문자열을 명령줄로 펼치지 않는다는 것까지 표식으로 확인한다
- 스텁은 포트를 열지 않고 `node_modules` 를 미리 만들어 두므로 서버도 `npm install` 도 타지 않는다

`test-static-load.js` 가 덮는 범위 (#201):

- **예산 계약** — HTML 참조와 실제 자산 디렉터리에서 만든 프리로드 코퍼스(54건)가 선언 예산(57건) 안에 있는지
- **정상 로드는 전량 200** — 냉시작 1명(54건) · 같은 IP 동시 2명(108건) · 같은 버킷 연속 3회(162건).
  장면마다 새 서버를 띄워 버킷을 가득 찬 상태로 시작하고, 브라우저처럼 소켓 6개 keep-alive 로 묶는다
- **남발은 여전히 유한** — 버스트 4배를 퍼붓고 `200 ≤ 버스트 + 초당회복 × 경과초` 상한과 `429` 발생을
  확인한다. 제한을 끄는 변이는 여기서 걸린다
- **결정적 판정** — 시간 인자를 넣은 제품 `TokenBucket` 으로 수정 전 예산(60·30)이 같은 요청을 거부하고
  수정 후(342·114)는 전부 받는 것, 소진된 버킷이 같은 시각 요청을 거부하고 회복 후에는 받는 것을 본다

서버를 띄우는 네 테스트는 모두 `PORT=0`(임의 포트) + 루프백 바인드로 자식 서버를 따로 띄우고 실행기
테스트는 서버를 아예 띄우지 않으므로, 이미 떠 있는 서버(8080)를 건드리지 않는다.
