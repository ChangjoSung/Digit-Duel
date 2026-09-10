# #122 · #124 · #126 — CJ QA REVISE 구현 기록 (Mars · Claude)

2026-09-10 · Mars(Claude Code) 구현 보고. **CJ 재검수·Saturn 독립 검수 전이다.** 이 문서는 무엇을 바꿨고 무엇을 실제로 확인했는지만 적는다. PR160의 이전 PASS는 이번 수정의 검수로 재사용하지 않는다.

## 기준

| 항목 | 값 |
|---|---|
| 출발 dev | `2055d5a9344f1476e87c3fb9dd19104a643bfe50` |
| 출발 HTML blob | `6bd3bed5bcbeda415b7d43591371ab77e5d31045` |
| 결과 HTML blob | `2a2c26da1728935ec024253ef9fad44945e3eabf` (`git hash-object demo/index.html`) |
| 동결 커밋 | `21637d1720a67c0400a2025ee8dad585d231ba15` (PD 커밋 · 이 소스로 튜토리얼·README 증빙을 찍었다) |
| 브랜치 | `fix/122-back-dark-theme` (Git 쓰기는 Mercury) |
| Run / Task | `run_593b37fa6871` / `task_7753c02bba5e` · dispatch `ctx_eb4e86fbc67d` |
| 역할 | Mars / IMPLEMENT / HTML·CLIENT·TOOLING / code·docs / instance_index=null |

## CJ 요청 두 가지에 대한 대응

### 1. 좌상단 뒤로가기

`#appBar` 의 **첫 요소**로 `#btnBack` 을 넣었다. 화면마다 문구와 설명(title·aria-label)이 바뀌고, 어디로 가는지를 문구가 밝힌다.

| 화면 | 문구 | 하는 일 |
|---|---|---|
| 타이틀 | (없음) | 이전 화면이 없다 — 상단 바 자체가 숨겨져 있다 |
| 로비 | `← 타이틀` | `UI.entered=false` (표시 상태만 · 게임 객체 유지) |
| 준비 · 매칭 대기 | `← 대기 취소` | 기존 `netCancelQueue()` — **배치 유지** |
| 준비 · 배치 단계 | `← 로스터` | `uiPrep("roster")` — 로스터·배치는 `S` 안에 그대로 |
| 준비 · 로스터 단계 | `← 로비` | 사라질 준비가 있을 때만 확인 모달 → 확정 시 `toLobby()` |
| 보드 · 서랍 열림 | `← 닫기` | `uiDrawer(null)` — **서랍부터 닫는다** |
| 보드 · 대전 중 | `←` | **`toLobby()`·초기화를 부르지 않는다.** 기존 `confirmResign()` 으로만 간다 |
| 보드 · sim 관전 | `← 관전 종료` | 기권할 주체가 없으므로 확인 후 로비 (승패 규칙 신설 없음) |
| 결과 | `← 로비` | 연출 잠금(`fxLocked()`) 중에는 무시, 아니면 `toLobby()` |

지키는 세 가지 — 소스에서도 회귀로 못박았다:

1. **되돌리기가 아니다.** `uiBack` 본문에 `newGame(` · `S.phase=` · `netLeave(` · `location.reload` 가 없다 (back_nav E1).
2. **주인을 빼앗지 않는다.** `#overlay` 또는 `#tutOverlay` 가 열려 있으면 아무 일도 하지 않는다 — 전투 모달·기기 넘김·메모 피커·패키지 선택을 덮어쓰지 않는다.
3. **경기 중 새 출구가 없다.** AI 턴·온라인 상대 차례에는 무동작(토스트만), 사람 자기 차례면 기존 기권 확인. 취소하면 경기가 그대로 이어진다.

전투 화면 안의 `← 뒤로` 는 **핸들러를 바꾸지 않고**(계속 `window.__menu(null)` 시맨틱 호출, 모달 `buttons` 는 빈 배열) 자리를 하위 패널 안에서 **전투 패널 제목 왼쪽**으로 올렸다. 하위 메뉴가 열렸을 때만 보이고, 전투 루트에 강제 이탈 버튼은 만들지 않았다. 실측 위치는 전투 패널 좌상단에서 위 15px · 왼쪽 15px 이다.

PD 지적 2건 반영:

- **확인창 소유권** — 확인/취소 콜백이 `close()` 보다 **먼저** 소유권을 검사한다(`uiAskMine(tok,game)`: `UI.ask` 토큰 + 게임 세대). 다른 `modal()` 이 오버레이를 가져가면 옛 버튼은 `close()` 조차 부르지 않는다.
- **관전 확인창을 AI 가 덮어쓰는 문제** — `aiStep` 은 오버레이를 보지 않으므로 약 `simDelay` 뒤 AI 가 다음 수를 두며 확인창을 밀어낸다. 확인창이 떠 있는 **동안에만** AI *예약 실행*을 큐에 담아 두고(`UI.hold`/`UI.holdQ`), 취소하면 그대로 재개한다. `aiPending` 플래그를 세운 채로 미루므로 중복 예약이 없고, 확인창이 다른 경로로 사라지면(`modal()`·`close()`) 보류가 함께 풀린다. **AI 판단·난수·승패·시간표는 바뀌지 않는다** — 언제 두는가만 미룬다.

### 2. 어두운 배경

`:root` 13개 토큰 값을 **리스킨 직전 소스(`2055d5a~1`)의 팔레트 그대로** 되돌렸다. 이 값은 그동안 `#tutOverlay` 안에서만 보존되던 값과 같아, 승인된 튜토리얼 10단계 화면의 계산 결과가 바뀌지 않는다.

`--bg:#12151c` · `--panel:#1c2130` · `--panel2:#242b3d` · `--line:#333c52` · `--txt:#e8ecf5` · `--dim:#8a93a8` · `--accent:#5b8cff` · `--danger:#ff5b6e` · `--ok:#4fd88a` · `--zoneA:#2a3350` · `--zoneB:#502a33` · `--forest:#1f3a2a` · `--mid:#2a2f3d` (+ 속성 4색·상태 3색)

토큰만으로는 안 되는 하드코딩 아이보리 표면도 함께 고쳤다.

| 표면 | 종전 | 지금 |
|---|---|---|
| 일반 칸 테두리 | `#d9cfb8` | `#39415a` |
| 진영 칸 테두리 | `#c3cee4` / `#e6c8bf` | `#3c4870` / `#6d3a45` |
| 수풀 실루엣 3개 | `#63a45c`·`#74b268`·`#86c377` | `#3f7a4b`·`#4a8c56`·`#589c60` (바탕 `--forest` 는 어두운 값) |
| 선택 강조 외곽선 | `#1b2a44` (어두운 판에서 안 보임) | `#e8ecf5` |
| 전투 무대 하늘 | `#dcefff→#e9f5e0→#d9ecc9` | `#16203a→#1b2b3c→#1f3a2a` |
| 전투 발판 타원 | 밝은 연두 | 어두운 초록 |
| 전투 HP 판 | `#faf6ecf2` | `#1c2130f2` |
| 전투 메시지 창 | `#fffdf4` | `#10192b` |
| HP·방어막·피해 막대 빈 구간 | `#00000018` | `#0b0f18` |
| 피해 수치 그림자 | 흰 그림자 | 검은 그림자 |
| 전투 이력·일러스트 바탕 | `#00000010` | `#00000055` / `#0000004d` |

가독성 보정 2건(**새로 추가한 것**, 종전 상태를 그대로 두지 않았다):

- `--accentFill:#2f5fd0` 토큰을 새로 두고 **채우기 버튼**(`button.primary`·눌린 탭·눌린 서랍 버튼·눌린 메모 선택)만 여기에 묶었다. `--accent(#5b8cff)` 위의 흰 글자는 실측 3.16:1 로 본문 기준(4.5:1)에 못 미쳤고, **보정 후 5.72:1** 이다(PD 독립 계산 5.724:1). **`#tutOverlay` 안에서는 `--accentFill` 을 `--accent` 로 되돌려** 승인된 튜토리얼 화면의 버튼 색을 바꾸지 않았다.
- 아트가 없거나 로드에 실패해 **원형 이모지 폴백 토큰**으로 되돌아가면 그 원의 바탕이 속성색이 된다. 번개 `#ffd84d` 위의 흰 이름표는 약 1.2:1 로 사실상 읽히지 않았다. 그림자만으로는 모자라 **이름표에 어두운 알약 바탕**(`#0b0f18e0`)을 깔았다 — 알약이 알파 `e0`(224/255 ≈ 0.878)라 **아래 속성색과 합성한 뒤**의 대비는 불 **15.08:1** · 번개 **13.74:1** 이다(PD 독립 계산 15.043 / 13.657 — 차이는 합성값 반올림 자리뿐). 토큰 크기·자리·이모지·불투명도는 그대로다. 128px 스프라이트 이름표도 같은 알약을 쓴다.

### 손대지 않은 것

보드 기하(7×13 · 칸 52px · `--bs` 배율) · 말 규격(48/32/11) · 말 정체·HP 표시 · **수풀 은폐 판정(`visibleTo`)과 수풀 속 양측 말 반투명 50%/70%** · 왕·동료 아트 · 전투 무대 높이(288px)와 양측 판 배치 · `#125`·`#126` 연출 상수(`resultBanner 2500` · `damageFx 1200` · `barStep 350`) · 규칙·난수·온라인 프로토콜 · `#128` 튜토리얼 표시 정책 · 저장소 사용자 값.

## 실제로 돌린 것과 결과

| 명령 | 결과 |
|---|---|
| `node demo/test/milestone/v0.4.7/issues/122/back_nav.js` | **pass 113 / fail 0** (신규) |
| `node demo/test/milestone/v0.4.7/issues/122/issue122_rules.js` | pass 93 / fail 0 |
| `node demo/test/regression/smoke_turnflow.js` | pass 203 / fail 0 |
| `node demo/test/regression/smoke_turnflow_timers.js` | pass 36 / fail 0 |
| `node demo/test/regression/smoke_ai_completion.js` | pass 59 / fail 0 (sim 13판 완주) |
| `node demo/test/regression/smoke_tutorial.js` | pass 135 / fail 0 |
| `node demo/test/regression/smoke_online.js` | pass 157 / fail 0 |
| `node demo/test/regression/smoke_online_sync.js` | pass 23 / fail 0 |
| `node demo/test/regression/smoke_fx_timing.js` | pass 82 / fail 0 |
| `node demo/test/regression/smoke_minion_art.js` | pass 205 / fail 0 |
| `node demo/test/regression/smoke_issue114.js` | 16 groups passed |
| `node demo/test/regression/smoke_issue146.js` | pass 208 / fail 0 |
| `node demo/test/regression/smoke_cycle5.js` | pass 69 / fail 0 |
| `node demo/test/regression/smoke_memo.js` | pass 122 / fail 0 |
| `node demo/test/regression/smoke_orientation_audit.js` | pass 8920 / fail 0 |
| `node demo/test/regression/smoke_own_side.js` | pass 66 / fail 0 |
| `node tools/milestone/v0.4.7/issues/122/back_dark_shots.js` | **pass 69 / fail 0** (헤드리스 Chrome · 실제 클릭 · PNG 14장) |
| `node tools/media/readme_media_capture.js capture --ref 21637d17…` | 튜토리얼 10장 + 매니페스트 재촬영 · 문제 0건 |
| `node tools/media/readme_media_capture.js verify --read-only --no-gh --no-render --manifest <새 경로>` | 문제 0건 (CI 잡 C 와 같은 인자) |
| `… verify --viewport 1100x900` / `… --viewport 390x844` | 각각 문제 0건 |

돌리지 않은 것: 나머지 회귀 5종(`smoke_attack_balance`·`smoke_cross_skill`·`smoke_shock`·`smoke_search_packages`·`smoke_testclient`)은 밸런스·기술 수치 계약이라 이번 표시 계층 변경과 접점이 없어 CI 잡 A 에 맡겼다. 같은 폴더의 `ui_cdp.js` 43장은 **다시 찍지 않았다** (이전 납품 증빙 보존).

## 증빙 (실촬영 · 390 / 360 / 데스크톱)

[`media/`](media) — PNG 14장 + [`media/back_dark_report.json`](media/back_dark_report.json)(실측 계산색·대비비·가로 넘침·버튼 좌표).

| 파일 | 무엇 |
|---|---|
| `01-lobby-390.png` | 로비 — 어두운 패널, 좌상단 `← 타이틀` |
| `02-prep-place-390.png` · `03-prep-roster-390.png` | 배치 → 로스터 (선택 보존) |
| `04-prep-confirm-390.png` | 준비 취소 확인 — 어두운 안내창 |
| `05-board-390.png` | 보드 — 어두운 판·상태 줄·하단 행동 독 |
| `06-board-drawer-390.png` | 서랍 열림 — 뒤로가기가 `← 닫기` |
| `07-resign-confirm-390.png` | 대전 중 뒤로가기 → 기존 기권 확인 |
| `08-battle-390.png` | 전투 — 어두운 무대, 제목 왼쪽 `← 뒤로`, 뒤 배경은 보드 셸 |
| `09-result-390.png` | 결과 — 어두운 결과 카드 |
| `10-board-360.png` · `10-board-desktop.png` | 360 · 1280 가로 넘침 0 |
| `11-bush-390.png` | 수풀 속 **양측** 말 반투명 유지 (내 말·상대 `?` 둘 다) |
| `12-battle-fallback-390.png` | 아트 실패 폴백 — 번개·불 원형 토큰 이름표 가독성 |
| `13-sim-confirm-390.png` | sim 관전 종료 확인창 (실제 타이머로 유지되는 것을 확인한 화면) |

폴백 토큰은 자산 파일을 건드리지 않고 **제품의 실제 실패 경로**(`ART.failed` 에 종 폴더를 넣으면 제품이 스스로 이모지 토큰으로 되돌아간다)를 태워 찍었다.

실측 대비비(WCAG 상대휘도 · 실제 계산색 · **알파 합성 반영**):

| 표면 | 대비 |
|---|---|
| 앱 바탕 · 하단 행동 독 · 확인창(제목·본문) · 전투 HP 판 | 13.55:1 |
| 전투 메시지 창 | 14.84:1 |
| 상태 줄 · 전투 명령 버튼 | 11.93:1 |
| 일반 칸 | 10.52:1 |
| **채우기 버튼**(로비 기본 버튼 · 확인창 버튼) | **5.72:1** |
| 로비 카드 설명 | 4.58:1 |
| 폴백 토큰 이름표 — 불 / 번개 | 15.08:1 / 13.74:1 |

**측정 한계(정정 이력)**: 이 도구의 첫 판은 알파가 0.6 을 넘으면 불투명으로 취급해, 반투명 표면이 **아래 색과 섞이기 전** 값을 그대로 대비로 냈다. 그래서 폴백 이름표를 17.55:1 로, 채우기 버튼을 11.93:1(실은 상태 줄·명령 버튼 값)로 잘못 보고했다. 지금 판은 조상 사슬을 알파 1 을 만날 때까지 훑어 아래에서 위로 합성한 뒤 잰다. 위 표와 `media/back_dark_report.json` 은 합성 반영 값이다.

가로 넘침 실측 범위(`scrollWidth == innerWidth`): **390 = 로비 · 보드 · 전투** / **360 · 1280(데스크톱) = 로비 · 보드**. 360·1280 의 전투 화면은 재지 않았다.

## 한계 — 자동 검사로 주장하지 않는 것

- **실기기 실플레이와 CJ 수락은 이 문서가 대신하지 않는다.** 여기 있는 것은 헤드리스 Chrome 한 대에서 잰 값이다.
- 온라인 PVP 는 헤드리스 스모크(`smoke_online`·`smoke_online_sync`)로만 봤고 실제 두 기기 접속으로 뒤로가기를 눌러 보지 않았다. 다만 뒤로가기의 온라인 갈래는 기존 `netCancelQueue()`·`confirmResign()` 가드를 그대로 타며, 상대 차례에는 무동작이다.
- 색 판정은 `getComputedStyle` 기준이다. 실제 패널의 감마·밝기 설정에 따른 체감은 사람 검수 몫이다.
- **튜토리얼 10장은 픽셀이 같지 않다.** 아래 별도 절에 관측과 처리 결정을 적었다.
- `back_nav.js` 의 sim 보류/재개 판정(F6·F7)은 **헤드리스 DOM 스텁의 가짜 타이머** 기준이다. 실제 브라우저의 실제 타이머 확인은 `back_dark_shots.js` 의 S1~S7 이 따로 한다 (PD 지시로 그 이상 확장하지 않았다).

## 튜토리얼 10장 — 관측과 처리

동결 커밋 `21637d17` 로 재촬영해 기존 `docs/milestone/v0.4.7/issues/122/Mars/media/tutorial-01..10.png` 와 대조했다.

- **바이트 동일 0/10.** 같은 기기·같은 Chrome 에서 **변경 전 소스(`2055d5a`)로 돌린 대조군은 10/10 동일**이므로, 환경 드리프트가 아니라 이번 변경이 원인이다.
- **레이아웃·내용은 그대로다.** 10단계 모두 제목·카드 수·`#tutBox` 크기(예: 1단계 1080×414 · 5단계 1080×785)·클립 크기(2224×1636)·세로 스크롤 여부가 전부 일치한다. 규칙 문안은 손대지 않았고 `smoke_tutorial` 135/0 이다.
- **차이 위치**: 클립을 `#tutBox` 사각형 자체로 좁혀도 10단계 모두 바이트가 다르다. 즉 여백 링만의 문제가 아니다. 다만 `#tutOverlay` 스크림은 `#000d`(약 87% 검정)라 그 뒤 페이지가 13% 비쳐 보이고, 그 페이지가 아이보리에서 어두운 색으로 바뀌었다 — 둥근 모서리(`border-radius:12px`)의 안티에일리어싱 화소가 이 배경과 섞이므로 상자 경계에서 값이 달라진다는 것이 가장 그럴듯한 설명이다. **이것은 검증한 사실이 아니라 가설이다** — PD 지시로 여기서 조사를 멈췄다.
- **처리(PD 결정)**: 옛 픽셀에 억지로 맞추지 않고 **새 10장을 납품**한다. [`tutorial/`](tutorial) 에 `tutorial-01..10.png` 와 `capture-manifest.json`(촬영 ref `21637d17` · blob `2a2c26da` · 1280×900 · dpr 2)을 두었고, 기존 10장은 그대로 보존한다. **실제 픽셀이 같다고 주장하지 않는다.**

## README 검증

PD 가 README 참조 20곳과 매니페스트 링크를 새 경로로 옮겨 동결했다. 동결 SHA256 `05E8F7C0CB7FDD26419BC61A800F3A20A9127AC46E80E3E0B2251C42CC8510B2` 를 실제로 확인한 뒤 렌더했고, 렌더 전후 README 는 바뀌지 않았다(도구 WRITE-CHECK).

| 실행 | 결과 | 산출물 |
|---|---|---|
| `verify --read-only --no-gh --no-render` (CI 잡 C 와 같은 인자) | 문제 0건 | 없음 |
| `verify --viewport 1100x900` | 문제 0건 · 갤러리 이미지 10/10 로드 | [`readme-1100/`](readme-1100) |
| `verify --viewport 390x844` | 문제 0건 · 갤러리 이미지 10/10 로드 | [`readme-390/`](readme-390) |

CI 잡 C 의 `--manifest` 인자 **1곳**을 새 `tutorial/capture-manifest.json` 으로 바꿨다. 앞선 #105·#146·#122(1차) 매니페스트와 PNG 는 그대로 보존한다.

## 임시 자원 정산

- 헤드리스 Chrome: 실행마다 `os.tmpdir()` 에 **자기 프로필 하나만** 만들고, 종료 시 그 PID 와 **그 정확한 절대경로만** 지운다(각 실행 로그의 `CLEANUP` 행). 접두사·와일드카드로 다른 주체의 자원을 건드리지 않는다. 최종 확인: `i122bd-*` · `readme-media-profile-*` 잔존 0개.
- 조사용 임시 스크립트 3건(폴백·전투 대기 상태 probe, 튜토리얼 클립 대조, `git show` 사본)은 세션 스크래치패드에만 두었고 **전부 삭제**했다. 저장소에는 남기지 않았다.
- 사용자 브라우저 프로필·Downloads·승인된 아트·다른 부서 파일·기존 증빙은 읽지도 지우지도 않았다.

## 파일 동결

이 시점의 내 산출물은 아래가 전부이며 더 바꾸지 않는다 (Saturn 최종 지적이 오면 그때만 반영).

| 경로 | 상태 |
|---|---|
| `demo/index.html` | 커밋 `21637d1` · blob `2a2c26da…` — **제품 소스 변경 없음** |
| `demo/test/milestone/v0.4.7/issues/122/back_nav.js` | 커밋 `21637d1` |
| `.github/workflows/ci.yml` | 잡 A 한 줄 추가(커밋됨) + 잡 C `--manifest` 1곳 변경(미커밋) |
| `tools/milestone/v0.4.7/issues/122/back_dark_shots.js` | 신규 (미커밋) |
| `docs/milestone/v0.4.7/issues/122/Mars/revise-back-dark/` | 신규 — `report.md` · `media/`(PNG 14 + JSON) · `tutorial/`(PNG 10 + manifest) · `readme-1100/` · `readme-390/` |

## 후속

- CI 잡 A 에 `back_dark_shots.js` 는 넣지 않았다 (브라우저 필요). 헤드리스 계약 `back_nav.js` 만 잡 A 에 한 줄 추가했다.
