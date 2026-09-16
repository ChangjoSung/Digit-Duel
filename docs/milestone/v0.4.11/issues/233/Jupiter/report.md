# Issue #233 — Jupiter (Server) 작업 보고

- 역할: `required_role=Jupiter · mode=IMPLEMENT · area=SERVER · mutation=code · instance_index=null`
- 날짜: 2026-09-16
- 기준 문서: `C:/dd_cdp/issue-233-gdd.md` (GDD-23) 3장 · 4장, `docs/creat2ve/QA_MINIMUM_POLICY.md`
- 수정 파일: `server/authoritative/room.js` · `server/package.json` (1줄 — **PD 승인 후** 추가, 아래 4항)
- **6장은 2026-09-16 CJ 승인 복구 dispatch(`ctx_db4d48884dc5`)의 추가분이다.** 1~5장은 그 이전 상태의 기록으로 보존한다 —
  당시 판정을 소급해 고치지 않는다. 최종 엔진 상태에 대한 계약은 6장이 최신이다.
- 신규 파일: `server/authoritative/test/test-combat-stats-boundary.js`
- Git 쓰기 없음. GitHub·Notion 쓰기 없음. `demo/index.html`(Mars 소유)·PD 문서·`original art/`·`orca-hook-latency-report.md` 미변경.
- **자기 인증하지 않는다.** 아래는 실행한 검사와 그 결과일 뿐이고, 판정은 Saturn 독립 QA와 CJ 플레이 QA의 몫이다.

---

## 0. 현재 상태 요약 (2026-09-16 최신 — 여기만 읽어도 된다)

아래 1~5장은 **이전 상태의 이력**이고 6장은 그 다음 복구분이다. 7장이 최종 계약이다.
본문에 나오는 **`458 passed`(3.1)·`535 passed`(6.4)는 그때그때의 이력 수치**이고, **현재 수치는 `547 passed`**다.

### 계약 — 한 장 요약

| 구분 | 내용 |
|---|---|
| **좌석 프레임(클라이언트로 나가는 것)** | **추가 0개.** 1~5장에서 정한 범위(자기 좌석 11필드 / 전투 뷰 `crack`·`harden`·`hardenPct`) 그대로다. 6·7장에서 한 필드도 늘리지 않았다. |
| **락스텝 요약(서버 내부 전용)** | 12필드 추가 — `battle.firstSide`, 그리고 `fighter()` 에 `evadeBuffR` `dmgUpBuffR` `shockFresh` `crackFresh` `hardenFresh` `evadeBuffRFresh` `dmgUpBuffRFresh` `critForce` `dodgeForce` `vanguardTurn` `burnFresh`. `pendingFx` 항목 모양은 `roundsLeft` → `[roundsLeft, tag]`. |
| **공개 방 선턴 복원** | 서버는 `battle.actor` 만 공개하고 `firstSide` 는 **보내지 않는다.** 클라이언트가 `bd.actor`+`bd.phase` 에서 복원한다(권장 A, PD가 Mars에 전달). 경계를 검사로 고정했다. |

### 검사 — 현재 수치

| 스위트 | 결과 |
|---|---|
| `test-combat-stats-boundary` | **547 passed, 0 failed** (Mars 최종 계약 반영 엔진 기준 — `burnFresh` · `scheduleDelayed` 4인자 · 클라 `firstSide` 복원 포함) |
| `test-match-fuzz` (요약 소비자) | 16 passed, 0 failed — 6,254 accepted 입력·397 전투 행동, 락스텝 분기 0 |
| `test-room` (요약 소비자) | 57 passed, 0 failed |

### 제한 — PASS로 주장하지 않는 것

- `npm test` 전체·필수 CI B는 이 워크트리에서 실행하지 못했다(`server/node_modules` 없음 — `ws` 미해결). **PD가 PR 단계에서 1회 필수 실행 예정**이다.
- **`pendingFx` 의 `tag` 는 서명·저장 경로까지 실제 엔진으로 검증했지만, 이를 부르는 기술(호출처)은 0개다** — 실제 예고 피해가 도는 것은 보지 못했다. #234 담당이 기술 id 를 넘긴다(7.2).
- `vanguardTurn` 도 이를 켜는 기술이 없다(#234 전까지). 계약만 닫았다.
- 2브라우저 수동 온라인 검증 기록 없음. 이번 두 dispatch가 좌석 프레임을 0필드 바꿨다는 것이 근거다.
- `burnBy`·`rec`(피해 기록 귀속)는 **의도적으로 넓히지 않았다** — 종전부터 요약에 없던 값이고 이번 범위 밖이다. **알려진 미탐지 구간**이다(7.4).
- 자기 QA 판정 없음. 판정은 Saturn 독립 READ_ONLY QA와 CJ 플레이 QA의 몫이다.

---

## 1. 문제 — #233이 권위 서버에 만든 두 개의 구멍

Mars가 `demo/index.html`에 GDD-23 3·4장의 8스탯 전투 엔진을 넣었다. 서버(`room.js`)는 그 엔진을 좌석마다 하나씩
띄워 락스텝으로 돌리고(§v4 1항) 좌석별 뷰를 화이트리스트로 재구성한다. 엔진 계약이 바뀌었는데 서버 쪽 두 계약은
그대로여서 다음 두 구멍이 생겼다.

**(구멍 1) 발견되지 않는 두 엔진 상태 분기.** `lockstepDigest()`의 `fighter()`는 #233 이전 필드만 요약한다.
`crack`·`harden`·`hardenPct`·`evadeBuff`·`dmgUpBuff`·`shieldLayers`·`pendingFx`·8스탯·`grade`가 전부 빠져 있다.
이게 왜 중요한가 — #233의 `resolveHit()`는 한 타격에 `rand()`를 최대 **3회**(① 회피 · ③ 분산 · ⑦ 치명) 소비한다.
종전 경로는 분산 1회였다. 두 좌석 엔진의 난수 소비가 한 번이라도 어긋나면 그 뒤 모든 판정이 갈라지는데, 갈라진
결과가 위 필드에만 남아 있으면 요약이 같게 나와 **fail-closed VOID가 발동하지 못한다**. 두 플레이어가 조용히 서로
다른 경기를 보게 된다. 특히 `shieldLayers`는 합계(`f.shield`)만 봐서는 안 된다 — 합계가 같아도 층 경계가 다르면
다음 타격의 깨짐 수와 잔량이 달라진다(GDD-23 3.2 LIFO).

**(구멍 2) 자기 동료의 스탯이 틀린 채 복원된다.** 엔진은 동료의 암살자/방패병 구분을 `mkPiece(owner,type,element,allyIdx)`
안에서만 쓰고 **말에 subtype 필드를 남기지 않는다**(`demo/index.html` mkPiece — `allyIdx===1?ALLY_BASE.shield:ALLY_BASE.assassin`).
말에 남는 유일한 구분자는 주입된 스탯 값 자체다. 그런데 서버가 그 값을 보내지 않으니, 클라이언트의 폴백
(`netStubStats`)은 `u.type==="ally"`를 보고 **둘 다 암살자**(def 5 · spd 12)로 복원한다. 온라인에서 내 방패병
동료는 제 블록(def 20 · spd 6, GDD-23 3.5)을 잃는다.

---

## 2. 무엇을 고쳤나 — 필드별 계약과 근거

원칙은 **"전부 열지 않는다"**였다. 기존 정보 경계(§2.6.1 등급 A/B/C-2 · §2.6.2 전투 문맥 · GDD-23 7.9)를 그대로
두고, **자기 좌석 상태** 또는 **진행 중 전투 화면이 실제로 그리는 것**에 필요한 필드만 넣었다.

### 2.1 `you.pieces[]` — `_serializeOwn()` (자기 좌석, 등급 A) · **11필드 추가**

| 추가한 필드 | 근거 |
|---|---|
| `def` `spd` `dodge` `crit` `statusPct` `grade` | **한 묶음**이다. 클라이언트 `netStubStats`가 `typeof u.def==="number"` **하나로** 분기해 나머지를 함께 읽는다 — `def`만 보내면 `spd/dodge/crit/statusPct`가 0으로, `grade`가 `null`로 덮여 자기 ⭐1 하수인의 등급이 사라진다. 구멍 2를 고치는 것이 이 묶음이다. |
| `crack` `harden` `hardenPct` `evadeBuff` `dmgUpBuff` | GDD-23 4.5의 새 지속 상태. 자기 말의 상태는 소유자가 전부 보는 값이다. |

**정보 경계 변화 없음.** 등급 A는 이미 `type`·`element`·`name`·`hp`·`atk`·`skillAtk`·`rosterId`·`skills`(전부 공개)·
`cdMax`·`cap`·`burn`·`weaken`·`shield`·`shock`·`dmgCut`·`focusCharge`·`vulnMark`·`powerBuff`·`fleeBoost`를 받는다.
자기 말의 자기 수치가 하나 더 붙는 것이라 새 노출이 아니다.

**엔진을 건드리지 않은 이유.** 동료 subtype 키(`allySub` 같은 것)를 새로 만들면 `demo/index.html`의 `mkPiece`를
고쳐야 하고 그건 Mars 소유다. **주입된 값 자체**를 보내면 같은 결과를 서버만 고쳐서 얻는다.

`cap`(자기 포획 하수인)은 `_serializeOwn`이 `cap: p.cap`으로 원본을 그대로 넘기므로 Mars가 포획 시점에 넣는
새 스탯을 **이미 싣고 있다** — 변경 불필요(검사로 확인).

### 2.2 `battle.a` / `battle.d` — `_serializeBattle().side()` (전투 문맥 §2.6.2) · **3필드 추가**

| 추가한 필드 | 근거 |
|---|---|
| `crack` `harden` `hardenPct` | 원본 `stIcons(f)`(`demo/index.html:3785`)가 **두 전투원 패널 모두에** 뷰어 분기 없이 이 셋을 그린다(`battleModal` 안 `<span id="bst-${sid}">${stIcons(pf)}</span>`, 양쪽 sid에 대해 호출). 이미 내려보내는 `burn`·`weaken`·`shock`·`dmgCut`·`vulnMark`와 같은 등급이고, #121 계약 3.1·9가 "적용된 효과는 상대에게도 공개(재고·선택만 비공개)"로 이미 확정한 범위다. `hardenPct`가 별도로 필요한 이유는 `stIcons`가 감소율을 숫자로 찍기 때문이다(`🛡경화 N%·NR`) — 잔여 라운드만으로는 복원되지 않는다. 전투가 끝나 `battle` 객체가 사라지면 이 필드도 함께 사라져 보드 뷰로 새지 않는다. |

### 2.3 **의도적으로 넣지 않은 것** — 이게 이 패치의 절반이다

| 넣지 않은 것 | 어디에 | 이유 |
|---|---|---|
| `shieldLayers` | 모든 뷰 | 화면은 층 **합계 하나**만 그린다(GDD-23 3.2 "층 합계를 방어막 바 1개로 표시" · `stIcons`의 `🛡${f.shield}` · shbar). 층 배열은 획득원 태그(`guardStart`·`selfSkill`·`grassLegacy`·기술 이름)를 달고 다녀 **상대의 아키타입과 아직 쓰지 않은 기술을 역산**하게 해 준다 — §2.6.2의 기술 은닉(미공개 기술은 `kind`만)을 우회하는 값이다. 표시에 불필요하면서 정보를 새게 하므로 내보내지 않는다. 락스텝 요약에는 서버 안에서만 들어간다. |
| `evadeBuff` `dmgUpBuff` | 전투 뷰 | `stIcons` 목록에 없고 어떤 뷰도 읽지 않는다. 공개 방 클라이언트는 피해를 계산하지 않으므로(서버 권위) 표시에 필요 없다. 자기 좌석 뷰에는 자기 상태로서 넣었다. |
| `def` `spd` `dodge` `crit` `statusPct` `grade` | 전투 뷰 | 전투 화면에 렌더 경로가 없다. 기술 위력 표기(`dmgRange(slotPow(f,sk))`)는 `atk`만 쓴다. `atk`/`skillAtk` 자체도 #217에서 "유도 가능·표시 불필요"로 **철회한 선례**(msg_db7a8fa06aee)가 있어 그대로 따랐다. `grade`는 GDD-23 7.9·8.1⑦이 소유자 전용으로 못박은 값이다. |
| 새 스탯·상태 일체 | `_serializeKnownOpponent` (등급 C-2) · `_serializeUnknownOpponent` (등급 B) | ① 보드 뷰에 이 값들을 그리는 경로가 없다(상태 아이콘은 전투 화면 전용). ② 공개된 상대 **하수인·왕**은 이미 보내는 `rosterId`/`type`으로 `ROSTER→ARCHETYPE_BASE`·`KING_BASE`를 찾아 클라이언트가 **같은 값을 스스로 유도**한다(`netStubStats`의 rd/king 분기) — 보내도 정보량이 늘지 않는다. ③ 유일하게 유도 불가인 것이 **상대 동료의 암살자/방패병 구분**인데, 서버가 보내면 **새 노출**이 되고 이를 소비하는 표시가 없다. GDD-23 7.9의 최소 공개 원칙대로 경계를 유지했다. ④ `grade`는 7.9가 소유자 전용으로 못박았다. |
| `shieldStartPct` | 모든 뷰 | `netStubStats`가 읽지 않고 그리는 곳도 없다. 전투 시작 방어막은 서버가 계산해 `shield` 합계로 내려간다. |
| `absorbed` `pendingFx` | 모든 뷰 | 서버 판정용 내부 상태이고 표시 대상이 아니다. |

**남는 알려진 한계 (미해결로 남긴다, 은폐하지 않는다):** 상대 동료의 스탯은 클라이언트에서 계속 암살자 폴백으로
복원된다. 공개 방에서 그 값은 렌더·계산 어디에도 쓰이지 않으므로 지금은 무해하지만, **정확하지는 않다.** 상대
동료 스탯을 실제로 그려야 하는 요구가 생기면 두 전투원이 서로 공개된 **전투 뷰**에서 다시 합의해 내보내야 하며,
보드 뷰(`units[]`)로 여는 것은 권하지 않는다. 이 판단을 Mars에 `msg_3cb2dc73475f`로 공유했다.

### 2.4 `lockstepDigest()` — 서버 내부 전용 (어떤 프레임에도 실리지 않음)

정보 경계와 무관한 서버 안쪽 값이라 **새 규칙 상태를 빠짐없이** 넣었다.

- `fighter()`에 추가: `crack` `harden` `hardenPct` `evadeBuff` `dmgUpBuff` `absorbed`,
  `shieldLayers`(층 `[amt, src]`를 **순서 그대로** — 합계가 같아도 층 경계·순서가 다르면 다음 타격 결과가 다르다),
  `pendingFx`(콜백은 요약할 수 없으니 `roundsLeft` 수열), `stats`(8스탯 + `grade`).
- `pieces[]` 튜플 확장: 말 자체의 8스탯 + `grade`, 그리고 `cap` 튜플에 승계 스탯(본체 출전이면 말이 곧 전투원이고,
  포획 하수인도 같은 스탯으로 대리 출전한다).
- `reserve[]` 튜플 확장: 예비(포획) 하수인의 승계 스탯.

**범위에 대한 정직한 표기:** `absorbed`(유효 피해 흡수 누계, `BAL.absorbCapPct`)는 #233이 만든 필드가 아니라
**종전부터 요약에서 빠져 있던 것**이다. #233의 층 소모가 이 값의 증가 경로를 바꿨기에 같이 메웠다 — 순수 #233
범위를 한 필드 넘는다. `atkBuff`는 현재 켜는 경로가 없는 죽은 값이라 넣지 않았다.

---

## 3. 검증 — 실행한 것과 결과

QA 최소 정책(2026-09-16 CJ)에 따라 **변경 범위의 자동 검증만** 했다. 브라우저 수동 조작·네트워크 매트릭스·
전체 밸런스 시뮬레이션은 하지 않았다.

### 3.1 신규 경계 스위트 — `server/authoritative/test/test-combat-stats-boundary.js`

`combat-stats-boundary: 458 passed, 0 failed` — **이력 수치다(이 시점의 것). 현재는 0장의 544.**

| 블록 | 무엇을 고정하나 |
|---|---|
| 1) 자기 좌석 | 8스탯 묶음의 **원자성**(`def`가 오면 5개 + `grade` 키가 반드시 함께), 새 지속 상태 5종 전송, `shieldStartPct`·`shieldLayers` 미전송, 하수인 `grade=1`·왕 `grade=null`(3.5), **동료 둘의 def가 서로 다르고** 방패병이 def20·spd6·회피0·치명0을, 암살자가 def5·spd12·회피10%·치명10%를 되찾는 것(3.5), 왕 def10·spd8·공격16 |
| 2) 상대 보드 | 등급 B·C-2 뷰에 11개 금지 필드가 **하나도** 없음, 미공개 상대는 종전대로 위치·생존만, 공개 하수인은 `rosterId`를 받아 클라이언트가 스탯을 유도할 근거가 있음(보류 판단의 전제) |
| 3) 전투 문맥 | 양 좌석 · 양 전투원이 `crack`/`harden`/`hardenPct`를 받고 값이 그대로(균열 2R · 경화 25%·3R) 도달, 금지 12필드 미전송, 방어막은 합계 하나(12+7=19)로만 전송, **층 획득원 태그 `guardStart`가 전투 프레임 어디에도 없음** |
| 4) 락스텝 감지력 | 새 규칙 필드 하나를 **한쪽 엔진에서만** 어긋뜨리면 요약이 반드시 달라지고 되돌리면 복귀: `crack`·`harden`·`hardenPct`·`evadeBuff`·`dmgUpBuff`·`absorbed`, 8스탯 6종, **같은 합계의 방어막 층 순서 차이**와 **층 경계 차이**, 예고 피해 대기열, 말의 8스탯·등급, 예비 하수인 승계 스탯. 마지막으로 요약 전용 필드가 좌석 프레임에 없음 |

**역검증(빈 게이트가 아님):** 패치 전 `room.js`(HEAD)에 대해 이 스위트를 돌리면 **310 passed, 148 failed**다.
패치 후 0 failed. 즉 검사가 실제 구현 차이를 잡는다.

### 3.2 직접 영향받는 기존 서버 회귀 — 전부 통과

| 스위트 | 결과 |
|---|---|
| `test-room` | 57 passed, 0 failed |
| `test-public-authority-delta` | 37 passed, 0 failed |
| `test-authority-rules` | 176 passed, 0 failed |
| `test-battle-fx` | 472 passed, 0 failed |
| `test-engine-isolation` | 18 passed, 0 failed |
| `test-security-gaps` | 61 passed, 0 failed |
| `test-scheduler` | 32 passed, 0 failed |
| `test-match-fuzz` | 16 passed, 0 failed |

`test-match-fuzz`가 가장 중요한 확인이다. 7시드 · 6,668 accepted 입력 · 484 전투 행동을 **넓힌 요약으로** 돌려
두 좌석 엔진이 한 번도 갈라지지 않음을 확인했다. 즉 요약을 넓힌 것이 기존 동작을 깨지 않으면서, 앞으로 갈라지면
잡을 수 있게 됐다.

### 3.3 미검증 범위 — PASS로 주장하지 않는다

- `npm test` 전체와 `test-authoritative`·`test-http-static`·`test-launcher-authoritative`·`test-public-deploy`·
  `demo/test/integration/smoke_public_live.js`는 **실행하지 못했다** — 이 워크트리에 `server/node_modules`가 없어
  `ws` 의존이 해결되지 않는다(`npm ci` 미실행). 위 8개는 `ws`를 요구하지 않아 돌렸다. CI B가 `npm ci` 뒤에 전부 돈다.
- `demo/` 헤드리스 회귀(CI A)는 Mars 소유 범위이고 이 보고 시점에 Mars가 같은 워크트리에서 계속 수정 중이라
  돌리지 않았다 — 내 변경은 `demo/`를 건드리지 않는다.
- **2브라우저 실제 온라인 접속으로 전투 화면의 균열·경화 아이콘을 눈으로 본 기록은 없다.** 계약·코드 대조와
  직렬화 검사로만 확인했다. QA 최소 정책이 "네트워크 코드·동기화 계약 변경 또는 구체적 회귀 근거가 없으면 수동
  매트릭스를 반복하지 않는다"로 두었고, 이 변경은 필드 추가라 자동 검사로 덮이는 범위라고 판단했다. Saturn이
  다르게 판단하면 그 대표 흐름 한 번은 정당하다.
- 밸런스(수치가 재미있는가)는 이 작업의 대상이 아니다. GDD-23 8.4가 구현 후 AI vs AI 시뮬레이션으로 따로 본다.

---

## 4. 미해결 · PD 결정 대기

1. ~~`server/package.json` 한 줄 등록~~ — **해결됨.** `msg_4755e750434b`로 물었고 PD가 `msg_0c3b35c6921a`로
   **(A) Jupiter가 한 줄 추가**를 승인했다("CI B에서 실제 실행되어야 한다. 이미 통과한 경계 검사는 재실행하지 말고
   연결 구문만 확인해 보고하라"). `scripts.test:authoritative` 끝에
   `&& node authoritative/test/test-combat-stats-boundary.js`를 붙였고, 지시대로 **스위트를 재실행하지 않고 연결
   구문만** 확인했다: 체인 13단계로 파싱되고, 마지막 단계가 신규 스위트이며, 체인이 참조하는 13개 테스트 파일이
   모두 실제로 존재한다(누락 0). 이제 필수 CI B(`npm test` → `test:authoritative`)에서 실행된다.
2. **Mars와의 필드 계약 확인 (`msg_3cb2dc73475f`로 공유, 답 대기).** 질문 둘: (Q1) 자기 좌석 6필드 묶음이
   `netStubStats` 계약과 맞는가 (`u.def`가 number일 때 나머지 5개를 반드시 함께 읽는 것으로 이해했다),
   (Q2) 전투 뷰에 `crack`/`harden`/`hardenPct` 외에 지금 렌더가 필요한 새 필드가 더 있는가. 이견이 오면 room.js만
   고치면 되는 범위다.
3. **Orca 라이프사이클 신호 제약 (운영 이슈, 코드 무관).** 이 세션의 dispatch 프리앰블에 `--dispatch-capability`
   토큰이 없어 `orca orchestration heartbeat`·`ask`·`worker_done`이 `The Dispatch capability is missing`으로
   거부된다. `send --type status|question`은 정상 동작해 그 경로로 보고했다. PD가 `msg_5e2adb5fc8b7`로
   "토큰을 추측하거나 내부 저장소를 읽어 복구하지 말라 · worker_done을 1회만 시도하고 거절되면 보고 파일 경로와
   정확한 오류를 일반 메시지로 남겨라 · lifecycle 성공으로 허위 기록하지 말라"고 지시했고 그대로 따랐다.

## 5. 범위 준수

- 수정: `server/authoritative/room.js` 1개 + `server/package.json` 1줄(PD 승인 `msg_0c3b35c6921a`).
  신규: 테스트 1개 + 이 보고서.
- #237(경제·재연결) 구현 없음. 프로토콜 재설계 없음. 자산 변경 없음. 승인받지 않은 서버 파일 변경 없음.
- `demo/index.html`·`demo/test/**`(Mars 작업 중)·PD 문서·`original art/`·`orca-hook-latency-report.md` 미변경.
- Git 쓰기 없음. GitHub·Notion 쓰기 없음. 다른 Worker 기동 없음. Computer Use·브라우저 조작 없음.
- 자기 QA 판정 없음 — Saturn 독립 READ_ONLY QA와 CJ 플레이 QA가 게이트다.

---

## 6. 복구 dispatch (`ctx_db4d48884dc5`, 2026-09-16) — 최종 엔진 상태 맞춤

1~5장을 만든 뒤 Mars가 엔진을 더 고쳤다. 그 결과 위 요약 계약이 **최종 상태에 대해서는 불완전**해졌다.
아래는 그 차이만 메운 추가분이다. 1~5장의 판정을 소급해 고치지 않았고, 3.1의 `458 passed`도 **그때의 수치로
보존**한다 — 최종판의 수치는 6.4다.

### 6.1 새로 생긴 구멍 — 무엇이 달라졌나

| # | 최종 엔진의 새 상태 | 종전 요약이 못 잡는 것 |
|---|---|---|
| ① | `B.firstSide` (4.4) — 선턴이 **라운드 시작 시 한 번 굳는 저장 상태**가 됐다(`startRounds`·`nextPhase`). | 종전 순서는 `round`·`phase`·양쪽 `shock`로 매 호출 재계산되는 **파생값**이라 따로 요약할 게 없었다. 지금은 굳힌 시점의 `spd`·`grade`·순서 효과를 담은 상태라서 **두 좌석이 서로 다른 선턴을 굳혀도 다른 필드는 전부 같을 수 있다.** 그러면 양쪽이 서로 다른 전투원에게 행동권을 준 채 요약만 일치한다. |
| ② | `evadeBuffR` · `dmgUpBuffR` (4.5) — 지속 카운터가 **세기와 별개 필드**다. | 엔진은 `R`이 0이 될 때 비로소 세기를 0으로 내린다(`nextPhase`). 세기만 보면 "회피 +10%가 1R 남음"과 "3R 남음"이 같은 상태로 읽혀 다음 라운드부터 갈라진다. |
| ③ | `crackFresh` · `hardenFresh` · `evadeBuffRFresh` · `dmgUpBuffRFresh` (5.6) — "부여된 라운드는 세지 않는다"를 구현하는 1회용 게이트. | 잔여 라운드가 같아도 게이트가 선 쪽과 아닌 쪽은 **다음 라운드 종료에서 값이 갈린다.** 같은 모양의 `shockFresh`는 #233 이전부터 있었으나 요약에는 없었고(좌석 프레임에는 이미 실린다), #233이 같은 게이트를 넷으로 늘려 구조적 구멍이 커졌다 — 다섯을 함께 메웠다. |
| ④ | `critForce` · `dodgeForce` (3.2) — 확정 효과. | **이 둘은 난수 소비 자체를 바꾼다.** `resolveHit`는 ① 회피와 ⑦ 치명에서 각각 `rand()`를 쓰는데, 플래그가 서 있으면 그 판정을 **건너뛰고** 플래그를 소모한다(`if(opp.dodgeForce){evaded=true; opp.dodgeForce=false;}`). 한쪽 좌석에만 남아 있으면 그 타격에서 `rand()` 호출 수가 어긋나 **이후 모든 판정이 갈린다.** 요약에서 가장 빠뜨리면 안 되는 두 필드다. |
| ⑤ | `vanguardTurn` (4.4) — 순서 효과. `decideFirstSide`가 `fighterOrderCat`으로 읽는다. | #234 전까지 이를 켜는 기술이 없어 실제로 갈릴 수 없지만, 엔진 계약이 이미 읽고 있어 계약을 함께 닫았다. |
| ⑥ | `pendingFx` 항목이 `{roundsLeft, run}`뿐 (4.3). | 종전 요약은 `roundsLeft` 수열만 봤다 — **같은 라운드에 예약된 서로 다른 예고 피해 둘을 구분하지 못한다.** 한쪽이 '해일 예고'를, 다른 쪽이 다른 지연 피해를 2R 뒤로 걸면 요약이 같게 나오고 발동 라운드에 가서야 갈린다(그때는 이미 요약으로 잡을 수 없는 HP 차이다). |

PD 인계에 적힌 `burnFresh`는 **엔진에 존재하지 않는다.** 화상은 게이트 없이 부여 라운드 종료에 바로 1이 줄어든다
(`nextPhase`의 `if(f.burn>0){…f.burn--;}`). 없는 필드를 만들지 않았다.

### 6.2 요약에 넣은 것 — `lockstepDigest()` (서버 내부 전용, 어떤 좌석 프레임에도 실리지 않음)

| 위치 | 추가 필드 |
|---|---|
| `battle` | `firstSide` (`B.firstSide \|\| null`) |
| `fighter()` | `evadeBuffR` · `dmgUpBuffR` · `shockFresh` · `crackFresh` · `hardenFresh` · `evadeBuffRFresh` · `dmgUpBuffRFresh` · `critForce` · `dodgeForce` · `vanguardTurn` |
| `fighter().pendingFx` | 항목 모양을 `roundsLeft` → **`[roundsLeft, tag]`**로 바꿨다 |

`pendingFx`의 `tag`는 **엔진이 붙여 주는 값**이다(Mars 소유). 서버는 없는 필드를 만들지 않고 `e.tag`가
`undefined`면 `null`로 떨어뜨린다 — 엔진이 아직 안 붙였으면 종전과 **정확히 같은 감지력**을 유지하고, 붙는
순간 감지력만 올라간다. 이 역호환 자체를 검사로 고정했다(6.4).

### 6.3 직렬화(좌석 프레임)에 넣은 것 — **없다. 0필드.**

이번 추가분에서 **클라이언트로 나가는 필드는 하나도 늘리지 않았다.** 엔진에 필드가 늘었다는 이유만으로
공개 범위를 넓히지 않는다는 원칙(2.3)을 그대로 적용한 결과다.

| 넣지 않은 것 | 이유 |
|---|---|
| `evadeBuffR` · `dmgUpBuffR` · 게이트 4종 · `critForce` · `dodgeForce` · `vanguardTurn` | `stIcons(f)`(`demo/index.html:3844`) 목록에 없다 — 화면이 그리지 않는다. 공개 방 클라이언트는 피해를 계산하지 않으므로(서버 권위) 계산에도 필요 없다. |
| `B.firstSide` | **중복 1비트라서 넣지 않았다.** 서버는 이미 `battle.actor`(= `actorOfPhase()`)를 공개로 내려보내고 있고, `firstSide`는 `actor`와 `phase`로 완전히 유도된다(`phase 0`이면 `firstSide === actor`, `phase 1`이면 그 반대). 반대로 `firstSide`를 **굳힌 입력**(상대의 `spd`·`grade`·순서 효과)은 GDD-23 7.9가 소유자 전용으로 못박은 값이라 전투 뷰로 열 수 없다 — 결과값 `actor`만 공개하는 종전 경계를 그대로 유지했다. |

### 6.4 검증 — 실행한 것과 결과 (최종판)

QA 최소 정책(2026-09-16 CJ)대로 **변경 범위의 자동 검증만** 했다. 브라우저 수동 조작·네트워크 매트릭스·
밸런스 시뮬레이션은 하지 않았다. 스키마가 굳은 뒤 **1회씩** 돌렸다.

| 스위트 | 결과 |
|---|---|
| `test-combat-stats-boundary` (확장) | **535 passed, 0 failed** — *이력 수치, 현재는 544* |
| `test-match-fuzz` (요약 소비자) | 16 passed, 0 failed — 7시드 · **6,254 accepted 입력 · 397 전투 행동**, 락스텝 분기 0 |
| `test-room` (요약 소비자) | 57 passed, 0 failed |

`test-match-fuzz`가 이번에도 핵심 확인이다. 요약을 넓히면 **좌석마다 정당하게 다른 값**을 잘못 집어넣어
멀쩡한 경기를 VOID로 떨어뜨릴 위험이 생기는데, 6,254 입력을 돌려 한 번도 갈라지지 않음을 확인했다.

**역검증 — 빈 게이트가 아님(이번 추가분에 대해 새로 실행).** 스크래치패드에 `room.js` 사본을 만들어
**이번 dispatch의 델타만** 되돌리고(1~5장의 패치는 남긴 채) 같은 스위트를 돌렸다: **522 passed, 13 failed.**
실패한 13개가 정확히 6.1의 ①~⑥ 감지 항목이다. 즉 새 검사는 실제 구현 차이를 잡는다.
동시에 **경계(미전송) 검사는 13개 실패에 하나도 포함되지 않았다** — 6.3대로 이번 추가분이 좌석 프레임을
전혀 건드리지 않았다는 독립 증거다.

추가한 검사 블록:

| 블록 | 무엇을 고정하나 |
|---|---|
| 전투 프레임 경계 | `battle`에 `firstSide` **미전송**, `battle.actor`가 `'A'\|'D'`로 온다(공개 행위자 원본). 양 전투원 금지 목록에 지속 카운터·게이트·확정 효과·순서 효과 9종 추가 |
| 지속 카운터 | `evadeBuffR`·`dmgUpBuffR` 어긋뜨림 감지 + 복귀 |
| 지속 게이트 | `shockFresh`·`crackFresh`·`hardenFresh`·`evadeBuffRFresh`·`dmgUpBuffRFresh` 5종 감지 + 복귀 |
| 확정 효과 | `critForce`·`dodgeForce` 감지 + 복귀 (난수 정렬) |
| 순서 효과 | `vanguardTurn` 감지 + 복귀 |
| `B.firstSide` | `initBattle`이 실제로 굳혀 두는지, 한쪽만 뒤집으면 요약이 달라지는지, 되돌리면 복귀하는지 |
| `pendingFx` 계약 | tag 없는 항목 ↔ tag 붙은 항목 구분(역호환), **같은 라운드의 서로 다른 예고 피해** 구분, 콜백(`run`)이 요약에 직렬화되지 않음 |
| 요약 전용 | 새로 넣은 10필드 + `firstSide`가 좌석 프레임 어디에도 없음 |

### 6.5 검사하지 않은 것 — PASS로 주장하지 않는다

- **`npm test` 전체·CI B는 이 워크트리에서 돌리지 못했다.** `server/node_modules`가 없어 `ws` 의존이 해결되지
  않는다(`npm ci` 미실행). `ws`를 요구하지 않는 위 3개만 돌렸다. `server/package.json`의 신규 스위트 연결은
  1~5장 시점에 PD 승인(`msg_0c3b35c6921a`)으로 이미 들어가 있고 이번에 건드리지 않았다 — CI B가 `npm ci` 뒤에 전부 돈다.
- **나머지 서버 회귀 5종(`test-authority-rules`·`test-battle-fx`·`test-public-authority-delta`·`test-engine-isolation`·
  `test-security-gaps`)은 이번에 다시 돌리지 않았다.** 인계가 "직접 영향받는 것만 1회"로 한정했고, 이번 델타는
  `lockstepDigest` 내부뿐이라 요약을 소비하는 3개로 좁혔다. 3.2의 통과 기록은 **그 시점의 것**이며 최종판의
  통과로 주장하지 않는다.
- `demo/` 헤드리스 회귀(CI A)는 Mars 소유 범위이고 Mars가 같은 워크트리에서 계속 작업 중이라 돌리지 않았다.
  내 변경은 `demo/`를 건드리지 않는다.
- **2브라우저 실제 온라인 접속 기록은 이번에도 없다.** 이번 추가분은 좌석 프레임을 0필드 바꿨으므로(6.3)
  화면에 보이는 것이 달라지지 않는다는 것이 근거다. Saturn이 다르게 판단하면 대표 흐름 1회는 정당하다.
- **`pendingFx`는 현재 호출처가 0개다**(`scheduleDelayed`를 부르는 기술이 아직 없다). 그래서 `tag` 계약은
  **합성 픽스처로만** 검사했고 실제 예고 피해가 도는 것을 본 적은 없다. 기술이 붙는 시점에 다시 봐야 한다.
- `vanguardTurn`도 같은 이유로 **실제로 켜지는 경로가 없다**(#234 전까지). 계약만 닫았다.

### 6.6 Mars와의 필드 계약 — 보낸 질문과 현재 상태

`msg_dd8111ac4d2c`로 현재 Mars(`ctx_53f16c9efb3a`)에 세 가지를 물었고, 이 보고 시점까지 **답이 오지 않았다.**
서버 패치는 **세 답 중 무엇이 오더라도 깨지지 않게** 만들어 두었다(Q1은 `tag` 부재를 `null`로 흡수, Q2·Q3는
서버 필드 0개 추가). 답이 오면 `room.js`만 고치면 되는 범위다.

- **Q1 (`pendingFx` 식별자 키 이름)** — `scheduleDelayed(f,delayRounds,run,tag)`로 `{roundsLeft,tag,run}`을
  저장하자고 제안했다. 키 이름이 `tag`가 아니어도 서버 한 줄만 바뀐다.
- **Q2 (공개 방 행위자 복원 — 실제 회귀로 보인다, 클라 소유라 고치지 않았다)**: #233 이전 `actorOfPhase()`는
  `round`·`phase`·양쪽 `shock`만 썼고 그 셋이 전부 스냅샷에 있어 `netSynthBattle` 경로가 정확히 복원됐다.
  지금 `decideFirstSide`는 `spd`·`grade`·`vanguardTurn`을 읽는데 이 셋은 공개 전투 뷰에 없고 **앞으로도 보낼 수
  없다**(`grade`는 7.9). 공개 방은 `demo/index.html:5831`에서 `S.battle=netSynthBattle(...)`이라 **라이브 전투도**
  이 경로다 — `B.firstSide`가 `undefined`라 `decideFirstSide`가 `spd` 0·0, `grade` null로 떨어져 항상 `'A'`를
  돌려주고, `battleModal()`의 `const side=actorOfPhase()`가 틀린 패널·행동 메뉴를 그릴 수 있다. `B.actorOwner`는
  `bd.actor`로 맞게 오지만 `battleModal`은 그 값을 쓰지 않는다. 권장안은 **(A) 클라 유도** —
  `B.firstSide = bd.phase===0 ? bd.actor : (bd.actor==='A'?'D':'A')` (서버 필드 추가 0개). 대안 **(B) 서버가
  `battle.firstSide` 추가**는 `actor`+`phase`로 이미 완전히 유도되는 값이라 새 노출은 아니지만 중복 필드다.
  `spd`/`grade` 자체를 상대 전투 뷰로 여는 선택지는 7.9 위반이라 제외했다. **이 항목은 미해결이다.**
- **Q3 (표시에 필요한 새 필드가 더 있나)** — 현재 `stIcons` 기준으로 없다고 보고 0필드를 추가했다.

### 6.7 범위 준수

- 수정: `server/authoritative/room.js` · `server/authoritative/test/test-combat-stats-boundary.js` · 이 보고서.
  `server/package.json`은 이번에 **건드리지 않았다**(1~5장 시점 승인분 그대로).
- `demo/index.html`·`demo/test/**`(Mars 소유) 미변경 — 읽기만 했다. PD 문서·`original art/`·
  `orca-hook-latency-report.md` 미변경. 백업 삭제·배포 없음.
- #237(경제·재연결) 구현 없음. 프로토콜 재설계 없음. 승인받지 않은 서버 파일 변경 없음.
- Git 쓰기 없음. GitHub·Notion 쓰기 없음. 다른 Worker 기동 없음. Computer Use·브라우저 조작 없음.
  런타임 capability는 주입된 값을 그대로 썼고 추측·내부 저장소 조회를 하지 않았다.
- **자기 QA 판정 없음.** 위는 실행한 검사와 그 결과일 뿐이다 — 판정은 Saturn 독립 READ_ONLY QA와 CJ 플레이 QA의 몫이다.

---

## 7. 후속 dispatch (`ctx_4aeeae1e04d2`, 2026-09-16) — 최종 클라이언트 계약 통합

실패 재시도가 아니라 **구현 중 추가된 계약의 통합**이다. 6장까지의 결과는 보존한다.

### 7.1 화상 게이트 — Mars 구현과 계약 일치 확인

PD 결정(GDD-23 4.7 "화상은 부여된 라운드를 세지 않으므로 **다음 2개 라운드의 종료 시에 각 5**")에 따라
Mars가 엔진에 `burnFresh` 를 넣었다. 착수 시점 워크트리에는 없었으므로 **이름과 모양을 먼저 확정 요청**했고
(`msg_90869a03d08d`), Mars 구현이 그 제안과 **정확히 일치**하는 것을 코드로 확인했다.

화상 게이트가 다른 넷과 **모양이 다르다**는 점이 이 항목의 핵심이다. 감전·균열·경화·회피/피해 증가는 라운드
종료에 **감소만** 하므로 게이트가 감소만 미루면 된다. 화상은 라운드 종료에 **피해도** 준다 — 그래서 게이트가
부여 라운드의 **피해와 감소를 둘 다** 건너뛰어야 R2·R3 2회가 나온다. 감소에만 걸면 R1·R2·R3 **3회**가 되어
총량이 늘어난다. 이 갈래를 질문에 명시했고 Mars 구현이 그대로 따랐다(`demo/index.html:3928`).

| 확인한 것 | 결과 |
|---|---|
| 필드 이름 | `burnFresh` — 요약이 읽는 이름과 일치 |
| 라운드 종료 가드 | `if(f.burnFresh){ f.burnFresh=false; } else if(f.burn>0){ …피해·감소… }` — 피해와 감소를 **둘 다** 건너뛴다 |
| 부여 3곳 | `:3472`(속성 화상) · `:3542`(eff 분기) · `:3757`(atkEl 분기) 모두 `burn=N` 과 함께 `burnFresh=true`. 재부여 시 게이트를 다시 세운다(감전과 같은 현행) |
| 해제·초기화 | 해독제 `:3361` · 정화 `:3784` · `resetBattleTemps :3084` · `resetAfter :4013` · `mkPiece :1383` 에서 모두 함께 내려간다 — **스테일 게이트가 남지 않는다** |

**요약에 추가:** `fighter()` 에 `burnFresh: !!f.burnFresh` 1필드. 좌석 프레임에는 넣지 않았다 — `stIcons` 가
그리지 않고(화상은 `🔥화상{burn}R` 로 잔여만 표시), 공개 방 클라이언트는 피해를 계산하지 않는다.

**왜 이 게이트가 요약에서 특히 중요한가:** 다른 게이트들이 어긋나면 **잔여 라운드**가 갈리지만, 화상 게이트가
어긋나면 **그 라운드에 HP 가 바로 갈린다**(피해 유무 자체가 달라진다). 요약에서 빠졌을 때 손해가 가장 큰
게이트다.

### 7.2 `pendingFx` tag — 서명·저장은 실제 엔진으로 확정, 호출처는 #234

착수 시점에는 `scheduleDelayed(f,delayRounds,run)` 이 `{roundsLeft,run}` 만 저장했다. Mars가 최종 계약으로
서명을 넓혔고 코드로 확인했다(`demo/index.html:3699`):

```
function scheduleDelayed(f,delayRounds,run,tag){ f.pendingFx.push({roundsLeft:delayRounds,tag:tag!==undefined?tag:null,run}); }
```

미지정 시 `null` 을 채우는 모양이 6장에서 서버가 넣어 둔 역호환 읽기(`e.tag === undefined ? null : e.tag`)와
**정확히 맞물린다.** 서버 요약은 그대로 두고, 검사만 합성 픽스처에서 **실제 엔진 경로**로 올렸다 — 엔진이
`tag` 를 버리면 검사가 먼저 깨진다.

**남은 한계(정직한 표기):** 서명과 저장은 실제 엔진으로 검증했지만 **`scheduleDelayed` 를 부르는 기술이 아직
0개**라 실제 예고 피해가 도는 것은 보지 못했다. 기술 id 를 넘기는 것은 #234 담당이다. 이것을 "실사용 검증됨"
으로 올리지 않는다.

### 7.3 공개 방 선턴 복원 — 서버는 필드를 늘리지 않았다

PD가 권장 A를 채택했고 Mars가 **복원을 구현 완료**했다(`demo/index.html:6154` —
`if(bd.actor==="A"||bd.actor==="D") B.firstSide=(B.phase===0)?bd.actor:(bd.actor==="A"?"D":"A");`).
6.6 Q2에서 올린 공개 방 행위자 오복원 회귀가 **서버 필드 추가 0개로** 닫혔다. 서버는
`battle.actor` 만 공개하고 `battle.firstSide` 는 **보내지 않는다**(6.3 그대로). `firstSide` 를 굳힌 **입력**
(상대 `spd`·`grade`·순서 효과)은 GDD-23 7.9 가 소유자 전용으로 못박은 값이라 전투 뷰로 열 수 없다.
이 경계(프레임에 `firstSide` 없음 + `actor` 는 `'A'|'D'`)를 검사로 고정해 두었다.

### 7.4 의도적으로 넓히지 않은 것

`burnBy`(화상 피해 귀속)와 `rec`(피해 기록 누계)는 이번에 화상 경로가 바뀌었음에도 **요약에 넣지 않았다.**
둘 다 #233 이전부터 요약에 없던 값이고 이번 범위는 "게이트 상태 반영"이다. 두 좌석의 `burnBy` 가 갈리면
`rec` 누계가 갈릴 수 있다는 것은 **알려진 미탐지 구간**으로 남긴다 — 은폐하지 않고 여기 적는다.
넓힐지 여부는 PD·Saturn 판단 사항이다.

### 7.5 검사 — 바뀐 경계에 국한해 실행

PD 지시대로 **이미 통과한 광범위 회귀는 반복하지 않았다.** 바뀐 경계만 돌렸다.

| 스위트 | 결과 |
|---|---|
| `test-combat-stats-boundary` | **547 passed, 0 failed** — Mars 최종 계약이 반영된 **실제 엔진** 기준 |

추가한 검사:

| 검사 | 무엇을 고정하나 |
|---|---|
| 엔진 소유 확인 | 전투 개시 후 전투원에 `burnFresh` 키가 **실재**하는지. 요약이 읽는 이름과 엔진이 쓰는 이름이 갈리면 `!!f.burnFresh` 가 조용히 항상 false 가 되어 **검사는 통과하고 감지력만 사라진다** — 합성 픽스처만으로는 그 죽은 상태를 잡을 수 없어 키 존재로 계약을 고정했다 |
| 락스텝 감지 | 같은 화상 잔여(2R)에서 **게이트만 다른** 두 상태가 반드시 다른 요약을 낸다 + 되돌리면 복귀 |
| 경계 | `burnFresh` 가 전투 뷰 양쪽에 **미전송**, 좌석 프레임 전체에도 문자열로 존재하지 않음 |
| `tag` 엔진 경로 | `scheduleDelayed(f,2,run,'tide_warning')` 가 항목에 `tag` 를 싣는지, 미지정 시 `null` 을 채우는지, 그 둘이 **실제 엔진 경로에서** 요약을 가르는지 |

**역검증(빈 게이트가 아님):** 스크래치패드 사본에서 `burnFresh: !!f.burnFresh,` **한 줄만** 지우고 같은 스위트를
돌리면 **542 passed, 1 failed** 이고, 실패한 1개가 정확히 화상 게이트 감지 항목이다. 동시에 경계(미전송)
검사는 실패에 포함되지 않아 **좌석 프레임을 건드리지 않았다는 독립 증거**가 된다.

### 7.6 검사하지 않은 것 — PASS로 주장하지 않는다

- `npm test` 전체·필수 CI B 미실행(`server/node_modules` 없음 — `ws` 미해결). **PD가 PR 단계에서 1회 필수
  실행 예정**이라고 확인했다.
- `test-match-fuzz`·`test-room` 은 **이번에 다시 돌리지 않았다.** 6.4에서 통과한 기록이 있고 PD가 "이미 통과한
  회귀 반복 불필요"로 범위를 좁혔다. 이번 델타는 `fighter()` 에 불리언 1필드를 더한 것이라 요약 소비자의
  동작을 바꾸지 않는다 — 다만 **그 통과 기록은 6장 시점의 것**이며 최종판의 통과로 주장하지 않는다.
- `demo/` 헤드리스 회귀(CI A)는 Mars 소유. 내 변경은 `demo/` 를 건드리지 않는다.
- **`pendingFx` 는 호출처가 0개**라 실제 예고 피해가 도는 것은 보지 못했다(7.2). #234에서 다시 봐야 한다.
- Mars가 **클라이언트 중간 반올림·기존 상태 재부여 경로를 추가 점검 중**이라고 알려 왔다. 새 서버 필드는
  예정에 없으므로 이 보고의 계약은 그대로 선다 — 다만 그 점검 결과는 아직 반영되지 않았다.
- 화상 R1/R2/R3 **피해 타이밍 자체**(규칙 계산)는 이 스위트의 범위가 아니다 — 엔진 규칙 회귀는 `demo/` 가
  맡는다. 서버 쪽은 "그 상태가 갈리면 잡히는가"만 본다.

### 7.7 범위 준수

- 수정: `server/authoritative/room.js` · `server/authoritative/test/test-combat-stats-boundary.js` · 이 보고서.
  허용된 3개 외 파일 미변경. `server/package.json` 도 이번에 건드리지 않았다.
- `demo/index.html`·`demo/test/**`(Mars 소유) 미변경 — 읽기만 했다. `original art/`·
  `orca-hook-latency-report.md` 접근 없음. Git 쓰기·배포·추가 Worker 기동 없음. GitHub·Notion 쓰기 없음.
- Mars와 계약을 먼저 합의한 뒤 반영했다: `msg_90869a03d08d` 로 필드 이름·게이트 모양을 제안 → Mars 최종 계약
  수신(`msg_1209a6dda14f`, PD 경유) → 엔진 코드로 일치 확인 → 집중 검사 1회. 최종 계약의 내부 상태 목록
  (`burnFresh`·`crackFresh`·`hardenFresh`·`evadeBuffR`·`evadeBuffRFresh`·`dmgUpBuffR`·`dmgUpBuffRFresh` +
  유지분 `B.firstSide`·`shockFresh`·`critForce`·`dodgeForce`·`vanguardTurn`)이 서버 요약의 12필드와 **정확히
  일치**한다.
- **자기 QA 판정 없음.** 판정은 Saturn 독립 READ_ONLY QA와 CJ 플레이 QA의 몫이다.
