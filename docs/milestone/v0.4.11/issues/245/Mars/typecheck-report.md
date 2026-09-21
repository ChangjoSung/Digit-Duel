# #245 — 상태·액션·이벤트·프로토콜 정적 계약 검사 (Mars)

- 기준 커밋: `2b9a454e8ab20504a4d884bacae83ac9a22ea64f` (clean HEAD)
- 역할/모드: Mars · IMPLEMENT · CLIENT/TOOLING · mutation=code · 단독 편집자
- Git·GitHub 쓰기 없음. 서버 구현·서버 테스트·서버 package 파일 **미수정** (읽기만).
- 2026-09-21 Saturn REVISE 반영본. 아래 4·5절이 그 교정 내용이고, 나머지는 최초 납품 그대로다.

## 1. 무엇을 했나

게임 코드는 그대로 **classic script** 다. 번들러도 프레임워크도 상태관리 라이브러리도 빌드 산출물도 넣지 않았고,
`demo/index.html` 이 유일한 진입점이며 `file://` 로 열면 그대로 돈다. 브라우저/서버 공유 Core, 결정성, 기존 Node 회귀도 그대로다.

그 위에 **읽기만 하는** 검사 하나를 붙였다: `tsc --noEmit` 로 `demo/js/*.js` 를 `allowJs`·`checkJs` 로 읽고,
네 경계의 어휘가 서로 맞는지 본다. 도구 의존성은 루트 `package.json` 의 `typescript` **정확 버전 1개**뿐이다.

## 2. 파일

| 파일 | 성격 | 내용 |
|---|---|---|
| `package.json` · `package-lock.json` | 신규 | `typescript` 5.9.3 고정 · `npm run typecheck` · `npm run test:typecheck` |
| `.gitignore` | 수정 | 루트 `/node_modules/` 추가 |
| `tools/typecheck/tsconfig.json` | 신규 | 양성 검사 설정 (`noEmit`, `exclude` 없음) |
| `tools/typecheck/contracts.d.ts` | 신규 | 액션·이벤트·프로토콜 계약 + 전투·탐색 보상 상태 계약 + 상태 보조 타입 |
| `tools/typecheck/env.d.ts` | 신규 | `window.x=…` 전역 선언 (포괄 인덱스 시그니처 **미사용**) |
| `tools/typecheck/test/typecheck_test.js` | 신규 | 검사 자체의 회귀 — **70건** (별도 파일 음성 대조 + **실제 소스 변이** + 설정·억제 감사 + 서버 어휘 대조) |
| `tools/typecheck/test/tsconfig.negative.json` · `test/negative/{state,action,event,protocol,battle}.js` | 신규 | 다섯 계약 음성 대조군 |
| `.github/workflows/ci.yml` | 수정 | **필수 검사 A 잡 안에** 3스텝 추가 (새 잡을 만들지 않았다 — 새 잡은 branch protection 의 필수 6개에 들지 않아 실패해도 병합을 막지 못한다) |
| `demo/js/state.js` | 수정 | 상태 리터럴을 `newGameState()` 로 분리 + 칸별 `@type` 계약 (`battle`·`recruit` 포함) |
| `demo/js/core.js` | 수정 | reducer·`actorOfPhase`·`battleActionFrame`·`battleCmdCtx`·`recruitState` 계약 주석/시그니처 |
| `demo/js/network.js` | 수정 | `netSend`·`netAction`·`applyAction`·`netSendAction`·`netSendCmd`·`netSynthBattle` 계약 + 환경 캐스트 |
| `demo/js/ui.js` · `ui-overlays.js` · `ai.js` | 수정 | `applyUiEvents` 계약 주석 + DOM/추론 캐스트 |
| `tools/README.md` | 수정 | 도구 인덱스에 등재 |

`demo/index.html` 은 **한 글자도 바뀌지 않았다.** 런타임 동작이 바뀐 코드는 없다(주석·JSDoc 캐스트·죽은 인자 1개 제거뿐).
런타임 객체 리터럴의 모양(키·순서·값)도 바꾸지 않았다 — `S.battle`·`S.recruit` 계약화는 **선언만** 붙인 것이다.

## 3. 다섯 계약이 실제로 무엇을 검사하는가

### 상태 (state)
`GameState` 를 손으로 적은 표가 아니라 **`newGameState()` 리터럴에서 그대로 끌어온다**
(`Sealed<ReturnType<typeof newGameState>>`). 표가 두 벌이 아니므로 drift 가 구조적으로 불가능하다. `Piece` 도 `mkPiece()` 에서 같은 방식.
`Sealed<T>` 는 매핑 타입 한 번으로 tsc 의 **JS expando**(`.js` 리터럴 타입에 나중 대입으로 칸을 몰래 늘려 주는 성질)를 끊는다 —
이게 없으면 `S.mainUsedd=true` 같은 오타가 상태 계약을 그냥 통과한다. `S` 는 `@type {GameState}` 로 묶여
`core.js`·`ui.js`·`ai.js`·`network.js` 의 **모든 `S.x`·`state.x` 접근**이 검사 대상이 된다.

### 전투·탐색 보상 상태 (battle / recruit) — Saturn REVISE(MEDIUM)
종전에는 `S.battle`·`S.recruit` 이 `any` 라 `S.battle.nonexistentContractField` 가 그대로 통과했다.
둘 다 **닫힌 계약**(`BattleState`·`RecruitState`, 포괄 인덱스 시그니처 0)으로 올렸다.
`BattleState` 는 한 리터럴에서 끌어올 수 없다 — 구축 지점이 **둘**이기 때문이다:
`core.js startRounds()`(로컬 규칙 엔진)와 `network.js netSynthBattle()`(권위 방 스냅샷 복원)이 같은 필수 칸에
서로 다른 표시 칸을 더하고, 그 위에 전투 진행 중 붙는 칸(`firstSide`·`menu`·`pkgSel`·`chainLock`·`reflectSeq`…)이 있다.
그래서 두 구축 지점과 실제 접근 지점을 옮겨 적고, `netSynthBattle` 의 리터럴을 `@type {BattleState}` 로 **묶어**
스냅샷 복원 쪽도 같은 표를 받게 했다. 전투원(`fa`/`fd`) 내부 수치 구조는 여전히 이 네 경계 밖이다(아래 8절).

### 액션 (action)
`CoreAction` 25종 + `NetOnlyAction` 4종의 판별 유니온(`t`). `reduceCoreAction`/`resolveCoreAction`/`dispatchCoreAction` 이
이 타입을 받으므로 reducer **본문 700줄의 `action.x` 접근 전부**와 모든 호출처가 `t` 별로 좁혀져 검사된다.

### 이벤트 (event)
`CoreEvent` **34종** 판별 유니온. reducer 반환(`CoreResult`)과 소비처 `applyUiEvents(ui.js)` 양쪽에 걸려,
없는 `type` 을 내보내거나 싣지 않은 칸을 읽으면 그 자리에서 걸린다. 포괄 인덱스 시그니처는 **0개**다.

### 프로토콜 (protocol)
릴레이 프레임(`hello`/`hello2`/`a`)과 권위 서버 봉투(`NetCommandFrame`)를 `netSend` 에,
회선 액션(`NetWireAction`)을 `netAction`·`applyAction`·`netSendAction` 에 걸었고,
명령 래퍼 `netSendCmd` 에는 명령 이름과 그 명령이 실어야 하는 칸을 묶은 `@overload` 목록을 걸었다.
추가로 `typecheck_test.js` 가 서버 `protocol.js` 의 `ACTION_TYPES` 21종과 `COMMAND_TYPES` 8종을 **읽어서**
클라이언트 계약에 전부 있는지 대조한다.

## 4. Saturn REVISE 교정 (2026-09-21)

| 항목 | 종전 상태 | 교정 |
|---|---|---|
| **HIGH 1** `BattleWire` | `side:number`·`phase:string` — 런타임과 **정반대**였다 (`core.js battleActionFrame` 은 `side=A\|D`, `phase=숫자`) | `side:BattleSide("A"\|"D")`·`phase:number` 로 바로잡고, `actorOfPhase()`→`BattleSide`, `battleActionFrame()`→`BattleWire\|null`, `battleCmdCtx()`→`BattleCmdCtx\|null` 로 **실제 경로를 묶었다**. `actorOfPhase(state)`·`recruitState(state)` 의 `state` 인자도 `GameState` 로 묶어 `B`·`R` 이 `any` 로 새지 않게 했다 |
| **HIGH 2** recruit 토큰 | 액션·`__recruitCore` 모두 `token:number` — reducer 는 `말id + "#" + 발급번호` **문자열**을 만든다 | 액션·env 선언을 `string` 으로 바로잡고, 숫자 카운터(`GameState.recruitToken`)와 문자열 토큰(`RecruitState.token`)을 계약에서 갈라 적었다. `action.token!==R.token` 비교가 이제 타입으로 묶인다 |
| **HIGH 3** `CoreEvent` | 14종이 `[k:string]:any` 였고 필수 payload 가 비어 있었다 | 34종 전부의 필수/선택 칸을 **실제 emit 지점과 실제 소비 지점에서** 옮겨 적고 인덱스 시그니처를 전부 제거했다. `resign` 의 `resignLoser` 도 `any` 캐스트를 없애고 계약 안에서 받는다. emit 지점도 소비 지점도 없던 `minion` 변형은 삭제했다(실측 0건). `any` 는 중첩 객체(`msgQ` 항목·회복 틱 묶음·`blog`)에만 남는다 |
| **HIGH 4** `netSendCmd` | 무검사 — `ready` → `ready_typo` 도, credential·`action`·`baseRevision` 없는 봉투도 통과 | `NetCommandFrame` 을 **닫힌 판별 유니온**으로 다시 적고(`list_rooms` 만 credential 없음 · `action` 은 `baseRevision`+`action` · `setup` 은 `roster`+`pos` — `validateEnvelope` 판정 그대로), `netSendCmd` 에 명령별 `@overload` 를 걸었다. **전송 프레임은 한 글자도 바뀌지 않는다** — 같은 `Object.assign` 이다 |
| **MEDIUM** battle/recruit 상태 | 둘 다 `any` | 위 3절 참조. 런타임 객체 모양 무변경 |
| **LOW** `@ts-ignore` 감사 | 개수(2)만 셌다 — 한 건을 지우고 다른 곳에 다는 교체가 통과 | 파일·종류·**그 주석이 덮는 바로 다음 구문**까지 정확히 대조한다 (`network.js` 의 `modal=function(html,buttons){` · `render=_renderWithOverlays;`) |

## 5. facade 가 아님을 무엇으로 보증하나

검사가 통과한다는 사실만으로는 계약이 살아 있다는 증거가 못 된다. 그리고 **별도 파일 음성 대조군만으로는
"선언이 존재한다"까지만** 증명된다 — 실제 게임 코드가 그 선언에 묶여 있는지는 별개 문제다(Saturn 지적).
그래서 `typecheck_test.js`(70건)는 두 층으로 본다:

**(a) 별도 파일 음성 대조군** — `negative/{state,action,event,protocol,battle}.js` 의 위반 줄이
**하나도 빠짐없이** 걸리는지 줄 번호 단위로 대조한다(현재 34건 검출).

**(b) 실제 소스 변이** — `demo/js/*.js` **사본**에 아래 17개 변이를 넣고 같은 설정으로 다시 검사해,
변이한 **그 줄**이 진단을 받는지 본다. 저장소 파일은 읽기만 한다. (tsc 실행 2회 — 같은 줄을 건드리는 변이만 묶음을 나눈다.)

| 계약 | 실제 소스 변이 |
|---|---|
| HIGH 1 | `battleActionFrame` 의 `side`↔`phase` 뒤바꿈 · 같은 곳 `phase`→`phse` 오타 · `actorOfPhase` 가 `A\|D` 아닌 값 반환 · `applyAction` → `__actCore(a.k,a.bf)` 인자 뒤바꿈 |
| HIGH 2 | recruit 토큰을 숫자 카운터로 발급 · 토큰 대조를 숫자 칸과 비교 · `__recruitCore` 에 숫자 토큰 전달 |
| HIGH 3 | emit `battleSlot.slot`→`slto` · 소비 `event.slot`→`event.slto` · emit `pkgOpenModal.owner`→`ownr` · 소비 `event.owner`→`event.ownr` (뒤 둘은 종전에 **인덱스 시그니처로 열려 있던** 변형) |
| HIGH 4 | `netSendCmd("ready")`→`("ready_typo")` · action 봉투에서 `baseRevision` 누락 · credential 없는 봉투 송신 |
| MEDIUM | `B.pkgSel`→`B.pkgSell` 쓰기 · `B.maxRounds`→`B.maxRoundz` 읽기 · `R.stage`→`R.stagee` 읽기 |

**(c) 감사** — `allowJs`·`checkJs`·`noEmit`·`include`·`exclude 없음` 설정 유지, `@ts-nocheck` 0건,
`@ts-ignore` 는 파일·종류·덮는 구문까지 알려진 2건과 정확히 일치, 서버 `ACTION_TYPES`·`COMMAND_TYPES` ⊆ 클라이언트 계약.

변이 묶음은 **각 변이 자신의 줄**이 걸리는지만 본다 — 다른 변이의 연쇄 오류로 통과하지 않는다.
변이 기준점이 소스에 정확히 1곳인지도 함께 단언하므로, 코드가 옮겨 가면 통과가 아니라 실패한다.

## 6. 검증 (2026-09-21 실측, 현재 작업 트리)

| 명령 | 결과 |
|---|---|
| `npm run typecheck` (양성) | **오류 0 · exit 0 · 1.2s** |
| `npm run test:typecheck` (음성 + 실제 소스 변이 + 감사) | **70 passed / 0 failed · 3.2s** |
| `node --check` — `demo/js/*.js` 8개 + 검사기 + 음성 대조군 5개 | 전부 OK |
| A 잡 회귀 (cycle5 70 · turnflow 203 · turnflow_timers 36 · memo 122 · own_side 66 · online 159 · online_sync 23 · testclient 41 · minion_art 208 · issue114 18그룹 · tutorial 136 · search_packages 302 · issue146 215 · public_rooms 144 · fx_consumer 52 · issue233 309 · issue234 351 · **issue245 279** · online_art 101 · trap_icon 42 · issue122_rules 93 · back_nav 122 · fx_timing 82 · attack_balance 54 · shock 67 · cross_skill 86 · orientation_audit 8912 · ai_completion 59 · issue241 86) | **전부 pass / fail 0** |
| `npm test` (server, B 잡 — **읽기만**) | **exit 0** — match-fuzz 16 · authoritative 50 · http-static 26 · launcher 47 · combat-stats 547 · issue234 81 · issue241 74 |
| `node demo/test/integration/smoke_public_live.js 2` | **23 pass / 0 fail** (실서버 2클라이언트 2게임 완주 · errors=0) |
| `node tools/docs/test/docs_link_check_test.js` · `docs_link_check.js` | 전부 통과 · 문서 244개 · 내부 링크 1171건 · 문제 0건 |
| `git diff --check` | **깨끗함 (exit 0)** |

CI 추가 비용 합계 **약 4.4초** (종전 3.9초 → 실제 소스 변이 2회분 +0.5초).
CI 잡은 늘리지 않았다(필수 A 잡 안의 3스텝 그대로). 새 의존성 없음. TypeScript `5.9.3` 고정 그대로.

## 7. 정적 검사가 실제로 찾아낸 것 (전부 런타임 미변경 — 계약에만 기록)

1. **`S.aiVanguard` 는 말이 아니라 말 id 를 든다.** 최초 주석이 `(Piece|null)[]` 였는데 `ai.js:107` 의 `p.id===vg` 비교에서 즉시 걸렸다.
2. **`newGameState()` 밖에서 붙는 상태 칸 7개**: `recruit` · `recruitToken` · `aiLastThinkMs` · `pkgSeq` · `searchEndSeq` · `__ddFxCells` · `_pendingModal`.
   초기값을 주면 새 경기 객체 모양이 바뀌므로(서버 좌석 엔진이 같은 코드를 쓴다) 런타임은 건드리지 않고 계약에만 올렸다. → **[기획 필요]**
3. **`piece.reaperSeal` 은 `mkPiece()` 가 만들지 않는다** (`core.js` 전투 중에 붙는다). 서버는 소유자 좌석에만 보낸다.
4. **`netStubPiece()` 가 싣지 않는 `mkPiece()` 칸 7개**: `burnFresh` · `crackFresh` · `hardenFresh` · `evadeBuffR` · `dmgUpBuffR` · `allyKind` · `leaderElChosen`.
   지금은 `undefined` 가 falsy 라 대체로 무해하지만 계약상 차이다. `WireOmitted` 로 명시했다.
5. **`fleePick.token` 의 타입이 두 경로에서 다르다.** Core 는 문자열, 권위 방 재수화(`network.js`)는 **숫자 `0`**.
   `applyAction` 의 `if(a.pick&&…)` 가드는 `0` 이 falsy 라 그 경로에서 **통째로 건너뛰어진다**. → **[기획 필요] / Jupiter 확인 필요** (아래 J2)
6. **`forcedQueue` 자리표**: 권위 방 재수화는 `{pid:null}` 만 넣어 Core 의 `targets` 가 없다 (개수만 아는 자리표).
7. **죽은 인자 1개 제거**: `netOpenCredentialSocket("r-"+…, false)` — 이 함수는 인자를 하나만 받는다.
   **유일하게 런타임 코드가 바뀐 곳이며, 동작은 동일하다** (전달되지 않던 값의 제거).
8. **(REVISE 추가) `BattleWire` 선언이 런타임과 정반대였다** — `side:number`/`phase:string`. 선언만 있고 실제 경로가 묶여 있지 않아
   아무도 그 어긋남을 만나지 않았다. 교정 후 `battleActionFrame` 의 두 칸을 맞바꾸면 그 자리에서 걸린다.
9. **(REVISE 추가) recruit 토큰의 타입이 선언과 런타임에서 달랐다** (`number` vs `말id#번호` 문자열).
10. **(REVISE 추가) `CoreEvent` 의 `minion` 변형은 죽은 어휘였다** — emit·소비 지점 0건. 삭제했다.

## 8. 명시적으로 남긴 것 (이번 범위 밖)

- **전투원(`fa`/`fd`) 내부 수치 구조**는 여전히 `any` 다. `data.js` 전투 엔진이 소유하는 수십 개의 일시 상태(`pendingFx`·`burrowRound`·
  `breedBy`·`tideMark`…)라 네 경계(상태·액션·이벤트·프로토콜)와 별개의 범위다. **전투 인스턴스의 최상위 칸은 전부 닫혔고**,
  없는 칸 이름은 읽든 쓰든 걸린다. 전투원까지 굳히려면 별도 이슈가 필요하다. → **[기획 필요]**
- `ReservePiece` 의 `[k:string]:any` — 포획 예비 슬롯은 회선 레코드라 서버 직렬화(J3)와 함께 결정할 문제다. 이번 REVISE 범위 밖.
- `B["dispSh"+sid]` 같은 **계산된 키 접근**은 `noImplicitAny:false` 라 조용히 통과한다. 리터럴 칸 이름 오타는 전부 걸린다.
- Mars 보고 J2/J3/J4 의 **제품 동작 후속**(토큰 통일·서버 직렬화 칸 추가·`targets` 실어 보내기)은 지시에 따라 착수하지 않았다.
- 서버 `protocol.js` 의 tsc 제외(J1) — Saturn 이 "그 자체가 blocker 는 아니다"로 판정했고 서버 파일은 편집 범위 밖이다.
  현재는 `typecheck_test.js` 가 런타임 `require` 로 어휘를 대조한다.
- 번들러·프레임워크·상태관리 라이브러리·생성 산출물·광범위 TypeScript 전환 — 전부 없음.
- 새 CI 잡 — 필수 6개에 들지 않아 실패해도 병합을 막지 못하므로 만들지 않고 A 잡 안에 넣었다.

## 9. Jupiter 후속 (서버 소유 — 이 작업에서 건드리지 않았다)

| # | 무엇 | 왜 클라이언트에서 못 했나 | 요청 |
|---|---|---|---|
| J1 | `server/authoritative/protocol.js` 의 `ACTION_TYPES`·`COMMAND_TYPES` 를 `as const` 로 고정하고 서버측 타입 검사 대상에 넣기 | 서버 구현 파일 수정은 이 작업의 범위 밖. 지금은 `new Set([...])` 라 tsc 가 `Set<string>` 으로만 본다 | 정적으로 올리려면 서버측 `as const` + 서버 tsconfig 필요 |
| J2 | `fleePick.token` 계약 확정 (7절 5번) | 토큰을 만드는 쪽이 서버 권위 방 상태(`room_state`)다 | 권위 방에서 도망 교환 토큰을 **보낼지**, 아니면 그 방에서는 토큰 가드를 쓰지 않는다고 명시할지 결정 |
| J3 | `room_state` 의 말 레코드에 7절 4번 7개 칸 포함 여부 | 서버 직렬화(`_serializeOwn` 등)가 소유 | 보내지 않는 것이 의도인지 확인 |
| J4 | `forcedQueue` 자리표에 `targets` 포함 여부 (7절 6번) | 같음 | 표시 계약이면 현행 유지 · 재생이 필요하면 서버가 대상까지 실어야 한다 |

`reaperSeal`(7절 3번)은 클라이언트 `mkPiece()` 소유지만 초기값 추가가 새 경기 객체 모양을 바꾸므로 **[기획 필요]** 로 남긴다.
