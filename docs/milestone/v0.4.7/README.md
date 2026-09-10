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

Issue 전용 검증 파일은 버전·Issue별로, 공통 하네스와 지속 사용하는 도구는 용도별로 정리했다. 실행 경로·동적 검사 검색·CI와 현행 안내를 함께 갱신했다. Mars(Claude) 구현·Saturn 독립 QA·[통합 PR136](https://github.com/ChangjoSung/Digit-Duel/pull/136) dev 병합·필수 CI 5개 성공 뒤 2026-09-09 CJ QA PASS로 #134를 종결했다.

[검사 인덱스](../../../demo/test/README.md) · [도구 인덱스](../../../tools/README.md) · [경로표](issues/134/Mercury/MOVES.csv) · [PD 기록](issues/134/Mercury/report.md)

이번 CJ 결정으로 Roblox #118은 [v0.4.6](../v0.4.6/README.md)에 분리됐다. 기존 CJ 게임 이슈와 Infra의 소속·설명·문서 경로를 v0.4.7로 맞추며, README 게임 정보에 Roblox 포팅 담당 이욱채(lee775)를 추가했다.

## 착수한 범위 — #121 · #125 · #129

2026-09-09 CJ가 다섯 묶음을 승인하고 **"직접 선택으로 최종 진행. 구현 시작"**을 명시해 세 Issue를 함께 착수했다. 하나의 납품 목표이므로 [#121](https://github.com/ChangjoSung/Digit-Duel/issues/121)을 기준 Issue로 두고 통합 PR 1개로 관리한다. **제품 구현과 튜토리얼 갱신을 마쳤으며 CJ 플레이 QA와 출시는 남아 있다.** 진행 상태는 각 Issue와 통합 PR이 원본이다.

| Issue | 제목 | 소관 | 계약 절 |
|---|---|---|---|
| [#121](https://github.com/ChangjoSung/Digit-Duel/issues/121) | [System] 탐색 패키지·공용 기술 및 선택 보상 개편 | Venus(규격) · Mars(구현) | 1~6·9 |
| [#125](https://github.com/ChangjoSung/Digit-Duel/issues/125) | 연출 템포 단축 — 2초 구간을 1.2초로 | Mars | 8 |
| [#129](https://github.com/ChangjoSung/Digit-Duel/issues/129) | 수풀 탐색 행동 완료 후 불필요한 턴 종료 지연 제거 | Mars | 7 |

주요 계약: 숲 두 구역에 아이템 선물 패키지·전투 버프 패키지·기술 교체/포획을 각 1개씩(전체 6개) · 보유 상한 해제와 시작 자원 변경 · 아이템은 라운드 1회만 제한 · 버프는 한 전투 1개 · 신규 공용 기술 3종(드래곤 숨결 30/CD3 · 마녀의 장난 18/CD3 · 사신의 낫)을 **플레이어가 직접 선택**해 4슬롯 어디든 교체 · 숲 포획은 ROSTER 20종을 그 종 그대로 · 탐색 완료 후 1.2초 뒤 한 번만 종료 · 연출 12종 1200ms.

**미확정 0건**: 마녀의 장난이 뽑는 "풀" 효과는 2026-09-09 CJ 답변으로 **이번 마녀 공격의 실제 HP 피해만큼 즉시 자기 회복**(보호막 흡수분·과잉 피해 제외, 최대 HP 상한)으로 확정됐다. 2라운드 지속 흡수가 아니다. 이후 PD가 계약의 적용 범위를 두 가지 정정했다 — 숲 포획의 "그 종의 실제 기술 그대로"에는 규칙이 읽는 로스터 정체에서 파생되는 **종별 지속시간·계수**까지 포함되고(전투 중 적 포획의 예비 70/100 공용 규격은 유지), 탐색 자리의 두 패키지는 **추가 확인 클릭 없이** 결과 연출 1.2초 뒤 조건부 종료로 간다. 결정 기록은 계약 11절에 있고, 보류하는 항목은 없다.

### 역할별 문서와 현재 상태

| 역할 | 문서 | 상태 |
|---|---|---|
| Venus | [v0.4.7 게임플레이 계약](issues/121/Venus/gameplay-spec.md) — 이벤트 배치·패키지 회계·버프 3종·기술 교체·신규 공용 기술 3종·숲 포획·탐색 종료·연출 템포·온라인/AI | 계약 확정 · PD 해석 정정 2건 반영 |
| Mars | [통합 구현 보고](issues/121/Mars/report.md) — 구현 범위·변경 파일·검사·롤백 | 제품·18종 회귀·브라우저·튜토리얼 촬영·보고 완료 |
| Saturn | [독립 QA 보고](issues/121/Saturn/report.md) | PASS · 제품 결함 6건 해소, 코드·문서·증빙 검수 완료 |
| Mercury | [통합 기록](issues/121/Mercury/report.md) | 역할 보고 취합 · PR143 · CJ 플레이 QA 대기 |

진행 상태는 다음과 같다. 승인 범위의 개발 검증과 CJ 플레이 QA·출시를 구분한다.

| 단계 | 상태 |
|---|---|
| 제품 구현 (`demo/index.html`) | 세 Issue 범위 완료 · 검수 코드 `157026ba617166644ada0686b897d3ae2a166486`, HTML blob `4535791bbefd86ad829cdd436d4957f8a530846b` |
| 게임 안 튜토리얼 10단계·상황 도움말 | 새 탐색·기술·아이템/버프 규칙으로 갱신 완료 |
| 새 화면 캡처·manifest | [튜토리얼 10장 기록](issues/121/Mars/artifacts/capture-manifest.json) · [브라우저 검증](issues/121/Mars/artifacts/v047-browser-report.json) · [README 연결](../../../README.md#게임-플레이-사진) |
| Saturn 독립 QA | PASS — 검수 HEAD `c6b0162`, 후속 변경은 QA 기록·상태·링크 메타데이터 |
| CJ 플레이 QA | 대기 — 세 Issue OPEN 유지 |
| 통합 PR·CI | [PR143](https://github.com/ChangjoSung/Digit-Duel/pull/143) — 최종 head의 필수 5개 검사·dev squash 결과가 원본 |
| 릴리스 | 미출시 — 정식 v0.4.5 유지 |

사용자용 안내는 [v0.4.7 릴리스 노트(개발 중·미출시)](../../releases/v0.4.7.md)에 있다. **현재 정식 출시본은 여전히 [v0.4.5](../../releases/v0.4.5.md)이며 플레이 기준 규칙도 v0.4.5다.**

## 등록된 나머지 범위 (착수 전)

| Issue | 제목 | 소관 |
|---|---|---|
| [#119](https://github.com/ChangjoSung/Digit-Duel/issues/119) | 공용 하수인 확장 기획 | Venus |
| [#120](https://github.com/ChangjoSung/Digit-Duel/issues/120) | 하수인 전체 속성 기술 분석·밸런스 및 기술 재등록 | Venus |
| [#122](https://github.com/ChangjoSung/Digit-Duel/issues/122) | 휴대폰 세로 화면 기준 HTML Design & Game Flow 개편 | Earth · Mars |
| [#123](https://github.com/ChangjoSung/Digit-Duel/issues/123) | 공용 하수인 전용 아트 디자인 추가 | Earth |
| [#124](https://github.com/ChangjoSung/Digit-Duel/issues/124) | 동료·왕 Pixel Dot Design 추가 | Earth |
| [#126](https://github.com/ChangjoSung/Digit-Duel/issues/126) | 전투 승리·패배 연출 강화 및 화면 흐름 연동 | Mars |
| [#127](https://github.com/ChangjoSung/Digit-Duel/issues/127) | 외부망 운영 전환 분석 — ChatGPT Sites·ngrok 비교 | Jupiter |
| [#128](https://github.com/ChangjoSung/Digit-Duel/issues/128) | 최초 튜토리얼 표시를 PC·브라우저별로 검증 및 수정 | Mars |
| [#130](https://github.com/ChangjoSung/Digit-Duel/issues/130) | 연속 보호막 효과가 합산되도록 규칙 변경 | Mars |
| [#131](https://github.com/ChangjoSung/Digit-Duel/issues/131) | 함정에 걸린 하수인의 텔레포트 선택 차단·안내 | Mars |

위 표는 아직 착수하지 않은 Issue만 남긴 것이다. 착수한 #121 · #125 · #129는 위 절에 있다. 소관은 [CLAUDE.md](../../../CLAUDE.md)의 역할 계약(영역 → 역할)에서 따온 것이며, 실제 배치는 PD 라우팅으로 확정된다. 게임 규칙을 바꾸는 나머지 항목(#119 · #120 · #126 · #130 · #131)은 CJ 승인 전까지 규격이 확정되지 않는다.

**아직 정해지지 않은 것**: `#123`·`#124`가 만들 새 아트 데이터를 v0.4.3의 [`assets/minions/`](../v0.4.3/assets/minions/)에 추가할지, v0.4.7에 새 `assets/`를 열지는 아트 범위가 확정된 뒤에 정한다. 지금 결정할 필요가 없어 미뤄 둔 사항이며 이번 Issue의 승인을 막는 항목이 아니다.

## 폴더 규약

이 마일스톤도 [보관소 규약](../README.md#폴더-규약)을 그대로 따른다 — `specs/` · `reports/<역할>/` · `issues/<번호>/<역할>/`.
