# v0.4.11 사전 기획

**Notion이 기획 원본**이며, 이 폴더는 분석·검토·결정 요약과 관련 자료를 보관한다. [Milestone·Issue 등록](../README.md)은 완료됐고 현재 14개 공식 하위 이슈 중 7개가 완료됐다. 나머지 구현·QA는 이슈별 CJ 착수 지시를 따른다.

2026-09-27 확인: #263 후속 30초/60초 규칙은 CJ 플레이 QA PASS·필수 CI 통과 후 PR #268로 `milestone/v0.4.11`에 병합됐다(`83434f0`). [PD 검증 원장](../issues/263/Mercury/report.md)에 첫 REVISE부터 병합까지의 이력을 보존했다. #264 실제 Render/DB 검증은 대기다.

## 현재 기준

- 2026-09-28 #261 PR271 현재HEAD 브랜치CI6/6 성공, #262 Saturn·CJ QA PASS(미커밋 보존). #238 기록 아이콘을 이벤트와 같은 높이에 맞추고320/432 실측·터치/팝업/초점·좌표 검증 후 Saturn·CJ PASS 처리했다. 추가 CJ 플레이QA 면제, 이번 UI147/0·이전351/0 근거는 구별해 보존한다. 현행 Notion GDD13/23/24와 활성 [#238 기획 행렬](C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-238-game-ui/docs/milestone/v0.4.11/planning/2026-09-28-issue-238-ui-system.md)이 규칙 기준이며 활성 Mercury/report.md가 조정 단일원장이다. 다음 [#232 통합 준비 검토](../issues/232/Mercury/integration-review.md)를 착수했다. QA8085·PG55462/계정/DB/SMTP 보존, 기존GitHub4조건 중3체크·댓글0, CI/PR/통합 및 #262/#238 Git 승인 별도.

- 2026-09-27 #259 최신 CJ 결정: 가입 이메일 필수·중복 허용, 고유 로그인 ID와 닉네임 유지, 최신 로그인 하나만 유효. 비밀번호 찾기는 아이디만 입력하며 없는 아이디는 알림 뒤 첫 화면에 머문다. 등록 이메일의6자리 코드 확인 뒤 재설정하며 직전 비밀번호를 거부한다. 이전 ID+이메일 입력·가입 복구 코드·365일 만료·기기별 독립 세션 정책은 철회됐다. GDD13/23/24 동기화·Mercury 원문 검증, CJ 최종 로컬 QA·Saturn 타이머 통합 QA·PR #269 CI6/6 PASS. 병합·HTTPS/Render 배포 검증은 남아 있다. 실제 수신 시각·코드 값은 추정하지 않는다.
- 2026-09-27 #260 CJ 확정: 공식 멀티 승·패(기권/몰수 포함), 무효는 기록만·시작 전 취소/PVE 미기록. 전체 기록 보존·최근20 표시, 당시 상대 닉네임/종료 사유/턴 수·보드 시작부터 확정까지 경과 시간(상점/재접속 대기 포함). 일반30종 대표 하수인·기본 새끼 화룡·로비 변경 무제한·현재 방 입장 선택 고정·그림 없는 종류 이모지. 유지 로그인도 타이틀→시작→실제 로딩→로비, 진행 경기 새로고침은 복귀. Venus가 GDD13/23/24 흐름·표·본문·결정 이력을 동기화했고 Mercury가 원문과Project/사람Editor/실제EditDate를 확인했다. 별도 트리에서 구현·전적 보존/권한·화면 수리 뒤 Saturn 로컬·CJ 최종 QA PASS. PR270의 HEAD a444d57 브랜치 CI6/6 PASS, #259 브랜치 기준 분리 PR·milestone 통합 CI 별도다. 진행은 GitHub 기존 완료 조건 한 목록에서 관리한다.
- [GDD-23 기획서](https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b): 현재 v0.4.11 계약. S01 시간 초과 자동 배치 갈래에는 배치 90초를 다시 걸지 않는다. Q1·Q2는 A로 확정했다. 2026-09-25 후속 CJ 결정으로 보드 무행동 30초 만료는 턴 종료, 이동 뒤 강제 전투 대상 1개는 즉시 전투·2개 이상은 새 30초와 서버 자동 선택, 전투 명령은 60초 만료 시 현재 전투원 행동만 생략한다. Q5도 확정: B02는 단일 강제 대상이면 보드 시계 잔여, 복수 대상이면 대상 선택 시계 잔여를 쓰며, 회복·선택 전투 선택도 보드 30초에 포함한다. Q3는 #263 비차단 미결이고, Q4 시작 상점 자발적 나가기는2026-09-28 즉시 취소·미기록으로 확정됐다. Render 무료 QA 후속 결정도 본문과 9장에 기록했다.
- [GDD-24 UI/UX System Flow](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8): 화면 ID 범례와 경기 밖/안 흐름을 나눠 읽도록 정리했다. 00.2·00.4·01절 S02 모두 S01 자동 배치 갈래에는 배치 90초를 걸지 않고 자동 배치도 다시 돌리지 않는다고 명시한다. 00.4·03절에는 강제 대상 선택 30초, B02의 활성 30초, 전투 행동 60초, B08 20초를 구분했다. 기존 PNG·SVG의 미반영 항목은 상단 안내 참조.
- [GDD-13 현재 게임 규칙](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38): 1~6장은 v0.4.10 출시 규칙이고 7장 v0.4.11 예고와 9장 Decision Log에 후속 30초/60초 결정 및 Render 무료 QA 결정을 기록했다. 과거 결정 이력은 [보관 기록](../../../creat2ve/notion-archive/2026-09-16/README.md)에서 확인한다.

## 로컬 기록

| 문서·자료 | 용도 |
|---|---|
| [등록 기준 스냅샷](notion-registration-source.md) | GDD-23 등록 시점 원문. 현재 원본은 Notion |
| [Venus Issue 분해 검토](issue-registration-review.md) | 6개 납품 목표 제안. 최신 대조 정정은 [Mercury 등록 보고](../reports/Mercury/registration.md) 우선 |
| [CJ Comment 최종 정리](cj-final-comments-review.md) | 최신 반영 내용·보존 검증·PD 마무리 기록 |
| [초기 기획 검토](venus-review.md) | 당시 분석·제안 |
| [문서 재구성 검토](final-reorg-review.md) | 이전 9장 구성 시점의 기록. 이후 9장 삭제는 최종 정리 참조 |
| [UI/UX 게시 검토](flow-publish-review.md) | Notion 게시·시각 검토 기록 |
| [UI/UX 원본 인계](uiux-flow/handoff.md) | 흐름도 3장의 PNG·SVG 원본 링크 |
| [Venus 가독성·Render 동기화 보고](Venus/readability-render-sync.md) | 2026-09-25 GDD-13/23/24에서 고친 위치, 출처 정정, 남은 CJ 결정 |
| [Venus #263 타이머 규칙 동기화](../issues/263/Venus/timer-rule-sync.md) | 2026-09-25 후속 CJ 30초/60초 결정의 GDD 반영 위치와 검증 기준 |

## 보관 기준

2026-09-16 CJ 지시로 `docs/creat2ve/planning-v0411/`의 11개 파일을 이곳으로 이동했다. 원본 내용·하위 경로는 보존했으며, 이전 보고서의 평문 경로는 [이동 안내](../../MOVES.md)로 추적한다. 과거 보고서는 당시 판단의 기록이므로 최신 기획으로 읽지 않는다.

앞으로도 기획은 Notion에서 작성하고, 로컬 기록은 `docs/milestone/vX.Y.Z/planning/`에 정리한다. Milestone Open 후에도 사전 기획 기록은 이 위치에 보존한다.
