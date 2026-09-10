# [결정] Roblox 로비 P0 — Dark board-game cafe

> 2026-09-10 별도 추가: 앉은 bot.fbx(1.8×3.2×1.8stud,2660tri)와 bot_albedo.png를 manifest 뒤에 추가했다(현재15행). [AI 창·봇 전용 계약](../ai-window-README.md)의 엉덩이 피벗·등급 틴트·축 보정을 따른다. 아래6메시·13행·삼각형 합계는 최초 로비 납품 이력이며 새 봇을 포함하지 않는다.

2026-09-09 · Earth · Ref #118. CJ가 카페 테마와 Blender 내부 아트 제작 명령을 승인한 뒤 제작했다.
이 폴더는 **자산 납품물**이다. Roblox Studio 업로드·게임 코드 교체·콜리전·카메라 적용은 포함하지 않는다.

[테이블 렌더](preview/table-hero.png) · [A 좌석](preview/seat-a.png) · [B 좌석](preview/seat-b.png) · [전체 로비](preview/lobby-overview.png)

## 구성과 치수

| 자산 | FBX / OBJ 이름 | 크기 X×Y×Z (stud) | 삼각형 | 현행 배치 피벗 |
|---|---|---|---:|---|
| 책상 | desk | 9×3×7 | 872 | 테이블 중심 + (0,2.7,0) |
| 의자 | chair | 2.02×3.7×2.3 | 868 | Seat 중심 Y=1.25 |
| 판 | board | 4.2×0.2×7.8 | 12 | 테이블 중심 + (0,3.1,0) |
| 바닥 | floor | 140×1×140 | 12 | (0,-0.5,0) |
| 벽 | wall | 140×12×0.89 | 1,608 | 각 벽 중심 Y=6 |
| 기둥 | pillar | 1.2×12×1.2 | 432 | 각 모서리 Y=6 |

메시 6종은 각각 단일 메시·단일 재질·UV 1개다. FBX 6개가 주 납품 형식이며 동일 이름의 OBJ+MTL은 대체/검사용이다. 둘을 중복 배치하지 않는다.
텍스처 6개와 UI 1개, 모두 PNG RGBA8·최대 1024이다. 원본 AI 목재 이미지는 1254×1254이며 런타임 폴더 밖에 보존했다.
4책상 + 8의자 + 4판 + 1바닥 + 4벽 + 4기둥 = **18,652 triangles**. 아바타·추가 토큰·기본 SpawnLocation은 이 아트 합계에 포함하지 않는다.

## 가져오기 — Mars 인계

1. `meshes`와 `textures`의 상대 폴더 구조를 유지한다. FBX의 상대 이미지 연결과 OBJ의 MTL `../textures/...`를 검수했다.
2. 파일 좌표는 **Y-up, 1 unit=1 stud**다. Studio 가져오기에서 Scale Unit을 **Stud**로 확인하고 표의 최종 크기와 대조한다. Blender 원본은 Unit System=None, FBX Units Scale=1이다. [Roblox 공식 Blender 내보내기 안내](https://create.roblox.com/docs/art/blender)
3. 이 자산은 제작 좌표 `Blender=(Roblox X,-Roblox Z,Roblox Y)`와 FBX **-Z Forward / Y Up**의 조합으로 내보냈다. 다른 방향 프리셋을 임의 적용하면 판의 진영 방향이 바뀔 수 있다. Blender 재반입과 OBJ 좌표를 검수했으며, **Studio 실반입은 미검증**이다.
4. 전체 메시의 외접 상자 중심과 제작 피벗은 다르다. 피벗 보존 시 표의 피벗에 배치한다. 가져오기가 메시를 중심 재정렬했다면 책상 외접 상자 중심 Y=1.5, 의자 Y=1.85 및 로컬 Z=0.15, 판 Y=3.1이 되도록 오프셋을 보정한다. 벽 외접 상자 중심은 제작 피벗에서 로컬 Z=-0.055다. Seat 위치를 옮겨 맞추지 않는다.
5. 원래 SeatA/SeatB 기능을 유지하고 시각 메시를 감싼다. Seat는 2×0.5×2, 중심 Y=1.25, 실제 윗면 Y=1.5다. 의자 등받이는 로컬 +Z. A는 테이블 Z+5.2/회전0, B는 Z-5.2/수평180도다. `Lobby.luau`의 반대 방향 주석은 Mars가 정리할 대상이다.
6. 의자 알베도는 전 픽셀이 회색이다. 프리뷰의 곱셈 틴트 예시는 A `#7185BD`, B `#BD7180`. 이것은 **로비 의자만의 요구**이며 대기 중인 2D 토큰 틴트 승인이 아니다. 그 밖의 알베도는 흰색 Color3를 기준으로 한다.
7. 책상/의자의 실제 충돌은 단순 박스와 기존 Seat로 처리하고, 시각 메시/베벨/기둥 장식의 불필요한 충돌은 끈다. 이 폴더에는 충돌·매칭 코드가 없다.
8. 벽의 장식 면은 로컬 -Z. 로비 안쪽으로 향하게 회전한다. 높이 12, 테이블 중심 (-15,-25),(15,-25),(-15,5),(15,5), 로비 140×140을 유지했다.
9. 소스 FBX에는 커스텀 속성·카메라·조명·애니메이션·스크립트를 넣지 않았다. 업로드/rbxassetid와 실제 모델 교체는 Mars가 진행한다.

## 판과 manifest

[manifest.csv](manifest.csv)는 필수 열 `path,kind,w,h,tris,slice,tint,source,notes`와 메타데이터 확장 열을 포함한 **13개 자산 행**이다.
이미지는 w/h가 px, 메시는 w/h/depth가 Roblox X/Y/Z stud다. `pivot_roblox`는 테이블 기준 또는 해당 구조물 기준 배치 위치다.
`source`의 파일 경로는 이 폴더 기준이며, `path` 또한 이 폴더 상대 경로다. `instances`는 위 삼각형 합계의 인스턴스 수다.

**board 메시 행의 `cells_json`에 91칸을 모두 직접 기록했다.** 읽기 편한 동일 데이터 사본은 [board-cells.csv](board-cells.csv)다.

- row=1..13, col=1..7. 중심은 판 메시 로컬 기준 `X=(col-4)×0.6, Y=0.1, Z=(row-7)×0.6`.
- 월드 셀 윗면은 테이블 중심에 위 X/Z를 더하고 Y=3.2다.
- row1은 로컬 Z=-3.6, row13은 Z=+3.6. A 가까운 쪽은 row13 파랑, B 가까운 쪽은 row1 빨강.
- 이미지 448×832 = 7:13, 셀당64px. PNG 좌상단 원점의 중심 좌표는 `pixel_x=(col-0.5)×64, pixel_y=(row-0.5)×64`.
- UV는 좌하단 원점. `u=(col-0.5)/7, v=1-(row-0.5)/13`. CSV 소수 좌표는 6자리 반올림이다.
- row1~3 `#5E2F3A`, row4~5/9~10 `#23422F`, row6~8 `#2B3140`, row11~13 `#2F3A5E`. 모든 셀 중앙의 PNG 픽셀 값을 확인했다.
- 요청의 “1024×…”를 가로1024 고정으로 해석하면 세로가1024를 넘는다. 비율과 최대크기를 함께 만족하도록448×832를 선택했다.
- 책상 깊이7, 판 깊이7.8로 양쪽0.4 돌출하는 **현행 치수를 유지**했다. 완전히 받치려면 책상 깊이+11.43% 변경이 필요하므로 별도 승인 없이 넓히지 않았다.

## 텍스처와 UI

목재는 imagegen으로 생성한 원본을 Blender에서 알베도 베이크했다. 판·표지는 정확한 규격으로 Blender 내부에서 만들었으며 글자·브랜드·로고를 굽지 않았다.
벽의 얇은 몰딩은 1px 미만 UV 섬을 피하도록 재질별 큰 패치에 매핑했다. 벽 텍스처의 UV 중복은 의도한 재질 공유이며 라이트맵 UV가 아니다.
바닥은 목재의 거울 반복과 주기적인 판재 이음을 베이크했고, 바닥 메시의 윗면 UV0..14로 10×10stud 패턴을 반복한다.
[바닥 2×2 반복 검수](preview/floor-2x2.png)는 1024×1024이다.

`ui/table_sign.png`: 256×64 RGBA, **SliceCenter=(16,16,240,48)**, 4방향16px 여백. ScaleType=Slice, SliceScale=1을 기준으로 한다.
[9-slice 검수](preview/table-sign-9slice.png)는 220×56, 680×96으로 늘린 실제9패치 렌더다. 문구는 런타임 BillboardGui로 얹는다.

## 좌석 시점 검수 범위

A/B 카메라 높이 Y=4.5, X=-15, Z=-19.8/-30.2, 대상(-15,3.2,-25).
1024×768, 12mm/36mm 센서, 가로 FOV112.620° / 실제 렌더 세로 FOV96.733°의 **별도 Blender 검수 카메라**다.
양쪽 모두 네 모서리가 프레임 안에 있고 91셀 중심 raycast 가림0개다. [수치 증빙](../../../docs/art/roblox-v0.5.0/lobby-source/seat-camera-qa.json)

이 결과는 Roblox의 현재 기본 카메라나 아바타·토큰이 놓인 실게임 시야 PASS를 뜻하지 않는다.
Mars는 Studio에서 디바이스 비율과 아바타를 포함해 확인하고, 필요하면 카메라 후퇴/상승 또는 FOV를 조정해야 한다. 카메라 코드 변경은 하지 않았다.

## 원본·권리·남은 범위

[Blender 원본](../../../docs/art/roblox-v0.5.0/lobby-source/lobby-cafe.blend)에는 편집용 메시, 패킹된 이미지, 실제 배치와 검수 카메라가 있다.
`Earth_Lobby_Source`는 개별 자산 전개 장면, `Earth_Lobby_Preview`는 4테이블 배치 장면, 두 QA 장면은 UI/바닥 검수용이다.
Source에서 개별 자산을 재출력할 때는 선택한 메시 하나만 원점에 놓고 내보낸다. 게임에 Preview 장면 전체를 중복 업로드하지 않는다.
[imagegen 프롬프트/이력](../../../docs/art/roblox-v0.5.0/lobby-source/imagegen-prompts.md) · [작업 보고](../../../docs/art/roblox-v0.5.0/earth-lobby-report.md)

이 폴더의 모든 메시·텍스처·UI·렌더 및 연결된 원본 아트는 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 **Apache-2.0에서 제외**한다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved. 외부 소재 팩·기존 IP·브랜드 이미지는 사용하지 않았다. AI 생성물의 독점권을 별도로 보증하지 않는다.

P1 소품과 P2 관전/스토어 자산은 이번 P0 납품에 포함하지 않는다. 경험 이름·로고·관전 정책·규모 확대는 계속 기획 대기다.
기존 2D 하수인/토큰은 수정하지 않았다.
