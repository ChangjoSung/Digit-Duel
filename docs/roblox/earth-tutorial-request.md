# [Earth 요청] Digit Dual Roblox — 로비 튜토리얼 간판 + 튜토리얼 삽화 10종

> **사용법**: `--- PROMPT ---` 이후 전체를 Codex(Earth 역할) 세션에 붙여넣는다.
> 작성: Mars (Claude Code) 2026-09-11 · Ref [#118](https://github.com/ChangjoSung/Digit-Duel/issues/118) · 트랙 `milestone/v0.5.0`
> 선행 요청서: `earth-art-request.md`(P0 2D) · `earth-lobby-request.md`(3D 로비) · `earth-ai-window-request.md`(AI 창) · `earth-banner-request.md`·`earth-banner-variants-request.md`(배너) · `earth-fx-p1p2-request.md`(전투 연출)
> **선행 납품 현황**: P0 129 PNG · 로비 13 · 가림 1 · AI 창 8 · 배너 3 · FX·메모 15 = **총 169 자산 적용 완료**

--- PROMPT ---

## dispatch preflight

| 필드 | 값 |
|---|---|
| required_role | **Earth** (Art, Codex) |
| mode | IMPLEMENT |
| area | ART |
| mutation | assets / docs (코드 수정 금지) |
| instance_index | null |

역할 계약(CLAUDE.md): Earth는 아트 자산·문서만 만든다. Luau·JS·Python 코드 작성·수정 금지, 기획 결정 대체 금지(불명확하면 `[기획 필요]`), git 쓰기 금지. `worker_done`으로 Mercury에 보고.

## 1. 배경 — 무엇을 만들려는가

HTML 데모에는 **10단계 튜토리얼**이 있다(`#26`·`#42`·`#128`). 첫 화면에서 자동으로 뜨고 `[📖 튜토리얼 보기]` 로 다시 열 수 있으며, 단계마다 **그림 한 장 + 설명 몇 줄**로 개념 하나씩 가르친다.

**Roblox 판에는 튜토리얼이 없다.** 규칙·AI·UI·연출은 전부 옮겼지만 처음 들어온 사람은 아무 설명 없이 로비에 떨어진다.

CJ 지시(2026-09-11)로 이렇게 만든다:

1. 로비에 **마인크래프트 참나무 간판 같은 나무 표지판**을 세운다.
2. 가까이 가서 **[E] 상호작용**(또는 HUD 도움말 키)을 누르면 **튜토리얼 창**이 열린다.
3. 창은 **10단계**를 한 장씩 넘기며 보여 준다 — HTML 과 같은 내용, 같은 순서.

**왜 그림이 필요한가**: HTML 은 단계별 그림을 **인라인 SVG 로 그때그때 그린다**(`TSV` 헬퍼). Roblox 에는 그 방법이 없으므로 **같은 장면을 PNG 로 미리 그려** 받아야 한다.

**절대 바꾸지 않는 것**: 게임 규칙·수치 · 승인된 하수인 도트 · 기존 169 자산의 파일명·키·SliceCenter.

## 2. 반드시 읽을 참조

1. `roblox/assets/ui/README.md` — 2D 자산 적용 계약 (픽셀 톤·알파 0/255·tint 규칙)
2. `roblox/assets/lobby/manifest.csv` — **3D 납품 형식** (desk·chair·board·wall·pillar·bot 행이 그대로 본보기다)
3. `roblox/assets/manifest.csv` — 2D 납품 형식 (행을 **추가**한다, 기존 행 수정 금지)
4. `roblox/src/server/Lobby.luau` — 로비 배치·`MESH_SIZE`·`MESH_TEX` (검색어: `local MESH_SIZE`)
5. `demo/index.html` 의 `TUT_STEPS`·`TUT_SCENES` — **삽화 10종의 원본 내용** (검색어: `const TUT_STEPS`)
6. `docs/milestone/v0.5.0/README.md` · `ASSET-LICENSE.md`

## 3. 납품 목록

### 3-1. 3D — 로비 튜토리얼 간판 (필수)

CJ 참조 이미지: **마인크래프트 참나무 간판** — 가로 널빤지 판 + 가운데 기둥 하나, 나무 결이 보이는 픽셀 텍스처.

| # | kind | id | 파일 | 크기(stud) | 비고 |
|---|---|---|---|---|---|
| 1 | `mesh` | `signpost` | `roblox/assets/lobby/meshes/signpost.fbx` | **4.0 × 4.6 × 0.35** (W×H×D) | 판 + 기둥 한 덩어리 |
| 2 | `texture` | `signpost_albedo` | `roblox/assets/lobby/textures/signpost_albedo.png` | **512×512** | 베이크 알베도 |

**기존 로비 메시와 같은 계약을 따른다** (manifest 의 desk·chair 행 참조):

- **Y-up · 1 unit = 1 stud · bake_space_transform=true · 커스텀 프로퍼티 없음**
- **피벗 `[0,0,0]` 을 기둥 맨 아래**에 둔다 — Mars 가 바닥 Y=0 위에 그대로 세운다
- **앞면은 로컬 -Z** (bot.fbx 와 같은 규약)
- **OBJ 대안 동봉**: `meshes/signpost.obj` + `meshes/signpost.mtl`
- 삼각형 **500 이하** (간판 하나에 로비 전체 예산을 쓰지 않는다)
- 알베도만 — 라이팅을 굽지 않는다. UV 섬 바깥에 알파 패딩

**모양 치수 제안** (Earth 가 조정해도 되지만 전체 크기는 유지):

```
        ┌──────────────────────┐  ← 판: 4.0 W × 2.2 H × 0.25 D, 아래 모서리 Y=2.4
        │   (글자 없음 — 비움)   │
        └──────────┬───────────┘
                   │             ← 기둥: 0.35 × 2.4 × 0.35, 바닥 Y=0
                   ┴
```

**판 앞면은 글자 없이 비운다.** Mars 가 그 위에 `SurfaceGui` 로 "📖 튜토리얼" 을 띄운다 — 글자를 구워 넣으면 나중에 문구를 못 바꾸고 번역도 못 한다. **판 앞면 UV 를 하나의 사각 섬으로** 펴 주면 그 영역을 그대로 쓸 수 있다.

**[기획 필요] 아님 — 색**: 기존 로비가 호두나무 톤(`desk_albedo`·`floor_tile`)이라 간판도 같은 계열로 맞춘다. 마인크래프트 참나무의 밝은 노란 나무색을 그대로 쓰면 로비에서 튄다 — **참조 이미지의 형태만 가져오고 색은 로비에 맞춘다.**

### 3-2. 2D — 튜토리얼 삽화 10종 (필수, 이번 요청의 핵심)

| 규격 | 값 |
|---|---|
| 크기 | **512 × 288** (16:9) |
| 형식 | RGBA8 · 알파 0/255 · 픽셀 아트 |
| tint | **no** (색을 그림에 넣는다) |
| 배경 | **불투명** — 창 배경(`#13161e`) 위에 얹히므로 같은 계열 어두운 바탕으로 채운다 |

**글자를 그림에 넣지 않는다.** 설명 문장은 Mars 가 창에 텍스트로 그린다(번역·수정 가능해야 한다). 그림 안에는 **이모지·기호·도형만** 쓴다 — HTML 튜토리얼도 같은 원칙이다(`SVG <text>` 에 한글·숫자 금지).

색은 HTML 튜토리얼의 팔레트를 그대로 쓴다:

| 이름 | 색 | 쓰임 |
|---|---|---|
| own | `#2f3a5e` | 내 진영 칸 |
| op | `#5e2f3a` | 상대 진영 칸 |
| forest | `#23422f` | 숲 칸 |
| mid | `#2b3140` | 중앙 칸 |
| line | `#3d475e` | 칸 테두리 |
| txt | `#e8ecf5` | 기호 |
| acc | `#5b8cff` | 화살표·강조 |
| bad | `#ff5b6e` | 실패·X |
| ok | `#4fd88a` | 성공·HP |
| gold | `#ffd84d` | 끝줄·선택 |

**manifest 키**: `kind` = `tut512`, `id` = 아래 표의 id → `AssetIds` 키는 `tut512_win` 처럼 만들어진다 (`action48_search`·`fx96_hit`·`token64_memo` 와 같은 규약). 코드가 `Art.tut("win")` 으로 찾는다.

| # | id | 제목 (Mars 가 창에 쓴다) | **그림에 담을 것** |
|---|---|---|---|
| 1 | `win` | 이기는 법 세 가지 | 왕을 잡는 장면 · 내 왕이 상대 끝줄(금색 띠)에 닿는 장면 · 상대 말이 전부 X 된 장면 — 세 칸으로 나눠 |
| 2 | `pieces` | 말 5가지와 숨은 정체 | 👑 왕 · 🤝 동료 · ⚔ 하수인 · 💣 폭탄 · 🪤 함정 다섯 토큰. 상대 쪽은 전부 **?** 로 |
| 3 | `move` | 움직이기와 숲에 숨기 | 상하좌우 1칸 화살표(대각선은 X) · 숲 칸의 반투명 말 · 옆에 오면 보이는 모습 |
| 4 | `search` | 흔적과 탐색 | 숲 칸에 선 말 → 🔍 흔적 표시 → **다음 차례** 탐색 → 📦 선물 |
| 5 | `battle` | 옆에 붙으면 꼭 싸워요 | 불🔥→풀🌿→번개⚡→물💧→불 상성 고리 · 두 말이 붙어 ⚔ 가 되는 모습 |
| 6 | `bomb` | 폭탄과 함정 | 하수인+폭탄 = 둘 다 X · 동료/왕+폭탄 = 폭탄만 X · 폭탄+폭탄 = 둘 다 X · 함정은 고정(발 묶임) |
| 7 | `capture` | 잡아오기와 도망치기 | HP 30% 아래 하수인에게 🔴 몬스터볼 → 성공 70% · 🏃 도망 30% |
| 8 | `tele` | 텔레포트(순간이동) | 상대 진영에 들어간 내 말 ↔ 다른 내 말이 자리를 바꾸는 양방향 화살표 · 함정에 걸린 말은 X |
| 9 | `burn` | 버닝 타임(불타는 시간) | 🔥 65턴부터 곧게 2칸 · 상대 숲·상대 땅에서는 1칸(X 표시) |
| 10 | `check` | 빠른 복습 — 첫 차례 체크리스트 | 첫 차례에 할 일 3~4개를 아이콘 목록으로 (말 고르기 → 1칸 이동 → 붙으면 전투 → 턴 종료) |

> **원본이 진실이다**: 각 단계가 실제로 무엇을 가르치는지는 `demo/index.html` 의 `TUT_STEPS`(제목·문장)와 `TUT_SCENES`(그림)에 있다. **그 내용을 벗어나는 새 규칙을 그림으로 만들지 않는다.** 애매하면 `[기획 필요]` 로 보고한다.

### 3-3. 2D — 도움말 아이콘 (필수, 1개)

| # | kind | id | 파일 | 크기 | tint |
|---|---|---|---|---|---|
| 13 | `action48` | `help` | `roblox/assets/actions/help_48.png` | **48×48** | **no** |

기존 `action48` 12종(`search`·`teleport`·`heal`·`skip`·`endturn`·`resign`·`fight`·`bag`·`capture`·`flee`·`exit`·`bot`)과 **같은 톤·같은 굵기**. 펼친 책(📖) 또는 물음표 — 기존 아이콘들과 나란히 놓아 어색하지 않은 쪽으로.

### 3-4. 선택 — 간판 상호작용 힌트 (있으면 좋음)

| # | kind | id | 파일 | 크기 | 비고 |
|---|---|---|---|---|---|
| 14 | `ui` | `panel_sign` | `roblox/assets/ui/panel_sign.png` | 128×64 · 9-slice **(12,12,116,52)** | 간판 앞 `SurfaceGui` 바탕 (나무판 위 글자가 읽히게) |

없어도 된다 — 없으면 Mars 가 글자만 띄운다.

## 4. 납품 형식

1. **3D**: `roblox/assets/lobby/manifest.csv` 에 **행 2개 추가** (기존 헤더·행 보존). `kind=mesh`/`texture`, `pivot_roblox`, `depth`, `tris`, `instances=1`, `notes` 에 Y-up·unit=stud·앞면 축·OBJ 대안·bytes·sha256 을 기존 행과 같은 형식으로 적는다.
2. **2D**: `roblox/assets/manifest.csv` 에 **행 11~12개 추가** (삽화 10 + 도움말 1 + 선택 1). `status=delivered`, `w`·`h`, `tint`, `slice_*`(9-slice 인 것만), `sha256`, `source_sha256`.
3. `docs/art/roblox-v0.5.0/earth-tutorial-report.md` 에 검수 이미지를 남긴다:
   - 간판 3면 렌더(정면·측면·비스듬) + 로비 스케일 비교(아바타 키 5 stud 옆에 세운 그림)
   - 삽화 10장을 **실제 표시 크기(512×288)** 로 나열한 시트
   - 도움말 아이콘을 기존 action48 12종과 나란히 둔 대조 이미지
4. 업로드·`AssetIds.luau` 갱신·코드 연결은 **Mars 가 한다**.
5. `worker_done` 보고에 파일·해시·삼각형 수·미납품 항목을 적는다.

## 5. Mars 가 할 일 (참고 — Earth 는 하지 않는다)

- 자산 업로드 → `Art.tut(n)` · `Art.lobbyMeshId("signpost")` 접근자 추가
- 로비에 간판 배치 + `ProximityPrompt`(E) 연결 · HUD 도움말 버튼
- 튜토리얼 창(10단계 넘기기·단계 표시·이전/다음/닫기) 구현
- **문장은 코드에 둔다** — HTML `TUT_STEPS` 의 문구를 그대로 옮긴다
- 첫 접속 자동 표시 여부는 아래 `[기획 필요]`

## 6. CJ 결정 (2026-09-11) — 더 이상 미정이 아니다

앞선 초안의 `[기획 필요]` 3건은 CJ 가 확정했다. **Earth 는 아래를 전제로 만들면 된다.**

| 질문 | CJ 결정 |
|---|---|
| 첫 접속 시 자동으로 띄울 것인가 | **아니다.** 간판·HUD 버튼·`[H]` 로만 연다 |
| 간판을 어디에 세울 것인가 | **입장하자마자 보이는 자리** — 스폰(0, ·, 48)과 테이블(z ≤ 5) 사이, `(0, 0, 40)` 에서 스폰을 향해 세웠다 |
| 대전 중에도 열 수 있게 할 것인가 | **열 수 있다.** 보드게임 창 위에 뜬다 |

이 결정은 이미 코드에 들어가 있다 (`src/client/TutorialUi.luau` · `src/server/Lobby.luau`). **그림이 없어도 글로 된 튜토리얼이 지금 동작한다** — Earth 납품이 오면 그림 칸이 켜진다.

## 7. 참고 — Mars 가 이미 해 둔 것

- `Art.tut(key)` 접근자 · 10단계 창(이전/다음/닫기/처음부터) · `[H]` 키 · HUD·보드게임 창 버튼 · 로비 간판(Part 폴백)과 `[E]` 프롬프트
- **문장은 코드에 있다** — HTML `TUT_STEPS` 원문 그대로. Earth 는 문장을 만들지 않는다
- 간판 메시가 오면 Part 폴백을 대체한다. 판 앞면 `SurfaceGui` 는 그대로 쓴다
