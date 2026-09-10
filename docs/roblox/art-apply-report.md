# [보고] Earth 아트 적용 — Mars (Ref #118, 인계서 `claude-art-apply-handoff.md` 회신)

작성: Mars (Claude Code) 2026-09-09 · 브랜치 `feature/118-roblox-art-apply` · Roblox 게시 대상 place 105609162200402

인계서 §9 요구대로 **적용 완료 / 자산 업로드만 완료 / 아직 미적용 / 미납품 자산 / 별도 보안 문제**를 구분한다. 확정/추론/미확정 표기.

## 1. 자산 업로드 (Open Cloud, 계정 11639564357)

83개 전부 성공 — `roblox/assets/asset-ids.json` · `roblox/src/shared/AssetIds.luau` (생성 파일).

| 묶음 | 수량 | Roblox 자산 타입 | 키 |
|---|---:|---|---|
| 하수인 icon64/battle256/portrait512 | 60 | **Image** (기존 Decal 60개를 Image 로 재업로드 — ImageLabel·TextureID 어디서든 확실히 렌더) | `icon_/battle_/portrait_<종>` |
| 토큰 king/ally/bomb/trap 64·128 + unknown 64 | 9 | Image | `token64_/token128_<토큰>` |
| 로비 알베도 6 + 표지 1 | 7 | Image | `lobby_<asset_id>` |
| 로비 메시 FBX 6 | 6 | **Model** (InsertService 로 로드) | `lobbymesh_<이름>` |
| 공통 가림 메시 unknown.fbx | 1 | Model | `mesh_unknown` |

업로더(`roblox/tools/upload_assets.js`)는 인계서 §4 대로 세 manifest 를 각각의 규칙으로 읽고 obj/mtl 은 올리지 않는다. sha256·타입이 같으면 건너뛴다.

## 2. 적용 상태

### 적용 완료 (코드 연결 + 빌드 포함)
| 항목 | 위치 | 비고 |
|---|---|---|
| 하수인 icon64 — 2D 보드 칩·**3D 판 빌보드** | `init.client.luau` `pieceImage`·`sync3D` | 무틴트, Pixelated |
| 하수인 battle256 — 전투 패널 | `renderBattle`·`fighterImage` | 대리 출전은 `artRosterId` |
| 왕·동료·폭탄·덫 token64 — 2D 칩·3D 빌보드 (팀 틴트 `#5b8cff`/`#ff5b6e`) | 같은 곳 | `ImageColor3` 틴트 |
| 왕·동료 본체 token128 — 전투 패널 (팀 틴트) | `fighterImage` | |
| unknown_64 — 2D 칩 미공개 말 (팀 틴트) | `pieceImage` | |
| **공통 가림 메시** — 3D 판 미공개 말 (`MeshPart.Color` 팀 틴트, 0.44×0.42×0.44, 바닥+0.21) | 서버 `Lobby.build` 가 `ReplicatedStorage.DDTemplates.Unknown` 템플릿 생성 → 클라 `mkUnknown` 복제 | 템플릿 없으면 unknown_64 빌보드 → 단색 블록 순 폴백 |
| 로비 메시 6종 + 알베도 (책상·의자·판·바닥·벽·기둥) | `Lobby.luau` `applyLobbyMeshes`/`applyTableMeshes` | 기능 파트(충돌·Seat·클릭 대상 Board)는 유지하고 시각만 교체. 의자 A/B 틴트 `#7185BD`/`#BD7180` |
| 표지 table_sign 9-slice (SliceCenter 16,16,240,48) | `Lobby.buildSign` | 문구는 런타임 |
| **판 위 대국** (Phase 2b 핵심) | 클라 `sync3D`·`setBoardCamera`·`raycastCell` | 앉으면 카메라가 판을 향함. 말은 각 클라이언트가 서버 필터 뷰로 **로컬 생성** — 상대에게 복제되는 인스턴스 없음. 판·말 클릭 → 셀 → 기존 `onCell` |
| 2D 보드 폴백 | HUD [2D 보드] 토글, 판 파트 없으면 자동 | |

### 자산 업로드만 완료 (코드 미연결)
- `portrait512` 20장 — 로스터 선택/설명창 UI 가 아직 없다 (수동 배치·로스터 UI 는 후속). ID 는 `AssetIds.luau` 에 있음.

### 아직 미적용
- 판 위 **이동 가능/공격 가능 칸 하이라이트** — 클라이언트에 규칙 평가가 없어 선택·강제 대상·도망 후보·흔적만 표시 (서버가 잘못된 수를 거부하며 사유를 로그로 돌려줌)
- 추측 메모(점선·불투명도 0.5) — 메모 기능 자체가 미구현 (HTML #36 포팅 대기). 인계서 §5 대로 이번 교체에 묶지 않음

### 미납품 자산 (Earth)
속성 아이콘 4 · 흔적 마커 1 · P0-C 보드 타일/하이라이트 10 · P0-D UI 프레임/상태·아이템·행동·기술 아이콘 45 = **60 PNG**, P1 연출·배너, P2 스토어. 현재 폴백: 텍스트·이모지(흔적 🔍)·단색 프레임·Neon 하이라이트 파트.

## 3. 별도 보안 항목 — 순번 ID 누출 (인계서 §6) → **수정·검증**

- 재현: `Engine.new` 가 종류별 고정 순서로 1부터 ID 부여 → 왕 = 14/28 등 ID 만으로 정체 추정 가능. `Views` 가 미공개 말에도 그 ID 를 전송.
- 수정 ①: `Engine.new` 에서 생성 직후 **ID 값을 시드 RNG 로 셔플** (생성 순서·규칙 로직 불변, ID 는 불투명 핸들). 
- 수정 ②: `Views.forViewer` 의 `board` 배열을 **위치(r,c) 순으로 정렬** — 배열 순서가 생성 순서(=종류 순서)를 따르던 2차 누출 제거.
- 검증: `tests/run.luau` [8] — 10시드에서 종류별 고정 구간 없음, ID 유일·범위, 뷰 정렬, 미공개 말에 type/hp/rosterId/name 비전송. 서버 검증 경로(`pieceById`)는 ID 값에 의존하지 않아 회귀 없음.
- 잔여(추론): 3D 로컬 인스턴스의 `r/c` Attribute 는 이미 보이는 위치 정보만 담는다. 이름은 전부 `Piece/Base/Hl` 로 동일. 관전자 정책은 여전히 [기획 필요] — 현재 관전자(앉지 않은 플레이어)에게는 말을 아예 그리지 않는다.

## 3b. P0-B/C/D 잔여 60 PNG 적용 (2026-09-09 2차 인계 회신 — `claude-art-apply-handoff.md` 갱신본)

**업로드**: 신규 60 Image 전부 성공 → 총 143 자산 (P0 129 PNG + 로비 13 + 가림 1). 키 누락·중복 0 (tests [7] 가 143 키 전량 URL 검증).

| 묶음 | 적용 위치 (init.client.luau) | 상태 |
|---|---|---|
| 속성 4 (`element64_*`) | 로스터 카드 우상단·상세 팝업·전투원 카드 이름 옆 | 적용 (공개 속성만) |
| 흔적 1 (`trace48_trace`) | 2D 셀 좌상단 마커 · 3D 판 빌보드 (🔍 텍스트 대체) | 적용 (서버 허용 칸만) |
| 상태 7 (`status48_*`) | 전투원 카드 상태 행 (아이콘 + 잔여 수치 텍스트) | 적용 |
| 아이템 5 (`item64_*`) | 전투 아이템 버튼·볼 던지기·사이드 배지(볼·예비)·대리 출전 버튼 | 적용 |
| 행동 10 (`action48_*`) | 사이드 행동 버튼(탐색·텔레포트·회복·생략·턴 종료·기권)·배지(가방·싸우기)·전투(기본 공격·도망)·HUD(자리 떠나기) | 적용 |
| 기술 종류 3 (`skill32_*`) | 전투 기술 버튼 접두(공개 기술 kind·미공개 슬롯 kind — 종류는 공개 정보)·기술 교체 프롬프트 | 적용 |
| 보드 타일 4 (`board_tile_*`) | **2D 셀 배경**(뷰어 기준 own/enemy/forest/mid, 128→32 균등 축소). 3D 판 텍스처는 그대로 | 적용 |
| 하이라이트 5 (`board_hl_*`) | 2D 셀 오버레이 (SliceCenter 32,32,96,96 · **SliceScale 0.25** · 틴트 5) — 우선순위 forced>attack>sel>flee>move. 배치 화면도 동일 | 적용 |
| 보드 프레임 (`board_frame`) | 2D 보드 외곽 (SliceScale 0.5, 16px 여백) | 적용 |
| 패널 3 (`ui_panel_*`) | side → HUD·배치·사이드, battle → 전투, modal → 로스터 상세·프롬프트 (SliceScale 1) | 적용 |
| 버튼 12 (`ui_btn_*`) | `smallBtn` 이 ImageButton 으로 전환 — normal/hover/pressed 이벤트, disabled 는 별도 이미지 + 입력 차단(코드). SliceScale 0.5 | 적용 |
| 배지 (`ui_badge`) | 사이드 배지 행 (볼·아이템·전투·예비) SliceScale 0.5 | 적용 |
| HP/방어막 바 4 (`ui_*bar_*`) | 전투원 카드 — 배경 9-slice + **전체 길이 채움을 클립 폭으로** 표현, 0 이면 숨김. 틴트 2 | 적용 |

- 3D 판의 하이라이트는 계속 Neon 파트(2D 자산 아님). 보드 HP 숫자 정책 유지.
- 틴트는 인계서 7개(`Art.TINT`)와 팀 토큰뿐 — 나머지 53개는 흰색 ImageColor3. 자산 없으면 이전 단색·텍스트 폴백.
- 추측 메모는 여전히 미구현 (별도 범위). 모바일 터치 44px 정책·경험 이름은 [기획 필요] 유지.

## 4. 검증

- `luau tests/run.luau`: 규칙 회귀 + [7] Art + [8] 정보 은닉 — 결과는 PR 본문에 기록
- 전 Luau `luau-compile` 통과 · rbxl 트리 확인
- **Studio/실서버 미검증** (이 환경에 Studio 없음): 메시 임포트 축(`MESH_YAW` 보정표로 대응), 앉은 시점 카메라 프레이밍, raycast 클릭, 덮개 템플릿 로드. 인계서 §8 대로 이전 아트 QA PASS 를 코드 QA 로 재사용하지 않는다 → **Saturn 독립 QA + CJ 실플레이 확인 요청**.

## 5. worker_done

```yaml
worker_done:
  role: Mars
  instance_index: null
  dispatch_ref: "#118 Earth 아트 적용 (claude-art-apply-handoff.md)"
  status: completed_pending_qa
  files_modified:
    - "roblox/tools/upload_assets.js"
    - "roblox/assets/asset-ids.json"
    - "roblox/src/shared/AssetIds.luau"
    - "roblox/src/shared/Art.luau"
    - "roblox/src/shared/Engine.luau"
    - "roblox/src/shared/Views.luau"
    - "roblox/src/server/Lobby.luau"
    - "roblox/src/server/init.server.luau"
    - "roblox/src/client/init.client.luau"
    - "roblox/tests/run.luau"
    - "roblox/README.md"
    - "docs/roblox/lobby-design.md"
    - "docs/roblox/art-apply-report.md"
  summary: |
    83 자산 업로드(Image 76 · Model 7). 하수인·토큰·덮개·로비 메시·표지 연결, 판 위 대국(로컬 렌더·카메라·클릭) 구현,
    순번 ID 누출 수정(셔플+정렬)과 테스트. portrait 는 업로드만. 미납품 60PNG 는 폴백 유지. Studio 실검증은 미실시.
  qa_request: |
    Saturn: (1) 두 클라이언트에서 공개/미공개/숲 은닉 말 표시와 로컬 인스턴스 비복제 확인 (2) ID 셔플 회귀 — 서버 액션 검증·pending·도망 교환
    (3) 로비 메시 축·의자 착석 높이·판 진영 방향(row13=A·파랑) (4) 앉은 시점 카메라 91칸 가독성·클릭 정확도 (5) 폴백(메시/이미지 실패)
    CJ: 실플레이 — 로비 → 착석 → 배치 → 대전 → 종료 → 재대전
```

## 3c. AI 봇·보드게임 창 자산 (Earth 2026-09-10 납품 → Mars 적용 2026-09-10)

납품 계약: [`roblox/assets/ai-window-README.md`](../../roblox/assets/ai-window-README.md) · 보고서: [`docs/art/roblox-v0.5.0/earth-ai-window-report.md`](../art/roblox-v0.5.0/earth-ai-window-report.md). 업로드 8건 성공(총 ID 151): Image 7 · Model 1.

| 키 | 적용 위치 | 적용 방식 |
|---|---|---|
| `ui_panel_window` | 보드게임 창 `win` 배경 | `bgImage(win, "panel_window", "window", 1)` — 신규 `Art.SLICE.window = {24,40,232,232}` (기존 `panel` 좌표 불변) · 없으면 `panel_side` 폴백 |
| `action48_exit` | 배치·대전·종료 [나가기] 버튼 | `Art.action("exit") or Art.action("resign")` |
| `action48_bot` | HUD [🤖 5급 봇]·[🤖 5단 봇] | `Art.action("bot")` |
| `badge48_ai_grade5` / `badge48_ai_dan5` | 창 제목 옆 24px 배지 · 봇 이름표(BillboardGui) 24px | `Art.badge(...)` — 글자 "5급/5단"은 런타임 텍스트로 병기 (배지에 글자 없음) |
| `status48_thinking` | 창 상태줄 "🤖 AI 행동 중…" 앞 24px | `Art.status("thinking")` — 정적 1장 (4프레임 시트 미납품) |
| `lobbymesh_bot` + `lobby_bot_albedo` | 봇 착석 더미 대체 | `placeMesh("bot", seat.CFrame * CFrame.new(0, 0.85, -0.45))` — MeshPart 외접 상자 중심 보정(hip +0.25, bbox 중심 (0,0.6,-0.45)) · `MESH_YAW.bot = 0`(정면 -Z) · 틴트 5급 `#8eb2ff` / 5단 `#ffcf82` (좌석 팀색과 분리) · 로드 실패 시 Part 더미 폴백 |

ImageColor3 흰색·`ResampleMode = Pixelated`·SliceScale 1 로 README 규격 준수. 확인 필요(Studio): 봇 얼굴 방향(-Z, MESH_YAW 0 기준)·창 분리선 위치(x≈302~309)·배지 가독성 24px.

## 3d. 중앙 배너 아트 (Earth 2026-09-10 납품 → Mars 적용 2026-09-10)

납품 보고: [`docs/art/roblox-v0.5.0/earth-banner-report.md`](../art/roblox-v0.5.0/earth-banner-report.md) · 요청서: [`docs/roblox/earth-banner-request.md`](earth-banner-request.md). 업로드 1건 성공(총 ID 152).

| 키 | 적용 위치 | 적용 방식 |
|---|---|---|
| `ui_banner` | 중앙 배너 `bannerFrame`(540×112) 배경 | `bgImage(bannerFrame, "banner", "panel", 1)` — 납품 SliceCenter (16,16,112,112) 가 기존 `Art.SLICE.panel` 과 같아 **코드 변경 없이** 폴백(`panel_modal`)을 대체 |

납품본 독립 검증(Mars): 1,788 bytes · SHA-256 `6c3163b0…` 보고서와 일치 · 256×128 RGBA8 · 중간 알파 0 · 글자 영역(중앙 20~108) 단색 `#13161e` 평탄 확인. 테스트 [7] 에 Phase 3 자산 키(`panel_window`·`banner`·`exit`·`bot`·배지 2·`thinking`·봇 메시) URL 단언을 추가했다.

~~미납품(선택): `banner_good`·`banner_bad` 변형~~ → **3f 에서 납품·적용 완료** (CJ 지시로 제작 범위에 들어왔다). [기획 필요]: 배너 로고·워드마크 여부.

## 3e. 전투 연출 FX·메모 아트 (Earth 2026-09-10 납품 → Mars 적용 2026-09-10)

납품 보고: [`docs/art/roblox-v0.5.0/earth-fx-report.md`](../art/roblox-v0.5.0/earth-fx-report.md) · 요청서: [`docs/roblox/earth-fx-p1p2-request.md`](earth-fx-p1p2-request.md). 업로드 15건 성공.

**시트 규격**: 768×96 = 96×96 프레임 8장 가로. 프레임 n 은 `ImageRectOffset = (96*n, 0)`, `ImageRectSize = (96,96)`. 8번째 프레임은 완전 투명이라 재생이 끝나면 저절로 사라진다. 반복 루프가 아니라 1회 연출이다.

| 키 | 적용 위치 | 적용 방식 |
|---|---|---|
| `fx96_*` 13종 | 전투 창 `battleFx`(96×96, 두 전투원 카드가 맞닿는 지점) · 중앙 배너 `bannerArt.fx`(96×96, 배너 왼쪽) | `Fx.play(label, key)` — 프레임당 0.055초 × 8 ≈ 0.44초. 새 연출이 오면 `Fx.seq` 로 이전 타이머를 무효화한다 |
| `board_hl_memo` | 판 위 메모 가능 칸 강조 | `cellHighlight(b, "memo")` — 지금까지 빌려 쓰던 `hl_flee` 를 대체. 금색 점선이라 이동(파랑)·공격(빨강)과 구분된다 |
| `token64_memo` | 셀 오른쪽 위 `MemoIcon`(14×14) 배지 | 메모가 달린 말임을 표시. **무엇을 적었는지는** 기존대로 왼쪽 아래 이모지가 보여 준다 (배지 자체는 정체 정보를 담지 않는다) |

**연출 키 판정**은 규칙이 아니라 표시 계층이므로 공유 모듈 `src/shared/Banner.luau` 에 넣고 헤드리스 테스트 [14] 로 회귀를 막는다 (78 단언).

- `Banner.fxFromBattle(text)` — 전투 창 메시지(bmsg) → FX 키. **부여만 잡고 해제·정화는 잡지 않는다**(화상을 입었다 ✔ / 화상이 해제되었다 ✘), **성공만 잡고 시도·실패는 잡지 않는다**(도망 성공 ✔ / 도망 시도·실패 ✘).
- `Banner.RULES[].fx` — 판 위 사건(로그) → 배너 안에서 재생 (💥 explosion · 🪤 trap · 🔴 capture · 🏃 flee). 연출이 있으면 배너 글자를 오른쪽(x=116)으로 밀어 겹치지 않게 한다.

납품본 독립 검증(Mars): 15 PNG SHA-256 전량 보고서와 일치 · 768×96/128×128/64×64 RGBA8 · **13종 × 8프레임을 직접 디코드**해 프레임별 불투명 픽셀 수가 보고서 표와 일치하고, 알파가 0/255 뿐이며, 8프레임이 서로 다르고 마지막이 완전 투명이고, tint=yes 3종의 불투명 RGB 가 전부 순백임을 확인했다.

**[기획 필요] 유지**: 프레임당 재생 시간은 0.055초로 정했지만 **입력 잠금·화면 흔들림·전체 플래시는 넣지 않았다** (요청서 6장 그대로 "잠금 없이 표시만"). 좌우 전투원 중 누가 맞았는지에 따라 연출 위치를 나누는 것도 후속 — 지금은 이름 문자열로 추측해 오인 표시하느니 중앙 1회로 둔다.

## 3f. 배너 상황별 변형 (Earth 2026-09-10 납품 → Mars 적용 2026-09-10)

납품 보고: [`docs/art/roblox-v0.5.0/earth-banner-variants-report.md`](../art/roblox-v0.5.0/earth-banner-variants-report.md) · 요청서: [`docs/roblox/earth-banner-variants-request.md`](earth-banner-variants-request.md). 업로드 2건 성공.

| 키 | 적용 위치 | 적용 방식 |
|---|---|---|
| `ui_banner_good` | 배너 배경 (tone `good`) | `bannerArt.VARIANT.good` — 획득·성공·승리·나의 턴 |
| `ui_banner_bad` | 배너 배경 (tone `bad`) | `bannerArt.VARIANT.bad` — 폭탄·함정·기권·연결 끊김·패배 |

`default`·`warn` 은 공통 배너를 그대로 쓴다. 실루엣·SliceCenter·글자 영역이 공통과 완전히 같아 **배경 이미지만 갈아 끼운다** — 크기·슬라이스·글자 위치 코드는 건드리지 않았다.

납품본 독립 검증(Mars): 2 PNG SHA-256 보고서와 일치 · 256×128 RGBA8 · 알파 0/255. 공통 배너 `banner.png` 는 변경되지 않았다(기존 해시 유지).

