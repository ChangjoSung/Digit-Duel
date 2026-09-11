# [결정] 튜토리얼 아트 편집 원고

- [native-assets.json](native-assets.json): 2D12개 원고. 좌상단 기준 팔레트·행 문자열, native 크기와 출력 크기, 틴트와 SliceCenter. native를 최근접2배하면 납품 PNG의 RGBA 픽셀이 된다.
- [tutorial-art.blend](tutorial-art.blend): Blender5.2.1 LTS. `Earth_Tutorial_Source` 장면의 `signpost`가 런타임 모델이다. `Tutorial_Native_*`와 `Tutorial_Delivered_*` packed image에 2D 원고/납품물이 들어 있다.
- `REVIEW_ONLY_*` 바닥·조명·5stud 아바타와 카메라는 검수용이다. `Tutorial_Import_QA` 장면은 FBX 재수입 검수용이며 `Scene`은 새 Blender 세션의 기본 장면이다. **전체 장면을 export하지 말고 `signpost`만 선택해 export한다.**
- Blender 원고는 Z-up 작업 좌표다. FBX/OBJ 납품은 **Y-up, forward −Z, 1unit=1stud**다. `bake_space_transform=true`, custom properties=false, FBX animation 없음. FBX/OBJ에 검수용 바닥·아바타·카메라·조명을 넣지 않았다.
- 런타임 메시 88삼각형, 원점=(0,0,0), 전체4×4.6×0.35stud. 판4×2.2×0.25, 하단Y2.4. 기둥0.35×2.44×0.35로 판 내부0.04stud 겹침을 줘 틈을 없앴다. 작은 1단계 모서리 chamfer 포함.
- 앞면은 글자 없는 단일 사각 UV. 텍스처 앞/뒤 패치를 공유한다. 법선 Blender+Y → 납품−Z. 판 전면 중심은 Roblox(0,3.5,−0.125), 전체bbox 중심은(0,2.3,0).
- 월넛은 프로젝트의 기존 `desk_albedo.png` 하단 목재 영역을 4px 블록으로 샘플링한 파생이다. 새 외부 소재/폰트를 다운로드하지 않았다. 픽셀 이음매는 목재 재질이며 그림자/조명은 albedo에 굽지 않았다.
- packed image를 바로 내보내면 Blender exporter가 잘못된 상대 텍스처 경로를 만들 수 있다. 현재 납품물은 알베도의 기존 파일 경로로 unpack한 상태에서 FBX/OBJ export 후 다시 pack했다. OBJ MTL의 `map_Kd`는 `../textures/signpost_albedo.png`다. 재수출 시 반드시 상대 경로를 재검증한다.
- 검수 렌더에만 조명이 들어간다. Blender 모델·텍스처가 Roblox에서 곧바로 동작한다는 뜻이 아니므로 Studio에서 importer 크기·방향·피벗과 `SurfaceGui` 캐리어를 확인한다.
- [delivery-inventory.json](delivery-inventory.json): 파일별 bytes/SHA256, 메시 측정과 원고 해시. 실제 업로드/AssetIds 수정/게임코드 변경은 미실행.

이번 튜토리얼은 imagegen 대신 기존 픽셀 아이콘 체계를 재사용했다. 썸네일만 이전 턴의 내장 image_gen 제작물이며 [별도 프롬프트](../thumbnail-source/README.md)를 따른다.

본 원고·아트·검수 이미지는 Apache-2.0 제외. Copyright 2026 Sung Changjo and the respective contributors. All rights reserved. [ASSET-LICENSE.md](../../../../ASSET-LICENSE.md).
