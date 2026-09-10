# [Earth 요청] Digit Dual Roblox — AI 봇 대전·보드게임 창 아트 납품 요청

> **사용법**: `--- PROMPT ---` 이후 전체를 Codex(Earth 역할) 세션에 붙여넣는다.
> 작성: Mars (Claude Code) 2026-09-10 · Ref #118 (v0.4.6 Roblox 포팅 Phase 3) · 선행 요청서 `earth-art-request.md`(2D 자산) · `earth-lobby-request.md`(3D 로비) 와 별개
> 배경 문서: `roblox/구조.txt` (CJ 화면 구조 지시) · `docs/roblox/port-plan.md` Phase 3

--- PROMPT ---

## dispatch preflight

| 필드 | 값 |
|---|---|
| required_role | **Earth** (Art, Codex) |
| mode | IMPLEMENT |
| area | ART |
| mutation | assets / docs (코드 수정 금지) |
| instance_index | null |

역할 계약(CLAUDE.md rev 6): Earth는 아트 자산·문서만 만든다. Luau·JS·Python 코드 작성·수정 금지, 기획 결정 대체 금지(불명확하면 `[기획 필요]`), git 쓰기 금지. `worker_done`으로 Mercury에 보고.

## 1. 배경 — 무엇이 새로 생겼나

CJ 지시(`roblox/구조.txt`, 2026-09-10)로 Roblox 화면 구조가 바뀌었고 **AI 봇 대전**이 추가됐다. Mars 가 코드는 전부 구현했고, 아래 요소는 **임시 그래픽(기본 Part·기존 패널 이미지·텍스트)** 으로 동작 중이다. 이 요청서는 그 임시 그래픽을 교체할 자산 목록이다.

| 화면 요소 | 지금 (임시) | 원하는 것 |
|---|---|---|
| **보드게임 창** (720×592, 화면 중앙) — 왼쪽 2D 판(280×520, 40px 셀) · 오른쪽 배치/대전 패널(388 폭) | 기존 `ui/panel_side` 9-slice 재사용 | 창 전용 프레임 (제목 띠·판 영역·패널 영역이 구분되는 9-slice) |
| **AI 봇 착석 더미** (맞은편 의자에 앉은 로봇) | 회색 상자 몸통 + 머리 + 네온 눈 (Part 3개) + 머리 위 이름표 | 로우폴리 로봇 메시 1종 (앉은 자세) — 5급/5단은 틴트·배지로 구분 |
| **봇 난이도 배지** 5급 / 5단 | 텍스트 "🤖 AI 5급" | 24·48px 배지 아이콘 2종 |
| **"🤖 AI 행동 중…" 표시** | 텍스트 | 24px 인디케이터 아이콘 (정적 1장 + 선택: 4프레임 스프라이트) |
| **[나가기] 버튼 아이콘** | `actions/resign_48` 재사용 | 문(exit) 48px |
| **[🤖 5급 봇] [🤖 5단 봇] 버튼 아이콘** | 없음(텍스트만) | 로봇 얼굴 48px |
| 창 왼쪽 판의 셀 타일 (40px 셀) | 기존 `board/tile_*`(128) 축소 | 변경 불필요 — 그대로 축소 사용. **요청 없음** |

**절대 바꾸지 않는 것**: 게임 규칙·수치·하수인 디자인(승인된 도트 그대로)·기존 납품 자산의 파일명/키.

## 2. 반드시 읽을 참조

1. `roblox/구조.txt` — CJ 가 지시한 화면 흐름 (2인 대전·AI 대전)
2. `roblox/src/client/init.client.luau` — `win`(보드게임 창)·`setupPanel`·`side` 레이아웃 치수 (검색어: `WIN_W, WIN_H`)
3. `roblox/src/server/Lobby.luau` `Lobby.setBotSeat` — 봇 더미 위치·크기 (의자 CFrame 기준 몸통 y+1.2 · 머리 y+2.75)
4. `roblox/assets/ui/README.md` — UI 9-slice 적용 계약 (SliceCenter 좌표·SliceScale)
5. `roblox/assets/manifest.csv` · `roblox/assets/lobby/manifest.csv` — 기존 납품 형식 (행을 **추가**한다, 기존 행 수정 금지)
6. `docs/minion-visual-spec-v0.4.3.md` 7장 — 시각 검수 원칙 (IP 비연상)
7. `ASSET-LICENSE.md`

## 3. 납품 목록 (코드가 읽는 키 — 파일명·키를 정확히 맞춘다)

업로드 도구(`roblox/tools/upload_assets.js`)는 manifest 의 `kind`,`id` 로 `AssetIds.luau` 키 `<kind>_<id>` 를 만든다. 코드는 **아래 키가 없으면 지금의 임시 그래픽으로 자동 폴백**하므로 일부만 먼저 납품해도 된다.

### 3-1. 2D UI (PNG, RGBA, 픽셀 아트 톤 — 기존 UI 자산과 같은 스타일)

| # | kind | id | 파일 (roblox/assets/…) | 크기 | 9-slice | 용도 · 코드 키 |
|---|---|---|---|---|---|---|
| 1 | `ui` | `panel_window` | `ui/panel_window.png` | 256×256 | 필수 (SliceCenter 예: 24,40,232,232 — 위 40px 는 제목 띠) | 보드게임 창 배경 `Art.ui("panel_window")` |
| 2 | `action48` | `exit` | `actions/exit_48.png` | 48×48 | — | [나가기] 버튼 `Art.action("exit")` |
| 3 | `action48` | `bot` | `actions/bot_48.png` | 48×48 | — | [🤖 봇] 버튼·창 상태줄 `Art.action("bot")` |
| 4 | `badge48` | `ai_grade5` | `badges/ai_grade5_48.png` | 48×48 | — | 5급 봇 배지 (더미 이름표·창 제목) `Art.badge("ai_grade5")` |
| 5 | `badge48` | `ai_dan5` | `badges/ai_dan5_48.png` | 48×48 | — | 5단 봇 배지 `Art.badge("ai_dan5")` |
| 6 | `status48` | `thinking` | `status/thinking_48.png` | 48×48 (선택: `thinking_sheet_192x48.png` 4프레임) | — | "AI 행동 중" 인디케이터 `Art.status("thinking")` |

- 팔레트: `demo/index.html` `<style>` 의 다크 UI (`--panel #181b25` 계열·라인 `#2b3140`·강조 `#5b8cff`). 5급 = 파랑 계열, 5단 = 금/주황 계열로 등급 차이가 한눈에 보이게.
- 배지·아이콘은 2px 아웃라인 + 단색 배경 없이 알파 투명.

### 3-2. 3D 봇 메시 (FBX — 기존 로비 메시 규격과 동일)

| # | kind | id | 파일 | 규격 | 용도 |
|---|---|---|---|---|---|
| 7 | `mesh` | `bot` | `lobby/meshes/bot.fbx` (+ `.obj` 대안) | 앉은 자세, 높이 ≈ 3.2 studs, 폭 ≤ 1.8, 삼각형 ≤ 3,000, Y-up, 1 unit = 1 stud, 피벗 **엉덩이 바닥 중앙**(의자 앉는 면에 놓임), 앞(-Z)이 판을 향함 | 봇 착석 더미 `Art.lobbyMeshId("bot")` → `Lobby.placeMesh("bot")` |
| 8 | `texture` | `bot_albedo` | `lobby/textures/bot_albedo.png` | ≤ 1024×1024, 밝은 회색 기반 (Roblox `Color3` 틴트로 5급/5단 색 구분) | 위 메시 알베도 |

- 기존 로비 메시(`chair`·`board`·`wall`)는 FBX Z 반전 때문에 코드에서 180° 돌려 쓰고 있다(`MESH_YAW`). 봇 메시는 **Blender 에서 -Z 가 정면**이 되게 내보내고, 검수 스크린샷에 정면 방향을 표시한다.
- 로봇 디자인 원칙: 기존 하수인 도트와 톤이 맞는 둥근 로우폴리. 특정 IP(트랜스포머·월-E 등) 연상 금지.

## 4. 납품 형식

1. 파일을 위 경로에 두고 `roblox/assets/manifest.csv`(2D) · `roblox/assets/lobby/manifest.csv`(메시·텍스처)에 **행 추가** (열은 기존 행과 동일, `status=delivered`).
2. `docs/art/roblox-v0.5.0/earth-ai-window-report.md` 에 검수 스크린샷·프롬프트·라이선스 출처를 기록한다 (기존 `earth-ui-report.md` 형식).
3. Mars 적용 절차(참고): `roblox\tools\upload.bat` → `AssetIds.luau` 갱신 → 코드는 키 존재 시 자동 사용. **코드 수정은 Mars 가 한다.**
4. `worker_done` 보고에 파일 목록·해시·미납품 항목(있으면 사유)을 적는다.

## 5. [기획 필요] — Earth 가 결정하지 않는다

- 봇의 이름·성격(5급 "견습 로봇"/5단 "사범 로봇" 같은 캐릭터 설정) — CJ 결정 전까지 배지에 텍스트 "5급/5단" 만 쓴다.
- 보드게임 창 제목 띠에 넣을 로고/워드마크 — 현재 텍스트 "Digit Dual".
