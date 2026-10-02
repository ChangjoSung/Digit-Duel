# #295 턴 상점 — Mars 구현 보고 (2026-10-02)

- 역할 5필드: required_role=Mars · mode=IMPLEMENT · area=Client · mutation=code · instance_index=null
- 실행값: Claude `claude-opus-5-5`(세션 표기) · effort high / bypass는 기동 인수 기준(Mercury가 영수증으로 확인 — 세션 안에서는 직접 볼 수 없음) · Ponytail full · 세션 `81993798-4ea5-479a-aac8-59ce4b9a51ac`
- dispatch `ctx_47de689412aa` / task `task_2b34436385ae` · WT `issue-295-turn-shop` · Git/GitHub/Notion 쓰기 0 · 하위 Worker 0
- 권위: [`CJ_IMPLEMENT_APPROVAL_20261002.md`](../references/CJ_IMPLEMENT_APPROVAL_20261002.md) · [Venus 구현 계약](../Venus/implementation-contract.md) · [Earth UI_CONTRACT](../Earth/UI_CONTRACT.md) · Mercury IMPLEMENT_GO(04:16:49Z)
- 상태: 구현 + 자체 검증까지. **QA PASS 주장 아님** — Saturn 독립 QA · CJ 플레이 QA 대기.

## 1. 바꾼 것

| 파일 | 내용 |
|---|---|
| `demo/js/data.js` | `ECO.shopSec` 90 → **180**(상수 하나 · 서버 공용) + 주석(1인 180초 · 순차 최대 360초). `prepSec` 180 그대로 |
| `demo/js/ui.js` | `shopHtml` 정기 분기: 옛 `.shopHead` → `topBarHtml`(신원 50% / `#shopClock` · 내 코인 · ⚙ 50%) + `.flowBar`(`N턴 상점` · `완료`) + `synRailHtml` + `.secHead`(하수인 구매 · 새로 고침). 본문 시너지 줄 `shopSynHtml` 삭제. 왕·동료 = 3줄 × 속성 5(제목 줄 `🎟 ×N`) → `__shop('ticket',말,속성)` → 기존 확인 창 1회 → 기존 `shopTicket`(티켓 0 · 사망 · 현재 속성은 `disabled` + 사유). `완료`는 판매와 같은 연타 잠금. `shopWaiting` · `readyPopHtml` · `shopWaitPopHtml` 추가 — 경기 전 대기 팝업도 같은 `readyPopHtml`을 쓴다. 대기 중 말판 상단(`renderBoardInfo`)은 신원 + ⚙ 기권만. 옛 "90초" 주석 5곳 정정 |
| `demo/js/network.js` | `netOverlayWanted`: 내 완료 뒤(`shopWaiting`)는 `none` → 기존 none 경로가 시트·열린 확인 창·시계를 치운다. `netRenderEcoOverlay`: 옛 "🛒 상점 완료" 대기 창과 시트 밑 기권 버튼 제거(기권은 `shopHtml` 안 ⚙) |
| `demo/css/game.css` | 옛 `.shopHead` 규칙 삭제 · 턴 상점 절 추가(시트 폭 = 화면/프레임 432 · 머리 sticky · 열 매달기 · ≤360 보정) · `.readyPop small` 11 → 12px(Earth "12px 이상" — 경기 전 자동 배치 문구도 1px 커진다) |
| 회귀 | `smoke_issue236.js`(Q 절 180초 경계 · 티켓 미확정 창 진입 경로) · `smoke_issue293.js`(E21 대체 + E21b~g · T1~T3 구조 · W1~W7 대기 팝업) · `integration/smoke_public_eco_live.js`(E21 한 건 — 대기 창 문구 대신 창 닫힘 + 말판 상단 ⚙ 기권) |

`flowHeadHtml` · `#prepClock` · 01/02/03 단계 · 무료 속성 변경은 가져오지 않았다. 새 의존성 · 경로 · 자산 · 서버 필드 · 상태 0. 서버 파일 수정 0.

## 2. 계약에서 좁힌 것 [확정 해석 아님 — Mars 선택, CJ/Venus가 고칠 수 있음]

- 대기 문구: `내 구매 완료 · 상대 기다리는 중…` / `상대가 아직 상점에서 구매 중입니다. 끝나면 바로 경기로 돌아갑니다.` 단절 정지 중(`netPaused`)에는 `내 구매 완료 · 연결 대기 중` / `연결이 끊겨 경기와 상점 시간이 멈춰 있습니다. 연결이 돌아오면 이어집니다.` — 상대가 구매 중이라고 말하지 않는다. Earth의 "상대 상태 확인 중" 셋째 문구는 넣지 않았다(그 상태를 가리키는 별도 서버 값이 없고 재접속 중은 `netPaused`에 포함된다).
- 대기 중 기권 자리: 단계 `shop`에서는 종전에 말판 상단·행동 줄이 비어 있었다 → 상단 한 줄(신원 · `N턴 상점` · ⚙ 기권)만 그린다. 시계·코인·상대 정보는 없다.
- 오프라인(PVE·핫시트) ⚙에는 나가기를 새로 만들지 않았다(종전에도 없었다 — 사운드 자리만).
- 시너지 열 값: 단계 `shop`에서는 종전 시트와 같은 `ecoSynView`(티켓 확정 직후 반영).

## 3. 검증 (각 명령 실행 횟수 포함)

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | 1차 실패 — WT에 `node_modules`가 없어 `tsc` 미설치(코드 원인 아님). `npm ci`(잠금 파일 그대로 · gitignore 대상) 뒤 2차 **통과** |
| `node demo/test/regression/smoke_issue236.js` | 1회 — **pass 299 / fail 0** |
| `node demo/test/regression/smoke_issue293.js` | 1차 실패 — 내가 쓴 새 단언이 하네스가 내보내지 않는 함수를 불렀다(테스트 작성 오류). 렌더된 마크업을 보도록 고친 뒤 **140 passed / 0 failed**. CSS 보정 뒤 1회 더 — 같은 결과 |
| `node demo/test/regression/smoke_issue238.js` | **181 passed / 0 failed**(CSS 보정 뒤 1회 더 — 같은 결과) |
| `node demo/test/regression/smoke_issue263_client.js` | 1회 — **pass 186 / fail 0**(기대값 수정 없음) |
| `node demo/test/integration/smoke_public_eco_live.js` | 1차 실패 — `server/node_modules/ws` 없음(환경). `server`에서 `npm ci` 뒤 **pass 54 / fail 0**(실서버 2클라이언트 · 정기 상점 완료 → 대기 → 재개) |
| `smoke_issue285.js` | 실행 안 함 — 상품 선택자 · 44px 경로를 바꾸지 않았다 |

180초 경계(236 Q절): PVE 90초·179.999초 진행 중 → 180초 만료(확정 볼 구매 보존 · 열린 티켓 확인 창 취소 · 티켓 그대로) / 핫시트 두 좌석 각각 `⏱ 180초`에서 시작 · 가림 불산입 · 90초·179.999초 진행 중 → 180초 만료 · 먼저 끝낸 좌석의 옛 시계가 다음 좌석을 끝내지 않음. 규칙 단언은 약화하지 않았고 바꾼 기대값은 90→180 · 티켓 창 진입 경로 · 대기 화면 세 가지뿐이다.

## 4. 화면 증거 — `evidence/` (Orca 내장 브라우저 · `file://` · 1세트 · 탭 닫음 · 리스너 0)

`320-` · `390-` · `1100-turn-shop(.png / -bottom.png)` · `390-turn-shop-detail-8stat.png` · `320-` / `390-turn-shop-wait.png` · `390-turn-shop-wait-gear.png`

- 실측: 상단 한 줄 반반(390: 177/353 · 320: 142/283 · PC: 205/410) · 가로 넘침 0 · 시계/코인 잘림 없음 · 열 마지막 칩 도달(열 안 스크롤) · 390 · PC에서 44px 미만 0개 · 8스탯 4×2 + 잠긴 스킬 유지 · 대기 팝업은 `#left` 가운데 1개(본문 12px), ⚙ 안 기권.
- 비교 기준: `294/Mars/evidence/320-prep-done-header.png`(경기 전 팝업) — 같은 상자 모양 확인. `293/Mars/12-shop-desktop.png`와의 화소 비교는 하지 않았다(눈 비교뿐).

## 5. 한계 — 숨기지 않는다

- **대기 팝업 · 이모티콘 화면은 합성 상태다**: 오프라인 PVE 판에 `NET.publicMode` · 방 상태 · `shop.done`을 직접 세워 그렸다(실제 `#emoteLayer` · `body.emoteOn` 배치는 살아 있다 — 7장). 실제 온라인 경로는 통합 스모크(스텁 DOM)로만 지났고 실브라우저 2클라이언트 화면은 찍지 않았다.
- 승급 배지(`★1 → 2`)가 붙은 진열 줄이 한 줄 더 높아진다 — 종전 규칙 그대로이며 손대지 않았다.
- 완료 연타 잠금은 판매와 같은 방식(같은 revision · 같은 요청 1회)이라, 서버가 완료를 거부하고 상태가 그대로면 다음 상태 갱신까지 다시 눌리지 않는다. 시작 상점의 `다음 단계`도 같은 경로다.
- 서버 측 180초 · 단절 정지 · 재접속 남은 값 · 좌석 뷰 비공개 확인은 Jupiter 몫이며 여기서 보지 않았다(통합 스모크 통과가 전부).
- WT에 `node_modules/` · `server/node_modules/`가 생겼다(`npm ci` · gitignore 대상 · 잠금 파일 변경 없음).

## 7. 후속(2026-10-02 · dispatch `ctx_b985affeb216` / task `task_3f36b9f489cf`) — 320 왕·동료 속성 버튼 44px

- 실행값: Claude `claude-opus-5-5`(세션 표기) · high/bypass는 Mercury 확인값 · Ponytail full. 수정 파일은 `demo/css/game.css` 하나(턴 상점 전용 `.shopSheet.turn` 규칙 4줄) — JS · 테스트 · 시작 상점 규칙 변경 0.
- 고친 것: 왕·동료 속성 버튼에 `min-width:44px`를 걸고 모자라는 폭은 말 그림 칸이 줄어서 낸다(≤360에서는 시너지 열 자리 48 → 46px). 종전 한계 "320에서 42×44"는 **해소** — 아래 실측.
- 실측(Orca 내장 브라우저 · 이모티콘 층 켜짐 · 탭 닫음 · 리스너 0):

| 폭(실제 내용 폭) | 속성 버튼 최소 | 말 그림 칸 | 44px 미만 대상 | 가로 넘침 · 잘림 | 이모티콘 버튼 ↔ 시트/상단 한 줄/완료 |
|---|---|---|---|---|---|
| 320 (305 — 세로 스크롤 막대 15px) | **44.0 × 44** (15개) | 26px | 0 | 없음 | 겹침 없음 — 이모티콘 y 0~48 · 시트 y 112~ · 완료 y 174~218 |
| 390 (375) | 48.2 × 44 | 44px | 0 | 없음 | 겹침 없음 — 시트 y 120~ |
| PC 1100 | 59.6 × 44 | 44px | 0 | 없음 | 겹침 없음 — 시트 y 122~ |

- 대기 팝업(같은 세 폭): `#left` 안 1개 · 잘림 없음 · 이모티콘 버튼과 겹치지 않음(320: 팝업 y 283~397 · 이모티콘 y 8~52).
- **남은 것 — 고치지 않고 보고한다**: 대기 중 말판 상단에서 이모티콘 버튼과 ⚙가 **4px 겹친다** — 320(실폭 305) x 215~259 ↔ 255~299, 390(실폭 375) x 285~329 ↔ 325~369. PC(스크롤 막대 없음)는 4px 떨어져 있다(668~712 ↔ 716~760). 원인은 이모티콘 층이 `100vw`(스크롤 막대 포함) 기준으로 놓이는 기존 전역 규칙이며, **같은 조건의 기존 #294 경기 말판은 더 크게 겹친다**(이모티콘 215~259 ↔ ⚙ 240~284 = 19px · 시너지 열이 있는 배치). 막대가 폭을 먹지 않는 실제 기기에서는 계산상 4px 떨어지나 실기기 미확인. 고치려면 #294 말판 공용 규칙을 건드려야 해 이번 좁은 범위 밖으로 두었다 — Mercury 판단 필요.
- 검사(CSS 변경 뒤 각 1회 · 같은 명령에서 종료 코드 확인): `node demo/test/regression/smoke_issue293.js` exit 0 — **140 passed / 0 failed** · `node demo/test/regression/smoke_issue238.js` exit 0 — **181 passed / 0 failed**. typecheck · 236 · 263_client · 통합은 JS 무변경이라 다시 돌리지 않았다.
- 증거: `evidence/320-` · `390-` · `1100-emote-turn-shop-leaders.png` / `-emote-turn-shop-wait.png`(6장). 앞 장의 `320-turn-shop*.png`는 이 보정 전 화면이다.
- QA PASS 주장 아님.

## 6. 다음

Mercury 고정 SHA → Saturn 읽기 전용 QA → CJ 플레이 QA. Mars 추가 작업 없음(REVISE 대기).
