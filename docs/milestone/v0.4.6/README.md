# v0.4.6 — 기획 재정비·세로 UI·연출·외부망

[Milestone 12](https://github.com/ChangjoSung/Digit-Duel/milestone/12) · **진행 중**

이 마일스톤은 아직 끝나지 않았다. 아래 표의 범위는 GitHub Issue에 등록된 계획이며, 이 폴더에 문서가 생기는 것은 그 Issue가 실제로 착수된 뒤다. 게임 규칙은 아직 v0.4.5 출시본이 기준이다 — [v0.4.5 규격](../v0.4.5/README.md).

## 지금 진행 중

### [#132](https://github.com/ChangjoSung/Digit-Duel/issues/132) — [infra] 문서 보관 구조 정리 및 HTML PR Actions 연동

| 역할 | 문서 |
|---|---|
| Venus | [문서 보관 구조 분석](issues/132/Venus/analysis.md) — 인벤토리·경로 규약·참조 무결성·집행 결과 |
| Mars | [GitHub Actions 도입 보고](issues/132/Mars/report.md) — CI 잡 구성·도구 경로 갱신 |

이 Issue가 만든 것은 두 가지다.

1. **문서 보관 구조** — `docs/qa/` · `docs/art/` · `docs/` 루트에 흩어져 있던 342개 추적 파일을 버전 → Issue → 역할로 재배치했다. 이동 306 · 유지 36 · 삭제 0. 대조표는 [MOVES.md](../MOVES.md)와 [MOVES.csv](../MOVES.csv)에 있다.
2. **PR Actions 연동** — `.github/workflows/ci.yml`의 규칙 회귀·서버·문서 링크·자산 무결성 검사. 사용법은 [CONTRIBUTING.md](../../../CONTRIBUTING.md)에 있다.

## 별도 소유로 진행 중인 작업

| Issue | 제목 | 상태 |
|---|---|---|
| [#118](https://github.com/ChangjoSung/Digit-Duel/issues/118) | Roblox 포팅 Phase 1 — 코어 룰 엔진·서버 권위 구조·클라 스캐폴드 | `feature/118-roblox-port` 브랜치에서 별도 소유로 진행. 이 Issue의 문서는 그 작업의 소유자가 보존하며 이번 재배치 대상이 아니다 |

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

**아직 정해지지 않은 것**: `#123`·`#124`가 만들 새 아트 데이터를 v0.4.3의 [`assets/minions/`](../v0.4.3/assets/minions/)에 추가할지, v0.4.6에 새 `assets/`를 열지는 아트 범위가 확정된 뒤에 정한다. 지금 결정할 필요가 없어 미뤄 둔 사항이며 이번 Issue의 승인을 막는 항목이 아니다.

## 폴더 규약

이 마일스톤도 [보관소 규약](../README.md#폴더-규약)을 그대로 따른다 — `specs/` · `reports/<역할>/` · `issues/<번호>/<역할>/`.
