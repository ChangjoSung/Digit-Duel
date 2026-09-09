# v0.4.3 — 하수인 아트·말판 아이콘

[Milestone 7](https://github.com/ChangjoSung/Digit-Duel/milestone/7) · 2026-09-07 종료 · [릴리스 노트](../../releases/v0.4.3.md)

하수인 20종의 설명창·전투·말판 이미지를 규격화하고, 제작·검수해 게임에 적용한 마일스톤이다. 아래 문서는 **그 시점의 판정 기록**이다. 현재 규칙은 [docs 안내](../../README.md)에서 본다.

## 승인 규격

| 문서 | 내용 |
|---|---|
| [하수인 외형 이미지 규격](specs/minion-visual-spec-v0.4.3.md) | 설명창·전투·말판 아이콘의 크기·팔레트·적용 기준 (#81) |

## 공용 자산·데이터 — `assets/minions/`

[납품 안내](assets/minions/README.md) · 픽셀 원본 20 · 전투 보정 패치 4 · 검토 시트 7 · 매니페스트 2

`#81`(원본 등록 · `source-manifest.csv`)과 `#87`(제작 납품 · `delivery-manifest.csv`)에 걸쳐 있어 한 Issue 아래가 아니라 마일스톤 레벨에 둔다. `tools/minion_art.py`가 읽는 입력이기도 하다.

## Issue별 작업물

### #87 — [v0.4.3 하수인 시각 보완·말판 아이콘 납품](https://github.com/ChangjoSung/Digit-Duel/issues/87)

| 역할 | 문서 |
|---|---|
| Earth | [Earth_1 반입·제작 시험](issues/87/Earth/earth-1-report.md) · [Earth_1 native32 파일럿](issues/87/Earth/earth-1-native-report.md) · [Earth_1 나머지 8종 납품](issues/87/Earth/earth-1-full-delivery-report.md) |
| Earth | [Earth_2 반입·제작 검토](issues/87/Earth/earth-2-report.md) · [Earth_2 native32 파일럿](issues/87/Earth/earth-2-native-report.md) · [Earth_2 나머지 8종 납품](issues/87/Earth/earth-2-full-delivery-report.md) |
| Mars | [아트 파이프라인 규약](issues/87/Mars/art-pipeline.md) · [파이프라인 구현 보고](issues/87/Mars/mars-pipeline-report.md) |
| Saturn | [원본 아트 QA](issues/87/Saturn/source-qa-saturn.md) · [파일럿 1차](issues/87/Saturn/pilot-qa-saturn.md) → [V1 재검수](issues/87/Saturn/pilot-v1-qa-saturn.md) → [V2 최종](issues/87/Saturn/pilot-v2-qa-saturn.md) · [도구 QA](issues/87/Saturn/tooling-qa-saturn.md) · [최종 20종 납품 QA](issues/87/Saturn/final-qa-saturn.md) |

Saturn 파일럿 연쇄는 **1차 REVISE → V1 재검수 → V2 최종**이다. 세 문서가 각기 다른 자산 리비전의 SHA를 판정하므로 뒤 문서가 앞 문서를 대체하지 않는다.

### #89 — [하수인 아트 게임 적용·양측 말 아이콘 통일](https://github.com/ChangjoSung/Digit-Duel/issues/89)

| 역할 | 문서 |
|---|---|
| Mars | [구현 납품 보고](issues/89/Mars/minion-art-integration-mars.md) · 증빙 CDP 캡처 71 → [`issues/89/Mars/artifacts/`](issues/89/Mars/artifacts/) |
| Saturn | [1차 독립 QA (REVISE)](issues/89/Saturn/minion-art-integration-saturn-initial.md) → [재검 PASS](issues/89/Saturn/minion-art-integration-saturn-final.md) |

### 문서가 없는 Issue

`#81`(규격 문서화)의 산출물은 위 `specs/`다. `#83`(Mercury PD 컨텍스트 교대)은 조정 안건이라 이 보관소에 문서가 없다 — 기록은 GitHub Issue 코멘트에 있다.

## 옛 경로

이 폴더의 문서는 2026-09-09 이전 `docs/art/minions-v0.4.3/` · `docs/qa/` · `docs/`에 있었다. 본문이 인용하는 옛 경로는 그 시점 기록이라 그대로 두었다 — 현재 위치는 [MOVES.md](../MOVES.md)에서 찾는다.
