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
