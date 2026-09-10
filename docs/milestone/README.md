# 마일스톤 보관소

버전 → Issue → 작성 역할 순서로 정리한 **과거 시점의 구현·QA 기록**이다. 각 문서는 작성 당시의 판정이며 이후 버전에서 바뀐 규칙을 반영하지 않는다. **지금 통하는 규칙과 실행 방법은 [docs 안내](../README.md)** 에서 본다.

## 버전 인덱스

| 버전 | Milestone | 범위 | 파일 | 인덱스 |
|---|---|---|---|---|
| v0.4.3 | [Milestone 7](https://github.com/ChangjoSung/Digit-Duel/milestone/7) | 하수인 아트·말판 아이콘 — #81 #83 #87 #89 | 125 (md 19) | [v0.4.3](v0.4.3/README.md) |
| v0.4.4 | [Milestone 10](https://github.com/ChangjoSung/Digit-Duel/milestone/10) | 전투 변수·온라인 시점·턴 흐름 — #91~#96 #104~#106 | 144 (md 47) | [v0.4.4](v0.4.4/README.md) |
| v0.4.5 | [Milestone 11](https://github.com/ChangjoSung/Digit-Duel/milestone/11) | 턴 행동 정리·문서·튜토리얼 갱신 — #114 | 37 (md 7) | [v0.4.5](v0.4.5/README.md) |
| v0.4.6 | [Milestone 12](https://github.com/ChangjoSung/Digit-Duel/milestone/12) | Roblox 포팅 — #118 (별도 작업자 진행 중) | 별도 작업자 관리 | [v0.4.6](v0.4.6/README.md) |
| v0.4.7 | [Milestone 13](https://github.com/ChangjoSung/Digit-Duel/milestone/13) | #121·#125·#129·#146·#131·#130 CJ QA PASS·CLOSED(미출시) · #128 매 페이지 로드 튜토리얼 표시 2026-09-10 CJ QA PASS·CLOSED · **#122·#124·#126 CJ QA REVISE — 뒤로가기·어두운 배경 보완·CJ 재검수 대기(OPEN)** · 나머지 게임 이슈 착수 대기 · Infra #132/#134 완료 | 진행 중 | [v0.4.7](v0.4.7/README.md) |

v0.4.2 이하는 이 보관소에 문서가 없다. 그 버전들의 변경 내용은 [릴리스 노트 목록](../releases/README.md)에서 본다.

## 폴더 규약

```
docs/milestone/
  README.md          이 문서 — 버전·Issue·역할 길잡이
  MOVES.md           옛 경로 → 현재 경로 대조표 안내
  MOVES.csv          그 대조표 본체 (342행)
  <버전>/
    README.md        그 버전의 Issue·역할 인덱스
    specs/           그 버전에서 승인된 규격·규칙 정리본 (역할 하위폴더 없음)
    reports/<역할>/  마일스톤 전체 범위의 취합·분석 보고
    issues/<번호>/<역할>/            그 Issue의 작업물
    issues/<번호>/<역할>/artifacts/  그 보고서가 인용하는 캡처·JSON·HTML
    assets/          여러 Issue에 걸친 공용 자산·데이터 묶음 (v0.4.3 아트)
```

두 가지 규약이 자주 묻는 지점이다.

- **`specs/`에는 역할 폴더를 두지 않는다.** 게임플레이 계약은 Venus 초안 → PD 채택 → CJ 승인을 거친 프로젝트 소유 문서지 한 역할의 산출물이 아니다. 반면 `reports/`·`issues/`는 "누가 무엇을 주장했는가"가 증거의 일부라 역할로 나눈다.
- **인스턴스 접미사(Mars_1·Saturn_2)는 폴더로 만들지 않는다.** 한 Issue에 여러 인스턴스가 섞이고, 인스턴스는 이미 각 문서 첫머리에 적혀 있다.

## 역할 표기

| 역할 | 담당 |
|---|---|
| Mercury | PD — 취합·조정·Git·문서 메타데이터 |
| Venus | PLAN — 기획서·분석 |
| Mars | Client·HTML·Unity·툴링 구현 |
| Earth | Art — 아트 제작·납품 |
| Saturn | 읽기 전용 교차 QA — PASS / REVISE / BLOCKED |

역할 계약의 정의 원본은 [CLAUDE.md](../../CLAUDE.md)다.

## 옛 경로를 만났을 때

이 보관소의 문서는 2026-09-09 이전에는 `docs/qa/` · `docs/art/` · `docs/` 루트에 있었다. 본문이 인용하는 `docs/qa/…` 같은 평문 경로와 JSON·CSV의 출처 기록은 **그 시점의 사실 진술이라 고치지 않았다**. 현재 위치는 [MOVES.md](MOVES.md)와 [MOVES.csv](MOVES.csv)에서 찾는다. 클릭 가능한 링크·이미지는 새 경로로 갱신했다.
