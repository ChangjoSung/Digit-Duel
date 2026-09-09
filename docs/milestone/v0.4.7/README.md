# v0.4.7 — 기획 재정비·세로 UI·연출·외부망

[Milestone 13](https://github.com/ChangjoSung/Digit-Duel/milestone/13) · **진행 중**

이 마일스톤은 아직 끝나지 않았다. 아래 표의 범위는 GitHub Issue에 등록된 계획이며, 이 폴더에 문서가 생기는 것은 그 Issue가 실제로 착수된 뒤다. 게임 규칙은 아직 v0.4.5 출시본이 기준이다 — [v0.4.5 규격](../v0.4.5/README.md).

## 선행 Infra

### [#132](https://github.com/ChangjoSung/Digit-Duel/issues/132) — [infra] 문서 보관 구조 정리 및 HTML PR Actions 연동

| 역할 | 문서 |
|---|---|
| Venus | [문서 보관 구조 분석](issues/132/Venus/analysis.md) — 인벤토리·경로 규약·참조 무결성·집행 결과 |
| Mars | [GitHub Actions 도입 보고](issues/132/Mars/report.md) — CI 잡 구성·도구 경로 갱신 |

PR #133 dev 통합·CI 5개 검사·Saturn PASS 후 CJ의 다음 Comment로 완료 수락했다. 최초 보호 경로 메타데이터 조회 예외는 보고서에 보존하며 무접근 기준 완전 충족으로 바꾸지 않는다. 2026-09-09 CJ 일정 변경 전 작성된 보고 본문의 v0.4.6은 당시 일정 표기다. 이 Issue가 만든 것은 두 가지다.

1. **문서 보관 구조** — `docs/qa/` · `docs/art/` · `docs/` 루트에 흩어져 있던 342개 추적 파일을 버전 → Issue → 역할로 재배치했다. 이동 306 · 유지 36 · 삭제 0. 대조표는 [MOVES.md](../MOVES.md)와 [MOVES.csv](../MOVES.csv)에 있다.
2. **PR Actions 연동** — `.github/workflows/ci.yml`의 규칙 회귀·서버·문서 링크·자산 무결성 검사. 사용법은 [CONTRIBUTING.md](../../../CONTRIBUTING.md)에 있다.

### [#134](https://github.com/ChangjoSung/Digit-Duel/issues/134) — demo/test·tools 구조 및 일정·개발자 표기 정리

Issue 전용 검증 파일은 버전·Issue별로, 공통 하네스와 지속 사용하는 도구는 용도별로 정리한다. 실행 경로·동적 검사 검색·CI와 현행 안내를 함께 갱신한다. Mars(Claude) 구현 → Saturn(Codex) 독립 READ_ONLY 검수 → dev PR 통합 순서로 진행 중이다.

[검사 인덱스](../../../demo/test/README.md) · [도구 인덱스](../../../tools/README.md) · [경로표](issues/134/Mercury/MOVES.csv) · [PD 기록](issues/134/Mercury/report.md)

이번 CJ 결정으로 Roblox #118은 [v0.4.6](../v0.4.6/README.md)에 분리됐다. 기존 CJ 게임 이슈와 Infra의 소속·설명·문서 경로를 v0.4.7로 맞추며, README 게임 정보에 Roblox 포팅 담당 이욱채(lee775)를 추가한다.

## 등록된 나머지 범위 (착수 전)

| Issue | 제목 | 소관 |
|---|---|---|
| [#119](https://github.com/ChangjoSung/Digit-Duel/issues/119) | 공용 하수인 확장 기획 | Venus |
| [#120](https://github.com/ChangjoSung/Digit-Duel/issues/120) | 하수인 전체 속성 기술 분석·밸런스 및 기술 재등록 | Venus |
| [#121](https://github.com/ChangjoSung/Digit-Duel/issues/121) | 탐색 이벤트별·말별 현황 분석 및 삭제·추가 정리 | Venus |
| [#122](https://github.com/ChangjoSung/Digit-Duel/issues/122) | 휴대폰 세로 화면 기준 HTML Design & Game Flow 개편 | Earth · Mars |
| [#123](https://github.com/ChangjoSung/Digit-Duel/issues/123) | 공용 하수인 전용 아트 디자인 추가 | Earth |
| [#124](https://github.com/ChangjoSung/Digit-Duel/issues/124) | 동료·왕 Pixel Dot Design 추가 | Earth |
| [#125](https://github.com/ChangjoSung/Digit-Duel/issues/125) | 연출 템포 단축 — 2초 구간을 1.2초로 | Mars |
| [#126](https://github.com/ChangjoSung/Digit-Duel/issues/126) | 전투 승리·패배 연출 강화 및 화면 흐름 연동 | Mars |
| [#127](https://github.com/ChangjoSung/Digit-Duel/issues/127) | 외부망 운영 전환 분석 — ChatGPT Sites·ngrok 비교 | Jupiter |
| [#128](https://github.com/ChangjoSung/Digit-Duel/issues/128) | 최초 튜토리얼 표시를 PC·브라우저별로 검증 및 수정 | Mars |
| [#129](https://github.com/ChangjoSung/Digit-Duel/issues/129) | 수풀 탐색 행동 완료 후 불필요한 턴 종료 지연 제거 | Mars |
| [#130](https://github.com/ChangjoSung/Digit-Duel/issues/130) | 연속 보호막 효과가 합산되도록 규칙 변경 | Mars |
| [#131](https://github.com/ChangjoSung/Digit-Duel/issues/131) | 함정에 걸린 하수인의 텔레포트 선택 차단·안내 | Mars |

위 소관은 [CLAUDE.md](../../../CLAUDE.md)의 역할 계약(영역 → 역할)에서 따온 것이며, 실제 배치는 PD 라우팅으로 확정된다. 게임 규칙을 바꾸는 항목(#119~#121 · #125 · #126 · #129 · #130 · #131)은 CJ 승인 전까지 규격이 확정되지 않는다.

**아직 정해지지 않은 것**: `#123`·`#124`가 만들 새 아트 데이터를 v0.4.3의 [`assets/minions/`](../v0.4.3/assets/minions/)에 추가할지, v0.4.7에 새 `assets/`를 열지는 아트 범위가 확정된 뒤에 정한다. 지금 결정할 필요가 없어 미뤄 둔 사항이며 이번 Issue의 승인을 막는 항목이 아니다.

## 폴더 규약

이 마일스톤도 [보관소 규약](../README.md#폴더-규약)을 그대로 따른다 — `specs/` · `reports/<역할>/` · `issues/<번호>/<역할>/`.
