# #217 — 공개 좌석 뷰 델타 (Jupiter_Server, Mars ctx_75a85d4c58fb 요청 대응)

2026-09-13. Mars(Opus, ctx_75a85d4c58fb, msg_71dfac741cb4)가 지목한 공백 대응 — 강제 전투/텔레포트 단계의
`autoEndReady` 오판(정당한 endTurn/skipMain이 거부되는 루프), 원본 하이라이트(강제 대상·텔레포트 스왑·도망친
말) 복원, 자기 텔레포트 사용 횟수 표시. **v4(protocol.md §7)의 확정 좌석 뷰 스키마에 추가되는 소규모 델타**이며
기존 v4 프로토콜 필드·규칙·RNG는 전혀 바꾸지 않는다. 코드: `server/authoritative/room.js`만 수정
(`engine.js`는 이미 필요한 `T.__fx.lastBattleId`·`T.visibleTo`를 노출하고 있어 변경 없음). 검사:
`server/authoritative/test/test-public-authority-delta.js`(37개 단언, 신규) +
`server/authoritative/test/test-match-fuzz.js` 불변식 갱신(아래 §3).

## 0. Mars와의 스키마 조율 — 1차 제안 → PD 정정 반영

1차 제안(위 dispatch 원문)은 `battle.a/d`에 `cd`·`atk`·`skillAtk`도 포함했으나, PD 경유 Mars 정정
(msg_db7a8fa06aee, 2026-09-13)으로 **`cd`/`atk`/`skillAtk`는 철회**했다:

- 왕/동료 본체는 `BAL.ally`/`BAL.king`에 `skill` 필드가 없어(`{hp:100,atk:16}`뿐) `skillAtk=0`이고, 그러면
  스킬 버튼 자체가 원본 UI(`battleModal()` else 분기, index.html:3091-3094)에 렌더되지 않는다 — `cd`가 가리킬
  대상(스킬 버튼의 쿨)이 애초에 없는 경우가 대부분이라 노출해도 실질 정보가 없다.
- `atk`/`skillAtk`는 대부분 이미 노출된 정보로 유도 가능하다: 자기 쪽은 `you.pieces[]`가 이미 전체 공개하고,
  본체 출전 상대 하수인은 `rosterId`(§7.1 v4.2)로 `ROSTER`(공개 상수) 조회가, 왕/동료 본체는 `BAL.ally`/
  `BAL.king`(공개 상수) 조회가 각각 값을 특정한다.
- 유일하게 유도 불가능한 경우(포획 대리 출전 상대의 `cap` 수치)조차, 원본 UI는 그 경우 `?`만 보여줄 뿐 실제
  수치를 그리지 않는다(대리 출전 커맨드 패널은 소유자 자기 화면에만 그려진다) — 그래서 이 하나만을 위해
  `atk`/`skillAtk`를 필드로 신설하는 것은 "불필요한 공개 확장"이라는 것이 PD·Mars의 결론이다.

최종 확정 스키마는 아래 §1~§4뿐이다. `battle.battleId`는 PD가 stage lifecycle(연출 무대 전환) 대응에 필요하다고
권장해 그대로 유지·구현했다(§3).

같은 정정 메시지에서 Mars가 **새 요구사항**을 하나 추가했다 — §5(FINISHED 종료 리빌)가 그 대응이다.

## 1. `data.turn` — 현재 행동자(S.current) 좌석 전용

```jsonc
"turn": {
  "teleport": null,               // 또는 {"stage":1|2, "piece": "u-...(선택된 자기 말)"|null}
  "forcedTargets": ["u-...", ...],// 신규 인접 강제 전투 후보 별칭 — 이미 이 좌석 뷰(units/you.pieces)에 있는 것만
  "forcedQueue": 0,                // 대기 중인 강제 전투 큐 길이(개수만 — 내용은 비공개)
  "movedPiece": "u-..."|null,      // 이번 행동으로 이동한 자기 말 별칭
  "firstBattleWonByMover": false,  // T1 연쇄 규칙 판정용 플래그
  "contactSet": ["u-...", ...]     // movedPiece와 신규 인접한 적 전체(강제 대상 포함) — forcedTargets와 같은 게이트
}
```

- **비행동자 좌석은 `turn: null`.** 원본 UI도 이 하이라이트들(강제 대상 빨간 표시 index.html:1737, 텔레포트
  스왑 파란/흰 표시 1738-1741, 강제 전투 안내 1906)을 전부 `!isAI(S.current)&&(!NET.mode||S.current===NET.me)`
  조건으로 **S.current 좌석 화면에만** 그린다 — 서버도 같은 게이트(`S.current===seatIndex`)로만 채운다.
- **별칭 발급은 "이미 이 좌석 뷰에 있는 것"만.** `forcedTargets`/`contactSet`는 항상 `movedPiece`(자기 말)와
  신규 인접한 적이라 `visibleTo(seatIndex, e)`가 이미 참이다(인접 자체가 가시성 조건, index.html:1365
  `alivePieces().some(m=>m.owner===viewer&&adj(m,e))`) — 그래도 방어적으로 `_visibleTurnAlias`가
  alive·placed·visibleTo(또는 소유)를 다시 확인한 뒤에만 별칭을 만든다. `teleport.piece`는 항상 자기 말이라
  이 게이트를 자명하게 통과한다.
- `forcedQueue`는 개수만 보낸다 — 대기 큐(`S.forcedQueue`)의 각 항목 `{pid,targets}`는 아직 확정되지 않은
  다음 강제 전투 후보라 pid/targets 자체는 노출하지 않는다(원본도 이 큐를 화면에 그리지 않는다).

## 2. `you.teleUsed` — 자기 텔레포트 사용 횟수만

```jsonc
"you": { ..., "teleUsed": 0 }
```

`S.teleUsed[seatIndex]`만 보낸다(상대 값은 없음) — 텔레포트 버튼의 `teleMax` 도달 비활성화 판정에 필요한
자기 정보다.

## 3. `battle.battleId` — fx 창과 직접 대응하는 정수

```jsonc
"battle": { ..., "battleId": 3, ... }
```

`engine.js`가 이미 `S.battle` 대입 순간 발급하는 `T.__fx.lastBattleId`(battle-fx-protocol.md §4, 룸 수명
동안 유일·단조)를 그대로 읽는다 — 새 값을 만들지 않는다. `battle`이 열려 있는 한 항상 정수다. `fx.events`의
`battleStart`/이후 `msg` 이벤트가 싣는 `battleId`와 항상 같은 값이라, Mars가 fx 이벤트를 join하지 않고도
"지금 이 battle 스냅샷이 어느 fx 무대에 대응하는지" 바로 알 수 있다. 검사: 실제 강제 전투로 연 전투와
`E.initBattle()`로 직접 연 두 번째 전투 모두에서 `battle.battleId === fx.events.find(e=>e.key==="battleStart").battleId`
및 두 번째 전투의 `battleId = 첫 번째 + 1`(단조)을 고정했다(test-public-authority-delta.js §2/§3).

## 4. `fleePick.pieceId` — 소유자 전용 별칭

```jsonc
"fleePick": { "owner": 0, "pieceId": "u-...", "cands": ["u-...", ...] } // pieceId·cands는 owner===seatIndex일 때만
```

기존 `cands`(교환 후보)와 완전히 같은 게이트로, 도망친 말 자체(`S.fleePick.pieceId`)의 별칭을 추가했다 —
원본 UI가 도망친 말에 `hl-sel`(흰 강조, index.html:1734)을 그리는 데 필요한 최소 식별자다. 상대 뷰에는
`pieceId` 키 자체가 없다(`undefined`로 직렬화에서 빠짐).

## 5. FINISHED 종료 리빌 (#11) — Mars 정정 메시지의 추가 요구사항

Mars가 같은 정정에서 지적: 원본 `index.html:1705`는
`viewer = ... (S.mode==="sim"||S.phase==="over")?2:humanViewer()` — 즉 **경기가 실제로 끝나면(`phase==="over"`)
두 화면 모두 전지적 시점(`viewer===2`)으로 전환**해 `visibleTo`/`revealed` 마스킹 없이 살아있는 모든 말의
위치·정체를 그린다(#11, 종전 승인 규칙). v4의 `toSeatView`는 FINISHED에서도 여전히 등급 A/B/C-2 마스킹을
유지하고 있었다 — 이 델타에서 함께 고쳤다.

`toSeatView`의 board-view 분기(`this.state !== TERMINAL_NO_BOARD`)에 `revealAll = this.state === STATES.FINISHED`를
두고, 상대 유닛 직렬화 루프에서 `revealAll`이면 `visibleTo` 게이트와 `revealed` 조건을 모두 건너뛰어
`_serializeKnownOpponent`(등급 C-2 — 위치+정체, hp 포함)로 강제한다. **FINISHED만 해당한다** — 다른 종료
상태(CANCELED/VOID/CLOSED)는 `TERMINAL_NO_BOARD` 분기가 애초에 `units:[]`로 board 자체를 비워 보내므로
이 리빌이 새지 않는다(별도 처리 불필요, 기존 분기 구조가 이미 격리한다).

검사: test-public-authority-delta.js §7 — 숲 속·비인접(등급 A, 레코드 자체가 빠지는 조건)으로 만든 상대
유닛이 경기 중에는 `units`에서 빠짐을 먼저 확인하고, 실제 `gameOver()` 호출 뒤 FINISHED로 전이하면 같은
유닛이 위치·`type`/`name`/`rosterId`까지 공개됨을, 그리고 CANCELED는 board 자체가 비어 리빌이 없음을 함께
고정했다. 또한 **기존 `test-match-fuzz.js`의 "경기 중 미공개 상대 이름 비노출" 불변식은 FINISHED로 전이하는
바로 그 스텝을 검사 대상에서 제외**하도록 갱신했다 — 그 전이가 의도된 리빌이라 예전 불변식(항상 마스킹)과
충돌했기 때문이다(다른 종료 상태는 `room.engines`가 이미 null이라 원래도 이 분기에 들어오지 않는다).

## 6. 검증

`cd server && npm test` — 기존 10종 스위트(scheduler 32·engine-isolation 18·room 57·security-gaps 61·
authority-rules 176·battle-fx 420·match-fuzz 16·authoritative 50·http-static 24·launcher-authoritative 47)
전부 회귀 없이 PASS + 신규 `test-public-authority-delta.js` 37개 단언 PASS. 실제 `doMove()`(다중 강제 대상)→
서버 공개 `cell` 인가 경유 선택→실제 `initBattle()` 흐름, 실제 `tele` stage1→stage2→swap 흐름, 실제
`flee`(fleeProb=1 강제) 흐름, 실제 `gameOver()` 호출 후 FINISHED 리빌을 각각 실제 엔진 함수/공개 API로
재현했다(합성 아님). 반환된 `turn`/`battle` 중첩 객체·배열을 변조해도 엔진 내부 상태·다음 조회에 새지
않음(매 호출 새 객체/배열)도 별도로 고정했다.

## 7. 남은 사항

- Mars 클라이언트 측 소비(하이라이트 렌더링·teleMax 버튼 비활성·도망 강조)는 이 델타의 범위 밖이다 — 서버는
  스키마와 서버 측 계약만 확정한다.
- 이 델타는 v4(protocol.md) §7 좌석 뷰 화이트리스트에 대한 추가이며 별도 프로토콜 메이저 버전을 새로 붙이지
  않는다 — 기존 필드·판정·오류 코드는 전혀 바뀌지 않았다.
