# #263 Mars — 클라이언트/UI 구현 보고

- 기준: [Issue #263](https://github.com/ChangjoSung/Digit-Duel/issues/263) 본문(2026-09-25 CJ Q1=A·Q2=A 확정) · [CLAUDE.md](../../../../../CLAUDE.md) · [AUTHORITY.md](../../../../creat2ve/AUTHORITY.md) · [QA 최소 운영](../../../../creat2ve/QA_MINIMUM_POLICY.md) · [Jupiter 보고](../Jupiter/report.md) 특히 4절
- 작업 브랜치: `ChangjoSung/issue-263-shop-timers` · Ponytail full 적용 · Git 쓰기·스테이징·커밋·PR·이슈 조작·배포·Render 자원 생성·결제 없음
- 범위: 클라이언트 표시·입력 계층(`demo/js/ui.js`·`demo/js/network.js`·`demo/css/game.css`)과 대상 검사. **Core·서버(`demo/js/core.js`·`data.js`·`ai.js`·`server/**`)는 한 줄도 건드리지 않았다** — 호환 결함도 발견하지 않아 에스컬레이션이 없었다. 작업 시작 시점의 미커밋 Jupiter 변경물과 모든 dirty/untracked 파일을 보존했다.

## 1. 구현한 것 — 계약별

| # | 계약 (#263) | 구현 위치 |
|---|---|---|
| A | S01·정기 상점 **6칸 고정** · 산 칸은 **SOLD OUT** 으로 남고 새로 고침 전까지 구매 불가 · 즉시 보충 없음 | 화면은 이미 Jupiter 가 넣은 `shopHtml()` 의 `soldOut` 분기로 맞았다. Mars 는 **그 칸에 구매 버튼이 없고 나머지 칸만 살 수 있다**는 것을 검사로 못 박았다(A1~A7). 서버 좌석 뷰 `{key,grade,soldOut,sold}` 와 로컬 `sold[]` 판매 잠금이 같은 화면을 그리는 것도 같은 절에서 본다 |
| B | 서버 권위 시계 **상점 90초 · 배치 90초 · 행동 30초 · B08 20초** 표시 | `ui.js` 새 `turnClockSync/Text/Tick` 한 곳. 온라인은 `room_state.clock`(`netClockText()`)을 **표시만** 하고 로컬 마감을 걸지 않는다. 상점은 종전 `#shopClock`, B08 은 `#bagClock` 그대로이고 **새 타이머 종류를 만들지 않았다**(네 종 유지) |
| C | 배치 90초 배지 — S01 을 직접 끝낸 좌석이 준비할 때까지 | `renderSetup()` 02 비공개 배치 제목의 `#placeClock` |
| D | 행동 30초 배지 — 출전 후보(B02) 선택 포함 | `renderTurnBar()` 끝의 `#actClock`(도망 교환 갈래에도 같은 배지). 후보 선택은 `S.phase==="play"` 안이라 같은 시계 하나를 쓴다 — **전용 20초 타이머 없음** |
| E | `running:false` = 정지 표시 | `netClockText()` 의 `(정지)` 를 그대로 쓴다. 정지 중에는 표시도 줄지 않는다 |
| F | 단절 정지 중 **양측 게임 입력·기권 금지**, 사유 표시, 복구 시 복원 | `ui.js` 새 `netPaused()` → `netFxBusyNow()`(원본 입력 잠금 `fxLocked()`에 합류) · `netAction()` 앞단에서 **기권 포함** 차단 + 사유 토스트 · `renderTurnBar()` 조작 버튼 전부 `disabled` + 사유 배지 · `netResignBtn()` 비활성 + 사유 · `#netResumeBar` 문구에 입력 잠금 명시. 복구되면 그 자리에서 모두 되돌아온다 |
| G | 서버 시각·onUpdate 존중 · 온라인에서 결과를 로컬 추론하지 않음 | 온라인 갈래는 로컬 `setTimeout` 마감을 **걸지 않는다**(`TURNCLK.key===null`). 만료 전이는 서버 `room_state` 푸시로만 도착한다 |
| H | 늦은·중복 입력 방어 | 정지 차단이 송신 전에 걸리고, 종전 `once()`·`baseRevision`·모달 `seq`·`bf` 프레임 대조는 그대로다. 만료 처리는 정지 구간마다 **1회**만 보낸다(아래 3-1) |
| I | 로컬(PVE·핫시트) 배치 90초·행동 30초와 만료 UX | `turnClockWant/Paused/Fire`. 서버 `_syncClock`/`_onClock`/`_actTimeout` 과 같은 모양이고 **기존 Core 액션만** 쓴다: 배치 = `{t:"autoPlace",player}` → `setupDoneCore()`, 행동 = 열린 탐색 보상 `{t:"recruit",step:"giveup"}` → 출전 후보 `{t:"battleEntryPick",what:"body"}`/`{t:"battleEntryGo"}` → `{t:"endTurn",auto:true}` |
| J | Q1=A 공동 1위 난수 1회 공유 | Core(`assignLeaderElements`) 소유 — 화면은 결과를 그대로 그리고 **다시 뽑지 않는다**. 로컬 만료도 같은 `shopTimeout`/`shopDone` 경로를 지나므로 추첨 횟수가 늘지 않는다 |
| K | S01 시간 초과 좌석은 **곧바로 준비**하고 배치 90초를 다시 걸지 않음 | 로컬 상점 90초(`shopClockStart`)의 만료 콜백이 `shopTimeout` 에 이어 **그 자리에서 `setupDoneCore()`** 로 배치를 확정한다(서버 `_onClock` 의 `shopTimedOut → _autoPlace` 와 같은 자리). Core 의 `autoPlace` 만으로는 경기가 시작되지 않는다 — 이 확정이 없으면 교착이었다(B12~B14) |
| L | 배치 90초의 **끝 조건은 "확정(setupConfirm)"** 이지 "다 놓았다"가 아니다 | 서버 `_wantClock` 이 `placed` 가 아니라 `placed && ready` 를 보는 것과 같은 이유다 — 14개를 다 놓고 [배치 완료]를 끝내 누르지 않는 좌석에서 시계가 사라지면 경기가 시작되지 않는다. 만료는 **직접 놓은 좌표를 보존**하고 못 놓은 말만 채운 뒤 **한 번만** 확정한다(B7~B11) |

로컬 시계의 경계는 **상점 90초와 같은 규칙**이다: 사람 좌석만, `fxLive()` 인 환경에서만, 가림(handoff) 중에는 누구의 시간도 흐르지 않는다. 행동 30초는 추가로 **전투가 열려 있거나 연출이 잠근 동안** 멈추고(Q2=A), 남은 시간을 들고 있다가 그 값부터 이어 흐른다. 정지 해제는 다시 그리기가 아니라 500ms 간격이 알아챈다 — 연출이 끝나도 화면 갱신이 없으면 시계가 멈춘 채 남던 자리를 막았다.

## 2. 수정·추가 파일

제품: `demo/js/ui.js` · `demo/js/network.js` · `demo/css/game.css`(`.badge:empty` 1줄 — 시한이 없을 때 배지가 자리를 차지하지 않는다)
검사·CI: `demo/test/regression/smoke_issue263_client.js`(신규) · `demo/test/regression/smoke_issue236.js`(Q 절 기대값 — 아래 4절) · `demo/test/shared/harness.js`(`TURNCLK`·`turnClockText`·`turnClockSync`·`netPaused`·`netResignBtn`·`netClockText` 노출) · `.github/workflows/ci.yml`(신규 스위트 등록 + 설명 주석)
문서: `docs/milestone/v0.4.11/issues/263/Mars/report.md`(이 파일)

## 3. 실행한 검사와 결과 (각 1회)

| 명령 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue263_client.js` (신규) | **60 pass / 0 fail** |
| `node demo/test/regression/*.js` 30개 전수 | 전부 0 fail (`smoke_issue236 274` · `smoke_issue234 354` · `smoke_issue245 352` · `smoke_turnflow 203` · `smoke_turnflow_timers 36` · `smoke_fx_consumer 56` · `smoke_online_sync 23` · `smoke_search_packages 302` · `smoke_orientation_audit 8922` · `smoke_ai_completion 59` 등) |
| `node demo/test/milestone/v0.4.6/issues/122/{issue122_rules,back_nav}.js` | 93 / 122 pass, 0 fail |
| `npm run typecheck` · `npm run test:typecheck` | tsc 오류 0 · `typecheck_test: 70 passed` |
| `node demo/test/integration/smoke_public_eco_live.js` | **31 pass / 0 fail** (실서버 2클라이언트 경제) |
| `npm test` (server, 필수 CI B) | 착수 시점·구현 직후 모두 **18 스위트 0 fail**(`issue263-timers 59` · `issue237-economy 114`). 마지막 실행에서 `issue263-timers` 가 간헐 실패했다 — 아래 5-6 참고(서버 파일 미수정, Jupiter 소관) |

신규 스위트가 잡는 회귀(각 단언이 실제로 떨어지는 것을 확인): SOLD OUT 칸에 구매 버튼이 다시 생김 · 배치 화면에 90초가 안 뜨거나 다시 그리기가 마감을 되돌림 · 만료가 자동 배치·준비로 이어지지 않음 · 시간 초과 좌석이 배치 90초를 또 받음 · 가림 중에 시간이 흐름 · 행동 30초가 전투·연출 중에도 흐름 · 만료가 턴을 넘기지 않음 · 후보 선택에 별도 타이머가 생김 · 온라인에서 클라이언트가 자기 마감을 검 · `running:false` 가 계속 줄어듦 · 단절 중 기권·보드 입력이 통과함 · 정지 사유가 화면에 없음 · 복구 뒤에도 잠긴 채 남음.

**음성 대조 3건**(모두 제품 파일을 잠시 되돌려 실제로 실패하는 것을 확인한 뒤 즉시 원복했다):
| 되돌린 것 | 떨어지는 단언 |
|---|---|
| 만료 1회 제한(`fired` 래치) 제거 | C12~C14 |
| 배치 시계 끝 조건을 "다 놓았다"로 되돌림 | B8 |
| S01 만료의 배치 확정 제거 | B13·B14 · `smoke_issue236` Q1·Q2·Q4 |

### 3-1. 그 과정에서 고친 실제 결함 4건

1. **거부되는 만료가 500ms 마다 되풀이 발송되던 문제.** 강제 전투가 남은 채 행동 30초가 만료되면 Core 가 `endTurn` 을 거부하는데(규칙 — Jupiter 보고 5-1), 간격마다 다시 보내면 같은 거부 토스트가 끝없이 뜨고 `autoEnds` 지표가 부풀었다. 정지 구간마다 **1회만** 보내도록 `fired` 래치를 넣었다("1회 생략"은 말 그대로 1회다). 전투가 다시 열렸다 끝나면 그 자리에서 한 번 더 마무리한다(서버 `_settleExpiredAct` 와 같은 의도).
2. **로컬 S01 90초 만료가 배치를 확정하지 않아 경기가 시작되지 않던 교착(PD 지적).** Core 의 `shopTimeout` 은 자동 구매에 이어 자동 배치까지 하지만 **배치 확정(setupConfirm)은 하지 않는다** — 서버는 `_onClock` 에서 `_autoPlace → _handleSetup → _handleReady` 로 확정하지만 로컬에는 그 자리가 없었다. 상점 90초 만료 콜백에서 그 자리를 만들었다. #263 본문의 "곧바로 준비하며 배치 90초를 다시 걸지 않는다" 그대로다.
3. **14개를 다 놓고 [배치 완료]를 누르지 않으면 시계가 사라지던 교착(PD 지적).** 배치 90초의 끝 조건을 "미배치 말이 남았다"에서 **"아직 확정하지 않았다"**로 바꿨다(서버 `placed && ready` 와 같은 자리). 만료는 `autoPlacePositions` 가 미배치 말만 채우므로 직접 놓은 좌표를 덮어쓰지 않는다.
4. **연출이 끝나도 시계가 멈춘 채 남던 문제.** 정지 해제를 다시 그리기에만 맡기면 `fxIdle` 뒤 상태 변화가 없는 경우 시계가 `(정지)` 로 굳었다. 표시 간격이 `turnClockSync` 를 돌리도록 바꿔 500ms 안에 스스로 풀리게 했다. 같은 이유로, 단절 정지가 **풀리는 순간** 잠금 중 보류된 대기 콜백을 `fxIdle()` 로 흘려보낸다(잠금은 `fxIdle` 이 다시 본다) — 입력 잠금 조건을 넓힌 데 따른 뒤처리다.

## 4. 역할 경계에서 하지 않은 것

- **Core·서버는 Jupiter 소관**이라 `demo/js/core.js`·`data.js`·`ai.js`·`server/**` 를 수정하지 않았다. 호환 결함을 찾지 못해 Mercury 에스컬레이션도 없었다.
- Git 쓰기·스테이징·커밋·PR·이슈 코멘트·배포·Render 자원 생성·결제를 하지 않았다. 통합·기록은 Mercury 소관이다.
- **`smoke_issue236.js` Q 절의 기대값 4자리를 바꿨다.** S01 90초 만료 뒤 수동으로 `auto`·`setupDone` 을 부르던 절차(`place(T)`)를 지우고, 그 자리에서 **자동 배치·준비까지 끝나는 것**을 본다. 이는 #263 본문("곧바로 준비하며 배치 90초를 다시 걸지 않는다")이 종전 #236 동작을 명시적으로 교체했기 때문이지 **검사를 느슨하게 한 것이 아니다** — 같은 절에서 자동 구매·필드 6칸·가림 불산입·확정 거래 보존은 그대로 본다. 음성 대조로 그 단언들이 실제로 떨어지는 것을 확인했다.
- 기획에 없는 규칙을 만들지 않았다 — 강제 전투 면제(Jupiter 5-1), 전투 명령 자체의 시한(5-3), 서버 대행 후보 선택 방식(5-4)은 **[기획 필요]** 그대로 두었다.

## 5. 남은 한계 · 미검증 · [기획 필요]

0. **Venus `planning-audit.md` 는 이 보고를 처음 쓸 때 이 워크트리에 없었고, 2026-09-25 Mercury 가 원본과 같은 사본(SHA256 일치)을 `docs/milestone/v0.4.11/issues/263/Venus/planning-audit.md` 에 넣었다.** 구현 당시의 기획 근거는 Issue #263 본문(Venus 감사 결론과 CJ Q1·Q2 확정이 그대로 실려 있다)과 GDD-23/24 링크였고, 사본을 받은 뒤 대조한 결과 정지 계약(연결 끊김 = 전투 입력 잠금 · 행동 30초·B08 20초가 잔여 시간을 안고 정지)과 Q1·Q2 확정이 구현과 어긋나지 않는다. Notion GDD-23/24 원본은 여전히 조회하지 않았다.
1. **[기획 필요] 강제 전투가 남은 채 행동 30초가 만료되는 경우** — Core 가 턴 종료를 거부하므로 턴이 넘어가지 않는다(Jupiter 5-1 과 같은 결론). 화면은 그 사실을 종전 토스트로 1회 알리고 더 보내지 않는다. 면제 규칙은 CJ 결정 사항이라 임의 구현하지 않았다.
2. **로컬 행동 30초의 정지 조건은 `전투 열림 + 연출 잠금(fxLocked)` 이다.** 서버에는 흐르는 연출 시간이 없어 전투만 보지만(Jupiter 5-2), 화면에서는 입력이 잠긴 동안 시간이 타는 것이 불공정하므로 같은 규칙으로 멈춘다. 그 결과 **사람의 실제 체감 30초는 연출 시간을 제외한 값**이다 — 서버 권위 온라인은 서버 값이 그대로 보이므로 두 모드의 숫자가 완전히 같지는 않다.
3. **로컬 배치·행동 시계는 경제 경기(`S.eco`)에만 건다.** 상점 90초·B08 20초와 같은 경계다(#263 은 GDD-23 경제 계약이다). 무료 로스터 경기에는 종전대로 시한이 없다.
4. **브라우저 수동 QA·재시작 2-client 시나리오는 하지 않았다.** QA 최소 운영 원칙에 따라 자동 검증(헤드리스 회귀 + 실서버 2클라이언트 통합)으로 대체했다. 실제 화면의 배지 위치·모바일 줄바꿈·스크린리더 낭독은 **CJ 플레이 QA와 Saturn 독립 QA의 몫**이다. 접근성은 `role="timer"`·`role="status"`·`aria-disabled` 로 표시했고 별도 측정은 하지 않았다.
5. **단절 정지 중 열려 있는 복구 경로**는 재접속 상태 줄의 `포기하고 방 목록으로`(`netCancelResume`) 하나다. 이것은 기권이 아니라 재접속 포기라서 막지 않았다 — 기권 금지 계약과 구분이 필요하면 CJ 확인이 필요하다.
6. **[Jupiter·Saturn 확인 필요] `server/authoritative/test/test-issue263-timers.js` 의 행동 30초 절이 간헐 실패한다.** 6회 실행 중 1회 `56 passed, 3 failed`(`만료 → 미완료 행동을 1회 생략하고 턴을 넘긴다` · `다음 차례 좌석에 새 행동 시계` · `차례가 아닌 좌석의 중복 종료도 거부`). 실제 벽시계 `actMs:90` + `await sleep(220)` 경합이고, 강제 전투가 남은 판이 걸리면 위 5-1 한계로 턴이 넘어가지 않는다. **Mars 는 서버·Core 를 수정하지 않았고**(서버 런타임은 `runtime.js AUTHORITATIVE_FILES = data.js·state.js·core.js` 만 싣는다 — 내가 고친 `ui.js`·`network.js` 는 대상이 아니다), 작업 시작 시점의 첫 `npm test` 는 `issue263-timers: 59 passed` 로 통과했다. 이 스위트는 Jupiter 소관이라 손대지 않았다.
7. **rollback 위험(통합 PR 본문용)**: 클라이언트만 되돌리면 서버가 보내는 `clock.key=place|act` 와 `pause` 를 읽는 화면이 사라져 시한이 보이지 않고 정지 중 입력이 다시 열린다(서버는 여전히 `E_PAUSED` 로 거부하므로 규칙은 깨지지 않지만 사유 없는 오류만 보인다). 서버와 함께 되돌려야 하고, 진행 중 경기 영속화가 없으므로(#264) 되돌림은 새 경기부터만 안전하다.

---

## 6. Saturn READ_ONLY QA REVISE 수리 (2026-09-25 · 같은 워크트리 · 같은 범위)

Saturn 이 재현한 것: 단절 정지(`NET.pause` 비어 있지 않음) 중 `window.__shop('good','ball')` 가 **그대로 회선에 나갔다**(sentDelta=1 · action=shopGood). 계약(F: 정지 중 양측 게임 입력·기권 금지)이 화면 한 곳에서 새고 있었다.

### 6-1. 뿌리 — 가드를 호출자마다 걸었던 것

정지 차단이 `netAction()`(network.js) 안에만 있었는데, 공개 방 입력이 그 함수를 **지나지 않는 길이 넷** 있었다.

| 우회 경로 | 위치 |
|---|---|
| 상점 버튼 전부 (구매·새로 고침·소모품·판매·교체·티켓·속성·완료) | `ui.js` `window.__shop` 의 `go()` → `netSendAction` 직행 |
| B08 가방 선택 | `ui.js` `bagPickShow()` 의 `go()` → `netSendAction` 직행 |
| 서버 동기화 모달 중계 | `network.js` 162 · 1043 → `netSendAction` 직행 |
| 기권 확인 창의 [기권 확정] | `network.js` `netEcoResign()` → `netSendCmd("resign")` 직행 (창을 연 **뒤에** 시작된 단절을 보지 않는다) |

호출자마다 가드를 더 붙이면 다음에 생길 호출자가 다시 구멍이 된다. **모든 공개 방 게임 입력이 실제로 지나는 한 곳**은 `netSendAction()` 이므로 가드를 거기로 옮겼다(한 줄). 복구 경로(`resync`·`leave`·`ready`·`setup`)는 `netSendCmd` 직행이라 잠기지 않는다 — 잠그는 것은 게임 입력이지 복구가 아니다.

### 6-2. 고친 것

| # | 변경 | 위치 |
|---|---|---|
| 1 | **송신 끝 단일 가드** — 정지면 사유 토스트 후 `false` 반환(보내지 않음). 문구는 새 상수 `NET_PAUSE_MSG` 한 곳 | `network.js` `netSendAction` |
| 2 | **기권 확인의 확정 시점 재검사** — `netSendCmd("resign")` 직행을 지우고 같은 송신 끝을 지난다. 막히면 **창을 닫지 않는다**(복구 뒤 그 자리에서 다시 누른다) | `network.js` `netEcoResign` |
| 3 | 상점 화면 전체를 `<fieldset class="pauseLock" disabled>` 로 감싼다 — 브라우저가 안쪽 버튼을 전부 비활성으로 만든다(키보드·스크린리더 포함). 버튼마다 `disabled` 를 흩뿌리지 않는다. 기권 버튼은 이 밖이라 종전 `netResignBtn()` 규칙 그대로 | `ui.js` `shopHtml` · `css/game.css` 1줄 |
| 4 | B08 선택 버튼에 실제 `disabled`(modal 튜플 세 번째 칸) + 사유 문구 | `ui.js` `bagPickShow` |
| 5 | **정지 토글을 오버레이 서명이 알아챈다** — 종전 서명은 경제 상태만 보아 정지가 시작돼도 상점·B08 화면이 열린 모습 그대로 남았다. 복구되면 같은 자리에서 되돌아온다 | `network.js` `netSyncOverlays` |
| 6 | 정지 중 모달 버튼 클릭을 **조용히 삼키지 않는다** — 종전에는 `fxLocked()` 가 이유 없이 무시했다(정지가 `fxLocked` 에 섞여 있던 우연한 결합). 창이 열린 뒤 단절이 시작된 모든 확인 창(승급·판매·교체·티켓·기권)에 같은 사유가 뜬다 | `ui-overlays.js` `modal` |
| 7 | `__shop` 의 시작 상점 창 닫기를 **보낸 뒤로** 옮겼다 — 막혔는데 창만 닫히지 않게 | `ui.js` `window.__shop` |

**서버는 한 줄도 고치지 않았다.** `E_PAUSED` 권위 거부·경제 규칙·네 종 시계는 그대로다. 클라이언트 가드는 **사유를 먼저 알리는 것**이지 서버 판정을 대신하지 않는다 — 가드를 우회한 프레임은 여전히 서버가 거부한다(6-3 E11b 에서 실서버로 확인).

### 6-3. 검사 (각 1회, 모두 이 수리 뒤 실행)

| 명령 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue263_client.js` | **84 pass / 0 fail** (종전 60 + 절 F 24) |
| `demo/test/regression/*.js` 30개 전수 | 전부 0 fail (`smoke_issue236 274` · `smoke_public_rooms 147` · `smoke_online_sync 23` 등) |
| `node demo/test/milestone/v0.4.6/issues/122/{issue122_rules,back_nav}.js` | 93 / 122 pass · 0 fail |
| `npm run typecheck` · `npm run test:typecheck` | tsc 오류 0 · `typecheck_test: 70 passed` |
| `node demo/test/integration/smoke_public_eco_live.js` (실서버 2클라이언트) | **32 pass / 0 fail** (종전 31 + E11b) |
| `server` `npm test` (필수 CI B) | 18 스위트 0 fail — `issue263-timers 59` · `issue237-economy 114` (5절 6항의 간헐 실패는 이번 실행에서 재현되지 않았다) |

새 절 **F**(`smoke_issue263_client.js`): 정지 중 상점 입력이 회선에 나가지 않음(F2) · 사유 토스트(F3) · 상점 잠금 래퍼와 사유(F4·F5) · 복구 시 잠금 해제·입력 복원(F6·F7) · B08 선택 버튼 실제 disabled 와 사유(F8·F9) · 송신 끝이 `false` 를 돌려줌(F10·F11) · 복구 뒤 B08 선택 복원(F12·F13) · **먼저 열려 있던** 기권 확인의 확정이 나가지 않고 창도 닫히지 않으며 사유가 뜸(F15~F17) · 복구 뒤 같은 버튼이 기권을 보냄(F18·F19) · 회선 기권 명령이 송신 끝 한 곳에서만 나감(F19b·F19c, 구조 회귀) · 정지 토글을 오버레이 서명이 알아챔(F20) · 정지 중에도 방 나가기는 보냄(F21).

**음성 대조 4건**(제품 파일을 잠시 되돌려 실제로 떨어지는 것을 확인한 뒤 즉시 원복):

| 되돌린 것 | 떨어지는 단언 |
|---|---|
| 송신 끝 가드 제거 | F2·F3·F7·F10·F11·F13 — **실측이 Saturn 재현과 같았다**(정지 중 `shopGood`·`shopRefresh`·`shopDone` 3건이 그대로 송신) |
| 기권 확정을 `netSendCmd("resign")` 직행으로 되돌림 | F19b(기권 명령 2곳)·F19c |
| modal 사유 표시 제거 | F17 (F15·F16 은 통과 — 지금의 `fxLocked` 결합 때문에도 막히므로 **그 우연에 기대지 않으려고** F19b·F19c 구조 단언을 함께 둔다) |
| 상점 `<fieldset>`·B08 disabled·서명 prefix 제거 | F4·F5·F8·F20 |

`smoke_public_eco_live.js` **E11 을 바꿨다**: 종전에는 정지 중 `__shop` 이 서버까지 가서 `E_PAUSED` 를 받는 것을 보았는데, 이제 클라이언트가 먼저 막으므로 서버 왕복이 없다. 대신 **(a)** 화면 경로가 회선에 나가지 않고 코인도 불변인 것(E11)과 **(b)** 가드를 우회한 원시 프레임(구버전·변조 클라이언트 모양)을 서버가 여전히 `E_PAUSED` 로 거부하는 것(E11b)을 **둘 다** 본다 — 검사를 느슨하게 한 것이 아니라 계층을 나눠 본 것이다.

### 6-4. 남은 한계 (이번 수리분)

1. **[Jupiter·Saturn 확인 필요] `demo/test/integration/smoke_public_live.js`(#217 무경제 공개 방, 필수 CI B 의 `node … smoke_public_live.js 2`)가 이 워크트리에서 실패한다.** `timeout: match start` — 두 클라이언트 모두 `autoPlaceCore()` 뒤에도 `roster 0 · 미배치 14 · NET.mySetup=null` 이고 서버 거부 코드도 토스트도 없다(즉 `{t:"auto"}` 가 reducer 에서 조용히 거부된다). **이 수리 때문이 아니다** — 송신 끝 가드와 서명 prefix 를 지운 상태에서 같은 자리에서 같은 값으로 실패하는 것을 확인했고, 이번 변경은 전부 `netPaused()` 참일 때만 동작한다(무경제 방은 정지가 없다). 경제 경기(`smoke_public_eco_live`)와 헤드리스 30개 회귀는 전부 통과하므로 **무경제 온라인 배치 경로**로 좁혀진다 — Core·서버 소관이라 손대지 않았다.
2. 절 F 의 B08·기권 단언은 스텁 문서에서 `obBtns` 가 비워지지 않는 성질 때문에 **마지막 창의 버튼만** 본다(`lastBtns`). 실제 브라우저에서는 `innerHTML` 교체로 버튼이 새로 생기므로 같은 의미다 — 실화면 배지 위치·낭독은 여전히 CJ 플레이 QA·Saturn 몫이다.
3. `<fieldset disabled>` 는 안쪽 **폼 요소**만 비활성으로 만든다. 상점 화면의 조작은 전부 `<button>` 이라 덮이지만, 나중에 `<a>`·`onclick` 이 달린 `<div>` 를 상점에 넣으면 그 요소는 덮이지 않는다 — 송신 끝 가드가 막지만 **모습은 열려 보인다**. 그때는 그 요소도 `<button>` 으로 두는 것이 이 잠금의 전제다.
4. Git 쓰기·스테이징·커밋·PR·이슈 조작·배포·Render 자원 생성은 이번에도 하지 않았다. 원본 체크아웃·Notion·GitHub 를 건드리지 않았다.


---

## 7. Saturn 2차 READ_ONLY 최종 감사 NO-GO 수리 (2026-09-25 · 같은 워크트리 · 클라이언트 범위)

Saturn 최종 감사(`ctx_6517745803b6`)는 `smoke_issue263_client 84/0` · `smoke_public_eco_live 32/0` 이 모두 통과한 상태에서 **NO-GO** 를 냈다. 통과한 검사가 보지 않던 자리가 둘이었다.

| # | Saturn 지적 | 판정 |
|---|---|---|
| 1 | 공개 방 SETUP 의 단절 정지 중 `준비 취소`(ui.js 955)가 그대로 눌리고, `netRoomReady(false)`(network.js 918~922)가 `NET.readyWanted`/`readySent` 를 **먼저 지운 뒤** `unready` 를 보낸다. 서버는 `E_PAUSED` 로 거부하므로 권위 상태는 그대로인데 화면만 준비를 잃는다 | **확인 — 실제 결함.** 계약 F(정지 중 양측 게임 입력 동결) 위반이자 **로컬 의사 손실**이다. 아래 7-1 |
| 2 | `netApplyRoomState` 가 `NET.pause` 갱신 **직후**(network.js 581~583) `fxIdle()` 을 부르는데, 권위 보드 재수화는 그 뒤(592~600)라 대기 콜백이 옛 turn/state 를 읽고 낡은 자동 입력을 보낼 수 있다 | **확인 — 실제 순서 위험.** 재현 결과 `NET.revision` 은 이미 새 값(7)인데 콜백이 읽는 `S.turnCount` 는 옛 값(3)이었다. 아래 7-2 |

### 7-1. 준비 취소 — 뿌리는 "상태를 먼저 바꾸고 보냈다"

`netRoomReady` 는 `netAction` 도 `netSendAction` 도 지나지 않고 `netSendCmd("unready")` 로 직행한다 — 6-1 에서 옮긴 송신 끝 가드가 닿지 않는 **다섯 번째 우회 경로**였다. 여기에 더해 가드가 없더라도 문제가 되는 순서였다: `readyWanted=false; readySent=false` 를 **먼저** 실행하고 그 다음에 보낸다. 서버가 거부해도 그 지움은 되돌아오지 않는다.

호출자·버튼마다 다시 막지 않고 **의사 표명의 단일 진입점인 `netRoomReady` 맨 앞**에 가드를 뒀다(한 줄). 이 한 곳이 준비(`true`)와 취소(`false`) **양방향**을 함께 막는다 — 정지 중에는 의사를 걸지도 풀지도 않는다.

| # | 변경 | 위치 |
|---|---|---|
| 1 | **상태 변경·송신 전 차단** — 정지면 사유 토스트 후 반환. `readyWanted`/`readySent` 를 건드리지 않으므로 복구 뒤 그 자리에서 다시 누르면 된다 | `network.js` `netRoomReady` |
| 2 | 정지 중 `준비 취소` 를 **실제 disabled** 로(잠긴 모습 + 사유). `방 나가기` 는 잠금 **밖**이다 | `ui.js` `renderSetup` 준비 대기 화면 |
| 3 | 02 비공개 배치의 `무작위 배치`·`전체 회수`·`배치 완료` 도 같은 잠금으로 묶었다 — 종전에는 `netAction` 토스트만 뜨고 모습은 열려 있었다 | `ui.js` `renderSetup` 배치 절 |
| 4 | 6-2 의 상점 `<fieldset class="pauseLock" disabled>` 를 **공용 `pauseLockOpen/Close` 로 빼서** 상점·준비·배치 세 화면이 같은 모양·같은 문구 틀을 쓴다(마크업·문구 동일, 새 CSS 없음) | `ui.js` |

**`netFlushSetupReady` 는 일부러 가드 밖에 뒀다.** 그것은 사람의 새 입력이 아니라 **이미 가진 의사의 재표명**이고, `room_resumed` 직후(network.js 489)와 상대 복귀 푸시(491)에서 호출된다 — 여기에 정지 가드를 걸면 상대가 아직 돌아오지 않은 동안 준비가 영영 재전송되지 않아 재접속 복구가 막힌다. 서버가 `E_PAUSED` 로 거부하면 종전대로 `readySent` 만 풀려 다음 푸시에서 다시 시도한다(508).

### 7-2. 정지 해제 순서 — 흘려보내기를 재수화 뒤로

3-1.4 에서 넣은 "정지가 풀리는 순간 보류된 대기 콜백을 흘려보낸다"를 **`NET.pause` 갱신 직후**에 두었던 것이 원인이다. 그 자리에서는 `NET.revision` 이 이미 새 프레임 값인데 `S`(보드·턴·행동 여부)는 아직 옛 프레임이다. 대기 콜백(`UI_PORT.defer` → `dispatchCoreAction`)과 `autoEndCheck` 가 그 낡은 상태를 읽고, 서버가 받아 줄 **새 revision** 으로 자동 입력을 보낼 수 있다.

흘려보내기를 `netUnpauseFlush(unpaused)` 로 빼고 **권위 보드 재수화(`netBuildAuthoritativeBoard`) → `render()` → `netFxPump()` 뒤**로 옮겼다. 경기 전(SETUP) 갈래도 같은 자리(`netApplyEcoSetup` → `render` → `netFxPump` 뒤)에서 부른다. 종결 갈래(`canceled/void/closed`)는 `netAbandonResume` 이 방을 접으므로 흘려보내지 않는다. 동작은 같은 프레임 안에서 순서만 뒤로 간 것이고, 시계 정지 해제(3-1.4 의 목적)는 그대로다.

### 7-3. 검사 (각 1회, 모두 이 수리 뒤 실행)

| 명령 | 결과 | exit |
|---|---|---|
| `node demo/test/regression/smoke_issue263_client.js` | **108 pass / 0 fail** (종전 84 + 절 G 17 + 절 H 7) | 0 |
| `demo/test/regression/*.js` 30개 전수 | 전부 0 fail | 0 |
| `npm run typecheck` (tsc) | 오류 0 | 0 |
| `npm run test:typecheck` | `typecheck_test: 70 passed, 0 failed` | 0 |
| `node demo/test/integration/smoke_public_eco_live.js` (실서버 2클라이언트) | **32 pass / 0 fail** | 0 |

`netApplyRoomState` 의 순서를 바꿨으므로 실서버 통합을 한 번 더 돌렸다. 서버 스위트는 **서버·Core 를 한 줄도 고치지 않았고**(`runtime.js AUTHORITATIVE_FILES = data.js·state.js·core.js` 에 `ui.js`·`network.js` 가 없다) 이번 변경이 전부 클라이언트 표시·입력 계층이라 다시 돌리지 않았다 — QA 최소 운영 원칙(변경에 필요한 자동 검증 우선)에 따른 판단이고, 5절 6항의 간헐 실패는 여전히 **Jupiter·Saturn 소관**이다.

새 절 **G**(정지 중 출전 준비): 평시 동작(G1) · `준비 취소` 가 `<fieldset disabled>` 안(G2)과 사유(G3) · `방 나가기` 는 잠금 밖(G4) · 정지 중 `unready` 미송신(G5) · **준비 의사 보존**(G6) · 사유 토스트(G7) · 화면이 배치로 되돌아가지 않음(G8) · 준비 의사 방향도 차단(G9·G10) · 복구 시 잠금 해제(G11)와 같은 버튼의 정상 동작·의사 해제(G12·G13) · 배치 조작 잠금과 사유(G14·G15) · 정지 중 배치 입력 미송신(G16) · 복구 복원(G17).
새 절 **H**(정지 해제 순서): 정지 중 대기 콜백 보류(H1~H3) · 해제 프레임에서 1회 실행(H4) · **그 콜백이 재수화된 턴을 읽음**(H5) · revision 과 보드가 같은 시점(H6) · 해제 프레임에서 낡은 자동 입력 미송신(H7).

**음성 대조 3건**(제품 파일을 잠시 되돌려 실제로 떨어지는 것을 확인한 뒤 즉시 원복):

| 되돌린 것 | 떨어지는 단언 |
|---|---|
| `netRoomReady` 가드 제거 | G5·G6·G7·G8·G9·G10·G12 — **실측이 Saturn 재현과 같았다**(정지 중 `unready` 1건 송신 + `readyWanted` 손실, 준비 방향은 `unready,setup,ready` 3건 송신) |
| 흘려보내기를 `NET.pause` 갱신 직후로 되돌림 | H5 (`기대 9 · 실측 3` — 콜백이 옛 턴을 읽고 새 revision 을 들고 있었다) |
| `renderSetup` 의 잠금 래퍼 제거 | G2·G3·G14·G15 |

### 7-4. 남은 한계 (이번 수리분)

1. `<fieldset disabled>` 는 **폼 요소**만 덮는다(6-4.3 과 같은 전제). 출전 준비 화면의 로스터 카드·트레이 말은 `onclick` 이 달린 `<div>` 라 모습이 잠기지 않는다 — 입력은 종전 `netAction` 가드가 사유 토스트와 함께 막지만 **열려 보인다**. 보드 칸도 같다. `<button>` 으로 바꾸는 것은 표시 구조 변경이라 이번 좁은 범위에서 하지 않았다.
2. 절 G 는 헤드리스 스텁 문서의 `#sidePanel` 마크업을 본다 — 실제 브라우저의 배지 위치·포커스 이동·스크린리더 낭독은 여전히 **CJ 플레이 QA·Saturn 독립 QA** 의 몫이다.
3. `netFlushSetupReady` 가 정지 중에도 `setup`·`ready` 를 보낼 수 있는 것은 7-1 대로 **의도**다(복구 재표명). 이 재전송까지 막아야 하는지가 계약상 다르다면 **[기획 필요]** 다.
4. 5절 6항(`test-issue263-timers` 간헐 실패)과 6-4.1(`smoke_public_live` 무경제 배치 경로 실패)은 이번 수리와 무관하며 **그대로 남아 있다** — Core·서버 소관이라 손대지 않았다.
5. Git 쓰기·스테이징·커밋·PR·이슈 조작·배포·Render 자원 생성을 하지 않았다. 원본 체크아웃·Notion·GitHub 를 건드리지 않았고, 착수 시점의 dirty·untracked Jupiter/Mars/Venus 작업물을 모두 보존했다.
