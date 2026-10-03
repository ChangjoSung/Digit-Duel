# #316 Mars 클라이언트 구현 보고 — 2026-10-03

판정(자체 검증): **구현 완료 · 미커밋**. 독립 Saturn QA 전이며 이 보고는 Saturn PASS가 아닙니다.
실행: Claude `claude-opus-5-5` · high · `--dangerously-skip-permissions`(bypass 모드 확인) · Ponytail full. Git 쓰기·서버/Core 수정·Notion/GitHub 쓰기 0. Jupiter 미커밋 변경(`server/authoritative/room.js`, `test-issue237-economy.js`)은 건드리지 않았습니다.

## 1. 변경 파일

| 파일 | 내용 |
|---|---|
| `demo/js/ui.js` | ①~⑥ 클라이언트 구현(아래 2절) |
| `demo/js/network.js` | ② 상대 B08 대기 문구 1줄(CJ 원문) |
| `demo/css/game.css` | ③ 토글 · ④ 흔적/수풀/등급 토큰 · ⑤ 행동 줄 · 좁은 폭 시계 범위 · ⑥ 왕·동료 HP 띠. 옛 `.shopTop .synRail` 고정 높이(116px · 204px)와 안 쓰는 `.shopTop .flowBar h2` 삭제 |
| `tools/typecheck/env.d.ts` | 새 전역 처리기 `__synTog` · `__bagPick` 선언 2줄 |
| `.github/workflows/ci.yml` | 필수 CI 회귀 목록에 `smoke_issue316.js` 1줄(Mercury 승인 · 로컬 CI 전체 재실행은 Mercury 필수 CI로 대체) |
| `demo/test/regression/smoke_issue316.js` | **신규** 최소 회귀 35건(① ② ③ ④ ⑤ ⑥ 경계 · 실제 서버 Room 좌석 뷰 → hydrate 통합) |
| `demo/test/regression/smoke_issue293.js` | CJ 승인 변경에 맞춘 기대값 갱신: A7(등급 5색) · G14(수풀 50% 복원) · D9(왕·동료 기여 카드 HP) · T1(턴 상점 2행) · E8b(`flowHead s01` 클래스) |
| `demo/test/regression/smoke_issue238.js` | K31(토글 배치) · C2l(정보 창 그림 칸 등급 클래스) |
| `demo/test/regression/smoke_issue263_client.js` | F8/F12/F13: B08 정지 잠금을 모달 버튼 대신 카드 버튼으로 확인 + 같은 표 연타 1회 |
| `docs/.../316/Mars/media/*.png` | 대표 시각 증거 11장(아래 4절) |

기존 테스트 기대값은 **CJ가 명시 승인한 화면 변경**(등급색 · 수풀 50% · 토글 · 상점 행 · 왕·동료 HP)에 해당하는 단언만 바꿨고, 거름을 느슨하게 하지 않았습니다. 부수 설치: 작업 트리 루트에 `npm ci --ignore-scripts`로 이미 선언된 `typescript@5.9.3`만 설치(`/node_modules/`는 gitignore · 새 의존성 아님). `npm run test:typecheck` 실행에 필요했습니다.

## 2. 항목별 구현 (확정 = 코드 · 검사로 확인)

1. **포획 잠금 사유** — 포획 패널에 `🔒 <짧은 사유>` 한 줄(`p.capWhy role=status`). 문구는 Core `ballWhy` 반환값을 `capWhyShort`가 줄이기만 함(이미 가진 하수인 · 전설은 포획 불가 · 상대 HP 30% 이상 · 몬스터 볼 없음 · 이번 라운드에 사용함 · 포획할 수 없는 말, 모르는 사유는 원문). 판정 재계산 · 버튼 활성 조건 중복 0, 긴 원문은 버튼 title 유지. 소유자 화면(`mineView`)에만.
2. **B08** — 교체 창과 같은 `slotGrid swapGrid` + 공통 `unitCard` 카드 4장(가방 3 `[교체] 🪙원장` + 포획 말 `[풀어주기] 🪙0`). 결정은 기존 `bagPick{i,token}`만(오프라인 Core · 공개 방 `netSendAction`), `shopSwap` 호출 0. 정지 중 카드 실제 disabled, 같은 표(token) 연타 1회(송신 실패 시 잠금 해제), 20초 · 만료 · 기권 · 종료 우선은 종전 경로 그대로. 문구: 소유자/상대 모두 CJ 원문. 빈 가짜 슬롯 없음.
3. **전투 시너지** — 차례 줄 우상단 토글 하나(아이콘 + 활성 개수 = `battleSynChips` 칩 수). 기본 접힘 · 펼치면 왼쪽 남는 폭에 한 줄(nowrap · 가로 스크롤 · 휠 → 가로), 라운드 줄의 칩 제거. 펼침 · 스크롤 · 초점은 같은 전투 재렌더에서 유지, 새 전투는 접힘(키 = 오프라인 전투 객체 / 공개 방 battleId). Esc는 펼침만 닫고 전투 창은 유지. 송신 0. 칩 · 단계 테두리 · 상세 · 비공개 판정은 기존 함수 그대로.
4. **보드** — 내 미소모 흔적 칸 = `.cell.traced`(옅은 하늘색 바탕은 말 아래 · 하늘색 점선 테두리는 말 위 네 변, 선택/이동/공격 실선 외곽선과 다른 띠). 소모 즉시 사라짐 · 상대 흔적 비노출. 수풀: `.pc.gf` 불투명 덮기 제거 → 등급색 50% 알파 층 복원(이름표 · HP 알약은 불투명). 공통 토큰 `--g1~--g5` = 초록 · 파랑 · 보라 · 노랑 · 빨강(시너지 `--syn*` 별도 보존). 등급 클래스를 전투 카드(`.fighter.gb`)와 정보 창 그림(`.uhFace.gb`)에 연결 — 등급 있는 하수인만, 왕 · 동료 · 폭탄 · 함정 · 미공개 말은 클래스 없음.
5. **상점 머리** — S01 고정 3행(① 신원 · `시작 상점` · 이모티콘 · ⚙ ② 01/02/03 ③ `#prepClock` · 코인 · [다음 단계]), 턴 상점 고정 2행(① 신원 · `N턴 상점` · 이모티콘 · ⚙ ② `#shopClock` · 코인 · [완료]). 시계 id · 버튼 동작 · 이모티콘 자리(.emoSlot) 마크업은 그대로 이동만. S02 · 준비 완료 대기는 현행 유지(Venus [기획 필요] 기본값). 우측 시너지 열 높이는 옛 고정 px 대신 `railFit()`이 실제 머리 아래 → 스크롤 틀(#screenBody · #overlayBox) 끝까지 실측(렌더 · 시트 열림 · 크기 변경). **사망 칸**: Jupiter 좌석 뷰(`alive:false`)를 `netStubPiece` · hydrate가 그대로 보존 — 클라이언트 수정 불필요를 통합 검사로 확인(보드 `at()` 거름 · 상점 필드 원래 칸 사망 카드 · 기여 목록 사망 표식 · 말 정보 칸 대상 제외 · 화면 synView = 서버 Core). 상대 사망 칸 노출 확대 0.
6. **왕 · 동료 HP** — 아래 3절.

## 3. ⑥ 원인 구분

- **재현 안 됨(확정)**: 공통 말 정보 창 자체(`unitHelpPiece → unitHelpOpen → unitStatChips`)는 오프라인 PVE와 실제 Room IN_PROGRESS 좌석 뷰 hydrate 모두에서 내 왕 · 동료에 `HP 100/100` 빨간 하트 칸을 이미 표시(`pcMeta.unit` = boolean true, 서버 hp/maxHp 정상).
- **재현 · 수정(확정)**: (a) 상점 `왕·동료 속성` 줄 = HP도 말 정보 진입도 없음 → 공통 `leadFaceHtml`에 실제 HP 띠(공통 `hpHtml`) + 읽기 전용 정보 진입(속성 버튼 밖 별도 요소 · 선택/전송 0). (b) 시너지 기여 목록의 왕 · 동료 카드 HP 없음 → 같은 `leadHpHtml`. (c) 정보 창에 현재 방어막 없음 → 내 말에 실제 값 > 0일 때만 `현재 방어막 n` 줄(320px HP 칸 잘림 때문에 칸이 아닌 줄로). (d) 공개된 상대 말 HP가 하트 없는 글자 → 같은 빨간 하트, 서버 DTO hp/maxHp만(방어막 · 능력치 추정 0). 폭탄 · 함정 HP 없음 유지. 범위는 Mercury 확인(ask 답변) 기본안.

## 4. 검증 (각 1회 · 출력과 exit 같은 실행 수집)

| 검사 | 1차 | 재실행(실패 수정 후 해당 검사만) |
|---|---|---|
| smoke_issue236 | 299/0 exit0 | — |
| smoke_issue293 | 138/3 exit1 (A7·G14 이미 갱신분 외 D9 · E8b · T1 = 승인 변경 기대값) | 141/0 exit0 |
| smoke_issue295 | 65/0 exit0 | — |
| npm run test:typecheck | 71/1 exit1 (새 window 처리기 미선언 · 튜플 타입) | 72/0 exit0 |
| smoke_issue238 (수정한 기존 검사) | 195/1 exit1 (C2l 정보 창 그림 칸 등급 클래스) | 196/0 exit0 |
| smoke_issue263_client (수정한 기존 검사) | 예외 exit1 (내 테스트 오타 `T.__bagPick`) | 186/0 exit0 |
| smoke_issue316 (신규) | 33/0 → S01 단언 추가 후 34/1(내 정규식이 CSS 주석의 '116px'에 걸림) | 35/0 exit0 |
| smoke_memo · smoke_cross_skill · smoke_own_side (정보 창 줄 · 흔적 경로 직접 관련) | 129/0 · 86/0 · 66/0 exit0 | — |

대표 시각(Orca 내장 브라우저 · 오프라인 PVE): `media/` — S01 320/PC, 턴 상점 390 · 320 스크롤(머리 고정 · 열 끝 칩까지), 왕·동료 HP 띠 320, 정보 창 320(HP + 현재 방어막), 포획 사유 320, 토글 펼침 320 · PC, B08 320, 보드 흔적/수풀 390. 실측: 320px 토글 펼침 전후 차례 h2 · 라운드 줄 · 시계 · 무대 top/height 동일, 문서 가로 넘침 0, 상점 속성 버튼 44px.
임시 서버: `python -m http.server 8091 --bind 127.0.0.1`(작업 트리 `demo/`) — 검증 뒤 PID 32236 종료, 8091 닫힘 확인. 다른 8084(PID 5012) · Render 탭 무변경. 브라우저 탭은 내가 연 것만 닫음.

## 5. 미해결 · 한계

- 변경 전(before) 화면은 Worker Git 읽기 금지로 원본 트리를 띄우지 않아 없음 — CJ 원본 사진이 전 기준. 온라인 두 좌석 실제 브라우저 플레이는 하지 않음(서버 Room 좌석 뷰 → 클라이언트 hydrate 헤드리스 통합으로 대체 · 네트워크 반복 매트릭스 금지).
- 새 검사가 수정 전 코드에서 실패하는지는 재실행하지 않은 정적 판단.
- S02 · 준비 완료 대기 머리줄 통일은 [기획 필요 · 비차단] — 현행 유지.
- 독립 Saturn QA · 필수 CI · CJ 플레이 QA 미실행.

## 6. Saturn REVISE 수정 (2026-10-03 · 같은 미커밋 트리 · 기준 HEAD `ba916ba`)

판정(자체 검증): **R1 · R2 수정 완료 · 미커밋**. 이 절은 Mars 자체 검증이며 Saturn 재검수 PASS가 아닙니다. 근거: `artifacts/.../issue-316-v0414-implementation-20261003/Saturn-REVISE.md`.
실행: Claude `claude-opus-5-5` · high · `--dangerously-skip-permissions` · Ponytail full. Git · 서버/Core · Notion/GitHub 쓰기 0.

| # | 원인 | 수정 |
|---|---|---|
| R1 | `ui.js` 정보 창 `rows`: 새 `// 현재 방어막` 주석 뒤에 기존 `x.alive===false?"사망"` · `x.immobile>0?"이동 불가 n턴"` 원소가 같은 줄로 붙어 주석이 됨 | 두 원소를 별도 실행 줄로 복원(문구 · 조건 종전 그대로) |
| R2 | `game.css` S01 `.shopSheet .leadRow button{min-width:40px}` + 320에서 행 폭 249px(#screenBody 좌4 · 우52 · 스크롤 막대15) → 속성 버튼 40×44 · 행 안 넘침 5px. 턴 상점 320도 행 266px에 내용 269px(마지막 버튼이 시너지 열에 1px 겹침) | 공통 `.shopSheet .leadRow button{flex:1 0 44px; min-width:44px}`(중복된 턴 전용 줄 삭제). ≤360: 간격 1px, S01(`data-prep="roster"`)·턴 상점 모두 같은 거터(좌2 · 우46 · 스크롤 막대 숨김 · 시너지 열 오른쪽 끝 붙임). 새 렌더러 · 의존성 0, 선택/정보 진입 분리 · 5색 · 토글 · 규칙 무변경 |

**검사(출력과 exit 같은 실행)**: `node demo/test/regression/smoke_issue316.js` → **37/0 exit0**(1회). 추가 단언 2개 = 실제 정보 창 `<ul class="uhRows">`의 `<li>` 글자: ⑥b2 살아 있음 · immobile0 → 사망/이동 불가 줄 없음, ⑥b3 hp73/100 · 방어막12 · immobile2 · alive:false → `현재 방어막 12` · `사망` · `이동 불가 2턴` 세 줄 각각. 결함 주입 1회(스크래치 사본에 옛 한 줄 복원): ⑥b3만 FAIL `실측 ["현재 방어막 12"]` 36/1 — 새 단언이 결함을 잡음(그 실행의 exit는 파이프로 가려져 별도 미수집, 스크립트는 실패 시 exitCode 1). CSS를 읽는 다른 회귀는 smoke_issue238 K22(선택 테두리)뿐이라 무관 → 재실행 안 함. 타입 영향 없음(줄 나눔만) → typecheck 재실행 안 함.

**실측(Orca 내장 브라우저 · 본인 탭 · PD 8091 재사용 · 오프라인 PVE)** 속성 버튼 폭×높이 / 행 clientWidth=scrollWidth / 시너지 열 x / 문서 가로 넘침:

| 화면 | 320 | 390 | PC |
|---|---|---|---|
| S01 | 44.6×44 ×5 · 272=272 · 열 274–320 · 0 | 51×44 · 319=319 · 0 | 59.4×44(1931) · 0 |
| 턴 상점 | 44.6×44 ×5 · 272=272 · 열 274–320 · 0 | 54×44 · 334=334 · 0 | 62.4×44(1280) · 0 |

그림 칸은 모든 폭 44×44 유지. 320 S01 · 턴 상점에서 화면 밖으로 나가는 요소 0(전체 스캔).

**대표 캡처 교체**(`media/`, 배너 등 FX 큐가 빈 뒤 촬영 · 게임 동작 무변경): `info-king-shield-320.png`(20턴 상점 위 왕 정보 창 HP 73/100 · 현재 방어막 12), `battle-pc.png`(1280 · 포획 사유 `이미 가진 하수인` · 토글 펼침), 그리고 레이아웃이 바뀐 `s01-320.png` · `turnshop-lead-320.png`(왕·동료 속성 줄 44px). 캡처용 페이지 조작: 정적 서버라 계정 확인을 페이지 안에서만 `AUTH.state` 우회, 전투는 회귀 하네스와 같은 방법으로 말 배치. 본인 탭만 열고 닫음(PD Render 탭 · 8091/PID22708 · 8084/PID5012 무변경, 새 서버 0).

**미해결 · 한계**: Saturn 재검수 · 새 HEAD CI · CJ 플레이 QA 미실행. 실제 안드로이드 기기 미확인(320/390 뷰포트 실측만).

## 7. Saturn REVISE 2차 — 말 정보 그림 클릭 영역 (2026-10-03 · 같은 미커밋 트리 · 기준 HEAD `a74af9e`)

판정(자체 검증): **수정 완료 · 미커밋**. Mars 자체 검증이며 Saturn 재검수 PASS가 아닙니다. 근거: `artifacts/.../Saturn-REVISE-a74af9e.md`. 실행: Claude `claude-opus-5-5` · high · `--dangerously-skip-permissions` · Ponytail full. Git · 서버/Core · Notion/GitHub 쓰기 0.

- **원인**: `.shopSheet .leadRow .leadFace`(44×44)의 `border:2px` + `overflow:hidden` → 안쪽 `.faceBtn`(44×44)이 padding box 40×40으로 잘림. 테두리 2px과 오른쪽·아래 2px 띠는 정보 진입이 안 되고, 320에서 오른쪽 끝 점은 옆 속성 버튼에 맞음(ba916ba부터 같은 CSS).
- **최소 변경**(`demo/css/game.css` 두 줄 · JS · markup 0): 그림 칸 `border:2px solid #2a4f98` → `outline:2px solid #2a4f98; outline-offset:-2px`(같은 자리 · 같은 색, 레이아웃에 영향 없음 → `.faceBtn`이 테두리 상자 전체 44×44를 채움). 위치를 잡은 HP 띠가 outline 위에 그려지므로 `.leadRow .leadFace .hp`를 `left/right/bottom:2px` + 아래 모서리 8px로 바꿔 종전처럼 테두리 안쪽에 둠(`pointer-events:none` 그대로).
- **실측**(Orca 내장 브라우저 · 본인 탭 · PD 8091 재사용 · 같은 출처 iframe 320/390/1280 · 오프라인 PVE · S01 + 20턴 상점 모달, 그림 칸 3개씩): `elementFromPoint` 0.25px 스캔 → 모든 칸의 frame 44×44 = faceBtn 44×44(오프셋 0,0), 적중 범위 [-0.75, 43.75](Saturn 측정과 같은 0.75px 좌표 편향 · 종전 40.75), **둥근 모서리 도형 안 미적중 0**. 오른쪽(43.5,22) · 아래(22,43.5) · 왼쪽 · 위 0.5px 점 클릭 → 모두 faceBtn · 정보 창(`.uhRows`) 열림, 왕·동료 속성/선택 무변경, 코인 무변경, `dispatchCoreAction`/`netAction` 호출 0, Esc로 닫힘. 오른쪽 끝 바깥은 faceBtn 미적중(속성 버튼 침범 0).
- **유지 확인**: 속성 버튼 15개 S01/턴 320 44.59×44 · 390 51/54×44 · PC 59.39/62.39×44, 행 clientWidth=scrollWidth, 문서 · 모달 가로 넘침 0, 턴 상점 속성 버튼 오른쪽 끝 ≤ 시너지 열 왼쪽(320 274/274 · 390 338/342 · PC 804/808). 320 확대 캡처로 테두리 링 · HP 띠 모양이 종전과 같음을 직접 확인 → 시각이 같아 `media/` 새 이미지 · 교체 0.
- **검사**: CSS 전용이라 37 회귀 · 서버 · typecheck · 전체 CI는 재실행하지 않음(지시). 실제 렌더 hit 스캔 2회(1회차 뒤 HP 띠 겹침을 발견해 고친 뒤 최종 CSS로 1회) + 턴 모달 시너지 열 측정 1회. 본인 탭만 열고 닫음 · 8091(PID 16448/부모 22708) · 8084(PID 5012) · Render 탭 무변경.
- **미검증**: 키보드 포커스 링(`.faceBtn:focus-visible`)은 프로그램 포커스로 `:focus-visible`가 켜지지 않아 실제 렌더에서 확인하지 못함(Chrome 그리기 순서상 자식 outline이 부모 outline 위). 실제 안드로이드 터치 · Saturn 재검수 · 새 HEAD CI · CJ 플레이 QA 미실행.

## 8. Saturn REVISE 3차: 하수인 진열 그림 클릭 영역 (2026-10-03 · 같은 미커밋 트리 · 기준 HEAD `3a9f002`)

판정(자체 검증): **수정 완료 · 미커밋**. Mars 자체 검증이며 Saturn 재검수 PASS가 아닙니다. 근거: `artifacts/.../Saturn-REVISE-3a9f002.md`. 실행: Claude `claude-opus-5-5` · high · `--dangerously-skip-permissions` · Ponytail full. 서버/Core · Notion/GitHub 쓰기 0.

- **원인**: `.shopSheet .shopCard` grid의 그림 열이 36px인데 안쪽 `.faceBtn`은 공통 `min-width:44px`(1417행)입니다. 버튼이 8px 넘쳐 간격 6px(320 턴 상점은 4px)를 지나 `.nm` 위로 2px(4px) 들어가고, 뒤에 그려지는 이름 칸이 버튼 오른쪽 끝을 덮었습니다. 984행 grid는 a74 → 3a 동안 그대로이므로 leadFace outline 수정에서 생긴 회귀가 아닙니다.
- **최소 변경**(`demo/css/game.css` 984행 한 곳 · JS · markup 0): `grid-template-columns:30px 36px …` → `30px 44px …`. 그림(36×36)은 넓어진 칸 가운데에 그대로 놓이고, 이름 열만 8px 좁아집니다.
- **실측**(Orca 내장 브라우저 · 본인 탭 · PD 8091 재사용 · 같은 출처 iframe 320/390/1280 · 오프라인 PVE · S01 + 20턴 상점 모달, 화면마다 진열 6칸): 버튼 최소 44×44. 버튼 오른쪽 끝 ≤ `.nm` 왼쪽, 등급 칸 오른쪽 끝 ≤ 버튼 왼쪽, `.nm` 오른쪽 끝 ≤ 가격 버튼/품절 표시 왼쪽에서 겹침 0. `elementFromPoint` 좌·우·상·하 0.5px 점과 가운데 점이 모두 그 칸의 faceBtn을 가리켰습니다(미적중 0/180). 이름 말줄임 0(320 포함). 왕·동료 그림 칸 44×44 = faceBtn 44×44. 속성 버튼 최소 폭은 320 44.59, 390 51/54, 1280 59.39/62.39이고 높이는 모두 44입니다. 문서·시트·카드 가로 넘침은 0입니다.
- **입력 경로**(합성 입력 · `isTrusted=false`): 화면마다 첫·마지막 진열 칸의 오른쪽 끝(right−0.5) 점을 `elementFromPoint`로 집고 DOM `click()` → 정보 창(`.uhRows`) 열림 12/12. `S.eco`(코인 · 티켓 · 진열 · 판매 기록) 변화 0, `dispatchCoreAction`/`netAction` 호출 0.
- **검사**: CSS 전용이라 37 회귀 · 서버 · typecheck · 전체 CI는 재실행하지 않았습니다(지시). 측정 스크립트 3회 실행. 1회차는 `AUTH` 접근 오류였고, 2회차는 턴 모달 뒤 S01 시트까지 함께 세는 선택자 오류여서 버렸으며, 결과는 `.shopSheet.turn`으로 범위를 좁힌 3회차입니다. 화면 모양 변화는 그림 칸 폭 8px뿐이라 `media/` 교체는 0입니다. 본인 탭만 열고 닫았고 8091 · 8084 · Render 탭은 건드리지 않았습니다. 본인 탭의 `orca snapshot`/`reload`는 `runtime_unavailable`를 냈지만 `eval`은 정상이었습니다.
- **미검증**: 실제 trusted 터치/클릭, 실제 안드로이드 기기, Saturn 재검수, 새 HEAD CI, CJ 플레이 QA.

## 9. CJ QA REVISE3: 상대 표식 · 적용 6스탯 · 상성 띠/표 · B08 30초 (2026-10-03 · 같은 미커밋 트리 · 기준 HEAD `34451fb`)

판정(자체 검증): **구현 완료 · 미커밋**. Mars 자체 검증이며 Saturn PASS가 아닙니다. 실행: Claude `claude-opus-5-5`(시스템 표시 모델 ID) · bypass 권한 · Ponytail full. effort·footer는 세션 안에서 볼 수 없어 dispatch 값(high)을 그대로 적습니다. 서버 · Core · Git · Notion/GitHub 쓰기 0. 이전 6항목 PASS 범위는 바꾸지 않았습니다.

| # | 원인 | 수정 |
|---|---|---|
| ① (→ 9.1에서 교체) | 등급 배경(#293)이 소유 구분을 덮음. 상대 표시는 얇은 적갈색 테두리 하나(색만)였음 | `renderBoard`: 공개된 상대 말에만 `.foe`(보는 사람 기준 · 관전/종료 공개 제외) + 접근성 이름 앞에 `상대 · `. CSS: 굵은 빨간 테(테두리 + inset 2px, 레이아웃 무변경) + 왼쪽 아래 빨간 삼각 꼬리표(모양). 미공개 말(?·메모)은 그대로라 정체 누출 0 |
| ② | `battleStatHtml`이 의도적으로 기본값(#296)만 그림 | `battleEff(f)`: 공개 방 = 서버 `effectiveStats`(Jupiter DTO), 오프라인 = Core와 같은 식(`effAtk` · def+synDef · `effSpd` · `effEvade` · min(50%, crit+synCrit) · statusPct+synStatusPct). 읽기만 하고 전투원 값은 바꾸지 않음. 💫는 `+N%p`(가산 보정)로 표기. `network.js` hydrate는 유한한 숫자만 `f.eff`로 옮김. 공개 방에서 객체나 칸이 없으면 PD 계약대로 `—`를 보이고, 기본값을 적용값처럼 쓰거나 상대 가산칸을 추정하지 않음 |
| ③ | 없던 기능 | `elemCycle()`가 `BEATS` 한 곳에서 순서를 만듦(규칙 사본 · 배율 0). 보드 왼쪽 띠: 위→아래 불·물·번개·땅·풀·불 + ↑ 5개, 글자 없이 접근성 이름만. 우측 열과 같은 높이이며 ≤360에서는 16px로 좁혀 칸 32px 하한(#286)을 지킴. 전투: 라운드 줄 오른쪽 44px 상성표 버튼 → 기존 안내 창(`synHelpOpen`) 안에 오각형 고리를 띄움(SVG 화살표 = 이기는 쪽 → 지는 쪽). 지금 실제 전투원(B.fa/B.fd, 대리 출전 포함)의 속성은 나 = 파란 실선 고리 + `나`, 상대 = 빨간 점선 고리 + `상대`, 속성 없음은 범례 줄에 표시. 상대 스킬은 없음. 표시 전용(명령 · 송신 · 시계 · 메뉴 0) |
| ④ (CJ 최신 직접 승인 · PD 전달) | B08 20초 · 두 B08 창에 기권 버튼 | `data.js` `ECO.bagPickSec` 20→30(서버는 ECO를 이어받음 · Jupiter 확인). 소유자 창은 처음부터 `⏱ 30초`(공개 방은 서버 남은 시간)를 보이고, 소유자 창과 상대 대기 창 모두 기권이 없음. 보드 · 상점 · 전투의 기권과 만료 · 환급 · 토큰 · 정지는 그대로 |

**변경 파일**: `demo/js/ui.js`, `demo/js/network.js`, `demo/js/data.js`(bagPickSec 한 줄 + 주석), `demo/css/game.css`, `demo/test/regression/smoke_issue316.js`(+16 단언), `demo/test/regression/smoke_public_rooms.js`(#296 `open` 픽스처가 서버 `effectiveStats`도 싣게 함(적용값 = 기본값) · P3 💫 기대값 `+25%p` · 새 P5b: 객체 없음 → 6칸 `—`), `media/r3-*.png` 3장.

**검사(출력 · exit를 같은 실행에서 수집)**: `smoke_issue316` 49/0 exit0 → ④ 추가 뒤 53/0 exit0(새 항목이라 다시 실행). `smoke_public_rooms` 211/0 exit0 → PD 계약(없으면 `—`)에 맞춘 뒤 212/0 exit0(같은 영향 범위라 다시 실행). `npm run test:typecheck` 72/0 exit0(1회 · ④ 편집 **전**에 실행했고, ④는 문자열 · 상수만 바꿔 다시 돌리지 않음).

**실측(Orca 내장 브라우저 · 본인 탭 · PD 8091 · 같은 출처 iframe · 오프라인 PVE · AI 지연 정지)**
- 보드에서 띠 / 말판 / 우측 열 x(px) · 칸 · 가로 넘침: 390 = 4–28 / 30–338 / 340–386 · 42.6 · 0. 320 = 2–18 / 21–252 / 255–301 · **32.0** · 0(띠 24px 첫 시도에서는 30.8px였고 좁은 폭 규칙으로 고침). 1280 = 428–452 / 488–770 / 806–852 · 39.1 · 0. 띠와 우측 열의 높이는 모든 폭에서 같음. 공개 상대 2 · 미공개 12 렌더, 수풀 칸 상대 말에도 테 · 꼬리표가 붙음.
- 전투 390(이 시드의 실제 `applySynergy` 값): 나 모래 여우 공격력 25(24×1.03) · 방어력 13(5+8) · 속도 15(14+1) · 💫 +0%p, 상대 회피 3% · 💫 +5%p. 상성표 버튼은 44×44이고 시너지 토글 바로 아래 오른쪽에 있음. 렌더 hit 점(`elementFromPoint`) → 합성 DOM click(`isTrusted=false`)으로 창 열림. 그 전후 `menu · actSeq · round · phase`와 NET는 같고 시계는 계속 흐름(리셋 없음). Esc로 닫으면 초점이 상성표 버튼으로 돌아오고 전투는 유지됨. 같은 속성(땅 vs 땅)이면 두 표식이 한 칸에 함께 붙음. 320에서 창 12–308 × 274–624, 넘침 0.
- CJ 참조 배치(나 번개 · 상대 풀)와 속성 없음 표시는 `cycleHelpHtml`을 직접 불러 확인함(게임 상태 조작 없음).
- 대표 PNG: `media/r3-board-foe-cycle-390.png` · `r3-battle-stats-390.png` · `r3-cycle-popup-390.png`. 본인 탭만 열고 닫았고 8091(200 유지) · 8084 · Render 탭은 건드리지 않음.

**판단 · 한계**
- 팝업 화살표(이기는 쪽 → 지는 쪽) + 짧은 범례는 PD 확인 결과 승인된 기존 규칙임(추가 CJ GO 불필요).
- 상성표 창은 전투 재렌더(상대 행동 · 재연결 · 사망)에서 `modal()`이 기존 안내 창과 같이 닫음. 열어 둔 채 유지되지는 않음.
- 하네스가 새 함수를 내보내지 않아(파일 범위 밖) 팝업 내용은 회귀가 아니라 브라우저 실측으로 확인함. B08은 9.1에서 브라우저로 캡처함.
- 공개 방 effectiveStats의 실제 두 좌석 hydrate는 서버 기동 없이 `netSynthBattle` 단위 단언으로 확인함. 실제 안드로이드 · Saturn 재검수 · 새 HEAD CI · CJ 플레이 QA는 실행하지 않음.

### 9.1 후속(같은 승인 범위 · 같은 트리 · 2026-10-03): 보이는 `적` 표식 · 보는 사람 기준 소유 색 · B08 캡처

판정(자체 검증): **수정 완료 · 미커밋**. Saturn PASS 아님. 실행: 같은 터미널, Claude `claude-opus-5-5`(시스템 표시 모델 ID) · bypass · Ponytail full. 요청 effort는 high이며, 세션 안에서 effort · footer를 직접 볼 수 없어 확인하지 못함. 이 절이 9절 ①과 2절의 B08 20초 서술을 대체함(옛 절은 그날의 기록으로 남김).

- **원인**: 9절 ①은 빨간 테 + 모서리 삼각형만 보였고 `상대`는 접근성 이름에만 있었음. Venus 최종 계획(`Venus/revise3-plan.md` ⑦)은 **보이는 `적` 글자(또는 같은 뜻 아이콘) + 대비 테두리**를 요구하고 삼각형 하나는 모호하다고 봄. 또 소유 색이 좌석 기준(`.p0/.p1`)이라 P1 좌석에서는 내 말이 빨강 계열로 보였음.
- **수정**(`game.css` + `ui.js` 한 줄 · 새 DOM · 자산 0): 삼각형을 지움. `#board .pc.foe .info::before{content:"적"}`로 HP 알약 왼쪽 같은 줄에 작은 글자 표식을 넣음(HP 알약과 같은 어두운 바탕 `#06102a` + 빨간 글자). 그래서 그림 · 위 모서리 기호 · 등급 바탕을 가리지 않음. HP 줄이 없는 공개 말은 아래 가운데에 같은 글자를 넣음. 빨간 테는 그대로 둠. 소유 색은 CSS로만 보는 사람 기준으로 덮음: `.own` = 파랑 테 · 바탕(등급 없는 말 · 수풀 층 포함), `.foe` = 빨강. 좌석 클래스 `p0/p1`은 그대로 두어 관전 색과 기존 `smoke_own_side` 계약을 지킴(클래스를 바꾸는 첫 시도는 그 회귀가 좌석 클래스를 단언해 되돌림). 접근성 이름 앞말은 `상대 말 · `. 칸 · 격자 · fitBoard 하한은 무변경.
- **검사**: `smoke_issue316` 54/0 exit0. 실행 기록: ① 수정 직후 1회는 옛 단언(`상대 · `)이 남아 52/1(패치 실패), 단언을 고친 뒤 53/1(새 P1 단언의 픽스처에 공개 안 된 말을 씀 · 테스트 오류), 고친 뒤 54/0. 좌석 클래스를 되돌린 뒤 최종 54/0. 새 단언 R3-①e = 핫시트 P1 시점에서 내 말은 `own`(표식 없음), 공개된 P0 말은 `foe` + `상대 말`, CSS에 own 파랑 · `적` 규칙이 있음. typecheck · 전체 스위트는 새 우려가 없어 실행하지 않음. Jupiter 서버 730/206은 지시대로 재실행하지 않음.
- **실측**(Orca 내장 브라우저 · 본인 탭 · PD 8091 · 같은 출처 iframe · 오프라인 PVE · AI 지연 정지): 4성 노랑 상대와 전설 빨강 상대(수풀 칸)에 `적`이 보임. `.info`가 넘치지 않고(scrollWidth = clientWidth, HP 110 포함 · 첫 시도 padding 1px에서는 1px 넘쳐 0으로 줄임), 그림 아래 끝 ≤ 표식 줄 위 끝, 칩 안에 들어감. 390(칸 배율 0.819) · 320(0.615 · 칸 32px), 내 말 테는 rgb(51,64,110). 320에서 글자는 작지만 실제 기기 고해상도에서 더 선명할 것으로 추정(미확인).
- **B08 캡처**(320): 소유자 창을 열자마자 `⏱ 30초`, 2초 뒤 27초. 카드 4장 · 기권 없음 · 넘침 0. 상대 대기 창은 CJ 원문뿐(버튼 0 · 기권 없음). 이 창은 페이지 안 `NET` 표시 플래그만 켜서 그렸고 서버 · 소켓은 없음. 뒤에 보이는 기권은 보드 행동 줄의 것(유지 대상).
- **PNG**: `media/r3-board-foe-cycle-390.png`(교체), `media/b08-320.png`(현재 소유자 창으로 교체), `media/b08-wait-320.png`(신규). 본인 탭만 열고 닫았고 8091(200) · 8084 · Render 탭은 건드리지 않음.
- **미검증**: 실제 온라인 두 좌석 · 안드로이드 기기 · Saturn · 새 HEAD CI · CJ 플레이 QA.
