# #293 CJ QA REVISE — Mars 시각 증거 (2026-10-01)

- dispatch `ctx_03bff008dd94` / task `task_f2aaa121ca91` · role5: Mars / IMPLEMENT / CLIENT_TOOLING / 증거 문서만 / null
- 소스: `git rev-parse HEAD` = `9322e4c612a1a8d77ae0732ab94dc56dd3646ee0`. **제품 코드·테스트 수정 0, 커밋 0.** 새 파일은 이 폴더뿐.
- 방법: `python -m http.server 8293 --bind 127.0.0.1 --directory demo`(PID 19908 — 종료 확인, 8293 LISTENING 0) + Orca 내장 브라우저 CLI(`viewport` · `eval` · `screenshot`). Chrome MCP·외부 커넥터·새 의존성 0.
- **전부 로컬·합성 상태다.** 계정 서버가 없어 `_acctStartMode`로 PVE 를 열고 기존 Core/NET/UI API(`dispatchCoreAction` · `applySpecies` · `applyLegend` · `netAction` · `NET.*` 필드 · `render`)로 상태를 심었다. 준비 팝업(상태 3)은 `NET.publicMode/myReady/steps/ecoClock`을 손으로 넣은 **모의 화면**이며 실제 서버·두 번째 플레이어는 없다.
- 호출 수: tab create 1 · switch 1 · close 1 · snapshot 1 · viewport 5 · screenshot 15(초기 2회 `runtime closed` 실패 → 탭 활성화 뒤 성공, 탐색 3, 저장 10) · eval 약 28.

## 상태 4개 × 320 / 390

| 상태 | 파일 | 가로 넘침 | 44px 미만 대상 | 확인된 것 |
|---|---|---|---|---|
| 1 시작 상점 | `s1-shop-top-{390,320}` · `s1-shop-leaders-{390,320}` (+`.json`) | 없음 (scrollWidth = 폭) | 0 / 52 | 준비 시계 하나(180초), 두 표식이 막대 위, 상대 상자 없음. `무료` 배지 55×21 흰 글자 / `#06102a`, 접근성 이름 있음. 속성 버튼 54×44(390) · 44×44(320). 미선택 왕·동료는 눌린 버튼 0 |
| 2 배치 | `s2-place-{390,320}` | 없음 | 0 / 23 | 보드·트레이 얼굴 = 왕국(왼쪽 위)·아키타입/역할(오른쪽 위)·♥ 실제 HP. 등급 배경 g1~g5 실제 색(`#fff` `#bce2cf` `#376bce` `#7651a8` `#c89c3c`), ★ 0개. HP 알약 흰 글자 / `#06102a` 11px. 땅 하수인·미선택 왕/동료(배정 속성 물) 왕국 아이콘 표시 |
| 3 준비 팝업(모의) | `s3-ready-{390,320}` · `s3-after-unready-320.json` | 없음 | 0 | 팝업 `position:fixed` `role="status"` 불투명 `#0b1a3c`, 상단·진행 막대와 겹치지 않음(막대 아래 104px, 팝업 y 383/308). 팝업 안 버튼 0. `준비 취소`는 헤더 86×44 하나뿐, 가려지지 않음(hit-test 통과). 시계 계속 표시. 하단 대기 영역 없음. 준비 해제 값으로 다시 그리면 팝업이 사라지고 트레이 복귀 |
| 4 경기 중 칩 | `s4-play-chips-{390,320}` | 없음 | 0 | 시너지 줄: 왕국·아키타입 칩 + 마녀 개인 칩 `+20%`(67×44) + 왕관 칩 `1 ●○`(56×44). `synExtraView` 값과 일치. 미공개 상대 말 12개에 왕국·HP·등급 누출 0, 공개시킨 상대 말은 `g3` 배경 |

## 발견 (수정하지 않음 — root 판단 필요)

1. **팝업 문구 줄바꿈**: 두 폭 모두 "준비 완료 · 상대 기다 / 리는 중…"으로 낱말 중간에서 끊긴다(팝업 폭 195/160px).
2. **팝업 중심**: 화면 중앙 기준이라 보드 중심보다 약 24px 오른쪽(보드 4~338, 팝업 98~293 @390).
3. **320×693 시너지 열**: 칩 12개(약 552px)가 열 높이(약 503px)를 넘어 12번째 왕관 칩은 열을 스크롤해야 보인다(스크롤바 숨김). 390×844 에서는 전부 보인다.
4. **보드 말 크기**: 320px 에서 34×34라 모서리 기호가 그림과 겹쳐 빽빽하다(390px 43×43은 읽힌다). 글자 대비는 알약 덕에 문제 없음.
5. `s4-play-chips-320.png`는 턴 시작 배너의 어두운 막이 걸린 순간이라 흐리다 — 수치는 JSON 기준.
6. 320px 캡처에 구매 토스트 3줄이 보드 위에 남아 있다(일시적).

## 후속 수정 (같은 dispatch · root 승인 범위) — 위 `s1`~`s4`는 `9322e4c` 기준 기록으로 남긴다

수정 전 `9322e4c`: `ui.js` 224,569B `c7842eb5e5147af2` · `game.css` 138,183B `ba0a4803a6318341` · `core.js` `724a09ff608a4457`.
수정 후(미커밋 작업 트리): `ui.js` 225,261B `ad6f8dd5b9dc611b` · `game.css` 138,795B `bf084dcccdc45436` · `core.js` 295,223B `3f347effbacb80a4`.

| 수정 | 파일 |
|---|---|
| 결과 화면에서 내 동료 역할이 사라지던 것 — `resultEntry`가 **이미 아는 역할만**(`allyRole`: 내 동료 · 기술로 드러난 상대 동료) `allyKind`로 남기고, 결과 얼굴은 항목이 실어 준 값(`resultRole`)만 읽는다. 모르는 상대 역할·기술·아키타입은 넣지 않는다 | `ui.js` |
| 수풀 칸의 등급 배경 반투명 층 제거(불투명 유지) · 놓은 트레이 칸은 그림만 옅게 하고 등급 배경·기호·HP 는 불투명 · 준비 팝업 낱말 단위 줄바꿈(`word-break:keep-all` · 문구 동일) · 그림 없는 이름표를 밝은 등급 배경에서 읽히게 | `game.css` |
| 포획 불가 사유 `상대 HP 현재/최대 — 최대 HP의 30% 미만이어야 합니다`(조건식 그대로) · 판정 문구 `현재/최대 vs 현재/최대`(승패는 비율 `ra`·`rd` 비교 그대로) | `core.js` |

치환한 옛 기대값(같은 원인): `smoke_turnflow.js` D1b · J5, `issue122_rules.js` C11, `smoke_issue238.js` D3 허용 칸에 `allyKind`, `smoke_public_eco_live.js` E3 · E10 · E12(+E3b · E12b — 공통 마감 · 단절 중에도 흐름 · 경과 시간 증명), `issue106_browser_audit.js` 판정 문구 정규식(**정적 수정만 · 미실행** · CI 밖). 추가: `smoke_issue293.js` G12~G16.

검사(수정 뒤): 1차 5개 전부 실패 — 내가 `ui.js`에 넣은 줄 끝 `//` 주석이 같은 줄의 나머지를 삼킨 구문 오류(typecheck exit 2 포함). 고친 뒤 `smoke_issue293` 97/2(테스트 쪽 실수 2건: 보유 종 픽스처 · 아키타입 아이콘까지 센 개수) → 98/1 → **99/0** · `smoke_issue238` 147/0 · `smoke_turnflow` 203/0 · `issue122_rules` 99/0 · `npm run typecheck` exit 0. 실행 합계 12회(5 + 5 + 293 재실행 2). **`smoke_public_eco_live.js` 로컬 실행 0회** — 이 작업 트리에 `server/node_modules/ws`가 없고 테스트가 절대 경로로 불러 NODE_PATH 로 풀리지 않는다(root 결정: 필수 CI 가 확인).

재촬영(수정 뒤 · 서버 PID 40520 · 37404 모두 종료 확인):

| 파일 | 결과 |
|---|---|
| `s5-postfix-placed-bush-320.png/.json` | 수풀 칸 5말 `::before` 없음 · 배경 `g1~g5` 불투명. 놓은 칸: `.pc` 1 · 그림 0.3 · HP 1 · 모서리 기호 1 · ✓ 유지. 넘침 0 · 44px 미만 0 |
| `s6-postfix-ready-{320,390}.png/.json` | 팝업 262×57 한 줄(문구 높이 21px) — 낱말 중간 끊김 없음 |
| `s5-postfix-placed-bush-390.png` | **없음** — `orca screenshot`이 두 번(재시도 포함) `runtime closed the connection`으로 실패. 390px 수풀/놓은 칸은 화면 증거 없이 같은 CSS 규칙(320 실측)으로만 뒷받침된다 |

## 현재 — 놓은 트레이 칸의 조상 불투명도 (dispatch `ctx_e0bd81e317d0` / task `task_e1de62b8d571` · 2026-10-01)

**놓은 칸·수풀 이름표에 대해서는 이 절의 `s9`만 현재 증거다.** `s5`·`s7-final-placed-bush-390`의 "놓은 칸 `.pc` 1 · HP 1 · 기호 1"은 **요소 자신의 opacity 만 잰 값**이라 틀린 결론이었다(아래 원인). `s1`~`s8`은 이전 기록으로 그대로 둔다. 판정은 하지 않는다(Saturn 몫).

- 원인 1: 놓은 칸은 `disabled` 버튼이다(`ui.js` `trayHtml`). 공통 규칙 `button:disabled{opacity:.35}`(`game.css` 166)가 **버튼 전체**를 한 층으로 합성하므로 자식 `.pc{opacity:1}`·HP·모서리 기호는 되돌릴 수 없었다 — 등급 배경·HP 까지 35%.
- 원인 2: `.trayItem.placed>.pc .face{opacity:.3}`가 그림 없는 이름표·폭탄/함정 기호까지 옅게 했다. 수풀 칸은 `.pc.inbush .face{opacity:.7}`(#122)가 이름표에 그대로 걸렸다.
- 수정(`demo/css/game.css`만 · 선언 3개): ① `button.trayItem.placed:disabled{opacity:1}` 추가 ② 놓은 칸 규칙에서 `.face` 제거 → `.trayItem.placed>.pc .icon{opacity:.3}`만 ③ `.pc.gf.inbush .face{opacity:1}` 추가(등급 하수인의 이름표만 — 왕·동료·폭탄·함정의 수풀 기호 70%는 #122 그대로). `button:disabled` 공통 규칙과 다른 disabled 규칙(`#turnBar` · `.flowBar .go` · `button.uCard` 등)은 무수정. `disabled` 속성 · `— 배치됨` 접근성 이름 · ✓ 는 그대로.
- 조상 사슬 확인(계산값, `<html>`까지 전부): 놓은 칸 버튼에서 위로 opacity≠1 인 조상 0개 → 버튼 1 · `.pc` 1 · HP 알약 1 · 모서리 기호 1 · 이름표 1 · 폭탄/함정 기호 1 · **그림 `img.icon`만 0.3**. 수풀 칸: 이름표 1 · 그림 0.7(종전).
- 현재 해시(미커밋): `game.css` 139,466B `efe00252be3e7bd7` · `ui.js` 225,745B `f527d69f7c3370ad` · `core.js` 295,223B `3f347effbacb80a4`(둘 다 `72ed531`과 동일 — JS·서버·테스트 수정 0). **검사 실행 0회**(CSS 전용 · 종전 99/173/typecheck/CI 6/6 은 `72ed531` 기준 재사용, 새 CSS 는 커밋 뒤 필수 CI 대상).
- 방법: `python -m http.server 8293`(런처 PID 29436 → 리스너 PID 22896, 종료 뒤 8293 LISTENING 0) + Orca 내장 브라우저 탭 1개(생성·종료). 상태는 **합성**: PVE `shopTimeout` + `autoPlace`, 하수인 1개에 `legend`를 넣어 g5, 2개를 수풀 9행으로 옮김. 그림 없는 경우는 **DOM 에서만** `img.icon`을 기존 `pcFaceHtml` 폴백 마크업(`span.face>span.nm`)으로 바꿔 봤다(제품 코드 무수정).

| 파일 | 실측 (계산값 + PNG 픽셀) |
|---|---|
| `s9-placed-opacity-390.png/.json` | 놓은 14칸 전부 `disabled` · 버튼 opacity 1 · ✓ `rgb(79,216,138)`. 트레이 g1 배경 픽셀 `255,255,255` = 보드 g1 `255,255,255`. 트레이 g5 `196,160,71` = 보드 g5 `196,160,71`. HP 알약 가장 밝은 픽셀 `255,255,255`(트레이·보드 동일). 이름표 영역 `11,14,41`~`255,255,255`. 수풀 이름표 칸·그림 칸 배경 `255,255,255`. 넘침 없음(390) |
| `s9-placed-opacity-320.png/.json` | 계산값 390과 동일. 트레이 g1 `255,255,255` · g5 `196,160,71` · HP 최대 `255,255,255` · 수풀 g1 두 칸 `255,255,255`. 넘침 없음(320) |

호출: tab create 1 · switch 3 · close 1 · viewport 2 · eval 7 · screenshot 3(390 첫 시도 `runtime closed` → 탭 활성화 뒤 성공, 320 1회).

**한계**
- 320 에서는 말판 아래 행이 트레이에 가려 **수풀이 아닌 보드 g1·g5 는 화면에 없다**(픽셀 없음 · JSON 에 `invalid` 표기). 320 의 보드 비교는 수풀 g1 두 칸뿐이다.
- g5 픽셀(`196,160,71`)은 계산 배경색(`200,156,60`)과 다르다 — 트레이와 보드가 같은 값이라는 것만 확인했고 차이의 원인은 조사하지 않았다.
- ✓(26px · 칸 중앙)가 이제 불투명한 이름표·폭탄/함정 기호 위에 겹친다. 390 첫 칸의 이름 "스파크"가 ✓ 에 일부 가려진다 — 읽힘 판단은 root/CJ 몫.
- 이 화면에는 트레이 밖의 `disabled` 버튼이 없어 "다른 비활성 버튼은 그대로"는 **선택자 범위(새 규칙이 `.trayItem.placed`에만 걸림)로만** 뒷받침된다 — 화면 실측 없음.
- 대비율 측정 도구 없음(픽셀 최소·최대만). 실제 서버·실기기·데스크톱 폭 없음.

## 팝업을 말판 래퍼에 고정 (dispatch `ctx_321806340e49` / task `task_00369866ca8e` · 2026-10-01 · `72ed531`에 커밋됨 — 팝업 증거로는 그대로 유효, 아래 "미커밋"·해시 표기는 당시 기준)

**이 절의 `s8`만 현재 미커밋 소스의 팝업 증거다.** `s1`~`s6`과 아래 `s7`의 팝업 파일(`s7-final-ready-*` · `s7-incidental-ready-811.json`)은 **이전 기록**이다 — `s7`은 root 가 REVISE 로 돌려보낸 상수 계산식(`left:calc(50% - 24px)` · `top:calc(110px + …*.9309)` · `position:fixed`) 기준이고 그 식은 지웠다. `s7-final-placed-bush-390.*`은 팝업과 무관해 그대로 유효하다(재촬영 없음). 판정은 하지 않는다(Saturn 몫).

- 원인: 팝업이 화면(viewport)에 붙어 있었다. 고친 방식: 팝업 노드를 말판 래퍼 `#left`(원래 `position:relative`) 안으로 옮기고 `position:absolute; left:50%; top:50%; transform:translate(-50%,-50%)`. 여백·머리 높이·보드 비율 상수 0, 좌표를 읽고 쓰는 JS 0.
- 수정 파일: `demo/js/ui.js`(`renderSide` 첫 줄에서 `#left` 안의 옛 팝업 제거 1줄 + 준비 대기 분기에서 `sp` → `#left`로 노드 이동 1줄. 문구·`role="status"`·헤더 `준비 취소`·상태/서버/타이머 무수정) · `demo/css/game.css`(`.readyPop` 위치 선언만) · `demo/test/regression/smoke_issue293.js` E14c 한 단언(root 승인 — `position:fixed` 문자열 대신 `#left` 기준 가운데 관계와 이동·제거 코드를 본다. 다른 단언 무수정).
- 현재 해시(미커밋): `ui.js` 225,745B `f527d69f7c3370ad` · `game.css` 138,955B `18b2e71447c14db5` · `core.js` 295,223B `3f347effbacb80a4`(무변경) · `smoke_issue293.js` 37,799B `085fdfdf17e2a91b`.
- 검사(각 1회): `node demo/test/regression/smoke_issue293.js` → 99 passed / 0 failed, exit 0 · `npm run typecheck` → exit 0. 그 밖의 검사는 돌리지 않았다.
- 방법: `python -m http.server 8293`(런처 PID 35020 → 리스너 PID 5196, 종료 뒤 8293 LISTENING 0) + Orca 내장 브라우저 탭 1개(생성·종료). 상태는 전과 같은 **합성 모의**(PVE `shopTimeout` + `auto` + `NET.*` 손 입력, `render()` 2회 — 팝업이 겹쳐 쌓이지 않는지 보려고).

| 파일 | 조건 | 실측 |
|---|---|---|
| `s8-anchor-ready-320-mobile.png/.json` | 320×693 `--mobile` | 팝업 (136, 355.7) = 보드 (136, 355.7) → dx 0 · dy 0. 팝업 4.8~267.2, 위 327.2 > 머리 아래 104 |
| `s8-anchor-ready-390-classic.png/.json` | 390×844 **비모바일**(세로 스크롤바 15px, 문서 폭 375) | 보드 4.1~322.9(중심 163.5, 406.8) · 팝업 (163.5, 406.8) → dx 0 · dy 0 |
| `s8-anchor-ready-390x520-scrolled.png/.json` | 390×520 비모바일, `#screenBody.scrollTop=150`(스크롤바 2개 → 보드 폭 303.8, 지난번 반례의 중심 156) | 보드 y −40~525.6(중심 156, 242.8) · 팝업 (156, 242.8) → dx 0 · dy 0. 말판과 함께 스크롤된다 |

세 조건 공통: 팝업 1개(`#left`의 자식) · 262.4×57 한 줄(문구 높이 21px, `word-break:keep-all`) · `role="status"` · 불투명 `rgb(11,26,60)` · 팝업 안 버튼 0 · 머리와 겹침 없음 · `준비 취소` 86×44 헤더 안 1개, hit-test 통과 · 문서 가로 넘침 없음 · 활성 대상 14개 중 44px 미만 0. 준비 해제 값으로 다시 그리면 팝업 0개 · 트레이 14칸 복귀(수치만, PNG 없음).

호출: tab create 1 · switch 1 · close 1 · viewport 3 · eval 7 · screenshot 4(320에서 1회 `runtime closed` → 재시도 성공, 나머지 1회씩).

**한계**
- 스크롤을 더 내려 팝업이 머리 밑으로 들어가는 위치는 재지 않았다(z-index 는 머리 5 > 팝업 4 그대로).
- `s8-anchor-ready-390x520-scrolled.png` 아래쪽에 가로 스크롤 막대가 보인다. 문서 폭은 넘치지 않았고(375=375) 이번 수정 전에도 있었는지는 확인하지 않았다.
- `#left`가 숨겨지는 화면에서는 팝업도 보이지 않는다. 준비 대기는 배치 화면(`data-prep="place"`)이라 `#left`가 보이는 경우만 쟀다.
- 데스크톱 넓은 폭은 이번에 다시 재지 않았다(811폭 수치는 지운 상수식 기준이라 이전 기록).
- 실제 서버·두 번째 플레이어·실기기 없음.

## 이전 기록 — 상수 계산식 보정 (dispatch `ctx_52a97620650f` / task `task_51b9a2a9b9a6` · REVISE 로 대체됨)

위 `s1`~`s6`은 **이전 기록**이다(`s6`의 팝업은 화면 중앙 = 보드보다 24px 오른쪽). 이 절의 `s7` 팝업 수치는 당시 소스 기준이며 지금 소스와 다르다.

- 수정: `demo/css/game.css` `.readyPop` 한 규칙뿐 — `left:calc(50% - 24px)` · `top:calc(110px + min(100vw - 56px,376px)*.9309)` + 주석. `position:fixed` · `word-break:keep-all` · 문구 · 헤더 `준비 취소` · `ui.js`/서버/테스트는 그대로(`ui.js` 무수정이라 smoke·typecheck 재실행 0회).
- 현재 해시(미커밋, `9322e4c`와 다름): `game.css` 139,275B `07588251db78d2dd` · `ui.js` 225,261B `ad6f8dd5b9dc611b` · `core.js` 295,223B `3f347effbacb80a4`.
- 방법: `python -m http.server 8293`(런처 PID 7824 → 리스너 PID 29620, 종료 뒤 8293 LISTENING 0) + Orca 내장 브라우저 탭 1개(생성·종료) · `viewport --mobile` · `eval` · `screenshot`. 상태는 전부 **합성**(PVE `shopTimeout` + `auto`, 준비 팝업은 `NET.publicMode/readyWanted/myReady/steps`를 손으로 넣은 모의 — 그래서 상단 이름이 "AI vs AI"로 보이고 시계가 없다).

| 파일 | 실측 |
|---|---|
| `s7-final-ready-390.png/.json` | 팝업 중심 (171, 420.9) · 보드 중심 (171, 420.8) → dx 0 · dy 0.1. 팝업 위 392.4 > 머리 아래 104(겹침 없음). 한 줄(21px) · `keep-all` · `#0b1a3c` · 팝업 안 버튼 0. `준비 취소` 86×44 헤더 안 1개, hit-test 통과. 넘침 없음(390) · 활성 대상 14개 중 44px 미만 0 |
| `s7-final-ready-320.png/.json` | 팝업 중심 (136, 355.8) · 보드 중심 (136, 355.7) → dx 0 · dy 0.1. 팝업 4.8~267.2(시너지 열 268 앞). 나머지 390과 동일. 넘침 없음(320) · 44px 미만 0 |
| `s7-final-placed-bush-390.png/.json` | 수풀 칸 5말: 불투명도 1 · `::before` 없음 · HP 알약 1 · 모서리 기호 1 · 배경 `rgb(255,255,255)`(**5개 모두 g1** — 이 합성 상태에는 다른 등급이 없다. g1~g5는 `s5` 320 기록뿐). 놓은 트레이 14칸: `.pc` 1 · 그림 0.3 · HP 1 · 기호 1 · ✓. 넘침 없음 · 활성 16개 중 44px 미만 0(놓은 칸은 비활성 버튼). 촬영 시점의 CSS 는 `left`만 고친 상태 — 뒤에 바꾼 `top`은 `.readyPop` 전용이라 이 화면과 무관 |
| `s7-incidental-ready-811.json` (PNG 없음) | 새로 고침으로 화면 폭이 811로 풀린 채 잰 값: 보드 376×700 · dx 0 · dy 0. 의도한 촬영이 아니라 수치만 남겼다 |

호출: tab create 1 · switch 1 · close 1 · goto 1 · viewport 6 · eval 9(1회는 내 리다이렉트 실수로 출력 유실) · screenshot 9(1회 `runtime closed`, 1회 저장 없이 확인만, 2회는 준비 시계 만료로 대국 화면이 찍혀 덮어씀, 1회는 811폭이라 삭제, 저장 3 + 중간본 1).

**한계**
- 세로 맞춤은 1차(`top:50%`)에서 320×693 dy −9.2였다. 그래서 `top`을 보드 기하 상수(머리 104 + 간격 6 + 폭×700/376의 절반)로 바꿨다 — 그 여백·머리 높이·`fitBoard` 비율이 바뀌면 이 한 줄도 고쳐야 한다(주석에 적음).
- 팝업은 `fixed`라 말판을 스크롤하면 따라가지 않는다. 스크롤한 상태는 재지 않았다.
- 덮어쓰지 않는(자리를 차지하는) 스크롤바 화면에서는 `--mobile` 없이 390폭 배치 화면의 보드가 4~308(중심 156)로 측정됐다. 그 조건의 팝업 위치는 재지 않았다(811폭에서는 dx 0).
- 실제 서버·두 번째 플레이어·실기기 없음.

## 없는 증거

- 실제 2인 온라인(서버 `seats.step` · 공통 `deadline` · 실제 준비 취소 왕복 · 상대 공개 말의 서버 `grade`)의 화면 증거 없음.
- 결과 화면, 용·사신 칩, 핫시트 표식, 판매 직후 화면은 이번 4상태 범위 밖.
- 색 대비는 계산값(전경/배경 색)만 기록했고 대비율 측정 도구는 쓰지 않았다.
