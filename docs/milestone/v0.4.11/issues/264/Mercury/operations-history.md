# #264 Render DB 운영 확인 — Mercury (2026-09-25)

## 현재 범위

- CJ가 #264 구현을 지시했다. 전용 작업 트리는 `ChangjoSung/issue-264-render-db` (`33490f9` 기준)다. 이 문서는 운영 상태와 승인 경계를 기록하며 제품 코드는 Jupiter가 담당한다.
- 이번 작업의 모든 Worker는 full access·무확인 실행으로 기동한다. 역할별 수정 범위, Saturn의 파일 무수정 QA, Worker Git 쓰기 금지는 유지한다.
- GDD-23 §2.4와 [Issue #264](https://github.com/ChangjoSung/Digit-Duel/issues/264)는 Render 서비스·DB 생성, 결제, 요금제 변경에 **별도 CJ 승인**을 요구한다. 이번 코드 구현 착수는 이 외부 변경을 승인한 것으로 기록하지 않는다.

## 실환경 관찰

| 확인 대상 | 2026-09-25 관찰 |
|---|---|
| Render Dashboard | Orca 기본 브라우저 프로필에서 `dashboard.render.com/login`으로 이동. 계정 내부의 서비스·DB 목록은 조회 불가 |
| 실제 Web 요금제·리전·배포 브랜치·auto-deploy | 미확인. `render.yaml`은 참고 Blueprint이며 실배포 증거가 아님 |
| 실제 Postgres 존재·요금제·생성일·만료일·연결 | 미확인. 중복 생성을 피하려면 Dashboard 조회가 먼저 필요 |
| 로컬 PostgreSQL 도구 | 현재 PATH에서 `psql`·`pg_dump`·`pg_restore`·Docker 미발견 |

## Free QA 경계

[Render Free 공식 문서](https://render.com/docs/free)에 따르면 한 workspace의 Free Postgres는 동시에 하나만 활성화할 수 있고 저장 공간은 1GB다. 생성 30일 뒤 접근이 막히며 14일의 유료 전환 유예 뒤 삭제된다. Render 관리형 백업이 없으므로 보존할 테스트 데이터는 만료 전에 논리 백업과 복원 확인이 필요하다. Free Web은 15분 무수신 후 휴면하며 다시 켜지는 데 약 1분이 걸릴 수 있고, 로컬 파일은 재시작·재배포·휴면 시 사라진다. 사용량 한도와 결제 수단에 따른 과금/중단 조건도 실제 workspace에서 확인해야 한다.

DB는 기존 Web과 같은 리전에 두고 내부 연결 URL을 환경변수로 전달하는 것이 [Render 연결 안내](https://render.com/docs/postgresql-creating-connecting)의 권장 경로다. 연결 URL, 비밀번호, 세션 키는 이 문서·Git·Issue·로그에 적지 않는다. 계정·전적 영속화와 인메모리 경기 복원은 별개이며 후자는 #264 범위가 아니다.

[Render 백업/복원 안내](https://render.com/docs/postgresql-backups)는 Free DB에 자동 논리 백업이 없다고 명시한다. 로컬 `pg_dump`로 만든 파일의 복원은 **빈 별도 DB**에서 먼저 확인해야 한다. 기존 데이터가 든 DB에 곧바로 복원하면 중복·충돌이 날 수 있다.

## 실환경 적용 전 확인할 값

1. Dashboard 로그인 후 기존 Web 서비스와 Postgres의 실제 존재·plan·region·배포 브랜치·auto-deploy 원본을 읽기 전용으로 확인한다.
2. 기존 DB가 없고 별도 CJ 생성 승인이 있을 때에만 Free Postgres 신규 생성과 내부 URL 주입을 검토한다. 유료 선택·결제는 또 다른 명시 결정으로 분리한다.
3. 코드·마이그레이션·백업/복원 절차가 검증된 뒤 CJ 플레이 QA와 PR 필수 CI를 거쳐 배포 판단을 기록한다. 현재 이 단계는 수행 전이다.
