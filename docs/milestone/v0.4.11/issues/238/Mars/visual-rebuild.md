# #238 CJ 시각 REVISE — Mars 화면 재구성 보고

- 2026-09-28 · Mars(Claude Code) · required_role=Mars · mode=IMPLEMENT · area=CLIENT_TOOLING · mutation=code · instance_index=null · task `task_ad4dfd6666e6` / dispatch `ctx_9ec7a4272e08`
- 실행: PID 14612 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · JSONL `68aeacac-…` · Ponytail full · requested/effective 영수증 값 ALL NULL(받지 않음) · PD GO 뒤 착수
- 작업 트리 `issue-238-game-ui`(HEAD `e1bfdc2`) · Git 명령 0 · core.js·network.js·server·DB·계정 API 무수정
- 기준: CJ 최신 지시(로그인·가입·메인 로비·방 찾기·대기 로비·경기 시작 보드·상점 재구성, 전투만 보존, ~이력 토글 전부 삭제) · [Venus 시각 정렬 계약](../Venus/visual-alignment.md) · [구현 계약](../../../planning/2026-09-28-issue-238-ui-system.md) · [Earth_1 visual-contract](../Earth_1/visual-contract.md) · [Earth_2 manifest](../Earth_2/manifest.md)
- 기준 이미지 4장(`reference-game-lobby.png` · `cj-system-flow.jpg` · `cj-battle-flow.jpg` · `cj-shop-sketch.png`)과 Earth_1 proof v2를 직접 열어 대조했다.

## CURRENT — 3차 Saturn 시각 REVISE 좁은 수리 (task `task_fc280ea2f006` / `ctx_56a2a527a218`, fresh 세션)

- 2026-09-28 · Mars(Claude Code) · required_role=Mars · IMPLEMENT · CLIENT_TOOLING · mutation=code · instance_index=null · PID 36628 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · Ponytail full · requested/effective ALL NULL 유지 · PD GO 뒤 착수 · Git 명령 0
- 판정: 제품 **REVISE 유지** — fresh Saturn · CJ 전까지 PASS 를 주장하지 않는다. 입력은 Saturn `task27b3995c15c0`/`ctxf93840665082` 가 남긴 두 결함뿐이다.

| # | Saturn 결함 | 원인 | 고친 것 |
|---|---|---|---|
| 1 | 320×640 S03 말판 196px(61%) · 칸 28px · 좌우 빈 여백 | `fitBoard()` 가 play 단계에서 배율을 `(뷰포트 높이−셸)/700` 로 한 번 더 깎고, 보드 화면 `#screenBody{overflow-y:hidden}` 이라 스크롤도 막혀 있었다 | `fitBoard()` 높이 상한 삭제 → 폭 맞춤 `min(폭/376,1)` 만(호출처 uiDrawer·uiPrep·render·resize 그대로, 스크롤 위치 무접촉). CSS: 보드 화면 `#screenBody` 세로 스크롤 · `#left` 비수축 · 위 상태 HUD(시간·차례·코인)는 `sticky top:-8px` 로 스크롤 중에도 보임. 배치·상점·전투 규칙 무변경 |
| 2 | S04 에 MATCH COMPLETE/VICTORY/DEFEAT 문장(紋章) · 경기 종료 제목 · 승자 문장 · 승리 유형·턴·종료 공개·온라인 안내 · 오프라인 [다시 대전] | `renderSide()` over 분기 | 결과 = 승자(프로필·로스터·시너지) → VS → 패자 → **[로비로 돌아가기] 하나**. 승패가 좌석 Win!/Lose! 로 드러나지 않는 경우만 한 줄 사유: 무효(공개 방 null → 좌석 라벨도 "무효") · 무승부(sim 상한) · 몰수승/몰수패(`forfeit`) · 관전(sim) 승자. 접근성 제목 `경기 종료` 는 srOnly. `rematch()` 엔진 함수·`S.metrics`·`NET.final`·서버 필터·결과 아래 말판 숨김 그대로. 안 쓰는 `.resultCrest` CSS 삭제 |

- 테스트 변경(PD 승인 A, 옛 문장 단언만): `issue122_rules.js` A10b 옛 `onclick="rematch()"` 존재 → [로비로] 하나 · 버튼 없음 · `T.rematch` 함수 유지. `smoke_public_rooms.js` P4 옛 `종료 공개`+`VICTORY` → `NET.finalReveal===true` + 내 좌석 `win`·Win! · VS · 상대 Lose!, P5 옛 공개 방 안내 문장 → 버튼 1개=[로비로]·재대전·안내 없음. P6(몰수패)·`smoke_public_live` E2(`경기 종료`, srOnly 로 유지) 무수정.
- 검증(각 1회, 최종 CSS 후 238 smoke 재실행 1회): smoke_issue238 **86/0** · `npm run typecheck` **exit 0** · smoke_public_rooms **186/0** · issue122_rules 첫 실행 **91/2** — 실패 2건(A8 `id="log"`·`id="metrics"` 부재, E4 battleModal 의 `</details>` 정규식)은 이번 diff 가 아니라 앞선 #238 CJ 지시의 기록·지표 서랍·전투 이력 제거에서 온 낡은 단언이었다. minion/234/online/260/전체 suite 재실행 없음.
- 후속(같은 TUI 1회 재사용 · task `task_70eaf03d28e6` / `ctx_2cee926d025d`, PD GO 뒤): `issue122_rules.js` A8·E4 두 단언만 수정 — A8 = `sidePanel`·`board`·`turnBar` 존재 + `id="log|metrics|drawerLog|drawerMetrics"`·`uiDrawer('log'|'metrics')` **부재**, E4 = `battleModal` 본문의 `modal(` 호출이 정확히 1개이고 마지막 `id="bmenuBack"` 버튼 템플릿 바로 뒤 인자가 `[]`. 제품 소스·다른 테스트 무수정. 재실행 1회: **93/0**(91/2 → 93/0).
- 실제 브라우저(헤드리스 Chrome · 오프라인 PVE 픽스처 seed 31 · [geometry-r3.json](visual/geometry-r3.json)). "before" 는 이번 두 수정만 되돌린 **재구성 사본**이며 진본 기준선이라 주장하지 않는다.

| 장면 | before(재구성) | 수정 후 |
|---|---|---|
| S03 320×640 | 말판 195.5px · **61.1%** · 칸 27px · 스크롤 없음 ([png](visual/r3-s03-board-320-before.png)) | 말판 304.2px · **95.1%** · 칸 **42.1px** · 가로 넘침 0 · 스크롤 190px ([위](visual/r3-s03-board-320-new.png) · [끝줄](visual/r3-s03-board-320-new-lastrow.png)) |
| S03 432×932 | 367.4px · 85% · 50.8px | 376px · 87% · **52px** · 스크롤 4px ([위](visual/r3-s03-board-432-new.png) · [끝줄](visual/r3-s03-board-432-new-lastrow.png)) |
| 실제 탭(CDP 마우스) | — | 스크롤 전 (1,4) → 기록 (1,4) · 끝까지 스크롤 뒤 내 끝줄 (13,6) 말 → 기록 (13,6) · `S.selected`=그 말 · 탭 뒤 스크롤 유지(190/4). 13행 (13,1) HUD 에 가리지 않음 · 스크롤러 안 |
| 하단 행동 독 | 47×58(320)·66×58(432) 5개 화면 안 | 동일 |
| S04 320×640 | 문장·紋章·요약·[다시 대전] 135×76 ([png](visual/r3-s04-result-320-before.png)) | 금지 문자열 0 · 버튼 1개 [로비로] 276×52 화면 안 · 말판 숨김 ([위](visual/r3-s04-result-320-new.png) · [아래](visual/r3-s04-result-320-new-bottom.png)) |
| S04 432×932 | 동일 문장들 · 버튼 2 | 금지 0 · [로비로] 388×52 ([png](visual/r3-s04-result-432-new.png)) |
| B04 같은 픽스처 | [320](visual/r3-b04-battle-320-before.png) · [432](visual/r3-b04-battle-432-before.png) | [320](visual/r3-b04-battle-320-new.png) · [432](visual/r3-b04-battle-432-new.png) — overlayBox·#bstage·.bslot·버튼·img 좌표 JSON **완전 동일**(320·432). 캡처 시점은 두 쪽 모두 시작 카운트다운 중 |

- 정리: 임시 정적 서버 8751/8752·헤드리스 Chrome 9347(PID 4488·19904·20148, node 8724·34928·19404)만 띄우고 종료 확인. 8085 PID20592 · PG55462 PID38816 · 8084 PID4956 · 사용자 브라우저 무관. 픽스처·사본은 저장소 밖 scratchpad.
- 남은 한계: 320 에서 칸 42.1px(< 44, Earth_1 계약의 ~40–42 가능 범위) · 320 에서 전체 13행을 한 화면에 볼 수 없어 세로 스크롤 필요(요청된 동작) · 스크롤 중 위 HUD(110px@320)가 말판 위쪽 행을 덮으며 지나간다(스크롤하면 보임).

## 0. 이전 판정 — 2차 좁은 수리 (task `task_d6976a4bf80b` / `ctx_65aaf1b70c60`, 같은 TUI 15분 lease)

- 제품 판정은 **REVISE 유지**(PD 실제 화면 검토). 이 절은 당시 상태이고, 아래 1~6절도 1차 납품 기록(당시 한계 포함)으로 남긴다. CJ·CI·Saturn PASS 를 주장하지 않는다.
- 수신 확인: 착수 직후 check = count 0, GO 뒤 check 에서 `PD_MAILPROBE_238_REPAIR`(msg_67db066e3c85) 수신 → status 로 보고. 7건은 이 dispatch 본문 기준. 실행 PID 14612 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions`, requested/effective ALL NULL.

| # | PD 지적 | 고친 것 | 실측 근거 |
|---|---|---|---|
| 1 | 320 에서 필드가 3열 | 360 이하 미디어의 상점 3열 규칙 삭제, 출전 준비·상점 창 좌우 여백만 축소 | 320: 안쪽 298px · 필드 6칸 **한 줄** 각 47.2px · 가방 3 · 시너지 5+6 · 상품 8 · 가로 넘침 0 ([위](visual/s01-shop-320-top.png) · [중간](visual/s01-shop-320-mid.png) · [아래](visual/s01-shop-320-bottom.png)) |
| 2 | 시너지 설명이 title 뿐 | 칩 11개 = 44px `<button>` — 누르거나 Enter 로 그 칩의 단계 문장(Core `ecoSynView`·`synStage` 그대로)을 아래 한 줄 `#synWhy`(role=status)에 표시. 접힌 화면에 긴 문장 없음 | 320 칩 44×44 · 5/6 두 줄 유지 · CDP 실제 Enter → "불 1칸 · 미달 · (2)까지 1칸" ([키보드](visual/s01-syn-keyboard-320.png)) · 실제 터치 → "방어 0칸 · 미달 · (2)까지 2칸" ([터치](visual/s01-syn-touch-320.png)) |
| 3 | L01 대표 그림 ~190px | 그림 상자 310(432)/230(320)로 키우고 투명 여백만큼 겹침·위로 올려 발을 받침대 위에 | 보이는 몸 너비 246px = **57%**(432) · 184px = 57%(320) · 책·이벤트 버튼 44px 유지 ([432](visual/l01-lobby-432.png) · [320](visual/l01-lobby-320.png)) |
| 4 | 결과 아래 말판 전체 | 결과 화면 전용 CSS 로 `#left`·`#boardInfo` 숨김(값·final·기록 그대로) | 승자 → VS → 패자 → [로비로] ([432](visual/s04-result-432.png) · [320](visual/s04-result-320.png)) |
| 5 | 가입 순서 | 아이디 → 비밀번호 → 비밀번호 확인 → 닉네임 → 이메일(필수) · id·autocomplete·검증·API 그대로 | 입력 순서 실측 `acctId>acctPw>acctPw2>acctNick>acctEmail` ([432](visual/a02-signup-432.png)) |
| 6 | L03 32px 아이콘 확대 | 큰 카드는 고정 프리로드의 128 전투 도트(이미 받은 뒤·결손 아님일 때만, 아니면 종전 아이콘/이모지) — 새 요청 없음 | `assets/minions/land_std/battle.png` 96px 표시 ([432](visual/l03-wait-432.png)) |
| 7 | 🪙 네모 | 보이는 🪙 → Earth 코인 그림. 문자는 srOnly(`coinize`)·`data-n`(사이드 배지)으로 DOM·접근성에 그대로, 토스트·B08 선택 버튼은 실제 브라우저에서만 그림으로 바꾸고 textContent 불변. 가격·규칙 무변경 | 상점 안 보이는 🪙 글자 노드 **0**(모든 상점 장면) |

- 테스트 변경: smoke_issue238 A8 한 줄 — 예비 재화 문장을 태그 제거 뒤 문자로 대조(🪙 가 그림+srOnly 로 바뀐 표시 변경, 기대 문구 동일). 다른 테스트 무변경.
- 검증(각 1회): smoke_issue238 **86 / 0** · `npm run typecheck` **exit 0** (새 함수 `coinize`·`coinizeEl`·`uiSynWhy`·`hudSynHtml` 포함). 예산 밖 art/234/online_art·5개 suite 재실행 없음.
- 실패·재시도 증거: 1회차 캡처에서 320 아키타입 칩이 5+1 로 줄바꿈되고(49px) L01 발이 받침대 앞으로 내려갔다 → 칩 여백·위치 CSS 수정 뒤 다시 캡처 ([1회차 geometry](visual/geometry-repair2-pass1.json) · [1회차 L01](visual/l01-lobby-432-pass1.png) · [1회차 상점 아래](visual/s01-shop-320-bottom-pass1.png) → [최종 geometry](visual/geometry-repair2.json)).
- 보존: 전투(B04) CSS·구성 무변경 · 승인 아트 105/105 SHA 일치 · 소유 파일(game.css·ui.js·account.js·lobby.js·smoke_issue238 A8·이 보고서·visual/) 밖 쓰기 없음 · 새 이력 UI 없음 · 임시 서버(8741)·헤드리스 Chrome(9337) 정확한 PID 6개만 종료, 8085·PG55462·8084·사용자 브라우저 무관.
- 남은 한계: 결과 화면의 시너지 칩은 표시용(role=img, 툴팁) — 이번 2번 지적은 상점 범위라 버튼화하지 않았다. 320 보드 칸 44px 미만은 종전 고유 한계.

## 1. 화면별 변경 (확정)

| 화면 · 스케치 | 바뀐 것 | 파일 |
|---|---|---|
| T01 타이틀 · SYS 타이틀 | 로비 배경 위 Digit Duel 글자 로고 + 격자 보드 + 금색 **[로그인]** + 🔒 Google. 로그인·계정 없는 경로에서만 [시작 →] | index.html · account.js · game.css |
| A01·A02 로그인·가입·찾기 · SYS | 3탭 → ✕ 가 있는 모달 카드 1개, 카드 아래 링크 전환("아이디가 없으신가요? 회원가입" · "비밀번호를 잊으셨나요? 비밀번호 찾기" · "← 로그인으로"). 흐름·검증·서버 호출·오류 문구 무변경(표시 상태 `AUTH.sheet`만) | account.js · game.css |
| 로딩 | 로고 + 실제 완료 항목 수 진행 막대(자산 n/m + 계정 1 — 숫자 % 없음) + 달리는 기존 하수인 아이콘, 항목 3줄은 작게 | lobby.js |
| L01 메인 로비 · SYS + REF | 프로필·🏆전적·?·⚙🔒·나가기 → 재화 2칩(획득 🔒) → 미션🔒·하루에 한 판🔒 → 받침대 위 큰 대표 하수인(512 그림)·왼쪽 📘 전적 기록·오른쪽 ★ 이벤트🔒 → 금색 [멀티플레이]·[싱글플레이 🔒] → 하단 4탭(상점🔒·하수인🔒·로비(선택)·랭크🔒). 긴 안내 카드·잠금 격자·'최근 기록' 카드 제거, 공식 최근 20경기는 📘 아이콘이 여는 창(같은 데이터, 새 서랍 아님) | lobby.js · game.css |
| L02 방 검색 · SYS | '사용자 지정 게임' 줄 + ← · 🔍 방 이름 · [생성](방 만들기 창) · ↻ · 목록(인원·방 이름·상태·핑 4칸 막대, 진행 중 방 빗금 + 참가 불가) · 채팅 🔒 안내(입력 없음) | lobby.js · game.css |
| L03 방 대기 · SYS | 위 상대 카드 · VS · 아래 내 카드(👑·대표 그림·전적) · 채팅 🔒 · "상대를 기다리는 중…" 상태 칸 + [방 나가기]. 준비 버튼·등급·대기 시간 없음 | lobby.js · game.css |
| S01·M01 상점 · BAT + SHOP | 상단 한 판(⏱·코인·새로 고침·완료) → **한 줄 6행**(★ 등급·썸네일·짧은 이름·속성/아키타입 아이콘·코인 가격, 산 행 SOLD OUT 도장) → 필드 6칸 한 줄 → 가방 3 → 시너지 왕국 5 + 아키타입 6 아이콘 칩(단계 문장은 툴팁·접근성 이름) → 왕·동료 속성(왕국 아이콘) → 아이템 8 아이콘(4×2, 이름·설명은 툴팁) | ui.js · game.css |
| S03 보드 · BAT 보드 | 위 HUD: 나 vs 상대 · ⏱ 남은 시간(#actClock 이동) · 🔄 턴 · 코인 · 전투 n/2 · **내 시너지 요약**(달성한 것만, 소유자 값) · 한 줄 안내. 아래 아이콘 줄: 탐색·텔레포트·회복·상점(Dim + 남은 턴)·가방(서랍)·기권. [상세 ›]·[기록] 없음 | ui.js · ui-overlays.js(포커스 복귀 선택자) · game.css |
| S04 결과 · BAT 결과 | 승자 칸(프로필 + Win!) · VS · 패자 칸(Lose!) — 각 칸 보드 9 + 가방 + 시너지 아이콘 칩, 왕·동료 그림. 값은 종전대로 서버 `final`/Core 원값만 | ui.js · game.css |
| B04 전투 | **보존** — 바뀐 것은 ① '전투 이력' `<details>` 제거 ② 새 13종 그림 연결뿐 | ui.js · data.js |

**제거한 이력 토글**: 상단 [기록] · 📜 공개 기록 · 📊 경기 지표 서랍(index.html) · 전투 '전투 이력'(ui.js) · 로비 '최근 기록' 카드 · 보드 [상세 ›]. `S.log`·`S.metrics`·`B.blog`·`renderLog`/`renderMetrics`(null 안전화)·공식 전적은 그대로.

## 2. 자산 (확정 · 기술적 잘라내기/축소만, 새로 그리기·색 변경 없음)

- `demo/assets/minions/` 새 13폴더 × 5파일: `{fire,water,lightning,grass}_guard`, `land_{std,atk,def,swift,sustain,guard}`, `legend_{dragon,witch,reaper}`. Earth_2 원본(1254²) → 알파>1 경계로 자르기 → 기존 기준 상자(portrait 52..460 · grid 6..58 · icon 2..30)에 맞춤·바닥 정렬(해파리만 가운데). portrait 512 LANCZOS(png+webp) · battle-grid 64 BOX(면적 평균) · battle 128 = grid 최근접 2배(기존 파이프라인) · icon 32 BOX. 최근접 64/32는 비교 후 노이즈로 기각. Earth_2 검토용 [실크기 시트](new13-contact-128-32.png) — PD 전달 기준 Earth_2 PASS.
- `demo/assets/ui/ui-icons.png`(3072×64, 48칸 = Earth_1 A01~A24·B01~B24 순서, 프리멀티플 LANCZOS) · `demo/assets/ui/lobby-bg.webp`(1024×1536). 대응은 Earth_1 visual-contract 표를 따른다(std=B12 · 시너지=A24 · 상품=B15~B22 · 랭크=B01).
- 코드 연결: `data.js` 닫힌 목록 `ART_DIRS` 33(기존 20 파생식 그대로 + 10 + 전설 3), 전설은 공개 ID·`cap.legend` 키 표로만(`LEGEND_ART`·`LEGEND_ART_KEY`, hasOwnProperty 검사). 고정 프리로드 집합 70 URL(정체 무관). 오염·목록 밖 값은 종전 폴백.
- 승인 아트 105파일 SHA-256 `issue238-approved-art-before.json` 대조 **105/105 일치**.

## 3. 판단 · 한계

- [확정·PD 채택] 하단 탭 4칸 · 회복은 보드 6번째 아이콘 · 잠금 유지·채팅 새 기능 없음 · 📘 = 기존 공식 20경기.
- [추론] 가방 아이콘은 Earth 계약("기존 가방 자원")대로 🎒 유지 — 상점과 같은 A03 가방을 두 번 쓰지 않았다.
- 한계(≤10줄):
  1. 🪙 문자는 헤드리스 Chrome·Windows 10 글꼴에 없어 네모로 보인다 — 가격·잔액·HUD는 Earth 코인 아이콘으로 바꿨고, 회귀가 문자열을 고정한 곳(예비 재화 문장·판매 +🪙·토스트)은 문자 그대로다.
  2. 행동 버튼 textContent(🌀 텔레포트 등)는 회귀 계약이라 그대로 두고 `data-lb` 짧은 라벨 + 아이콘으로 보인다.
  3. 320px 보드 칸은 44px 미만(종전과 같은 고유 한계, Earth 계약 명시). 보드 외 모든 조작 44px 이상, 17장면 가로 넘침 0.
  4. L03 상대 전적은 서버가 방에 주지 않아 닉네임·대표 그림만(새 API 없음).
  5. 옛 전투 비교본은 Git 없이 scratch 사본에서 내 전투 관련 변경 3가지(테마 CSS 절·13종 연결·전투 이력 줄)만 되돌려 만든 재구성이다.
  6. smoke_issue260 은 통과 뒤 id 3개·포커스 호출만 바꿔(typecheck 수정) 다시 돌리지 않았다. smoke_issue259·public_rooms·236·263_client·262 는 예산 밖이라 미실행 — 고정 문자열·속성 순서는 정적으로 맞췄다.
  7. 이 화면들은 오프라인 픽스처(계정·DB 호출 없음) 렌더다. 실제 로그인 서버·두 클라이언트 온라인 표시는 미확인.

## 4. 검증 (각 1회 · 실패 수정 시 해당 명령만 재실행)

| 검사 | 결과 |
|---|---|
| smoke_issue238 (C절 행동 줄 이동·E3 아키타입 칩 라벨·J절 신설: 이력 토글 0·33폴더·전설 경계·파일 실재·상점 6행) | 86 / 0 |
| smoke_minion_art (PD 승인 줄: A1·A2·A3/A11 라벨·A4·I4·K2 필터=기존 20) | 208 / 0 |
| smoke_issue234 (PD 승인 A16·A17) | 354 / 0 |
| smoke_online_art (PD 승인 B1~B4·F6 라벨 44→70) | 101 / 0 |
| smoke_issue260 (로비·계정 패널 영향) | 74 / 0 |
| `npm run typecheck` | 1차 exit 2(새 코드 `Element.focus` 4건) → `$()` id 조회로 수정 → 재실행 exit 0 |

## 5. 시각 증거 (오프라인 픽스처 · 헤드리스 Chrome 153 · [geometry.json](visual/geometry.json))

| 장면 | 432 | 320 |
|---|---|---|
| 타이틀 · 로그인 · 가입 · 로딩 | [t01](visual/t01-title-432.png) · [a01](visual/a01-login-432.png) · [a02](visual/a02-signup-432.png) · [load](visual/t01-loading-432.png) | — |
| L01 · L02 · L03 | [l01](visual/l01-lobby-432.png) · [l02](visual/l02-rooms-432.png) · [l03](visual/l03-wait-432.png) | [l01](visual/l01-lobby-320.png) · [l02](visual/l02-rooms-320.png) |
| S01 · M01 · S03 | [s01](visual/s01-shop-432.png) · [m01](visual/m01-shop-432.png) · [s03](visual/s03-board-432.png) | [s01](visual/s01-shop-320.png) · [s03](visual/s03-board-320.png) |
| B04 같은 픽스처 전·후(전투 상자만) | [old](visual/b04-battle-old-432.png) → [new](visual/b04-battle-new-432.png): 배치·카드·버튼 동일, 땅 하수인 그림 연결·'전투 이력' 제거만 다름 | — |
| S04 결과 | [s04](visual/s04-result-432.png) | [s04](visual/s04-result-320.png) |

geometry: 17장면 모두 `overflowX:false`, 새 화면의 보이는 조작 44px 미만 0건(옛 비교본의 32px ←는 되돌린 옛 CSS의 상단 바이며 전투 상자 밖).

## 6. 남은 것

Saturn 독립 시각·회귀 QA(스케치 행별 대조 · 예산 밖 회귀 5종) · 필수 CI · CJ 플레이 QA.
