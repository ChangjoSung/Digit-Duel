# v0.4.11 — 전투·경제·UI System·계정 개편

2026-09-28: 승인된 제품 변경과 DB 구조 수정을 `milestone/v0.4.11`에 통합했다. [#232 통합·Render 준비 보고](issues/232/Mercury/integration-review.md)가 현재 조정 원장이다. [작업 공간 정리 기록](reports/Mercury/worktree-consolidation-2026-09-25.md)과 독립 QA를 연결했다.

공식 하위 이슈 14개는 GitHub 상태 기준 CLOSED 8개·OPEN 6개다. 제품 통합과 Issue 종결은 구분한다. 열린 이슈를 이번 조정에서 닫지 않았으며, #264와 #259의 실제 Render 조건은 대기다.

| 범위 | 현재 상태 |
|---|---|
| #233·#234·#241·#235·#253·#236·#237 | 기존 완료·통합 근거 보존 |
| [#263](https://github.com/ChangjoSung/Digit-Duel/issues/263) | CJ·Saturn·CI PASS, PR268 병합, CLOSED |
| [#259](https://github.com/ChangjoSung/Digit-Duel/issues/259)·[#260](https://github.com/ChangjoSung/Digit-Duel/issues/260)·[#261](https://github.com/ChangjoSung/Digit-Duel/issues/261) | CJ QA·각 현재 PR CI6/6 통과 후 PR269·270·271 병합 |
| [#262](https://github.com/ChangjoSung/Digit-Duel/issues/262)·[#238](https://github.com/ChangjoSung/Digit-Duel/issues/238) | CJ·Saturn QA·각 현재 PR CI6/6 통과 후 PR272·273 병합. 기록 높이 추가 CJ QA 면제 반영 |
| [#264](https://github.com/ChangjoSung/Digit-Duel/issues/264) | 로컬 독립 구조·스키마 차단 QA PASS, PR274 CI6/6 통과·병합. 실제 DB·메일·배포 QA는 대기 |

기존 177아트와 부모 기록을 보존했다. 통합 중 낡은 UI 검사·Windows/LF 호환을 정리하고, 실제 누락 테이블을 준비 완료로 판정하던 결함을 수정했다. 독립 실제 PG 재검증 근거는 [Saturn 보고](issues/232/Saturn/report.md)를 따른다.

작업 트리 8개·로컬 브랜치 8개·원격 브랜치 6개를 보존 후 정리했다. 사용자 dirty 원본과 최신 통합 코드의 `release-review-v0.4.11`만 남겼다. QA8085·PG55462와 임시 검증 서비스를 종료하고 DB·계정·SMTP·백업을 보존했다.

**현 Render 설정은 배포 NO-GO**: Free Web, 프로젝트 DB와 SMTP 설정 없음, Free SMTP 차단. main Release·배포·자원 생성·결제는 CJ의 별도 지시 후 진행한다. `milestone → dev → main`의 보호 브랜치·필수 CI 원칙을 유지한다.

- [공식 범위·기존 완료 조건 #232](https://github.com/ChangjoSung/Digit-Duel/issues/232)
- [Notion 기획 원본·로컬 기록](planning/README.md)
- [마일스톤 문서 규약](../README.md)
