# [결정] AI 봇·보드게임 창 — Mars 적용 계약

2026-09-10 · Ref #118 / v0.4.6 Phase3 · Earth 납품.
[요청서](../../docs/roblox/earth-ai-window-request.md) · [보고서·검수 이미지](../../docs/art/roblox-v0.5.0/earth-ai-window-report.md).

**신규 2D6PNG + 봇 알베도1PNG + 메시1종(FBX/OBJ/MTL).**
기존 기본 P0 129개와 별도 추가 범위다. 기존 타일·하수인·토큰·파일명·키는 변경하지 않았다.
아트 납품은 완료했지만 **모든 항목이 업로드만으로 자동 적용되지는 않는다**. 아래 구현 차이를 확인한다.

## 파일·키

| 용도 | 실제 업로드 키 | 파일 | 규격 |
|---|---|---|---|
| 창 프레임 | ui_panel_window | [ui/panel_window.png](ui/panel_window.png) |256×256, SliceCenter 24,40,232,232 |
| 나가기 | action48_exit | [actions/exit_48.png](actions/exit_48.png) |48×48 |
| 봇 얼굴 | action48_bot | [actions/bot_48.png](actions/bot_48.png) |48×48 |
| 5급 배지 | badge48_ai_grade5 | [badges/ai_grade5_48.png](badges/ai_grade5_48.png) |48×48 →24/48 표시 |
| 5단 배지 | badge48_ai_dan5 | [badges/ai_dan5_48.png](badges/ai_dan5_48.png) |48×48 →24/48 표시 |
| AI 행동 중 | status48_thinking | [status/thinking_48.png](status/thinking_48.png) |정적48×48 →24 표시 |
| 착석 로봇 | **lobbymesh_bot** | [lobby/meshes/bot.fbx](lobby/meshes/bot.fbx) |1.8×3.2×1.8stud,2660tri |
| 로봇 알베도 | **lobby_bot_albedo** | [lobby/textures/bot_albedo.png](lobby/textures/bot_albedo.png) |256×256 회색 RGBA8 |

[bot.obj](lobby/meshes/bot.obj) + [bot.mtl](lobby/meshes/bot.mtl)은 FBX 대체/검사용이다. 중복 배치·업로드하지 않는다.
MTL의 map_Kd는 ../textures/bot_albedo.png다. meshes/textures 상대 폴더를 함께 유지한다.
[실제 런타임10파일 SHA-256](../../docs/art/roblox-v0.5.0/ai-window-source/delivery-manifest.csv).

루트 [manifest](manifest.csv)에는 기존129행 뒤에6행을 추가했다(총135,18열 유지).
로비 [manifest](lobby/manifest.csv)에는 기존13행 뒤에2행을 추가했다(총15,14열 유지).
로비 형식에는 status열이 없으므로 기존 헤더/행을 바꾸지 않고 **신규 행 notes에 status=delivered**와 해시를 기록했다.
로비 키는 kind_id가 아닌 전용 접두 규칙이다. mesh_bot/texture_bot_albedo를 생성하거나 Art.meshId로 연결하지 않는다.

현행 업로더 dry-run: **151대상 / 신규 Image7·Model1 / 기존143 재사용**.
Earth는 dry-run만 실행했다. 실제 업로드·rbxassetid 발급·생성 AssetIds.luau 수정은 Mars가 수행한다.

## 창 프레임과 픽셀 규격

6종은 기존 repo-native 픽셀 체계를 확장했다. 아이콘5개는 native24→48 최근접2배, 창은 native128→256 최근접2배다.
아이콘의 native1px 외곽선은 납품48px에서2px가 된다. 배경은 투명하며 알파는0/255다.
모두 완성 색을 갖는 **tint=no**이므로 ImageColor3는 흰색, ResampleMode=Pixelated다.
24px/48px는 원고의1배/2배이며,32px 등 비정수 표시는 별도 가독성 검토가 필요하다.
별도24px 파일 없이48PNG를 최근접으로24px 표시한다. 터치 영역 크기는 그림 크기와 별개다.

panel_window: **ScaleType=Slice / SliceCenter=(24,40,232,232) / SliceScale=1**.
상단 고정 캡40, 좌우·하단24px. 제목 그림은 y34 전에 끝나며 실제 판 시작y34와 간섭하지 않게 했다.
**현행720×592에 맞춘** 왼쪽 어두운 판 영역과 오른쪽 패널 영역, 얇은 분리선이다.
실제 프레임 늘림에서 분리선은 대략x302~309로, 판 끝x296와 오른쪽 패널 시작x316 사이에 놓인다.

단일9-slice의 중앙에 포함된 분리선은 폭을 늘리면 위치·두께도 비례해 늘어난다.
960×720 검토는 모서리 보존 시험이며 **720용 고정 칼럼을 그대로 사용할 수 있다는 의미가 아니다**.
반응형 칼럼 폭이 필요해지면 Mars가 분리선을 별도 레이어로 분리하도록 Earth에 요청한다. 이번 납품은 새 반응형 레이아웃 결정을 포함하지 않는다.
기존 board/tile_*는 그대로 사용한다(40px 셀 재제작 요청 없음).

## 봇 메시·피벗·좌표

단일 메시·단일 재질·UV1개,1388정점 /2660삼각형. 애니메이션·리깅·스크립트·카메라·조명을 FBX에 넣지 않았다.
UV는 회색 재질 패치 공유를 위해 의도적으로 겹치며 라이트맵 UV가 아니다. 픽셀 패치 안쪽8px 여백을 둔다.
등급 공통 로봇1종이다. 배지와 Color3로 구분하고 별도 등급별 메시를 만들지 않는다.

| 좌표 항목 | Roblox/export 좌표 |
|---|---|
| 축·단위 |Y-up,1unit=1stud, 정면 -Z |
| 엉덩이 지지면 피벗 |(0,0,0) |
| 외접 상자 최소 |(-0.9,-1.0,-1.35) |
| 외접 상자 최대 |(0.9,2.2,0.45) |
| 외접 상자 중심 |**(0,0.6,-0.45)** |
| 크기 X×Y×Z |1.8×3.2×1.8 |
| 예시5급 Color3 |#8eb2ff |
| 예시5단 Color3 |#ffcf82 |

Blender 편집 좌표는 X=Roblox X, +Y=Roblox -Z(정면), +Z=Roblox +Y(위)다.
내보낼 때 -Z Forward / Y Up + bake_space_transform=True로 축을 베이크했다.
**납품 파일의 정면-Z**와 Blender 편집기 기본 Z-up을 혼동하지 않는다.
기존 chair/board의 MESH_YAW=π를 봇에 그대로 복사하지 말고, 새 봇은0부터 Studio에서 얼굴 방향을 확인한다.

Seat 중심은 앉는 윗면보다0.25stud 아래다.
피벗을 보존하는 가져오기라면 hip을 seat.CFrame * CFrame.new(0,0.25,0)에 놓는다.
MeshPart가 외접 상자 중심으로 재정렬됐다면 **seat.CFrame * CFrame.new(0,0.85,-0.45)**가 중심 위치다.
이는 새로운 Seat 위치 결정이 아니라 납품 피벗과 외접 상자 차이를 보정한 값이다.
현재 코드의 y=3.2/2+0.25=1.85,z=0은 발바닥을 좌석 위에 올리는 배치여서 이 앉은 모델에는 맞지 않는다.
요청 높이3.2와 실제 의자 높이를 유지했으므로 발은 바닥에서 약0.5stud 떠 있는 작은 로봇 자세다.

## 현재 코드와의 차이 — Mars 작업

작성 기준 HEAD840d267f397d16cf38c7367b4d69e3969c2b4233, dev. 적용 전 최신 diff를 다시 확인한다.

1. win은 Art.ui("panel_window")를 조회하지만 기존 Art.SLICE.panel=(16,16,112,112)를 적용한다. **창 전용 좌표를 추가하고 해당 호출만 변경**한다. 기존128px 패널 좌표를 덮어쓰지 않는다.
2. exit/bot은 조회·폴백 경로가 있다. 새 파일 로드 후 색 곱셈·크기를 확인한다.
3. Art.badge와 Art.status("thinking") 접근 함수는 있지만 **배지2종과 thinking의 실제 UI 호출은 없다**. 제목/이름표·상태줄에 적절한 ImageLabel 연결이 필요하다.
4. 로봇 템플릿 조회는 있으나 위 hip/bbox 오프셋 보정이 필요하다. 현재 MESH_SIZE.bot=1.8,3.2,1.8은 납품 크기와 맞는다.
5. 현재 봇 틴트는 등급이 아니라 좌석 A/B색이다. **난이도에 따라 파랑/금색을 적용**하고, 별도 팀 구분과 혼동되지 않게 배지·텍스트를 함께 쓴다.
6. 이름표는 현재 TextLabel뿐이다. 등급 아이콘을 추가하되 캐릭터 이름/성격을 임의 확정하지 않는다.
7. 배지 그림에는 글자를 굽지 않았다. 요청의 “5급/5단”은 **런타임 텍스트**로 병기한다. 로고/워드마크도 제작하지 않았다.

메시 불러오기 실패, 이미지 검수 중, 봇 제거/등급 전환/나가기의 폴백·입력·상태 전환을 Studio에서 검수한다.
자산이 준비됐다는 이유로 이 연결 항목을 적용 완료로 기록하지 않는다. Earth는 코드 파일을 수정하지 않았다.

## 원본·프리뷰·검수 한계

- [원고JSON](../../docs/art/roblox-v0.5.0/ai-window-source/native-assets.json) · [Blender 원본](../../docs/art/roblox-v0.5.0/ai-window-source/ai-window.blend) · [기하·슬라이스 계약](../../docs/art/roblox-v0.5.0/ai-window-source/asset-contract.json).
- Blender 원본의 Earth_AI_Window_Source에 편집 파트와 통합 bot, 내장 원고 및 패킹된 신규7이미지가 있다. Earth_AI_Bot_Preview는 렌더 검수 장면이다.
- 기존 로비·토큰·P0 장면은 문맥 보존용으로 함께 들어 있다. .blend 전체를 게임에 업로드하지 않는다.
- [아이콘 검수](../../docs/art/roblox-v0.5.0/review/ai-window/icons-proof.png): 왼쪽부터 exit/bot/5급/5단/thinking. 위96px·48px, 세 배경24px, 흰/검정48px.
- [720 창 조합](../../docs/art/roblox-v0.5.0/review/ai-window/window-composition.png) · [720 슬라이스](../../docs/art/roblox-v0.5.0/review/ai-window/window-slice-720x592.png) · [960 슬라이스](../../docs/art/roblox-v0.5.0/review/ai-window/window-slice-960x720.png).
- [로봇 중립](../../docs/art/roblox-v0.5.0/review/ai-window/bot-neutral.png) · [5급](../../docs/art/roblox-v0.5.0/review/ai-window/bot-grade5.png) · [5단](../../docs/art/roblox-v0.5.0/review/ai-window/bot-dan5.png).
- [기존 의자 착석·정면-Z](../../docs/art/roblox-v0.5.0/review/ai-window/bot-chair-fit.png) · [옆면](../../docs/art/roblox-v0.5.0/review/ai-window/bot-side-fit.png).
- 그림의 화살표/-Z 글자·의자는 검토용이며 bot.fbx에 포함하지 않는다. 창 조합은 실제 게임 스크린샷·룰 상태·모바일 승인안이 아니다.
- 정적 thinking은 필수 납품 완료이며 선택4프레임 시트는 만들지 않았다. P1/P2 추가 제작도 하지 않았다.

신규 아트·원고·렌더는 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)에 따라 **Apache-2.0 제외**.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
런타임 자산에 외부 소재·폰트·이모지 글리프를 쓰지 않았다. 검토 화살표의 -Z는 Blender 기본 폰트로 표시한 좌표 라벨이다.
imagegen 생성은 사용하지 않았다. 기존 픽셀 체계 확장과 Blender 내부 메시/재질 제작이다.
