# #294 Jupiter 보고 — 공개 보드 시계 `boardClock`

2026-10-02 · Jupiter(Server · Claude `claude-opus-5-5` high) · task `task_62a12395fbd3` / dispatch `ctx_c6f0285fc3fc` · 기준 `origin/milestone/v0.4.13` `39241d2`, 계약 [Venus 3장](../Venus/implementation-contract.md). **구현 보고이며 Saturn QA PASS · 병합 승인이 아닙니다.** Git 명령 0회.

## 변경 (확정)

| 파일 | 내용 |
|---|---|
| `server/authoritative/room.js` | `_boardClockView()` 신설(읽기 전용) + 경기 뷰의 `clock` 옆에 `boardClock` 한 줄. `_clockView` · `_tick` · `_syncClock` · `_want*` · 준비 180초는 한 글자도 바꾸지 않음 |
| `server/authoritative/test/test-issue263-timers.js` | 16절 추가(단언 16개). 기존 단언 수정 0 |
| `server/authoritative/test/test-issue237-economy.js` | 단언 2개 추가(정기 상점 `null` · B08 정지). `stable()` 비교기는 **수정하지 않음**(필요 없었음) |

## 전송 모양 (Mars 인계)

```
boardClock: { leftMs, running, deadline, serverNow } | null
```

- 원천: `[_pick, _act]` 중 흐르는 것, 없으면 앞의 것. `leftMs` = 만료 `0` / 흐름 `deadline − serverNow` / 정지 `left`. `running` = `deadline != null`. 정지 중 `deadline` 은 `null`.
- `key` · `owner` · 전투 60초 · 정기 상점 90초 · B08 20초 · 토큰 없음. 좌석 인자가 없는 함수라 두 좌석이 같은 시계를 읽음.
- 실리는 자리: 엔진이 있는 경기 뷰의 **경제 방**(`clock` 과 같은 조건). 정기 상점 · 종료(`FINISHED`)는 `null`. `SETUP` · 대기 · 보드 없는 종료 뷰에는 **키 자체가 없음** → 클라이언트는 `undefined` 와 `null` 을 모두 "없음"으로 다뤄야 함.
- 만료 직후 콜백 전 프레임: `leftMs:0` 이고 `running` 은 `true`, `deadline` 은 지난 시각(계약의 `running = deadline != null` 그대로).
- 타입 파일 `tools/typecheck/contracts.d.ts` 는 Mars 소유 — 건드리지 않음.

## 검증 (각 실제 실행 · `server/` 에서)

| 명령 | 결과 | exit |
|---|---|---|
| `node authoritative/test/test-issue263-timers.js` 1차 | 163 통과 · 1 실패 — **내가 새로 쓴 전제 단언의 오류**(전투 중 비행동자는 자기 멈춘 `act` clock 을 종전대로 봄). 제품 코드 무수정, 그 단언만 종전 규칙에 맞게 고침 | 1 |
| 같은 명령 재실행(영향받은 것만) | **164 통과 · 0 실패** | 0 |
| `node authoritative/test/test-issue237-economy.js` 1차 | `Cannot find module 'ws'` — 이 WorkTree 에 `server/node_modules` 가 없음(환경). 단언 실행 전 중단 | 1 |
| 같은 명령 + `NODE_PATH=C:\Users\pc_77\orca\Digit-Duel\server\node_modules`(원본 checkout 의 기존 설치를 읽기만) | **181 통과 · 0 실패** | 0 |

16절이 보는 것: SETUP 에 필드 없음 · 시간 고정 시 두 좌석 뷰가 통째로 같음 · 필드 넷뿐 · 상대 좌석 `clock`·`turn` 은 `null` 이고 명령은 `E_NOT_ACTOR` · 30ms 뒤 마감 불변·`leftMs` 감소 · 뷰 반복 생성 뒤 같은 객체·마감·타이머 핸들 · 단절 정지 값 보존 · 재연결 시 멈춘 값부터 · 마감 경과 프레임 `0`(턴·revision 불변) · 턴 전환 뒤 새 마감 · 종료 `null` · 대상 선택 시계 · 전투 중 멈춘 행동 시계(전투 60초 아님).

## 한계 · 미확정

- [확정] 비경제(`economy:false`) 방에는 `boardClock` 을 싣지 않음 — 기존 `clock` 과 같은 조건. 그 방에서 필요하면 별도 지시.
- [확정] 경제 테스트는 이 WorkTree 단독으로는 못 돎(`ws` 미설치). 설치·설정 변경은 하지 않았고 CI 는 자체 설치를 씀.
- [미실행] WebSocket 실송수신 · 브라우저 · 재접속 프레임 수동 확인 · 다른 서버 테스트(lobby·emotes 등) · typecheck. 재접속은 같은 `toSeatView` 경로라는 코드 읽기 + `resumeSeat` 뒤 뷰 단언으로만 봄.
- [추론] `serverNow`·흐르는 `leftMs` 는 뷰 생성 순간 값이라 좌석 간 몇 ms 차이 가능(계약 허용).

---

# #294 CJ REVISE 2 — 자기 말 상세 8스탯: `shieldStartPct` 소유자 전송

2026-10-02 · Jupiter(Claude `claude-opus-5-5` high · bypass · Ponytail full) · task `task_67b70d58834a` / dispatch `ctx_44286f3bfb8a` · HEAD `80341d3`. **구현 보고이며 Saturn QA PASS · 병합 승인이 아닙니다.** Git 명령 0회 · 클라이언트/Venus/Mars 파일 무수정.

## 변경 (확정)

| 파일 | 내용 |
|---|---|
| `server/authoritative/room.js` | `_serializeOwn` · `_serializeUnit` 에 `shieldStartPct` 한 칸씩(엔진 값 그대로, `|| 0` 없음) + 종전 "보내지 않는다" 주석 치환. 프로토콜·시계·액션·경제 동작 변경 0 |
| `server/authoritative/test/test-combat-stats-boundary.js` | 1절의 "미전송" 단언 → "엔진 값과 같음"으로 교체·강화(전 말 · 숫자 0 · 0.10 주입 · 예비 · 상대 프레임). 3절에 전투 프레임 키 부재 단언 추가. `NEVER_TO_OPPONENT` · `NEVER_IN_BATTLE` 은 그대로 |
| `server/authoritative/test/test-issue237-economy.js` | 8절(B08)에 단언 3개 — 소유자 가방·포획 말 = 엔진 값, 상대 프레임(`you` 제외)에 키 없음 |

## 전송 모양 (Mars 인계)

- 실리는 자리 다섯 곳, 모두 소유자 전용: `you.pieces[]`(SETUP/상점 · 경기), `you.reserve`, `you.eco.bag[]`, `bagPick.unit`(소유자일 때만 — 비소유자는 종전대로 `{owner}`).
- 값은 **0~1 비율**(0.10 = 최대 HP 10%)이며 퍼센트가 아니다. 엔진 실제 값: 하수인 = 아키타입 값(현재 guard 만 0.10, 나머지 0) · 왕/동료 0 · 폭탄/함정 0 · 포획 예비 0. 0 은 숫자 `0` 으로 온다.
- 기본값을 지어내지 않는다 — 엔진 객체에 필드가 없으면 키 자체가 없다(실제 엔진 경로는 항상 숫자를 넣는다).
- 싣지 않는 곳(변경 없음): 상대 보드 말(공개·미공개) · 전투 뷰 양쪽 전투원 · 종료 `final` · fx.
- 참고: `you.pieces[].cap` 은 종전부터 엔진 객체 그대로라 이 필드를 이미 담고 있었다(이번 변경 아님). `tools/typecheck/contracts.d.ts` 는 Mars 소유 — 건드리지 않음.

## 검증 (각 1회 실행 · `server/` · `NODE_PATH=C:\Users\pc_77\orca\Digit-Duel\server\node_modules` 읽기 전용)

| 명령 | 결과 | exit |
|---|---|---|
| `node authoritative/test/test-combat-stats-boundary.js` | **559 통과 · 0 실패** | 0 |
| `node authoritative/test/test-issue237-economy.js` | **184 통과 · 0 실패**(종전 181 + 3) | 0 |

재실행 0회. 남은 프로세스·임시 파일 없음(두 테스트 모두 자체 종료, scratchpad 미사용).

## 한계 · 미확정

- [미실행] 다른 서버 테스트 · typecheck · WebSocket 실송수신 · 브라우저. 범위 지시대로 영향받은 두 파일만 돌렸다.
- [미검증] 종전 "미전송" 단언을 옛 코드에 대고 실패시키는 역방향 실행은 하지 않았다 — 옛 코드에서 새 단언이 실패한다는 것은 코드 읽기 근거다(키가 없으면 `typeof === 'number'` 가 거짓).
- [추론] 현재 로스터에 guard 아키타입 종이 실제로 있는지는 확인하지 않았다 — 0.10 경로는 주입 픽스처로 검증했다.
