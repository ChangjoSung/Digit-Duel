# #232 통합·Render 배포 준비 점검 — 2026-09-28

## 결정

CJ가 승인한 제품 변경과 DB 구조 수정을 `milestone/v0.4.11`에 통합했다. 제품 통합 커밋은 `87944d548c7e66194961e90bda41e04e0c5b83c9`이며, 이후 운영 문서만 정리한다.

**로컬 코드 검증 PASS, 현재 Render 설정은 배포 NO-GO다.** 실제 운영 DB와 메일 발송 설정이 필요하다. main Release·Render 배포·자원 생성·결제·요금제 변경은 CJ의 별도 지시를 기다린다. #232·#264와 #259의 실제 배포 조건을 완료로 표시하지 않는다.

## 마일스톤 통합 근거

각 PR의 현재 HEAD에서 필수 검사 A·B·B2·C·D·E 6개를 확인하고 일반 merge로 병합했다. 브랜치 보호와 strict 검사는 유지했다.

| 범위 | 병합 PR | 해당 PR의 성공 CI |
|---|---|---|
| #259 계정 | [269](https://github.com/ChangjoSung/Digit-Duel/pull/269) | [6/6](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36306785458) |
| #260 로비·전적 | [270](https://github.com/ChangjoSung/Digit-Duel/pull/270) | [6/6](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36380449752) |
| #261 멀티 방 | [271](https://github.com/ChangjoSung/Digit-Duel/pull/271) | [6/6](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36380802949) |
| #262 이모티콘·HP 공개 | [272](https://github.com/ChangjoSung/Digit-Duel/pull/272) | [6/6](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36381573167) |
| #238 UI System | [273](https://github.com/ChangjoSung/Digit-Duel/pull/273) | [6/6](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36384279601) |
| #264 DB 호환·준비상태 | [274](https://github.com/ChangjoSung/Digit-Duel/pull/274) | [6/6](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36386540838) |

#263은 앞서 PR268로 병합됐고 CLOSED다. 다른 열린 이슈는 이번 작업에서 닫지 않았다. #262 부모 기록 17경로와 승인 아트 177개를 보존했고, 오래된 #264 서버로 최신 계정·경기 코드를 덮어쓰지 않았다.

## 독립 QA와 발견한 문제

첫 Saturn은 공개 배포 모드·PostgreSQL·HTTPS 프록시·인증·2클라이언트 WebSocket의 20항목과 필요한 회귀를 검증했다. 실제 테이블이 없어도 준비 완료로 응답하는 결함을 발견해 **첫 QA를 REVISE/failed로 보존**했다.

Jupiter가 필수 테이블 4개·열 33개의 존재 검사를 추가했다. 새 Saturn은 실제 독립 PostgreSQL에서 다음을 확인했다.

- 온전한 DB의 5개 마이그레이션, 가입·Secure 쿠키·세션 재시작 유지, 기존 CRLF 체크섬 원장 보존.
- 경기 결과 테이블 또는 대표 하수인 열 누락 시 두 시작 방식 모두 listen 전 실패. 원장·DDL 자동 복구 없음.
- 실행 중 테이블 누락/DB 장애는 readiness 503, health 200. 테이블 복구 후 readiness 200.
- QA 전후 tracked·untracked 비무시 파일 1,687개 SHA·HEAD·status 불변. 자기 임시 서비스 종료.

[수정 전 근거](../Saturn/render-structure-before-fix.md)와 [최종 Saturn 보고](../Saturn/report.md)를 보존했다. QA는 로컬 프록시 모의 환경이며 실제 Render HTTPS/WSS·메일 수신 검증은 남았다. 로컬 Node는 24.16.0, 배포 핀은 24.21.0이다. 스키마 검사는 테이블·열 존재를 확인하며 타입·제약·인덱스 검사까지 포함하지 않는다.

## Worker 결과와 실행 계약

Run `run_07d21c16afa3`. 각 현재 dispatch에서 native 실행, 실제 JSONL 모델/effort, 화면, 새 turn_started·preamble·capability를 GO/완료 시 대조했다. 채택 실행의 requested/effective null은 그대로 기록했고 Codex raw tier ABSENT와 native `default`를 구분했다. capability는 문서에 저장하지 않았다.

| 작업 | 결과 | 근거 |
|---|---|---|
| Jupiter 배포 구조 감사 · task_f501d9f6cd1b | succeeded | 필요한 호환 수정·실제 운영 조건 식별 |
| Jupiter 체크섬 호환 · task_d2d4f787a6bf | succeeded | DB 43/0, SQL 보존 |
| Jupiter DB 충돌·정적 로드 예산 · task_acb0059ec684 | succeeded | 기존 005 검사 보존, 82자산·2클라이언트·429 경계 |
| Mars CI 이식성 · task_bb0e3ae57ddb | succeeded | 튜토리얼 139/0, 아트 도구 대조군 |
| Mars 뒤로가기 검사 · task_a79152a38dc2 | succeeded | 122/0, 외부 음성 대조 4개 |
| Saturn 첫 통합 QA · task_25ccd25481c9 | failed | 온전한 원장/누락 테이블의 false-ready 발견 |
| Jupiter 물리 스키마 차단 · task_93536b7e4868 | succeeded | DB 45/0, 실제 PG 시작·런타임 경계 |
| Saturn 물리 스키마 재검증 · task_acc6c1d0f5d9 | succeeded | 위 독립 검증 PASS, 원본 무수정 |

Claude 작업은 Opus 5.5/high/bypass, Saturn·Mercury는 Sol/xhigh/default/full/never다. 모든 정산을 수락한 뒤 release의 외부 TUI retained 응답을 확인하고 정확한 terminal을 닫았다(ptyKilled=true). 실행 Worker와 회수 대기 Worker는 없다. 사용량은 외부 QA에 provider 원문 기준으로 PD와 Worker를 구분해 기록했다. PD는 현재 Run 최초 관측~측정 시각의 차이이며 이전 준비·이후 동작은 제외한다. 절감률을 추정하지 않는다. 초기 Mars 검사 중 출력 필터 때문에 일부 2회 실행된 예외와 첫 Saturn 하네스 수정 이력은 해당 보고에 그대로 남겼다.

## 실제 Render 확인

| 항목 | 관측 |
|---|---|
| Web | digit-duel · Free · Node · Singapore |
| 배포 | main / d0bc196 · 자동 배포는 CI 성공 후 · PR preview Off |
| 실행 | 저장소 루트, build `npm ci --prefix server`, start `npm start --prefix server`, health `/healthz` |
| 환경 변수 | public deploy/host 키 2개만 존재. 비밀값 조회 없음 |
| DB·메일 | 해당 프로젝트 PostgreSQL 없음, DATABASE_URL·SMTP·NODE_VERSION 환경 키 없음, 연결된 Environment Group 없음 |
| 실제 HTTP | 기존 main의 HTTPS health/root 200. 새 통합 코드의 실제 배포 QA는 아님 |

프로젝트 `prj-daj498jm8hqs73esrtu0`, Web `srv-daj498mq1p3s73a31s3g`, 공개 주소 `https://digit-duel-mipa.onrender.com`. 서버의 PORT·단일 HTTP/WS 포트·프록시/호스트 검증과 선택적 DB 기동 경로는 로컬·CI에서 확인했다. main과 현재 Render 배포를 변경하지 않았다.

Render 공식 [Free 제한](https://render.com/docs/free)은 SMTP 25/465/587 차단, 유휴 중단, 임시 파일 저장소와 무료 DB 만료·관리형 백업 부재를 명시한다. 현재 Gmail SMTP 방식의 실제 발송에는 SMTP 허용 Web 요금제가 필요하다. [Node 버전 설정](https://render.com/docs/node-version)에 따라 새 소스는 .node-version 24.21.0을 사용할 수 있지만 실제 배포 버전은 아직 미검증이다.

권장 후속은 CJ가 SMTP 허용 Web과 지속 보존할 PostgreSQL·백업 수준을 결정하고, 비밀 설정·마이그레이션·실제 배포 QA를 준비하는 것이다. 진행 경기는 메모리이므로 서버 재시작 시 복원되지 않는다. DB 장애 때의 결과 outbox도 임시 디스크에서는 재배포를 견디는 보존을 보장하지 않으므로 필요 보존 수준을 운영 설정에서 정한다.

## 작업 공간·서버 정리

- 원본 파일과 미커밋·미추적 변경은 `C:/Users/pc_77/orca/archives/Digit-Duel/issue232-integration-2026-09-28`에 경로·크기·SHA manifest와 ZIP으로 보존했다. ZIP 전건과 Git bundle을 검증했다. 승인 납품은 먼저 통합했다.
- 불필요한 작업 트리 8개와 로컬 브랜치 8개, 원격 브랜치 6개를 제거했다. #263 원격 브랜치는 실제 조회에서 이미 없었다.
- 남은 것은 사용자 dirty 원본 `C:/Users/pc_77/orca/Digit-Duel`과 깨끗한 `release-review-v0.4.11`이다. 원본 로컬 milestone HEAD33490f9를 stage/reset/pull하지 않았다. 후속 Release 검토는 보존된 원본을 보호하면서 최신 원격 milestone을 검토할 별도 트리에서 진행한다.
- 게임 QA 8085와 전용 PG55462를 정확한 PID/데이터 경로 확인 후 종료했다. 다른 게임 QA·임시 검증 포트에도 listener가 없다. 게임 외 서비스8084는 유지했다.
- 기존 DB·계정·SMTP는 보존했다. 정지 후 PG18 cold backup은 `issue-262-local/backups/integration-2026-09-28-cold`, 1,006파일·42,412,305바이트를 SHA 대조했다. 복원 실행까지 검증했다는 주장은 하지 않는다.
- GitHub는 기존 완료 조건만 수정했다. 신규 댓글·중복 TODO·Issue close·main Release·Render 배포·자원 생성·결제는 실행하지 않았다.

## 다음 Work

CJ의 별도 지시 후 운영 DB·메일 발송 환경 준비와 main Release/Render 배포를 진행한다. 현 설정 그대로 공개 계정 서비스를 배포할 수 있다고 보고하지 않는다. 현재 기획·GitHub의 미완료 운영 조건을 유지한다.
