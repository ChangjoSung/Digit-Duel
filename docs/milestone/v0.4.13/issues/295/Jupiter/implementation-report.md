# #295 Jupiter 서버 검증 보고 — 정기 상점 기본 180초 (2026-10-02)

역할 Jupiter · IMPLEMENT · Server · mutation docs,code · task_61f98addd2e0 / ctx_1df5183522fa. Ponytail full.

## 결과: 성공 — 런타임 결함 없음, 런타임 코드 무변경

## 확정 (코드 추적·실행으로 확인)

- 정기 상점 시한은 `server/authoritative/room.js` `_wantSeatClock` → `_ms('shop', T.ECO.shopSec)` 한 곳에서만 나온다. 서버에 90 하드코딩은 없다. Mars 가 바꾼 Core 상수(`demo/js/data.js` `ECO.shopSec:180`)가 그대로 서버 기본값이 된다.
- 좌석별 시계(`_clock[seat]`, 키 `shop:<turn>`) · 단절 정지/재개(`_tick` 의 `left` 보존) · 완료 좌석 시계 해제 · 만료 = Core `shopTimeout` 한 번 — 종전 그대로. 새 필드·타이머·프로토콜·의존성 없음.
- `ECO.prepSec` 180 무변경(방 공통 `_prep`, 상점 시계와 합치지 않음).

## 변경 파일

| 파일 | 내용 |
|---|---|
| `server/authoritative/room.js` | `_boardClockView` 주석의 낡은 "정기 상점 90초" → "180초(#295)" 한 줄. 실행 코드 무변경 |
| `server/authoritative/test/test-issue237-economy.js` | 7b 블록 추가(단언 7개). 기존 주입 60000·250 픽스처와 기존 단언·문구는 무변경 |
| `server/authoritative/test/test-issue263-timers.js` | 무변경(추가 불필요) |

## 추가한 회귀 (7b — `shopMs` 미주입, 벽시계 고정)

1. 개장: `ECO.shopSec===180`, 양 좌석 `left===180000`·`deadline===t0+180000`, 뷰 `leftMs===180000`
2. 90000ms(종전 마감): 거래 수락 · `leftMs===90000` · 상대 뷰 불변(비노출)
3. 단절: 양 좌석 시계 `deadline===null`·`left===90000`
4. 30000ms 뒤 재연결(유예 60000 안): `left===90000`, 마감 = 재개 시각 + 90000 (180000 으로 재설정되지 않음)
5. 179999ms: 거래 수락 · `leftMs===1`
6. 자기 완료: 자기 `_clock`·뷰 clock 만 null, 상대 마감·상점 유지
7. 180000ms 정각: `E_DEADLINE`·상태 불변 → `_onClock` 만료 → 상점 닫힘 · 코인·인벤·가방 그대로(확정 거래 유지 · 자동 구매 없음)

## 검증

| 명령 | 횟수 | 결과 |
|---|---|---|
| `node server/authoritative/test/test-issue237-economy.js` | 2 | 1회차 exit 1 — 테스트 실행 전 `Cannot find module 'ws'`(이 worktree 에 `server/node_modules` 없음). 2회차 exit 0 · **192 passed, 0 failed** |
| `node server/authoritative/test/test-issue263-timers.js` | 1 | exit 0 · **164 passed, 0 failed** |

2회차·263 은 `NODE_PATH=C:/Users/pc_77/orca/Digit-Duel/server/node_modules`(원본 checkout 의 기존 ws 8.21.3, 읽기 전용 참조)로 실행했다. 설치·의존성 추가·원본 checkout 수정 없음.

## 한계·미확정

- 실제 180초 벽시계 대기는 하지 않았다 — `Date.now` 고정 + `_onClock` 직접 호출(기존 263 관례)로 경계를 봤다. 실제 `setTimeout` 장착은 `deadline`/기존 250ms 픽스처(7절)가 본다.
- 전체 스위트·브라우저·네트워크·클라이언트는 범위 밖이라 실행하지 않았다. Git 명령 미실행(변경 전 통과 수 미대조).
- 모델 게이트: 실제 argv `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions`, 전사 기록 모델 `claude-opus-5-5`. 동일 argv 프로세스가 둘(PID 41024·22608)이라 세션 안에서 자기 PID 를 특정하지 못했고 TUI footer 는 세션 안에서 읽을 수 없다(조정자 측 기록). 전사: `C:\Users\pc_77\.claude\projects\C--Users-pc-77-orca-workspaces-Digit-Duel-issue-295-turn-shop\e50b0a3b-fffd-4f1c-ab28-c9612d76d323.jsonl`
