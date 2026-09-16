# #233 전투 엔진 개편 — Mars 구현 보고 (Opus 5 교체 담당)

2026-09-16 · CJ 승인 모델 교체 후 이어받은 두 번째 Mars(`claude-opus-5`, effort high, dispatch `ctx_53f16c9efb3a`).
기준: GDD-23 3·4장 + 5.6 공통 규칙(`C:/dd_cdp/issue-233-gdd.md`), [Issue #233](https://github.com/ChangjoSung/Digit-Duel/issues/233), 인계 문서 `C:/dd_cdp/issue-233-mars-recovery.md`.

상태: **구현 완료.** Saturn(Terra) 독립 QA **PASS** 수신(`msg_73f58ec0f838`). Git 쓰기·PR·필수 CI 6종 실행은 Mercury 소관이다.

---

## 1. 한눈에 보는 결과

| 항목 | 결과 |
| --- | --- |
| 신규 집중 검사 `demo/test/regression/smoke_issue233.js` | **309 단언 / 0 실패** (Saturn 독립 재실행도 309/0) |
| 음성 대조(변형판 주입) | **23종 전부 검출** — 검사가 비어 있지 않음을 고정 |
| 서버 경계 검사(Jupiter 소유) | 547 passed / 0 failed — Saturn 확인 |
| 영향받은 기존 회귀 | 7파일 갱신, 각 파일 개별 실행 green (§5) |
| 필수 CI | 6종 유지, 잡 A에 신규 스위트 1줄 추가 (약화 없음) |
| 제품 결함 수정 | **6건** (§3) — 이 중 3건은 PD·Saturn 지적, 3건은 자체 발견 |

---

## 2. AC 커버리지 (GDD-23 3·4장 + 5.6)

모두 **실제 엔진 함수 직접 호출** 또는 **실제 전투 경로(execSlot·__actCore·startRounds·nextPhase·netSynthBattle)** 로 검증했다. 헬퍼 전용 대체물은 없다.

| GDD | 내용 | 검사 | 라이브 연결 |
| --- | --- | --- | --- |
| 3.3 | 아키타입 6종 기본 스탯표 | B1~B4 | ✅ `applyArchStats` |
| 3.4 | 등급 성장 HP ×1.15/ATK ×1.10, def·spd·dodge·crit·💫 불변 | A1~A17 | ✅ |
| 3.5 | 왕·동료 고정 스탯(등급 null) | B5~B9 | ✅ `applyFixedStats` |
| 3.6 | 전설 3종(⭐5 고정) | B10~B15 | ⚠️ 계약만 — 로스터는 #234 |
| 3.2 | 방어막 층·LIFO·깨짐(breaks)·제거는 깨짐 아님 | E1~E23 | ✅ |
| 3.2 💫 | 상태이상 부여 확률 %p 가산·상한 100% | J1~J12 | ✅ **gate 2곳 모두** |
| 3.2 | 확정 회피/치명 — 상한 우선·rand 미소비·1회 소모 | K1~K11 | ⚠️ 계약만 — 켜는 기술은 #234 |
| 4.1 | 5속성 순환(땅 포함)·1.3/0.75 | C1~C9 | ✅ |
| 4.2 | 피해 계산 ①~⑪·단계별 상한·**단일 반올림**·최소 1 | D1~D37, O1~O3 | ✅ |
| 4.2 | GDD 4.7 해 보기 예시 34 피해 재현 | D1~D1d | ✅ |
| 4.3 | 반사·반격·지속(방어막 무시)·예고·즉사 | F1~F25 | 반사/반격/예고/즉사는 계약만(#234) · 지속(화상)은 ✅ |
| 4.4 | 선턴·후턴 — 순서 효과 > 속도 > (양쪽 등급일 때만) 낮은 등급 > 접촉 개시자 | G1~G27 | ✅ |
| 4.4 | **라운드 시작 시 확정** (도중 감전에 흔들리지 않음) | G18~G25 | ✅ |
| 4.4 | [설계 보완] 등급 없는 왕·동료는 등급 단계 건너뜀 | G14~G16 | ✅ |
| 4.4 | 승패 동률 = 접촉을 받은 쪽(D) 승 — 현행 보존 | L6~L9 | ✅ |
| 4.5/5.6 | 중첩·재부여(큰 값·긴 지속, 합산 아님) | H1~H7, O4~O13 | ✅ **3경로 전부** |
| 4.5/5.6 | "N 라운드"는 부여 라운드를 세지 않음 | H8~H26, M1~M17 | ✅ 화상·감전·균열·경화·회피↑·피해↑ |
| 4.5 | 균열=상태이상 / 경화·흡수·방어막=버프 | H27~H33, P1~P9 | ✅ |
| 4.5 | 약화만 횟수제 | H34~H39, O10~O11 | ✅ |
| 4.6/5.6 | 전투 사이 **HP만 유지**, ⌛ 전부 0 | I1~I10 | ✅ 레거시 스칼라 `cd` 포함 |
| 4.6 | 연쇄 금지(반사·반격이 다시 반사·반격을 부르지 않음) | F8~F12 | ✅ 엔진이 `chainLock`으로 직접 차단 |
| 4.2 | 전투 판정용 유효 피해 흡수 상한 — 현행 보존 | L1~L5 | ✅ |
| 7.9 | 공개 방은 비공개 spd/grade로 순서를 재계산하지 않음 | N1~N7 | ✅ |
| — | pendingFx tag(서버 락스텝 식별자) | N8~N13 | ⚠️ 계약만 — 예고 기술 호출처 0건(#234) |

**⚠️ 표시는 "#234 전까지 그 효과를 거는 기술이 로스터에 없다"는 뜻이지 미구현이 아니다.** 엔진 계약은 완결했고 검사가 실제 함수를 직접 호출해 고정한다. 신규 로스터(#234)·시너지 수집(#235)·경제(#236)·네트워킹(#237)·UI 개편(#238)은 착수하지 않았다.

---

## 3. 수정한 실제 결함 6건

### 3.1 [PD 지적] 이중 반올림 — `slotPow`
`slotPow`가 `Math.round(sk.pow*f.atk/22)`로 먼저 반올림하고 `resolveHit` ⑩이 또 반올림해 GDD 4.2 ⑩ "정수 반올림 1회"를 깼다.
`slotPowRaw()`를 신설해 **피해 경로만** 소수를 그대로 ②에 넣고, `slotPow`는 표시용(기술 라벨 `dmgRange`·AI 추정 2곳)으로 남겼다.
실측 차이: 화염탄 pow 26 · 공격력 20 · 방어력 10 → 26×20÷22 = 23.636… → 단일 **21** / 이중 **22**.

### 3.2 [PD 지적] 재부여 거부 — `applyStatus`
`!opp.burn` / `!opp.weaken` / `!opp.shock` 가드가 "이미 걸렸으면 재부여 자체를 차단"해, GDD 5.6 "큰 값·긴 지속으로 갱신"이 **라이브에서 통째로 죽어 있었다**(마녀 경로만 예외적으로 갱신). 가드를 제거하고 **3경로 전부**를 갱신 의미로 맞췄다 — ① `execSlot` `applyStatus` ② 구형 `__actCore` `tryStatus` ③ `witchApply`.
화상·감전은 공용 `applyTimedFx`(부여 라운드 제외 가드 포함), 약화는 5.6 예외인 횟수제라 `Math.max`.

### 3.3 [Saturn 지적] 균열이 '상태이상 대상' 보너스에서 누락
`lightning_heavy`의 `bonusVsStatus`가 `burn||weaken||shock`만 보아 새 상태이상 **균열**을 빠뜨렸다. 라이브 1곳 + AI 추정 2곳을 함께 고쳤다.
두 단계를 분리해 검증했다(P3~P9): 기준선 34 / 화상 40(②에 +6) / **균열 44**((34+6)×1.1 — ②의 +6과 ⑨의 +10%가 함께) / 경화 31(버프라 +6 없음, ⑧만) / 방어막 34(버프).

### 3.4 [PD 결정] 화상이 부여 라운드에 즉시 tick
GDD 4.7 "화상은 부여된 라운드를 세지 않으므로 **다음 2개 라운드의 종료 시에 각 5**"와 어긋나 R1 부여 시 R1·R2에 들어갔다.
`burnFresh` 게이트가 부여 라운드의 **피해와 감소를 둘 다** 건너뛴다 → R2·R3 2회. 감소에만 걸면 3회가 되어 총량이 늘어나는데, 그 잘못된 갈래를 일부러 만든 변형판이 검사 5건으로 걸린다.
*경위: 처음에는 4.5의 "(현행)" 괄호 때문에 라이브 밸런스 변경을 보류하고 PD에 [확인요청]으로 올렸다. PD가 4.7·5.6 명시문 우선으로 결정(`msg_401d872fd54b`)해 반영했다.*

### 3.5 [자체 발견] 균열·경화에 부여 라운드 제외 가드 없음
감전의 `shockFresh`에 해당하는 가드가 없어 2R 효과가 실질 1.5R로 짧아졌다. `crackFresh`·`hardenFresh` 추가.

### 3.6 [Jupiter 지적] 공개 방 선턴이 항상 'A'로 떨어짐
`decideFirstSide`가 읽는 spd·grade·vanguardTurn은 상대 전투 뷰에 없고(7.9 등급은 소유자 전용) 앞으로도 보낼 수 없다. 그래서 `netSynthBattle` 경로에서 spd 0·0 / grade null로 떨어져 **항상 'A'** 가 되고 `battleModal`이 틀린 패널·행동 메뉴를 그렸다.
Jupiter 권장안 (A)를 채택해 **서버 필드 추가 0개**로 `bd.actor`+`phase`에서 복원한다. (actor, phase) 네 조합 모두에서 `actorOfPhase()`가 서버 actor와 일치함을 N2~N7이 고정한다.

---

## 4. 새로 만든 엔진 계약

- `applyTimedFx(f,key,rounds,magKey,mag)` — 5.6 중첩·재부여 공통 진입점. 수치는 큰 값, 지속은 긴 값(합산 아님, 방어막만 예외). **재부여 비교는 "이번 라운드 종료에 어차피 빠질 1"을 먼저 반영한 잔여로** 한다 — 그래야 "지금 새로 거는 NR"과 "이미 걸린 것을 NR로 갱신"이 같은 라운드에 끝난다(H23~H26).
- `applyCrack` / `applyHarden` / `applyEvadeBuff` / `applyDmgUpBuff` — 4.5 사전의 개별 진입점.
- `slotPowRaw(f,sk)` — 피해 파이프라인용 미반올림 위력.
- `scheduleDelayed(f,delayRounds,run,tag)` — `{roundsLeft,tag,run}`. tag 미전달은 `null`(서버 역호환).

### 서버(Jupiter) 필드 계약 — 합의 완료
좌석 프레임 추가 필드 **0개**. 서버 내부 락스텝 요약에만 들어가는 신규 필드: `burnFresh` · `crackFresh` · `hardenFresh` · `evadeBuffR`(+`Fresh`) · `dmgUpBuffR`(+`Fresh`). (기존 계획의 `B.firstSide`·`shockFresh`·`critForce`·`dodgeForce`·`vanguardTurn`은 그대로 유효.)
`critForce`/`dodgeForce`는 `rand()` 호출을 건너뛰어 두 엔진의 난수 정렬을 바꾸므로 요약에 필요하다(K3·K8이 rand 미소비를 고정).

---

## 5. 실행한 검사와 결과 (정확히 기록)

**신규 집중 검사** — `node demo/test/regression/smoke_issue233.js` → **309 pass / 0 fail**. Saturn(Terra)이 독립 실행해 같은 309/0 확인.

**음성 대조 23종 전부 검출** (메모리 밖 변형판을 만들어 `smoke_issue233.js`에 물림):
균열 fresh 가드 제거 · 이중 반올림 · 선턴 재계산 · 등급 계수 변경 · 회피 상한 제거 · 💫 가산 제거(gate 구현 **2곳 각각**) · 방어막 LIFO→FIFO · 확정 치명 제거 · 쿨 초기화 제거 · 연쇄 금지 해제 · 화상 게이트 제거 · **화상 게이트를 감소에만 적용(3회 tick)** · 화상 부여 시 게이트 미설정 · 공개 방 선턴 복원 제거 · pendingFx tag 제거 · burn/weaken/shock 재부여 거부 복구 · 재부여를 합산으로 변경 · 균열 보너스 누락 복구 · 경화를 상태이상으로 오분류.

**영향받은 기존 회귀** — 각 파일 개별 실행 결과:

| 파일 | 결과 | 갱신 사유 |
| --- | --- | --- |
| `smoke_issue233.js` (신규) | 309 / 0 | — |
| `smoke_attack_balance.js` | 54 / 0 | C4a 50→**51**, C6a 32→**33**, C6c 46→**47** — 이중 반올림 제거(§3.1). 손으로 계산한 GDD 값과 일치 |
| `smoke_shock.js` | 67 / 0 | D3·D4를 지속형 💫 +10%p 반영값으로(0%→10%, 50%→60%) · `giveLegacy`에 💫·속도 고정 · J2·J3·J6 변형 앵커 갱신 |
| `smoke_search_packages.js` | 300 / 0 | E2h를 5.6 재부여 갱신으로(마녀 전용 예외 해소) · C6 phase를 선턴에서 유도 |
| `smoke_issue146.js` | 215 / 0 | F2·F9·F9e 전제를 **새 규칙으로 재구성**(§6) |
| `smoke_turnflow.js` | 203 / 0 (연속 5회 동일) | G27·J 절 순서 고정 |
| `smoke_cycle5.js` | 70 / 0 | 잔여 `DBG console.error` 제거 · E4/E5 조건을 **전투 시작 전**에 설정 |
| `smoke_cross_skill.js` | pass | 직전 Mars 변경분 유지 — 추가 수정 없이 통과 |

**정확성을 위해 명시한다 — 전체 `smoke_*.js` 동시 실행의 마지막 1회는 §3.3·3.6·§6 수정 *이전* 시점이다.** 그 뒤에 바뀐 파일은 위와 같이 **개별 실행으로 green**을 확인했고, 전체 동시 실행 최종 1회는 PD가 PR에서 돌리는 필수 CI 6종이 담당한다(CJ 최소 QA 정책 · PD `msg_504593764ccb` 반복 금지 지시).
`smoke_public_live.js`(CI B, 실서버 2클라이언트)는 로컬에서 실행하지 않았다 — `server/node_modules` 미설치이며 QA 최소 정책상 네트워크 매트릭스 반복은 하지 않는다. CI가 `npm ci` 후 실행한다.

브라우저 조작·Computer Use·수동 네트워크 매트릭스·밸런스 시뮬레이션은 **하지 않았다**.

---

## 6. 기존 회귀를 고친 방식 (어서션을 지우지 않았다)

PD 지시(`msg_76877cdd4e7f`)대로 **검사의 초점은 보존하고 픽스처만 합법적 새 순서로 재구성**했다.

`smoke_issue146` F2·F9·F9e는 "R1 후턴으로 행동한 전투원이 R2 선턴으로 또 행동한다"는 위험 상황에서 **옛 클로저가 두 번째 행동까지 소비하는지**를 본다(행동 전환 토큰). 종전에는 행동 순서가 라운드 홀짝이라 그냥 성립했지만, 4.4에서는 선턴이 매 라운드 다시 확정된다.
그래서 헬퍼 `flipOrderNextRound(X)`를 두어 **R1 선턴 쪽에 감전(후턴 효과)을 건다** — `shockFresh=true`라 부여 라운드 종료에 소모되지 않고 R2 진입 판정에 반영되어, 같은 전투원이 라운드 경계를 넘어 연속 행동하는 상황이 **실제 규칙으로** 만들어진다. 검사 대상인 토큰 단언(F2c·F9b·F9c·F9e5)은 한 글자도 바뀌지 않았다.

같은 원칙으로 `smoke_turnflow`·`smoke_search_packages`·`smoke_cycle5`는 **속도·등급을 전투 시작 전에** 동률로 맞춰 접촉 개시자(A)가 선턴이 되게 고정했다(4.4 3항-3). 전투 시작 뒤에 `spd`를 바꾸면 이미 굳은 선턴은 바뀌지 않는다 — 직전 Mars가 E4에서 막혔던 지점이 이것이다.

부수 효과로 **기존 잠복 불안정성 1건을 제거**했다: `smoke_turnflow` G27e는 새 게임마다 무작위 배정되는 아키타입 속도에 따라 붙었다 떨어졌다 했다(고치기 전 3회 중 2회 실패). 순서를 고정한 뒤 연속 5회 동일하게 통과한다.

---

## 7. 변경 파일

**제품(Mars 소유)**
- `demo/index.html` — 엔진 본체. 8스탯·등급 성장·5속성·피해 ①~⑪·방어막 층·타입별 피해·선턴 확정·상태/버프 중첩·지속·HP만 유지·💫·확정 효과·공개 방 선턴 복원·`slotPowRaw`·`applyTimedFx` 계열.

**검사·하네스**
- `demo/test/regression/smoke_issue233.js` — **신규** 집중 스위트(309 단언).
- `demo/test/shared/harness.js` — 엔진 심볼 노출 추가(`resolveTyped`·`decideFirstSide`·`fighterOrderCat`·`finishBattle`·`applyTimedFx` 계열).
- `smoke_attack_balance.js` · `smoke_shock.js` · `smoke_search_packages.js` · `smoke_issue146.js` · `smoke_turnflow.js` · `smoke_cycle5.js` — §5·§6.

**CI**
- `.github/workflows/ci.yml` — 잡 A에 `node demo/test/regression/smoke_issue233.js` 1줄 + 설명 주석. **기존 6종 필수 검사는 그대로**이고 약화한 것은 없다.

**문서**
- `docs/milestone/v0.4.11/issues/233/Mars/report.md` (이 파일).

**Mars가 건드리지 않은 것**: `server/authoritative/room.js` · `server/package.json` · `server/authoritative/test/test-combat-stats-boundary.js`(Jupiter 소유) · `CLAUDE.md` · `docs/creat2ve/*`(Mercury 소유) · Roblox/Unity · 자산. Git 쓰기·GitHub/Notion 쓰기는 하지 않았다. 원본 작업공간 `C:/Users/pc_77/orca/Digit-Duel`의 `art/`·`orca-hook-latency-report.md`에는 접근하지 않았고 백업을 보존했다.

---

## 8. 위험·한계 (Saturn·CJ가 봐야 할 것)

1. **라이브 밸런스가 바뀐 지점 3곳** — CJ 플레이 QA에서 체감될 수 있다.
   - 화상 tick이 한 라운드 뒤로 밀렸다(총량 동일, 타이밍 변경). 짧은 전투에서는 화상 피해가 덜 들어간다.
   - 이중 반올림 제거로 일부 기술 피해가 **1 올라갔다**(예: 상성 우위 50→51).
   - 재부여가 가능해져 지속형 상대의 상태이상 유지력이 올라간다.
2. **#234 전까지 라이브 호출처가 없는 계약** — 반사·반격·예고(지연)·즉사·확정 회피/치명·균열·경화·회피↑·피해↑·보호형 시작 방어막·전설 스탯·땅 속성. 엔진과 검사는 완결했지만 **실제 기술로 밟아 본 적은 없다**. #234에서 로스터를 붙일 때 이 계약을 그대로 쓰는지 확인이 필요하다.
3. **pendingFx `tag`는 합성 픽스처로만 검증** — 예고 피해 기술 호출처가 0건이라 실제 생성 경로가 없다. #234에서 예고 기술을 붙이는 담당이 반드시 안정된 문자열을 넘겨야 하며, 안 넘기면 서버 락스텝이 같은 라운드의 서로 다른 예고를 구분하지 못한다(주석으로 남겼다).
4. **AI 휴리스틱 피해 추정은 미보정** — `aiMainStrong` 등이 방어력·회피·치명타를 고려하지 않고 옛 공식으로 추정한다. 합법성은 깨지지 않고(`smoke_ai_completion` 통과) `bonusVsStatus` 조건은 라이브와 맞췄지만, 판단 정확도가 체계적으로 어긋날 수 있다. **#233 필수는 아니나 밸런스 백로그로 기록한다.**
5. **전체 회귀 동시 실행 최종 1회 미수행** — §5에 사유와 대체 경로(PR 필수 CI)를 적었다.
6. **`burnBy`·`rec` 귀속 누계** — 화상 타이밍이 바뀌어 라운드별 배분이 달라진다(총량 동일). Jupiter가 서버 요약에 넣지 않아 '알려진 미탐지 구간'이며, 이 판단에 동의한다.

## 9. 자기 판정 금지

Mars는 자기 구현물의 QA 판정을 대신하지 않는다. 최종 판정은 Saturn(Terra, `ctx_d4c8497de7b7`)의 **PASS**이고, 그 위 최종 품질 게이트는 CJ 플레이 QA다.
