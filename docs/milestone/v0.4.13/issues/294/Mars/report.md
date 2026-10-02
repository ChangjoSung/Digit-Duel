# #294 Mars(Client) 구현 보고 — 메인 화면 흐름 + 공용 신원 머리줄

- 2026-10-02 · Mars(Claude `claude-opus-5-5` high · Ponytail full) · dispatch `ctx_87838bfe38dc` / task `task_0f3fb4a1f1b1`
- 기준: [Venus 구현 계약](../Venus/implementation-contract.md) · [Earth UI_CONTRACT](../Earth/UI_CONTRACT.md) · [CJ 콘티](../references/CJ_CONCEPT_CONTI_20261002.png)(직접 확인)
- 상태: **구현 납품 · Mars 자체 검증까지.** Saturn PASS · CJ QA 가 아닙니다. Git 쓰기 · GitHub · Notion · 서버 파일 수정 없음.

## 1. 바꾼 것 (계약 장 번호)

| 계약 | 구현 | 파일 |
|---|---|---|
| 1 공용 신원 | `idHeadHtml` 한 부품을 준비(`flowHeadHtml`)와 메인(`renderBoardInfo`)이 같이 씀. 온라인은 `NET.players` · `NET.reps`만, 대표 없음 = 중립 아이콘 + 회색 테두리(`lobbyRepHtml` 을 부르지 않음), 보는 사람 기준 왼쪽 = 나. 신원 칸을 누르면 읽기 전용 표식 창(`idHelp`). 진행 표식 = 대표 20px + 나/상대(없으면 종전 글자) | `ui.js` · `game.css` |
| 2 상단 | 도구 줄(차례 · 선택 요약 · [설명] · 감정표현 자리 · ⚙) + 상태 네 칸. ⚙ = 기존 나가기 진입점(`uiBack` · `uiLeaveConfirm`) + 비활성 `사운드 · 환경설정 — 추후 제공` (`gearHtml` — 준비 화면과 공용) | `ui.js` · `game.css` |
| 3 공개 보드 시계 | `room_state.boardClock` 수신 · 검증(`NET.boardClock`: 없음 = `undefined`, `null`, 계약 4필드만 보관) → 시간 칸. 입력 잠금(`turnClockLate`) · 기존 `clock` 경로는 그대로. 없으면 내 차례 = 종전 표시, 상대 차례 = `확인 중` | `network.js` · `ui.js` · `contracts.d.ts` |
| 4 창 틀 | 바깥 탭 = 닫기만(`click` 캡처에서 삼킴 — 종전 `pointerdown` 닫기 대체) · 창 안 Tab 순환 · 모달이 열리면 닫힘 · 보드에서는 정기 상점/B08/턴이 바뀌어도 닫힘 · 대상 말이 죽거나 안 보이면 닫힘 | `ui.js` · `ui-overlays.js` |
| 4.1 설명 창 | `unitHelpPiece`(보드 말) · `unitHelpBag`(내 가방) · `unitHelpSlot`(진열). 창은 허용 필드로 만든 묶음만 받음 — 공개된 상대 말은 스킬 탭 자체가 없고, 미공개 `?` · 안 보이는 말은 열리지 않음. 진입: 선택 요약 [설명] · 상대 차례의 내 말 탭 · 공개된 상대 말 탭(토스트 대체) · 카드 그림 | `ui.js` · `ui-overlays.js` |
| 4.2 가방 창 | 서랍 윗부분 = `가방 n/3` + ✕ · 카드 3칸(빈칸 `+` 장식) · 아이템 8종. 명령 없음. Esc 로 닫힘 | `ui.js` · `index.html` · `game.css` |
| 5 시너지 열 | 메인도 `synRailHtml`(경기 중은 Core `synView`, 준비는 종전 `ecoSynView`). 전설 칩도 누르면 같은 창. 기여 목록에 `사망` · `가방` 꼬리표, 전투 중에는 명단 없음 | `ui.js` |
| 6 행동 줄 | 3×2. 닫힌 상점 = `상점` + `N턴 후 열림` / `예정 없음`(누를 수 없음) · `가방 n/3` | `ui.js` · `game.css` |

`core.js` · `data.js` · `lobby.js` · `server/*` · Earth/Venus 산출물은 수정하지 않았습니다.

## 2. 검증 — 실제 실행 결과

| 명령 | 결과 |
|---|---|
| `npm run typecheck` | exit 0 |
| `node demo/test/regression/smoke_issue293.js` | 122 passed / 0 failed (종전 109) |
| `node demo/test/regression/smoke_issue238.js` | 155 / 0 (종전 147) |
| `node demo/test/regression/smoke_issue263_client.js` | 186 / 0 (종전 174) |
| `node demo/test/regression/smoke_memo.js` | 128 / 0 (종전 122) |
| `node demo/test/regression/smoke_issue260.js` · `285` · `286` | 74 / 0 · 43 / 0 · 13 / 0 |
| 공용 하네스를 고쳤으므로 `demo/test/regression/smoke_*.js` 전체 1회 | 38개 중 37개 exit 0. `smoke_fx_timing.js` 는 일괄 실행에서 exit 2(D1~D6 · 실제 타이머 검사), **단독 재실행에서 82 / 0 exit 0** — 원인은 확정하지 못했습니다(부하에 민감한 실시간 검사로 추정) |

대체한 옛 기대값: 293 H11(가로 줄 → 세로 열) · 238 C1/C3(숫자 배지 · "더 열리지 않음" → `N턴 후 열림` · `예정 없음`) · memo D4/D11e(토스트 → 설명 창). 그 밖의 추가 단언: 신원 I1~I7, 기여 = 숫자 H13~H16(+ H13b 남은 시작 상점 값 무시), 가방 창 C2a~f, 상단 C4a/b, 보드 시계 L1~L12, 바깥 탭 D3e~g, 대상 사망 · `?` 말 D4x/D4y.

## 3. 화면 확인 — `evidence/` (36장 + `capture-log.json` · `tab-trap-log.json`)

설치된 Chrome headless 를 CDP 로 한 번 구동(`file://` · 서버 없음 · 새 의존성 없음). 320×640 · 390×844 · 1100×1000 각 12장.

**전부 합성 상태입니다.** 오프라인 PVE 엔진으로 실제 진행한 판에 온라인 표시 값(`NET.players` · `NET.reps` · `NET.boardClock` 등)을 주입해 그렸고, **실제 네트워크 경기 캡처가 아닙니다.** 그래서 상대 차례 장면의 차례 글자는 AI 표기(`🤖 …`)로 나옵니다(실제 온라인은 `상대 차례`).

실측(`capture-log.json`): 가로 넘침 없음(320/390/1100) · 대표 36px(32 + 테두리) 고정에 12자 이름만 말줄임 · 상태 칸 75×48 / 93×48 / 103×48 · 열 칩 13개 최소 44×44 · 행동 버튼 100~136 × 48 · [설명] 44×44 · 가방 카드 93~131 × 116 · 아이템 최소 높이 44. 실제 마우스/키 입력으로 확인: [설명] 클릭 → 창, 스킬 탭 전환, 창이 열린 채 ⚙ 탭 → 창만 닫히고 메뉴 안 열림 · 상태 불변, Esc → 닫힘 + 연 버튼으로 포커스, 가방 창 Esc, 새 경기 → 창 · 서랍 없음.

## 3.1 Mercury 중간 검토 반영

- `synContrib` 의 준비 미리보기 거름을 `S.phase==="setup"` 으로 한정 — 경기 중에는 남은 시작 상점 값과 무관하게 Core `synCount`(놓인 칸)와 같음(H13b).
- 설명 창의 Tab 순환을 **모든 맥락**(상점/전투 창 안 포함)에서 창 안으로 고정. 실브라우저 확인: 상점 본문(뒤에 버튼 14개) 위에서 Tab 6회 · Shift+Tab 모두 창 안, Esc 는 설명 창만 닫고 연 자리로 복귀(`tab-trap-log.json` · 합성 상태).
- `boardClock` 은 계약 4필드로 정규화 — 마감 · 서버 시각이 없으면 `null`(L12), 규격 밖이면 통째로 모름. 비경제 방(필드가 원래 없음)에는 `확인 중` 을 띄우지 않음.
- `onCell` 은 원문 그대로 두었습니다(주석 문제 해소 · memo D13 변이 앵커 유지). 상대 차례의 내 말 진입은 보드 칸 핸들러의 `ownInfoTarget`.

위 세 건 반영 뒤 재실행: typecheck exit 0 · 293 · 263_client · 238 · memo 모두 exit 0(나머지 파일은 다시 돌리지 않음).

## 3.2 후속 납품 (dispatch `ctx_f214a2003ab5` / task `task_2ec0efe69326`)

- **폭탄 · 함정 설명** — 기존 안내(`ui-overlays.js` `TUT_PAGES` "폭탄과 함정")의 이동 문장을 그대로 씀(`ui.js` `UNIT_NOTE`): 폭탄 `한 칸씩 움직일 수 있어요(버닝 타임엔 2칸).` · 함정 `스스로 움직일 수 없어요.` 새 규칙 문구 없음. 내 말과 공개된 상대 말 모두 같은 공개 문장.
- 단언 1개 추가: `smoke_memo` D4z — 창의 문장이 안내 원문과 글자 그대로 일치 · 종류 표시 · HP/스킬 탭 없음.
- 재실행(이것만): `npm run typecheck` exit 0 · `node demo/test/regression/smoke_memo.js` 129 / 0 exit 0. 다른 테스트 · 기존 36장 전체 재캡처는 하지 않았습니다.
- **캡처 교체/추가 5장 — 전부 합성**(오프라인 PVE 엔진 + 주입한 `NET` 표시 값 · `file://`). 구매 · 새로 고침 토스트(2300ms)가 스스로 사라질 때까지 2.8초 기다린 뒤 찍었고 제품 토스트 코드는 건드리지 않았습니다(`capture-followup-log.json` 에 `toasts:0` 기록).

| 파일 | PNG 실측 | 뷰포트 · 배율 | 내용 |
|---|---|---|---|
| `320-prep-place-header.png`(교체) | 640×1280 | 320×640 · 2 | 배치 머리줄 · 토스트 없음 |
| `390-prep-place-header.png`(교체) | 780×1688 | 390×844 · 2 | 같음 |
| `1100-prep-place-header.png`(교체) | 1100×1000 | 1100×1000 · 1 | 같음 |
| `320-prep-done-header.png`(신규) | 640×1280 | 320×640 · 2 | 준비 완료: 같은 대표 신원 · 표식 나 = 03 완료 / 상대 = 02 배치 · `준비 취소` 86×48 · 중앙 팝업 |
| `390-prep-done-header.png`(신규) | 780×1688 | 390×844 · 2 | 같음 |

다섯 장 모두 가로 넘침 없음 · 신원 줄 312/382/424 × 52 · 대표 36px. 증거 폴더는 이제 PNG 38장 + 로그 3개입니다.

## 3.3 Saturn REVISE 2건 수정 (dispatch `ctx_aa6fb9923005` / task `task_98cf8324f30c` · 기준 HEAD `757f45b` 위 미커밋 수정)

| REVISE | 원인 | 수정 (`demo/js/ui.js` 만) |
|---|---|---|
| 1 열 순서 | `synExtraChips` 가 전설 → 왕관 순으로 돌려줌 | 왕관 → 활성 전설로 순서만 바꿈. 호출자는 `synRailHtml` 하나(메인 · #293 준비 열 공용)라 한 곳에서 고쳐짐. 칩 수 · 숫자 원천(`synExtraView`) · 표시 조건 · 전투 창 칩은 그대로 |
| 2 가방 창 포커스 | `uiDrawer` 가 포커스를 옮기지도 돌려주지도 않았고 Tab 이 뒤 보드로 나감 | `uiDrawer` 한 곳에서 열 때 창 안 ✕ 로, 닫을 때(✕ · Esc · 바깥 · ←) 가방 버튼으로 포커스(`preventScroll`). 기존 안내 창 Tab 순환 핸들러를 가방 창에도 적용(안내 창이 열려 있으면 그것이 먼저 — Tab · Esc 모두 자식만). 전송 · 선택 · seq 변경 없음 |

`index.html` · `game.css` · 하네스 · Core · 서버는 수정하지 않았습니다.

- 단언 추가: `smoke_issue293` H6b(칩 순서 · 칩 수) · H11c(열 전체 순서) / `smoke_issue238` C2g~C2j(열 때 포커스 · Tab/Shift+Tab 가둠 · 자식 안내 Esc 우선 · Esc/✕ 복귀 · 상태 무변경). 238 의 스텁 문서는 `index.html` 을 파싱하지 않아 ✕ 와 카드 한 장을 테스트 안에서 꽂았습니다(선택자 자체는 아래 실브라우저 로그).
- 실행(수정 뒤): `smoke_issue293.js` 124 / 0 exit 0(1회) · `smoke_issue238.js` 159 / 0 exit 0 · `npm.cmd run typecheck` exit 0(테스트 수정 전후 2회). 238 은 **새 단언의 테스트 쪽 스텁을 두 번 고치느라 세 번 실행**했습니다(제품 코드는 그 사이 불변). 다른 회귀는 다시 돌리지 않았습니다.
- 실브라우저(설치된 Chrome headless · CDP · `file://` · 합성 오프라인 PVE 상태) — `evidence/qa-correction-log.json`:
  - 가방 창 키보드 흐름(390×844 · 320×640 · 320×420): 실제 마우스로 가방 버튼 → 포커스 `닫기`(창 안) · Tab 6회 + Shift+Tab 3회 전부 창 안(✕ · 카드 3장 순환) · 카드에서 Enter → 설명 창, 그 안에서 Tab 4회 + Shift+Tab 전부 설명 창 안 · Esc 1회 = 설명 창만 닫히고 연 카드로 · Esc 2회 = 가방 창 닫히고 가방 버튼으로 · Enter 로 다시 열고 실제 마우스 ✕ → 가방 버튼으로. 세 화면 모두 상태 서명(선택 · 차례 · 말 · 코인 · 가방 · 아이템 · 소켓 없음) 불변.
  - 긴 가방 스크롤: 320×420 에서 `#right` 가 418 > 317 로 넘치고 끝까지 스크롤됨(101) · Tab 으로 간 대상이 화면 안.
- 새 캡처 3장(**새 소스** = 이번 수정본): `320-` · `390-` · `1100-main-rail-crown-first.png` — 열을 끝까지 내려 왕관 → 사신(+5%) 순서가 보이게 찍음. 준비 화면은 활성 전설 칩을 만들 수 없어(`synExtraView.legends` 0) 찍지 않았고, 같은 `synRailHtml` 경로입니다.
- **종전 캡처는 `757f45b` 시점의 과거 기록입니다.** `*-main*.png` · `*-prep-*.png` 중 전설 칩이 보이는 장면은 열 순서(전설 → 왕관)만 지금과 다르고 다시 찍지 않았습니다. `*-main-bag*.png` 의 모양은 그대로입니다(포커스 동작만 바뀜).
- 자원: Chrome headless PID 33808 · 37584 · 36296 · 35276(포트 9383, 스크립트 재시도 포함) — 모두 종료 · 임시 프로필 삭제. 서버 · 새 의존성 없음. Git 명령 없음.

## 3.4 CI 통합 테스트 기대값 정정 (dispatch `ctx_a3e304b060e0` / task `task_04b308adc161` · 기준 HEAD `5bbfe5f`)

CI run `36912961602` 의 B 가 `demo/test/integration/smoke_public_eco_live.js` E15e · E15j 에서 실패했습니다(나머지 5개 job PASS).

- **원인 [확정 — 코드 읽기]**: 제품 결함이 아니라 **#263 시점의 옛 표시 기대값**입니다. E15e 는 기다리는 좌석의 `turnClockText("act")===""`, E15j 는 `(정지)` 를 기대했는데, #294 계약 3.1 · 3.2 로 서버(`room.js` `_boardClockView`)가 두 좌석에 `boardClock` 을 내리고 화면(`ui.js` `turnClockText` · `network.js` 수신)은 상대 차례에 `⏱ N초`, 정지 중 `⏱ 정지 · N초` 를 보입니다. 입력용 `clock` 은 종전대로 owner 전용입니다. 이 통합 파일은 첫 납품 때 제가 돌리지 않아(2장 목록에 없음) 놓쳤습니다.
- **수정 = 이 테스트 파일 하나.** 제품 소스 · Core · 서버 · 하네스 · CI 설정 · 의존성은 건드리지 않았습니다. CI 최초 47 PASS + 2 FAIL = 49개에 신규 5개를 더해 54개입니다(Mercury의 실행 로그/메타데이터 정정).

| 단언 | 종전 | 지금 |
|---|---|---|
| E15e | 기다리는 좌석 표시 `""` | `⏱ N초` 이고 `0 < N ≤ ceil(그 좌석 boardClock.leftMs/1000)` — 서버 값보다 큰 초를 지어내지 않음 |
| E15j | `/(정지)/` | 정확히 `⏱ 정지 · ${ceil(서버 잔여 ms/1000)}초` |
| E15c2(신규) | — | 같은 revision 의 두 좌석 `boardClock` 이 **4필드뿐**(`key` · `owner` 없음) · `running:true` · 같은 유한 `deadline` · 좌석별 `leftMs === deadline − serverNow` · 0 < leftMs ≤ 30000 |
| E15h2(신규) | — | 턴이 넘어간 뒤 두 좌석이 같은 새 마감(직전 마감보다 큼) · 넘긴 좌석의 `clock` 은 `null` |
| E15i2(신규) | — | 단절 정지: `running:false` · `deadline:null` · `leftMs` 가 owner `clock.leftMs` 와 같음 |
| E15m2(신규) | — | 1.2초 뒤에도 `boardClock.leftMs` · 화면 문자열 불변 |
| E15n2(신규) | — | 재개 뒤 재접속 좌석 포함 같은 `deadline` · 두 좌석 `leftMs ≤ 정지 잔여`(새 30초 아님) · 재접속 좌석 `clock` 은 `null` |

- 그대로 둔 것: E15b/c/g/h(owner 전용 `clock`) · E15f/o(로컬 마감 0) · E15i/k/l/m/n(30초 · 정지 · 유예 60초 · 잔여 재개) · E11/E11b/E16/E17(보안) 등 나머지 전부. 좌석 간 비교는 `deadline` · `running` 과 멈춘 `leftMs` 만 하고 `serverNow` · 흐르는 `leftMs` 는 좌석별 식으로만 검사합니다(계약 3.1 허용 오차) — 정규화 · 비교기 추가 없음. 좌석 비교 전 두 클라이언트가 같은 `revision` 프레임을 받을 때까지 기다립니다(테스트 안 한 줄 `sameRev`).
- 실행(수정 뒤 1회 · 이것만): `node demo/test/integration/smoke_public_eco_live.js` → **pass 54 / fail 0 · exit 0 · 16.8초**(자연 종료). 이 작업 트리에는 `server/node_modules` 가 없어 `NODE_PATH` = 원본 checkout 의 `server/node_modules`(기존 `ws`)와, 테스트의 절대 경로 `ws` 요청만 그리로 돌리는 **저장소 밖 임시 `-r` 스크립트**(세션 scratchpad)를 썼습니다. npm · typecheck · 다른 테스트는 돌리지 않았습니다. CI 는 `server/node_modules` 가 있어 이 우회가 필요 없습니다.
- 자원: 테스트가 띄운 서버 자식 프로세스(임의 포트 · 재시작 1회 포함)는 테스트의 `finally` 가 종료 — 실행 전후 `node` 프로세스 0개. 작업 트리에 새 파일 없음. Git 명령 없음.
- 이것은 Mars 자체 점검이며 **독립 QA PASS 가 아닙니다.** 5장의 "실제 `boardClock` 결합 · 실제 두 클라이언트" 중 시계 부분(값 · 정지 · 재개 · 표시)은 이 실서버 실행이 처음 확인했고, 신원 · 가방 · 설명 창의 실네트워크 확인은 여전히 없습니다.

## 3.5 CJ QA REVISE 2026-10-02 (dispatch `ctx_273570505c68` / task `task_5fdc9524524a` · 기준 HEAD `d20f312` 위 미커밋 수정)

- Mars(Claude `claude-opus-5-5` high · `--dangerously-skip-permissions` · Ponytail full · 세션 `e93e76c4` · PID 16156은 Mercury 확인값). 기준: [Venus 개정 계약](../Venus/implementation-contract.md) 1 · 2 · 4.1 · 4.2장, CJ 그림 `references/CJ_REVISE_20261002_1~4.png`(직접 확인).
- 상태: **구현 납품 · Mars 자체 검증까지.** Saturn PASS · CJ QA 가 아닙니다. Git · GitHub · Notion · 서버 · Core · 데이터 · 의존성 · 자산 변경 없음.

### 바꾼 것

| CJ 요구 | 구현 (`demo/js/ui.js` · `demo/css/game.css`) |
|---|---|
| (1) 상단 한 줄 50/50 | 새 `topBarHtml(p,tools)` 하나를 준비(`flowHeadHtml`)와 메인(`renderBoardInfo`)이 같이 씀. 왼쪽 = `idHeadHtml`(내 대표 · 이름 VS 상대 대표 · 이름), 오른쪽 = 준비: `#prepClock` · 코인 · ⚙ / 메인: 짧은 차례 문구 · 감정표현 자리 · ⚙. `.flowTop` · `.hudTools`(따로 떨어진 줄) 삭제. 격자 `repeat(2,minmax(0,1fr))`, 테두리는 안쪽 그림자라 폭을 먹지 않음 |
| 테두리 | 대표가 없어도 항상 내 파랑 `#5b8cff` / 상대 빨강 `#ff5b6e`(신원 칸 · 표식 창 `idCard` · 진행 표식). 대표가 없으면 종전 중립 프로필 아이콘 그대로 — 종을 지어내지 않음. 회색 `nt` 좌석 클래스 폐지 |
| 진행 표식 | `01 → 02 → 03` 위 표식 = `idFaceHtml(rep,"xs")` 얼굴뿐. `P1/P2` · 첫 글자 · `나/상대` 글자 없음(누구인지는 목록의 접근성 이름) |
| 이름 | 한 줄 말줄임(닉네임, 없으면 `나`/`상대`). 전체 이름은 좌석 버튼 접근성 이름 + `idHelp` 표식 창 |
| 차례 문구 | `내 차례` / `상대 차례` / `AI 차례`. 종전 긴 안내 문장은 같은 문자열 그대로 접근성 이름에만 |
| `설명` 버튼 | 상단 → 행동 줄(`renderTurnBar`) 첫 줄. 내 차례에 내 말을 골랐을 때만. 보드 탭 = 종전대로 선택 |
| (2) 가방 창 아래 삭제 | `renderSide` 경기 분기의 이름 머리 · 배지 줄(🎁 · ✨ · 전투 · 예비 하수인 · 주 행동 · 코인) · 선택 요약 · `자기 말을 클릭해 선택하세요` 삭제. 유지: `가방 n/3` · 카드 3칸 · 아이템 8종 · 텔레포트/도망/강제 전투 안내 · 추측 메모 목록 · ✕/Esc/Tab/포커스 |
| (3) 설명 창 한 장 | 탭(`uhTabs` · `unitTab`) 삭제. 머리줄 이름 ★등급 · ✕ / 왼쪽 큰 그림(기존 그림 104px) + 오른쪽 왕국 · 아키타입 아이콘, 기본 능력치 칸, 정보 줄, 개인 시너지 / 아래 스킬 줄 |

### 능력치 · 스킬 원천 (새 수치 없음)

| 칸 | 원천 | 비고 |
|---|---|---|
| HP · 공격력 · 방어력 · 속도 · 회피 · 치명타 · 상태 부여 확률 | 그 개체의 `hp/maxHp` · `atk` · `def` · `spd` · `dodge` · `crit` · `statusPct`(`data.js` `applyArchStats` · `applyFixedStats`가 넣은 값) | 이름표 = 기존 `SYN_STAT_KO`. 상태 부여 확률은 `+N%p`, 0이면 칸 없음. 필드가 숫자가 아니면 칸 없음. 시너지 · 전투 버프는 더하지 않음 |
| 진열 칸(개체 없음) | 구매 때 Core가 쓰는 `applySpecies` / `applyLegend`를 빈 객체에 호출해 읽음 | 표를 따로 베끼지 않음. HP는 최대만 |
| 명중 | **칸 없음** | 엔진에 명중 스탯이 없음(Venus 계약 [기획 필요]) |
| 개인 시너지 | `synExtraView(v,S).legends` 중 그 전설 | 문구는 시너지 열 전설 칩과 같은 `legendSynText`(공용으로 뺌). 일반 하수인 · 가방 · 진열은 없음 |
| 스킬 위력 · 쿨 · 1회 · 남은 쿨 | `SKILLS[id].pct`(v2만) · `cd` · `once` · 개체 `cds[i]` | `pct` 없으면 위력 칸 없음. 사신의 낫은 쿨 칸 없음(봉인형) |
| 스킬 ★ | `V2_SPECIES[종]`에서의 순서 = 열리는 등급 | 전설 · 왕 · 동료는 별 없음 |
| 스킬 글 | `SKILLS[id].desc` 원문 그대로, 기본기에는 붙이지 않음 | 줄여 쓰지 않음 |

### 비공개 경계

- 공개된 상대 말: `stats` · `syn` · `skills`를 `null`로 넘겨 구역 자체가 없습니다(오프라인 포함). 줄 목록은 종전 허용 값 그대로(등급 · 왕국 · 아키타입 · HP · 사망 · 이동 불가 · 교체 표식 · 안내 문구). 실브라우저 확인: 기기에는 상대 `atk 25 · def 5 · 스킬 1개`가 있었고 창 마크업에는 능력치 칸 · 능력치 이름 · 스킬 이름이 0건이었습니다.
- 미공개 `?` 말: 직접 불러도 창이 열리지 않습니다(종전 그대로).
- 읽기 전용: 창을 열고 닫는 동안 상태 서명(선택 · 차례 · 말 · 코인 · 가방 · 아이템 · 소켓 없음)이 세 화면 모두 같았습니다. `netAction` · seq · 시계 호출을 추가하지 않았습니다.

### 검증 — 실제 실행

| 명령 | 결과 | 횟수 |
|---|---|---|
| `npm run typecheck` | 1차 exit 2(`unitStatChips` 배열 타입 — `ui.js` 1492) → 타입 주석 하나 추가 뒤 exit 0 | 2 |
| `smoke_issue293.js` | 1차 123 / 1(I6 — **테스트 식 오류**: `<li` 속성 글자를 표식 글자로 셈) → 124 / 0 | 2 |
| `smoke_issue238.js` | 1차 163 / 1(C4c — **테스트 식 오류**: `who`에 접근성 이름이 붙은 것을 반영 못함) → 164 / 0 | 2 |
| `smoke_memo.js` | 129 / 0 | 1 |
| `smoke_turnflow.js` | 203 / 0 | 1 |
| `smoke_cycle5.js` · `smoke_minion_art.js` · `smoke_cross_skill.js` | 70 / 0 · 208 / 0 · 86 / 0 (삭제된 서랍 문구를 보던 단언을 치환한 파일) | 각 1 |
| `smoke_issue263_client.js` | 186 / 0 (`renderBoardInfo` 소비자 · 단언 수정 없음) | 1 |

- memo · turnflow · cycle5 · minion_art는 마지막 소스 수정(타입 주석 한 줄 — 동작 무변경) **전**에 돌렸고 다시 돌리지 않았습니다. 나머지 회귀 · 통합 · 서버 테스트는 돌리지 않았습니다(CI 6개가 전체를 봅니다).
- 치환한 옛 기대값: 293 I1 · I3 · I5 · I6 · I7 · H11b(신원 줄 → 한 줄 · 회색 → 색 · 글자 표식 → 얼굴) / 238 C2k · C2l · C4c~e 추가 / memo D4 · D4z · D11e · D11f(탭 → 한 장 · 능력치 값 대조) / turnflow A'6 · cross_skill E4 · minion_art K9b(선택 요약 → 설명 창) / cycle5 C3(예비 배지 → 없음). 지우거나 느슨하게 한 단언은 없습니다.

### 화면 — `evidence/revise-20261002/` (PNG 40장 + `capture-log.json` + `capture-script.js.txt`)

설치된 Chrome headless · CDP · `file://` · 서버/의존성 없음. **전부 합성 상태**(오프라인 PVE 엔진). 긴 이름 · 대표 · 내 좌석 1 장면은 `NET` 표시 값을 그 한 번의 호출에만 넣어 실제 부품 함수(`idHeadHtml` · `idFaceHtml`)의 마크업을 꽂은 것이고 실제 네트워크 경기가 아닙니다.

| 실측 (`capture-log.json`) | 320×640 | 390×844 | 1100×1000 |
|---|---|---|---|
| 상단 줄 수 · 폭 | 1줄 · 312 | 1줄 · 382 | 1줄 · 424 |
| 왼쪽 / 오른쪽 | 156 / 156 | 191 / 191 | 212 / 212 |
| 신원 칸(누르는 곳) | 65×44 ×2 | 82.5×44 ×2 | 93×44 ×2 |
| 대표 · 테두리 색 | 36×36 · 파랑/빨강 (PVE 중립 아이콘 포함) | 같음 | 같음 |
| ⚙ | 44×44 | 44×44 | 44×44 |
| 진행 표식 | 24×24 · 글자 없음 | 같음 | 같음 |
| 12자 이름 | 말줄임 · 접근성 이름에 전체 | 같음 | 같음 |
| 가로 넘침 | 없음 | 없음 | 없음 |
| `설명` 버튼 | 308×44 · 행동 줄 첫 줄 | 374×44 | 416×44 |
| 가방 창 아래 | `h2` 0 · 배지 0 · 안내 0 · 버튼 0 | 같음 | 같음 |

- 키보드(실제 키 입력): 설명 창 Tab ×3 · Shift+Tab 모두 창 안, Esc → 닫힘 + `설명` 버튼으로 복귀. 가방 창: Tab → 카드, Enter → 설명 창, Esc 1회 = 설명 창만, Esc 2회 = 가방 창 닫히고 가방 버튼으로. 진열 칸 설명도 Esc 뒤 연 그림으로 복귀.
- 감정표현 자리(`*-main-emote-slot-synthetic.png`): 오프라인에는 감정표현이 없어 방 표시 값만 잠깐 넣어 쟀습니다 — 버튼 44×44가 오른쪽 반의 빈 자리와 1px 이내로 겹칩니다. 이 장면의 이름 · 빈 시간 칸은 그 합성의 부산물입니다.
- 조건부 안내 유지(`390-bag-conditional-guidance.png`): 강제 전투 · 추측 메모 머리가 아이템 아래 그대로.
- 자원: Chrome headless PID 9968 · 1736(포트 9417) 외 실패한 첫 실행 1회 — 모두 스크립트가 종료 · 임시 프로필 삭제. 캡처 스크립트 원본은 세션 scratchpad, 사본이 `capture-script.js.txt`.

### 남은 위험 · 확인 못한 것

- **실제 온라인 경기 미확인**: 대표 그림 · 닉네임 · 내 좌석 1 · 감정표현 · 준비 완료 대기(`03`) 화면은 합성 또는 미촬영입니다(같은 `flowHeadHtml` 경로).
- **320px 이름 자리**: 좌석 한 칸 65px 중 이름은 약 25px이라 2글자 안팎에서 말줄임됩니다(Venus 계약 1장이 허용한 계산 그대로).
- **예비 하수인 HP**: 배지 줄과 함께 가방 창에서 사라졌고(계약 4.2 삭제 목록), 지금은 출전 선택 UI에만 나옵니다. 포획 하수인 · 회복 자세는 내 말 설명 창으로 옮겼습니다.
- **보호형 `shieldStartPct`**(전투 시작 방어막)는 계약 칸 목록에 없어 표시하지 않았습니다.
- **스킬 글**은 원문이라 위력 · 쿨이 칸과 글에 두 번 나옵니다(예: `💪🏻 180% / ⌛3 · 약화 70%`).
- 메인에서 말을 고르면 행동 줄이 한 줄(44px) 늘어 그만큼 말판 영역이 줄어듭니다.
- `demo/test/browser/run_public_e2e.js`의 `#boardInfo .who` 선택자는 그대로 동작하지만 그 파일은 돌리지 않았습니다.
- 사용량: 이 세션에서 토큰 수치를 잴 수단이 없어 기록하지 못했습니다.

## 4. 계약과 다르던 점 — Root(Mercury) 수용 완료

1. **`smoke_memo` D3 기대값 교체** — 계약 9장 대체 목록에는 없지만 4.1 표("상대 차례 · 내 말 → 설명 창")가 요구해 "차단 토스트"를 "설명 창 · 선택 없음 · 송신 0"으로 바꿨습니다.
2. **`demo/test/shared/harness.js` 수정** — 문서 스텁에 리스너 등록/직접 호출을 더하고 새 함수 7개를 노출했습니다. 지시된 소유 목록(회귀 파일)의 바깥이지만 바깥 탭 · 신원 단언에 필요했습니다.
3. **메인의 앱 줄(← · 로고) 숨김** — 콘티에 없고 세로 공간이 모자라 CSS 로 접었습니다. 나가기는 ⚙ 안의 같은 `uiBack`.
4. **보드에서는 턴이 바뀌어도 설명 창을 닫음** — 계약 4장 목록보다 넓습니다(지시의 "expiry" 반영).
5. **정지 문구가 두 가지** — `boardClock` 은 `정지 · N초`, 필드가 없을 때의 종전 `clock` 은 `N초 (정지)` 그대로(기존 263 단언 유지).
6. **320×640 은 말판이 세로 스크롤** — 칸 32px 하한(#286)에서 13행이 한 화면에 들지 않습니다. 390×844 · PC 는 한 화면.

1~6 은 후속 dispatch 에서 Root 가 그대로 수용했습니다(추가 조치 없음). 종전 7번(폭탄 · 함정 설명 [기획 필요])은 제 조사 누락이었고 기존 안내 문장 재사용으로 해소했습니다(3.2).

## 5. 확인하지 못한 것

- 최초 납품에서는 Jupiter의 실제 `boardClock` 결합·두 클라이언트 네트워크 경기를 검사하지 않았습니다. 3.4의 실서버 시계·정지·재개 검사는 후속으로 완료했으며, 신원·가방·설명 창의 실네트워크 플레이는 CJ QA 대기입니다.
- 정기 상점(모달) 안의 설명 진입은 같은 코드 경로지만 화면 캡처는 하지 않았습니다.

## 6. 남긴 자원

- `node_modules/`(gitignore 대상) — `npm ci` 로 `package.json` 에 고정된 기존 `typescript 5.9.3` 만 설치(typecheck 실행용).
- Chrome headless PID 28196 · 20892(포트 9377) · 28256(포트 9378) · 41520(포트 9379 · 후속 캡처) — 스크립트가 종료 · 프로필 폴더 삭제. 로컬 서버는 띄우지 않았습니다.
- `smoke_orientation_audit.js` 가 내부에서 git 읽기를 한 번 수행합니다(테스트 자체 동작 · 제가 직접 실행한 Git 명령은 없음).
