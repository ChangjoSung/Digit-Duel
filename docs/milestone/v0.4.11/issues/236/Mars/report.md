# #236 Mars 보고 — 로컬 경제 구현 (S01·정기 상점·성장·가방·원장·포획·B08·티켓)

- 작성: 2026-09-24 · Mars (Claude, IMPLEMENT/CLIENT) · preflight `required_role=Mars, mode=IMPLEMENT, area=CLIENT, mutation=code, instance_index=null`
- 기준: worktree `ChangjoSung/issue-236-economy-v0411` base `6d1b788` · GDD-23 2.1~2.4·7.1~7.9 · GDD-24 00.10·01~03 · [Venus 보고](../Venus/report.md) E1~E15·AC01~AC43
- Git·GitHub·Notion 쓰기 없음. 하위 에이전트·Worker 기동 없음. `server/`·Roblox·Unity 미수정.
- 표기: **[확정]** GDD/PD 확인 · **[추론]** Mars 구현 해석(이의 시 교체) · **[미결]** 결정 대기

## 1. 경계 (D3)

- 새 경제는 **`S.eco` 가 있는 경기에만** 돈다. `S.eco` 는 `startMode` 가 온라인이 아닐 때(`!NET.mode` — PVE·핫시트·sim) 한 곳에서만 붙인다.
- 온라인(릴레이 재생성 포함)·권위 서버(`newGame("pvp")` 직접 호출)는 `S.eco` 자체가 없어 **상태 모양이 종전과 한 글자도 같다** — 서버 골든 해시(`test-runtime-contract` 등)를 고치지 않고 통과한다. 경제 칸은 전부 `S.eco` 하위(coins·bag·tickets·buffInv·soldHp·shop·bagPick·unitSeq)이고, 경제 액션이 종전 상태에 오면 거부·불변이다(검사 O절).
- #237 전환 시: `startMode` 의 `eco:!NET.mode` 한 줄과 `newGame` 의 `opts.eco` 분기를 권위 경로로 옮기면 된다.

## 2. 구현 요약 (E1~E15)

| 계약 | 구현 위치 | 비고 |
|---|---|---|
| E1 20·40·60·80턴 끝 → 보너스 → 정기 상점 · 경기 종료 우선 · 보드 잠금 | `core.js` endTurn → `ecoShopOpenState` · `phase:"shop"` | 상점 동안 turnCount 불변, 닫히면 미룬 다음 턴 시작 |
| E2 S01 🪙10·지급 0·⭐1 5칸·무료 보충·필드→가방·예비 재화·완료·속성·시간 초과 | `state.js` newGame/`newEcoState` · `core.js` `ecoReduce` · `ui.js` renderSetup(01 시작 상점) | 무료 로스터(`roster` 액션) 거부, 산 필드 = `S.roster` 동기화 |
| E3 PVE 90초 · 완료 잠금 · 확인 버튼 즉시 잠금 | `ui.js` `shopClockStart`·`once` · Core `shopTimeout` | 핫시트도 1인 90초 — **[확정] D1** 2026-09-24 CJ (5-5절) |
| E4 진열(등급 60/40·제외·고갈·새로 고침·판매 잠금) | `ecoDraw`·`ecoFill` | 진열 번호 `seq` 로 지난 진열 요청 거부 |
| E5 차액 승급·동급 합성·풀 회복·원자성 | `ecoReduce` shopBuy | 검증 전부 통과 후 복제본에만 기록 |
| E6 가방 3칸·1:1 교체·HP 동결·사망/왕/동료 제외·공개 유지·교체 표식 | shopSwap · `ui.js` 보드 `↺` | |
| E7 판매 = 원장 100% · 판매 종 잠금 · HP 비율 기록 | shopSell · `ecoSellUnit` | |
| E8 수풀 구역당 4개 코인 🪙1→4 | `genEvents`(eco) · search reducer | 공개 기록·상대 화면에 금액 없음 |
| E9 전투 승 3/패 1 · 도망 0 · 포획 3/1 | `finishBattle`·`ecoCaptureFinish` | 경기가 끝난 전투는 보상 생략 |
| E10 전투 포획 → 가방 · 승계 · HP 70% · 원장 0 · B08 | `ballWhy`(판정 한 곳) · `ecoCaptureFinish` · bagPick | 종료 우선이면 B08 없음 |
| E11 왕·동료 가방 대리 출전 | `entryStep`·`battleEntryPick(what:"bag")`·`entryFighter` | 대리 패배 → 가방에서 제거 |
| E12 티켓 | shopGood(ticket)·shopTicket | 다음 전투 스냅샷부터 |
| E13 버프 구매·사용 | shopGood·`buffUse` · `battleBuffApply`(pkgPick 과 공용) | |
| E14 비공개·공정 관측 | 로그는 중립 문구만 · AI 는 자기 칸만 (`aiShop`·`aiBagPick`) | |
| E15 종료 > 상점 > B08 · 중복/실패 불변 | 위 전부 | |

## 3. 변경 파일

| 파일 | 변경 |
|---|---|
| `demo/js/data.js` | `ECO` 수치 · `GOOD_KO` |
| `demo/js/state.js` | `newEcoState` · newGame eco 시작(🪙10·볼·소모품 0·S01) · 수풀 코인 4×2 |
| `demo/js/core.js` | 경제 블록(`ecoReduce` 외) · endTurn 상점 · 수풀 코인 · 전투 보상 · `ballWhy` · 포획/B08 · 가방 대리 · `buffUse` · 핫시트 시점 |
| `demo/js/ai.js` | `aiShop`·`aiBagPick` · 투척 판정 `ballWhy` 공용 · 산 버프 사용 |
| `demo/js/ui.js` | S01 패널 · 정기 상점 팝업 · 확인 팝업(승급·판매·티켓) · B08 창 · 가방 대리 선택 · 사이드/상태 줄 코인·가방·남은 턴 · 보드 교체 표식 · 상점 90초 타이머(PVE·핫시트, 5-5절) |
| `tools/typecheck/contracts.d.ts`·`env.d.ts` | 경제 액션·이벤트·`EcoShop`·`EcoState` 계약 |
| `demo/test/regression/smoke_issue236.js` | **신규** 계약 검사 188건(초판 169 + HIGH1 8 + HIGH1-2 11) (A~O절, AC01~AC41 대응) |
| `demo/test/shared/harness.js` | 경제 심볼 노출 |
| `demo/test/regression/smoke_own_side.js` · `demo/test/milestone/v0.4.6/issues/122/issue122_rules.js` | 의도된 규칙 변경 반영: 로컬 01 단계 = 시작 상점(무료 로스터 폐지) |
| `.github/workflows/ci.yml` | 잡 A 에 `smoke_issue236.js` 1줄 |
| `demo/js/ui-overlays.js`·`demo/css/game.css` | HIGH1-2 가림 불투명·`#app` 차단 (5-2장) |

## 4. 결정·해석 상태

| # | 내용 | 상태 |
|---|---|---|
| D1 | 핫시트 상점 시간·시작 시점 | **[확정] 2026-09-24 CJ** — 1인 90초(순차 최대 180초), 자기 상점이 처음 보이는 순간부터(S01 P1 = 표시 순간 · 가림 뒤 차례 = '확인 — 시작' 뒤 상점이 보이는 순간). 가림 시간 불산입. S01·정기 공통. 구현은 5-5절 |
| D1-B08 | B08 20초 | [확정·PD] 소유자에게 창이 보이는 순간(핫시트는 가림 뒤)부터 — 구현 |
| D2 | S01 티켓·수호자 | [PD 수용] 숨김(거부) |
| D3 | 온라인 | [PD 수용] 종전 경제 · 1장 |
| D4 | 핫시트 순서 | [PD 수용] S01=P1→P2, 20턴 P2 먼저, 이후 교대 |
| D5 | 폭탄·함정 접촉 보상 | [PD 수용] 없음 |
| D6 | S01 교체·판매 | [PD 수용] 허용 |
| I1 | 포획한 말은 비공개(`revealed:false`)로 가방에 든다 | [추론] 상대는 포획 사실만 안다 |
| I2 | 신규 표시(🔴)는 그 상점이 닫힐 때 해제 | [추론] 위치·해제 최종은 #238 |
| I3 | 티켓은 정기 상점에서 사서(보유) 정기 상점에서 쓴다 | [추론] 7.3 가격표 품목 |
| I4 | 새로 고침은 확인 팝업 없음 | GDD-23 8.2 (승급·판매·티켓만) — GDD-24 M06 과 차이 |
| I5 | 상점·B08 동안 기권 불가(보드 잠금 단계) | [기획 필요] 필요 시 CJ |
| I6 | 경기 종료 전투의 보상은 지급하지 않음 | E9 "결과에 영향 없음" 의 구현 |
| I7 | AI 상점 전략(승급 우선·볼 1·약한 필드↔가방 교체)·AI 대리(HP 가 본체보다 클 때만) | 구현 선택 — 밸런스는 8.4 |

**Venus AC04 둘째 문장 불일치**: "하수인 1명 구매 후 1개 더 가능"은 [확정] 규칙(지출 뒤 🪙 ≥ 빈칸 수)과 맞지 않는다 — 하수인 구매는 🪙와 빈칸을 함께 1 줄여 여유가 그대로다. 검사는 규칙대로 고정했다(A절). Venus·PD 확인 요청.

## 5. 실행 명령·결과 (2026-09-24, Windows 로컬)

| 명령 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue236.js` | **pass 169 / fail 0** (HIGH1 정정 후 177 / 0 — 5-1장) |
| 잡 A 회귀 28종 (`smoke_cycle5` … `smoke_ai_completion`, `smoke_orientation_audit --path`, `issue122_rules`, `back_nav`) | 전부 rc=0 |
| `npm run typecheck` | 통과 |
| `npm run test:typecheck` | 68 pass / 1 fail — **작업 전 기준선과 동일**. 원인: Windows CRLF 체크아웃에서 `network.js` 변이 기준점(LF 문자열)이 안 맞음. 이번 변경과 무관, 도구·network.js 미수정(PD 지시) |
| `cd server && npm test` | 전부 통과 (서버 파일 무수정 — 경제가 온라인 상태 모양을 바꾸지 않음) |
| 음성 대조(스크래치 사본 변이 5종: 예비 재화·HP 비율·보유 종 포획·상점 턴·판매 잠금) | 전부 smoke_issue236 이 실패로 검출 |

AI vs AI 관찰(8.4 참고, 판정 아님): grade5×grade5 12판 평균 경기 길이 base 95.1턴 → 경제 80.8턴. 후반(≈78턴)에 상점으로 자란 ⭐3~4 말이 왕을 잡는 경우가 늘었다. 밸런스 조정은 CJ·Venus 소관.

## 5-1. 정정 — Saturn REVISE HIGH1 (2026-09-24)

- **Saturn 발견 [확정·재현]**: 핫시트 P1 차례에 P1 말이 P2 왕·동료와 접촉하면 `core.js entryStep` 이 방어자(P2) 가방 대리 프롬프트를 내고, `ui.js` 가 가림 없이 즉시 열어 **P2 가방 말 이름·등급·HP 가 P1 화면에 노출**됐다(7.9 · AC38 위반).
- **근본 원인**: `battleEntryPrompt` 를 내는 곳은 `entryStep` 하나고, #236 경제 경기(로컬만 — 핫시트는 항상 이 분기)의 화면 분기(`ui.js` 가방 대리 프롬프트)가 소유자 ≠ 차례 주인일 때의 가림을 빠뜨렸다. B08(`bagPickShow`·`bagPickDone`)·상점(`shopShow`)은 이미 가림을 거친다.
- **수정 (`ui.js` 가방 대리 프롬프트 1곳)**: 핫시트에서 소유자 ≠ `S.current` 이면 ① `handoff("<소유자> — <왕/동료> 출전 선택")` 뒤에 선택 창을 열고 ② 고른 뒤 `handoff("<차례 주인> 턴 계속")` 을 거친 다음에야 `battleEntryPick` 을 보낸다 — 공개 창(reveal)이 소유자 화면에 뜨거나 선택 창이 차례 주인에게 보이지 않는다. 공격자·방어자 좌석 어느 쪽이든 같은 조건(소유자 ≠ 차례 주인)으로 판정한다. 소유자 = 차례 주인이면 종전 그대로 가림 없이 연다. 늦은 창은 `S`·`entryPick.stage` 대조로 무시.
- **보존**: Core·상태·단계 진행 무변경(`battleEntryPick` 액션 동일). PVE(소유자 = 사람 = 차례 주인, AI 는 Core 가 자동 선택)·온라인(경제 없음 → 종전 `#12` 분기, `handoff` 도 온라인은 즉시 진행) 무변경. D1 핫시트 60초는 손대지 않았다.
- **회귀 (smoke_issue236 J절 "Saturn REVISE HIGH1")**: 방어자 좌석 — P1 차례 P2 왕 방어 시 첫 화면이 가림이고 P2 가방 이름/HP 비노출 → 확인 뒤 P2 후보 표시 → 대리 선택 뒤 다시 가림(선택 미확정·이름 비노출) → 확인 뒤 `stage=reveal`·`dU` 확정. 공격자 좌석 — 차례 주인 왕의 가방 선택은 가림 없이 바로.
  - 수정 전(`away=false` 로 되돌린 스크래치 사본): **pass 170 / fail 7** (HIGH1 항목 전부 실패)
  - 수정 후: **pass 177 / fail 0**
  - 정정 후 `npm run typecheck` rc=0. **잡 A 전체 재실행은 보고 시점에 미완료**(백그라운드 진행 중, 결과 미확인) — Saturn 재검수에서 확인 필요.

## 5-2. 2차 정정 — fresh Saturn REVISE HIGH1 (2026-09-24)

- **Saturn 발견 [확정]**: 5-1 로 P2 가방 창은 가림을 기다리지만, 가림 자체가 일반 모달과 같은 `.overlay`(`game.css` `background:#000c` — 반투명)여서 **P1 보드·사이드(`ui.js` boardInfo 의 🪙 코인 등 비공개 칸)가 P2 가림 아래로 읽혔다**.
- **근본 원인**: 모든 핫시트 가림이 지나는 `handoff()` 가 일반 `modal()` 을 그대로 써서, 가림에 필요한 "완전히 가린다"가 없었다. 호출부(턴 넘김·배치·상점·B08·가방 대리·가방 초과)가 아니라 공용 함수 한 곳을 고쳤다.
- **수정**
  - `demo/js/ui-overlays.js` `handoffCover(on)` 신설 — `#overlay` 에 `handoff` 클래스 + `#app` 에 `inert`·`aria-hidden="true"`(포커스·스크린리더에서도 앞 주인 화면 제외, `#overlay` 는 `#app` 형제라 확인 버튼은 살아 있다). `handoff()` 가 `modal()` 뒤에 켜고, **`modal()`·`close()` 가 매번 끈다** → 가림→선택 창→가림 반복에서도 선택 창·다른 모달로 새지 않는다.
  - 튜토리얼 공존: 튜토리얼이 열려 있으면 `#app` 속성은 튜토리얼 소관으로 두고, `tutSetInert(false)` 는 가림 중이면 `#app` 차단을 풀지 않는다.
  - `demo/css/game.css` `.overlay.handoff{background:#000;}` 1줄 — 일반 `.overlay` 의 `#000c` 는 그대로.
- **보존**: 온라인은 `handoff()` 가 즉시 진행(클래스·속성 안 붙음)이라 무변경. PVE 는 가림이 없고 일반 모달은 `modal()` 이 해제 상태로 연다. Core·상태·D1 무변경.
- **회귀 (smoke_issue236 J절 HIGH1-2, 11건 추가)**
  - 가방 대리 흐름 가림→선택→가림→공개 = `cover,open,cover,open` (가림에서만 `.handoff`+`#app` inert/aria-hidden, 다음 창에서 셋 다 해제)
  - 가림 없는 공격자 선택 창 = open · 턴 넘김 가림 = cover · 가림 중 튜토리얼 열고 닫아도 cover 유지 · 확인 뒤 해제 · 뒤이은 일반 모달·PVE 모달 = open
  - CSS 원문(스텁은 계산 스타일이 없다): `.overlay.handoff` 배경 `#000`·opacity 없음 · 일반 `.overlay` `#000c` 유지
  - 음성 대조(스크래치 사본): `handoff()` 의 `handoffCover(true)` 제거 → **fail 3** · `modal()` 해제 제거 → **fail 1** · CSS 규칙 제거 → **fail 1**
  - `node demo/test/regression/smoke_issue236.js` → **pass 188 / fail 0**
  - 잡 A 전체(`smoke_cycle5` … `smoke_ai_completion` 28종 + `smoke_orientation_audit --path demo/index.html` + `issue122_rules` + `back_nav`)·`npm run typecheck` → **전부 rc=0** (32건). 5-1 장의 "잡 A 재실행 미완료"는 이것으로 해소

## 5-3. 긴급 정정 — 실제 브라우저에서 교대 가림이 안 뜸 (2026-09-24)

- **증상 (Mercury 실측)**: Orca 내장 브라우저 `http://127.0.0.1:8765/demo/` PVP → 시작 상점 시간 초과 → 무작위 배치 → 배치 완료에서 `S.setupPlayer=1` 인데 가림이 없고 P1 보드가 그대로. `handoff is not defined`(ui.js:114), `typeof MEMO_UI/TUT` 는 ReferenceError.
- **근본 원인 [확정]**: 이 브라우저(Chrome 150 기반)의 `window.close` 는 `configurable:false, writable:false` 다. `ui-overlays.js` 의 전역 선언 `function close()` 가 그 이름과 겹쳐 **파일 전체가 선언 인스턴스화 단계에서 `SyntaxError: Identifier 'close' has already been declared`** 로 버려졌다 → `handoff`·`handoffCover`·`MEMO_UI`·`TUT`·메모·튜토리얼 전부 부재. `modal` 만 보였던 것은 `network.js:138` 의 `modal=function…` 이 암묵 전역을 만들었기 때문이다.
  - 브라우저 증거: `Object.getOwnPropertyDescriptor(window,'close')` → `configurable false / writable false`. 새 `<script>` 로 `const __probeX=1; function close(){}` 주입 → `Uncaught SyntaxError: Identifier 'close' has already been declared`, `__probeX` 도 생기지 않음.
  - #236 신규 결함이 아니다 [확정]: `function close()` 는 #243/#245 분리(`adc92cd`) 이전부터 있었다. 일반 Chrome 은 `window.close` 가 configurable 이라 통과했던 것으로 **추론**한다(이 호스트에서만 재현, 일반 Chrome 미확인).
  - 하네스가 놓친 이유: `harness.js` 는 모든 `<script>` 를 **한 strict 함수 본문**으로 이어 eval 한다 — 파일별 전역 적재도, 호스트 Window 멤버도 없으니 이 충돌이 구조적으로 안 보인다.
- **수정 (이름 변경만, 동작 무변경)**: 전역 모달 닫기 `close` → `closeModal` — `ui-overlays.js`(정의·호출), `ui.js`, `network.js`(호출 4곳; 소켓 `close()` 주석은 그대로), `core.js`(주석 2곳).
  - 테스트 측: `harness.js` 는 `closeModal` 을 내보내고 기존 `T.close` 는 같은 함수로 연결(기준판 로드 호환: `closeModal` 없으면 옛 `close`). 페이지에 직접 `close()` 를 평가하던 보관 CDP 스크립트 9개는 `closeModal()` 로 바꿨다 — 그대로 두면 실제 브라우저에서 창 닫기를 부른다. (CDP 스크립트는 CI 대상이 아니며 이번에 실행하지 않았다.)
- **회귀 (smoke_issue236 P절, 9건)**: `index.html` 의 `src` 순서대로 **파일마다 따로** `vm.Script` 로 한 전역에 적재하고, Window 멤버 이름(close·open·stop·print·name·status·top·…)을 모두 구성 불가로 막는다. 각 파일의 최상위 함수가 전부 전역에 서는지(= 선언 인스턴스화 성공)와 `handoff·handoffCover·modal·closeModal·memoModal·tutOpen` 가시성을 본다. 소스 미러가 아니라 브라우저 적재 규칙 자체를 재현한다.
  - 수정 전 소스(HEAD `7b49ccb` 사본): **fail 2** — `ui-overlays.js … 없음 memoSet,…,handoffCover · SyntaxError: Identifier 'close' has already been declared`
  - 수정 후: **pass 198 / fail 0**
- **실제 브라우저 재현 (같은 Orca 페이지 `91dc7a00…`, 새로 적재)**: 페이지 로드 시 튜토리얼 표시(전에는 `TUT` 부재로 안 떴다) → 건너뛰기 → 대전 시작 → PVP → `shopTimeout(0)` → 무작위 배치 → **배치 완료 클릭** → `setupPlayer:1`, `#overlay` = `overlay handoff`, 배경 `rgb(0,0,0)`, `#app.inert=true`, 문구 "기기를 넘기세요 / P2(상단·적) 배치" → **확인 — 시작 클릭** → 가림 해제·`#app` inert 해제·"시작 상점 — P2" 표시. 스크린샷: [browser-setup-handoff.png](browser-setup-handoff.png) (P1 보드 비노출). 로드된 8개 스크립트의 최상위 함수 478개 전부 `window` 에 존재 확인.
  - 참고: Orca `click` 으로 "무작위 배치"를 한 번 눌렀을 때 배치가 0/14 로 남아 `autoPlace()` 를 직접 호출했다(같은 버튼 핸들러). 원인은 확인하지 않았다 — 클릭 좌표 문제인지 [미확정].
- **검증**: CI 워크플로의 node 테스트 32종(잡 A 전체·smoke_online_art·trap_icon·fx_timing·attack_balance·shock·cross_skill·orientation_audit·ai_completion·issue122_rules·back_nav·smoke_public_live) **전부 rc=0** · `npm run typecheck` rc=0 · `test:typecheck` **70 passed / 0 failed**. 단, 이 Windows 작업 사본(`core.autocrlf=true`, CRLF)에서는 `test:typecheck` 의 `
` 고정 변이 기준점 1건("credential 없는 명령 봉투 송신")이 줄바꿈 차이로 1 failed — 수정 전 HEAD 도 같은 조건이며, network.js 를 LF 로 맞춰 돌리면 70/0 이다(환경 요인, 이번 변경과 무관 [확정]). 보관 CDP 스크립트 9개는 실행하지 않았다.

## 5-4. Saturn REVISE MEDIUM1 — PVE AI 시작 상점 즉시 완료 (2026-09-24)

- **증상 (Saturn)**: PVE 시작 직후 `S.eco.shop.done=[false,false]` — AI S01 이 사람 배치 완료·AI 자동 배치 때까지 끝나지 않음. GDD-23 2.3 은 사람 90초 S01 이 열리는 순간 AI 즉시 완료.
- **근본 원인 [확정]**: 시작 상점은 `newGame`(state.js) 에서 열리는데, AI 의 `aiShop` 호출처는 `aiAutoPlace`(ai.js) 하나뿐이었다. `aiAutoPlace(1)` 은 사람 `setupConfirm` → `setupAiBegin` 에서만 불린다. 정기 상점은 `shopOpened` 가 `aiShopTurn` 을 바로 내보내 문제가 없다. 로컬 경제 새 경기 호출처는 `startMode` 하나(ui.js), sim 은 같은 호출에서 `aiAutoPlace(0/1)` 로 즉시 끝나므로 무관.
- **수정 (1줄)**: `ui.js startMode` PVE 분기 — `if(S.eco&&mode==="pve") aiShop(1);`. 배치는 종전대로 사람 뒤 `aiAutoPlace` (그 안의 `!done` 가드가 재구매를 건너뜀). 사람 타이머(`shopClockStart`)·AI 완료가 사람 창을 닫지 않는 처리(`shopClosed` AI 건너뜀)·온라인(`S.eco` 없음)·D1 무변경. sim 은 난수 소비 순서를 바꾸지 않으려 손대지 않았다.
- **난수 [확정]**: 결정적이다(같은 시드 → 같은 AI 상점 결과, 회귀 검사). 단 PVE 에서 AI S01 의 보충 추첨이 사람 거래보다 **앞**으로 옮겨져 같은 시드의 진열 순서는 수정 전과 다르다 — 2.3 동시 오픈이 요구하는 순서다.
- **회귀 (smoke_issue236 A절 +4)**: `startMode("pve")` 직후 사람 S01 열림·미완료 / AI `done[1]===true`·필드 6칸 / AI 말 미배치 / 같은 시드 재현. AC01 지급 검사는 AI 가 즉시 지출하므로 `newGame(…,{eco:true})` 시점 상태로 옮기고 사람 쪽 🪙10·지급 0 검사를 더했다.
  - 수정 전(ui.js 의 그 한 줄만 뺀 사본): **fail 1** — "2.3 PVE AI S01 은 시작 즉시 완료 · 필드 6칸"
  - 수정 후: **pass 203 / fail 0**
- **검증**: CI node 테스트 32종(잡 A 전체 + orientation_audit·smoke_public_live 2) **전부 rc=0** · `npm run typecheck` rc=0 · `test:typecheck` 이 CRLF 사본에서 68/1(5-3 과 같은 줄바꿈 변이 기준점), network.js 를 LF 로 맞추면 **70/0** (원복 확인). 브라우저 수동 QA 는 하지 않았다(QA_MINIMUM_POLICY).

## 5-5. D1 반영 — 핫시트 상점 1인 90초, 자기 상점이 보이는 순간부터 (2026-09-24)

- **입력 [확정]**: CJ 결정(Venus 4차 보고 · GDD-23 2.2·2.3·2.4 · GDD-24 00.10-5 · GDD-13 9장) — 핫시트 P1/P2 의 S01·정기 상점 각각 90초, 자기 상점이 처음 보이는 순간부터. 순차 최대 180초.
- **추적한 경로**: 시계 시작은 `shopClockStart` 한 곳, 호출처는 `renderSetup`(S01, 출전 준비 패널)과 `shopShow` 의 `open`(정기 상점 모달). 멈춤은 `shopClosed` 이벤트 · `uiResetScreen`. 가림은 `handoff()`(`#overlay.handoff`) — S01 P2 는 `setupHandoff` → 가림 → '확인 — 시작' → `render`, 정기 상점은 `shopOpened`/`shopHandoff` → `shopShow(true)` → 가림 → `open`. 거래·새로 고침 뒤 `shopChanged`/`shopRefused` → `shopShow(false)` 로 다시 그린다. 만료는 Core `shopTimeout`(확정 거래 보존, S01 은 빈 필드 자동 구매).
- **근본 원인 [확정]**: ① `shopClockStart` 가 `S.mode!=="pve"` 면 바로 돌아가 핫시트에는 시계가 없었다. ② 가림 뒤에서도 `render` 가 돌면 `renderSetup` 이 P2 S01 을 그리므로(가림은 불투명 덮개일 뿐) 모드 조건만 풀면 가림 중에 P2 시간이 흐른다. ③ 시계 키가 `종류+턴` 이라 새 경기의 같은 S01 이 옛 키에 걸려 시작되지 않을 수 있었다 — 새 경기 `gameReset` 에서 시계를 멈추지 않았다(재대전·로비 경로는 `uiResetScreen` 이 멈춰 증상이 가려졌다).
- **수정 (`demo/js/ui.js`)**:
  - `shopClockStart`: 조건을 "사람 좌석(`!isAI`) · 온라인 아님(`!NET.mode`) · 표시 중(`fxLive`)"으로 바꿈 — PVE 와 핫시트가 같은 경로. **가림(`#overlay.handoff`)이 떠 있으면 시작하지 않는다**(한 곳의 가드라 모든 호출처에 적용). 키 = `종류+턴+":"+좌석` — 좌석마다 새 90초, 같은 좌석의 다시 그리기·확인 창 뒤 재표시는 마감 유지. 시작 즉시 남은 시간을 표시한다.
  - `renderSetup`: `shopClockStart` 를 패널 `innerHTML` 대입 **뒤**로 옮김 (정기 상점 `open` 은 종전대로 `modal` 뒤) — 실제로 그려진 다음 시작.
  - `shopHtml` 배지: "핫시트 제한 시간은 CJ 결정 대기" 문구 삭제, `shopClockText(p)` 로 자기 좌석의 남은 시간만(다시 그려도 깜빡임 없음).
  - `gameReset` 이벤트에서 `shopClockStop()`·`bagClockStop()` — 옛 경기 마감·콜백이 새 경기로 넘어가지 않는다.
  - 만료 콜백은 종전 그대로: 열린 확인 창(미확정)만 `closeModal` 로 취소 → Core `shopTimeout`. 확정 거래는 이미 커밋돼 보존.
- `demo/js/data.js`: `shopSec` 주석을 D1 확정 내용으로 치환(값 90 무변경).
- **보존**: Core·상태·거래 규칙 무변경. PVE 90초 동작 동일(Q1). AI 좌석·sim 은 시계 없음, 온라인은 종전 경제(`S.eco` 없음)라 호출 자체가 없다. B08 20초 무변경.
- **회귀 (`smoke_issue236` Q절 +41 (203 → 244), 가짜 시계 — `Date.now`·`setTimeout`·`clearTimeout` 실동작, `adv(ms)` 로만 경과)**:
  - Q1 PVE S01: 표시 즉시 90초 · 40초 뒤 다시 그려도 50초 · 89.999초 진행 / 90초 만료 → 자동 구매 완료. PVE 20턴 상점: 확정 볼 구매 보존 · 열린 판매 확인 창 취소 · 상점 종료.
  - Q2 핫시트 S01: P1 표시 즉시 90초 → 90초 만료 · 배치 뒤 불투명 가림 · 가림 뒤 `render` 2회 + 15분 대기에도 P2 미만료 · '확인 — 시작' 뒤 90초 표시 · 중간 다시 그리기와 무관하게 89.999/90초 경계.
  - Q3 핫시트 20턴 상점(P2 먼저): 가림 대기 불산입 · 첫 좌석 만료 시 확정 구매 보존/미확정 판매 취소 · 가림 거쳐 다음 좌석 · 둘째 좌석 새 90초 · 만료 뒤 상점 종료.
  - Q4 40턴(P1 먼저, 교대): 30초에 먼저 끝낸 좌석의 옛 시계가 다음 좌석을 끝내지 않음 · 초기화 없이 `startMode` 재시작 시 새 S01 은 옛 마감에 끝나지 않고 자기 90초에 만료. Q5 sim 은 90초 시계 없음.
  - **음성 대조**: 수정 전 `ui.js`(HEAD) 사본 **fail 18** · 가림 가드만 뺀 변이 **fail 2**(Q2 가림 불산입) · `gameReset` 멈춤만 뺀 변이 **fail 1**(Q4 새 경기 만료) · 좌석 없는 키 변이 **fail 6**(좌석별 시간 표시). 수정 후 **pass 244 / fail 0**.
- **검증**: CI node 테스트(잡 A 전체 21종 · online_art · trap_icon · fx_timing · cross_skill · orientation_audit · ai_completion · attack_balance · shock · issue122_rules · back_nav) 전부 rc=0. `smoke_fx_timing`(실제 타이머) 첫 실행 1회만 rc=2(전투 바 쓰기 0회 TypeError, 상점 경로 아님) → 재실행 4회 모두 82/0 [추론: 부하 flake]. `server` `npm test` 전부 통과. `npm run typecheck` rc=0. `test:typecheck` 68/1 — 5-3·5-4 의 같은 network.js 변이 기준점이며 HEAD 원본 트리(`git archive`)에서도 같은 FAIL [확정: 무관].
- **실제 브라우저 (Orca 내장, `file://…/demo/index.html`)**: 페이지에서 `ECO.shopSec=6` 으로 줄여 실제 타이머로 핫시트 S01 확인 — P1 표시 즉시 "⏱ 6초" · 자동 만료(필드 6/6) · 배치 뒤 가림 · 가림 13.5초 동안 P2 미만료(빈칸 6) · '확인 — 시작' 뒤 "⏱ 6초" · 11.4초 뒤 P2 만료. 정기 상점은 브라우저에서 보지 않았다. Chrome 확장은 연결되지 않았다.

## 5-6. CJ 플레이 QA REVISE — S01 산 칸 빈칸 · 상점 시너지 현황 (Venus 5차 E2·E16·D9·AC44~48, 2026-09-24)

- **입력**: dispatch `task_2e63aaa981d4` — ① S01 산 칸은 새로 고침 전까지 빈칸 **[확정: CJ 플레이 QA]** ② 시작·정기 상점에 소유자 시너지 현황 **[확정: CJ 플레이 QA]** ③ 여섯 번째 구매 = 새로 고침 🪙1 · 예비 재화에 필수 새로 고침 비용 포함 · 시간 초과/AI 자동 새로 고침 **[확정: 2026-09-24 CJ — D9 ⓐ 유료 새로 고침·비용 보존 승인]** (작업 중 PD 메시지 `msg_4fd11ba72f4d` 로 전달, CJ 원문은 Mars 미확인 · 착수 시점엔 PD 작업 가정이었다).
- **추적한 경로**: `ecoReduce` shopBuy(S01 무료 보충 1줄) · `ecoReserveOk` 호출처 2곳(shopRefresh·shopGood) · shopTimeout 자동 구매 루프 · `aiShop` S01 루프(`aiAutoPlace` 에서 호출 — PVE·sim) · `shopHtml`(S01 = `renderSetup` 안, 정기 = `shopShow` 모달, 둘 다 `shopChanged`/`shopRefused` → `shopShow(false)` 로 다시 그림) · `synCount`/`synView`(`placed===true` 만 셈 → S01 은 0) · `assignLeaderElements`(`leaderElChosen` 아닌 왕·동료만 완료 때 배정).
- **수정**
  - `demo/js/core.js`
    - shopBuy: S01 무료 보충 줄 삭제 — 산 칸은 S01·정기 모두 `null`. 빈칸 재구매는 기존 `!slot` 거부(상태 불변).
    - 예비 재화 (D9 가 모인 한 곳): `ecoReserveNeed(state,p,v)` = k + ⌈max(0, k − v) ÷ 5⌉ × `ECO.refresh`(v 기본 = 지금 살 수 있는 칸, 빈칸·판매함 제외). `ecoReserveOk` 가 이것을 쓰고, shopRefresh 는 v = `ECO.slots`(새 진열 5칸)로 판정. 소모품은 현재 v. 하수인 구매는 규칙 밖(🪙·k·v 가 함께 1 줄어 여유 불변).
    - `ecoBuyable(state,p)`: 살 수 있는 첫 진열 칸(-1 = 없음) — 시간 초과·AI·UI 공용.
    - shopTimeout: 살 칸이 있으면 ①부터 구매, 없으면 `shopRefresh` 를 같은 reducer 로 실행 후 반복(상한 12회 · 실제 최대 6구매+2새로고침).
    - `ecoSynView(state,p)` (소유자 전용 selector): 정기 = `synView` + `deadAllies`(죽은 동료 0~2 — `synView.dead` 는 죽은 하수인까지 센 사신용 값이라 따로 셈). S01 = 산 필드 하수인 + 속성을 고른 왕·동료만 `placed:true` 로 본 사본을 **같은 `synCount`** 로 셈(미리보기), 미선택 왕·동료는 `pending`. #235 산식·상수·효과 무변경.
  - `demo/js/ai.js` `aiShop` S01: 살 칸이 없으면 새로 고침 뒤 계속 — 6칸 완료. 그 밖의 AI 순서(볼·회복약·대리 후보 1마리) 무변경. AI 입력에 시너지 현황 추가 없음.
  - `demo/js/ui.js` `shopHtml`
    - `shopSynHtml(p)`: "📊 내 시너지 현황" — 왕국 5속성·아키타입 6종 각 `n칸 · (단계) 달성|미달 · (다음)까지 m칸|최고 단계`. 단계 경계 = `V2_KINGDOM_STEPS`, 아키타입은 `V2_ARCH_STEPS` 를 그 타입 표 길이로 자름(표준·공격·지속 (6) · 방어·속공·보호 (5)).
    - S01: 제목에 "(미리보기 — 필드에 산 하수인 + 고른 왕·동료 속성)" · 미선택 왕·동료는 "미선택 — 상점 완료 때 필드 최다 속성으로 자동 배정: 왕·동료… (위 칸 수에 아직 없음)".
    - 정기: "왕·동료 시너지: 죽은 동료 n/2 — …" (스킬 이름은 `SKILLS["LD-REVENGE"/"LD-WRATH"].ko` 재사용).
    - 예비 문구 "남은 필수 비용 🪙N(하수인 k명 + 필요한 새로 고침)…" · 살 칸 0 이면 "살 수 있는 칸이 없습니다 — 🔄 새로 고침으로 새 진열을 받으세요." · 소모품/새로 고침 버튼은 예비 규칙에 걸리면 Dim.
  - 갱신 시점: 확정 거래의 `shopChanged` → 다시 그리기(기존 경로). 확인 창을 열거나 취소해도 상태가 그대로라 값 불변. 비공개: 현황은 `shopHtml(p)` 안에만 있어 기존 소유자 전용·가림 경로를 그대로 따른다 — 로그·토스트·상대 화면 추가 없음.
  - `demo/test/shared/harness.js`: `ecoBuyable`·`ecoReserveNeed`·`ecoSynView` 노출(부재 시 undefined).
- **회귀 (`smoke_issue236` 250 → 272, A절 정정 + A 보강 + 새 S절)**
  - A(정정): AC44 산 칸 빈칸 · 나머지 칸 불변 · 빈칸 재구매 거부/불변 · 5칸 소진 → 살 칸 0 · 새로 고침 🪙1 → 서로 다른 미보유 ⭐1 5칸 · 6번째 → 필드 6칸 🪙3 · 가방 3칸. AC04 필수 7 · 볼 3개 허용/4번째 거부 · k=6 새로 고침 거부(볼 3개 뒤)/허용(볼 0개) · 하수인 구매 뒤 여유 불변. AC08 필드 1칸 만료 → 자동 구매+자동 새로 고침 6칸 · 볼 보존 · 🪙≥0.
  - A(보강): AC08 필드 0칸 만료 → 5구매·자동 새로 고침·1구매, 🪙3. **AC45 불변식** 시드 40 × 무작위 합법 요청 30회(구매·소모품·새로 고침·속성·S01 판매·교체) → 막힘 0 · 시간 초과 뒤 항상 6칸 · 🪙≥0. PVE AI S01 새로 고침으로 6칸 완료.
  - S: AC46 배치 전 `synView` 0 vs 미리보기 불 2 · 아키타입 2칸만 · 미선택 표시 · 왕 🔥 → "불 3칸 · (2) 달성 · (4)까지 1칸" · 거부 요청 불변 · 가방 하수인 미산입 · 배치 뒤 `synView` = 미리보기 + 자동 배정 동료 2. AC47 정기 = `synView` · 죽은 동료 1(`dead` 2) · 같은 속성 티켓 거부 불변 · 티켓·교체 확정 즉시 반영 · 판매 확인 창만으로 불변. AC48 핫시트 가림 화면에 현황 없음 · 상대 칸·사망 변경에 내 화면 불변 · 로그에 칸 수 없음 · `aiShop` 이 현황을 읽지 않음.
  - **음성 대조**: 예비 재화를 종전 `k` 로 되돌린 변이 → AC45 막힘 8건 · 미완료 2건 등 **fail 9**. 수정 후 **pass 272 / fail 0**.
- **검증 (Windows 로컬)**: CI 워크플로의 `node demo/test/…` 32종 전부 rc=0(AI vs AI 완주 포함) · `server` `npm test` 전부 통과 · `npm run typecheck` rc=0 · `test:typecheck` 68/1 — 기존과 같은 network.js CRLF 변이 기준점(network.js 무수정) [확정: 무관].
- **실제 브라우저 (Orca 내장, `file://…/demo/index.html`, 핫시트)**: S01 2구매 → 진열 `[null,null,…]` · "빈칸 (살 수 없음)" 2 · 🪙8 · "남은 필수 비용 🪙5(하수인 4명 + 필요한 새로 고침)"(k=4·v=3 → 4+1) · 현황·미선택 문구 표시. P1 배치 뒤 가림 `overlay handoff` · 가림 안 현황 없음. P2 만료 → 6칸 · 🪙3. 20턴 상점: 가림 중 누수 없음 → 확인 뒤 "🛒 20턴 상점 — P2" · "왕·동료 시너지: 죽은 동료 0/2 — 미달 · 1명이면 🪄 동료의 복수" · "🔥 불 0칸 · 미달 · (2)까지 2칸". 스크린샷은 Orca 런타임 `runtime_unavailable` 로 못 찍었다(DOM 값만).
- **D9 표기**: 코드·테스트 주석은 "D9 — 2026-09-24 CJ 확정" 으로 적었다. Venus 보고서·Notion 의 [PD 작업 가정] 문구 정정은 PD→Venus 후속(Mars 미수정). 규칙이 다시 바뀌면 `ecoReserveNeed` 한 줄과 AC04·AC08·AC45 기대값만 바꾸면 된다.
- **한계**: 현황 배치·문구 스타일은 기능형(뱃지 행) — 최종 HUD·레이아웃은 #238. 정기 상점은 헤드리스 + DOM 확인만, 실제 플레이 QA 는 CJ.

## 5-7. Saturn LOW — 예비 재화 문구와 유료 새로 고침 불일치 (2026-09-24)

- **입력**: dispatch `task_0512974fb780` — fresh Saturn QA PASS(HIGH 0 · MEDIUM 0 · LOW 1). 볼 3개 + S01 하수인 5마리 뒤 🪙2 · 살 칸 0 → 현재 필수 🪙2. 새로 고침은 새 진열 5칸 기준 필수 🪙1 이라 합법(🪙1 남김)인데, 문구는 "소모품·새로 고침은 지출 뒤에도 이만큼(🪙2) 남아야" 라고 해 성공한 거래와 모순 **[확정: Saturn 지적 · 아래 재현]**.
- **수정 (`demo/js/ui.js` `shopHtml` 예비 문구 1줄)**: "소모품은 산 뒤에도 🪙{현재 필수}, 🔄 새로 고침은 새 진열 5칸 기준 🪙{`ecoReserveNeed(S,p,ECO.slots)`}이 남아야 합니다." — 두 값은 `ecoReserveOk` 가 소모품·새로 고침에 쓰는 v 와 같다. 예비 산식·거래·타이머·AI·시너지 무변경. 기존 UI 단언은 이 문구를 담지 않아 테스트 무수정.
- **검증**: 시드 12 PVE S01 볼 3 + 하수인 5 → 🪙2 · 문구 "소모품은 산 뒤에도 🪙2, 🔄 새로 고침은 새 진열 5칸 기준 🪙1" · 새로 고침 버튼 활성 → `shopRefresh` = shopChanged · 🪙1 · 필수 1(scratch 스크립트, 저장소 밖). `smoke_issue236` **pass 272 / fail 0** · `git diff --check` rc=0. 다른 CI 테스트·브라우저는 재실행하지 않았다(문구 1줄).

## 6. 남은 것

- 5-6 REVISE 구현 및 5-7 안내 문구 정정 완료. Venus 보고서·Notion GDD-23/24/13의 D9 CJ 확정 표기도 반영됐다. 수정 후 fresh Saturn QA는 PASS(HIGH 0 · MEDIUM 0 · LOW 0)다. CJ 플레이 QA(AC43 · AC44~48)와 최신 HEAD CI가 남았다.
- D1 해소(5-5절). 핫시트 정기 상점의 실제 브라우저 확인은 하지 않았다 — 헤드리스 가짜 시계(Q3·Q4)로만 봤다.
- Mars는 5-3에서 실제 브라우저 핫시트 교대까지 확인했다. 헤드리스 하네스로 S01·정기 상점·핫시트 가림 순서·티켓·B08·대리 선택 화면 경로를 실행해 오류 0 을 확인했다. 최종 HUD·레드닷 위치·Dim·연출은 #238.
- 5-4 정정 후 fresh Saturn 독립 QA는 PASS(HIGH 0, MEDIUM 0, LOW 1: Windows CRLF 변이 기준점)이며 별도 Chrome에서 PVE AI 즉시 완료와 핫시트 불투명 가림을 확인했다. CJ 플레이 QA(AC43) · 필수 CI · 통합 PR은 Mercury 후속이다.
- Rollback: 이 작업 전체가 한 squash 커밋이면 되돌림 1회.
