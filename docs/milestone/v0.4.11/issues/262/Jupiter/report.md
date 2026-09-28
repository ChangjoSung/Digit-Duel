# #262 Jupiter(서버) 보고 — 경기 중 이모티콘 서버 경계

2026-09-27 · Jupiter(Claude Opus 5.5 · high · bypass, PID 43168, JSONL `dfbe2596-1404-4730-9c79-ac4a0e90da05`) · task_2c46d4b8ff9d / ctx_18ff9a203a03 · Ponytail full
진행: 모델 preflight ask → GO_READONLY → 코드 추적·wire 제안 ask → PD GO_IMPLEMENT(peerConnected 추가 지시) → 구현·테스트. Git·GitHub·Notion 쓰기 없음.

## 1. 확정 — 구현한 wire 계약 (PD 채택안)

| 방향 | 프레임 |
|---|---|
| C→S | `{v:1,t:'emote',requestId,seatToken,tokenGen,id}` — id ∈ `hello·nice·wow·think·oops·gg` (`protocol.js` `EMOTE_IDS`) |
| S→보낸 쪽 (성공) | `{v:1,type:'emote',epoch,roomId,from,id,requestId,cooldownMs:5000}` · `seq` 없음 |
| S→상대 (성공) | `{v:1,type:'emote',epoch,roomId,from,id}` · requestId·seq 없음 |
| S→보낸 쪽 (거부) | `{v:1,type:'emote_result',ok:false,requestId,code,retryMs?}` · `seq` 없음 · 일반 `error` 아님 |
| 재접속 | `room_resumed.emoteRetryMs` (남은 ms, 0=가능) |
| 상대 연결 | 첫 프레임(`room_opened/joined/resumed`)·`room_state` 푸시·명령 응답에 `peerConnected` (상대 좌석 connected + 소켓 OPEN, 보낼 때 계산 — 중복 제거 캐시에 넣지 않음) |

거부 코드(기존 ERROR_CODES만, 신규 코드 없음): `E_BAD_ENVELOPE`(허용 밖 id, 값 미반환) · `E_SEAT_TOKEN_INVALID` · `E_TOKEN_GEN_STALE` · `E_ILLEGAL_ACTION`(OPEN·CANCELED·VOID·CLOSED) · `E_PAUSED`(상대 미연결 — 경기 전·중 단절, 결과 화면 이탈 포함) · `E_RATE_LIMITED`+`retryMs`.
판정 순서: 상태 → 상대 연결 → 쿨다운. 거부는 쿨다운(`seat.emoteAt`)을 바꾸지 않는다.
기존 동작 유지: 밀려난 소켓(connGen) close 4001 무응답 · `E_SESSION_ENDED` · 방 없음 `E_ROOM_CLOSED` · 봉투 불량(requestId 등 누락)은 일반 `error`+seq. 로비 전용 소켓의 emote 는 무응답.

## 2. 변경 파일

| 파일 | 내용 |
|---|---|
| `server/authoritative/protocol.js` | `emote` 명령 추가, `EMOTE_IDS`·`isEmoteId` export. id 는 봉투에서 보지 않음(전용 응답으로 거부) |
| `server/authoritative/room.js` | `EMOTE_COOLDOWN_MS=5000`, 좌석 `emoteAt`(뷰·재생·DB 미포함), `peerConnected()`, `emote()`, `emoteRetryMs()` |
| `server/authoritative/server.js` | 토큰 거부를 emote 는 `emote_result`로, 인증 뒤 `sendEmote`(dedup·handleCommand·revision·seq·pushState 미경유), `peerConnected` 3곳, `emoteRetryMs` |
| `server/authoritative/test/test-issue262-emotes.js` | 신규 — 단위 + 실제 WS |
| `server/package.json` | `test:emotes`, `test:authoritative` 체인 끝에 추가(CI `npm test` 가 자동 포함) |
| `server/README.md` | 이모티콘 계약 절·`npm run test:emotes` 한 줄 |

## 3. 검증 (각 1회, 재실행 사유 기록)

- `test-issue262-emotes.js` 최종 **64 passed, 0 failed**. 앞선 두 번은 테스트 자체 오류로 실패해 테스트만 고쳤다(제품 코드 변경 없음):
  ① A3 가 끊긴 좌석을 거꾸로 골랐다(좌석1 소켓을 닫고 좌석1이 보냄 → 상대인 좌석0은 연결). ② 무료 로스터 경기의 기권은 차례인 좌석만 가능한데(`E_NOT_ACTOR`) 호스트 고정으로 보냈다 — 첫 실행은 우연히 호스트 차례라 통과, 둘째 실행 실패 → 차례 좌석이 기권하도록 수정.
- 덮는 항목: 6종 양쪽 전달·필드 화이트리스트(상대 사본 requestId 없음) · 틀린 id 10종(`'HELLO'`,`'hello '`,`''`,7,null,{},[..],`'__proto__'`,4000자,누락) 거부·원문 미반환·쿨다운 미소모 · 10연타 `E_RATE_LIMITED`+retryMs·쿨다운 미갱신 · 위조 토큰/지난 tokenGen 전용 응답·seq 불변 · 상대 단절 `E_PAUSED`·`peerConnected=false` 푸시 → 재접속 `emoteRetryMs`·쿨다운 유지·전송 재개 · 밀려난 소켓 전송 무시 · 시작 상점(SETUP) · 경기 중 내 차례/상대 차례(IN_PROGRESS) · 결과(FINISHED) 둘 다 연결 시 성공 / 상대 leave 뒤 `E_PAUSED` · OPEN `E_ILLEGAL_ACTION` · VOID·CLOSED·CANCELED 단위 거부 · 로비 소켓 무응답 · 매 성공·거부 전후 `revision`·state·좌석 seq·dedup 크기·게임 시계(_clock/_act/_pick/_bclock)·두 엔진 상태 동일.
- 기존 `test:authoritative` 22개 스위트 각 1회 전부 통과(runtime-contract 74 … #261 lobby 53, 실패 0). 릴레이용 `test.js`·`test-security.js`·`test-config.js`·`test-launcher.js`·`test-static-load.js`·`test-db.js`는 변경 파일과 무관해 돌리지 않았다.
- 클라이언트·서버 ID 대조 1회: `demo/js/ui.js` `EMOTES` = `hello,nice,wow,think,oops,gg` = 서버 `EMOTE_IDS` (순서 포함 일치).
- 실행 환경: `NODE_PATH`=issue-260 작업 트리 `server/node_modules`(ws) 읽기 전용 재사용, npm install 없음. DB·SMTP·계정 없음. 테스트 서버는 임의 포트 in-process, 스스로 종료(남은 node 프로세스 없음 확인). 기존 8083/PG55461/8082/8081 미접촉.

## 4. 한계 (확정/추론 구분)

- [확정] 계정 서버(DB)의 좌석-계정 바인딩 재접속 경로는 이 테스트에서 돌리지 않았다 — emote 는 그 뒤 단계라 기존 #259 테스트가 맡는다.
- [확정] 정기 상점·가방·전투(B01~B08)는 서버에서 모두 `IN_PROGRESS` 한 상태라 서버 판정은 같다. 이 테스트는 무료 로스터 경기로 IN_PROGRESS 를 실제 명령 경로로 만들었고, 경제 방 경기 중 단계별 실전 흐름은 돌리지 않았다.
- [확정] 쿨다운 경과는 5초 대기 대신 `seat.emoteAt` 을 테스트가 직접 되돌려 재현했다.
- [추론] 소켓당 메시지 빈도 제한은 기존에도 없다. 거부 응답은 상태를 바꾸지 않는 작은 프레임이라 새로 두지 않았다(필요해지면 소켓 토큰 버킷).
- [미확정] Mars 클라이언트·typecheck·CI·실서버 브라우저 스모크는 Mars/Saturn 범위라 여기서 검증하지 않았다.
