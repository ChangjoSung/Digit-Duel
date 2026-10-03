# #296 배틀 Flow — Jupiter(Server) 구현 전 정적 분석

- 2026-10-02 · Jupiter · `claude-opus-5-5` · Ponytail full · mutation=docs(이 파일 하나) · dispatch `ctx_cf829b04ec60` / `task_94559987bc31`
- 기준 `origin/milestone/v0.4.13` = `e48a8aa`. **코드 읽기만 했다** — 테스트·서버·브라우저 실행 0회, Git 명령 0회, GitHub·Notion 접근 0회. 제품·테스트·설정 무수정.
- 입력: `references/CJ_COMMENT.md` · 콘티 원본 이미지(직접 열어 확인) · #293/#294 계약 · `QA_MINIMUM_POLICY.md` · Venus/Mars 분석(가설로만 읽고 아래에서 다시 대조).
- 표기: **[확정·정적]** 코드 경로로 증명 · **[추론]** 정황 · **[미재현]** 실행 확인 없음 · **[미확정]** CJ 결정 필요.

## 1. 결론

| # | 항목 | 판정 |
|---|---|---|
| 1 | `0~0` 정적 원인 | **[확정·정적]** 서버 전투 뷰에 `atk` 키가 없다(`room.js:2141~2213`). 클라이언트 유도(`network.js:1105~1113`)가 실패하는 전투원은 `atk=undefined` → `effAtk`의 `(f.atk\|\|0)`(`data.js:608`)이 0으로 바꿈 → `slotPow`=0 → `dmgRange(0)`=`"0~0"`(`core.js:2876`). `"?"` 분기는 `effAtk` 경유로는 도달 불가 |
| 2 | 걸리는 전투원 | **[확정·정적]** ① 전설 본체(서버가 `rosterId:"L-…"`를 실음 `room.js:2195`, `ROSTER`에 L- id 없음 `data.js:494~504`) ② 경제 가방 말 대리 출전(내 것: `1110`은 `p.cap`/`reserve`만 찾는데 가방 개체는 둘 다 아님 `core.js:2101`) ③ 상대의 모든 대리 출전 |
| 3 | CJ가 본 장면이 1~2인지 | **[추론·미재현]** 제보의 모드·전투원 기록이 없다. 런타임 재현 0건 |
| 4 | 실제 판정 영향 | **[확정·정적]** 없음. 근거 3장 |
| 5 | 서버 최소 수정 | 전투 뷰 **자기 전투원 블록에 기본 6스탯**(`atk·def·spd·dodge·crit·statusPct`) — `synAtk` 옆 owner-only. 4장 |
| 6 | "상대도 공개" | **[미확정]** 선택지 P0/P1/P2와 각각의 필드·단언 변경을 5장에 정리. Jupiter는 어느 것도 단독 구현하지 않는다 |
| 7 | Venus/Mars 가설 중 틀린 것 | **동료 실제 공격력 18/14는 코드와 다르다** — 2.3 |

## 2. 데이터 경로 대조 (server Core → `_serializeBattle` → `netSynthFighter` → `battleModal`)

### 2.1 서버가 싣는 것

`_serializeBattle` `side()`(`room.js:2138~2214`) 양쪽 공통: `owner·hp·maxHp·shield·burn·weaken·shock·shockFresh·dmgCut·focusCharge·crack·harden·hardenPct·vulnMark·skills·rec·items·itemRound·lastItem·ballThrow·buff·type·element·bodyFight·rosterId·artRosterId·evadeDown·evadeDownR·tideMark·tideHeld`. 자기 전투원에만: `reaperSeal`(2199) · `synAtk`(2205). 프레임: `round·phase·actor·actSeq·maxRounds·battleId·bonus·ownSyn·log`(2221~2242).

**없는 것**: `atk·skillAtk·def·spd·dodge·crit·statusPct·grade·uid·syn*(synAtk 제외)·shieldStartPct·shieldLayers·onceUsed·burrowRound`. 주석 2164~2168은 "atk는 유도 가능"이라 철회했다고 적는데, 그 전제는 등급 성장(`gradeAtk` `data.js:265·568`)·전설(`applyLegend` `576`)·경제 가방 대리(#236/#292) 이전 것이다.

### 2.2 경우별 (온라인 · [확정·정적], 표기 문자열은 [미재현])

| 전투원 | 클라이언트 `atk` | 엔진 `f.atk` | 결과 |
|---|---|---|---|
| 일반 하수인 본체 ⭐1 | `ROSTER.atk`(1107) | 같음 | 정상 |
| 일반 하수인 본체 ⭐2~4 | `ROSTER.atk`(⭐1) | `gradeAtk`(+10%/등급) | 0은 아니나 **낮게 틀림** |
| 전설 본체(내 것·상대 것) | `undefined` | `LEGEND_BASE` 35/32/40 | **`0~0`** |
| 왕 본체 | `BAL.king.atk`=16 | 16 | 정상 |
| 동료 본체 | `BAL.ally.atk`=16 | **16**(2.3) | 정상 |
| 내 cap/예비 대리(구형) | `p.cap.atk` | 같음 | 정상 |
| 내 경제 가방 대리 | `undefined` | 그 개체 값 | **`0~0`** |
| 상대 대리(공개된 스킬 줄) | `undefined` | 비공개 | **`0~0`**(주석 1094 의도는 `?`) |
| 오프라인 | 실제 말 객체 | — | 해당 경로 없음 |

가방 대리를 클라이언트만으로 못 고치는 이유 [확정·정적]: 내 가방(`you.eco.bag`, `_serializeUnit` `room.js:1925~1932`)에는 `atk`가 있지만 전투 뷰에 `uid`가 없어(#292 단언 `test-issue292-art.js:99`가 금지) 같은 종 두 개체를 구분할 수 없다.

### 2.3 동료 공격력 — Venus/Mars 가설 정정 [확정·정적]

`mkPiece`는 `atk:BAL.ally.atk`(=16, `data.js:6` · `state.js:185`)로 만들고, `applyFixedStats`(`data.js:272~275`)는 `def·spd·dodge·crit·statusPct·shieldStartPct·grade`만 쓴다 — **`atk`를 복사하지 않는다**. `ALLY_BASE`를 읽는 제품 코드는 `state.js:201`·`network.js:625`뿐이고, `.atk=` 대입은 `data.js:568·576`·`state.js:212`(전부 하수인/전설)뿐이다. 따라서 엔진에서 암살자·방패병 모두 `atk=16`이고, 표 값 18/14(`data.js:254~255`, 스모크 `smoke_issue233.js:118~119`는 표만 검사)는 판정에 쓰이지 않는다. 표기 16은 엔진과 일치한다. 표와 엔진의 불일치 자체는 **[기획 필요]** — #296은 수치·규칙 변경 금지라 건드리지 않고 보고만 한다(런타임 확인은 Mars/Saturn).

### 2.4 `0`·비피해·모름 구분

- 서버가 `f.atk`를 실으면 표기 입력이 판정 입력과 같아진다. 그 뒤 범위 하한이 0이 되는지는 **값의 문제**(낮은 `pct`×낮은 공격력의 반올림 등)이므로 "양수 위력에 0은 있을 수 없다"고 단언하지 않는다. 표기 가드는 **결과가 0인지**가 아니라 **`atk`가 숫자가 아닌지(모름)** 로만 갈라야 한다 — 모름=`?`, 숫자면 계산 그대로(0 포함).
- 비피해(`pow` 없음)는 `ui.js:1657`이 이미 범위를 붙이지 않는다. 실제 피해 0(회피·방어막 전량 흡수)은 전투 메시지의 일이다.
- 서버는 `f.atk`가 엔진에 숫자로 없으면 **키를 만들지 않는다**(`|| 0` 금지 — #294 `shieldStartPct`와 같은 원칙). `null`/누락 = 클라이언트 `?`.

## 3. 판정 무영향의 인과 근거 [확정·정적]

1. 서버 엔진은 제품 스크립트 `demo/js/*.js`를 직접 읽어 실행한다(`runtime.js:62`). 피해는 그 Core의 `effAtk(f)`→`resolveHit`(`core.js:2613~`)가 **엔진의 실제 `f`** 로 낸다.
2. `_serializeBattle`은 읽기 전용이다 — `f`에 쓰는 줄이 없다.
3. 공개 방 클라이언트가 보내는 전투 명령은 `act·item·ball·flee·pass·pkgOpen·buffUse`(`room.js:64`)와 프레임 4키(65)뿐이라 수치가 회선을 타지 않는다. 합성 전투원(`netSynthFighter`)은 서버로 돌아가지 않는다.

한계: 와이어 캡처·실행 대조는 없다. "CJ가 본 판에서 피해가 정상이었다"는 [미재현]이다.

## 4. 서버 최소 변경안 (구현 아님)

### 4.1 P-own — CJ 결정과 무관하게 필요한 것

`side()`의 owner-only 스프레드(2205 옆)에 **엔진 값 그대로** 여섯 칸: `atk·def·spd·dodge·crit·statusPct` (`typeof f[k]==='number'`인 것만).

- `atk` 하나가 2.2의 내 전투원 행(전설·등급·가방 대리)을 전부 고친다. 클라이언트는 이미 `sd.atk`를 먼저 읽는다(`network.js:1105`).
- 나머지 다섯은 콘티 내 패널의 스탯 두 줄용이다. 본체는 `you.pieces`에 이미 있지만(`_serializeOwn` 2071) 가방 대리는 2.2와 같은 이유로 못 찾으므로 **전투원 한 곳**에서 본체·cap·가방을 같은 원천으로 준다. 전부 자기 정보라 새 노출 0.
- **이 여섯 칸은 정확히 "기본값"이다** [확정·정적]: `f.atk`는 등급 성장분까지 포함한 개체 값(`data.js:568·576`), 나머지는 아키타입/고정 표 주입값(269·273)이다. 시너지는 별도 칸 `syn*`에만 들어가고(`core.js:2284`, `resetV2` 주석 `data.js:599~601` "기본 스탯은 건드리지 않는다"), 전투 중 버프·디버프도 별도 칸(`spdBuff·evadeBuff·evadeDown·dmgUpBuff·hardenPct·atkBuff`)이다. 전투 중 `f`의 여섯 칸에 쓰는 코드는 찾지 못했다. 즉 "전투 시점의 실제 전투원 값이면서 가산 전 값"이다 — 보드 말의 값이 아니라 **지금 싸우는 개체**(본체·cap·가방)의 값이다.
- **`shieldStartPct`는 싣지 않는다.** 전투가 열리면 그 값은 이미 `shield`에 층으로 들어가 있고(`core.js:2366`) 이후 흡수·추가로 변한다. HP 줄의 방어막은 현행 `shield`(실제 현재 합계 · 양쪽 공개 2143)다. #294의 8번째 칸을 전투 패널에 복제하지 않는다.
- `grade`·`uid`는 전투 뷰에 추가하지 않는다(내 등급은 `you.pieces`/가방이 이미 줌).

### 4.2 시너지 — 새 필드 없이 되는 것 [확정·정적]

- 내 전투원의 가산칸은 `applySynergy`(`core.js:2278~2291`)가 **소유자 스냅샷의 `synArchBonus`를 전투원 종류와 무관하게** 넣은 것이고, 그 값은 이미 `battle.ownSyn.bonus`로 온다(`synView` 2301 · `room.js:2237`). 전설 개인분(마녀 `synStatusPct`·사신 `synAtk`·용의 왕국)은 `ownSyn`의 `el·dead·stage`와 클라이언트가 아는 전투원 `legend`(`network.js:1121`)로 Core 함수(`synElemKinds`·`synDragonEl`)가 같은 값을 낸다. 받는 왕국은 전투원 `element` + `ownSyn.stage`.
- 주의(Mars): `synExtraView`(2318)는 **필드에 놓인 전설 전체**를 나열한다. 전투 칩은 "해당 하수인에게 적용되는" 것이므로 **지금 싸우는 전투원의 `legend`** 로 걸러야 한다(가방/cap 전설 대리는 필드 목록에 없고, 필드의 다른 전설은 이 전투원에 적용되지 않는다).
- 원천은 보드 추정이 아니다: 전투 중 `synView`는 참전 확정 순간 굳은 `battle.syn[좌석]`을 읽고(2299), 서버는 그 복제만 싣는다(`battle.syn` 없으면 `null` · 2237). 클라이언트도 그것을 `B.syn[me]`에 넣는다(`network.js:1137`). 다만 `synExtraView`의 **전설 목록은 `g.pieces`(보드)를 돈다**(2320) — 이 부분이 보드 추정이므로 전투 칩에 그대로 쓰지 않는다. 클라이언트 유도 0을 원하면 대안은 owner-only `ownSyn.self`(전투원에 실제 적용된 왕국 `el`과 전설 개인 가산 값, 엔진 `f.synEl`·`f.syn*`에서 읽음) 한 칸 추가다 — 자기 정보라 새 노출은 없으나 #235 R1(`synEl` 등 키 금지 `test-issue235-boundary.js:90`)과 겹치지 않는 키 이름·단언 1건이 필요하다. 기본 권고는 추가 없음(스냅샷 + Core 함수 + 전투원 `legend`/`element`).
- 패널 숫자는 **기본값**, 가산은 칩으로(#294 4.1과 같은 원칙) — 이 안이면 서버 `syn*` 추가가 필요 없다. 가산 포함 유효 수치를 숫자로 보이려면 owner-only로 `synDef·synSpd·synDodge·synCrit·synStatusPct`를 열어야 하고 `test-issue235-boundary.js:90`의 `hidden` 목록(어느 좌석에도 없음)을 소유자 예외로 고쳐야 한다 — 권고하지 않는다(일시 버프 `spdBuff·evadeBuff·dmgUpBuff`까지 끌려온다).

### 4.3 사용 가능 상태 (Mars 발견 확인) [확정·정적]

`v2ReqOk`(`data.js:733~739`)는 `f.onceUsed`·`f.burrowRound`를 읽는데 둘 다 전투 뷰에 없다 → 온라인에서 전투당 1회 기술은 쓴 뒤에도 "사용 가능", `afterBurrow` 기술은 항상 "(불가)"로 그려진다([미재현]). 최소안: `_skillsFor`(2129)의 **자기 쪽 항목에만** `usable: T.slotUsable(...)` 불리언 — 규칙 사본 없음, 상대 항목에는 키를 만들지 않는다(상대의 "전부 막힘"은 비공개 `ui.js:1640~1644`). AC "쿨다운/사용 가능 상태" 범위라 P-own과 함께 권고하되 채택은 PD 판단.

### 4.4 시계 — 변경 없음 [확정·정적]

`_clockView`(1893)는 `owner===seatIndex`만, `_boardClockView`(1904~1911)는 `_bclock`을 읽지 않는다. 상대의 전투 60초는 어느 뷰에도 없다. 콘티 `44초`는 내 차례 그림이며 서버는 손대지 않는다.

## 5. "상대도 공개" — 선택지 (CJ 미확정)

콘티 원문은 `상대도 공개` 네 글자이고 화살표는 상대 패널(이름줄·HP 줄·**빈** 6칸)을 가리킨다. 무엇을(틀만/기본 6스탯/가산 포함) 공개하는지는 적혀 있지 않다. 최신 CJ 지시가 옛 GDD 7.9보다 우선하므로 거부 사유는 아니지만, 범위는 CJ가 정한다.

| 안 | 상대 패널 | 서버 필드 | 새로 드러나는 것 | 고쳐야 하는 단언 | 그대로인 단언 |
|---|---|---|---|---|---|
| **P0** 현행 공개만 | 이름·HP/최대·방어막·상태. 6칸은 없음 또는 `비공개` | P-own만 | 없음 | 없음(신규 1건: 상대 쪽에 여섯 키 없음) | 전부 |
| **P1** 전투 중 **기본** 6스탯 | 엔진 기본값 6칸 | 여섯 칸을 owner 분기 밖(양쪽)으로 | **상대 동료의 암살자/방패병 구분**(def 5/20 등 — 현재는 공개된 기술로만 앎). 본체 하수인·전설·왕은 공개된 종+등급(#293 `room.js:2092~2099`)으로 이미 계산되는 값. 대리 출전의 등급은 이미 `maxHp`+`artRosterId`로 역산 가능(#262가 실제 최대 HP 공개) [추론] | `test-combat-stats-boundary.js:25`의 `NEVER_IN_BATTLE`에서 `STAT_BUNDLE` 5개 제거(151 루프) · `room.js:2158~2160` 주석 치환 · GDD-23 7.9/프로토콜 §2.6.2 문구(Venus/Mercury) | `grade·shieldStartPct·shieldLayers·evadeBuff·dmgUpBuff…`(25~28) · 보드 뷰 `NEVER_TO_OPPONENT`(19·110) · `synAtk` R1c~R1e · 미공개 스킬/칸 수(`_skillsFor`) · #292 `uid·grade·legend·cap` 없음 · 시계 |
| **P2** 가산 포함 유효 수치 | 시너지·버프 반영값 | 상대 쪽 `syn*` 6칸(+일시 버프) | 상대 필드의 아키타입·속성 집계 역산(7.9 소유자 전용 · `room.js:2203~2204`) | 위 + `test-issue235-boundary.js:90·102~105`(R1·R1d·R1e) 폐기, `ui.js:1639` `fShow` 마스킹 폐지 | — |

P1의 좁은 해석(PD 권고와 같은 선): **지금 공개된 두 전투원의, 등급 성장분이 든 기본 6스탯**만. `grade` 키는 전투 뷰에 추가하지 않는다 — 본체 등급은 #293이 보드 뷰로 이미 공개했고(GDD 최신 override), 대리 출전 개체의 등급은 P1에서도 키로 싣지 않는다(다만 `maxHp`·`atk`에서 역산 가능하다는 점은 현행 #262와 같은 양으로 남는다).

Jupiter 권고: **P0로 구현 준비, P1은 CJ 한 줄 확인 뒤**. P2는 "쓰지 않은 스킬·시너지 집계 비공개"와 직접 충돌하고 콘티에 근거가 없다. 어느 안이든 상대 쪽 값은 서버가 실은 것만 — `netStubStats`(`network.js:617~627`)·종 표로 채우지 않는다(상대 동료를 전부 암살자로 지어냄 625).

바뀌지 않는 비공개(모든 안): 상대 미공개 스킬 id/이름·칸 수(2116~2133) · 가방/인벤토리/볼/패키지 · `ownSyn`은 자기 좌석만(2237) · `bonus.allowed`는 소유자만(2220) · 상대 60초.

## 6. 위력 범위는 무엇인가

`dmgRange(slotPow(f,sk))` = `pct × effAtk / 100` 반올림 ± `BAL.dmgVar` 20% [확정·정적]. `resolveHit`의 ④상성 ⑤피해 증가 ⑥약화 ⑦치명 ⑧상대 방어·경화·`dmgCut` ⑨균열/표식, 고정 가산·추가타 배율·방어막 흡수는 들어 있지 않다. 즉 **"위력"이지 "상대 HP에 들어갈 예상 피해"가 아니다**. 진실한 이름표는 `위력`. 순(純) 예상 피해는 상대 `def+synDef`(P2급 공개)와 피해 식 사본이 필요하고, `resolveHit`의 `preview` 옵션은 난수·약화를 소모해 표시용으로 못 쓴다 — 이번 범위에서 만들지 않는다. 최소 알고리즘: 현행 식 유지 + "`atk`가 숫자가 아니면 `?`" 가드 한 곳(Mars · `effAtk`는 판정 공용이라 무수정).

## 7. 구현 후 최소 서버 확인 (지금 실행 안 함 · 각 1회)

기존 파일에 단언만 더한다(새 테스트 파일·스크립트·의존성 없음).

| 파일 | 더할 좁은 단언 |
|---|---|
| `test-issue235-boundary.js` 3절(R1c~R1e 옆 · 양 좌석 루프 기존) | 내 전투원 `atk === 엔진 f.atk`·여섯 칸이 숫자, 상대 전투원에 그 키 없음(P0) 또는 엔진 값과 같음(P1) |
| `test-issue292-art.js` 2절(가방 대리 · 일반 종 ⭐2 + `L-REAPER` · 양 좌석 · 재연결 기존) | 소유자 좌석 `battle.a.atk === B.fa.atk`(등급 성장분·전설 값 포함 · 왕/동료 본체 값이 아님) · 엔진 `fa.atk`를 지우면 키가 **없다**(0으로 채우지 않음) · 엔진 `fa.atk=0`이면 숫자 0 그대로 |
| `test-combat-stats-boundary.js` 3절 | P0: 무변경으로 통과해야 함(owner-only 여섯 칸 때문에 151 루프가 깨지므로 **소유자 쪽 예외를 명시**해야 한다 — 이 수정은 P-own만으로도 필요) · P1: `NEVER_IN_BATTLE` 명시적 치환 |

필수 CI 6개는 PR에서. 오프라인(PVE·핫시트)·`0~0`→`?` 표기·시각 대조는 Mars의 `demo/test/regression`(`smoke_public_rooms.js` L블록) 소관이고 판정은 Saturn이다. Jupiter는 제품 QA를 대신하지 않는다.

## 8. 소유 분리

| 역할 | 범위 |
|---|---|
| Jupiter | `room.js` `side()` owner-only 여섯 칸(+선택 `usable`) · 위 서버 테스트 단언 · P1 확정 시 양쪽 전송과 단언 치환 |
| Mars | `netSynthFighter`/`battleModal` 소비 · `?` 가드 · 전투원 기준 시너지 칩 · 콘티 레이아웃 · 오프라인 allowlist |
| Venus/CJ | "상대도 공개" 범위(P0/P1/P2) · `위력` 이름표 · 동료 16 vs 표 18/14 [기획 필요] · GDD-23 7.9 문구 |
| Earth | 전장 색·패널 시각 |
| Mercury | Git·GitHub·Decision Log |

## 9. 미확정·한계

- [미확정] 5장 P0/P1/P2 · 4.3 `usable` 채택 여부 · 2.3 동료 수치 불일치 처리.
- [미재현] 전 항목. 줄 번호는 `e48a8aa` 기준 정독 결과이며 와이어 캡처·실행 대조 없음. GDD/Notion 원문은 읽지 않았다(코드 주석·#293/#294 계약 문서만).
- 실행값: 세션 표시 모델 `claude-opus-5-5`(시작·종료 동일, 자동 전환 없음). effort는 세션 안에서 조회 수단이 없어 **확인 못 함**. 권한 프롬프트 0건.
