# #293 CJ QA REVISE(2026-10-01) — Jupiter 서버 구현 보고

- 역할: Jupiter(SERVER · IMPLEMENT · code/docs · instance null) · Claude `claude-opus-5-5` · Ponytail full · dispatch `ctx_0796912263bf` / task `task_68aa4dda2654`
- 기준: 계약 커밋 `8594d27` — [구현 계약](../Venus/implementation-contract.md) 1장·2장·3.2 · [CJ 원문](../references/CJ_QA_REVISE_20261001.md)
- 상태: 구현 보고입니다. Saturn QA PASS · 병합 승인이 아닙니다. Git 명령은 실행하지 않았습니다.

## 1. 바뀐 것 (서버)

| CJ 항목 | 파일 | 내용 |
|---|---|---|
| 1 준비 180초 | `server/authoritative/room.js` | 방에 하나인 `_prep {deadline, handle, expired}`. `_openEconomy` 에서 **한 번** 서고(`now + ECO.prepSec`) 상점 완료·배치·준비·준비 취소·단절·재연결 어디서도 다시 서거나 멈추지 않습니다. 종전 좌석 시계 `shop:0`·`place` 와 `shopTimedOut` 표식은 삭제했습니다. 정기 상점·B08·행동·대상 선택·전투 시계와 그 단절 정지는 그대로입니다. |
| 1 만료 | 같은 파일 `_onPrep` | 좌석마다: 상점 미완료 → Core `shopTimeout`(보충 새로 고침 1회는 Core 담당) → `_autoPlace`. 상점 완료 → 이미 보낸 배치·준비는 그대로 두고 남은 것만 자동 배치. 두 좌석 준비 → 기존 `_handleReady` 가 개시. 개시에 이르지 못하면 fail-closed(VOID). 단절 유예 중에도 만료됩니다. |
| 1 입력 | 같은 파일 | 마감 뒤 준비 구간 입력(배치·준비·준비 취소·상점 거래) = `E_DEADLINE`. 단절 중 입력 = `E_PAUSED` 그대로(잠금 해제 없음). |
| 1 전송 | 같은 파일 `_clockView` | 경기 전: `clock:{key:"prep", leftMs, running:true, deadline, serverNow}` — 양 좌석 `deadline` 동일. 테스트 주입 옵션은 `placeMs` → `prepMs`. |
| 2 단계 공개 | 같은 파일 `_seatView` | 경기 전 뷰에만 `seats.step:[좌석0,좌석1]` = `shop`/`place`/`done`. 상대의 구매·진열·코인·필드·가방·시너지는 그대로 비공개. |
| 6 상대 HP·등급 | 같은 파일 | 정체 공개된 상대 보드 말(`_serializeKnownOpponent`)과 결과(`_finalView` 필드·가방) = 실제 `hp`/`maxHp` + `grade`(하수인 정수 · 왕·동료 `null`). 100 눈금(`pct100`) 삭제. 미공개 말은 위치·생존만(변경 없음). 상대 동료 역할을 가르는 새 필드는 만들지 않았습니다. |
| 6 회복 로그 | `server/authoritative/engine.js` | `installHealLogScale` 삭제 — Core `healLogs` 의 실제 값 그대로. |

## 2. 테스트 파일 (기존 파일만 · 대체된 기대값 치환)

| 파일 | 치환한 옛 기대값 |
|---|---|
| `test-issue263-timers.js` | S01 90초 + 배치 90초 · 준비 중 정지 · 준비 구간 단절 정지 → 공통 `prep` 마감(전이·재연결 뒤 불변 · 양 좌석 동일 · 단절 중 만료 시 양 좌석 자동 개시 · `E_DEADLINE`/`E_PAUSED`) |
| `test-issue237-economy.js` | 좌석별 상점 시계·단절 정지 → `prep` · `seats.step` 파생 · 상대 100 눈금/등급 비공개/회복 로그 % → 실제 값 + 등급 · 만료 푸시 2회 → 방 만료 1회 |
| `test-issue238-lobby.js` | "S01 90초 시작" → 준비 180초 · FINISHED 말판 "등급 없음" → 등급 공개 |
| `test-issue292-art.js` | 공개 상대 전설 "등급 없음" → 실제 등급·HP (원시 `legend` 비노출은 그대로) |
| `test-authority-rules.js` | 변경 없음 |
| `test-combat-stats-boundary.js` (Mercury 승인 추가) | 상대 보드 말 "등급 없음" → 공개된 말만 엔진 등급 · 미공개는 그대로 금지 |

진열 번호·SOLD OUT 단언은 지우지 않고, 만료가 곧바로 개시해 진열이 닫히므로 자동 배치 직전 값을 떠서 같은 기대값으로 봅니다.

## 3. 검증

Mercury 가 승인한 6개 명령을 `server/` 에서 각 1회 실행했습니다(Mars Core 준비 통보 뒤).

| 명령 `node authoritative/test/…` | 결과 | exit |
|---|---|---|
| `test-issue263-timers.js` | 147 passed, 0 failed | 0 |
| `test-issue237-economy.js` | 170 passed, 0 failed | 0 (2회째) |
| `test-issue238-lobby.js` | 81 passed, 0 failed | 0 (2회째) |
| `test-issue292-art.js` | 48 passed, 0 failed | 0 |
| `test-authority-rules.js` | 177 passed, 0 failed | 0 |
| `test-combat-stats-boundary.js` | 547 passed, 0 failed | 0 |

- 237·238 의 1회째는 exit 1 이었습니다 — 이 WorkTree 에 `node_modules` 가 없어 `Cannot find module 'ws'`(단언 실패 아님). 원본 checkout 의 `server/node_modules` 를 `NODE_PATH` 로 **읽기만** 해서 그 두 파일만 1회 다시 돌렸습니다(설치·파일 변경 없음). 총 실행 8회.
- `test-combat-stats-boundary.js` 는 Mercury 승인으로 한 곳만 고쳤습니다: 공개된 상대 말의 `grade` = 엔진 값, 미공개 말의 `grade` 와 다른 금지 키는 그대로.
- 미실행: 전체 `npm test` · 데모 smoke(Mars 소관) · 브라우저 · 실제 네트워크 수동 검증.

## 4. 남은 것 · 주의

- `ECO.prepSec` · 만료 보충 새로 고침(4.3) · 판매 가드(4.2) · 왕·동료 집계는 Mars Core 소관입니다. 서버는 `shopTimeout` 을 좌석별로 넣기만 합니다.
- 준비 만료는 방에 하나라 `onUpdate` 푸시가 좌석별 2회에서 1회로 줄었습니다(한 번이 양 좌석에 나갑니다).
- 종전 무료 로스터 방(경제 아님)의 공개 상대 말에도 `grade` 키가 실립니다(값은 엔진 값 그대로).
