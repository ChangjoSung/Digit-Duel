# #293 CJ QA REVISE 4 — Jupiter(Server) 구현 보고

- 입력: [CJ_QA_REVISE4_20261002.md](../references/CJ_QA_REVISE4_20261002.md) 2항(수호자 🪙1→3) · 4항(상점 단절 뒤 방 나가기 잔상, Image 3). 계약: Venus/implementation-contract.md 9절 · AC 14~18.
- 역할: required_role=Jupiter · mode=IMPLEMENT · area=SERVER · mutation=code/docs · instance_index=null. 런타임: Claude `claude-opus-5-5` (effort high · bypass 는 Mercury 가 기동 인수·footer 로 확인 — 세션 안에서는 관측 불가). Ponytail full.
- 결과 요약: **서버 제품 코드 변경 0**. 기존 서버 테스트 1개 파일의 가격 기대값·픽스처만 CJ 대체분으로 고쳤다. 자체 QA PASS 판정은 하지 않는다(Saturn·CJ 플레이 QA 대상).

## 1. [확정] 4항 잔상의 원인은 클라이언트 전용 (Mars 소관)

- `demo/js/ui.js:1118-1134` `netLeave()` 가 `NET.pause`·`NET.pauseTimer` 를 지우지 않는다.
- `demo/js/network.js:1026` `netLeaveRoom()` → `netLeave()`(publicMode=false) → `netListRooms()` 가 로비 소켓을 다시 열며 `network.js:376` 에서 publicMode=true → `network.js:1221` `netResumeBarSync` 가 남은 `NET.pause` 로 "상대 연결 대기"를 로비 위에 다시 그리고 `xLock(true)` 로 화면을 inert 로 만든다. `NET.pause` 는 좌석 뷰(`network.js:641`)로만 갱신되는데 로비 소켓은 좌석 뷰를 받지 않으므로 스스로 풀리지 않는다. Image 3(방 목록 + 유예 53초 · 나가기 버튼 없음)과 일치.
- 클라이언트는 leave 전송 직후 소켓을 닫고 응답을 무시(`network.js:385` pubLive)하므로 서버 프레임으로는 고칠 수 없다. 수정은 Mars 의 `netLeave()` 정리 — Jupiter 는 중복 구현하지 않았다.

## 2. [확정] 서버 나가기 경로 (정적 추적 · 변경 없음)

| 단계 | 위치 | 확인 |
|---|---|---|
| 좌석 토큰 인증이 모든 명령보다 먼저 | `server/authoritative/server.js:569-572` | leave 포함 |
| 단절 정지 문은 leave 를 막지 않는다 | `room.js:737` | setup·ready·unready·resign 만 E_PAUSED |
| 경기 번호 경계 예외 | `room.js:762` | resync·leave |
| SETUP(시작 상점·배치) 나가기 = 취소 | `room.js:471-483` | `_publicLobby()` 분기(:474·:479)는 SETUP 에 해당 없음 → 방장·참가자 동일하게 `_finalize(CANCELED)` |
| 정리 | `room.js:695-705` | 카운트다운·게임 시계·양 좌석 단절 타이머 해제, 자격 폐기, 엔진 스케줄러 clear·engines=null |
| 응답 뷰 | `room.js:1354`·`:1900` | engines 없음 → pause=null |
| 끊긴 상대의 뒤늦은 재개 | `room.js:440` | E_ROOM_CLOSED |
| 방 제거 | `lobby.js:113-125` · `:38` | sweep 이 CANCELED 방 삭제, 집계 제외 |

- 경기 중(IN_PROGRESS · 정기 상점) leave 는 종전대로 E_ILLEGAL_ACTION(`room.js:484`)이고 단절 오버레이는 OPEN·SETUP 에서만 나가기를 준다(`network.js:1234`). 범위 밖 · 변경 없음.
- 보존 확인(변경 없음): 준비 180초 무재발급, 만료 시 새로 고침 1회, 재접속 60초·입력 잠금, 공개 방 취소·재대전, 비공개 정보 비노출.

## 3. [확정] 2항 가격 — 서버는 자체 가격이 없다

- `server/authoritative/runtime.js:24` 가 공유 `demo/js/data.js·state.js·core.js` 를 싣고, `shopGood` 의 코인 부족·예비 코인·차감은 전부 Core(`core.js` shopGood) 판정이다. `room.js:1106` 은 봉투 모양만 본다.
- Mars 의 `ECO.buffPrice=3` + `ecoGoodPrice(k)` 가 들어오면 서버 권위 판정도 3 이 된다. 서버 제품 쓰기 0.

## 4. 변경 파일

| 파일 | 내용 |
|---|---|
| `server/authoritative/test/test-issue237-economy.js` | §1b: 상품별 비용(수호자 3·나머지 1), 좌석0 = 티켓+힘(🪙6) 뒤 포션·시간·도망 예비 재화 거부·상태 불변, 소유자 뷰 비노출 확인은 power 로. §5: 픽스처 🪙11 → 힘·시간·도망 각 정확히 −3(두 엔진), 🪙2 에서 3종 거부·상태 불변, 포션은 −1 |
| `docs/milestone/v0.4.13/issues/293/Jupiter/qa-revise4-implementation.md` | 이 보고서 |

예비 재화·비노출 가드는 약화하지 않았다. 새 테스트 파일·helper·의존성 없음.

## 5. 실행 결과 (승인된 3개, `server/` 에서 `DATABASE_URL` 빈 값)

| 명령 | 결과 |
|---|---|
| `node authoritative/test/test-issue263-timers.js` | 147 passed, 0 failed (1회) |
| `node authoritative/test/test-room.js` | 57 passed, 0 failed (1회) |
| `node authoritative/test/test-issue237-economy.js` | 1회차: `ws` MODULE_NOT_FOUND(이 WorkTree 에 `server/node_modules` 없음 — 단언 실패 아님). 2회차: `NODE_PATH=C:\Users\pc_77\orca\Digit-Duel\server\node_modules` 로 179 passed, 0 failed |

## 6. 한계·미확정

- 클라이언트 잔상 수정 자체는 Mars 산출물이며 여기서 검증하지 않았다. 브라우저·네트워크 수동 실행 없음.
- 나머지 서버 테스트 묶음(`npm test`)은 승인 예산 밖이라 돌리지 않았다.
- Git·GitHub·Render·Notion 쓰기 0. CJ 플레이 QA·Saturn 판정은 별도 단계다.
