# v0.4.11 — 전투·경제·UI System·계정 개편

2026-09-28 작업 공간 현황: [Mercury 작업 트리 정리 원장](reports/Mercury/worktree-consolidation-2026-09-25.md). #259 PR269·#260 PR270·#261 PR271은 현재 HEAD의 CI6/6 성공, 마일스톤 병합 대기. #262는 미커밋 Saturn·CJ QA PASS. #238 기록을 이벤트 아이콘과 같은 높이로 수정하고 Saturn·CJ PASS 처리했다(추가 CJ QA 면제). 다음 [#232 통합 준비 검토](issues/232/Mercury/integration-review.md)를 착수했으며 CI/PR/통합은 별도다.

[Milestone 15](https://github.com/ChangjoSung/Digit-Duel/milestone/15)의 납품 범위와 권장 순서는 부모 [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232)가 기준이다. 공식 하위 이슈는 14개(2026-09-25 확인: 7개 완료, 7개 대기)다. 아래 진행 순서는 일괄 구현 승인이 아니며, 열린 이슈는 CJ의 개별 착수 지시를 따른다. Unity 포팅은 범위 밖이다.

| 단계 | 이슈 | 현재 상태 |
|---|---|---|
| 전투·기반 | [#233](https://github.com/ChangjoSung/Digit-Duel/issues/233) · [#234](https://github.com/ChangjoSung/Digit-Duel/issues/234) · [#241](https://github.com/ChangjoSung/Digit-Duel/issues/241) · [#235](https://github.com/ChangjoSung/Digit-Duel/issues/235) | 완료 |
| 선행 아트·경제·온라인 | [#253](https://github.com/ChangjoSung/Digit-Duel/issues/253) · [#236](https://github.com/ChangjoSung/Digit-Duel/issues/236) · [#237](https://github.com/ChangjoSung/Digit-Duel/issues/237) | 완료. 당시 계약 이력은 보존 |
| 최신 상점·타이머 | [#263](https://github.com/ChangjoSung/Digit-Duel/issues/263) | CJ 브라우저 플레이 QA PASS, Saturn 독립 QA GO(수동 기록), [PR #268](https://github.com/ChangjoSung/Digit-Duel/pull/268) 필수 CI 6/6 통과 후 `milestone/v0.4.11`에 squash 병합(`83434f0`). 현행 GitHub 상태 CLOSED(2026-09-27 확인). [검증·운영 이력](issues/263/Mercury/report.md) |
| Render 무료 QA DB | [#264](https://github.com/ChangjoSung/Digit-Duel/issues/264) | `fafc619` 기반 새 전용 트리에서 선택적 연결·마이그레이션·복원 런북을 미커밋 준비, 정식 모델 Saturn의 로컬 런북 GO. 모델 사고·검증 원장은 그 전용 트리에 보관. 실 DB/Render 검증·Dashboard 확인·자원 생성 승인 별개 |
| 계정·진입·방 | [#259](https://github.com/ChangjoSung/Digit-Duel/issues/259) · [#260](https://github.com/ChangjoSung/Digit-Duel/issues/260) · [#261](https://github.com/ChangjoSung/Digit-Duel/issues/261) | #259 CJ 최종 로컬 QA와 최신 타이머 통합 Saturn PASS, [PR #269](https://github.com/ChangjoSung/Digit-Duel/pull/269) 최종 CI6/6 PASS·병합 미승인·HTTPS/Render 대기. #260 Saturn 로컬·CJ 최종 플레이 QA PASS, QA 서버 종료 · CJ 데이터 보존. [PR270](https://github.com/ChangjoSung/Digit-Duel/pull/270) 작성·HEAD a444d57 브랜치 CI6/6 PASS, #259 기준 분리 PR·milestone 통합 CI 별도. 각 활성 트리 Mercury/report.md가 단일 원장이다. #261은 [CJ 승인 리뷰](issues/261/Mercury/review.md)에 따라 별도 트리에서 기획 동기화·구현 완료, Saturn·CJ QA PASS·[PR271](https://github.com/ChangjoSung/Digit-Duel/pull/271)·최신 브랜치 CI6/6 PASS · QA 서버 종료 |
| 이모티콘·경기 UI | [#262](https://github.com/ChangjoSung/Digit-Duel/issues/262) · [#238](https://github.com/ChangjoSung/Digit-Duel/issues/238) | 두 이슈 Saturn·CJ QA PASS. #238 기록 높이 최종수정 검증 완료·추가 CJ QA 면제. 미커밋 변경 분리·CI/PR/통합 대기·검수8085 유지 |

현재 #238 기록과 이벤트 아이콘은320/432 화면에서 높이 차이0이며 최근20팝업·실제터치·초점·다른구역좌표를 독립 검증했다. 이전351/0·터치12점/REVISE 이력은 보존, 이번 UI검사1회147/0과 좁은 위치QA만 진행했다. QA1625파일 무수정·승인177아트·부모22파일 보존, Worker 정산/회수 완료. QA http://127.0.0.1:8085/ · PG55462·DB·계정·SMTP 유지. GitHub 기존4조건 중3체크, 마지막은 Saturn/CJ PASS·CI/통합 대기다. #232 통합 준비를 진행하며 #262/#238 Git 쓰기·milestone 병합·종결·배포·Render 생성/결제는 별도 승인 전이다.

트랙은 `dev`에서 분기한 `milestone/v0.4.11`이다. 이슈 작업은 전용 브랜치·PR·필수 CI·Saturn QA·CJ 플레이 QA를 따른다. 문서 가독성·출처 정정은 제품 구현 또는 QA 완료가 아니다.

- [Notion 기획 원본·로컬 기록](planning/README.md)
- [마일스톤 문서 규약](../README.md)
