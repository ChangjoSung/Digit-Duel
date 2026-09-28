# #264 Render Free Postgres QA 준비 — Jupiter(Server) 구현 보고

- 역할: Jupiter / mode IMPLEMENT / area SERVER / mutation code_docs
- 작업 트리: `ChangjoSung/issue-264-render-db-current` (base `fafc619` = `origin/milestone/v0.4.11`, #250 `5435b40` 포함은 [WORKER_MODELS.md](../../../../../creat2ve/WORKER_MODELS.md) 점검 기록 기준) — **미커밋·미통합**. Git 쓰기(와 Worker Git 읽기)는 하지 않았다.
- 이력: 첫 구현은 #250 이전 base `33490f9` 의 `issue-264-render-db` 트리에서 잘못된 모델로 만들어졌다(사고 기록은 WORKER_MODELS.md). 이 문서는 그 소스를 **현재 base 로 이식**하고 첫 Saturn REVISE(§11)를 고친 판이다. 옛 트리는 건드리지 않았다.
- 모델: Jupiter `claude-opus-5-5` / high · Ponytail full.
- 기준: [Issue #264](https://github.com/ChangjoSung/Digit-Duel/issues/264) · GDD-23 §2.4 · §9 Decision Log(2026-09-25 #264 후속 행) · [#217 배포 준비](../../../../v0.4.10/issues/217/Jupiter/deploy-readiness.md)
- 표기: **확정** = 이슈·GDD-23 에 있는 것 · **추론** = 코드·문서에서 따라 나온 판단 · **미확정** = 확인하지 못한 것

## 0. 한 줄 요약

`DATABASE_URL` 이 있을 때만 켜지는 Postgres 연결, 파일 한 개짜리 버전 관리 마이그레이션 러너와 첫 마이그레이션(`db_meta` — 무료 DB 만료일 기록용), 그리고 세 층의 fail-closed(기동 게이트 · `query()` reject · `/readyz` 503)를 넣었다. **Render 리소스·결제·대시보드·GitHub·Notion·비밀값은 건드리지 않았고**, 살아 있는 Postgres 왕복(연결·`pg_dump`·복원)은 이 환경에 DB·`psql`·`docker` 가 없어 **실측하지 못했다**(§6).

## 1. 범위 경계 — 무엇을 하지 않았나

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 계정·회원가입·로그인·세션 스키마 (#259) | **하지 않음** | #264 는 그 인프라 선행이고, 계정 스키마는 #259 범위다. 회귀 테스트가 `accounts`·`sessions`·`password` 등이 마이그레이션에 섞여 들어오는 것을 막는다 |
| 방·좌석·진행 경기 DB 영속화 | **하지 않음** | 이슈 비범위·GDD-23 §2.4(별도 CJ 승인 없이는 포함하지 않는다) |
| Render 서비스·DB 생성, 요금제 변경, 결제, 대시보드 조작 | **하지 않음** | CJ 미승인. 대시보드는 로그아웃 상태이고 리소스 생성은 별도 게이트 |
| `render.yaml` 에 `databases:`·`DATABASE_URL` 추가 | **하지 않음** | Blueprint 에 DB 를 적는 것은 sync 시 실제 리소스 생성 경로가 되고, 운영 원본(대시보드 vs Blueprint) 결정은 Mercury·CJ 소관이다(§5.1) |
| GitHub·Notion 쓰기, Git 쓰기, 클라이언트(`demo/`) 수정 | **하지 않음** | 역할 계약 |
| CI 워크플로(`.github/workflows/ci.yml`) 수정 | **하지 않음** | 새 테스트를 `npm test` 에 넣어 **기존 필수 검사 B** 가 그대로 돌게 했다 — 새 필수 검사를 만들 필요가 없다 |

## 2. 변경 파일

| 파일 | 변경 | 무엇 |
| --- | --- | --- |
| `server/db.js` | 신규 | 선택적 DSN 파싱·허용 목록 호스트 분류(`classifyHost`)·TLS 정책·풀·`query()`/`ping()`/`describe()` |
| `server/db-migrate.js` | 신규 | 마이그레이션 러너 + CLI(`status`·`up`·`meta`) + 기동 검사 `verify()` |
| `server/db/migrations/001_db_meta.sql` | 신규 | 첫 마이그레이션 — `db_meta`(용도·생성일·만료일) |
| `server/test-db.js` | 신규 | DSN·TLS 정책 · 러너 · fail-closed 런타임·기동 회귀 (살아 있는 DB 불필요) |
| `server/authoritative/server.js` | 수정 | `/readyz` 추가 · DB 기동 게이트 · `listen()` 분리(기존 출력·동작 보존). 현재 base 의 #237 경제·재연결 변경(`ECONOMY`·`onUpdate`·`pushState`)은 그대로 두고 #264 블록 세 곳만 끼웠다 |
| `server/package.json` · `package-lock.json` | 수정 | `pg@^8.23.0` 추가 · `test:db`·`db:status`·`db:migrate` 스크립트 · `npm test` 에 `test-db.js` 편입. 현재 base 의 `test:authoritative`(#234·#235·#237·#241 경계 테스트 포함)는 그대로다. 두 파일 모두 기존 CRLF 유지 |
| `server/README.md` | 수정 | `#### QA용 Postgres 연결 (선택 · #264)` 절 |
| 이 문서 | 신규 | 설계·운영 런북·검증 |

의존성은 `pg` 하나만 늘었다(전이 포함 15 패키지). Postgres 와이어 프로토콜을 직접 구현할 수는 없고 다른 설치된 라이브러리로 대체되지 않는다 — 이 한 건만 추가했다.

## 3. 설계

### 3.1 "선택적" — 무DB 동작 보존이 기본값 (확정)

`DATABASE_URL` 이 없으면 `db.enabled() === false` 이고 풀도 만들지 않는다. 기동 경로·콘솔 출력·`/healthz`·정적 서빙·`rootDir`·`DD_AUTH_PUBLIC_HOST` 계약이 그대로다. 회귀로 확인했다 — `DATABASE_URL` 없이 띄운 서버가 `listening on …` 을 찍고 `/healthz` 200 `ok`, `/readyz` 200 `ok (no db)` 를 낸다.

### 3.2 fail-closed 세 층 (확정 — 이슈 "쓰기는 실패 시 조용히 성공으로 보이지 않게 한다")

1. **기동 게이트** — `DATABASE_URL` 이 있으면 `select 1` 과 마이그레이션 상태를 확인한 **뒤에만** `listen()` 한다. 실패하면 사유를 찍고 `exit 1`. 반쯤 붙은 서버가 뜨는 것이 최악이다(나중에 계정 쓰기가 조용히 실패한다).
2. **런타임** — `db.query()`·`db.ping()` 은 비활성(`E_DB_DISABLED`)·설정 오류(`E_DB_CONFIG`)·연결 장애를 **전부 rejected promise 로** 낸다(동기 throw 없음 — 회귀로 두 경로 다 확인). 빈 결과·기본값으로 바꾸지 않는다. 저수준 접근자 `db.getPool()` 은 설계상 동기 throw 다(기동 게이트가 `Promise.resolve().then(() => db.getPool())` 로 감싸 같은 경로에서 잡는다).
3. **관측** — `/readyz` 가 실제로 DB 왕복을 하고 실패 시 **503** `db unavailable` 을 낸다. 본문에 호스트·오류 문구를 싣지 않는다.

`/healthz` 는 **일부러** DB 와 분리해 200 `ok` 를 유지한다(추론 — #217 계약 보존 + 플랫폼 헬스체크가 DB 로 흔들리면 DB 장애가 서비스 재시작 루프가 된다). DB 상태는 `/readyz` 로 본다.

### 3.3 TLS 정책과 `pg` 의 함정 (실측)

DSN 을 `pg` 에 `connectionString` 으로 넘기지 않고 **직접 파싱해 개별 필드로** 넘긴다. `node_modules/pg/lib/connection-parameters.js` 가 `Object.assign({}, config, parse(config.connectionString))` 이라 **connectionString 파싱 결과가 명시 옵션을 덮어쓴다.** 실측: `pg-connection-string` 은 `?sslmode=disable` 에서 `ssl: false`, `?sslmode=no-verify` 에서 `{rejectUnauthorized:false}` 를 내놓는다. 즉 DSN 한 줄로 우리가 켠 TLS 가 꺼질 수 있었다.

호스트 분류는 **허용 목록**(`db.classifyHost`)이다. 첫 판의 "점이 없으면 내부" 판정은 공인 IPv6 리터럴을 평문 내부로 보냈고(§11), 두 번째 판의 "영문자로 시작하는 한 단어면 내부" 는 `db`·`intranet` 같은 아무 한 단어 이름을 평문으로 믿었다(§12).

| DSN 호스트 | `sslmode` 미지정·`disable`·`allow` | `require`·`prefer` | `verify-ca`·`verify-full` |
| --- | --- | --- | --- |
| 내부: `localhost`·`127.0.0.1`·`[::1]`(이 기계 안) · `dpg-<영숫자>-a`(Render 내부 URL 형태 — **추론**: Render 연결 문서의 예시 형식이고 실배포 URL 로 확인하지 못했다) | 평문(Render 내부 기본값) | **암호화 on** · 검증은 `DD_DB_CA_CERT` 가 있을 때만, 없으면 "암호화만(미검증)" 을 기동 로그·`describe()` 에 명시. `prefer` 는 `pg` 가 평문 재시도를 못 하므로 `require` 로 올린다 | 검증 on |
| 외부: 점으로 이은 DNS 이름 · IPv4 리터럴(사설 포함) · `[::1]` 밖의 모든 IPv6 리터럴 | 미지정 = **TLS + 인증서 검증** · `disable`·`allow` = **`ssl_downgrade` 기동 중단** | `require` = **TLS + 인증서 검증** · `prefer` = **`ssl_downgrade`** | 검증 on |
| 그 밖: 다른 한 단어 이름(`db`·`postgres`·`dpg-abc-b`) · 비정규 숫자(`0x08080808`·`134744072`·`0177.1`·`1.2.3` — resolver 가 IPv4 로 읽을 수 있다) · 밑줄·퍼센트 인코딩·빈 값 등 | **`bad_host` 기동 중단** | ← | ← |

- `sslmode` 는 libpq 의 여섯 값(`disable`·`allow`·`prefer`·`require`·`verify-ca`·`verify-full`, 대소문자 무시)만 받는다. 오타(`requre`)·`pg` 전용 값(`no-verify`)·빈 값·중복 지정은 **호스트와 무관하게 `bad_sslmode`** 다. 이전에는 내부 호스트에서 모르는 값이 평문으로 떨어졌다.
- DSN 파싱·퍼센트 디코딩(`%zz`)·범위 밖 포트 오류는 전부 `malformed` 사유 코드로 돌려준다. `dbConfig` 는 예외를 던지지 않고, 런타임은 `E_DB_CONFIG` 로 reject 하며 문구·스택에 DSN 조각이 없다(Node 의 URL 오류는 입력 원문을 `input` 에 싣기 때문에 원 예외를 밖으로 내보내지 않는다).
- 한 단어 이름을 내부로 믿지 않는 이유(추론): 한 단어 이름은 resolver 의 search domain 을 타고 어디로든 풀릴 수 있어 "사설망" 이라는 근거가 되지 않는다. docker compose 의 `db` 같은 로컬 개발 이름은 `localhost` 포트 매핑이나 `sslmode=verify-full` 이 가능한 FQDN 으로 쓴다.

IPv6 리터럴은 괄호를 벗겨 `pg` 에 넘긴다(괄호째 넘기면 접속 자체가 안 된다). 사설 IPv4·IPv6 를 내부로 보지 않는 것은 의도다 — Render 내부 주소는 이름(`dpg-…`)으로 오고, 사설 IP 리터럴을 평문으로 허용할 근거가 없다(추론).

내부 `require` 를 평문으로 깎지 않는 이유(코디네이터 지적 반영): Render 공식 문서는 내부 연결도 TLS 를 받아들이지만 인증서가 self-signed 라고 설명한다. 그래서 `require` 는 libpq 의 의미대로 **암호화는 켜고 검증은 하지 않는다**(CA 를 주면 검증까지 켠다). 조용히 내려가지 않는다는 것이 요점이고, 미검증 상태는 로그 문구로 드러낸다.

플랫폼 CA 가 시스템 신뢰 저장소에 없으면 `DD_DB_CA_CERT` 로 CA 파일을 지정한다. 지정했는데 못 읽으면 조용히 시스템 CA 로 내려가지 않고 `ca_unreadable` 로 거부한다. 비밀 값은 `describe()`·로그·오류 메시지에 넣지 않는다(회귀로 누출 문자열 검사).

### 3.4 마이그레이션 계약 (확정 — 이슈 "버전 관리되는 최소 스키마 마이그레이션을 게이트로")

파일 한 개(`server/db-migrate.js`)에 담은 이유: 필요한 것이 "번호순 · 한 번만 · 트랜잭션 안에서 · 이력 기록" 네 가지뿐이고 그것이 60줄이다. 프레임워크를 붙이면 설정·CLI·플러그인이 따라온다.

- 파일명 `NNN_snake_case.sql`, 정렬 = 버전 순. 규칙 위반·버전 중복은 로드 단계에서 거부.
- 적용 이력은 `schema_migrations(version, name, checksum, applied_at)`.
- **이미 적용된 파일의 내용이 바뀌면 아무것도 적용하지 않고 중단**한다(체크섬). 과거 파일을 고치지 말고 새 번호를 추가한다.
- **DB 에 코드가 모르는 버전이 있으면 중단**한다 — 낡은 코드가 새 DB 를 되돌리는 사고를 막는다.
- 파일마다 트랜잭션 1개. 실패 시 `rollback` 하고 즉시 멈춘다(뒤 파일로 넘어가지 않는다).
- **`up()` 전체가 풀에서 연결 하나를 체크아웃해 그 한 연결로만 돈다**(코디네이터 지적 반영). `pg` 의 advisory lock 은 세션(연결) 단위라 `Pool.query` 로 잠그면 잠금·DDL·해제가 서로 다른 연결에서 실행돼 아무것도 막지 못하고, 잠긴 연결이 풀에 남는다. 해제는 `finally`, 연결 반납은 그 밖의 `finally`.
- **`status()`·`verify()` 는 읽기 전용이다** — 원장 표조차 만들지 않는다(`to_regclass` 로 존재만 보고, 없으면 "전부 미적용"으로 읽는다). 원장 생성 DDL 은 `up()` 의 잠금 안에서만 돈다. 확인이 DB 를 바꾸지 않는다.
- 오류 문구에 `pg` 원문 메시지를 싣지 않는다 — 파일명과 SQLSTATE 만 남긴다(연결 메타데이터 누출 방지).

### 3.5 첫 마이그레이션은 왜 `db_meta` 인가 (추론)

계정 스키마(#259)는 이 범위가 아니고, 방 영속화는 승인 밖이다. 그런데 #264 완료 조건은 **무료 DB 의 생성일·만료일을 기록**하고 **연결·마이그레이션·백업·복원을 검증**하라고 한다. `db_meta(key, value, updated_at)` 한 장이 그 둘을 동시에 만족한다 — 만료일이 DB 안에 적히고, 백업·복원 왕복을 확인할 대상이 된다. `node db-migrate.js meta <key> <value>` 로 `psql` 없이 값을 넣을 수 있다.

## 4. 검증

전부 이 워크스페이스에서 실행했다.

전부 base `fafc619` 이식본에서 2026-09-25 실행했다.

| 검사 | 명령 | 결과 |
| --- | --- | --- |
| #264 DB 회귀 | `node test-db.js` (server) | **통과** — 검사 42건 (DSN·TLS 23 · 러너 10 · 저장소 2 · 런타임 4 · 기동 3). 첫 판 33 + REVISE 1차 4 + REVISE 2차 5 |
| 서버 전체 회귀 | `npm test` (server) | **통과**(exit 0) — 프로토콜·보안·설정·실행기·정적·DB + authoritative 18종 전부 0 failed. REVISE 2차 뒤 1회 재실행도 exit 0 (battle-fx 는 무작위 표본이라 489→482 건으로 건수만 달라졌다) |
| 공개 방 실서버 2클라이언트 (구 모드) | `DD_ECONOMY=0 node demo/test/integration/smoke_public_live.js 2` (CI 와 같은 env) | **통과** — pass 23 / fail 0 |
| 공개 방 경제 실서버 2클라이언트 (#237 기본) | `node demo/test/integration/smoke_public_eco_live.js 2` | **통과** — pass 31 / fail 0 |
| 락파일 정합 | `npm ci` (server) | **통과** — 15 패키지 추가, 취약점 0 |
| 기동 fail-closed 수동 탐침 | `DATABASE_URL=postgres://u:…@0x08080808/dd` · `…@[2001:4860:4860::8888]/dd?sslmode=disable` 로 `authoritative/server.js` 기동 | 각각 `bad_host` · `ssl_downgrade` 로 **listen 없이 exit 1**, 비밀번호 미출력 |
| 백업·복원 스크립트 셸 흐름 (REVISE 3·4차) | §5.3 코드 블록을 그대로 뽑아 가짜 `psql`·`pg_dump`·`createdb`·`pg_restore`(argv·`PGSSLMODE`·`PGSSLROOTCERT`·`PGPASSWORD` 를 기록)를 PATH 앞에 두고 `bash` 로 실행 | `bash -n` 통과. **3차**: 성공 exit 0 · createdb/부분 확인/pg_restore 실패 각 exit 3 에서 중단 · 비교 불일치 exit 1 · CA 없음 exit 1. **4차 (18건)**: 정상 입력 exit 0 · 호출 7회 전부 `verify-full`+`system`+`-p 5432` · argv 비밀번호 0건 · `OK:` 문구가 두 표의 값 일치만 말한다. **원격 호출 0회로 exit 1**: `BACKUP_DB` 에 `postgresql://…?sslmode=disable` URL · `dbname=dd sslmode=disable` · `host=evil…` · 호스트에 URL · `/tmp`(소켓 경로) · 끝 점 별칭 · 사용자 `-W` · 공백 · `a;rm -rf x` · 제어 문자 · 포트 0 · 포트 70000 · 날짜 형식 · 대소문자만 다른 같은 호스트+포트 · `approved` 아님 · CA 파일 없음 (16건). 같은 호스트·다른 포트는 규칙대로 통과한다(아래 §14). **5차 (16건 + 대조군)**: `PGSERVICE=evil`·`PGSERVICEFILE`·`PGSYSCONFDIR`·`PGHOSTADDR=6.6.6.6`·`PGGSSENCMODE=prefer`·`PGSSLMODE=disable`·`PGREQUIRESSL=0`·`PGPORT=1` 을 넣은 더러운 환경에서도 exit 0 · 호출 7/7 이 `verify-full`+`system`+`gss=disable` 이고 나머지는 전부 unset · argv 비밀번호 0건. 대조군: 4차 스크립트에 같은 환경을 주면 가짜 클라이언트가 `gss=prefer`·`svc=evil`·`hostaddr=6.6.6.6` 을 받는다 — 환경이 실제로 전달됐고 5차가 그것을 지운다는 증거. 숫자형 호스트 `0177.1`·`1.2.3`·`1.2.3.4`·`1.0x7f`·`127.0.0.1`·`0x7f000001`·`10.0.0.5`(백업)·`0177.0.0.1`(복원) 8건 모두 원격 호출 0회로 exit 1. 정상 FQDN `db.example.com`·`0x7f.example.com`·`a1.b2.io`·`xn--p1ai.xn--p1ai` 4건 exit 0. 회귀: URL DB 이름·같은 호스트+포트 여전히 거부. **실 Postgres 에서는 아무것도 실행하지 않았다** |
| 공백·줄끝 점검 | 변경 파일 9개의 줄끝 공백·충돌 표식·CRLF/LF 혼재 grep, `node -c` | **문제 0** |

2클라이언트 스모크 두 건은 이식 시점(REVISE 1차 전)의 결과다. REVISE 2차는 `server/db.js`·테스트·문서만 바꿔 `DATABASE_URL` 이 없는 게임 경로를 건드리지 않으므로 다시 돌리지 않았다(추론 — `authoritative/server.js`·`package.json` 은 이식 판 그대로).

주의: `smoke_public_live.js` 를 `DD_ECONOMY` 없이 돌리면 `timeout: match start` 로 실패한다(pass 2 / fail 1). #237 이후 서버 기본값이 경제 경기라 그 구 모드 스크립트는 CI 처럼 `DD_ECONOMY=0` 이 필요하다 — #264 와 무관한 기존 계약이다(`.github/workflows/ci.yml` 의 해당 단계 env). `git diff --check` 와 `tools/docs/docs_link_check.js`(내부에서 `git ls-files` 사용)는 Worker Git 금지 때문에 돌리지 않았다 — Mercury 가 커밋 전에 돌려야 한다.

신규 회귀가 실제로 확인하는 것:

- DSN·TLS 정책 23건 — **모르는·오타·중복 `sslmode` 는 내부·루프백·외부 모두 `bad_sslmode`** / 내부 `prefer` 는 암호화 on / **평문 내부는 `dpg-<영숫자>-a`·루프백만, `db`·`dpg-abc-b` 등 한 단어 8종 `bad_host`** / 깨진 퍼센트 이스케이프·범위 밖 포트·깨진 IPv6 괄호 5종 `malformed`(예외 없음, `describe()` 에 DSN 조각 없음) / 위 표의 판정 + **공인 IPv6 `[2001:4860:4860::8888]` = 외부·검증 on·괄호 제거, 강등 3종(`disable`·`prefer`·`allow`) 거부** / `[::1]` 만 내부(사설 IPv6 `fd00::5` 는 외부) / IPv4 리터럴(사설 포함) 외부 / 비정규 숫자·밑줄·퍼센트 인코딩·잘못된 라벨 10종 `bad_host` + `pg` 를 최상위에서 require 하지 않는 것(기존 로컬 설치 보호) — 외부 호스트 기본 검증 on / `sslmode=disable`·`no-verify` 거부 / 내부·루프백 평문 허용 / `verify-full` 존중 / 스킴·DB 이름·형식 오류 / CA 불가독 거부 / 퍼센트 인코딩 디코드 / `describe()` 비밀 누출 없음 / `pg` 지연 로드.
- 마이그레이션 러너 10건 — 순서·원장 기록·트랜잭션 개수·advisory lock 획득/해제 / 재실행 멱등 / **동시 `up()` 2개의 직렬화**(각 파일 1회 적용·연결 2개 체크아웃·전부 반납·잠금 잔류 없음) / 예외 시 연결 반납·잠금 해제 / 중간 실패 시 rollback 과 즉시 중단 / 체크섬 불일치 중단 / 미지 버전 중단 / `verify()` / `status()`·`verify()` 의 DDL 무발생. 가짜 풀이 **"잠금을 쥔 연결에서만 원장을 만진다"를 강제**하므로 `Pool.query` 로 잠그는 구현은 이 테스트에서 바로 실패한다.
- 저장소 마이그레이션 2건 — 파일명·체크섬 안정성 / **#259 계정·경기 스키마가 섞여 들어오지 않음**.
- fail-closed 7건 — `DATABASE_URL` 없이 `query()` reject / 깨진 퍼센트 이스케이프 DSN 은 `E_DB_CONFIG` reject 이고 문구·스택에 사용자·비밀번호·호스트·`%zz` 가 없음 / 설정 오류도 동기 throw 가 아니라 reject / `safeErrorText` 가 `pg` 원문(호스트·포트)을 흘리지 않음 / 닿지 않는 DSN(`127.0.0.1:1`)이면 **listen 하지 않고 exit≠0 이고 로그에 사용자·비밀번호·`호스트:포트` 가 남지 않음** / TLS 강등 DSN 은 연결 시도 전에 중단 / `DATABASE_URL` 없으면 기존처럼 뜨고 `/healthz`·`/readyz` 200. 뒤 셋은 실제 자식 프로세스를 띄워 관찰한다(외부 네트워크 없음).

## 5. 운영 런북

### 5.1 `DATABASE_URL` 주입 (미실행 — CJ 승인 게이트)

**확정**: DB 비밀번호·연결 URL 은 Git·Issue·로그에 남기지 않는다. 그래서 `render.yaml` 에 적지 않고 **대시보드 환경변수로만** 넣는다. Web Service 와 Postgres 는 같은 region 에 두고 **내부 연결 URL**을 쓴다(인터넷을 안 건너므로 지연·노출이 모두 낮고, 이 코드의 TLS 정책에서 평문 허용 경로다).

**미확정 · Mercury·CJ 결정 필요**: 운영 원본을 대시보드로 할지 Blueprint 로 할지. 이 세션은 리소스를 만들 수 없어 `render.yaml` 을 건드리지 않았다.

### 5.2 마이그레이션 실행 경로 (추론)

Free 인스턴스에는 셸이 없다. 두 가지뿐이다.

1. **Build Command 에 붙이기** — `npm ci --prefix server && npm run db:migrate --prefix server`. 빌드 단계에서도 환경변수가 보인다는 Render 문서 서술에 의존한다 — **실측 미확인**.
2. **`DD_DB_MIGRATE_ON_START=1`** — 기동 시 미적용분을 적용하고, 그 뒤 검사까지 통과해야 `listen` 한다. Free 배포의 현실적 경로다. 기본값은 꺼져 있고(적용하지 않고 검사만) 로컬·CI 는 `npm run db:migrate` 를 쓴다.

어느 쪽이든 **적용 실패 = 서버가 뜨지 않는다.** 미적용 스키마로 서비스가 뜨는 경우는 없다.

### 5.3 백업·복원 (절차만 — **실 DB 에서 한 번도 실행하지 않았다**)

무료 Postgres 는 관리형 백업이 없다. 만료(생성 30일 + 유예 14일) 전에 수동으로 받는다. **이 절차는 Postgres·`psql`·`pg_dump` 가 없는 환경에서 썼고, 살아 있는 DB 에 대해 실행된 적이 없다.** 확인한 것은 가짜 클라이언트로 돌린 셸 흐름(§4)뿐이다.

**선행 조건 — 지금은 충족되지 않았다. 복원 리허설은 보류(pending)다.**

- 복원 대상은 **QA DB 와 다른 Postgres 서버** 에 있어야 하고, 그 서버의 사용자에게 `CREATEDB` 권한이 있어야 한다.
- 이것은 Render Free 가 주는 기능이 아니다. Free Postgres 는 workspace 당 **하나만** 둘 수 있고 그 하나가 백업 원본이다. 이 기계에는 로컬 Postgres·Docker 도 없다(§6).
- 따라서 별도 스크래치 서버와 `CREATEDB` 권한이 마련되기 전에는 아래 스크립트의 3)~6) 을 **실행할 수 없다**. 이 작업은 어떤 서버·DB 도 만들지 않았다. 스크래치 서버를 어디에 둘지(유료 인스턴스·다른 계정·로컬 설치)는 비용·자원 결정이라 CJ 승인 대상이다.
- 그때까지 할 수 있는 것은 1)~2) — 만료일 사본 기록과 `pg_dump` 백업 파일 확보 — 뿐이다. 이것도 QA DB 가 생기고 외부 연결 정보를 받은 뒤의 일이다.

**연결 대상은 둘이고 자격증명을 섞지 않는다.** 서비스의 `DATABASE_URL` 은 **내부** 주소라 로컬에서 닿지 않으므로 이 절차에 쓰지 않는다.

| 대상 | 무엇 | 자격증명 |
| --- | --- | --- |
| 백업 원본 (`BACKUP_*`) | 같은 QA DB 의 **외부** 호스트 | Dashboard 의 External 연결 정보. 비밀번호는 `read -rs` 로만 받는다 |
| 복원 대상 (`RESTORE_*`) | **이번 실행에서 새로 만드는** 스크래치 DB `dd_restore_<시각>` — 위 선행 조건의 별도 서버(**아직 없음**) | 그 서버의 사용자·비밀번호. **운영 서버·운영 DB 를 가리키면 안 된다** |

규칙 다섯 가지:

1. **비밀은 argv 에 없다.** DSN·URL 을 쓰지 않는다. 명령 인자에는 호스트·사용자·DB 이름만 있고, 비밀번호는 `PGPASSWORD="…" 명령` 형태로 **그 한 명령의 환경변수로만** 넘긴다(셸의 앞붙임 대입은 argv 가 아니다). 백업 비밀번호가 복원 명령에 가지 않도록 `export` 하지 않는다.
2. **모든 원격 libpq 호출은 `PGSSLMODE=verify-full`** 이다. 그 전에 물려받은 `PG*` 환경변수를 전부 지우고 `PGGSSENCMODE=disable` 을 둔다 — 근거는 PostgreSQL 공식 문서: 서비스 파일 설정은 환경변수보다 우선하고([libpq-pgservice](https://www.postgresql.org/docs/current/libpq-pgservice.html)), `hostaddr` 가 있으면 그것이 접속 주소이며, GSSAPI 암호화가 가능하면 `sslmode` 와 무관하게 SSL 보다 먼저 쓰인다([libpq-connect](https://www.postgresql.org/docs/current/libpq-connect.html)). 명령 인자(`-h`·`-p`·`-U`·`-d`)는 그 어느 것보다 우선한다. 이 스크립트는 서비스를 지정하지 않으므로 서비스 파일은 읽히지 않는다(문서상 동작 — 실 libpq 로는 미확인). libpq 기본값 `prefer`(TLS 실패 시 평문 재시도)를 쓰지 않는다. CA 는 `PGSSLROOTCERT` 로 **반드시 명시**한다 — `system`(libpq 16+ 이 OS 신뢰 저장소로 검증) 또는 플랫폼 CA 파일 경로. 어느 쪽이 Render 외부 인증서에 맞는지는 **미확정**이며, 실패하면 `require` 로 낮추지 말고 CA 파일을 받아 지정한다.
3. **빈 복원 대상의 근거는 "방금 새로 만든 DB" 다.** `createdb --template=template0` 로 매번 새 이름을 만들고, 이미 있으면 `createdb` 가 실패해 멈춘다. `template0` 은 `template1` 에 누가 넣어 둔 객체를 복사하지 않는다. 그 뒤의 카탈로그 질의는 **부분 확인(심층 방어)** 일 뿐 빈 DB 의 증명이 아니다 — 세지 않는 종류가 남아 있다(아래). `db-migrate.js status` 는 `schema_migrations` 원장만 보므로 **빈 DB 확인에 쓰지 않는다.**
4. **원격 호출 전에 입력을 검사한다.** 호스트는 점이 있고 마지막 라벨이 영문자로 시작하는 DNS 이름(`1.2.3.4`·`1.2.3`·`0177.1` 같은 숫자형 거부 — IP 리터럴은 받지 않는다), 포트는 1~65535, 사용자·DB 이름은 `[A-Za-z_][A-Za-z0-9_]*`(63자 이하)만 받는다. URL·`key=value` 연결 문자열·공백·따옴표·`-` 로 시작하는 값을 거부해 `pg_dump -d`·`psql -d` 가 붙여 넣은 URL 을 다른 대상이나 `sslmode` 로 재해석하지 못하게 한다. 백업과 복원의 호스트+포트가 같으면 거부하고, 복원 서버가 **CJ 승인을 받은 독립 스크래치 서버** 라는 운영자 확인(`approved`)을 받는다. 별칭(CNAME·IP 리터럴·다른 호스트 이름)이 같은 서버를 가리키는지는 문자열 비교로 증명할 수 없으므로 그 확인이 유일한 방어다.
5. **첫 오류에서 멈춘다.** 아래를 파일로 저장해 `bash` 로 실행한다(대화형 셸에 한 줄씩 붙여 넣지 않는다). `set -euo pipefail` 이 실패한 단계 뒤를 돌리지 않고, `pg_restore` 는 `--single-transaction --exit-on-error` 로 부분 복원을 남기지 않는다. 마지막 줄 `OK:` 가 나오지 않았으면 실패다.

```sh
#!/usr/bin/env bash
# dd-qa-backup-restore.sh — 저장소 밖에 저장하고 `bash dd-qa-backup-restore.sh` 로 실행한다. 커밋하지 않는다.
set -euo pipefail

# 0) 비밀이 아닌 값 — 화면에 보여도 된다
read -rp 'Dashboard 생성일 (YYYY-MM-DD, 권위는 Dashboard): ' CREATED_AT
read -rp 'Dashboard 만료일 (YYYY-MM-DD, 권위는 Dashboard): ' EXPIRES_AT
read -rp '백업 원본 외부 호스트 (FQDN): ' BACKUP_HOST
read -rp '백업 원본 포트: ' BACKUP_PORT
read -rp '백업 원본 사용자: ' BACKUP_USER
read -rp '백업 원본 DB 이름: ' BACKUP_DB
read -rp '복원 서버 호스트 (FQDN, 운영 서버 금지): ' RESTORE_HOST
read -rp '복원 서버 포트: ' RESTORE_PORT
read -rp '복원 서버 사용자 (CREATEDB 권한): ' RESTORE_USER
read -rp 'CA — system 또는 CA 파일 경로: ' PG_CA
read -rp '복원 서버가 CJ 승인을 받은 독립 스크래치 서버인가? (정확히 approved 입력): ' SCRATCH_OK

# 원격 호출 전에 전부 검사한다. CLI 옵션으로 가는 값은 "평범한 이름" 만 받는다 — URL(`postgresql://`)·
# 연결 문자열(`key=value`)·공백·따옴표·`/`·`:`·`-` 로 시작하는 값은 libpq 가 -d/-h 를 다른 대상이나
# sslmode 로 재해석하거나 옵션으로 읽을 수 있어 거부한다.
die() { echo "거부: $*" >&2; exit 1; }
# 호스트: 점이 있는 DNS 이름이고 마지막 라벨(TLD)이 영문자로 시작해야 한다. `1.2.3.4`·`1.2.3`·`0177.1`
# (=127.0.0.1)·`1.0x7f` 처럼 resolver 가 IPv4 로 읽을 수 있는 숫자형은 모두 거부한다(IP 리터럴 미지원).
is_host() { [[ "$1" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$ ]] &&
            [[ "${1##*.}" =~ ^[A-Za-z]([A-Za-z0-9-]*[A-Za-z0-9])?$ ]]; }
is_port() { [[ "$1" =~ ^[1-9][0-9]{0,4}$ ]] && [ "$1" -le 65535 ]; }
is_name() { [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]]; }
is_date() { [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; }
is_date "$CREATED_AT"   || die '생성일 형식'
is_date "$EXPIRES_AT"   || die '만료일 형식'
is_host "$BACKUP_HOST"  || die '백업 호스트 형식'
is_port "$BACKUP_PORT"  || die '백업 포트 형식'
is_name "$BACKUP_USER"  || die '백업 사용자 형식'
is_name "$BACKUP_DB"    || die '백업 DB 이름 형식'
is_host "$RESTORE_HOST" || die '복원 호스트 형식'
is_port "$RESTORE_PORT" || die '복원 포트 형식'
is_name "$RESTORE_USER" || die '복원 사용자 형식'
[ "$PG_CA" = system ] || [ -r "$PG_CA" ] || die 'CA 파일을 읽을 수 없다'
[ "$SCRATCH_OK" = approved ] || die '승인된 독립 스크래치 서버 확인 없음'
# 같은 호스트+포트는 거부한다. 문자열 비교라 별칭(CNAME·IP·다른 이름)이 같은 서버인 것은 잡지 못한다 —
# 그것은 위 approved 확인(운영자 책임)으로만 막는다.
b="$(printf %s "$BACKUP_HOST" | tr A-Z a-z):$BACKUP_PORT"; r="$(printf %s "$RESTORE_HOST" | tr A-Z a-z):$RESTORE_PORT"
[ "$b" != "$r" ] || die '백업 원본과 복원 서버의 호스트+포트가 같다'

# 비밀 — 화면·셸 이력·argv 에 남지 않는다
read -rsp '백업 원본 비밀번호: ' BACKUP_PW; echo
read -rsp '복원 서버 비밀번호: ' RESTORE_PW; echo

STAMP="$(date +%Y%m%d%H%M%S)"
RESTORE_DB="dd_restore_$STAMP"      # 매번 새 DB — 기존 DB 에는 절대 복원하지 않는다
DUMP="dd-qa-$STAMP.dump"
WORK="$(mktemp -d)"

# 물려받은 PG* 환경변수를 전부 지운다. libpq 문서상 서비스 파일 설정(PGSERVICE 로 선택)은 환경변수보다
# 우선하므로 남겨 두면 아래 PGSSLMODE 를 sslmode=disable 로 덮을 수 있고, PGHOSTADDR 는 -h 대신 실제 접속
# 주소가 된다. 서비스는 PGSERVICE 나 service= 로 지정할 때만 쓰이므로 이것으로 서비스 파일이 빠진다.
for v in $(compgen -e); do case "$v" in PG*) unset "$v" ;; esac; done
# 모든 원격 libpq 호출: 인증서 검증 필수, prefer 폴백 없음, CA 명시. GSSAPI 암호화는 sslmode 와 무관하게
# SSL 보다 먼저 쓰이므로(libpq 문서) gssencmode=disable 로 꺼서 verify-full SSL 만 남긴다.
export PGSSLMODE=verify-full PGSSLROOTCERT="$PG_CA" PGGSSENCMODE=disable PGCONNECT_TIMEOUT=15

# 1) 만료일 사본을 원본 db_meta 에 기록 (Dashboard 날짜가 권위 — 다르면 이 값이 틀린 것이다)
PGPASSWORD="$BACKUP_PW" psql -X -q -v ON_ERROR_STOP=1 -h "$BACKUP_HOST" -p "$BACKUP_PORT" -U "$BACKUP_USER" -d "$BACKUP_DB" \
  -v created="$CREATED_AT" -v expires="$EXPIRES_AT" <<'SQL'
INSERT INTO db_meta (key, value) VALUES ('free_tier_created_at', :'created'), ('free_tier_expires_at', :'expires')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
SQL

# 2) 백업
PGPASSWORD="$BACKUP_PW" pg_dump -h "$BACKUP_HOST" -p "$BACKUP_PORT" -U "$BACKUP_USER" -d "$BACKUP_DB" \
  --format=custom --no-owner --no-privileges --file="$DUMP"

# 3) 새 스크래치 DB — 이것이 "빈 대상" 의 실제 근거다. 같은 이름이 있으면 실패하고 멈춘다.
PGPASSWORD="$RESTORE_PW" createdb -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" --maintenance-db=postgres \
  --template=template0 "$RESTORE_DB"

# 4) 부분 확인(심층 방어) — 증명이 아니다. 무언가 세어지면 RAISE → psql exit 3 → 여기서 멈춘다.
PGPASSWORD="$RESTORE_PW" psql -X -q -v ON_ERROR_STOP=1 -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" -d "$RESTORE_DB" <<'SQL'
DO $$
DECLARE n bigint;
BEGIN
  SELECT
      (SELECT count(*) FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
        WHERE s.nspname NOT IN ('pg_catalog', 'information_schema') AND s.nspname !~ '^pg_(toast|temp_)')
    + (SELECT count(*) FROM pg_namespace
        WHERE nspname NOT IN ('public', 'pg_catalog', 'information_schema') AND nspname !~ '^pg_(toast|temp_)')
    + (SELECT count(*) FROM pg_proc p JOIN pg_namespace s ON s.oid = p.pronamespace
        WHERE s.nspname NOT IN ('pg_catalog', 'information_schema'))
    + (SELECT count(*) FROM pg_type t JOIN pg_namespace s ON s.oid = t.typnamespace
        WHERE s.nspname NOT IN ('pg_catalog', 'information_schema') AND s.nspname !~ '^pg_(toast|temp_)'
          AND t.typrelid = 0 AND t.typelem = 0)
    + (SELECT count(*) FROM pg_extension WHERE extname <> 'plpgsql')
    + (SELECT count(*) FROM pg_largeobject_metadata)
    + (SELECT count(*) FROM pg_publication)
    + (SELECT count(*) FROM pg_event_trigger)
    + (SELECT count(*) FROM pg_default_acl)
  INTO n;
  IF n > 0 THEN RAISE EXCEPTION 'restore target is not empty: % objects', n; END IF;
END $$;
SQL

# 5) 복원 — 한 트랜잭션, 첫 오류에서 중단
PGPASSWORD="$RESTORE_PW" pg_restore -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" -d "$RESTORE_DB" \
  --single-transaction --exit-on-error --no-owner --no-privileges "$DUMP"

# 6) 원장·메타 비교 — schema_migrations 와 db_meta 의 값만 본다. 전체 스키마·데이터 동등성은 확인하지 않는다.
#    원본 출력이 비면 실패로 본다.
Q1='select version, name, checksum from schema_migrations order by version'
Q2='select key, value from db_meta order by key'
PGPASSWORD="$BACKUP_PW" psql -X -At -v ON_ERROR_STOP=1 -h "$BACKUP_HOST" -p "$BACKUP_PORT" -U "$BACKUP_USER" -d "$BACKUP_DB" \
  -c "$Q1" -c "$Q2" > "$WORK/src.txt"
PGPASSWORD="$RESTORE_PW" psql -X -At -v ON_ERROR_STOP=1 -h "$RESTORE_HOST" -p "$RESTORE_PORT" -U "$RESTORE_USER" -d "$RESTORE_DB" \
  -c "$Q1" -c "$Q2" > "$WORK/dst.txt"
[ -s "$WORK/src.txt" ] || { echo '원본 원장·메타가 비어 있다 — 확인 불가' >&2; exit 1; }
diff "$WORK/src.txt" "$WORK/dst.txt"

echo "OK: $DUMP → $RESTORE_DB 복원 완료, schema_migrations·db_meta 값 일치 (그 밖의 표·데이터는 비교하지 않았다). 확인이 끝나면 dropdb 로 $RESTORE_DB 를 지운다."
```

- **부분 확인이 세지 않는 것**: 콜레이션·연산자·캐스트·변환·텍스트 검색 설정·FDW·외부 서버·구독(`pg_subscription` 은 일반 사용자에게 읽기가 막혀 있다)·`public` 스키마 자체의 권한 변경·DB 단위 설정(`ALTER DATABASE … SET`). 그래서 빈 대상의 근거는 3) 의 새 DB 생성이고 4) 는 3) 이 엉뚱한 곳을 가리켰을 때를 잡는 보조 장치다.
- **원격 검증 TLS 전용**: 이 런북은 인증서를 검증할 수 있는 원격 서버 두 대만 다룬다. TLS 없는 로컬 스크래치 예외는 두지 않는다 — 그런 서버를 가리키면 `verify-full` 로 실패하고 멈춘다.
- **`OK:` 가 뜻하는 것**: 복원이 오류 없이 끝났고 `schema_migrations`(버전·이름·체크섬)와 `db_meta`(키·값) 의 값이 원본과 같다는 것뿐이다. 다른 표의 행·스키마 전체·권한의 동등성은 이 스크립트가 비교하지 않는다. 지금 스키마는 그 두 표뿐이지만(§3.5) 표가 늘면 이 비교는 그만큼 좁아진다.
- `PGSSLROOTCERT=system` 은 libpq 16 이상에서만 동작한다. `pg_dump` 의 메이저 버전은 원본 서버 이상이어야 한다(추론 — Postgres 일반 제약).
- `node db-migrate.js status|meta` 는 이 절차에 필요 없다. 쓰려면 `DATABASE_URL` 에 외부 URL 을 **셸 앞붙임 대입**으로만 주고(argv 금지), CA 가 파일이면 `DD_DB_CA_CERT` 에 같은 파일을 준다. Node 는 OS 신뢰 저장소가 아니라 내장 CA 목록을 쓴다는 점이 libpq `system` 과 다르다.
- 테스트 데이터는 **재생성 가능한 것으로만** 취급한다 — 실제 계정·공식 전적을 만료되는 DB 에 유일본으로 두지 않는다(확정).

### 5.4 DB 장애 중 동작 (현재 구현 · 정책은 [기획 필요])

지금은 DB 에 의존하는 기능이 없으므로 DB 가 죽어도 기존 게임 경로는 그대로 돈다. 관측은 `/readyz` 503. **계정·로그인이 붙은 뒤의 정책** — DB 장애 중 로그인 거부인지, 이미 붙은 방 진입은 허용인지 — 은 GDD-23 §9 에서도 **[기획 필요]** 이고 이 세션이 임의로 정하지 않았다. 기술 기반은 "쓰기 실패는 조용히 성공이 되지 않는다"로 이미 fail-closed 쪽에 서 있다.

## 6. 검증하지 못한 것 (솔직 보고)

- **살아 있는 Postgres 왕복 없음.** 이 워크스페이스에 `postgres`·`psql`·`pg_dump`·`pg_restore`·`docker` 가 없다(2026-09-25 이식 세션에서 `command -v` 재실측). 따라서 §5.3 스크립트(`createdb --template=template0`·부분 카탈로그 확인·`--single-transaction --exit-on-error`·`verify-full`+`PGSSLROOTCERT`·왕복 `diff`)도 **실 DB 에 대해 실행해 보지 못했다** — 셸 흐름만 가짜 클라이언트로 확인했다. 따라서 **실제 연결·`001_db_meta.sql` 의 실행·`pg_dump`/`pg_restore`·advisory lock 의 실동작은 실측되지 않았다.** 러너의 순서·트랜잭션·중단 조건은 주입한 가짜 client 로, 기동 fail-closed 는 실제 자식 프로세스로 검증했지만 그것이 실 DB 검증을 대체하지 않는다. 이 검사를 CI 필수 게이트로 넣지 않은 이유이기도 하다(서비스 컨테이너를 붙이는 것은 별도 판단 사항).
- **Render Dashboard 실제 상태 미확인** — Web/Postgres 요금제·region·배포 브랜치·auto-deploy·DB 존재·생성일/만료일 전부 **미확정**. 대시보드는 로그아웃 상태이고 이 세션은 로그인·조회·생성을 하지 않았다. `render.yaml` 만으로 단정하지 않는다(확정 계약).
- **Build Command 에서 `DATABASE_URL` 이 보이는지 미실측**(§5.2 1번). 그래서 기동 옵트인 경로를 같이 뒀다.
- **advisory lock·`to_regclass`·`pg_dump`/`pg_restore` 의 실제 동작은 실 DB 에서만 확인된다.** 잠금을 한 연결로 묶는 계약은 가짜 풀이 강제하지만, Postgres 가 그 잠금으로 실제로 직렬화하는지는 실측 밖이다.
- **2클라이언트·HTTPS/WSS·재배포 후 보존의 실배포 확인 없음** — 리소스가 없으므로 원리상 불가. #264 완료 조건의 그 항목들은 여전히 열려 있다.

## 7. 링크 검사

이번 이식에서는 `tools/docs/docs_link_check.js` 를 돌리지 않았다 — 내부에서 `git ls-files` 를 쓰고 이 Worker 는 Git 명령을 쓰지 않는다. 대신 이 문서의 상대 링크 2건(WORKER_MODELS.md · #217 deploy-readiness)과 `server/README.md` 가 가리키는 이 문서의 경로가 실제로 있는지 직접 확인했다. **Mercury 가 커밋 전에 링크 검사기를 돌려야 한다.**

## 8. Rollback

- 코드: 이 브랜치의 커밋을 되돌리면 끝난다. `DATABASE_URL` 을 설정하지 않은 배포에서는 **되돌릴 것도 없다** — 동작이 동일하다.
- 의존성: `pg` 제거 시 `server/db.js`·`db-migrate.js`·`test-db.js` 와 `authoritative/server.js` 의 게이트·`/readyz` 블록을 함께 지운다.
- DB: 이 마이그레이션은 `db_meta` 와 `schema_migrations` 두 표만 만든다. 다운 마이그레이션 파일은 만들지 않았다 — **폐기 가능한 QA DB 는 DB 자체를 지우고 다시 만드는 것이 정상 경로**다. 표를 drop 하는 것은 그 DB 에 보존할 데이터가 없다고 확인된 경우에만 하고, 조금이라도 데이터가 들어 있으면 **먼저 `pg_dump` 를 받고 CJ 승인을 받은 뒤** 진행한다. 원장(`schema_migrations`)만 지우면 다음 `up()` 이 이미 있는 표에 다시 적용을 시도하므로, 둘을 함께 정리하거나 DB 를 새로 만든다.

## 9. 남은 것 / 다음 단계

1. **CJ** — Render Postgres 생성·요금제 승인(현재 미승인). 승인 후 **Mercury** 가 대시보드에서 DB 생성·같은 region 배치·내부 `DATABASE_URL` 주입, 실제 plan·region·생성일·만료일을 기록.
2. **Jupiter(후속)** — QA DB 가 생기면 `npm run db:migrate` · §5.3 1)~2)(백업) 실측. 복원 리허설 3)~6) 은 **별도 스크래치 서버 + `CREATEDB` 권한이 생길 때까지 보류** — 그 자원은 CJ 승인 대상이다. 실측 후 이 문서 §6 을 갱신.
3. **Saturn** — #250 모델(`gpt-6-sol`/xhigh/default)로 이 이식본을 독립 READ_ONLY 재검수. 첫 REVISE 는 잘못된 모델의 판정이라 정식 QA 로 세지 않는다(WORKER_MODELS.md 사고 기록).
4. **Mercury** — 커밋 전 `git diff --check`·링크 검사기 실행, `issue-264-render-db` 옛 트리의 Mercury `operations.md` 를 이 브랜치로 옮길지 판단(Jupiter 는 Mercury 문서를 옮기지 않았다).
5. **[기획 필요]** — 계정 데이터 보존/삭제, DB 장애 중 로그인·방 진입 정책, 배포 중 진행 경기 정책, 백업 주기·복원 목표. GDD-23 §9 에서도 미정이다.

## 10. 코디네이터 리뷰 반영 (2026-09-25, worker_done 전)

| 지적 | 판정 | 조치 |
| --- | --- | --- |
| `pg_advisory_lock` 을 `Pool.query` 로 걸면 세션이 달라져 잠금이 무의미하다 — `pool.connect()` 로 체크아웃한 **한 연결**로 `up()` 전체를 돌리고 `finally` 에서 반납하라. 결정론적 동시성/잠금 테스트를 붙이라 | **맞다 — 실제 결함** | `acquire()` 를 추가해 `up()` 전체를 한 연결로 묶고, 해제(`finally`)와 반납(`finally`)을 분리했다. 가짜 풀이 "잠금을 쥔 연결에서만 원장을 만진다"를 강제하고, 동시 `up()` 2개 직렬화·예외 시 반납/해제 테스트를 추가했다 |
| `status()` 가 읽기 전용이라면서 `CREATE TABLE` 을 돌린다 — `status`/`verify` 에서 DDL 을 없애라 | **맞다** | `to_regclass` 로 원장 존재만 확인하고, 없으면 "전부 미적용"으로 읽는다. 원장 생성 DDL 은 `up()` 의 잠금 안에서만 돈다. `status()`·`verify()` 의 DDL 무발생을 테스트로 고정 |
| Render 내부 연결의 `sslmode=require` 를 `ssl=false` 로 매핑하는 것은 조용한 강등이다 (공식 문서: 내부도 TLS 를 받지만 self-signed) | **맞다** | 내부 `require` 는 암호화를 켠다. CA 가 있으면 검증까지, 없으면 `rejectUnauthorized:false` + "암호화만(미검증)" 을 `describe()`·기동 로그에 명시. 미지정은 그대로 평문(Render 내부 기본값). 테스트 3건 추가 |
| 기동 catch 가 `pg` 원문 `e.message` 를 찍어 연결 메타데이터가 로그에 남을 수 있다 | **맞다** | `db.safeErrorText()` 추가 — 우리가 쓴 문구(`ddSafe`)는 그대로, 그 밖은 **오류 코드만**. 마이그레이션 실패 문구도 파일명+SQLSTATE 로 축소. 회귀에서 `sekrit-pw`·`dduser`·`127.0.0.1:1` 이 출력에 없음을 확인 |
| §3.2 의 "`query()` 는 항상 reject" 와 동기 throw 가능성이 어긋난다 | **부분적으로 맞다** | `query()`·`ping()` 은 try/catch 로 감싸 항상 reject 한다(설정 오류 경로 테스트 추가). 저수준 `getPool()` 은 동기 throw 임을 §3.2 에 명시했다 |
| §5.3 백업 예시가 서비스의 내부 URL 을 쓰는 것처럼 읽힌다 — 외부 백업 URL·빈 복원 대상을 따로 이름 붙이고 자격증명을 출력하지 말라. 만료일은 대시보드가 권위다 | **맞다** | `DATABASE_URL`(내부) · `DD_BACKUP_URL`(외부) · `DD_RESTORE_URL`(빈 스크래치)을 표로 분리하고, `db_meta` 날짜는 메모이며 대시보드가 이긴다고 명시 |
| §8 Rollback 이 스키마 drop 을 가볍게 권한다 | **맞다** | 폐기 가능한 QA DB 는 DB 재생성이 정상 경로이고, 데이터가 있으면 `pg_dump` 후 CJ 승인. 원장만 지우면 재적용이 깨진다는 주의를 추가 |
| 설계를 타임박스하고 실 DB 한계는 기다리지 말고 문서화하라 | 수용 | 실 DB·`psql`·`docker` 부재를 §6 에 남기고 대기 없이 마무리했다 |

## 11. 첫 Saturn REVISE 반영 (2026-09-25, base `fafc619` 이식본)

첫 Saturn 판정은 #250 이전 모델이었지만 결함 자체는 유효한 증거라 모두 고쳤다.

| 지적 | 판정 | 조치 |
| --- | --- | --- |
| `isInternalHost` 가 "점이 없으면 내부" 라서 공인 IPv6 DSN `[2001:4860:4860::8888]` 을 평문 내부로 본다 | **맞다 — 실제 결함** | 허용 목록 분류 `classifyHost` 로 바꿨다(§3.3 표). `[::1]` 밖의 IPv6 리터럴은 전부 외부 = TLS+검증, 강등 `sslmode` 는 `ssl_downgrade`. 괄호를 벗겨 `pg` 에 넘긴다(이전에는 IPv6 로는 접속 자체가 안 됐다) |
| 형식이 이상하거나 모르는 호스트가 fail-open 한다 | **맞다** | 분류할 수 없는 호스트는 `bad_host` 로 기동 중단. 조사 중 같은 구멍을 하나 더 찾았다 — `0x08080808`·`134744072`·`0177.1` 같은 비정규 숫자는 점이 없거나 DNS 이름처럼 보여도 resolver 가 IPv4(`8.8.8.8`·`127.0.0.1`)로 읽는다. 내부 라벨은 영문자로 시작해야 하고, 마지막 라벨이 숫자인 비정규 주소는 거부한다 |
| 복원 런북이 `pg_restore` 오류에서 멈추지 않는다 | **맞다** | `--single-transaction --exit-on-error` 명시, 종료 코드 0 확인, 실패 시 스크래치 DB 재생성 후 재시도(§5.3) |
| DSN 을 argv 로 넘겨 비밀번호가 프로세스 목록에 보인다 | **맞다** | `pg_dump`/`pg_restore` 에는 비밀 아닌 필드만 인자로, 비밀번호는 서브셸 안 `PGPASSWORD`. URL 은 `read -rs` 로 받아 환경변수로만 `db-migrate.js` 에 넘긴다 |
| `DD_BACKUP_URL`·`DD_RESTORE_URL`·만료일 권위가 흐리다 | **맞다** | 표로 역할 분리(내부 `DATABASE_URL` / 외부 백업 / 빈 스크래치), 복원 전 대상이 비었는지 확인하는 단계 추가. 만료일은 Dashboard 가 권위, `db_meta` 는 사본이며 다르면 Dashboard 값으로 고친다 |

회귀: `test-db.js` 에 4건 추가(공인 IPv6 · `[::1]`/사설 IPv6 · IPv4 리터럴 · `bad_host` 10종). `git` 을 쓰지 않았으므로 옛 트리와 이식본의 대조는 파일 `diff` 로 했다 — `authoritative/server.js` 는 옛 #264 판과의 차이가 #237 변경 네 곳뿐이다.

## 12. Saturn REVISE 2차 반영 (2026-09-25, ctx_8bf983a914fb)

| 지적 | 판정 | 조치 |
| --- | --- | --- |
| 모르는·오타 `sslmode`(`requre`)가 내부 호스트에서 조용히 평문이 된다 | **맞다 — 실제 결함** | libpq 여섯 값의 허용 목록. 그 밖·빈 값·중복 지정은 호스트와 무관하게 `bad_sslmode` 기동 중단. `startsWith('verify')` 판정(`verifyfull` 통과)도 정확 비교로 바꿨다. 내부 `prefer` 는 평문이 아니라 암호화로 올린다 |
| 영문자로 시작하는 한 단어 호스트를 전부 내부(평문 허용)로 믿는다 | **맞다** | 평문 내부는 루프백 3종과 Render 내부 URL 형태 `dpg-<영숫자>-a` 만. 그 밖의 한 단어 이름은 `bad_host`. `dpg-…-a` 형태는 Render 연결 문서의 예시에서 온 **추론**이며 실배포 URL 로 확인하지 못했다 — 형태가 다르면 서비스가 뜨지 않고 `bad_host` 를 찍는다(fail-closed 방향). 그때 이 정규식을 실제 형태로 고친다 |
| 깨진 퍼센트 이스케이프가 `dbConfig` 밖으로 `URIError` 를 던지고, URL 파싱 오류가 정제되지 않을 수 있다 | **맞다** | URL 파싱과 모든 디코딩을 한 `try` 로 묶어 `malformed` 사유 코드만 돌려준다. `getPool()`→`E_DB_CONFIG`(ddSafe 문구) → 기동 게이트·CLI 는 `safeErrorText` 로 사유만 찍는다 |
| §5.3 이 `db-migrate status` 로 빈 복원 대상을 확인한다고 주장하지만 원장만 본다 | **맞다** | 사용자 객체 카탈로그 질의(`psql -v ON_ERROR_STOP=1` + `DO … RAISE`)로 교체하고 `&&` 로 복원 앞에 묶었다. 비밀번호는 `PGPASSWORD` 서브셸로만. **실 Postgres 에서 실행하지 못했고** 세지 않는 객체 종류를 §5.3 에 적었다 |

회귀: `test-db.js` 에 5건 추가·2건 기대값 갱신(`no-verify` 는 이제 `ssl_downgrade` 가 아니라 `bad_sslmode` — 둘 다 거부). `#237` 서버 기준선(`authoritative/server.js`·`package.json`)과 `DATABASE_URL` 미설정 경로는 바꾸지 않았다.

## 13. Saturn REVISE 3차 반영 (2026-09-25, ctx_fcec0536e310) — 문서만

| 지적 | 판정 | 조치 |
| --- | --- | --- |
| 원격 `psql`·`pg_restore` 에 `PGSSLMODE=verify-full`·CA 지정이 없어 libpq 기본 `prefer`(평문 폴백)로 돈다 | **맞다** | 스크립트 전체에 `export PGSSLMODE=verify-full PGSSLROOTCERT="$PG_CA"`. CA 는 `system` 또는 읽을 수 있는 파일만 받고, 아니면 원격 호출 전에 멈춘다. 로컬 TLS 없는 스크래치만 복원 쪽에 명시적 `PGSSLMODE=disable` 예외 — **4차에서 폐지**(§14) |
| 빈 대상 SQL 이 `pg_publication`·`pg_event_trigger`·`pg_default_acl` 을 세지 않는데 빈 DB 를 증명하는 것처럼 쓰였다 | **맞다** | 세 카탈로그를 추가했지만, **빈 대상의 실제 근거는 매번 새 이름으로 `createdb --template=template0`** 이다(이미 있으면 실패). 카탈로그 질의는 "부분 확인(심층 방어)" 으로 이름을 바꾸고 여전히 세지 않는 종류를 적었다. `status` 가 빈 DB 를 증명한다는 서술은 없앴다 |
| 붙여넣기 안전·오류 중단 | 보강 | `<호스트>` 자리표시자(셸에선 리디렉션)를 없애고 `read` 로 받는 변수로 바꿨다. 파일로 저장해 `bash` 로 돌리는 `set -euo pipefail` 스크립트 하나로 묶고, 마지막 `OK:` 줄이 성공의 유일한 신호다. DSN·URL 변수(`DD_BACKUP_URL`·`DD_RESTORE_URL`)는 더 쓰지 않는다 — 비밀번호만 명령별 `PGPASSWORD=` 앞붙임으로 넘겨 argv 와 반대편 명령에 새지 않는다 |
| 왕복 확인 | 보강 | `db-migrate.js status`(코드 대비) 대신 원본·복원본의 `schema_migrations`·`db_meta` 를 `psql -At` 로 뽑아 `diff`. 원본 출력이 비면 실패로 본다. (4차에서 성공 문구를 이 두 표의 값 비교로 좁혔다) |

코디네이터 후속 지시(같은 dispatch)에 따라 스크래치 서버·`CREATEDB` 권한을 **명시적 선행 조건**으로 적고, Render Free 로는 충족할 수 없어(workspace 당 Free Postgres 1개 · 이 기계에 로컬 Postgres·Docker 없음) **복원 리허설은 보류** 라고 표시했다. 자원은 만들지 않았다.

제품 코드·테스트·`server/README.md` 는 바꾸지 않았다(README 에는 런북 본문이 없고 이 문서를 가리키기만 한다). **라이브 DB 검증은 이번에도 없다.**

## 14. Saturn REVISE 4차 반영 (2026-09-25, ctx_55512a9c6918) — 문서만

| 지적 | 판정 | 조치 |
| --- | --- | --- |
| `BACKUP_DB` 등 CLI 옵션으로 가는 값이 검사되지 않아, 붙여 넣은 URL·연결 문자열을 `pg_dump -d`/`psql -d` 가 다른 대상·`sslmode=disable` 로 재해석할 수 있다 | **맞다** | 원격 호출 전에 전부 검사: 호스트 = 점이 있는 DNS 이름(끝 점·`/`·`:` 거부), 포트 = 1~65535, 사용자·DB = `[A-Za-z_][A-Za-z0-9_]{0,62}`, 날짜 = `YYYY-MM-DD`. `=`·URL·공백·따옴표·제어 문자·`-` 시작 값은 전부 여기서 걸린다. 모든 호출에 `-p` 를 명시했다 |
| 백업과 복원이 같은 서버일 수 있다 | **맞다** | 호스트(소문자)+포트가 같으면 거부. 별칭(CNAME·IP·다른 이름)은 문자열로 증명할 수 없다고 명시하고, 복원 서버가 CJ 승인 독립 스크래치 서버라는 운영자 확인(`approved`)을 필수로 받는다. 같은 호스트·다른 포트는 "호스트+포트 동일" 규칙에 걸리지 않으므로 그 확인에 맡긴다 |
| TLS 없는 로컬 스크래치 예외 | **없앴다** | 이 런북은 인증서 검증 가능한 원격 서버 두 대만 다룬다 |
| 성공 문구가 전체 동등성처럼 읽힌다 | **맞다** | `OK:` 는 "복원 완료 + `schema_migrations`·`db_meta` 값 일치 (그 밖의 표·데이터는 비교하지 않았다)" 만 말한다. §5.3 에도 같은 한계를 적었다 |

유지한 것: 모든 원격 호출 `verify-full` + 명시 CA, 비밀번호는 명령별 `PGPASSWORD=` 앞붙임만(argv 0건), `set -euo pipefail` 중단. 대소문자 변환은 bash 3.2(macOS 기본)에도 있는 `tr` 로 했다. **라이브 DB 검증과 복원 리허설은 여전히 보류다** — 스크래치 서버·`CREATEDB` 권한이 없다(§5.3 선행 조건).

## 15. Saturn REVISE 5차 반영 (2026-09-25, ctx_50835affc3aa) — 문서만

| 지적 | 판정 | 조치 |
| --- | --- | --- |
| "FQDN 만" 이라면서 `0177.1`·`1.2.3` 같은 숫자형 호스트가 통과한다 | **맞다** | 마지막 라벨이 영문자로 시작해야 한다. 정규 IPv4 `1.2.3.4` 도 거부 — 이 런북은 IP 리터럴을 받지 않는다(`verify-full` 은 호스트 이름 검증이 기본이다) |
| 물려받은 `PGSERVICE` 의 서비스 파일이 `PGSSLMODE` 를 덮을 수 있다 | **맞다 — 문서 근거 확인** | PostgreSQL 공식 문서의 우선순위는 연결 문자열 > 서비스 파일 > 환경변수 > 기본값이다. 원격 호출 전에 `PG*` 환경변수를 **전부** unset(`PGSERVICE`·`PGSERVICEFILE`·`PGSYSCONFDIR` 포함)한 뒤 우리 값만 export 한다 |
| `PGHOSTADDR` 가 `-h` 대신 접속 주소가 된다 | **맞다** | 위 전부-unset 으로 제거. 문서: 둘 다 있으면 `hostaddr` 가 네트워크 주소다 |
| GSSAPI 암호화가 SSL 보다 먼저 쓰여 `verify-full` 이 적용되지 않을 수 있다 | **맞다 — 문서 근거 확인** | 문서: "GSSAPI 암호화가 가능하면 `sslmode` 값과 무관하게 SSL 보다 우선한다. SSL 을 강제하려면 `gssencmode=disable`". `PGGSSENCMODE=disable` 을 export 한다 |

한계(정직하게): 우선순위·GSSAPI 동작은 **공식 문서에 근거한 것이며 실 libpq 로 확인하지 않았다.** 이 스크립트는 `~/.pgpass`(`PGPASSFILE` 를 지워도 기본 경로)는 막지 않는다 — 비밀번호만 공급하며 `PGPASSWORD` 가 있으면 쓰이지 않는다(문서상). 가짜 클라이언트 검사 결과는 §4 에 있다. 라이브 DB 검증과 복원 리허설은 여전히 보류다.
