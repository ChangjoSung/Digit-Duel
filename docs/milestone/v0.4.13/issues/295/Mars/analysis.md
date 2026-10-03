# #295 턴 상점 UI/UX — Mars 구현 전 정적 분석 (2026-10-02)

- 역할 5필드: required_role=Mars · mode=IMPLEMENT · area=HTML · mutation=docs · instance_index=null
- 실행값: Claude `claude-opus-5-5` · effort high(기동 인수) · `--dangerously-skip-permissions` · Ponytail full · 세션 `8d39c5c4-7d80-4e92-8386-0e762367a9c8`
- dispatch `ctx_8b09b197bb84` / task `task_a8c7d203f1dd` · 기준 `origin/milestone/v0.4.13` `a78a65e`(Mercury GO 문구 기준 — 이 Worker는 Git 명령 0회라 SHA를 직접 확인하지 않았다)
- **분석 전용**: 제품·테스트·도구·자산 수정 0 · 테스트/브라우저/시뮬레이션 실행 0 · Git/GitHub/Notion 0 · 하위 Worker 0. 쓴 파일은 이 문서 하나.
- 권위: [`references/CJ_COMMENT_20261002.md`](../references/CJ_COMMENT_20261002.md) · [#293 계약](../../293/Venus/implementation-contract.md) · [#293 REVISE4 구현](../../293/Mars/qa-revise4-implementation.md) · [#294 계약](../../294/Venus/implementation-contract.md). 과거 #295/PR303(로비 핑·강퇴)은 이력이며 이 턴 상점 범위의 QA가 아니다.

표지: **[CJ]** CJ 원문 / **[현행]** 지금 코드·계약 그대로 / **[제안]** Mars 권고(결정 아님) / **[미확정]** 근거 부족 — 기획·실측 필요 / **[추론]** 정적 읽기 결론(실행 확인 아님).

## 0. 결론 요약

1. **[현행]** 시작 상점(S01)과 턴 상점(S05)은 이미 **본문 함수 하나**(`shopHtml` — `demo/js/ui.js:2069`)와 **조작 함수 하나**(`window.__shop` — `ui.js:2255`)를 쓴다. 갈라지는 것은 머리줄(`ui.js:2114-2119`), 시너지 자리(`ui.js:2126`), 왕·동료 줄(`ui.js:2101-2106`), 그리고 **담는 그릇**(S01 = 준비 패널 안 `ui.js:1060` / S05 = 보드 위 모달 `ui.js:2236` · `network.js:805`)뿐이다.
2. **[제안]** "같은 구조"는 **그릇(모달·단계·시계)을 그대로 두고 머리줄·시너지 자리만** S01 부품(`topBarHtml` · `.flowBar .go` · `.secHead` · `synRailHtml`)으로 바꾸는 것이 가장 작다. `flowHeadHtml`을 통째로 부르면 안 된다(3장).
3. **[현행]** 기존 회선으로 전부 된다 — **Jupiter 변경은 필요 없다**(4장). 필요해지는 경우는 CJ가 "상대의 상점 완료 여부 표식"이나 "양쪽 공통 마감 시각"을 요구할 때뿐이며 둘 다 지금 계약에 없다 → **[미확정]**.
4. 예상 수정 파일: `demo/js/ui.js` · `demo/js/network.js`(1줄) · `demo/css/game.css` · 기존 회귀 3~4개의 대체 기대값. Core·data·서버·새 타이머·새 준비 상태·새 창 체계·새 의존성 0.

## 1. 확정 / 현행 / 제안 / 미확정 구분

| 구분 | 내용 | 근거 |
|---|---|---|
| [CJ] | #294 작업 방식 그대로 · 턴 상점 UI/UX = #293 시작 상점과 **동일한 구조** · 구현 전 최종 보고 | `references/CJ_COMMENT_20261002.md:5-7` |
| [CJ] | 새 콘티 없음 — 비교 기준은 #293 최종 구현 + #294 상세/공통 UI | 같은 파일 `:9` |
| [현행] | 정기 상점 90초 · 그 단절 정지 규칙 · 티켓 `×N`/사용 조건은 #293에서 "변경 없음"으로 못 박힘 | #293 계약 1장 표 · 3.1 · AC 13 |
| [현행] | 판매 확인 창 없음 · 교체 창 ✕/Esc · 상품 가격/설명 팝업은 **이미 두 상점 공통**(같은 함수) | #293 계약 4.1 · 9.1 · 9.3, `ui.js:2277-2299` · `2041` |
| [현행] | 하수인 설명 창은 "정기 상점(#295)이 그대로 물려받는다" | #294 계약 4.1 ④ 끝 |
| [현행] | 턴 상점 머리줄·시너지 두 줄은 #295로 미뤄 둔 자리 | `ui.js:2113` · `2177` 주석 |
| [제안] | 2~3장의 재사용안 · 6장 AC · 7장 QA | 이 문서 |
| [미확정] | ① 진행 막대(01/02/03)에 해당하는 것이 턴 상점에 있는가 ② 상대 완료 표식 ③ 티켓 사용을 S01 속성 줄 모양으로 바꿀지 ④ 정기 상점 온라인의 `[기권]` 자리 ⑤ 모달을 유지할지 전체 화면으로 바꿀지 | CJ 원문에 없음 — 5장 |

## 2. 실제 흐름 추적

### 2.1 그리는 곳 — 호출자 전부

| 함수 | 정의 | 호출자 |
|---|---|---|
| `shopHtml(p)` | `ui.js:2069` | S01 `renderSetup` `ui.js:1060` / S05 오프라인 `shopShow` `ui.js:2236` / S05 온라인 `netRenderEcoOverlay` `network.js:805` — **3곳뿐** |
| `shopShow(cover)` | `ui.js:2233` | 이벤트 `shopOpened` `ui.js:70` · `shopChanged` `:71` · `shopRefused` `:72` · `shopHandoff` `:73` · `__shop`의 `back` `ui.js:2262`. S01이면 `closeModal(); render()`로 빠진다(`:2235`) |
| `shopViewer()` | `ui.js:2025` | `shopShow` · `__shop` · 토스트 조건(`:71-72`) · `netRenderEcoOverlay`(`network.js:803`). S05는 `S.phase==="shop"`일 때만 좌석을 돌려준다(`:2028`) |
| `shopSynHtml(p)` | `ui.js:2178` | `shopHtml`의 정기 분기 한 곳(`:2126`) |
| `synRailHtml(p)` | `ui.js:2188` | `flowHeadHtml` `:2219` · 보드 `renderBoardInfo` `ui.js:985` |
| `flowHeadHtml(p,btn)` | `ui.js:2201` | `renderSetup` 두 곳(`:1037` · `:1060`)뿐 |
| `topBarHtml(p,tools)` | `ui.js:1003` | `flowHeadHtml` `:2214` · 보드 `:980` |
| `shopClockStart/Stop/Text` | `ui.js:2239-2253` | 시작: `shopShow` · `netRenderEcoOverlay` / 정지: `gameReset` `ui.js:43` · `shopClosed` `:74` · 화면 초기화 `:1222` · `netSyncOverlays` `network.js:1215` |

### 2.2 누르는 곳 — `window.__shop(op,a,b)` (`ui.js:2255-2305`)

| op | 보내는 Core 액션 | 화면 가드 | 비고 |
|---|---|---|---|
| `buy` | `shopBuy{i,seq}` | 보유 종이면 승급 확인 창(`:2270`) | 신규는 즉시 |
| `refresh` | `shopRefresh{seq}` | 버튼 disabled(`:2111`) | |
| `good` | `shopGood{item}` | 상품별 disabled(`:2087`) | |
| `info` | 없음 — `goodHelp` 팝업 | | 전송 0 |
| `sellField` | `shopSell{pieceId}` | `sell` 잠금 | **S01 전용** — 버튼이 `start`일 때만 그려지고(`:2092`) Core도 `!start`면 거부(`core.js:1510`) |
| `sell` | `shopSell{uid}` | `UI.sellLock`(revision+액션 · `:2277-2279`) | 두 상점 공통 |
| `swap`→`swapTo`/`swapX` | `shopSwap{pieceId,uid}` | `UI.swapLock` · 정지 · 연출 잠금(`:2297`) | 두 상점 공통 |
| `lead` | `leaderEl` | | S01 전용(Core `core.js:1539`) |
| `ticket` | `shopTicket` | 3단 창(말 → 속성 → 확인 · `:2300-2303`) | S05 전용 |
| `done` | `shopDone` | **연타 잠금 없음** | S01은 진행 버튼(`ui.js:1058`), S05는 머리줄 `[완료]`(`:2119`) |

송신 끝은 `go`(`:2259-2261`) 하나: 온라인이면 `netSendAction(netEcoWire(act))`, 오프라인이면 `dispatchCoreAction`. S01만 보낸 뒤 `closeModal()`.

### 2.3 Core → 회선 → 서버

```
__shop → go → [오프라인] dispatchCoreAction → ecoReduce(core.js:1439) → shopChanged/Refused/Closed → shopShow
            → [온라인]  netEcoWire(network.js:771: {t,shop:turn,seq,…})
                         → netSendAction(432: 정지면 차단) → room.handleCommand(room.js:1041-1051: E_PAUSED 1047)
                         → _authorizeEco(1057-1088: 단계·E_SHOP_STALE·완료 좌석·E_DEADLINE) → Core ecoReduce
                         → room_state(you.eco · shop · clock) → netEcoState(network.js:739)
                         → netSyncOverlays(1194: 서명이 바뀔 때만) → netRenderEcoOverlay(801)
```

| 가드 | 어디서 | 근거 |
|---|---|---|
| 소유권 | 서버가 `player`를 좌석으로 채움 · 진열·코인·가방은 자기 좌석 값만 전송 | `room.js:1076` · `1850-1880` · `network.js:739-746` |
| 단계 | `phase==='shop'`(또는 S01의 `setup`) 아니면 `E_ILLEGAL_ACTION` · 완료 좌석도 같음 | `room.js:1072` · `1074`, Core `ecoGate` `core.js:1411-1417` |
| 낡은 진열 | `shop`(오픈 턴)+`seq` 불일치 → `E_SHOP_STALE` | `room.js:1073` · 문구 `network.js:475` |
| 시한 | S05 = **좌석 시계** `shop:<턴>` 90초(`room.js:1371-1377`), S01 = 방 공통 `prep`(`:1060`). 늦으면 `E_DEADLINE`(`:1075`). 만료 = 서버가 `shopTimeout`(`:1509-1523`) — 정기는 그 좌석 `done`만 세움(`core.js:1568`) |
| 단절 | 좌석 시계 정지(`room.js:1456` `paused: … this._paused()`) · 입력 `E_PAUSED` · 화면 `<fieldset disabled>`(`ui.js:363-364` · `2120`) + 서명 `P|`로 다시 그림(`network.js:1205`) |
| 재접속 | 재접속 프레임의 `shop`·`clock`을 다시 해독 → 같은 키라 90초가 다시 서지 않음(`room.js:1467-1484` `_tick`) |
| 가방 초과 | 정기 신규 구매는 가방 3칸이면 Core 거부 "가방이 가득 찼습니다"(`core.js:1466`). B08(포획 초과)은 **다른 단계**(`bagPick`)·다른 오버레이(`network.js:1190`)라 상점과 겹치지 않음 |
| 화면 시계 | 온라인 `netClockText`(`leftMs`/`running`만 — `room.js:1897`), 오프라인 `SHOPCLK`(사람·좌석별 90초, 가림 중에는 걸지 않음 `ui.js:2242-2248`) |
| 핫시트 | 순차(`sh.active`) + 가림(`handoff` `ui.js:2237`) → `shopHandoff`. 온라인·PVE는 동시(`core.js:1598`) |
| 정리 | `shopClosed` → 정기는 `closeModal()`(`ui.js:74`) · `gameReset`(`:43`) · `netLeave` 경로(`network.js:1033-1034`) · 안내 창은 `modal()`/`closeModal()`/`uiApply`가 닫음(`ui-overlays.js:11` · `27-28`, `ui.js:184`) |

## 3. 겹치는 것(재사용) vs 수명이 다른 것(복사 금지)

| 항목 | S01 | S05 | 판단 |
|---|---|---|---|
| 진열 6칸 · 필드 · 가방 · 상품 8종 · 교체 · 판매 · 설명 팝업 | 같은 코드 | 같은 코드 | 이미 공유 — 손대지 않는다 |
| 머리줄 | `topBarHtml`(나 VS 상대 · 시계 · 코인 · ⚙) + `.flowBar`(진행 막대 + 진행 버튼) + `.secHead`(하수인 구매 · 새로 고침) | `.shopHead` 한 덩어리(제목 · 시계 · 코인 · 새로 고침 · 완료) | **재사용 대상** |
| 시너지 | 우측 세로 열 `synRailHtml` | 시트 안 가로 3줄 `shopSynHtml` | **재사용 대상** — `synRailHtml`은 `setup`이 아니면 Core `synView`를 읽고(`ui.js:2188-2189`) 정기의 `ecoSynView`도 같은 `synView`+죽은 동료 수(`core.js:2309`)라 값이 같다. 왕관·전설 칩은 `synExtraChips`가 이미 붙인다 |
| 그릇 | 준비 패널(`#app[data-flow]`) | `#overlay` 모달(단계 `shop` = 화면 이름 `board` · `ui.js:169`) | **수명이 다르다** — 유지 |
| 시계 | 방 공통 `prep` 180초 · `#prepClock` · `PREPCLK` | 좌석별 90초 · `#shopClock` · `SHOPCLK` | **수명이 다르다** — 유지. 새 타이머 0 |
| 단계 | `UI.prep`/`uiPrepLock`/`seats.step`(shop·place·done) | 단계 없음(상점 → 완료 대기) | **복사 금지** — 준비 상태를 턴 상점에 만들지 않는다 |
| 왕·동료 | 무료 속성 줄 5버튼 | 티켓 버튼 → 3단 창 | 규칙이 다르다(Core `core.js:1539-1541`) — [미확정 ③] |
| 필드 판매 | 있음 | 없음(Core 거부) | 규칙 — 유지 |
| 나가기 | ⚙ 안 `방 나가기`/`로비로`(`ui.js:2216`) | 온라인: 시트 밑 `netResignBtn()`(`network.js:805`) / 오프라인: 없음 | [미확정 ④] |

**`flowHeadHtml`을 통째로 부르면 안 되는 이유** [추론 · 정적]:
- `#prepClock`을 넣는데 `turnClockTick`이 0.5초마다 그 요소에 `turnClockText("prep")`를 쓴다(`ui.js:2018`). 준비 단계가 아니면 빈 문자열(`:2004` · 온라인은 `ecoClock.key!=="prep"`) → **시계 칸이 비워진다.**
- 진행 표식 계산이 `S.setupPlayer` · `placed` · `NET.steps`를 읽는다(`ui.js:2208-2211`) — 경기 중에는 뜻이 없고 `NET.steps`는 `IN_PROGRESS` 뷰에 오지 않는다(`room.js:1794` `seats:{ready}`).
- ⚙ 메뉴가 `uiPubPrestart()`/`uiBack()` 나가기를 싣는다(`ui.js:2216`) — 경기 중 상점에서는 다른 동작이어야 한다.

## 4. Jupiter(서버) 변경 필요 여부

**필요 없다 — 기존 회선으로 충분하다** [현행 · 코드 읽기].

- 정기 상점의 모든 조작(`shopBuy/Refresh/Good/Sell(uid)/Swap/Ticket/Done`)은 이미 회선 어휘이고 서버가 인가한다(`room.js:52-57` · `1104-1109` · `1057-1088`).
- 머리줄이 쓸 값은 전부 온다: 내 코인(`_ecoView` `room.js:1855`), 시계(`_clockView` `:1893-1897` 키 `shop`), 시너지(`_shopView.syn` `:1874-1878` + 보드 말), 이름·대표(`NET.players`/`NET.reps` — #294 부품이 읽는 값).
- 서버 손이 필요해지는 것은 아래 둘뿐이고 **둘 다 승인된 계약에 없다**:
  - 상대의 "상점 완료" 표식: 내가 아직 안 끝냈을 때 상대 완료 여부는 뷰에 없다(`_shopView`는 `done: sh.done[seatIndex]`만 · `seats.step`은 `SETUP` 전용 `room.js:1704`). 내가 끝낸 뒤에는 `phase==="shop"`이 남아 있다는 사실로만 안다.
  - 양쪽 공통 마감 시각(`deadline`/`serverNow`): 정기 시계는 `leftMs`/`running`만 싣는다. 두 좌석 시계는 같은 순간 같은 키로 서지만 [추론] 좌석별 객체다.
- 확인만 권고(코드 변경 아님): 없음. Core·data도 무변경이라 서버 회귀를 다시 돌릴 근거가 없다.

## 5. 가장 작은 구현안 [제안] + 미확정

### 5.1 수정 범위 (Mars 단독)

| 파일 | 일 | 크기 [추론] |
|---|---|---|
| `demo/js/ui.js` `shopHtml` | 정기 분기 `head`(`:2116-2119`)를 `topBarHtml(p, #shopClock + 코인 + ⚙)` + `<div class="flowBar"><h2>N턴 상점</h2><button class="primary go">완료</button></div>` + `.secHead`(하수인 구매 · `refresh("")`)로 치환. `start?"":shopSynHtml(p)`(`:2126`) → 정기일 때 `synRailHtml(p)`. `shopSynHtml` 삭제(다른 호출자 없음) | 약 10줄 치환 · 6줄 삭제 |
| 같은 함수 | `[완료]`에 기존 `once`/`UI.sellLock` 식 연타 잠금 재사용(6.2) | 1~2줄 |
| `demo/js/network.js:805` | `netResignBtn()`을 시트 밑에서 ⚙ 메뉴로 옮길 때만 1줄(미확정 ④에 따름) | 0~1줄 |
| `demo/css/game.css` | 모달 안 시트에 우측 열 자리(`padding-right` + `position:relative`)와 머리줄 고정. 쓰지 않게 되는 `.shopSheet .shopHead …`(`:990-996`) 삭제 | 5~8줄 · 삭제 7줄 |
| 기존 회귀 | `.shopHead`·시너지 3줄을 보는 단언만 새 값으로 치환(7장) | 대체분만 |

새 도우미는 0~1개다(정기 머리줄 문자열을 `shopHtml` 안에 그대로 쓴다). `#shopClock` · `SHOPCLK` · `shopClockText` · `window.__shop` · `shopViewer` · 오버레이 서명(`network.js:1203`)은 **이름까지 그대로** 둔다.

### 5.2 미확정 — Venus/CJ가 정할 것 (Mars는 결정하지 않는다)

| # | 질문 | 가장 작은 기본안 [제안] |
|---|---|---|
| ① | 진행 막대(01 상점 — 02 배치 — 03 완료)에 해당하는 것을 턴 상점에 둘 것인가 | **두지 않는다.** 턴 상점에는 단계가 하나뿐이다. 그 자리에 `N턴 상점` 제목 + `[완료]` |
| ② | 상대의 상점 완료 표식 | **두지 않는다**(서버 필드가 없다 — 4장). 원하면 [기획 필요] + Jupiter |
| ③ | 티켓 사용을 S01의 왕·동료 속성 줄 모양으로 바꿀 것인가 | **현행 유지**(버튼 + 3단 창 · #293 3.1 "변경 없음"). 바꾸면 확인 창 유무가 규칙 UX 변경이라 [기획 필요] |
| ④ | 온라인 정기 상점의 `[기권]` 자리 | ⚙ 메뉴로 옮긴다(S01의 나가기와 같은 자리). 6.3의 기존 누락도 함께 없어진다. 오프라인은 ⚙에 나가기를 **새로 만들지 않는다**(지금도 없다) |
| ⑤ | 모달 유지 vs S01처럼 전체 화면 | **모달 유지.** 전체 화면은 `uiScreenName` · `netSyncOverlays` · 가림(`handoff`) · `shopClosed` 정리 · 보드 시계 표시까지 건드린다 — "구조 동일"의 최소 해석을 넘는다 |
| ⑥ | 내가 끝낸 뒤 상대 대기 화면(`network.js:804` "🛒 상점 완료")도 같은 머리줄을 쓸 것인가 | 현행 유지(짧은 대기 창) |

Earth: 새 시각 토큰이 필요 없다고 본다 [추론] — 전부 #293/#294 기존 클래스다. 모달 폭에서의 배치 확인만 필요(6.4).

## 6. 구체적 위험

### 6.1 낡은 선택자·ID

| 위험 | 근거 | 대응 |
|---|---|---|
| `#prepClock` 재사용 시 시계가 비워짐 | `ui.js:2018` · `2004` | `#shopClock` 유지, `flowHeadHtml` 미호출 |
| `.synRail`은 `.flowHead`(sticky = 기준 상자)에 `position:absolute; top:100%`로 붙는다. 모달 안에는 그 기준이 없다 → 열이 엉뚱한 곳에 뜨거나 본문과 함께 스크롤 | `game.css:1230` · `1252` · 보드용 `:1369-1386` | 모달 안 머리줄을 기준 상자로 만드는 CSS 1~2줄. 높이식 `calc(100dvh - 190px)`도 모달 기준으로 다시 잡는다 |
| S01 배치 규칙은 `#app[data-flow]` 아래에 걸려 있다. `#overlay`는 그 밖이라 **적용되지 않는다** | `game.css:1222-1229` | 필요한 것만 `.shopSheet` 아래로 |
| 보드의 `.topBar`(`#boardInfo`)가 모달 뒤에 그대로 있다 → `.topBar`/`.idSeat`/`.flowGear`를 문서 전체에서 첫 번째로 집는 코드·회귀는 보드 것을 집는다 | `ui.js:980` | 새 코드는 `#overlayBox` 안에서만 찾는다. 기존 회귀 단언의 선택 범위 확인 |
| ⚙는 `<details>` — 상점이 다시 그려지면(내 거래마다) 닫힌다 | `ui.js:1009` · `network.js:1203` | 허용(S01과 같다) |
| `shopSynHtml` 삭제 뒤 그 문자열(`시너지` 제목 · `.synRow` 3줄)을 보는 회귀 | `smoke_issue236.js`(22건) · `smoke_issue238.js` 등 — 건수는 검색어 일치일 뿐 [추론] | 대체 기대값으로 치환 |

### 6.2 이중 동작

| 위험 | 근거 | 판단 |
|---|---|---|
| `[완료]` 연타 — 잠금 없음. 온라인 2번째는 서버가 `E_ILLEGAL_ACTION`(`room.js:1074` 또는 상점이 이미 닫혀 `:1072`) → 사유 토스트 | `ui.js:2282` | 눈에 띄는 진행 버튼으로 옮기면 더 잘 눌린다 → 기존 잠금 재사용 권고 |
| 신규 `buy` · `refresh` 연타 — 두 번째는 `seq`가 달라 `E_SHOP_STALE`(이중 차감 없음) | `core.js:1486` · `1493`, `room.js:1073` | 현행 유지(안전) |
| `good` 연타 — `seq`가 오르지 않아 **두 번 다 구매**된다 | `core.js:1496-1505` | 현행 규칙(여러 개 구매는 정상). 320px에서 버튼 높이 32px(`game.css:1035`)라 오탭 가능 — 변경 제안 아님, 기록만 |
| 열린 승급/티켓 확인 창에서 서버가 거부하면 창이 남는다 — `once`는 소진됐고 내 경제가 안 바뀌어 서명이 같다 | `ui.js:2264` · `network.js:1203-1208` | [추론] 현행 동작. 이번 범위에서 고치지 않되 QA 관찰 항목 |
| 교체 거부 시 `UI.swapLock`이 남아 카드가 먹통(✕로 닫으면 풀림) | `ui.js:2289` · `2299` | [추론] 현행. 같은 취급 |

### 6.3 팝업·창

| 위험 | 근거 | 판단 |
|---|---|---|
| **온라인 정기 상점에서 승급/티켓 확인을 `[취소]`하면 `[기권]` 버튼이 사라진다** — `back()` → `shopShow(false)` → `modal(shopHtml(p),[])`는 `netResignBtn()`을 붙이지 않는다. 다음 서명 변화까지 그대로 | `ui.js:2262` · `2236` vs `network.js:805` | [추론 · 정적 — 실행 확인 아님] 현행 결함 후보. 미확정 ④를 ⚙로 정하면 `shopHtml` 안에 들어가 함께 해결 |
| 머리줄의 신원 칸(`idHelp`) · 시너지 칩(`synHelp`)이 모달 안에서 열린다 — 호스트는 `#overlayBox`(`ui.js:1447`), 닫힘은 `modal()`/`closeModal()`이 처리 | `ui-overlays.js:11` · `27` | 기존 틀 그대로 동작할 것으로 본다 [추론] |
| 바깥 탭 = 닫기만(캡처에서 click 삼킴) → 팝업이 열린 채 `[구매]`를 누르면 첫 탭은 닫기 | `ui.js:1463` | 현행(#294 AC 12) |
| Esc 우선순위: 안내 창 → 교체 창 ✕ → `[취소]` 확인 창. 상점 시트 자체는 Esc로 닫히지 않는다. 새 머리줄에 `.acctHead .acctX`를 넣으면 **Esc가 그것을 누른다** | `ui-overlays.js:57-59` | 머리줄에 `acctHead`/`acctX` 클래스를 쓰지 않는다 |
| 열릴 때 포커스 = `#overlayBox`의 첫 활성 버튼(`modalFocus`) → 새 배치에서는 **신원 칸**이 첫 버튼이 된다 | `ui-overlays.js:46` | 수용 가능하나 QA에서 확인(종전에는 진열/새로 고침 쪽) |
| 핫시트 가림(`#overlay.handoff`) 중에는 `SHOPCLK`를 걸지 않는다 — 머리줄을 바꿔도 `shopShow`의 `open` 순서를 건드리지 않아야 한다 | `ui.js:2236-2243` | 순서 불변 |
| 이모티콘 버튼(`#emoteLayer`)과 모달 우상단 `[완료]`/⚙ 겹침 | `game.css:1226`은 `data-flow` 전용 | **[미확정 — 정적으로 판단 불가]** 1회 화면 확인 필요 |

### 6.4 320px

- 모달은 ≤360px에서 폭 100% · 좌우 여백 4px(`game.css:1097`, 상점 시트 예외 `:1190`) → 내용 폭 약 312px. 우측 열 48px을 빼면 **시트 약 260px** [추론 — 계산값, 실측 아님].
- 진열 한 줄 고정분 = 30+36+64(구매) + 간격 18 + 여백 12 = 160px → 이름 칸 약 100px(말줄임 `:1004`). 승급 배지(`.up`)가 붙는 정기 상점 줄은 S01에 없던 조합이다.
- 상품 4열(`:1030`) → 칸당 약 60px에 `구매 🪙3`(12px) — 빠듯하다. S01은 `startGoods`, 정기는 8종 전부(`ui.js:2086`)라 **정기에서만 2줄 × 4칸**이 된다.
- 가방 ≤360px 2열 + `[교체][판매]` 한 줄(`:1284` · `1334`) — 칸당 약 128px, 가능.
- 상단 한 줄 50/50(`:1345`): 오른쪽 반 약 150px에 시계(`⏱ 90초 (정지)`) + 코인 + ⚙(44px). 정지 문구가 붙으면 `.badge`가 `overflow:hidden`으로 잘린다(`:1350`) — S01에는 "(정지)"가 없었다(준비 시계는 멈추지 않는다).
- 361~400px: 모달 기본 여백이 ≤360 예외보다 커서 S01 페이지보다 좁을 수 있다. `#overlayBox` 기본 규칙은 이번 읽기에서 찾지 못했다 → **[미확정]**.

## 7. 구현 뒤 QA 제안 — 영향받은 것만, 명령당 최대 1회 (지금 실행 0)

| 담당 | 명령 | 보는 것 |
|---|---|---|
| Mars | `node demo/test/regression/smoke_issue236.js` | 정기 상점 거래·시계·핫시트 순차(머리줄/시너지 문자열 대체분) |
| Mars | `node demo/test/regression/smoke_issue293.js` | S01이 그대로인지 · 공용 부품(상단 한 줄 · 시너지 열 · 안내 창 수명) |
| Mars | `node demo/test/regression/smoke_issue238.js` | 보드 상단·전투 창 안 시너지 · 온라인 상점 오버레이 |
| Mars | `node demo/test/regression/smoke_issue263_client.js` | 정지 중 잠금(`pauseLock`) · `#shopClock` 표시 · 나간 뒤 잔존 0 |
| Mars | `npm run typecheck` | |
| Mars | 화면 1회: 320 · 390 · PC 폭에서 정기 상점 한 장씩 | 6.3 이모티콘 겹침 · 6.4 폭 · 시너지 열 위치 |
| Jupiter | **없음** — 서버·Core 무변경이면 실행 근거가 없다(`QA_MINIMUM_POLICY.md` "이유 없는 재실행 금지") | |
| 공통 | PR 필수 CI 6개 | Mercury |

- `smoke_issue285.js`는 상품 줄·`.shopHead`를 볼 수 있다(9건 일치) — 머리줄 단언이 있으면 포함, 없으면 제외 [구현 Worker가 확인].
- 새 테스트 파일 0. 대체되는 옛 기대값: "정기 상점 머리줄 = `.shopHead`(제목·시계·코인·새로 고침·완료 한 덩어리)" · "정기 상점 시너지 = 시트 안 가로 3줄". 그 밖의 규칙 단언은 치환·약화하지 않는다.

## 8. Acceptance Criteria 초안 [제안 — Venus 계약에서 확정]

1. 정기 상점이 열리면 맨 위가 S01과 **같은 부품의 상단 한 줄**(왼쪽 50% 나 VS 상대 / 오른쪽 50% 시계 · 내 코인 · ⚙)이다. 시계 요소는 `#shopClock`이고 온라인은 서버 `clock`(키 `shop`), 오프라인은 기존 `SHOPCLK` 값이다.
2. 그 아래 `N턴 상점` + 진행 버튼 `[완료]`(S01 `[다음 단계]`와 같은 모양·자리), 이어서 `하수인 구매` 제목 줄 오른쪽에 새로 고침.
3. 시너지는 시트 안 가로 줄이 아니라 **우측 세로 열**(왕국 5 → 아키타입 6 → 왕관 → 활성 전설)이고 숫자가 Core `synView`/`synExtraView`와 같다. 내 것만.
4. 진열 · 필드 · 가방 · 교체 · 판매 · 상품 · 설명 팝업 · 티켓의 동작과 전송 수가 종전과 같다(필드 판매 버튼은 정기 상점에 없다).
5. 90초 · 단절 정지 · `E_DEADLINE`/`E_SHOP_STALE`/`E_PAUSED` 처리 · 핫시트 순차와 가림 · 만료 시 자동 완료가 종전과 같다. 준비 상태(`UI.prep`·`seats.step`)와 새 타이머가 턴 상점에 생기지 않는다.
6. `[완료]`를 연달아 눌러도 요청은 1회다.
7. 온라인에서 승급/티켓 확인을 취소한 뒤에도 기권 진입점이 남아 있다(미확정 ④ 결정에 따른 자리).
8. 320 · 390 · PC 폭에서 가로 스크롤·겹침이 없고 누르는 곳이 44px 이상이다(상품 `[구매]` 32px은 현행 — 바꾸려면 Earth 규격).
9. S01(시작 상점) 화면과 #293/#294 AC의 기존 단언이 기대값 수정 없이 통과한다(7장 대체분 제외).
10. 서버·Core·data 파일 변경 0.

## 9. 다음 단계 담당

| 담당 | 일 |
|---|---|
| Mercury | 이 분석 + 다른 부서 분석 취합 → CJ 구현 전 최종 보고(승인 게이트) |
| Venus | 5.2 미확정 ①~⑥ 확정 · AC 확정(계약) |
| Earth | 모달 폭에서의 상단 한 줄/우측 열 배치 확인 — 새 토큰이 필요하면 그때만 |
| Mars | CJ 승인 뒤 5.1 구현 + 7장 검증 |
| Jupiter | **작업 없음**(②·공통 마감이 승인될 때만 생긴다) |
| Saturn | 읽기 전용 독립 QA |

## 10. 한계

- 정적 읽기만 했다. 실행·브라우저·테스트 0회 — [추론] 표시 항목(6.2의 거부 시 잔존, 6.3의 기권 버튼 누락, 6.4의 폭 계산)은 **재현으로 확인되지 않았다.**
- 회귀 파일의 영향 단언 위치는 검색어 일치 수만 봤다(`smoke_issue236` 22 · `293` 31 · `285` 9 · `238` 8 · `263_client` 8).
- `#overlayBox` 기본 CSS와 이모티콘 버튼 기본 위치는 이번 읽기에서 찾지 못했다.
- 루트 `CLAUDE.md`는 #293~#295·2026-10 항목 검색에서 일치가 없었고 전체를 다시 읽지 않았다. `WORKER_MODELS.md` · `QA_MINIMUM_POLICY.md`는 루트 사본을 읽었다.
- GitHub Issue #295 본문과 Notion GDD는 읽지 않았다(지시된 입력이 아님). QA PASS를 주장하지 않는다.
