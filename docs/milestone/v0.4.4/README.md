# v0.4.4 — 전투 변수·온라인 시점·턴 흐름

[Milestone 10](https://github.com/ChangjoSung/Digit-Duel/milestone/10) · 2026-09-08 종료 · [릴리스 노트](../../releases/v0.4.4.md)

탐색 보상 기술 교체, 공격형 위력 완화, 감전 확률 하향, 온라인 양측 시점 통일, 턴 흐름·연출 계약을 다룬 마일스톤이다. 아래 문서는 **그 시점의 판정 기록**이다. 현재 규칙은 [docs 안내](../../README.md)에서 본다.

## 승인 규격 — `specs/`

| 문서 | 내용 |
|---|---|
| [v0.4.4 게임플레이 계약](specs/v0.4.4-gameplay-spec.md) | 탐색 기술 교체·온라인 시점·메모·수치 조정 (#92 #93 #94 #95 #96) |
| [v0.4.4 턴 흐름·연출 계약](specs/v0.4.4-turn-flow-spec.md) | 턴 배너·회복 행동·접촉 연출·전투 4카테고리·자동 턴 종료 (#106) |
| [규칙 정리본 (DIGEST 2호)](specs/v0.4.4-rules-digest.md) | 위 두 계약을 읽기 쉽게 옮긴 판 |

## 마일스톤 전체 보고 — `reports/`

| 역할 | 문서 |
|---|---|
| Mercury | [v0.4.3 출시·v0.4.4 개선 취합](reports/Mercury/v044-pd-report.md) — #91~#96의 구현·QA 근거 |
| Mercury | [CJ QA 후속 통합 보고](reports/Mercury/v044-followup-pd-report.md) — #104~#106의 최종 근거와 측정 한계 |
| Mercury | [PD 수치 기반 자가 점검](reports/Mercury/mercury-self-audit-2026-09-08.md) — 2026-09-08 인계 메타데이터 |
| Mars | [#91~#96 기술 분석 재검증본](reports/Mars/v044-technical-analysis-mars.md) |

## Issue별 작업물 — `issues/`

| Issue | 제목 | Mars | Saturn | 그 외 |
|---|---|---|---|---|
| [#91](https://github.com/ChangjoSung/Digit-Duel/issues/91) | 공용 하수인 대리 출전 아트 누락 | [구현 보고](issues/91/Mars/issue91-mars.md) · [REVISE 대응](issues/91/Mars/issue91-mars-revise.md) | [1차 REVISE](issues/91/Saturn/issue91-saturn-initial.md) → [최종 PASS](issues/91/Saturn/issue91-saturn.md) | |
| [#92](https://github.com/ChangjoSung/Digit-Duel/issues/92) | 탐색 보상으로 속성 기술 획득·교체 | [구현 보고](issues/92/Mars/issue92-mars.md) · [dev 통합 검증](issues/92/Mars/issue92-integration.md) | [규칙 QA](issues/92/Saturn/issue92-saturn.md) · [브라우저 QA](issues/92/Saturn/issue92-saturn-browser.md) | |
| [#93](https://github.com/ChangjoSung/Digit-Duel/issues/93) | 온라인 양측 자기 진영 아래 표시 | [구현 보고](issues/93/Mars/issue93-mars.md) · [테스트 품질 수리](issues/93/Mars/issue93-test-revise.md) | [최초 QA](issues/93/Saturn/issue93-saturn-initial.md) → [#94 통합 검수](issues/93/Saturn/issue93-saturn-integration.md) → [최종 QA](issues/93/Saturn/issue93-saturn.md) | |
| [#94](https://github.com/ChangjoSung/Digit-Duel/issues/94) | 상대 턴에도 추측 메모 허용 | [구현 보고](issues/94/Mars/issue94-mars.md) | [최초 QA](issues/94/Saturn/issue94-saturn-initial.md) → [최종 통합 QA](issues/94/Saturn/issue94-saturn.md) | |
| [#95](https://github.com/ChangjoSung/Digit-Duel/issues/95) | 공격형 연속 공격 위력 완화 | [구현 보고](issues/95/Mars/issue95-mars.md) · [before/after 대조표](issues/95/Mars/artifacts/attack_balance_compare.md) | [독립 QA PASS](issues/95/Saturn/issue95-saturn.md) | |
| [#96](https://github.com/ChangjoSung/Digit-Duel/issues/96) | 감전 부여 확률 70% → 50% | [구현 보고](issues/96/Mars/issue96-mars.md) · [통합 후 검증 보완](issues/96/Mars/issue96-integration.md) | [독립 QA](issues/96/Saturn/issue96-saturn.md) | |
| [#104](https://github.com/ChangjoSung/Digit-Duel/issues/104) | 온라인 양측 말 정체·위치 동기화 오류 | [구현 보고](issues/104/Mars/issue104-mars.md) · [보드 방향 감사 rev3](issues/104/Mars/issue104-orientation-audit.md) | [독립 QA](issues/104/Saturn/issue104-saturn.md) · [방향 감사 1차 REVISE](issues/104/Saturn/issue104-orientation-saturn-first.md) → [최종 재검수](issues/104/Saturn/issue104-orientation-saturn-final.md) | |
| [#105](https://github.com/ChangjoSung/Digit-Duel/issues/105) | README·Releases 전면 개편 | [튜토리얼 캡처 출처·검증](issues/105/Mars/issue105-media.md) | [미디어 1차](issues/105/Saturn/issue105-saturn-media-first.md) → [미디어 재검](issues/105/Saturn/issue105-saturn-media.md) → [최종 PASS](issues/105/Saturn/issue105-saturn-final.md) · [아트·문안 검수](issues/105/Saturn/issue105-saturn-editorial.md) | Earth [hero 제작 기록](issues/105/Earth/readme-hero-v0.4.4.md) · Mercury [취합 보고](issues/105/Mercury/issue105-pd-report.md) |
| [#106](https://github.com/ChangjoSung/Digit-Duel/issues/106) | 턴 행동·회복·전투 연출·자동 턴 종료 | [구현 보고](issues/106/Mars/issue106-mars.md) · [방어막 표시 수리](issues/106/Mars/issue106-shield-mars.md) · [브라우저 보완 감사](issues/106/Mars/issue106-browser-mars.md) | [1차 REVISE](issues/106/Saturn/issue106-saturn-first.md) → [최종 독립 QA](issues/106/Saturn/issue106-saturn-final.md) | Mercury [실행 소유권 이탈 기록](issues/106/Mercury/issue106-pd-incident.md) |

`#104`는 `#93`의 sub-issue다. 깊이 1단계 규칙에 따라 `issues/93/` 아래로 중첩하지 않고 별도 폴더에 두었다.

## 증빙 자료

각 보고서에 딸린 캡처·CDP JSON·렌더 HTML은 그 역할 폴더 아래 `artifacts/`에 있다 — [#91](issues/91/Mars/artifacts/) 10 · [#92](issues/92/Mars/artifacts/) 6 · [#93](issues/93/Mars/artifacts/) 5 · [#94](issues/94/Mars/artifacts/) 5 · [#95](issues/95/Mars/artifacts/) 9 · [#96](issues/96/Mars/artifacts/) 5 · [#104](issues/104/Mars/artifacts/) 3과 [방향 감사](issues/104/Mars/orientation-artifacts/) 6 · [#105](issues/105/Mars/artifacts/) 13 · [#106](issues/106/Mars/artifacts/) 17과 [브라우저](issues/106/Mars/browser-artifacts/) 19.

## 초기 REVISE 보고를 지우지 않은 이유

`initial` · `first` · `revise`가 붙은 문서는 최종본이 대체하지 않는다. 최종본이 이름을 지목해 보존을 선언하거나("초기 항등단언은 …-initial.md에 보존했다"), "재실행하지 않았다"며 증거를 앞 문서에 위임하거나, 앞 문서의 SHA-256을 자기 검수 입력표에 등재하기 때문이다. 지우면 최종본의 근거 체인이 끊어진다.

## 옛 경로

이 폴더의 문서는 2026-09-09 이전 `docs/qa/` · `docs/art/` · `docs/`에 있었다. 본문이 인용하는 옛 경로는 그 시점 기록이라 그대로 두었다 — 현재 위치는 [MOVES.md](../MOVES.md)에서 찾는다.
