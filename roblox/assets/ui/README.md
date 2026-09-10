# [결정] P0-B 속성·흔적 / P0-C 보드 / P0-D UI

> 중앙 배너 추가(2026-09-10): [banner.png](banner.png)는256×128, ui_banner, **SliceCenter16,16,112,112 / SliceScale1**로 현행 panel 좌표와 호환한다. 실제540×112이며 좌/상/우/하 캡은16/16/144/16이다. [배너 납품·적용 보고](../../../docs/art/roblox-v0.5.0/earth-banner-report.md).

> 2026-09-10 추가: panel_window 등 AI 전용6PNG는 [AI 창·봇 적용 계약](../ai-window-README.md)을 따른다. 특히256px 창의 SliceCenter는24,40,232,232로, 아래128px 패널3종과 다르다. 아래 수량·표는 최초 기본 P0 납품 이력이다.

2026-09-09 · Ref #118 · Earth 아트 납품. 신규 **60 PNG / 43,786 bytes**.
기존 하수인60 + 토큰9와 합쳐 기본 요청 **P0 129/129 PNG**가 준비됐다.
이 문서는 `ui/`뿐 아니라 이번 `elements/tokens/board/status/items/actions/skillkind/` 자산도 설명한다.

[전체 조합 미리보기](../../../docs/art/roblox-v0.5.0/review/p0-board-ui-composition.png) · [납품 보고](../../../docs/art/roblox-v0.5.0/earth-ui-report.md) · [Claude 적용 인계](../../../docs/roblox/claude-art-apply-handoff.md)

## 제작·표시 원칙

기존 픽셀 아이콘 체계를 확장하고, 사용자에게 허용받은 Blender 내부 아트 명령으로 제작했다.
imagegen을 사용한 그림이 아니며 코드·도구·테스트 파일을 추가/수정하지 않았다.
폰트·이모지 글리프·문자·숫자를 그림에 굽지 않았다. 문구, HP 숫자, 피해 증가 퍼센트는 런타임 텍스트다.

- 속성/아이템64px: native32 → 최근접2배. 표시32/64/96px 권장.
- 흔적/상태/행동48px: **native24 → 최근접2배**. 표시24/48/72px 권장.
- 기술 종류32px: native32 직납.
- 타일/하이라이트/보드 프레임128px: native32 → 최근접4배.
- 패널·버튼·배지·바: 원고의 가로세로를 각각 최근접2배.
- 모두 RGBA8, 알파0/255, 런타임 최대변128px. 투명 가장자리에 중간 알파가 없다.
- `ResampleMode=Pixelated`를 사용한다. 48계열의 **32px 검토 시트는 비정수 최근접 재표본화 스트레스 테스트**이지 정수 배율 표시 증빙이 아니다.
- 24/32px 그림 크기와 터치 영역은 별개다. 터치44px 이상을 위한 실제 배치 정책은 Mars/CJ 검토 범위이며 이 아트가 모바일 레이아웃을 확정하지 않는다.
- 기존 하수인·토큰·로비·가림 모델 파일은 변경하지 않았다. 메모용 파일도 추가하지 않았다.

## 팔레트·의미

타일 중앙과 모든 외곽 픽셀은 HTML의 기존 색을 유지한다:
자기 진영 `#2a3350`, 상대 진영 `#502a33`, 숲 `#1f3a2a`, 중앙 `#2a2f3d`.
숲은 약한 잎 무늬, 다른 타일은 희미한 표면 결만 더해 중앙 아이콘을 방해하지 않는다.
테이블용 기존 3D 판 텍스처의 색을 다시 칠한 것이 아니다. 2D 셀/오버레이 교체 위치를 구분한다.

속성은 불 `#ff7a4d`, 물 `#4da3ff`, 풀 `#5fd06b`, 번개 `#ffd84d`를 기본으로 한다.
물방울·잎 가지·불꽃·각진 번개는 흑백에서도 다른 형태다.
흔적은 점 두 개를 담은 돋보기로, 특정 유닛의 발자국이나 정체를 암시하지 않는다.

포획 도구는 **보라색 다면체 + 비스듬한 띠 + 마름모 코어**다.
유명 IP의 빨강/흰 반구·검은 적도 띠·중앙 원 버튼 조합을 쓰지 않았다.
예비 슬롯은 중립 말 실루엣이며 숨은 종이나 물음표 문자를 넣지 않았다.

## 틴트와 상태

**틴트가 필요한 신규 자산은7개뿐**이다. 나머지53개는 완성 색을 갖고 있으므로 ImageColor3를 흰색으로 둔다.

| 자산 | ImageColor3 | 형태 구분 |
|---|---|---|
| hl_move | `#5b8cff` | 가는 단일선 |
| hl_attack | `#ff5b6e` | 두꺼운 잘린 모서리 |
| hl_sel | `#ffd84d` | 이중선 + 모서리 표시 |
| hl_flee | `#5b8cff` | 끊긴 선 + 네 방향 안쪽 브래킷 |
| hl_forced | `#ff5b6e` | 굵은 이중선 |
| hpbar_fill | `#4fd88a` | HP 채움 |
| shbar_fill | `#4da3ff` | 방어막 채움 |

위7개는 실제 불투명 픽셀이 모두 **#ffffff**다. 색은 source의 tint_color와 manifest notes의 apply_tint에 기록했다.
선택색은 구형 CSS의 흰색이 아닌 최신 요청서의 **노랑**이다.
하이라이트는 투명 중앙의 오버레이이며 말·HP·입력 영역을 덮는 불투명 사각형이 아니다.

버튼은 default/primary/danger 각각 normal/hover/pressed/disabled4상태다.
pressed는 상하 베벨이 뒤집히고 disabled는 낮은 대비의 RGB로 표현했다.
disabled 이미지를 쓴다고 클릭이 막히지는 않는다. 입력 비활성화는 구현 코드가 처리한다.
자동 색 곱셈이나 추가0.35 투명도를 중복 적용하여 상태색을 망가뜨리지 않도록 확인한다.

## 9-slice 계약 — 좌표와 배율

manifest의 slice_l/t/r/b와 아래 표는 **SliceCenter 사각형 좌표**다. 여백4개 값이 아니다.
오른쪽/아래는 배타적 경계이며 `ScaleType=Slice`에서 사용한다.

| 자산 | 원본 | SliceCenter (L,T,R,B) | Scale1의 양쪽 고정 캡 합계 |
|---|---|---|---|
| 하이라이트5·board/frame | 128×128 | 32,32,96,96 | 가로64 / 세로64 |
| 패널3 | 128×128 | 16,16,112,112 | 가로32 / 세로32 |
| 버튼12 | 128×64 | 12,12,116,52 | 가로24 / 세로24 |
| badge | 64×40 | 12,12,52,28 | 가로24 / 세로24 |
| 바4 | 64×32 | 8,8,56,24 | 가로16 / 세로16 |

대상 크기는 고정 캡 합계보다 커야 한다. 캡이 겹치는 크기로 압축하지 않는다.
52개 검토 케이스는 **SliceScale1**의 고정 캡을 실제 PNG에서 잘라 보존한 두 가지 크기씩이다.
[배치·원본 좌표 JSON](../../../docs/art/roblox-v0.5.0/ui-source/slice-review-cases.json)에 실제 검수 영역이 있다.

**작은 보드 칸:** 현재 코드의 CELL34/내부32px에 SliceScale1의64px 캡을 넣으면 안 된다.
32px 사각 오버레이는 원본128을 균등 축소해 사용하거나, `SliceScale=0.25`로 네 캡을8px씩 표시한다.
64px에서는 `SliceScale=0.5`로16px 캡을 사용한다. 두 경우 모두 native32의 정수 배율이다.
임의 화면 크기에 맞출 때는 캡 합계와 픽셀 배율을 별도로 재검한다. 프레임을 보드 전체로 늘릴 때도 캡 폭이 고정되도록 한다.

**HP/방어막 바:** 채움 길이가 줄어든다고 끝의9-slice 캡까지 작은 폭으로 압축하지 않는다.
전체 길이의 채움을 유지한 채 부모 클립/크롭 폭으로 비율을 표현하고0에서는 숨긴다.
보드 위 HP 숫자 정책은 변경하지 않는다. 바는 전투 등 바 표시를 쓰는 화면의 자산이다.

## 키·파일·규격 전수표

[루트 manifest](../manifest.csv)의 기존18열을 유지했다. path/source는 저장소 루트 기준이다.
현행 업로더는 루트 PNG + 로비 + 가림 모델을 함께 읽고 PNG는 Image, FBX는 Model로 업로드한다.
구형 문서의 “PNG Decal 전용 업로더” 설명을 현재 구현에 적용하지 않는다.
이60개는 루트 manifest에만 추가했으며 로비/모델 manifest를 변경하지 않았다.

| 업로드 키 (kind_id) | 파일 | 크기 | 틴트 색 | SliceCenter |
|---|---|---|---|---|
| `element64_fire` | [elements/fire_64.png](../elements/fire_64.png) | 64×64 | 없음 | — |
| `element64_water` | [elements/water_64.png](../elements/water_64.png) | 64×64 | 없음 | — |
| `element64_grass` | [elements/grass_64.png](../elements/grass_64.png) | 64×64 | 없음 | — |
| `element64_lightning` | [elements/lightning_64.png](../elements/lightning_64.png) | 64×64 | 없음 | — |
| `trace48_trace` | [tokens/trace_48.png](../tokens/trace_48.png) | 48×48 | 없음 | — |
| `status48_shield` | [status/shield_48.png](../status/shield_48.png) | 48×48 | 없음 | — |
| `status48_burn` | [status/burn_48.png](../status/burn_48.png) | 48×48 | 없음 | — |
| `status48_weaken` | [status/weaken_48.png](../status/weaken_48.png) | 48×48 | 없음 | — |
| `status48_shock` | [status/shock_48.png](../status/shock_48.png) | 48×48 | 없음 | — |
| `status48_dmgcut` | [status/dmgcut_48.png](../status/dmgcut_48.png) | 48×48 | 없음 | — |
| `status48_focus` | [status/focus_48.png](../status/focus_48.png) | 48×48 | 없음 | — |
| `status48_vuln` | [status/vuln_48.png](../status/vuln_48.png) | 48×48 | 없음 | — |
| `item64_potion` | [items/potion_64.png](../items/potion_64.png) | 64×64 | 없음 | — |
| `item64_cool` | [items/cool_64.png](../items/cool_64.png) | 64×64 | 없음 | — |
| `item64_cure` | [items/cure_64.png](../items/cure_64.png) | 64×64 | 없음 | — |
| `item64_ball` | [items/ball_64.png](../items/ball_64.png) | 64×64 | 없음 | — |
| `item64_reserve` | [items/reserve_64.png](../items/reserve_64.png) | 64×64 | 없음 | — |
| `action48_search` | [actions/search_48.png](../actions/search_48.png) | 48×48 | 없음 | — |
| `action48_teleport` | [actions/teleport_48.png](../actions/teleport_48.png) | 48×48 | 없음 | — |
| `action48_heal` | [actions/heal_48.png](../actions/heal_48.png) | 48×48 | 없음 | — |
| `action48_skip` | [actions/skip_48.png](../actions/skip_48.png) | 48×48 | 없음 | — |
| `action48_endturn` | [actions/endturn_48.png](../actions/endturn_48.png) | 48×48 | 없음 | — |
| `action48_resign` | [actions/resign_48.png](../actions/resign_48.png) | 48×48 | 없음 | — |
| `action48_fight` | [actions/fight_48.png](../actions/fight_48.png) | 48×48 | 없음 | — |
| `action48_bag` | [actions/bag_48.png](../actions/bag_48.png) | 48×48 | 없음 | — |
| `action48_capture` | [actions/capture_48.png](../actions/capture_48.png) | 48×48 | 없음 | — |
| `action48_flee` | [actions/flee_48.png](../actions/flee_48.png) | 48×48 | 없음 | — |
| `skill32_attack` | [skillkind/attack_32.png](../skillkind/attack_32.png) | 32×32 | 없음 | — |
| `skill32_support` | [skillkind/support_32.png](../skillkind/support_32.png) | 32×32 | 없음 | — |
| `skill32_sig` | [skillkind/sig_32.png](../skillkind/sig_32.png) | 32×32 | 없음 | — |
| `board_tile_own` | [board/tile_own.png](../board/tile_own.png) | 128×128 | 없음 | — |
| `board_tile_enemy` | [board/tile_enemy.png](../board/tile_enemy.png) | 128×128 | 없음 | — |
| `board_tile_forest` | [board/tile_forest.png](../board/tile_forest.png) | 128×128 | 없음 | — |
| `board_tile_mid` | [board/tile_mid.png](../board/tile_mid.png) | 128×128 | 없음 | — |
| `board_hl_move` | [board/hl_move.png](../board/hl_move.png) | 128×128 | #5b8cff | 32, 32, 96, 96 |
| `board_hl_attack` | [board/hl_attack.png](../board/hl_attack.png) | 128×128 | #ff5b6e | 32, 32, 96, 96 |
| `board_hl_sel` | [board/hl_sel.png](../board/hl_sel.png) | 128×128 | #ffd84d | 32, 32, 96, 96 |
| `board_hl_flee` | [board/hl_flee.png](../board/hl_flee.png) | 128×128 | #5b8cff | 32, 32, 96, 96 |
| `board_hl_forced` | [board/hl_forced.png](../board/hl_forced.png) | 128×128 | #ff5b6e | 32, 32, 96, 96 |
| `board_frame` | [board/frame.png](../board/frame.png) | 128×128 | 없음 | 32, 32, 96, 96 |
| `ui_panel_side` | [ui/panel_side.png](../ui/panel_side.png) | 128×128 | 없음 | 16, 16, 112, 112 |
| `ui_panel_battle` | [ui/panel_battle.png](../ui/panel_battle.png) | 128×128 | 없음 | 16, 16, 112, 112 |
| `ui_panel_modal` | [ui/panel_modal.png](../ui/panel_modal.png) | 128×128 | 없음 | 16, 16, 112, 112 |
| `ui_btn_default_normal` | [ui/btn_default_normal.png](../ui/btn_default_normal.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_default_hover` | [ui/btn_default_hover.png](../ui/btn_default_hover.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_default_pressed` | [ui/btn_default_pressed.png](../ui/btn_default_pressed.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_default_disabled` | [ui/btn_default_disabled.png](../ui/btn_default_disabled.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_primary_normal` | [ui/btn_primary_normal.png](../ui/btn_primary_normal.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_primary_hover` | [ui/btn_primary_hover.png](../ui/btn_primary_hover.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_primary_pressed` | [ui/btn_primary_pressed.png](../ui/btn_primary_pressed.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_primary_disabled` | [ui/btn_primary_disabled.png](../ui/btn_primary_disabled.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_danger_normal` | [ui/btn_danger_normal.png](../ui/btn_danger_normal.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_danger_hover` | [ui/btn_danger_hover.png](../ui/btn_danger_hover.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_danger_pressed` | [ui/btn_danger_pressed.png](../ui/btn_danger_pressed.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_btn_danger_disabled` | [ui/btn_danger_disabled.png](../ui/btn_danger_disabled.png) | 128×64 | 없음 | 12, 12, 116, 52 |
| `ui_badge` | [ui/badge.png](../ui/badge.png) | 64×40 | 없음 | 12, 12, 52, 28 |
| `ui_hpbar_bg` | [ui/hpbar_bg.png](../ui/hpbar_bg.png) | 64×32 | 없음 | 8, 8, 56, 24 |
| `ui_hpbar_fill` | [ui/hpbar_fill.png](../ui/hpbar_fill.png) | 64×32 | #4fd88a | 8, 8, 56, 24 |
| `ui_shbar_bg` | [ui/shbar_bg.png](../ui/shbar_bg.png) | 64×32 | 없음 | 8, 8, 56, 24 |
| `ui_shbar_fill` | [ui/shbar_fill.png](../ui/shbar_fill.png) | 64×32 | #4da3ff | 8, 8, 56, 24 |

## 원고와 검토 자료

- [native-assets.json](../../../docs/art/roblox-v0.5.0/ui-source/native-assets.json): **60개 원고의 기준 데이터**. 픽셀 좌상단 원점, 명시적 팔레트·행 문자열·출력 크기·tint·SliceCenter.
- [p0-ui.blend](../../../docs/art/roblox-v0.5.0/ui-source/p0-ui.blend): 보조 편집 원본. Earth_P0_UI_Source 장면의 ui_native_assets_json에도 같은 데이터를 보존했다. 납품 PNG60개도 Earth_P0_Delivered_ 접두의 packed image로 포함하며 fake user를 설정해 보존한다.
- Blender 파일에는 이전 로비·토큰 장면/이미지가 문맥 보존용으로 포함된다. 런타임 배포는 manifest PNG만 사용하며 .blend 전체를 Roblox에 올리지 않는다.
- 기존 minion_art.py의 roster 계약을 바꾸지 않았다. 위 원고는 새 스키마의 아트 데이터이며 기존20종 도구의 입력으로 넣지 않는다.

| 검토 이미지 | 배열 |
|---|---|
| [아이콘30종](../../../docs/art/roblox-v0.5.0/review/p0-icons-contact.png) | 6열×5행, 아래 순서 |
| [아이콘32px·세 배경](../../../docs/art/roblox-v0.5.0/review/p0-icons32-backgrounds.png) | 동일30종. 각 칸 왼쪽부터 아군/적군/미공개 배경 |
| [공통 기호9종](../../../docs/art/roblox-v0.5.0/review/p0-symbols9-proof.png) | 왕·동료·폭탄·덫·가림·불·물·풀·번개. 세 배경32px + 흰/검정64px |
| [타일2×2 반복](../../../docs/art/roblox-v0.5.0/review/p0-board-tiles-2x2.png) | 자기/상대/숲/중앙 |
| [버튼12상태](../../../docs/art/roblox-v0.5.0/review/p0-buttons-states.png) | 행 default/primary/danger, 열 normal/hover/pressed/disabled |
| [보드·패널9-slice](../../../docs/art/roblox-v0.5.0/review/p0-9slice-board-panels.png) | move/attack/sel, flee/forced/frame, side/battle/modal |
| [버튼9-slice](../../../docs/art/roblox-v0.5.0/review/p0-9slice-buttons.png) | 버튼12상태와 같은 순서 |
| [바·배지9-slice](../../../docs/art/roblox-v0.5.0/review/p0-9slice-meters.png) | badge/hp_bg/hp_fill/sh_bg/sh_fill |
| [보드·UI 조합](../../../docs/art/roblox-v0.5.0/review/p0-board-ui-composition.png) | 아트 배치 검토용 합성. 실제 게임 규칙·모바일 레이아웃·화면 적용 증빙 아님 |

아이콘30종 배열 순서:
불·물·풀·번개·흔적·방어막 / 화상·약화·감전·감쇠·집중·취약 /
회복약·쿨링수·해독제·포획도구·예비슬롯·탐색 /
텔레포트·회복·생략·턴종료·기권·싸우기 /
가방·포획·도망·공격기·보조기·시그니처.

## 구현 경계·라이선스

속성 아이콘은 알려진 속성 또는 플레이어의 **수동 추측**에만 쓴다. 숨은 정답을 표시/요청하지 않는다.
흔적은 서버가 해당 뷰어에게 허용한 좌표에만 표시한다.
skill32는 이미 공개된 **기술 종류**만 나타낸다. 미공개 기술의 이름/ID/효과를 유추하여 그림이나 툴팁에 넣지 않는다.
이번 제작은 UI 이미지 납품이며 메모·수동 배치·새 규칙 구현을 포함하지 않는다.

신규60PNG·원고·검토 이미지는 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 **Apache-2.0 제외**다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
외부 소재·폰트 글리프를 가져오지 않았다. 육안 유사성 검수는 포괄적 권리 보증이 아니다.
