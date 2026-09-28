# #238 CJ 8항목 — 대기방 준비·시작·재대전 서버 계약 (Jupiter, 2026-09-28)

근거: [cj-revise-8-items.md](../Mercury/cj-revise-8-items.md) 3·8항 + PD 기술 기본값. 이전 "두 번째 입장 즉시 시작 상점" 계약을 대체한다.
구분: [확정]=CJ·PD 지시 · [추론]=Jupiter 최소 해석(PD 검토 대상).

## 1. 방 상태

| 상태 | 뜻 | 들어오는 전이 |
|---|---|---|
| OPEN | 방장 혼자 | 방 생성 |
| **WAITING** (신규) | 두 좌석이 앉은 경기 전 대기방 | 두 번째 참가 · 두 좌석 모두 결과에서 복귀 |
| SETUP | 시작 상점(S01)·배치 | 방장 시작 뒤 서버 5초 완료 |
| IN_PROGRESS / FINISHED | 기존 그대로 | 기존 그대로 |

- [확정] 두 번째 참가는 WAITING 으로 간다. 시작 상점을 자동으로 열지 않는다.
- [확정] S01 90초는 5초 카운트다운이 끝나 상점이 열린 순간부터 흐른다.
- [확정 · 최신 3항 2026-09-28] 대기방 나가기는 역할별이다 — 아래 §4b. 단절 60초 유예 만료 = 방 취소(기존 그대로).
- [추론] 아무도 복귀하지 않은 FINISHED 방은 기존처럼 5분 뒤 정리된다. **한 좌석이라도 복귀하면 5분 정리를 풀고**, 그 뒤 어느 좌석이 끊기면 단절 60초 유예 → 만료 시 방 닫힘(closed → 방 목록). 복귀한 좌석을 조용히 닫지 않는다.

## 2. 명령 (좌석 토큰 봉투 — `ready` 와 같은 모양, 추가 필드 없음)

| t | 누가 | 언제 | 거부 |
|---|---|---|---|
| `lobby_ready` | 참가자(좌석 1) | WAITING | 방장 `E_NOT_ACTOR` · 그 밖 상태 `E_ILLEGAL_ACTION` |
| `lobby_unready` | 참가자(좌석 1) | WAITING (카운트다운 중이면 취소) | 위와 같음 |
| `lobby_start` | 방장(좌석 0) | WAITING · 참가자 준비 · 두 좌석 연결 | 참가자 `E_NOT_OWNER` · 조건 불충족 `E_ILLEGAL_ACTION` |
| `lobby_return` | 양 좌석 | FINISHED | 그 밖 상태 `E_ILLEGAL_ACTION` |

- 이미 같은 값이면(준비 중 다시 준비, 카운트다운 중 다시 시작) 성공 noop — 카운트다운을 **연장하거나 다시 시작하지 않는다**.
- 카운트다운 취소: 참가자 준비 취소 · 어느 좌석이든 단절(참가자 단절은 준비도 해제) · 나가기 — 방장 나가기 = 방 파괴(CANCELED), 참가자 나가기 = 좌석만 비우고 OPEN 유지(§4b).
- 카운트다운 완료 시 서버가 조건(WAITING·준비·두 좌석 연결)을 다시 보고 SETUP 으로 넘긴 뒤 양 좌석에 `room_state` 를 푸시한다.
- 기존 배치 준비 `ready`/`unready` 는 SETUP 전용 그대로다(대기방 준비와 별개 명령).
- **경기 번호 경계 (2026-09-28 후속 수정)**: 모든 좌석 명령은 `round`(정수, 받은 뷰의 값)를 싣는다. 운영 방(로비가 만든 `startGate` 방)은 `round` 가 **빠지거나 다르면** `E_STALE_REVISION`(+ 최신 뷰 `data`)으로 거부한다 — 예외는 복구 경로 `resync`·`leave` 뿐이다. 정수가 아니면 `E_BAD_ENVELOPE`. server.js 는 이 판정(`room.roundStale`)을 좌석 토큰 인증 뒤·**중복 제거 조회 전**에 하므로 지난 경기의 저장 응답이 재전송되지 않고, 거부 프레임은 저장하지 않는다. 새 경기의 S01 진열 번호·턴은 0 부터 다시 서고 경제 거래는 revision 을 보지 않으므로, 지난 경기 거래는 이 경계로만 구별된다. `round` 생략은 `startGate` 없이 직접 만든 Room(단위 테스트 픽스처)과 `lobby.startGate=false` 회귀 서버에서만 허용된다. network.js 는 새 방(room_opened/joined)에서 `NET.round=0` 으로 되돌린다. 이모티콘(`emote`)은 게임 상태를 바꾸지 않는 별도 경로라 round 를 보지 않는다.

## 3. 좌석 뷰

WAITING (또는 FINISHED 에서 이미 복귀한 좌석):

```js
{ seat, state: 'WAITING', phase: 'waiting', revision, round, current: null,
  seats: { ready: [false, false] }, units: [], you: { placed: false }, result: null, economy,
  lobby: { guestReady: bool, countdownMs: number | null, peerInResult: bool } }
```

- `countdownMs`: 보낸 순간의 남은 ms. 받은 시각부터 로컬로 줄여 표시만 한다(판정은 서버).
- `peerInResult`: 상대가 아직 결과 화면에 있다 — 준비·시작 불가 표시.
- **모든 뷰에 `round`** (이 방의 경기 번호, 5초 완료마다 +1). 값이 바뀌면 클라이언트는 경기별 상태(fx 커서·결과·final·보드)를 비운다.
- 로비 목록 행: `state: 'WAITING'`, `seats: '2/2'` (참가 불가 — `p-` 참가는 OPEN 만).
- FINISHED 뷰(복귀 전)는 기존 그대로: `units` = 살아 있는 상대 말 전체 공개(위치·정체 · 등급·미사용 스킬 없음 · 전투 안 한 말 HP 100 눈금) + `final` 블록. 결과 카드 아래 최종 말판은 이 값을 그대로 쓴다.

## 4. 재대전·기록 불변식

- 같은 방 번호·이름·좌석·좌석 토큰·계정/닉네임/대표 하수인(입장 때 고정)을 유지한다.
- 복귀 시 매 경기 상태를 비운다: 엔진·결과·fx·별칭·모달 소비 번호·배치/준비·S01 시간 초과 표식·대기방 준비·**중복 제거 저장 응답**(지난 경기 응답을 새 경기에 재전송하지 않는다). `revision`·`seq` 는 이어서 간다. 지난 경기의 배치·준비·행동·대기방 명령은 `round` 경계와 `revision` 으로 `E_STALE_REVISION` 이 된다.
- 전적: 경기마다 새 `matchId`, 행 키 `(match_id, account_id)` `ON CONFLICT DO NOTHING` — 경기별 1회, 덮어쓰기·중복 없음. 기존 기록·계정은 건드리지 않는다.
- 방장이 결과에서 나간 뒤 참가자가 복귀하면(또는 반대 순서) 방을 닫는다(`phase:'closed'` → 기존 방 목록 경로). 참가자 나가기는 §4b.

## 4b. 대기방 나가기 — 역할 구분 (최신 3항, 2026-09-28 CJ · 공개 운영 방 `startGate`)

새 메시지 타입 없음. 명령은 기존 `leave`(round 불필요).

| 누가 · 언제 | 서버 처리 | 방장 화면(푸시) | 떠난 좌석 |
|---|---|---|---|
| 참가자 · WAITING(카운트다운 포함) | 카운트다운·준비 해제, 좌석 1 비움 → **OPEN**(revision+1) | `state:'OPEN'`·`players[1]=null`·`peerConnected:false`, 목록 `1/2` | 응답 `phase:'closed'` 뒤 서버가 소켓 닫음 |
| 참가자 · FINISHED(결과 중 또는 먼저 복귀) · 방장 결과 중 | 좌석 1 비움, 방 상태·결과·revision 불변, 새 참가 불가 | 같은 FINISHED 뷰 + `peerConnected:false`(상대 이름 유지) | 위와 같음 |
| 참가자 · FINISHED · 방장 이미 복귀 | 좌석 1 비움 → 즉시 **OPEN** | OPEN 푸시 | 위와 같음 |
| 방장 복귀(`lobby_return`) · 참가자 이미 나감 | 빈 방 **OPEN** | 응답 OPEN | — |
| 방장 · WAITING | 기존 방 취소(CANCELED) | — | 참가자 푸시 `canceled` |
| 방장 · 대기방 복귀 뒤(참가자 결과 중) | 방 파괴(CLOSED) | — | 참가자 푸시 `closed`·소켓 닫힘 |

- 좌석 비우기 = 좌석 객체 교체: 좌석 토큰·계정/닉네임/대표·소켓 매핑·준비·이모티콘 쿨다운·그 좌석의 중복 제거 응답이 사라진다(결과 중 방장 화면용 닉네임·대표만 방장 복귀 때까지 유지). 방 번호·이름·round·방장 좌석은 그대로.
- 옛 참가자 차단: 재개 토큰은 `E_SEAT_TOKEN_INVALID`. server.js 는 소켓에 입장 당시 좌석 자격 객체(`ws.ddSeatCred`)를 기록하고 메시지·close 처리에서 동일성을 본다 — 새 참가자의 connGen 번호가 겹쳐도 옛 소켓의 늦은 close·명령이 새 참가자를 끊거나 움직이지 못한다. 떠난 좌석의 leave 응답은 중복 제거 표에 남기지 않는다.
- 유지: IN_PROGRESS 나가기 불가·기권, SETUP(시작 상점 90초 포함)·OPEN 나가기 = 취소, 단절 60초, 난수·30/60/20 시계, 이모티콘, 결과 정보 경계, 경기별 기록 멱등.
- [추론] 비공개(초대 코드) 방은 코드 재발급 UI 가 없어 기존 취소 그대로다. Mars 계약: `NET.roomState==='OPEN'` 이면 상대 없음(지난 `players/reps` 상대 칸 무시).

## 5. 운영 전환 스위치 (테스트 전용)

- `Lobby.startGate`(기본 true). `new Room()` 직접 생성은 기본 false(종전 즉시 시작) — 단위 테스트 픽스처 호환. 서버 in-process 회귀 중 종전 즉시 시작 흐름을 보는 파일만 `lobby.startGate = false` 를 둔다(test-authoritative·test-issue262-emotes·test-issue237-economy 11절). 운영 환경 변수는 추가하지 않았다.

## 6. 이모티콘

- WAITING 에서도 기존 6종 허용(두 좌석 연결 시). 서버 5초 간격 그대로. 자유 문자열 없음.
- 표시 2.5초·숨김은 클라이언트(Mars) 소관.

## 7. network.js API (현재 Mars 소유 — 클라이언트 통신·UI 모두 Mars, 2026-09-28 최신 담당. Jupiter 는 서버 계약만 준다)

- `window.netLobbyReady(flag)` · `window.netLobbyStart()` · `window.netReturnToRoom()`
- `NET.lobby = {guestReady, countdownMs, peerInResult, at}` (WAITING 뷰에서만, 그 밖 null) · `netLobbyCountdownLeft()` → ms | null · `NET.round`
- `NET.roomState === 'WAITING'` 이면 대기방 화면. 새 round 의 WAITING 을 받으면 network.js 가 경기별 클라이언트 상태를 비우고 `newGame("pvp")` 뼈대를 다시 만든다.

## 7b. 멀티 접속 인원 (CJ 추가 요청 2026-09-28)

- 모든 `lobby_rooms` 프레임(로비 전용 소켓·좌석 소켓의 `list_rooms` 응답)에 최상위 `onlineCount`: 0 이상 정수. 그 밖 모양·메시지 타입 변화 없음, 푸시 없음 — 기존 5초·수동 `list_rooms` 재사용.
- 값 = 지금 열린(readyState OPEN) 게임 서버 WS 중 유효 로그인 세션(폐기·만료 아님) 계정의 **고유** 수. 방 찾기·대기방·상점·배치·대국·결과 소켓 포함, 같은 계정 여러 소켓 = 1. 유예 중 단절 좌석(소켓 없음)·익명·오프라인 PVE 제외. 목록 요청마다 `wss.clients` 를 한 번 센다 — 타이머·DB·저장·신원 노출 없음.
- 방 찾기 소켓(`l-`)은 브라우저가 이미 보내는 세션 쿠키를 선택적으로 조회한다: 유효 = 집계, 쿠키 없음·무효·DB 장애·조회 중 폐기 = 종전과 같은 익명 읽기 전용. 방 찾기 소켓은 로그아웃·만료 때 `E_SESSION_ENDED`·4003 을 받지 않고 익명으로 남는다(좌석 소켓은 종전대로 끊긴다).
- Mars: `Number.isInteger(m.onlineCount) && m.onlineCount >= 0` 일 때만 숫자, 아니면·끊기면 `—`.

## 8. QA 기록 (Jupiter — 최신 3항 task_1f242d359dc9 · 접속 인원 task_75bd8184e77a · 실패 수정 뒤 해당 파일만 재실행)

| 검사 | 결과 |
|---|---|
| server/authoritative/test/test-issue238-lobby.js (§7 결과 중 나가기 기대값을 최신 3항으로 교체 · 참가자/방장 대기방 나가기 · 반복 입장 · 먼저 복귀 후 나가기 · 방장 복귀 빈 방 · 실제 WS 옛 소켓 종료·옛 토큰 재개 거부·같은 requestId 재사용·새 참가자 준비→시작) | 79 / 0, exit 0 |
| test-authoritative 50/0 · test-issue261-lobby 53/0 · test-issue262-emotes 64/0 · test-room 57/0 · test-security-gaps 104/0 | 모두 exit 0 |
| demo/test/integration/smoke_public_live.js 2 · smoke_public_eco_live.js | 23/0 · 47/0, exit 0 |
| (접속 인원) test-issue259-accounts.js §9 메모리 저장소 — 익명 제외·방 찾기 로그인 +1·같은 계정 3소켓 1명·대기방 입장·좌석 list_rooms 동일 값·유예 단절 제외·로그아웃(좌석 4003 · 방 찾기 유지)·만료 제외·조회 중 폐기 익명·DB 장애 익명 | 첫 실행 구문 오류(변수명 중복) → 124/1(IP당 연결 상한 8 초과로 DB 장애 연결 거부 — 테스트가 소켓을 늦게 닫음) → 소켓 정리 뒤 125/0 |
| (접속 인원) test-issue261-lobby 53/0 · test-issue260-profile 62/0 | exit 0 |
| smoke-issue259-pg.js(Postgres 필요)·전체 모음·typecheck | 실행하지 않음 — 계약 타입 변경 없음 |

8085·PG 재기동 안 함(PD 소관).

**이전 기록(요약 보존)** — 후속 수정 task_e1f0cf285594(round 필수·중복 제거 앞 경계): 238-lobby 59/0 · smoke_public_rooms 191/0 · smoke_public_live 2 23/0 · smoke_public_eco_live 첫 45/2(E8·E11b 원시 프레임 round 누락) → round 추가 뒤 47/0. 직전 구현 task_600512c72859: 238-lobby 46/0 · 261 53/0 · 262 64/0 · authoritative 50/0 · 260 62/0 · 259 111/0 · 237 144/0 · 그 밖 authoritative 17개 0 실패 · 241 72/2 → 74/0 · smoke_public_rooms 185/1 → 191/0 · typecheck 첫 실패(env.d.ts) → 통과 · smoke_issue238 84/2(Mars 시너지 칩 — 범위 밖). 로컬 8085 재기동(PD RESTART GO, 2026-09-28): 서버 pid 21664(09:46:09) · PG pid 38816(55462) 유지 · `/readyz` 200 · 마이그레이션 없음 · 비밀값·계정·SMTP 미열람.
