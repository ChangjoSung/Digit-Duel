# #295 후속 — 말판 상단 이모티콘 ↔ ⚙ 겹침 수정 (Mars)

- 2026-10-02 · dispatch `ctx_fc5386b53a15` / task `task_7ad4978b67cc` · Mars(Claude `claude-opus-5-5` · effort high · Ponytail full)
- 범위: `demo/css/game.css` 2줄 · `demo/js/ui.js` `emoteSync` 3줄. 서버 · 테스트 · 마크업 · 아트 · 의존성 변경 없음. QA/CJ 통과를 주장하지 않는다.

## 1. 원인 [확정 — 실측]

이모티콘 버튼은 `#app` 밖의 고정 층(`#emoteLayer`)에 있고, 말판 상단 한 줄(`.topBar > .tbTools`)에는 그 자리를 비워 둔 `.emoSlot`(44px)만 있다. 버튼을 그 자리에 올리는 값이 **고정 `right:54px`** 였다. 두 가지가 어긋났다.

1. 층 폭이 `min(100vw,var(--frame))` — `100vw`는 페이지 세로 스크롤 막대(15px)를 포함해 층이 `#app`(`width:100%`)보다 15px 넓고 7.5px 밀린다 → 대기 화면 4px 겹침(320·390).
2. 말판 `#screenBody`(overflow-y:auto)에 **안쪽 스크롤 막대**가 생기면 ⚙ · 자리가 15px 더 왼쪽으로 간다 → #294 경기 말판 19px 겹침. 고정 층의 고정 px 는 이 폭을 알 수 없다.

## 2. 고친 것

| 파일 | 내용 |
|---|---|
| `demo/css/game.css` `#emoteLayer` | `width:min(100vw,…)` → `min(100%,…)` — 층 = `#app` 상자(모든 화면 공통. 종전 준비 화면에서도 버튼 오른쪽 끝이 320 실폭 305 밖 308.5 까지 나가 있었다) |
| `demo/css/game.css` 말판 버튼 규칙 | `right:54px` → `right:var(--emoR,54px)` |
| `demo/js/ui.js` `emoteSync()` | `#boardInfo .emoSlot` 의 실제 오른쪽 끝을 재어 층에 `--emoR` 로 준다(자리 없으면 비움 → CSS 기본값). 기존 호출 경로(render · resize) 그대로 |

순수 CSS 로 끝내지 않은 이유: 안쪽 스크롤 막대 폭은 다른 컨테이너(고정 층)의 CSS 에서 알 수 없다. CSS anchor positioning 은 층의 `transform` 포함 블록 때문에 `#app` 안 자리를 앵커로 받지 못하고 지원 범위도 좁아 쓰지 않았다.

바꾸지 않은 것: `.topBar` 50/50 · 아이콘 · 동작 · 마크업 · 줄 수 · 메뉴 · 상태 · 비공개 경계. 전투/상점 창이 열린 동안의 종전 자리(`right:4px` · 실측 x 253~301 / 실폭 305) · 대기방(`inRoom`) · 준비 화면 규칙은 `--emoR` 를 읽지 않는다.

## 3. 실측 (Orca 내장 브라우저 · `file://` · 실제 `#emoteLayer` · `body.emoteOn`)

합성 상태다: 로컬 2인 판을 자동 배치로 시작한 뒤 `S.eco` · `NET.publicMode` · 방 상태를 직접 세웠다(대기는 `phase=shop` · `shop.done=[true,true]`). 실제 온라인 2클라이언트 화면은 찍지 않았다.

| 조건 (실폭) | 화면 | 이모티콘 x | ⚙ x | 간격 (수정 전) |
|---|---|---|---|---|
| 320 (305 · 페이지 막대) | 경기 · 대기 | 208~252 | 255~299 | **3px** (−3.5) |
| 320×480 (305 + 말판 안쪽 막대) | 경기 | 193~237 | 240~284 | **3px** (−18.5) |
| 390 (375) | 경기 · 대기 | 278~322 | 325~369 | **3px** |
| 390×480 (375 + 안쪽 막대) | 경기 | 263~307 | 310~354 | **3px** |
| PC 1100 (막대 없음) | 경기 · 대기 | 669~713 | 716~760 | **3px** |
| 320 막대 없음 (`scrollbar-width:none` 주입 · 실폭 320) | 경기 · 대기 | 223~267 | 270~314 | **3px** |

- 모든 조건에서 버튼이 `.emoSlot` 과 정확히 같은 x(차이 0) · 간격 3px = `.tbTools` 의 gap 그대로.
- 버튼 최소 44×44(상단 · 행동 줄 전체) · 가로 넘침 없음(문서 scrollWidth = 실폭) · 시너지 열 마지막 칩은 열 안 스크롤로 닿는다(종전과 같음).
- 320×480 + 안쪽 막대에서는 오른쪽 절반이 141px 라 차례 문구 칸이 41px 로 줄고 이름이 말줄임된다 — 자리(.emoSlot)는 종전에도 같은 폭을 차지했으므로 이번 변경의 결과가 아니다.

증거: `evidence/emote-anchor/` — `320-play` · `320-play-inner-scrollbar` · `390-play` · `1100-play` · `320-wait` · `390-wait` · `1100-wait` · `320-noscrollbar-wait` (.png 8장). 탭 닫음 · 리스너 0.

## 4. 검증 (각 1회)

- `node demo/test/regression/smoke_issue293.js` — 140 / 0
- `node demo/test/regression/smoke_issue238.js` — 181 / 0
- `node demo/test/regression/smoke_issue262.js` — 55 / 0 (`emoteSync` 를 건드려 coordinator 지시로 추가 1회 · K15 `inRoom` 계약 그대로)
- `npm run typecheck` — 오류 출력 0
- 다시 돌리지 않음(의미 불변 · 지시): 236 · 경제 · 타이머 · 통합.

## 5. 한계

- 실기기 · 실제 온라인 2클라이언트 미확인(합성 상태 1세트).
- 턴 상점 창 머리줄 · 완료 · readyPop 은 규칙을 건드리지 않아 다시 재지 않았다(창이 열린 동안의 버튼 자리만 확인).
- 320 에서 페이지 세로 막대가 생기는 원인(문서 높이 1px 초과)은 범위 밖이라 그대로다.
