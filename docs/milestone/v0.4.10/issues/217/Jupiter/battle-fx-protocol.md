# #217 — 전투 표시 이벤트(battle fx) 프로토콜 (Jupiter_Server)

2026-09-13. Mars/report.md §6 요청 대응: "라운드 슬라이드·타격 플래시·승패 배너는 서버 snapshot과 사람이 읽는
battle.log만으로 복구 불가 — 각 실제 행동이 발생시킨 순서 있는 구조화 표시 이벤트(타입/대상/값) 필요."

**이 문서는 치환본(v3)이다.** v1(구현 전 제안)은 **PD 코드 검토 REVISE**(msg_c0657afb7242, msg_336c58a0114a,
msg_467892193706, msg_16e693d42efe)에서 다섯 가지 실질 공백을 지적받아 v2로 갔다. v2는 이후 **Saturn 독립
QA REVISE**(Mercury/fx-qa-revise.md, task_a5a4600451f9/ctx_ec556d601a25, worker_done msg_9646c8f5201e,
2026-09-13)에서 실제 inline 호출 재현으로 P1 2건·P2 1건을 추가로 지적받아 v3로 갔다 — §0-1 "v2 → v3 변경
이유"에 무엇이 왜 바뀌었는지만 압축해 남기고, 본문은 전부 **현재 구현 기준**으로 다시 쓴다. 코드:
`server/authoritative/engine.js`(캡처·선언적 합성)·`server/authoritative/room.js`(직렬화·`Room._fxCache`).
검사: `server/authoritative/test/test-battle-fx.js`(420개 단언 — 기존 229개 + Saturn 3건 회귀 T15~T17 +
T12 재작성, `npm run test:authoritative` 체인 편입).

**실제 검증 상태(2026-09-13, msg_08775b7992e3 후속)**: v3의 P1 2건·P2 1건은 **Saturn이 독립 재검수해
PASS**했다(msg_f7bd309c78e0 — 원래 3사례를 양 좌석·연속 전투·private 값 sentinel/구조 검증으로 재현해
확인, PD 취합 msg_ffe731126fee). 남은 것은 이번 후속에서 고친 **T12 자체의 결함**(아래) 하나뿐이다 — 이
결함은 v3 REVISE 3건과 무관한, 기존(v2 이전부터 있던) 테스트 코드의 취약점이다.

**T12 간헐 실패(msg_08775b7992e3) — 원인과 수정**: `T12`는 미공개 상대 하수인의 원시 PID(`mkPiece`의
`id:PID++`, 작은 정수)가 fx 문자열 어디에도 없어야 한다는 음성 통제를 `rawFx0.includes(hidden.id)`로
검사했다. 이 부분 문자열 검색은 hp.val·seq·round·actSeq·turn·cells 등 **무관한 숫자 안에 우연히 같은
자릿수가 들어 있어도** 매치돼 관측상 15~20% 확률로 오탐 실패했다(예: id=3가 hp 37·seq 13과 충돌). 1차
수정으로 숫자 경계를 요구하는 정규식(`numberAppearsStandalone`)을 시도했으나 PD가 즉시 지적한 대로
(msg_91f8c67f6fd3) 이는 부분 문자열 충돌만 없앨 뿐 **정확히 같은 값**(예: id=7과 seq:7)의 우연한 일치는
여전히 막지 못했다(관측 20회 중 1회 재현, id=44/hp=44). 최종 수정은 PD 권고 그대로 **sentinel 치환**이다 —
`hidden`의 id를 게임 로직이 절대 만들 수 없는 값(`900000001`)으로 **양 엔진에 동일하게**(락스텝 유지)
바꿔치기한 뒤 그 sentinel만 검사한다. 게임 로직은 피스 id 값 자체를 규칙 판정에 쓰지 않으므로(소유자·
타입·좌표만 쓴다) 이후 전투 진행에 영향이 없고, hp/seq/round/cells의 정상 수치 범위와 절대 겹치지 않는
값이라 값의 우연한 일치까지 구조적으로 배제된다(collision-free by construction). 추가로 **구조적 화이트
리스트 검사**(`hasUnsafeIdKey`)를 신설해, fx 이벤트/씬 스키마(§6/§8의 키 목록)에는 애초에 원시 id를 담을
키가 없다는 사실(`rosterId`/`artRosterId`/`battleId`만 허용, 셋 다 문자열 종 코드이거나 룸 수명 카운터이지
숫자 PID가 아니다)을 **키 이름 자체로** 검사한다 — 값의 우연한 숫자 겹침·일치와 전혀 무관한 참으로,
독립적인 2중 방어다. rosterId·name·skill·seed·cap 등 기존 양성/음성 통제는 그대로 유지했다(약화 없음).
검증: `node server/authoritative/test/test-battle-fx.js` 반복 실행(25회 연속 0 실패, 종전 결함 재현
빈도(15~20%)를 충분히 덮는 표본) + `npm test`(server, 전체 체인) 1회 통과.

## 0. v1 → v2 변경 이유 (PD REVISE 5개 요구 대응)

| # | v1의 공백 | v2 대응 |
|---|---|---|
| 1 | `countStep`/`roundBanner`의 `fxPlay(...)` 호출 자체가 `if(fxLive())` 안(index.html:3353·3357)이라 헤드리스에서 호출조차 안 됨 — `FX.log` 훅만으론 절대 복구 불가 | §3 "선언적 stage 합성" — `battle.intro`/`battle.bannerKey`(원본이 이미 세우는 확정 상태)를 읽고, 문구는 원본이 노출하는 순수 함수(`actorOfPhase`·`fxTurnLabel`·`viewerIsOwner`)로 재계산 |
| 2 | `battle=null` 이후 마지막 타격이 "어느 무대(어떤 두 전투원)"의 것인지 알 방법이 없음, 연속 전투 구분 불가 | §4 `battleId`(룸 수명 동안 유일·단조) + `scene`(공개된 겉모습 스냅샷, `battleStart`·`resultBanner`에 동봉) |
| 3 | 재접속/갭 baseline이 "40개 유한 보관"이라고만 되어 있고 큐잉 vs 재생 커서 구분·새 room 경계가 불명확 | §6 "재접속·재전송·resync 소비 계약" — enqueue 커서/play 커서 분리, `room_resumed` 전용 규칙, `(epoch,roomId,seat)` 경계 명시 |
| 4 | explosion/trap 셀 좌표를 "Mars가 board diff로 추측"하라고 함 — 명시적으로 금지된 접근 | §5 "Mars 훅 계약" — 정확한 삽입 위치·1줄짜리 코드·인자·중복 방지 조건을 명시해 PD 경유 전달(msg_fb108078aa15) |
| 5 | "화이트리스트 키 모양"만 검사하고 실제 미공개 상대 정보 부재를 실측하지 않음 | `test-battle-fx.js` T12 — 전투에 관여하지 않는 실제 미공개 상대 하수인의 raw id·rosterId·이름·기술 id가 fx 문자열 전체에 없음을 실측(대조군으로 실제 공개된 개체는 있어야 함도 함께 확인) |

## 0-1. v2 → v3 변경 이유 (Saturn 독립 QA REVISE 대응, fx-qa-revise.md)

Saturn이 헤드리스 스위트(`npm test`)가 아니라 **독립 inline 실제 호출**로 재현한 결함 3건. 등급·재현 조건은
fx-qa-revise.md 원본 표를 그대로 인용한다 — 이 표는 v2의 무엇이 왜 바뀌었는지만 남긴다.

| 등급 | Saturn 재현(startedRoom) | v2의 결함 | v3 대응 |
|---|---|---|---|
| P1 | 1874205 — 폭탄 접촉이 곧장 전멸(경기 종료)로 이어지는 실전 흐름 | `explosion`/`trapFx`(cells)를 `S.__ddFxCells`에 큐잉해 뒀다가 **매 `withEngine` 종료 시 한 번에** 드레인했다 — 그사이 같은 호출 안에서 실시간 캡처되는 `resultBanner`가 먼저 seq를 받아, 실제 원인(explosion)이 결과(resultBanner)보다 **늦게** 기록됐다 | §5 — `S.__ddFxCells.push(...)` 자체를 `hookMsgQ`와 같은 패턴으로 인스턴스 단위 후킹해, Mars가 실제로 push하는 그 순간(원래 FX 지점, `fxPlay(explosion/trapFx)` 바로 앞)에 즉시 이벤트화한다. `withEngine` 종료까지 미루지 않으므로 이후에 나는 결과보다 항상 먼저 seq를 받는다. `test-battle-fx.js` T15로 실제 `initBattle(bomb,victim)` 경로에서 고정 |
| P1 | 1874206 — 정상 종료된 전투 뒤 완전히 무관한 별도 `gameOver(0,"king")` | §4 `currentBattleIdFor`가 `resultBanner` 키만 보면 **영구히** `lastBattleId`를 돌려줘, 그 전투와 무관한 훨씬 나중의 `resultBanner`에도 옛 `battleId`·`scene`이 계속 붙었다 | §4 — `T.__fx.gen`(withEngine 호출마다 증가하는 세대 카운터)을 도입한다. 배틀이 닫히는 순간(`hookBattleAccessor`의 `set(null)`)에 `resultCtxGen = gen`을 찍어 두고, `currentBattleIdFor`는 **같은 세대의 resultBanner에만** 그 문맥(`battleId`+`scene`)을 잇는다 — 다음 `withEngine` 호출(=다음 세대)부터는 자동으로 `battleId:null`(scene 없음)이 된다. `test-battle-fx.js` T16으로 실제 `gameOver` 직접 호출 경로에서 고정 |
| P2 방어 강화 | 1874204 — `toSeatView`가 돌려준 `view.fx`의 msg 이벤트 `fx.hp`를 변조 후 재조회 | `room.js` `_serializeFxEvent`가 msg 이벤트의 `fx`(및 그 안의 `float`/`hp`/`st` 서브 객체)를 **참조 그대로** 반환했다 — 반환된 view를 변조하면 `T.__fx.items`에 영구 저장된 바로 그 객체가 함께 오염돼, 같은 seq를 다시 읽거나(`resync`) 재전송해도 변조가 그대로 보였다(`sameRef===true`) | `room.js`에 `_serializeFxMsgFx` 신설 — `scene`/`cells`와 같은 관례로, 매 호출마다 원시 필드만 골라 **새 객체**(및 새 `float`/`hp`/`st` 서브 객체)를 짓는다. 내부 저장소와 반환값이 항상 독립된 참조를 갖는다(이중 화이트리스트). `test-battle-fx.js` T17로 변조 후 재조회·resync 양쪽에서 원값 보존을 고정 |

세 수정 모두 **프로토콜 필드·규칙·RNG는 바꾸지 않는다** — §4·§5·§6의 스키마·계약은 v2와 동일하고, "언제 이벤트를
만드는지"(P1 2건)와 "반환 시 참조를 공유하는지"(P2)만 고쳤다. Mars 소비 계약(§7)·wire 스키마(§6)도 그대로다.

## 1. 근본 원인 — 무엇이 왜 사라지는가

`demo/index.html`은 이미 구조화된 표시 신호를 만든다:
- `bmsg(txt,fx,opts)`(index.html:3593)가 `S.battle.msgQ`에 `{txt,fx,key,big}`를 push한다. `fx`는
  `{shake,sig,flash,ko,float:{side,html},hp:{side,val,max},st:{side,text,max,shield}}` 같은 구조화 필드다.
- `fxPlay(item)`(index.html:1600)가 무대 배너를 큐잉하며, 헤드리스(`fxLive()===false`)에서도 `FX.log`에
  `{key,title,sub,kind,turn,ms,t,shown}`를 **호출만 되면** 남긴다(1602행 — `ms<=0` 조기 반환보다 먼저 실행).

문제는 두 갈래다:
1. **소비 직후 폐기**: `playMsgs()`(3598행)는 `liveBattleDom()===false`일 때 `MSGQ.length=0`으로 즉시 비운다
   (3601행) — `bmsg`의 `fx` 구조체가 서버 응답에 실리기 전에 사라진다.
2. **호출 자체가 안 됨**: `countStep`(3353행)·`roundBanner`(3357행)의 `fxPlay(...)` 호출 자체가
   `if(fxLive())` 블록 **안**이다 — 헤드리스에서는 그 줄 자체가 실행되지 않으므로 `FX.log`에 아무것도
   남지 않는다(v1의 실수 — "fxPlay는 항상 로그를 남긴다"는 fxPlay **내부** 조기 반환 이야기이지, fxPlay
   **호출 자체**가 조건문 밖에 있다는 뜻이 아니었다).

## 2. 캡처 방식 — 규칙/RNG를 건드리지 않는 안전한 관측점

`demo/index.html`·`demo/test/shared/harness.js`는 read-only다(#217 계약). `server/authoritative/engine.js`만
수정해 이미 존재하는 값을 소비 직전에 가로챈다 — 규칙 함수를 호출하거나 새 값을 계산하지 않는다:

1. **`FX.log`**: `T.FX.log`(module-scope, 게임 내내 재할당 안 됨)에 인스턴스 단위 `push` 후킹을 엔진 생성
   직후 1회 설치. `turnBanner`·`contactBanner`·`pushBanner`·`fleeFx`·`explosion`(좌표 제외, §5)·`trapFx`
   (좌표 제외, §5)처럼 **호출부 자체가 `fxLive()` 게이트 없이 무조건 실행**되는 것만 여기서 잡힌다.
2. **`S.battle.msgQ`**: `S.battle`은 전투마다 새 객체로 재할당된다(initBattle, index.html:2956). `S`에
   `battle` 접근자(`Object.defineProperty` getter/setter)를 1회 설치해 **대입되는 순간** 그 `msgQ` 배열에
   인스턴스 단위 `push` 후킹을 추가한다. 같은 순간 `battleId`를 새로 발급하고 공개 `scene`을 뜬다(§4).
3. 두 후킹 모두 **원본 push를 그대로 통과**시킨다(`Array.prototype.push.apply` 위임) — 반환값·부작용 동일,
   프로토타입은 건드리지 않아 다른 배열·다른 엔진(좌석)엔 영향이 없다(engine.js 197행
   `Object.defineProperty(box,'innerHTML',...)`와 같은 기법 — 새 패턴 아님).

## 3. 선언적 stage 합성 — countStep/roundBanner (PD REVISE 1번)

호출 자체가 안 되는 두 배너는 **다른 관측점**이 필요하다. 원본이 "이 배너를 이미 보여줬다"를 추적하려고
스스로 세우는 확정 플래그를 그대로 읽고, 문구는 원본이 노출하는 순수 함수를 그대로 호출한다 — 새 판정도
새 텍스트도 만들지 않는다:

- **`battleStart`**(countStep 대체): 원본의 4개 카운트다운 프레임("3","2","1","배틀 시작!")은 상태와 무관한
  고정 상수라 서버가 새로 지을 근거가 없다. 그래서 서버는 문구를 흉내 내지 않고, **battle이 새로 열리는
  확정 전이 그 자체**(engine.js `hookBattleAccessor`의 `set(v)`, S.battle이 대입되는 순간)를 근거로
  "지금 카운트다운을 재생해도 되는 확정 상태 전환이 있었다"만 선언한다(`key:"battleStart",kind:"count"`,
  `title/sub`는 빈 문자열). 실제 3·2·1·배틀 시작! 프레임 구성·타이밍은 Mars 표시 계층이 이 신호를 트리거로
  삼아 자기 UI로 재생한다(원본 문구를 서버가 복제하지 않는다 — 정확히 한 번, `battle` 재할당당 한 번만 난다).
- **`roundBanner`**: 원본이 이미 세우는 `battle.bannerKey`(=`round+"-"+phase`, index.html:3355-3356, 헤드리스
  에서도 무조건 갱신됨)를 `withEngine` 종료 시점마다 확인해, 우리가 마지막으로 내보낸 값과 다르면(=그 사이
  원본 기준으로 배너가 필요했다는 뜻) 그때만 이벤트를 낸다. 문구는 원본과 완전히 같은 계산:
  `title = fxTurnLabel(actorOfPhase()==='A'?battle.attP.owner:battle.defP.owner, true)`,
  `sub = "Round "+battle.round+" / "+BAL.maxRounds`(원본 index.html:3107·3357과 동일 — `BAL.maxRounds`를
  그대로 쓰는 것도 원본과 같다, 시간의 수호자로 실제 상한이 줄어도 sub 표시는 원본처럼 전역값을 보여준다),
  `cls = viewerIsOwner(ownerP) && !(mode==="pvp"&&!NET.mode) ? "mine" : ""`. 세 함수(`actorOfPhase`·
  `fxTurnLabel`·`viewerIsOwner`) 모두 harness.js가 이미 노출하는 원본 함수이며 부작용이 없다.
- 이 합성은 **매 `withEngine` 호출이 끝난 뒤**(그 행동이 만든 연출 체인이 전부 가라앉아 상태가 최종 확정된
  뒤)에만 실행한다 — 규칙 재계산·RNG 없이 "확정 상태 전환 근거"만 본다(원 태스크 계약 그대로).

## 4. `battleId`·`scene` — 연속 전투·종료 후 문맥 (PD REVISE 2번)

전투가 끝나면(`S.battle=null`) `battle.a/d`도 함께 사라져 "마지막 타격이 어느 두 전투원의 것인지" 알 방법이
없고, 연속 전투에서는 `round`/`actSeq`만으로 새/옛 전투를 구분할 수 없다(둘 다 매번 0/1부터 다시 센다).

- **`battleId`**: `S.battle`이 새로 대입될 때(§2-2) 엔진별 카운터를 하나 증가시켜 발급한다 — **룸(엔진)
  수명 동안 유일·단조 증가, 재사용 없음**. `src:"msg"` 이벤트는 캡처 시점의 `T.__fx.lastBattleId`를,
  `src:"stage"` 이벤트는 `battle`이 열려 있으면 같은 값을 붙인다. 전투와 무관한 배너(턴/접촉/밀기/도망)는
  그 시점에 전투가 없으면 `battleId:null` — 옛 전투에 잘못 걸리지 않는다.
  **v3 REVISE(Saturn startedRoom(1874206), §0-1)**: `battle=null` 이후의 트레일링 배너(`resultBanner`)는
  직전 전투의 `battleId`를 그대로 잇되, **그 전투가 닫힌 바로 그 `withEngine` 호출 안에서 난 것일 때만**
  이어 붙인다 — "직전 전투의 것을 그대로 쓴다"가 영구 규칙이면, 그 뒤 완전히 무관한 사유(별도 `gameOver`
  호출 등)로 훨씬 나중에 난 `resultBanner`에도 옛 문맥이 계속 달라붙는다. `T.__fx.gen`(withEngine 호출마다
  증가하는 세대 카운터)을 두고, 배틀이 닫히는 순간(`hookBattleAccessor`의 `set(null)`)에
  `T.__fx.resultCtxGen = T.__fx.gen`을 찍는다. `currentBattleIdFor`는 `resultBanner` 키에 한해
  `resultCtxGen === gen`(=같은 세대, 즉 그 전투가 실제로 그 결과를 만든 바로 그 호출)일 때만
  `lastBattleId`를 돌려주고, 아니면 `null`이다 — 다음 `withEngine` 호출(다음 세대)부터는 자동으로
  무관해진다. `scene`도 이 판정과 같은 조건(§ 아래)으로만 동봉한다.
- **`scene`**: 전투 시작 시(`battleStart`) 그 전투 두 전투원의 **겉모습 정체만**
  `{owner,type,element,bodyFight,rosterId,artRosterId}`(room.js `_serializeBattle`의 `side()`와 완전히
  같은 화이트리스트 — hp·shield·skills·cap은 전혀 없다)로 한 번 뜬 뒤, `resultBanner`에도 **다시 동봉**한다
  (한쪽만 있으면 40개 보관 창에서 시작 이벤트가 먼저 밀려나도 종료 이벤트만으로 무대를 그릴 수 있게 이중화).
  scene의 정보량은 이미 그 전투 시작 시점에 `battle.a/d`로 양쪽에 공개됐던 것과 완전히 같다 — 새 노출이 아님.
- Mars 소비: 어떤 msg/stage 이벤트든 `battleId`로 묶어 "이 이벤트가 어느 전투의 것인지" 판정하고,
  `battleStart`/`resultBanner`의 `scene`으로 그 전투의 무대(패널/토큰)를 구성한다. **다른 battleId의 이벤트를
  현재 열려 있는(또는 방금 연) 전투 무대에 섞어 재생하지 않는다** — 이게 "연속 전투에서 옛 FX를 새
  전투원에 적용 금지"의 서버 측 보장이다.

## 5. Mars 훅 계약 — explosion/trap 셀 좌표 (PD REVISE 4번) — **완료·실측 확인**

`explosionFx(pieces)`/`trapFxPlay(trap,victim)`(index.html:2786-2798)는 `fxPlay(...)` 호출 자체가
`fxLive()` 게이트 **없이** 무조건 실행되므로 `key`/`kind` 신호는 이미 §2-1로 잡힌다 — 없는 건 좌표뿐이다.
`cells`는 `fxPlay`에 넘기는 지역 변수인데, `hold`(폭발/함정 칸의 실제 piece 참조)와 함께 `ms<=0` 조기
반환 이전에만 존재해 서버가 닿을 수 있는 공유 객체에 오르지 못한다 — **board diff로 셀을 추측하지 않는다**
(명시적으로 금지됨).

**Mars가 이미 반영 완료했다**(index.html:2792·2796, 2026-09-13, PD 경유 msg_fb108078aa15 → guard 조건
보완 msg_16e693d42efe REVISE → Mars 재반영):

```js
// explosionFx(pieces) 안, 기존 fxPlay({key:"explosion",...}) 호출 바로 앞 — 실제 반영된 코드(index.html:2792)
if(Array.isArray(S.__ddFxCells)) S.__ddFxCells.push({key:"explosion",cells:hold.map(h=>[h.r,h.c])});
```
```js
// trapFxPlay(trap,victim) 안, 기존 fxPlay({key:"trapFx",...}) 호출 바로 앞 — 실제 반영된 코드(index.html:2796)
if(Array.isArray(S.__ddFxCells)) S.__ddFxCells.push({key:"trapFx",cells:[[trap.r,trap.c],[victim.r,victim.c]]});
```

최초안(`(S.__ddFxCells||(S.__ddFxCells=[]))`로 데모가 스스로 큐를 만드는 방식)은 서버가 없는 PVE/hotseat
(로컬 단독 실행)에서 아무도 그 큐를 드레인하지 않아 게임 내내 무한히 쌓인다는 PD 지적(msg_16e693d42efe)을
받아 바꿨다 — **큐 생성은 서버(`engine.js` `ensureFxCellsQueue`)만** 새 `S` 인스턴스마다 non-enumerable로
미리 설치하고, 데모는 **이미 배열일 때만** push한다(`Array.isArray` 가드, 절대 스스로 만들지 않음). 서버가
만든 `S`에서만(=권위 서버 경로에서만) 이 필드가 존재하므로, PVE/hotseat(순수 demo/index.html 실행, 서버
없음)에서는 이 필드 자체가 없어 데모 쪽 push가 조용히 아무 일도 하지 않는다 — 무한 보관·규칙 상태
(`JSON.stringify(S)` 기반 `_stateFingerprint`) 오염 걱정이 없다(non-enumerable이라 애초에 그 직렬화에도
안 잡힌다).

계약 조건: (1) 이미 `fxPlay`에 넘기는 `cells` 값(순수 `[r,c]` 숫자쌍)을 그대로 재사용 — 새 계산 없음.
(2) `hold`(piece 참조)는 절대 넣지 않음. (3) `Array.isArray(S.__ddFxCells)` 가드 없이 무조건 push하지
않음(위 REVISE 이유). (4) 연쇄 폭발(한 행동에 여러 번)도 쌓인 순서 그대로 각각 별도 이벤트가 되고,
**이미 확정된(seq가 붙은) 이전 이벤트는 절대 다시 손대지 않는다**(항상 새 이벤트만 추가) — 중복도,
규칙/RNG 변화도 없다(`test-battle-fx.js` T13으로 고정).

**v3 REVISE(Saturn startedRoom(1874205), §0-1) — 소비 시점을 "withEngine 종료"에서 "push 그 순간"으로
당김**: v2는 `S.__ddFxCells`를 그냥 배열로 두고 **매 `withEngine` 종료 시 한 번에** 읽어(`splice(0)`)
이벤트화했다. 그런데 explosionFx/trapFxPlay는 이 큐에 push한 바로 다음 줄에서 `fxPlay(...)`를 부르고, 그
폭발이 곧장 KO·경기 종료로 이어지면 `resultBanner`가 **같은 `withEngine` 호출 안에서 그보다 먼저** FX.log
경로(§2-1)로 실시간 캡처된다 — 실제로는 explosion이 먼저 일어났는데도 explosion의 seq가 withEngine 종료
시점까지 미뤄져 결과보다 늦게 발급됐다(원인이 결과보다 늦게 기록됨). 고쳐서 `S.__ddFxCells`는 이제 "일반
배열"이 아니라 `hookMsgQ`(§2-2)와 완전히 같은 패턴으로 **push 자체를 인스턴스 단위 후킹**한 것이다 — Mars가
실제로 push를 호출하는 그 순간(=원래 FX 지점, `fxPlay(explosion/trapFx)` 바로 앞)에 즉시 이벤트를 만든다.
더 이상 `withEngine` 종료까지 미루지 않으므로 이후에 일어나는 `resultBanner`보다 항상 먼저 seq를 받는다.
실제 배열에는 아무 것도 남기지 않는다(push는 `this.length`만 돌려주고 저장은 안 함) — "소비 후 큐는 즉시
비워짐"(T13) 계약을 실제 저장 없이 그대로 만족한다. Mars가 보는 `S.__ddFxCells` 계약(위 (1)~(4))·데모 쪽
코드(index.html:2792·2796)는 **전혀 바뀌지 않는다** — 서버 쪽 소비 시점만 당겼다. `test-battle-fx.js`
T15로 실제 `initBattle(bomb,victim)`이 곧장 전멸로 이어지는 경로에서 `explosion.seq < resultBanner.seq`를
고정했다.

**실측으로 발견·수정한 버그(2026-09-13, 같은 세션)**: Mars 훅 반영을 실제 `initBattle`(폭탄/함정 접촉)으로
end-to-end 확인하는 중, `explosion`/`trapFx`가 **이벤트 2개로 중복** 생성되는 것을 발견했다 — `hookFxLog`
(§2-1, 좌표 없이 `key/kind`만)와 이 절(좌표 있는 완전한 이벤트)이 **같은 실제 사건**을 각자 독립적으로
이벤트화하고 있었다. `hookFxLog`가 `explosion`/`trapFx` 키를 아예 건너뛰도록 고쳐(이 절의 push 훅이
유일한 출처가 되도록) 해소했다 — 실제 폭탄 접촉 1회 = 서버 이벤트 정확히 1개(`cells` 포함)를
`test-battle-fx.js` T14로 end-to-end 고정했다(합성이 아니라 실제 `initBattle`→`bombAttack`/`trapFxPlay`
경로로 검증, v3의 push-훅 전환 이후에도 동일하게 성립).

## 6. wire 스키마

`toSeatView(seatIndex)` 응답 최상위(전투 여부·room state와 무관하게 항상 존재)에 `fx` 필드:

```jsonc
"fx": {
  "firstSeq": 41,  // 이번에 실린 창의 첫 seq (이벤트가 하나도 없으면 null, lastSeq는 0)
  "lastSeq": 47,   // 이 엔진이 지금까지 발급한 마지막 seq(버려진 오래된 것 포함 총계 커서)
  "events": [
    { "seq": 45, "src": "msg", "battleId": 3, "round": 3, "actSeq": 7, "key": "damageFx", "big": false,
      "txt": "37 피해! · 유효 37",
      "fx": { "shake": "D", "float": { "side": "D", "sign": "neg", "amount": 37 },
              "hp": { "side": "D", "val": 63, "max": 100 } } },
    { "seq": 46, "src": "stage", "battleId": 3, "turn": 12, "key": "roundBanner", "kind": "banner",
      "title": "나의 턴!", "sub": "Round 4 / 8", "cls": "mine" },
    { "seq": 47, "src": "stage", "battleId": 3, "turn": 12, "key": "battleStart", "kind": "count",
      "title": "", "sub": "", "scene": { "a": {"owner":0,"type":"minion","element":"fire","bodyFight":true,"rosterId":"M-F1","artRosterId":null},
                                          "d": {"owner":1,"type":"minion","element":"water","bodyFight":true,"rosterId":"M-W1","artRosterId":null} } }
  ]
}
```

필드:
- `seq`: **엔진(좌석)마다 독립**된 단조 증가 정수, 게임 시작부터 절대 재사용하지 않는다.
- `battleId`: §4. 전투와 무관한 이벤트는 `null`.
- `round`/`actSeq`: `src:"msg"`에만(그 시점 `S.battle.round`/`actSeq`). `turn`: `src:"stage"`에만(`S.turnCount`).
- `cls`: `roundBanner`에만, `"mine"`이거나 생략(원본 배너의 `mine` 클래스와 동일 조건, §3).
- `cells`: §5 Mars 훅이 실제로 값을 채운 `explosion`/`trapFx` 이벤트에만 `[r,c]` 숫자쌍 배열(최대 16개, 방어적 상한).
- `scene`: `battleStart`/`resultBanner`에만(§4), 그 외 이벤트엔 없음.
- **유한 보관**: 엔진 내부 버퍼는 최근 40개만 유지(`log`/`battle.log`의 `.slice(-40)` 관례와 동일 크기).
- 표시 전용 — 클라이언트도 서버도 `fx.events`로 규칙을 판정하지 않는다.

## 7. 재접속·재전송·resync 소비 계약 (PD REVISE 3번)

"40개 유한 보관"만으로는 (a) 큐잉과 실제 재생을 구분 못 하고 (b) 재접속처럼 큰 갭에서 오래된 이펙트가
뒤늦게 재생돼 오염되는 것을 못 막는다. 아래를 **Mars가 지킬 baseline 계약**으로 명시한다(서버는 이미
이 계약이 성립하도록 `seq`·`epoch`·프레임 타입을 제공한다 — 서버 코드 변경은 필요 없다):

1. **두 커서를 분리해 `(epoch, roomId, seat)` 단위로 보관**: `enqueuedSeq`(로컬 재생 큐에 이미 넣은 최대
   seq)와 `playedSeq`(실제로 애니메이션이 끝난 최대 seq). 새 room(재대전)이나 `epoch`가 바뀌면(서버 재시작)
   **둘 다 0으로 리셋** — 서버 프레임은 이미 매번 `epoch`·`roomId`를 싣는다(protocol.md §2), 그 튜플이
   바뀌면 이전 seq와 절대 비교하지 않는다.
2. **일반 `room_state`(액션 응답·push·`resync`)**: `fx.events`에서 `seq > enqueuedSeq`인 것만 순서대로
   로컬 큐에 추가하고 `enqueuedSeq = fx.lastSeq`로 갱신한다. `resync`나 dedup 캐시 재전송은 항상 **같은
   `seq`가 같은 내용**이므로(§6) 이 규칙만으로 중복 재생이 원천적으로 생기지 않는다 — 별도 "resync 특별
   처리"가 필요 없다.
3. **갭(창 밖으로 밀려난 구간)**: 이번 응답의 `enqueuedSeq`(갱신 전 값)가 `fx.firstSeq - 1`보다 작으면
   그 사이 최근 40개 밖으로 밀려난 이벤트가 있다는 뜻이다. **그 구간을 합성·역추정하지 않는다** — 그냥
   현재 창에 있는 것부터(2번 규칙 그대로) 이어 재생한다. snapshot(`battle`/`you`/`units`)은 항상 최신이라
   정합성 문제는 없고, 사라진 옛 이펙트만 조용히 스킵된다.
4. **`room_resumed`(진짜 재접속, 서버 프레임 타입으로 이미 `room_state`와 구분됨 — protocol.md §2)는 더
   보수적으로 다룬다**: 플레이어가 소켓을 다시 여는 시점이므로, 창에 남아 있는 오래된 애니메이션을 뒤늦게
   전부 재생하면 오히려 혼란스럽다. 권장 baseline: `enqueuedSeq = playedSeq = fx.lastSeq`로 **한 번에
   맞추고**(창의 이벤트를 순차 재생하지 않는다), 단 창의 마지막 이벤트가 `resultBanner`이거나 `src:"msg"`
   이고 `fx.ko`가 있으면(직전에 결전이 있었다는 뜻) 그 마지막 한 이벤트만 예외적으로 재생해 "재접속하자마자
   결과가 보인다"를 만족시킨다. 이 baseline은 [Jupiter 권장 — Mars 확정] 항목이다: 서버는 필요한 재료
   (`fx`, 프레임 타입 `room_resumed`)만 제공하고 정확한 재생 정책은 클라이언트 UX 판단으로 Mars가 최종
   결정한다.
5. 이 계약은 서버 코드가 아니라 **소비 규칙**이므로 protocol.md §7.2에도 동일하게 반영했다 — 여기서 바뀌면
   그쪽도 함께 고친다.

## 8. 좌석별 안전성·프라이버시

room.js는 좌석마다 독립된 엔진 인스턴스를 돌린다(`this.engines[seatIndex]`, `_apply()`가 동일 action을
양쪽에 순서대로 적용) — 각 엔진의 `NET.me`가 그 좌석 고유값이라 `viewerIsOwner()`가 갈라지는 모든 텍스트·
마스킹이 이미 그 좌석 관점으로 만들어진다(`log`·`modal.html`과 동일 전제). 그 위에 다음을 원시 타입만
남기고 재구성한다(객체를 통째로 넘기지 않음 — room.js 기존 `_serialize*` 관례):
- `fx.float.html`(예: `<span class="neg">-37</span>`) → 고정 템플릿만 디코드해 `{side,sign,amount}`로.
- `hold`/`onStart`/`onEnd`/원시 piece → 절대 전송하지 않음(§2, §5).
- `scene`은 room.js가 다시 알려진 키만 골라 재구성(엔진 캡처 경로를 신뢰하지 않는 이중 화이트리스트).

**v3 REVISE(Saturn startedRoom(1874204), §0-1) — msg 이벤트의 `fx`도 참조가 아니라 재구성한 새 객체**:
v2는 `_serializeFxEvent`의 `src:"msg"` 분기에서 `fx: e.fx`로 engine.js가 이미 정규화해 둔 객체를 **참조
그대로** 돌려줬다. `scene`/`cells`는 매 호출마다 새 객체를 짓는데 이 필드만 예외였다 — 그래서 호출자가
`toSeatView`가 돌려준 `view.fx.events[i].fx.hp.val` 같은 중첩 필드를 변조하면, `T.__fx.items`에 영구
저장된 바로 그 객체가 함께 오염돼 같은 seq를 다시 읽거나(`resync`) 재전송해도 변조가 그대로 보였다
(`sameRef===true`). `room.js`에 `_serializeFxMsgFx`를 신설해 `shake`/`sig`/`flash`/`ko`와 `float`/`hp`/
`st`(각각 새 서브 객체)만 골라 **매 호출마다 새 객체**로 짓는다 — `scene`/`cells`와 동일한 이중 화이트리스트
관례로 통일했다. 내부 저장소와 반환값은 이제 항상 독립된 참조를 가지므로, 반환된 view를 변조해도 다음
조회·`resync`에는 전혀 반영되지 않는다.

**실측 검사**(test-battle-fx.js T12, PD REVISE 5번): 전투에 관여하지 않는 실제 미공개 상대 하수인을
따로 골라, 그 raw id·rosterId(종)·이름·기술 id가 fx 문자열(양 좌석 JSON 통째로) 어디에도 없음을 확인하고,
대조군으로 실제 전투에 쓰인 개체의 rosterId는 정상적으로 보임을 함께 확인해 검사 자체의 유효성도 검증한다.
`seed`·`cap` 키도 부재를 확인한다(A4 관례 재사용).

**실측 검사**(test-battle-fx.js T17, §0-1 P2): `toSeatView`가 돌려준 msg 이벤트의 `fx.hp.val`을 변조하고
알려지지 않은 필드(`injected`)를 주입한 뒤 같은 seq를 재조회·`resync` 양쪽에서 원래 값 그대로임과, 반환된
`fx` 객체가 이전 호출과 다른 참조(`sameRef=false`)임을 확인한다.

## 9. 검사

`server/authoritative/test/test-battle-fx.js`(420개 단언 — v2 229개 + v3 Saturn 회귀 T15~T17 + T12
재작성) — 순서(엔진당 seq 연속 증가)·정규화 모양(화이트리스트 키만)·`battleStart`(정확히 1회, battleId+scene
동봉)·`roundBanner`(round/phase 전환마다 좌석별 거울 문구, cls)·연속 전투 battleId 격리(옛 battleId가 새
전투 이후 이벤트에 다시 안 붙음)·`resultBanner`의 scene 보존(battle=null 이후에도)·VOID로 engines가 실제로
사라져도 `Room._fxCache`로 보존·재전송/resync가 새 seq를 안 만듦·유한 보관(40 초과 시 firstSeq 전진, 40개
초과를 실제로 만들지 못하면 그 자체로 실패)·미공개 상대 정보 실측 부재(T12 — 구조적 화이트리스트
`hasUnsafeIdKey` + collision-free sentinel `numberAppearsStandalone`으로 재작성, §0-1 아래 단락 참조)·
explosion/trap cells 큐 계약
(non-enumerable 설치, 연쇄 다중 push 순서 보존, 이전 이벤트 불변, T13)·**실제 Mars 훅 경유 explosion/trap
end-to-end**(합성이 아니라 진짜 `initBattle`→`bombAttack`/`trapFxPlay` 호출로 cells 확인, 중복 이벤트
없음, T14). **v3 Saturn 회귀(§0-1)**: T15(실제 폭탄 접촉이 곧장 전멸로 이어지는 경로에서
`explosion.seq < resultBanner.seq`)·T16(정상 종료 뒤 무관한 `gameOver`의 resultBanner는 옛
battleId/scene을 물려받지 않고 null)·T17(반환된 msg fx를 변조해도 재조회·resync 스토어가 오염되지 않음,
sameRef=false). 기존 스위트 전부(`npm test`) 회귀 없이 PASS(match-fuzz 6시드 완주 시간도 기존과 동일
수준, 약 9초).

## 10. 남은 제한/후속

- `roundBanner`는 한 번의 `withEngine` 호출 안에서 (round,phase)가 두 번 이상 건너뛰면 마지막 상태 하나만
  낸다(1v1 전투 규칙상 한 행동이 두 번 이상 라운드를 진행시키는 경로는 없어 실질적으로 발생하지 않는다).
- §7의 `room_resumed` 재생 정책은 서버가 강제하지 않는 **권장 baseline**이다 — Mars가 실제 UX로 확정하면
  이 문서를 그 결정으로 갱신한다.
- `Array.prototype`이 아니라 인스턴스 단위 후킹만 쓰므로 성능 영향은 무시할 수준(§9, match-fuzz 시간 불변).
