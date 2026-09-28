# #264 Render 호환 수정 — Jupiter 보고 (2026-09-28)

- 역할: Jupiter / IMPLEMENT / SERVER · task_d2d4f787a6bf · ctx_c3dd4ef2ac2d · claude-opus-5-5 high (PD 확인: PID 43604, JSONL aa509d5b…)
- 트리: `issue-264-render-compat` HEAD `5ffd769` (#250·PR269 포함). Git·GitHub·Notion·배포·Render 설정 쓰기 없음.
- 입력 감사: `issue-238-game-ui/docs/milestone/v0.4.11/issues/232/Jupiter/render-readiness.md` §3 F1·F2.

## 1. 변경 파일

| 파일 | 변경 |
|---|---|
| `server/db-migrate.js` | `loadMigrations` 체크섬 = LF 정규화 내용의 sha256. `legacyChecksum`(같은 내용의 CRLF 바이트 sha256) 추가. `status` 는 원장 값이 둘 중 하나와 같으면 적용됨으로 본다 |
| `server/test-db.js` | 저장소 파일 체크섬 단언을 새 규칙으로 갱신 + 줄바꿈 검사 1건 추가(아래 §2) |
| `.node-version` | 신규, `24.21.0` |
| `render.yaml` | 11~12·15행 주석만: 엔진이 `demo/test/shared/harness.js` 를 require → 실제는 `runtime.js` 가 `demo/index.html`·`demo/js/*.js` 를 읽음(#245). 서비스 정의·plan·env 무변경 |
| 이 보고서 | 신규 |

`server/db/migrations/*.sql` 바이트 무수정. 새 마이그레이션·스키마 없음.

## 2. F1 — 마이그레이션 체크섬 줄바꿈 민감도

- 원인 [확정]: 원문 바이트 sha256 → autocrlf Windows 체크아웃(CRLF)과 Render(Linux, LF) 해시가 달라 `verify` 가 drift 로 기동 중단.
- 수정 [확정]: 해시는 `\r\n`→`\n` 정규화 후 계산(모든 호출자 `up`·`verify`·`status`·CLI·accounts 테스트가 `loadMigrations` 한 곳을 거친다). 새로 기록되는 원장 행은 정규화 해시다.
- 기존 DB 보존 [확정]:
  - 예전 LF 체크아웃이 기록한 행 = 새 체크섬과 동일.
  - 예전 CRLF 체크아웃이 기록한 행 = `legacyChecksum` 과 동일 → 인정. 원장 행을 UPDATE 하지 않는다(러너에 UPDATE 경로 없음).
  - 현재 트리 실측: 001~004 `legacyChecksum` 앞 12자리 `e15b554c91cc`·`f4c248becac3`·`7bfb08691e85`·`812b20e24637` = 현재 CRLF 파일 원문 sha256 과 일치. 새 체크섬 `f358d96b8d61`·`ad4669975824`·`9f0479989951`·`7c1f38e0faae`.
- fail-closed 유지 [확정]: 줄바꿈 외 내용이 바뀌면 두 해시 모두 불일치 → `verify`·`up` 모두 거부.
- 한계 [추론]: 한 파일 안에 LF·CRLF 가 섞인 상태로 예전에 적용된 행은 인정되지 않는다(drift 로 멈춤). 현재 파일은 전부 균일 CRLF 라 해당 없음. 로컬 DB 재생성에 의존하지 않는다.

### 검증 — `node test-db.js` 1회, exit 0, ok 43 / FAIL 0

추가 검사(scratch 임시 폴더 fixture, 종료 시 삭제):
1. 같은 SQL 의 LF·CRLF 파일 → 새 체크섬 동일.
2. 예전 CRLF 원문 해시로 기록된 원장 행 + LF 체크아웃 → `verify` 통과, `up` 적용 0건, 원장 행 그대로.
3. 실제 SQL 변경(주석 1줄 추가) → CRLF 원장 행에 대해 `verify` 거부, 새 해시 원장 행에 대해 `up` 거부.

부속 게이트(accounts 등)는 돌리지 않았다: 변경은 체크섬 비교뿐이고 `up` 적용 경로·SQL 은 그대로라 test-db 로 충분하다고 판단 [추론]. 실 Postgres 왕복은 이번 범위 밖.

## 3. Node 런타임 고정

- 현재 서비스는 버전 고정이 없어 Render 기본값(더 낡은 버전)을 쓴다 [PD 대시보드 보고].
- Render 공식 문서(https://render.com/docs/node-version): 저장소 루트 `.node-version` 을 읽는다. 현재 문서의 24 계열 = `24.21.0` [PD 제공 근거]. CI 는 `NODE_VERSION: '24'`(`.github/workflows/ci.yml:35`), 이 PC 는 v24.16.0 — 같은 메이저.
- Root Directory 가 비어 있음(=저장소 루트)이라 루트 `.node-version` 이 적용된다 [추론, 문서 기준].
- 주의: Render 서비스 환경변수 `NODE_VERSION` 이 설정되면 `.node-version` 보다 우선한다. 현재 설정 여부는 확인하지 않았고 이 작업은 env 를 바꾸지 않았다.

## 4. 대시보드 호환 대조 (PD 제공 실측 · Jupiter 는 Render 에 접근하지 않음)

| 항목 | 대시보드 | 저장소 | 판정 |
|---|---|---|---|
| 서비스 | Web `digit-duel`, Free, `main` `d0bc196` | `render.yaml` 동일 이름·free | 일치 |
| Root Directory | 비어 있음(저장소 루트) | 루트 필수(`runtime.js` 가 `../../demo` 읽음) | 일치 |
| build / start | `npm ci --prefix server` / `npm start --prefix server` | `render.yaml:57-58`, `server/package.json` start | 일치 |
| pre-deploy | 비어 있음 | 마이그레이션은 기동 게이트(`DD_DB_MIGRATE_ON_START`)로 처리 | 호환 |
| health | `/healthz` | `render.yaml` 동일 | 일치 |
| auto-deploy | checksPass | 동일 | 일치 |
| PR previews | Off | 미정의 | 호환 |
| Postgres | 프로젝트 DB 없음 | DATABASE_URL 없으면 DB 없이 기동(`/readyz` "ok (no db)", test-db 검사) | 호환 |

## 5. 남은 설정 차단 (변경하지 않음)

- **Free 인스턴스 SMTP 차단** [확정, 공식 문서 기준 PD 확인]: 포트 25·465·587 아웃바운드 차단 → 이메일 인증·비밀번호 재설정 발송 불가. SMTP 제공자·plan 변경은 CJ 결정 사항이라 손대지 않았다.
- DB 연결·유료 자원·env·Blueprint 적용은 별도 승인 대상(#264 자원 생성·결제 금지).
