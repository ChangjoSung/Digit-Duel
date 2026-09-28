# #238 Jupiter(Server) 보고 — S01 상품 8종 서버 검증 · S04 결과 `final`

- 2026-09-28 · Jupiter(Claude Code `claude-opus-5-5` high) · task_6f915f5b2394 · 범위 = SERVER · Git 쓰기 없음
- 브랜치 `ChangjoSung/issue-238-game-ui`(HEAD e1bfdc2) 작업 트리. 모든 규칙은 CJ의 2026-09-25 #238 확정을 따른다.

## 1. 부모 #262 서버 파일 인계 [확정]
PD COPY_GO에 따라 `issue-262-multiplayer-emotes`의 서버 파일 9개를 바이트 복사했다. 복사 원본과 대상의 sha256이 9/9 같았고, 원본은 복사 전후 모두 바뀌지 않았다.
이후 이 문서의 변경으로 `room.js`·`README.md`·`test-issue237-economy.js` 세 파일만 부모와 달라졌다.

## 2. S01 상품 8종 [확정]
- 서버에는 상품 허용 목록이 따로 없다. `room.js`는 `shopGood`의 형식만 검사하고 Core에 넘긴다. 판정은 Core `ECO.startGoods`(`demo/js/data.js`, Mars 소관)와 `ecoReserveOk`가 한다.
- 그래서 서버 코드 변경은 **0줄**이다. Mars가 `startGoods`를 8종으로 바꾼 코드를 서버가 그대로 실행한다.
- 테스트는 실제 서버 권위 구매를 돌렸다(`test-issue237-economy.js` 1b). 결과는 다음과 같다.
  - 8종 모두 1번씩 구매가 수락된다. 🪙가 1 줄고, 보관처(티켓·버프 재고·아이템·볼)가 1 늘며, 두 엔진에 같이 반영된다.
  - 다섯째 상품은 예비 재화 규칙(빈 칸 6)으로 거부되고 상태가 바뀌지 않는다.
  - 보유 상품은 소유자 뷰에만 보인다.
  - S01에서 티켓 **사용**은 여전히 거부된다([기획 필요] 유지).
  - 상품 4개를 산 뒤 90초가 만료되면 6명을 자동 구매하고 🪙0이 된다. 산 상품은 보존된다.
- 기존 case 1의 "좌석 1 티켓 거부" 검사는 티켓이 S01 상품이 되면서 수락되므로 깨진다. 그래서 거부 탐침을 없는 품목(`bogus`)으로 바꿨다. 좌석 0 티켓 거부 검사는 예비 재화 위반으로 그대로 거부되므로 문구만 고쳤다.

## 3. S04 결과 `final` [확정 구현 · 가방 포함은 PD·Venus 해석]
- `room.js` `toSeatView`는 `FINISHED`일 때만 `final`을 싣는다. 형태는 `{sides:[{seat, pieces, bag, syn}×2]}`이다(`_finalView`).
- `pieces`는 Core `synCount`와 같은 기준으로 고른 필드 9칸이다(사망 포함). `bag`은 가방 0~3명이다.
- 말 하나는 `{type, rosterId, name, element, alive, hp, maxHp, hpSeen?}`만 담는다. 별칭·위치·등급·스킬·원장은 싣지 않는다.
- 상대 HP는 보드와 같은 규칙을 따른다. 실제로 싸운 개체(`hpSeen`)만 실제값이고, 나머지는 100 눈금이다. 내 말은 실제값이다.
- `syn`은 Core `synView(seat, S)`를 JSON으로 복제한 것이다. 산식은 새로 만들지 않았다. 전투 중에 경기가 끝나면 그 전투의 스냅샷이 쓰인다.
- 결과 뷰를 고쳐도 엔진과 다음 뷰는 그대로다(참조 분리 검사).
- **[PD·Venus 해석 — CJ 원문 아님]** CJ 원문 '양측 하수인 전체'를 소유 하수인 전부로 해석해 가방도 넣었다. Core 시너지는 이미 가방의 전설을 센다.
- 종료 전 비공개 경계와 `this.result` 객체는 바꾸지 않았다.

## 4. 검증 (각 1회 · 실패 보존)
| 테스트 | 결과 |
|---|---|
| test-issue237-economy | 1차 `ws` 모듈 없음 — 이 작업 트리에 `node_modules`가 없음 → `NODE_PATH`로 부모 #262 설치본을 읽기 전용으로 사용(package.json 바이트 동일) → 2차 FAIL(새 블록을 case 1 중간에 넣은 테스트 배치 실수) → 수정 뒤 **139 passed, 0 failed** |
| test-issue263-timers | 133 passed, 0 failed |
| test-issue262-emotes | 1차 `ws` 없음 → `NODE_PATH` 사용 **64 passed, 0 failed** |
| test-runtime-contract | 74 passed, 0 failed (골든 재생성 없음) |

## 5. 남은 것
- S01 티켓 사용 시점은 [기획 필요]다(GDD-23 7.8).
- S04 표시·배치는 Mars의 UI 작업이다. 클라이언트는 `final.syn`을 다시 계산하지 않는다.
- 서버 기동·DB·배포·Git 작업은 하지 않았다.

## 6. 후속 — 전투 fx `cast` (2026-09-28 · task_39fd3f39baf0)
- 무엇이 바뀌었나: Mars가 Core 기술 사용 문구(`bmsg`)에 `fx.cast`('A'|'D' = 시전 측)를 싣도록 바꿨다. 서버에서는 이 값을 두 곳의 fx 화이트리스트가 모두 통과시켜야 화면까지 간다. 한 곳은 캡처 단계인 `engine.js` `normalizeMsgFx`이고, 다른 한 곳은 좌석 뷰를 만드는 `room.js` `_serializeFxMsgFx`다(Saturn P2 이중 화이트리스트).
- 그래서 두 곳에 같은 한 줄 `cast === 'A' || 'D'`만 통과시키는 엄격 허용을 넣었다. 그 밖의 값은 필드째 생략한다. `room.js`는 PD 승인(APPROVE_ROOM_LINE)을 받아 4번째 파일로 추가했다. HP 가림에 쓰는 `fxSubject`는 바꾸지 않았다.
- 전송 형태: msg 이벤트의 `fx.cast`는 'A' 또는 'D'이며, 없을 수도 있다. S04 `final`의 wire는 바꾸지 않았다. 참고로 `syn.el` 키는 `fire·water·lightning·land·grass`다.
- 테스트: 지시서의 `test-issue233-fx.js`는 존재하지 않는다. 기존 FX 스위트인 `test-battle-fx.js`에 다음을 넣었다.
  - 키 화이트리스트에 `cast` 추가
  - 실제 공격 줄에 `cast`가 'A' 또는 'D'로 실리는지 확인
  - msgQ 훅에 잘못된 값('X'·숫자·객체)을 주입하면 두 층 모두에서 생략되고, 'D'는 두 층을 통과하는지 확인
  - 결과: **1회 실행 501 passed, 0 failed**(`NODE_PATH`는 부모 #262 설치본을 읽기 전용으로 사용)
- 하지 않은 것: 다른 스위트 재실행·골든·스키마·Git·서버 기동
