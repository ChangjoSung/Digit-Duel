# #232 통합·Render 구조 점검 — 2026-09-28

## 현재 — CJ 통합 승인 후 진행

- CJ가 stage·commit·push·PR·milestone 병합과 검증 후 불필요한 트리/브랜치 정리를 승인했다. main Release·Render 배포·자원 생성·결제/요금 변경은 아직 승인하지 않았다.
- #259 PR269 → #260 PR270 → #261 PR271 → #262 PR272를 각 현재 PR 필수 CI 6/6 확인 뒤 milestone/v0.4.11에 병합했다. #238은 새 통합 트리에 변경/추가245경로를 바이트 동일 복사했고 #262 기획·부서 보고서·QA17경로와 승인177아트를 보존했다. #238 PR과 최종 통합 QA는 진행 중이다.
- #264 기존 DB 기반은 #259 병합 코드에 이미 포함돼 오래된 서버를 덮어쓰지 않는다. Jupiter의 LF/CRLF 마이그레이션 체크섬 호환과 기존 DB 원장 보존 수정·Node24.21.0 고정은 43/0 납품 뒤 독립 QA/분리 PR을 준비한다.
- 직접 확인한 Render는 Free Web 1개, Singapore, main/d0bc196, 저장소 루트·build `npm ci --prefix server`·start `npm start --prefix server`·health `/healthz`, 자동 배포 CI후·PR preview Off다. 설정 키는 public deploy/host 2개뿐이며 프로젝트 Postgres·DATABASE_URL·SMTP·NODE_VERSION은 없다. 비밀값은 조회하지 않았다.
- 현 Render 설정 그대로는 계정 DB와 비밀번호 재설정 메일을 사용할 수 없다. Free Web SMTP25/465/587 차단이 공식 문서에서 확인됐다. 최종 코드 QA와 별개인 실제 운영 준비 조건으로 보고하며 아직 배포하지 않는다.
- 원본 dirty/untracked와 기존 DB/계정/SMTP는 보존한다. 삭제 전 ZIP 원문 SHA·전체 Git bundle 검증을 하고, QA 완료 후 사용하지 않는 게임 서버만 종료한다. GitHub는 기존 완료 조건 하나만 갱신하고 댓글·Issue close는 하지 않는다.

## 착수 전 검토 기록 — 아래 PR 상태·승인 대기는 과거

다음 Work는 새 기능을 추가하는 일이 아니라, 이미 CJ가 확인한 계정·로비·멀티 방·경기 화면을 `milestone/v0.4.11`에 순서대로 통합하고 함께 확인하는 일이다. 부모 #232에 별도 제품 PR을 만들지 않는다.

#238의 마지막 기록 높이 수정은 Mars 완료·UI 검사147/0·Saturn 독립 QA PASS다. 320/432에서 기록·이벤트 아이콘 높이 차이0, 실제터치·최근20팝업·초점 복귀를 확인했다. 최신 CJ 지시에 따라 추가 CJ 플레이 QA 없이 CJ PASS로 정리했다.

## 직접 확인한 PR과 검사

| 범위 | 현재 PR 기준 | 현재 근거 | 통합 전 남은 일 |
|---|---|---|---|
| #259 계정 | [PR #269](https://github.com/ChangjoSung/Digit-Duel/pull/269) → milestone/v0.4.11 | OPEN, MERGEABLE, CLEAN. 현재 PR의 필수 검사 6/6 성공 | 승인 후 먼저 병합 |
| #260 로비 | [PR #270](https://github.com/ChangjoSung/Digit-Duel/pull/270) → #259 브랜치 | OPEN, MERGEABLE, CLEAN. HEAD a444d57의 브랜치 검사 6/6 성공. PR 직접 검사 목록은 비어 있음 | 앞 PR 통합 뒤 milestone 기준 정리와 해당 PR 필수 검사 |
| #261 멀티 방 | [PR #271](https://github.com/ChangjoSung/Digit-Duel/pull/271) → #260 브랜치 | OPEN, MERGEABLE, CLEAN. HEAD e1bfdc2의 브랜치 검사 6/6 성공. PR 직접 검사 목록은 비어 있음 | 앞 PR 통합 뒤 milestone 기준 정리와 해당 PR 필수 검사 |
| #262 이모티콘·HP 공개 규칙 | issue-262-multiplayer-emotes의 미커밋 변경 | Saturn·CJ PASS 기록 보존. 21 tracked + 19 untracked 상태 항목 | 승인된 납품 파일만 커밋·push하고 #261 기준 분리 PR, 필수 CI |
| #238 경기 화면 | issue-238-game-ui의 미커밋 변경 | 기존 기능·시각 QA와 이번 높이 수정 근거 보존 | #262와 겹치는 변경을 분리하고 #262 기준 PR, 필수 CI |
| #264 운영 DB | issue-264-render-db-current | 로컬 연결·마이그레이션·복원 준비 근거. 실제 Render/DB 미확인 | 최신 계정 서버와 충돌 분석 및 실제 운영 설정 확인. 자원 생성·결제·배포는 미승인 |

원격 milestone의 현재 HEAD는 `bd4c90c387e6d2f55bdd560de468e6ea14c8f571`이다. 로컬 원본 checkout의 오래된 HEAD나 과거 기록의 짧은 SHA를 현재 원격 기준으로 취급하지 않는다. 보호 브랜치의 필수 검사는 A·B·B2·C·D·E 6개다.

검사 원문: [#259 현재 PR CI](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36306785458), [#260 현재 HEAD 브랜치 CI](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36311355490), [#261 현재 HEAD 브랜치 CI](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36321541379). 브랜치 검사 성공을 향후 milestone 통합 PR 검사 성공으로 대신 기록하지 않는다.

## 변경과 이력 보존

#259·#260 트리는 깨끗하다. #261에는 #262의 미추적 보고서 2개가 있어 보존한다. #262·#238·#264는 중요한 미커밋 변경이 남아 있으므로 삭제 대상이 아니다.

현재 #238 작업 파일과 #262 작업 파일을 SHA-256으로 직접 비교하면 261개 경로가 다르다: 변경 46개·추가 198개·#238에 없는 부모 경로 17개다. 이 숫자는 커밋 허용 목록이 아니다. 특히 17개는 부모의 #262 기획·부서 보고서·QA 그림으로, 자식 트리에서 누락됐다고 PR의 삭제 변경으로 만들면 안 된다. 통합 기준을 갱신할 때 부모 기록을 그대로 이어받고, 승인된 #238 납품 변경만 적용한다. 제품 파일과 승인된 아트는 각 원장과 해시 목록으로 확인한다.

#264는 오래된 `fafc619` 기반이므로 서버 파일을 전체 덮어쓰지 않는다. 최신 계정·멀티 기능과 비교한 뒤 필요한 DB 변경만 Jupiter에게 맡긴다. 사용자 계정·SMTP·PG·원본 dirty/untracked는 보존한다.

조사 근거는 외부 QA의 `issue232-integration-source-before.json`과 `issue232-integration-child238-delta.json`에 보관했다. GitHub에는 각 이슈의 기존 완료 조건만 갱신하며 댓글·두 번째 TODO 목록을 만들지 않는다.

## 권장 실행 순서와 승인 범위

1. #238 마지막 높이 수정의 Saturn 검증과 CJ 자동 PASS 정리를 마친다.
2. #262·#238의 납품 파일을 분리해 커밋·push·분리 PR로 준비한다.
3. #269부터 #270 → #271 → #262 → #238 순서로 milestone 기준을 갱신하고, 매 PR의 필수 검사와 승인 범위를 확인해 통합한다. 충돌 수정은 해당 코드 소관 부서가 하고 Saturn이 필요한 범위만 재검증한다.
4. #264의 실제 운영 DB 확인을 별도 게이트로 유지한다. 실제 운영 증거가 없으면 부모의 DB 조건을 체크하지 않는다.
5. 최종 통합 코드에서 계정·2클라이언트·상점·재접속·타이머·비공개 상태·터치/키보드/동작 축소를 필요한 범위로 함께 확인한다. 서로 다른 코드 기준의 과거 PASS를 합쳐 통합 PASS로 만들지 않는다.

현재 `CLAUDE.md`의 Issue 종결 규칙에 따라 #259/#260/#261의 커밋·PR 승인은 유효하지만 milestone 병합은 별도 승인 전이다. #262/#238의 stage·commit·push·PR도 별도 승인 전이다. 이번 지시의 위치 보정·자동 PASS와 통합 준비는 진행하며, 구체적인 Git 실행안을 준비한 뒤 해당 범위만 CJ에게 확인한다. Issue 종결·배포·Render 생성·결제는 이 실행안에 포함하지 않는다.

