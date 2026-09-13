# #217 — 기존 승인 아트 연결 복구용 서버 표시 필드 (Jupiter_Server delta)

2026-09-13. 범위: `server/authoritative/room.js`의 좌석 뷰 직렬화(`_serializeOwn`·`_serializeBattle`)만 수정. 규칙·RNG·인가(`_authorize`)·revision·phase 계약은 손대지 않았다. `demo/**`·클라이언트 테스트는 읽기만 했고 수정하지 않았다.

CJ의 "기존 아트 연결 누락 재발" 지시와 [Earth/art-omission-audit.md](../Earth/art-omission-audit.md) P0(1)·P0(2)가 지목한 두 공백(전투 무대 아트·자기 하수인 아이콘)에 대해 Mars가 기존 승인 렌더(`artDirOf`/`artDirOfFighter`/`leaderBattleDir`, 원본 `battleModal()`)를 그대로 재사용할 수 있도록 서버가 보내는 최소 식별자를 추가했다.

## 변경 필드

### 1) `_serializeOwn()` — 자기 말(보드) 뷰에 `rosterId` 추가

```js
rosterId: p.rosterId || null,
```

- 대상: `you.pieces`(자기 좌석 전체 말) · `you.reserve`(자기 예비 하수인, `p.rosterId`는 항상 undefined이므로 그냥 null).
- 근거: 자기 말은 이미 `type`·`element`·`skills`·`name`까지 전부 공개된다(analysis.md §2.6.1 "자기 좌석" 열). `rosterId`(예 `"M-F1"`)는 `element+arch`를 가리키는 표시 전용 키일 뿐이라 새 정보 노출이 아니다 — 종전 whitelist가 이 필드만 빠뜨렸던 것으로 판단([확정], 코드 대조).
- 효과: Mars가 `netStubPiece().rosterId`에 이 값을 보존하면 기존 `artDirOf(p)`가 그대로 동작해 보드 하수인 아이콘이 복구된다(Earth 감사 P0(2) 권고안 그대로).
- 상대에게는 영향 없음(§1 최초 반영 시점 기준): 이 §1 변경 자체는 `_serializeUnknownOpponent`/`_serializeKnownOpponent`를 건드리지 않았다 — 이 시점 상대 쪽 A/B 등급에는 `rosterId` 필드 자체가 없었다(검사로 확인). **이후 §v4.2에서 `_serializeKnownOpponent`(등급 C-2)에 별도로 `rosterId`를 추가했다** — 현재 상태는 §v4.2를 따른다(등급 B는 그 변경 후에도 여전히 필드 없음).

### 2) `_serializeBattle()` — 전투 문맥에 `type`·`element`·`bodyFight`·`rosterId`·`artRosterId` 추가, `skills` 소스 버그 수정

```js
type: piece.type, element: f.element || null, bodyFight,
rosterId: bodyFight && piece.type === 'minion' ? (piece.rosterId || null) : null,
artRosterId: bodyFight ? null : (f.artRosterId || null),
```

`bodyFight = (f === piece)` — 지금 실제로 싸우는 개체(`f`=`battle.fa`/`fd`)가 그 말 본체인지(하수인 본체, 왕/동료 본체), 포획·예비 하수인 대리(`piece.cap` 또는 예비 슬롯 승계)인지 구분한다. 클라이언트가 이 rule을 다시 계산하지 않도록 서버가 판정해서 내려보낸다(요청사항 "클라이언트는 기존 데이터만 표시").

| 케이스 | `type` | `bodyFight` | `rosterId` | `artRosterId` | `element` |
|---|---|---|---|---|---|
| 하수인 본체 출전 | `"minion"` | `true` | 그 하수인 rosterId | `null` | 그 하수인 element |
| 왕/동료 본체 출전 | `"king"/"ally"` | `true` | `null` | `null` | `null`(왕/동료는 element 없음) |
| 포획/예비 하수인 대리 출전 | `"king"/"ally"`(원 소유 말 기준) | `false` | `null` | 대리 개체의 종 id | 대리 개체 element |

- Mars 재구성 예: `piece={type:side.type, rosterId:side.rosterId}`, `pf = side.bodyFight ? piece : {element:side.element, artRosterId:side.artRosterId}` 로 만들면 기존 `artDirOfFighter(pf,piece)`/`leaderBattleDir(pf,piece)`가 그대로 동작한다.
- **버그 수정**: 종전 코드는 `skills: this._skillsFor(T, piece, …)`로 항상 **원 소유 말**(`piece`=attP/defP)의 skills를 읽었다. 하수인 본체 전투는 `f===piece`라 우연히 맞았지만, 왕/동료가 포획 하수인을 대리로 내보낸 전투에서는 `piece.skills`가 항상 `null`(왕/동료는 skills 필드가 없다 — `mkPiece` 참조)이라 대리 개체의 실제 4기술이 전혀 내려가지 않았다. `_skillsFor(T, f, …)`로 고쳤다 — 정보 등급(§2.6.2, 상대는 `revealed:false`+`kind`만)은 그대로다. 하수인 본체 전투(현재까지 검수된 유일한 경로)는 `f===piece`라 동작 변화가 없다.

## 가시성 경계 — 무엇이 새로 나가고 무엇이 안 나가는가

- **새 노출 아님(형태는 새로워도 정보량은 동치)**: 전투는 두 말이 상호 인접해야만 시작되므로(§4.4 `cell` 판정) 전투 중인 두 말은 항상 서로 `visibleTo`이고, `startRounds()`/`vipChoice()`가 즉시 양쪽 `piece.revealed=true`를 세운다. 그래서 상대 쪽에 보내는 `type`/`element`는 같은 시점에 board `units` 배열의 등급 C-2(`_serializeKnownOpponent`: `type,name,element,hp,maxHp`)로도 나가는 값이다. **정확히 짚어야 할 것(§1 최초 반영 시점 기준)**: 이 §1 시점에는 `battle.a/d.rosterId`(본체 하수인 전투일 때만 채워짐)가 "C-2가 이미 rosterId를 보낸다"는 뜻이 아니었다 — 그때 `_serializeKnownOpponent`는 `rosterId` 필드 자체를 보내지 않았다. **§v4.2에서 `_serializeKnownOpponent`에도 같은 조건으로 rosterId를 추가했으므로, 현재는 형태까지 동치다.** 정보량이 (§1 시점부터 줄곧) 동치인 이유는 다른 경로다: ROSTER 20종은 이름이 서로 겹치지 않으므로(1:1), 상대는 이미 C-2의 `name`만으로도 이 `rosterId`가 가리키는 것과 같은 종을 특정할 수 있었다 — 그래서 `rosterId`를 형태 그대로 추가해도 상대가 판별할 수 있는 정보의 양은 늘지 않는다. 검사(`test-security-gaps.js` "전투 중인 상대 하수인도 type/rosterId 노출", §v4.2 "#217 C-2 board 표시 회귀")로 확인.
- **진짜 새 노출, 그러나 신규 정책 승인이 아니라 기존 승인(#91) 동작의 복원**: 포획/예비 대리 출전일 때 상대 쪽에 보내는 `artRosterId`. board 뷰의 `cap`은 상대에게 절대 안 보낸다(analysis.md §2.6.1 "포획 cap" 행) — 대리 개체 정체는 원래 별도 비공개 정보이므로, 이 필드는 형태·정보량 모두 진짜 새 노출이다. 다만 "새 기획 결정"이 아니라는 근거가 코드와 승인 기록 양쪽에 있다:
  - **코드 사실**: 원본 `token()`/`artDirOfFighter()`(`demo/index.html`)는 `viewer`/`NET.me`로 전혀 분기하지 않고 `battle.fa`/`fd`(=`pf`) 기준으로 스프라이트를 그린다. `cmdBtns`/`panel()`의 기술 마스킹(`maskCmd=viewer!==2&&ownerP!==viewer`)과 달리, 스프라이트 선택 함수 어디에도 그런 조건이 없다.
  - **승인 기록**: `docs/milestone/v0.4.4/issues/91/Mars/issue91-mars.md`(Issue #91, CJ dispatch 채택분)의 K9 계약이 "보드·사이드·출전 선택·출전 공개 모달에 종 폴더 0 · **전투 스테이지(출전 공개 후)에만** [나타난다]"를 명시하고, `demo/test/regression/smoke_minion_art.js`의 `K9e`가 그 계약을 "전투 스테이지에서만 대리 전투원의 종이 나타나고, 상대 왕의 미공개 cap·양측 예비의 종은 여전히 없다"로 코드에 고정했다(`K9f`: 그 밖의 비공개 cap/예비는 전투 중에도 노출 0). 즉 "지금 실제로 싸우는 그 개체만, 전투가 열려 있는 동안만" 겉모습이 드러나는 것은 #91에서 이미 CJ dispatch로 승인된 계약이다.
  - **모델 차이에 따른 caveat**: #91 당시 온라인 모델은 권위 서버가 아니라 두 클라이언트가 각자 전체 로컬 상태로 같은 락스텝을 도는 방식이었다(`hello`/`hello2`, §0). 마스킹 없는 렌더 함수가 전체 로컬 상태에 적용되므로 "양쪽 다 봄"이 논리적으로 성립하지만, **실제 2브라우저 온라인 접속으로 이 경로를 검증한 기록은 #91 당시에도 없다** — `docs/milestone/v0.4.4/issues/91/Saturn/issue91-saturn.md`: "실제 온라인 2연결의 end-to-end 포획/대리 출전 … 은 미검증이다." 그래서 이 필드는 "코드·승인 계약상 명백히 기존 동작"이되 "실제 교차 브라우저로 그 순간이 확인된 적은 없다"는 caveat을 함께 남긴다. 이견이 있으면 `bodyFight===false`일 때 `artRosterId`만 항상 `null`로 바꾸면 된다(자기 쪽 전투 표시·하수인 본체 전투·왕/동료 본체 전투에는 영향 없음, 격리된 한 줄 변경).
- **범위 확대 없음**: 상대 전투원의 미공개 기술(`revealed:false`)은 여전히 `{i,revealed:false,kind}`만 나간다(id·name·cd 없음) — 이번 변경으로 늘지 않았다. 쿨/버프/아이템 등 기존 전투-공개 필드 목록도 그대로다.

## 검사

- `cd server && npm test` — 기존 9종 권위 스위트 전부 그대로 통과(변경 전과 동일 개수): scheduler 32 · engine-isolation 18 · room 57 · security-gaps **55**(+15, 아래 회귀 편입) · authority-rules 176 · match-fuzz 16(6시드) · authoritative 50 · http-static 24 · launcher-authoritative 47. 정보 은닉 회귀(test-security-gaps.js "상대 전투원의 미공개 기술은 id·이름 없음")도 그대로 PASS.
- **저장소 영구 회귀로 편입** — `server/authoritative/test/test-security-gaps.js`에 4개 시나리오(15개 단언)를 추가해 `npm test`/`npm run test:authoritative`에 상시 포함시켰다(스크래치 1회성 검증에서 전환, package.json 변경 없음 — 기존 `test:authoritative` 체인 안에 이미 있는 파일이라 스위트 진입점만 늘었다):
  1. 자기 하수인 `rosterId` 노출 / 상대 미공개 유닛에는 필드 자체가 없음.
  2. 하수인 vs 하수인 전투: 양쪽 `bodyFight:true`, `rosterId` 있음·`artRosterId` 없음, 상대 쪽 `type`/`rosterId`도 C-2 동치 정보로 노출.
  3. 왕 vs 왕 본체 전투(실제 "출전 공개" 동기화 모달 `t:"modal"` 응답으로 통과): `bodyFight:true`, `rosterId`/`artRosterId` 둘 다 `null`, `skills:null`(회귀 없음).
  4. 동료가 포획 하수인(`M-W1`/water)을 대리 출전시키는 실제 `vipChoice` 모달 흐름(2지선다 모달 응답까지 포함): `bodyFight:false`, `rosterId:null`·`artRosterId:"M-W1"`, `element:"water"`, **자기 쪽 skills 4슬롯이 실제로 채워짐(스킬 소스 버그 수정의 회귀 방지)**, 상대 쪽에서도 `artRosterId` 노출되지만 미공개 기술 id/name은 여전히 안 나감.

## v4.2 수정 — C-2(공개된 상대) board 표시에도 `rosterId` 추가 (Saturn ctx_e6437fa06ae4 REVISE)

Saturn이 `_serializeKnownOpponent`(등급 C-2, board `units`)에 `rosterId`가 없어 **공개된 상대 하수인의 board 아이콘**이 계속 폴백하는 REVISE 후보를 재현했다(msg_fcca8e66b930). 원인은 위 §1에서 `you.pieces`(자기 좌석)에만 `rosterId`를 추가하고, 상대가 `revealed=true`로 전환된 뒤 board에서 보이는 C-2 경로는 whitelist에서 빠뜨렸던 것 — 기존 #89(공개 상대 동일 종 icon)·#201(아트 복구) 요구를 그대로 좇는 누락 복구이지, 새 공개 범위 확장이 아니다.

```js
rosterId: p.type === 'minion' ? (p.rosterId || null) : null,
```

- 대상: `_serializeKnownOpponent(p)` — 등급 C-2(공개된 상대)만. `_serializeUnknownOpponent`(등급 B)와 비가시(등급 A, 레코드 자체 제외)에는 이 변경 후에도 `rosterId` 키 자체가 없다(변경 없음, 검사로 확인).
- 근거(정보량 동치): §"가시성 경계" 문단에서 이미 확인했듯 ROSTER 20종은 이름이 서로 겹치지 않는다(1:1) — C-2는 지금도 `name`을 보내므로, 상대는 `name`만으로도 이 `rosterId`가 가리키는 것과 같은 종을 이미 특정할 수 있었다. `rosterId`를 형태 그대로 추가해도 판별 가능한 정보량은 늘지 않는다. 왕/동료는 하수인이 아니므로 공개돼도 항상 `null` — `_serializeOwn`·`battle.a/d.rosterId`와 동일한 `type==="minion"` 조건.
- 클라이언트 소비 경로(참고, `demo/**`는 읽기만 함): `netStubPiece()`(`demo/index.html`)가 `you.pieces`·`data.units`(B·C-2 모두) 양쪽에 이미 `u.rosterId!==undefined?u.rosterId:null`로 일반 매핑해 두었고, `artDirOf(p)`가 `p.rosterId`만 보고 보드 하수인 아이콘을 고른다 — 그래서 C-2가 필드를 채워 보내는 순간 클라이언트 쪽 변경 없이 board 아이콘이 복구된다(Saturn이 지목한 REVISE의 근본 원인이 바로 이 whitelist 누락이었음을 코드로 확인).
- `battle.a/d.rosterId`(§2 "형태는 C-2에 없지만 정보량은 새 노출이 아니다")는 이 수정으로 **형태로도 C-2와 동치**가 됐다 — units C-2가 이제 같은 값을 board에서도 보낸다. 다른 필드(`battle.a/d.type/.element/.bodyFight/.artRosterId`, `_serializeUnknownOpponent`, `_serializeOwn`)와 규칙·RNG·인가(`_authorize`)는 손대지 않았다.
- 검사: `server/authoritative/test/test-security-gaps.js` "#217 C-2 board 표시 회귀" 블록(공개 전 B→전투로 revealed 전환→전투 종료 후 board-only C-2 표시까지 rosterId 값 일치 확인 + 미관여 상대 유닛은 여전히 필드 없음 + 왕은 revealed여도 rosterId=null) — 6개 신규 단언, 기존 40여 개(§검사) 그대로 유지, `npm test`/`test:authoritative` 전체(security-gaps 61·나머지 8종 동일 개수) PASS. 문서 반영 위치: 이 파일(§v4.2)·[protocol.md](protocol.md) §7.1·§9.

## 미해결 / 남은 범위

- `artRosterId`(대리 출전 상대 공개)는 위에서 코드·#91 승인 기록 양쪽으로 뒷받침했지만, "실제 2브라우저 온라인 접속에서의 확인"은 #91 때도 지금도 없다 — 이 한 가지는 여전히 사실 확인이지 CJ의 새 결정이 아니다. Mars/Saturn이 실제 온라인 2연결로 전투 스테이지 렌더를 확인할 때 이 지점을 함께 봐 주면 좋다.
- 로비 카드 순서(Earth 감사 P1)는 Mars/HTML 표시 계층 범위라 이 delta에 포함하지 않았다.
- 이 필드들을 실제로 소비하는 클라이언트 렌더 복원은 Mars 담당이며, Mars가 추가 필드가 더 필요하다고 확인하면 이 계약을 다시 조정한다.
- 전체 서버 회귀(Mercury server-qa-v4.md 9종 스위트)는 이 delta 반영 후에도 동일 개수(security-gaps만 +15)로 PASS했지만, 이 필드 자체에 대한 Saturn/Mercury의 독립 재검수는 아직 없다(server-qa-v4.md가 예고한 "아트 복구로 서버 계약이 바뀌면 다시 독립 검수" 대상).
- `docs/milestone/v0.4.10/issues/217/Jupiter/protocol.md` §7.1에 이번 필드·가시성 등급을 반영했다 — 문서 반영 위치는 그쪽 참조.
