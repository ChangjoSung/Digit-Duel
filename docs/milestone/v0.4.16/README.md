> **2026-10-28 운영 원장 전환:** 현재 업무·승인·인수인계는 [Mercury PM 운영 원장](../../creat2ve/PM_BOARD.html)에서 관리합니다. 아래 표와 보고는 작성 당시의 기록이며 새 작업 승인이나 현재 운영 상태로 재활성화하지 않습니다.

# v0.4.16 — 싱글플레이·튜토리얼·UI 컨셉 변경

[개발 브랜치 README](../../../README.md) · [GitHub Milestone 20](https://github.com/ChangjoSung/Digit-Duel/milestone/20)

v0.4.16은 개발 중이다. 최신 정식 출시는 [v0.4.15](../../releases/v0.4.15.md)이며 운영 웹 게임의 UI와 이 브랜치의 개발 UI를 구분한다.

## 작업 현황

| Issue | 내용 | 상태 |
| --- | --- | --- |
| [#335](https://github.com/ChangjoSung/Digit-Duel/issues/335) | 테이블탑 판타지 UI·전체33종 회화풍 미술·33종4번 대표기 FX | CJ 최종 QA PASS, PR336 통합·CLOSED |
| [#386](https://github.com/ChangjoSung/Digit-Duel/issues/386) | 새 UI의 README·플레이 사진·브랜치 트랙 정비 | CJ README QA PASS, PR387·388 통합·CLOSED |
| [#265](https://github.com/ChangjoSung/Digit-Duel/issues/265) | 싱글플레이 UI System Flow | 미착수 |
| [#322](https://github.com/ChangjoSung/Digit-Duel/issues/322) | 무제한 AI 대전 | 미착수 |
| [#323](https://github.com/ChangjoSung/Digit-Duel/issues/323) | 왕국9단계 PVE | 미착수 |
| [#324](https://github.com/ChangjoSung/Digit-Duel/issues/324) | 튜토리얼 System Flow | 미착수 |

## 브랜치 운영

정의 원본은 [CLAUDE.md](../../../CLAUDE.md)의 Git/GitHub 컨벤션이다.

`doc/386-v0416-readme` 같은 이슈 브랜치를 `milestone/v0.4.16`에서 분기해 PR·필수 CI6개 확인 후 squash 통합한다. 마일스톤 완료 후 트랙→dev, dev→main은 각각 merge commit을 사용한다. main·dev·트랙에는 직접 커밋하지 않으며 force push·보호 해제·rebase merge를 하지 않는다. 마일스톤 트랙은 종료까지 유지하고 완료된 임시 이슈 브랜치는 사용처와 보관 근거를 확인해 정리한다.

2026-10-28 CJ Branch 규칙 재확인: #335는 당시 트랙 부재로 dev에 직접 squash 병합됐다. 그 경로 이탈을 숨기거나 이력을 다시 쓰지 않고, 승인 UI가 포함된 dev `a1fa420bbd5b39b7d179233297b9ef78ef0b889b`에서 현재 트랙을 구성했다. #386은 이슈→트랙 경로를 따른다. 미착수 제품4건과 정식 출시·배포를 이 문서 작업으로 완료 처리하지 않는다.

README 사진의 촬영 소스·규격·로컬 상태 fixture 범위는 [촬영 보고](issues/386/Mars/report.md)에 기록한다. 실제 회원·운영 서버 E2E 증거와 구분한다.
