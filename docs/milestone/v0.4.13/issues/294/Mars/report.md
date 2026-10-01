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

## 4. 계약과 다르던 점 — Root(Mercury) 수용 완료

1. **`smoke_memo` D3 기대값 교체** — 계약 9장 대체 목록에는 없지만 4.1 표("상대 차례 · 내 말 → 설명 창")가 요구해 "차단 토스트"를 "설명 창 · 선택 없음 · 송신 0"으로 바꿨습니다.
2. **`demo/test/shared/harness.js` 수정** — 문서 스텁에 리스너 등록/직접 호출을 더하고 새 함수 7개를 노출했습니다. 지시된 소유 목록(회귀 파일)의 바깥이지만 바깥 탭 · 신원 단언에 필요했습니다.
3. **메인의 앱 줄(← · 로고) 숨김** — 콘티에 없고 세로 공간이 모자라 CSS 로 접었습니다. 나가기는 ⚙ 안의 같은 `uiBack`.
4. **보드에서는 턴이 바뀌어도 설명 창을 닫음** — 계약 4장 목록보다 넓습니다(지시의 "expiry" 반영).
5. **정지 문구가 두 가지** — `boardClock` 은 `정지 · N초`, 필드가 없을 때의 종전 `clock` 은 `N초 (정지)` 그대로(기존 263 단언 유지).
6. **320×640 은 말판이 세로 스크롤** — 칸 32px 하한(#286)에서 13행이 한 화면에 들지 않습니다. 390×844 · PC 는 한 화면.

1~6 은 후속 dispatch 에서 Root 가 그대로 수용했습니다(추가 조치 없음). 종전 7번(폭탄 · 함정 설명 [기획 필요])은 제 조사 누락이었고 기존 안내 문장 재사용으로 해소했습니다(3.2).

## 5. 확인하지 못한 것

- Jupiter 의 실제 `boardClock` 과의 결합(계약 3.1 모양으로만 검사) · 실제 두 클라이언트 네트워크 경기.
- 정기 상점(모달) 안의 설명 진입은 같은 코드 경로지만 화면 캡처는 하지 않았습니다.

## 6. 남긴 자원

- `node_modules/`(gitignore 대상) — `npm ci` 로 `package.json` 에 고정된 기존 `typescript 5.9.3` 만 설치(typecheck 실행용).
- Chrome headless PID 28196 · 20892(포트 9377) · 28256(포트 9378) · 41520(포트 9379 · 후속 캡처) — 스크립트가 종료 · 프로필 폴더 삭제. 로컬 서버는 띄우지 않았습니다.
- `smoke_orientation_audit.js` 가 내부에서 git 읽기를 한 번 수행합니다(테스트 자체 동작 · 제가 직접 실행한 Git 명령은 없음).
