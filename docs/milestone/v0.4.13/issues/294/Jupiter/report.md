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
