# v0.4.5 — 턴 행동 정리·문서·튜토리얼 갱신

[Milestone 11](https://github.com/ChangjoSung/Digit-Duel/milestone/11) · 2026-09-08 종료 · [릴리스 노트](../../releases/v0.4.5.md)

텔레포트 횟수 제한 해제, 양측 밀어내기, 도망 후 후방 말 선택, 턴 종료 버튼 정리와 튜토리얼 10단계 갱신을 다룬 마일스톤이다. **현재 출시본이 v0.4.5이므로 이 폴더의 `specs/`는 지금 통하는 규칙이기도 하다.**

완료 범위의 원본 근거: [Milestone 11](https://github.com/ChangjoSung/Digit-Duel/milestone/11) · [Issue #114](https://github.com/ChangjoSung/Digit-Duel/issues/114) · [CJ 턴 행동 원문](https://app.notion.com/p/3d51e7f1708580b0916ded4bd3d9d06e)

## 승인 규격 — `specs/`

| 문서 | 내용 |
|---|---|
| [v0.4.5 게임플레이 계약](specs/v0.4.5-gameplay-spec.md) | 구현·QA의 승인 규칙 — 세부 규칙과 예외 |
| [규칙 정리본 (DIGEST 3호)](specs/v0.4.5-rules-digest.md) | 같은 규칙을 읽기 쉽게 옮긴 판 |

## 마일스톤 전체 보고 — `reports/`

| 역할 | 문서 |
|---|---|
| Mercury | [v0.4.5 분석](reports/Mercury/v0.4.5-analysis.md) — 부서 분석 취합과 CJ 결정 경계 |

## Issue별 작업물 — `issues/`

### [#114](https://github.com/ChangjoSung/Digit-Duel/issues/114) — v0.4.5 턴 행동·튜토리얼 갱신

| 역할 | 문서 |
|---|---|
| Mars | [구현 보고](issues/114/Mars/issue114-mars.md) · [후속 보고](issues/114/Mars/issue114-mars-followup.md) · 캡처 증빙 30 → [`artifacts/`](issues/114/Mars/artifacts/) |
| Venus | [Notion 동기화·독립 검수 이력](issues/114/Venus/issue114-notion-sync.md) — GDD-13·12·14·DIGEST 치환 근거 |
| Mercury | [통합 보고](issues/114/Mercury/issue114-pd-report.md) — 변경·검증 결과 |

이 마일스톤에는 Saturn 보고가 별도 파일로 없다. 독립 QA 결과는 위 Mercury 통합 보고에 취합돼 있다.

README의 튜토리얼 10장과 그 해시 기록([`capture-manifest.json`](issues/114/Mars/artifacts/capture-manifest.json))이 이 Issue의 산출물이다.

## 옛 경로

이 폴더의 문서는 2026-09-09 이전 `docs/qa/` · `docs/`에 있었다. 본문이 인용하는 옛 경로는 그 시점 기록이라 그대로 두었다 — 현재 위치는 [MOVES.md](../MOVES.md)에서 찾는다.
