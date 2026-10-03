# #293 CJ QA REVISE 추가 4건 — Mars 화면·키보드 증거 (2026-10-02)

- dispatch `ctx_8ddb55c00a02` / task `task_ecc6021abe21` · role5: Mars / IMPLEMENT / CLIENT_TOOLING / code+docs / null · Claude `claude-opus-5-5` high bypass(루트 확인) · Ponytail full
- 계약: [Venus 구현 계약 9장](../../Venus/implementation-contract.md) · 원본 이미지: [CJ 4건](../../references/CJ_QA_REVISE4_20261002.md)
- 방법: `python -m http.server 8293 --bind 127.0.0.1 --directory demo`(리스너 PID 34524 — `taskkill`로 종료, 8293 LISTENING 0 확인) + Orca 내장 브라우저 탭 `http://127.0.0.1:8293/index.html`(page `7a1288af…` → 다시 만든 `a117e63a…`, 둘 다 닫음). 명령: `viewport --mobile` · `eval` · `snapshot` · `click` · `keypress` · `screenshot`. Git·새 테스트·헬퍼 파일·의존성·자산 0.
- **전부 로컬·합성 상태다.** 계정 서버가 없어 `_acctStartMode("pve")`로 열고 기존 전역(`dispatchCoreAction` · `ecoShopOpenState` · `shopShow` · `render`)으로 상태를 심었다.
  - 시작 상점: 실제 구매 7회(필드 6 + 가방 1) → 🪙2.
  - 정기 상점: `shopTimeout`+`auto`+`setupDone` 뒤 `S.turnCount=20; S=ecoShopOpenState(S,0)` · 코인 9 · AI 좌석 완료를 손으로 넣은 **모의 20턴 상점**.
  - 입력 잠금: `MSGPLAYING=true`를 손으로 넣어 `fxLocked()`를 참으로 만든 **모의 잠금**(실제 단절·서버 없음).
  - 키 도착 확인용으로 페이지에 `keydown` 기록 리스너 1개를 `eval`로 넣었다(저장 파일 없음, `isTrusted=true` 확인용).
- 키·클릭은 Orca 페이지 API의 실제 입력(`keypress` · `click @ref`)이다. `eval`의 `.click()`은 촬영용 상태 만들기에만 썼다.

## 결과 (390×844 · 320×693, `--mobile`)

| 항목 | 실측 |
|---|---|
| 설명 팝업 구성 | 시너지 안내와 같은 틀(`#synHelp.synHelp` `role="dialog"` 금색 테두리 `rgb(255,214,107)`). 머리줄 아이콘+이름 · ✕ 44×44 / 본문 왼쪽 아이콘 64×64 · 오른쪽 위 이름 16px + 코인 가격 · 아래 설명 14px. 구매 버튼·보유·[취소] 문구 없음. 가로 넘침 없음(390=390 · 320=320) |
| 문구 8종 | 정기 상점에서 8개 모두 열어 읽음 — 이름·가격(수호자 3종 3 · 나머지 1)·설명이 계약 9.3 표와 같다 |
| 가격·활성 | 시작 상점 🪙2: 5종 `구매 🪙1` 활성 · 수호자 3종 `구매 🪙3` 비활성. 정기 상점 🪙9: 8종 모두 활성, 버튼 64~65×44 |
| 맨 아래 설명 줄 | `#goodDesc` 없음(두 상점) |
| 팝업 ✕(실제 클릭) | 팝업만 닫히고 누른 아이콘으로 포커스 복귀. 정기 상점은 그대로 열려 있음 · 코인 무변경 |
| 팝업 Esc(실제 키) | 같다 — 정기 상점 창은 닫히지 않는다 |
| 팝업 Enter(실제 키) | 아이콘에 포커스 두고 Enter → 팝업 열림, 포커스 ✕ |
| 교체 창 | 제목 + ✕ + 카드 6장. 맨 아래 버튼 0개 · "취소" 글자 없음. 열리면 첫 카드에 포커스 |
| 교체 창 Tab(실제 키) | 카드 6 → ✕ → 첫 카드로 돌아옴(8회 모두 창 안) · Shift+Tab 역방향도 창 안 |
| 교체 창 Esc / ✕ | 둘 다 닫힘 · 상태 서명(`S.pieces`+`S.eco`) 무변경 · 포커스가 누른 [교체]로 복귀 |
| 잠금 중 Esc / ✕ | 모의 잠금(`fxLocked()=true`)에서도 둘 다 닫힘 · 상태 무변경 · [교체]로 복귀 |

CJ 이미지 2 대조: 아이콘 왼쪽 · 이름+가격 오른쪽 위 · 설명 그 아래 · 시너지 창과 같은 틀 · ✕ 우상단 — 일치. 판정은 하지 않는다(Saturn·CJ 몫).

## 발견 → 수정 1건

- 설명이 낱말 중간에서 끊겼다(320: "1라 / 운드에만", "최대 / 치"). `demo/css/game.css` `.goodHelp .desc`에 `word-break:keep-all` 한 선언 추가(준비 팝업과 같은 방식). 수정 뒤 `node demo/test/regression/smoke_issue293.js` 1회 → 108 passed / 0 failed. 팝업 PNG는 수정 뒤 다시 찍은 것이다.

## 파일 (sha256 앞 16자 · 바이트)

| 파일 | 내용 | 해시 |
|---|---|---|
| `r4-item-popup-390.png` | 시작 상점 · 시간의 수호자 팝업 | `76b2f0a221300342` · 108,038 |
| `r4-item-popup-320.png` | 같은 팝업 320 (설명 3줄, 낱말 단위) | `232d9ecca6781fc2` · 78,981 |
| `r4-regular-shop-popup-390.png` | 모의 20턴 상점 위 팝업(시작 상점에서 열어 둔 것이 남은 상태 — 아래 한계) | `94f7c4902651cab6` · 91,092 |
| `r4-regular-shop-popup-320.png` | 같다 320 | `1fe0f2744778355a` · 65,268 |
| `r4-regular-shop-goods-390.png` | 모의 20턴 상점 상품 8칸 — 1·1·1·1·1·3·3·3 | `943752d90693fe7f` · 86,596 |
| `r4-regular-shop-goods-320.png` | 같다 320 | `b36fc0956d0de274` · 62,785 |
| `r4-swap-modal-390.png` | 교체 창(취소 없음) — CSS 수정 전 촬영, 수정은 이 창과 무관 | `87d6c202eea026ef` · 83,134 |
| `r4-swap-modal-320.png` | 같다 320 | `1eef766a9a36df90` · 68,145 |

소스 해시(미커밋 작업 트리): `game.css` `149dc94080b40877` · `ui.js` `3d28fec2baaf6c36` · `ui-overlays.js` `0b216afb342e5cf7` · `network.js` `b9bc955c26719e04` · `core.js` `80e0aed92efd4241` · `data.js` `ddc4ea6ad937df32`.

## 한계

- 실제 서버·두 번째 플레이어·실기기 없음. 두 실브라우저 사람 PASS가 아니다. 단절 뒤 방 나가기(AC17)는 이번에 화면으로 다시 보지 않았다 — 기존 자동 단언 F22만 있다.
- 잠금은 `MSGPLAYING` 모의다. 실제 단절 정지에서는 X01이 아래 화면을 `inert`로 덮으므로 그 조합은 보지 않았다.
- 팝업은 화면 아래에 고정돼(시너지 창과 같은 자리) 열려 있는 동안 상품 줄의 [구매] 버튼을 가린다 — 닫으면 보인다. 위치를 바꾸지 않았다(틀 재사용 계약).
- 정기 상점에서 팝업이 열린 채 Tab을 누르면 포커스가 뒤 상점 버튼으로도 간다(창 밖으로는 안 나감 — 시너지 안내와 같은 기존 동작).
- 시작 상점에서 열어 둔 팝업은 `#app`에 붙어 있어, 합성으로 판을 새로 만들어도 남았다(`r4-regular-shop-popup-*`가 그 상태 — **수정 전 기록**).
  - **후속(dispatch `ctx_62e2985b7790`)에서 고쳤다**: 상점 완료 · 준비 만료 · 새 판 · 정기 상점 창 닫힘에서 팝업이 함께 닫힌다(`uiApply` 화면 전환 · `gameReset` · `modal`/`closeModal`에서 `synHelpClose` 재사용). 근거는 헤드리스 단언 `smoke_issue293` C'9(수정 전 108/1 → 뒤 109/0) · `smoke_issue238` 147/0 · typecheck exit 0 — 상세는 [구현 보고 4b](../qa-revise4-implementation.md). **이 수정 뒤 화면 재촬영은 없다**: 위 PNG·소스 해시는 수정 전 기준이고, 현재 `ui.js` `f78c63a6f201f6b5` · `ui-overlays.js` `2f7553dec1869281` · `smoke_issue293.js` `134d2ca6f0f7a47a`(나머지 무변경).
- 내장 브라우저 입력은 탭에 실제 클릭이 한 번 들어간 뒤에만 도착했다(새로 고침 직후 `keypress`·`click`이 조용히 무시됨 — 도구 쪽). 그 구간의 결과는 버리고 다시 했다. 준비 180초가 지나 창이 닫힌 1회도 버렸다.
- 대비율 측정 없음. 데스크톱 폭 없음.
