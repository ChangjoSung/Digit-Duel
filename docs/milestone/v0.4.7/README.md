# v0.4.7 — 기획 재정비·세로 UI·연출·외부망

[Milestone 13](https://github.com/ChangjoSung/Digit-Duel/milestone/13) · **진행 중**

이 마일스톤은 아직 끝나지 않았다. 아래 표에서 번호별 계획·구현·검수 상태를 구분한다. 정식 출시본은 [v0.4.5](../v0.4.5/README.md)이며, 개발판에 통합된 v0.4.7 규칙 변경과 CJ QA 수락은 각 Issue 및 아래 기록을 따른다.

## 선행 Infra

### [#132](https://github.com/ChangjoSung/Digit-Duel/issues/132) — [infra] 문서 보관 구조 정리 및 HTML PR Actions 연동

| 역할 | 문서 |
|---|---|
| Venus | [문서 보관 구조 분석](issues/132/Venus/analysis.md) — 인벤토리·경로 규약·참조 무결성·집행 결과 |
| Mars | [GitHub Actions 도입 보고](issues/132/Mars/report.md) — CI 잡 구성·도구 경로 갱신 |
| Mercury | [필수 검사 연결 기록](issues/132/Mercury/required-checks.md) — 2026-09-10 CJ 승인으로 dev·main에 Roblox E 추가, 총6개 |

PR #133 dev 통합·CI 5개 검사·Saturn PASS 후 CJ의 다음 Comment로 완료 수락했다. 최초 보호 경로 메타데이터 조회 예외는 보고서에 보존하며 무접근 기준 완전 충족으로 바꾸지 않는다. 2026-09-09 CJ 일정 변경 전 작성된 보고 본문의 v0.4.6은 당시 일정 표기다. 이 Issue가 만든 것은 두 가지다.

1. **문서 보관 구조** — `docs/qa/` · `docs/art/` · `docs/` 루트에 흩어져 있던 342개 추적 파일을 버전 → Issue → 역할로 재배치했다. 이동 306 · 유지 36 · 삭제 0. 대조표는 [MOVES.md](../MOVES.md)와 [MOVES.csv](../MOVES.csv)에 있다.
2. **PR Actions 연동** — `.github/workflows/ci.yml`의 규칙 회귀·서버·문서 링크·자산 무결성 검사. 2026-09-10 PR163의 Roblox E도 dev·main 필수 검사에 연결해 현재6개다. 사용법은 [CONTRIBUTING.md](../../../CONTRIBUTING.md)에 있다.

### [#134](https://github.com/ChangjoSung/Digit-Duel/issues/134) — demo/test·tools 구조 및 일정·개발자 표기 정리

Issue 전용 검증 파일은 버전·Issue별로, 공통 하네스와 지속 사용하는 도구는 용도별로 정리했다. 실행 경로·동적 검사 검색·CI와 현행 안내를 함께 갱신했다. Mars(Claude) 구현·Saturn 독립 QA·[통합 PR136](https://github.com/ChangjoSung/Digit-Duel/pull/136) dev 병합·필수 CI 5개 성공 뒤 2026-09-09 CJ QA PASS로 #134를 종결했다.

[검사 인덱스](../../../demo/test/README.md) · [도구 인덱스](../../../tools/README.md) · [경로표](issues/134/Mercury/MOVES.csv) · [PD 기록](issues/134/Mercury/report.md)

이번 CJ 결정으로 Roblox #118은 [v0.4.6](../v0.4.6/README.md)에 분리됐다. 기존 CJ 게임 이슈와 Infra의 소속·설명·문서 경로를 v0.4.7로 맞추며, README 게임 정보에 Roblox 포팅 담당 이욱채(lee775)를 추가했다.

## 착수한 범위 — #121 · #125 · #129

2026-09-09 CJ가 다섯 묶음을 승인하고 **"직접 선택으로 최종 진행. 구현 시작"**을 명시해 세 Issue를 함께 착수했다. 하나의 납품 목표이므로 [#121](https://github.com/ChangjoSung/Digit-Duel/issues/121)을 기준 Issue로 두고 통합 PR 1개로 관리했다. **통합 PR143이 `dev`(`2b47a23`)에 병합되고 2026-09-10 CJ 플레이 QA PASS를 받아 세 Issue를 CLOSED로 종결했다.** 다만 **릴리스는 아직 없다** — 정식 출시본은 여전히 v0.4.5다. 진행 상태는 각 Issue와 통합 PR이 원본이다.

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
| Mercury | [통합 기록](issues/121/Mercury/report.md) | 역할 보고 취합 · PR143 dev 병합 · CJ QA PASS 후 세 Issue CLOSED |

위 표의 각 보고서는 **작성 당시의 기록**이며, 종결 사실을 이유로 본문을 고치지 않는다.

진행 상태는 다음과 같다. 승인 범위의 개발 검증과 CJ 플레이 QA·출시를 구분한다.

| 단계 | 상태 |
|---|---|
| 제품 구현 (`demo/index.html`) | 세 Issue 범위 완료 · 검수 코드 `157026ba617166644ada0686b897d3ae2a166486`, HTML blob `4535791bbefd86ad829cdd436d4957f8a530846b` |
| 게임 안 튜토리얼 10단계·상황 도움말 | 새 탐색·기술·아이템/버프 규칙으로 갱신 완료 |
| 새 화면 캡처·manifest | [튜토리얼 10장 기록](issues/121/Mars/artifacts/capture-manifest.json) · [브라우저 검증](issues/121/Mars/artifacts/v047-browser-report.json) · [README 연결](../../../README.md#게임-플레이-사진) |
| Saturn 독립 QA | PASS — 검수 HEAD `c6b0162`, 후속 변경은 QA 기록·상태·링크 메타데이터 |
| CJ 플레이 QA | **PASS (2026-09-10)** — 세 Issue CLOSED |
| 통합 PR·CI | [PR143](https://github.com/ChangjoSung/Digit-Duel/pull/143) — `dev` 병합 결과 `2b47a23`가 원본 |
| 릴리스 | 미출시 — 정식 v0.4.5 유지 |

사용자용 안내는 [v0.4.7 릴리스 노트(개발 중·미출시)](../../releases/v0.4.7.md)에 있다. **현재 정식 출시본은 여전히 [v0.4.5](../../releases/v0.4.5.md)이며 플레이 기준 규칙도 v0.4.5다.**

## 이어서 착수한 범위 — #146 · #131 · #130 (종결) · #128 (종결)

2026-09-10 CJ가 도망 재설계·행동 없음 처리·텔레포트 제외·보호막 합산·튜토리얼 표시를 승인해 네 Issue를 함께 착수했다. **#146 · #131 · #130은 [#146](https://github.com/ChangjoSung/Digit-Duel/issues/146)을 기준으로 [통합 PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152)에서 관리해 2026-09-10 CJ 플레이 QA PASS로 CLOSED**했으며, 그 범위의 제품 코어·헤드리스·미디어·최종 README 렌더 Saturn PASS와 Chrome 81/0은 당시 검수 근거다. PR152는 그 세 Issue의 이력이다. **#128은 후속 CJ 승인으로 매 페이지 로드 표시를 구현하고 PR157로 dev에 통합했으며 2026-09-10 CJ 플레이 QA PASS로 CLOSED다.** 제품·Chrome 증빙은 Saturn PASS이며 최종 PR·CI·dev 통합은 [#128 통합 기록](issues/128/Mercury/report.md)을 따른다. 진행 상태의 최종 확정은 각 Issue와 그 Issue에 연결되는 PR이 원본이다. #128의 최초 신고 미재현과 후속 Worker 정리 절차 위반은 [PD 기록](issues/146/Mercury/report.md)에 작성 당시 그대로 보존한다. v0.4.7은 아직 미출시다.

| Issue | 제목 | 소관 | 계약 절 |
|---|---|---|---|
| [#146](https://github.com/ChangjoSung/Digit-Duel/issues/146) | 도망 재설계 · 쓸 수 있는 행동이 없을 때의 처리 | Venus(규격) · Mars(구현) | 1~2 |
| [#131](https://github.com/ChangjoSung/Digit-Duel/issues/131) | 함정에 걸린 하수인의 텔레포트 선택 차단·안내 | Mars | 3 |
| [#130](https://github.com/ChangjoSung/Digit-Duel/issues/130) | 연속 보호막 효과가 합산되도록 규칙 변경 | Mars | 4 |
| [#128](https://github.com/ChangjoSung/Digit-Duel/issues/128) | 튜토리얼 표시 — 매 페이지 로드 자동 표시로 정책 변경(2026-09-10 CJ QA PASS·CLOSED) | Venus(사용자 문서) · Mars(구현) | 5 · [문서 동기화](issues/128/Venus/docs-report.md) |

주요 계약: 도망은 **HP 무관 · 기본 성공률 30%**이고 실패해도 **상대의 추가 반격이 없다**(자기 전투 행동 1회 소모, 상대는 정상 차례) · **도망의 수호자**는 그 배틀 동안 성공률을 **70%로 치환**한다(가산 아님, 1회 보장 아님. 플레이어별 한 전투 1개·아이템 라운드 1회와 별도 회계는 #121 그대로) · 기술 4슬롯이 **전부** 쿨·봉인·조건 미충족이면 **기본 공격을 주지 않고** 지정 안내와 명시적 수동 대기만 두되 하나라도 합법이면 예외 없이 정상 커맨드이고 **왕·동료 본체의 기본 공격은 유지**하며 아이템·도망 등은 계속 선택 가능 · **함정에 걸린 말**은 텔레포트 양 끝 선택과 실행이 모두 차단되고 지정 2문구를 쓴다 · 보호막은 **남은 값 + 이번 기술의 기존 부여량**으로 합산하며 **새 상한·지속기간을 만들지 않는다** · **튜토리얼은 새 문서 로드마다**(URL 새 접속·새 탭·새로고침·브라우저 재실행 후 새 로드·LAN 서버 재시작 후 재접속) **이전 열람값과 무관하게 1단계부터 자동 표시**하고, 같은 열린 페이지의 새 게임·재대전·모드 변경·WS 복구·탭 복귀·BFCache 복원에는 **자동 재표시가 없다**. 완료·건너뛰기·Esc 즉시 닫기, 수동 `?` 다시 보기, 기존 10단계 내용은 유지하며 계정 도입·서버 재시작 시 저장 전체 삭제는 범위가 아니다.

**#128 경과와 현재 범위**: 앞선 확인에서 실제 Chrome의 **독립 `user-data-dir` 두 개·같은 HTTP origin**은 A·B 재방문과 완료 저장이 독립적으로 동작하고 `localhost`와 `127.0.0.1`도 분리됐다. 그 증빙의 B 최초 탭은 A 완료 전에 열고 A 완료 뒤 표시를 관측했으므로 첫 접속 순서까지 확대 해석하지 않는다. **처음 신고된 '다른 PC 사이의 공유' 증상은 미재현**이며, 그 시점에는 저장 로직을 바꾸지 않고 회귀·실브라우저 증빙만 추가했다(물리 2PC 검증이나 신고 버그 해결 PASS가 아니다).

이후 **CJ가 준 상세 증상은 같은 브라우저·같은 주소 재방문에서 자동 표시를 생략하는 기존 `localStorage` 정책으로 설명**되며, 그래서 원인 추적을 더 밀지 않고 **매 페이지 로드 표시로 정책을 바꾸는 쪽이 승인**됐다(2026-09-10, GDD-13 DL47). 이번 정책 변경은 처음 신고를 재현했거나 해결했다는 뜻으로 소급하지 않는다. 이번 구현의 HTML blob은 `8027cd72d8445c9a7077d0e43b1c5559645ee165`이며 제품·실브라우저 독립 검수와 PR157 dev 통합 후 2026-09-10 CJ QA PASS로 수락됐다. PR·CI·dev 통합은 [통합 기록](issues/128/Mercury/report.md)과 Issue128 연결 PR이 원본이다.

사용자 안내(README·릴리스 노트)에는 **새 접속·새로고침마다 표시 / 같은 게임 화면에서 자동 반복 없음 / 건너뛰기·Esc·수동 다시 보기**만 짧게 남기고, `localStorage`·BFCache·WS 복구 같은 구현 세부와 과거 미재현 경위·저장값 삭제 범위·캡처 재촬영 근거는 [#128 문서 동기화 보고](issues/128/Venus/docs-report.md)와 검증 기록에 둔다.

### 역할별 문서와 현재 상태

| 역할 | 문서 | 상태 |
|---|---|---|
| Venus | [v0.4.7 전투 행동 계약](issues/146/Venus/gameplay-spec.md) — 도망·행동 없음 패스·함정 텔레포트·보호막 합산·튜토리얼 독립성 | CJ 승인(2026-09-10) 계약 · 사용자 문서 동기화 완료. 5절(튜토리얼)은 이후 #128의 매 페이지 로드 표시 승인으로 대체됐으며, 계약 본문은 작성 당시 기록으로 남긴다 |
| Venus (#128) | [사용자 문서 동기화 보고](issues/128/Venus/docs-report.md) — 매 페이지 로드 표시 승인 반영 범위·문서 반영 위치 | 사용자 문서만 갱신 · 제품·테스트는 Mars 소관 |
| Mars (#128) | [제품·검증 보고](issues/128/Mars/report.md) · [Chrome26/0](issues/128/Mars/artifacts/i128-browser-report.json) | 매 로드 표시·회귀·브라우저·README 렌더 |
| Saturn (#128) | [독립 QA 기록](issues/128/Saturn/report.md) | 제품·브라우저·최종 문서 검수 |
| Mercury (#128) | [통합 기록](issues/128/Mercury/report.md) | 승인·검수·PR·CI·Notion 이관 기록 |
| Mars | [구현·검증 보고](issues/146/Mars/report.md) · [브라우저 검증 기록](issues/146/Mars/artifacts/i146-browser-report.json) | 제품·19종 회귀·Chrome81/0·튜토리얼10 촬영 |
| Saturn | [코어 검수](issues/146/Saturn/core-review.md) · [납품 검수](issues/146/Saturn/delivery-review.md) · [최신 delta](issues/146/Saturn/delivery-delta.md) · [초기 REVISE](issues/146/Saturn/initial-review.md) | 코어·미디어·최종 렌더 PASS, 후속 보고 문장 REVISE와 PD 정정 확인은 통합 기록 참조 |
| Mercury | [통합 기록](issues/146/Mercury/report.md) | 승인 계약·검수 근거·통합 상태 취합 |

| 단계 | 상태 |
|---|---|
| 제품 구현 (`demo/index.html`) | #146·#131·#130 범위의 검수·촬영 기준 `aa6998ae8d2ca8b5fc8136c5fa19bc6aca5c12ea`, HTML blob `2a9b54c769a58fc5c0db9e913ce4421bec6758e3` · **#128 표시 정책 변경 후 HTML blob `8027cd72d8445c9a7077d0e43b1c5559645ee165`** |
| 게임 안 튜토리얼 10단계·상황 도움말 | 도망30%/70%·수동 대기·함정 텔레포트·보호막 합산 반영, 실제 브라우저 확인. #128은 표시 시점만 바꾸므로 10단계 내용·캡처는 재촬영 대상이 아니다 |
| 새 화면 캡처·manifest | [튜토리얼10장·촬영 출처/해시](issues/146/Mars/artifacts/capture-manifest.json), 2224×1636·해시10/10 일치. README의 href/src20참조를 새146촬영본으로 갱신, 이전121자료 보존 |
| Saturn 독립 QA | 코어·헤드리스·미디어·최종 렌더 PASS. 후속 보고 정정과 자원 정리 절차 예외는 별도 기록 |
| CI·dev 통합 | #146·#131·#130은 [PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152)의 필수5검사·병합으로 `dev` 반영 완료 · **#128 최종 CI·병합 상태는 [통합 기록](issues/128/Mercury/report.md)과 연결 PR에서 확인한다** — [Issue #128](https://github.com/ChangjoSung/Digit-Duel/issues/128)이 원본이다 |
| CJ 플레이 QA | #146 · #131 · #130 · #128 **PASS (2026-09-10)** — 모두 CLOSED |
| 릴리스 | 미출시 — 정식 v0.4.5 유지 |

## 진행 중인 범위 — #122 · #124 · #126

CJ 후속 지시로 **세로 화면 · 왕/동료 아트 · 승패 효과**를 하나의 납품으로 구현하고 Saturn 독립 제품·미디어 검수 PASS를 받았다. **이후 CJ QA REVISE에 따라 좌상단 뒤로가기·어두운 배경을 보완했다. CJ 재검수와 출시는 대기다.** 세 Issue 모두 OPEN이다.

| Issue | 제목 | 소관 |
|---|---|---|
| [#122](https://github.com/ChangjoSung/Digit-Duel/issues/122) | 휴대폰 세로 화면 기준 HTML Design & Game Flow 개편 | Earth(아트) · Mars(구현) · Venus(흐름) |
| [#124](https://github.com/ChangjoSung/Digit-Duel/issues/124) | 동료·왕 Pixel Dot Design 추가 | Earth(원본) · Mars(게임 파생) |
| [#126](https://github.com/ChangjoSung/Digit-Duel/issues/126) | 전투 승리·패배 연출 강화 및 화면 흐름 연동 | Earth(스토리보드) · Mars(구현) |

범위 원본은 [CJ 후속 범위](issues/122/Mercury/cj-followup.md)이고, 세 Issue의 자료는 [#122 통합 문서](issues/122/README.md)에 모았다. 첫 납품 [PR160](https://github.com/ChangjoSung/Digit-Duel/pull/160)은 dev `2055d5a`에 통합했다. 최신 CJ QA REVISE의 [뒤로가기·어두운 배경 보완](issues/122/Mercury/revise-back-dark.md)은 `fix/122-back-dark-theme`에서 진행한다. 아래 역할 표·증빙은 PR160 이력이다.

| 역할 | 문서 | 상태 |
|---|---|---|
| Earth | [#122 v2 시안](issues/122/Earth/v2/report.md) · [#124 왕·동료 아트](issues/124/Earth/art-report.md) · [#126 스토리보드](issues/126/Earth/effect-storyboard.md) | 정적 아트 제안 납품 · CJ 최종 아트 승인 전 |
| Venus | [흐름 계약과 PD 실행 판단](issues/122/Venus/implementation-review.md) · [사용자 문서 동기화](issues/122/Venus/docs-status-report.md) | 소스 사실·PD 판단·수용 기준 정리 · 문서만 갱신 |
| Mars | [HTML·효과·자산·검증 보고](issues/122/Mars/report.md) | 구현·보완 납품 · Git 쓰기 절차 위반 별도 기록 |
| Saturn | [PD가 보관한 inline 독립 QA](issues/122/Mercury/report.md) | READ_ONLY 제품 PASS · 파일 수정0 · 검색 경계 예외 Task failed |
| Mercury | [통합 기록](issues/122/Mercury/report.md) | 소스·실제 화면·QA·CI·자원 정산 취합 |

| 단계 | 상태 |
|---|---|
| 아트 원고 | v2 보드·전투 SVG/PNG, 왕·동료 원본 2종, 효과 정점 그림 — 제안 상태 |
| 제품 구현 (`demo/index.html`) | REVISE 보완 제품 `21637d1` / HTML `2a2c26d` · 이전 PR160 제품 b3e077b/미디어 eeb2d11은 역사 자료 |
| 새 화면 캡처 | [실제 보드·전투·흐름](issues/122/README.md#revise-보완--실제-브라우저-화면) · [튜토리얼10 매니페스트](issues/122/Mars/media/capture-manifest.json) |
| Saturn 독립 QA · CJ 플레이 QA | PR160 Saturn PASS는 이력 · 최신 REVISE 보완 검수는 [PD 원장](issues/122/Mercury/revise-back-dark.md) · CJ 재검수 대기 |
| 통합 PR·CI · 릴리스 | 최신 CI6·dev 통합은 [REVISE 보완 기록](issues/122/Mercury/revise-back-dark.md) · PR160은 첫 납품 · 미출시, 정식 v0.4.5 유지 |

2026-09-10 CJ 추가 피드백과 명확화: 상대가 근처에 없을 때 수풀 속 말이 보이지 않는 기존 규칙은 유지한다. 수풀에서 보이는 내 말과 상대 말 모두 살짝 반투명하게 그리되 HP·선택 가독성은 유지한다. 현행 `visibleTo`·인접·`tempReveal`·정체·메모 규칙을 바꾸지 않는 표시 개선이다.

주요 계약: 전투 결과 배너 2500ms를 유지한 채 그 안에서 강한 효과를 약 1.1–1.2초 배분하고 **추가 대기를 만들지 않는다**. 전투 판정 동률은 방어자 승이며 전투 무승부 화면을 만들지 않는다. 로비 복귀·재대전은 **같은 문서 안**에서 하고 #128 튜토리얼 정책을 그대로 지킨다. 온라인 같은 상대 재대전 프로토콜은 이번 범위가 아니다.

## 등록된 나머지 범위 (착수 전)

| Issue | 제목 | 소관 |
|---|---|---|
| [#119](https://github.com/ChangjoSung/Digit-Duel/issues/119) | 공용 하수인 확장 기획 | Venus |
| [#120](https://github.com/ChangjoSung/Digit-Duel/issues/120) | 하수인 전체 속성 기술 분석·밸런스 및 기술 재등록 | Venus |
| [#123](https://github.com/ChangjoSung/Digit-Duel/issues/123) | 공용 하수인 전용 아트 디자인 추가 | Earth |
| [#127](https://github.com/ChangjoSung/Digit-Duel/issues/127) | 외부망 운영 전환 분석 — ChatGPT Sites·ngrok 비교 | Jupiter |

위 표는 아직 착수하지 않은 Issue만 남긴 것이다. 진행 중인 #122 · #124 · #126은 바로 위 절에, 종결한 #121 · #125 · #129 · #146 · #131 · #130 · #128은 그 앞 두 절에 있다. 소관은 [CLAUDE.md](../../../CLAUDE.md)의 역할 계약(영역 → 역할)에서 따온 것이며, 실제 배치는 PD 라우팅으로 확정된다. 게임 규칙을 바꾸는 나머지 항목(#119 · #120)은 CJ 승인 전까지 규격이 확정되지 않는다.

**아직 정해지지 않은 것**: `#123`이 만들 새 아트 데이터를 v0.4.3의 [`assets/minions/`](../v0.4.3/assets/minions/)에 추가할지, v0.4.7에 새 `assets/`를 열지는 아트 범위가 확정된 뒤에 정한다. #124의 게임 파생본4개와 매니페스트는 `demo/assets/leaders/`에 납품했으며 상세는 Mars 보고를 따른다.

## 폴더 규약

이 마일스톤도 [보관소 규약](../README.md#폴더-규약)을 그대로 따른다 — `specs/` · `reports/<역할>/` · `issues/<번호>/<역할>/`.
