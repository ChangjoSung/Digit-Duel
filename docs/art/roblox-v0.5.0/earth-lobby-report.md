# [결정] Earth 로비 P0 아트 납품

2026-09-09 · Ref #118 · Earth / IMPLEMENT / ART / assets·docs / instance_index null.

## 결과와 범위

CJ의 “응 진행해”로 **어두운 보드게임 카페 테마**와 **Blender 내부 모델링·UV·텍스처·출력·렌더 명령만 사용**하는 예외를 승인받아 제작했다.
두 요청 문서는 서로 다른 납품 2건이 아니라 [아트 요청서](../../roblox/earth-lobby-request.md)와 [설계 근거](../../roblox/lobby-design.md)의 관계로 함께 적용했다.

P0 책상·의자·판·바닥·벽·기둥 **6메시**, 알베도 **6PNG**, 무문자 상태 표지 **1PNG**를 제작했다.
FBX가 주 납품 형식이며 같은6종의 OBJ/MTL도 제공한다. 실제 Blender 렌더6장, 91칸 manifest, 가져오기 안내, 이미지가 패킹된 편집 원본을 포함한다.
Saturn의 파일·UV·좌표 검수와 Earth의 최종 저장 원본 재검을 완료했다. **Roblox 업로드·기본 Part 교체·실게임 테스트 완료를 주장하지 않는다.**

[테이블 렌더](../../../roblox/assets/lobby/preview/table-hero.png) · [A 좌석](../../../roblox/assets/lobby/preview/seat-a.png) · [B 좌석](../../../roblox/assets/lobby/preview/seat-b.png) · [전체 로비](../../../roblox/assets/lobby/preview/lobby-overview.png)

- 자산/가져오기 안내: [README.md](../../../roblox/assets/lobby/README.md)
- 필수13개 자산 행과91칸 내장 좌표: [manifest.csv](../../../roblox/assets/lobby/manifest.csv)
- 편집 원본: [lobby-cafe.blend](lobby-source/lobby-cafe.blend)
- 작업 시작 브랜치: `feature/118-roblox-port`
- 작업 시작 HEAD: `6d80a1fb0b53961288e0ef25f242ee098f5ecb5c`

로비 납품 당시 게임·빌드·테스트 코드 파일 작성/수정0, git쓰기0, 계정 업로드0. 이 로비 작업에서는 기존 2D 자산을 변경하지 않았다.
로비 의자 A/B 틴트만 해당 요청 범위로 적용했다.
**현재 2D 선택3건은 후속 CJ 승인으로 해소됐다.** 왕/동료 상징 문양, 어울리는 폭탄·물리적 덫, 팀 틴트 및 추가 가림 모델의 제작 결과는 [토큰 보고](earth-token-report.md)에 있다.

## 제작과 품질

목재는 imagegen 스킬의 내장 이미지 생성으로 만든 신규 원본을 사용했다.
스킬에 따라 원본·사용 프롬프트·변환 이력을 [imagegen-prompts.md](lobby-source/imagegen-prompts.md)에 보존했다.
이후 실제 3D 메시를 Blender5.2.1에서 모델링하고, UV·알베도 베이크·FBX/OBJ 내보내기·장면 렌더를 수행했다.
판과 표지에는 생성형 모델의 부정확한 문자/격자 대신 Blender 내부의 정확한 픽셀/UV 배치를 사용했다. 외부 이미지 팩·브랜드·특정 IP를 참조하지 않았다.

Blender MCP1.9.1 연결을 사용했고 안전 모드와 텔레메트리 비활성화를 유지했다.
본 세션 도구 목록에 직접 노출되지 않은 MCP를 로컬 stdio 클라이언트로 연결했으며, 게임 파일이나 별도 제작 스크립트 파일을 만들지 않았다.
제작용 Python은 사용자가 승인한 Blender 내부 아트 명령에 한정했다.

| 메시 | X×Y×Z (stud) | 삼각형 | 확인 |
|---|---|---:|---|
| 책상 | 9×3×7 | 872 | 상판9×0.6×7, 윗면Y3, 바닥Y0 |
| 의자 | 2.02×3.7×2.3 | 868 | Seat중심Y1.25, 윗면Y1.5, 등받이끝Y3.7 |
| 판 | 4.2×0.2×7.8 | 12 | 7열×13행, 간격0.6 |
| 바닥 | 140×1×140 | 12 | 윗면Y0, UV14×14반복 |
| 벽 | 140×12×0.89 | 1,608 | 현행 높이12, 안쪽 장식면-로컬Z |
| 기둥 | 1.2×12×1.2 | 432 | 4모서리 배치 예시 |

6종 모두 메시당10k 이하·2048stud 이하.
4책상+8의자+4판+1바닥+4벽+4기둥의 **아트 합계18,652tri**는60k 미만이다.
아바타·토큰·기본 스폰 등 이 묶음 밖의 요소까지 합한 실게임 전체 합계라는 의미는 아니다.

책상 주요 치수는 현행과 동일하다. 의자 폭2.02는 기존2보다1% 크며 Seat와 등받이 치수·높이는 기존 기준을 유지한다.
의자의 전체 깊이2.3은 등받이를 포함한 외접 크기다. Seat의2×0.5×2를2.02×3.7×2.3으로 바꾸라는 뜻이 아니다.
FBX/OBJ는 단일 메시/단일 재질/UV1개이며, 좌표·단위·치수를 독립 재반입으로 확인했다.

제작 중 Saturn이 벽 베벨의 축퇴 삼각형294개를 발견했다.
중복 정점 병합/퇴화면 정리 후 삼각형은1944→1608, zero-area0으로 수정했다.
재전개 과정의1px 미만 UV 섬은 얇은 몰딩 색을 받지 못해, **재질4종을 큰 불투명 사분면 패치로 다시 베이크하고 면별 UV를 안전 여백 안에 배치**했다.
최종 벽의 면당7지점×1608=11,256샘플에서 alpha1임을 Saturn이 확인했다.

## 텍스처·91칸·시야 증빙

- PNG7개 전부8-bit RGBA, 최대변1024. 목재 생성 원본1254×1254는 런타임 폴더 밖에만 보관한다.
- 판448×832는7:13 비율과최대1024를 동시에 만족한다. 셀64×64, 91셀 중앙 픽셀은 요청된4색과 모두 일치한다.
- board 메시의 manifest행 `cells_json`에91개의 row/col·XYZ·UV·픽셀중심·진영·색을 직접 넣었다. [board-cells.csv](../../../roblox/assets/lobby/board-cells.csv)는 같은 내용을 편하게 읽기 위한 사본이다. Saturn이 두 표현과 공식의 전필드를 대조했다.
- row1 Z=-3.6/PNG위쪽/빨강, row13 Z=+3.6/PNG아래쪽/파랑. A 가까운 쪽은13행, B 가까운 쪽은1행.
- 의자512×512는 전 픽셀R=G=B로 틴트 가능한 원본이다. 로비 프리뷰만 A파랑/B빨강 곱셈 틴트를 사용했다.
- [바닥2×2](../../../roblox/assets/lobby/preview/floor-2x2.png)에서 반복 경계의 눈에 띄는 단절 없음.
- [상태 표지9-slice](../../../roblox/assets/lobby/preview/table-sign-9slice.png): 원본256×64, SliceCenter(16,16,240,48). 220×56/680×96 두 크기에서 모서리 두께 유지. 이미지에 구운 글자0.

### 앉은 시점

A/B 각각 카메라 Y4.5, 첫 테이블 X=-15, Z=-19.8/-30.2에서 판 중심(-15,3.2,-25)을 본다.
1024×768, 12mm/36mm 센서, 가로112.620°·실제 세로96.733°의 **Blender 검수용 카메라**다.
양쪽 모두 판4모서리 화면 안, 91칸 중심 raycast가림0, 렌더에서13행 전부 확인했다.
[모서리·91개 투영좌표·가림 검사 JSON](lobby-source/seat-camera-qa.json)

**이것은 기본 Roblox 카메라에서 동일 시야가 보장된다는 검수가 아니다.**
아바타·하수인 토큰이 없는 자산 장면이다. Mars는 Studio에서 실제 카메라/디바이스비율/아바타/토큰을 포함해 검수하고 필요한 후퇴·상승·FOV를 결정해야 한다.
Earth는 카메라나 Seat 코드를 바꾸지 않았다.

## Mars에 인계할 주의사항

1. FBX/OBJ의 단위1=stud, Y-up과 manifest 치수를 유지한다. Blender Unit System=None·FBX Units Scale=1·Studio Scale Unit=Stud를 공식 안내와 대조했다. [Roblox 공식 Blender 안내](https://create.roblox.com/docs/art/blender)
2. 이 파일의 축 변환은 Blender(X,-RobloxZ,RobloxY) → **-Z Forward/Y Up**이다. 원본과 내보내기 설정의 조합이므로 다른 프리셋을 덧적용하지 않는다. 실제 Studio 가져오기는 미검증이다.
3. 업로드/rbxassetid 발급, 원래 Part 교체, 기존 Seat 유지, 충돌과 카메라 구현은 Mars 범위다. 생성된 MeshPart가 외접 중심으로 재정렬될 때의 보정값은 README에 기록했다.
4. 판 깊이7.8 대비 책상 깊이7의 **양끝0.4 돌출을 유지**했다. 이를 없애려면 책상 깊이+11.43%로±10% 조건을 넘으므로 별도 결정이 필요하다.
5. Seat는 중심 Y1.25/윗면 Y1.5다. 요청서의 앉는 면 Y≈1.25를 윗면으로 보고 실제 Seat를 내리지 않았다.
6. 실행값 A=테이블Z+5.2, B=Z-5.2를 기준으로 했다. 반대인 코드 주석은 정리 요청 대상이다.
7. 7:13·최대 1024에 맞춰 448×832로 납품했다. 가로 1024 고정으로 강제 확대하지 않는다.
8. 벽 UV는 재질 공유를 위해 의도적으로 겹친다. 현재 알베도용이며 고유 라이트맵 UV로 가정하지 않는다.
9. 텍스트는 런타임 BillboardGui에서 얹고 장식 충돌을 비활성화한다.

## 최종 저장본 검수

Saturn: FBX/OBJ 6쌍, 삼각형·축·피벗·재질 경로, 최종 벽 UV alpha, 7PNG 규격, 91칸 manifest/CSV 일치, 렌더6장, README와 저장 원본 구성을 읽기 전용으로 확인했다.
저장 원본에는 Text 데이터블록0, 객체 driver0, Source 메시6종, Preview 시각 메시25개가 있으며 파일형 이미지8개가 모두 패킹되어 있다.
기본 Scene의 Cube/Camera/Light는 별도 장면에 보존되어 있고 납품 FBX에는 포함하지 않았다.

Earth: 최종 `lobby-cafe.blend`를 별도 Blender 프로세스에서 `--background --disable-autoexec`로 읽어 재검했다.
A/B 각각 셀91개 화면 안, 모서리4개 화면 안, 가림0개, 6메시 zero-area0, Preview18,652tri를 재계산했다. 종료코드0.
그 결과는 [seat-camera-qa.json](lobby-source/seat-camera-qa.json)의 `saved_source_readback`에 기록했다.
39개 실제 파일과 보고 목록이 누락/추가 없이 일치하며, 마지막 `git diff --name-only`는 비어 있다.
수정한 범위는 새 로비 자산과 이 작업 문서뿐이다. Saturn의 최종 종합 PASS 문구나 Studio QA PASS를 대신 발행하지 않는다.

## 기획 대기 / 라이선스

이번 P0 외 P1 분위기 소품 및 P2 관전석·스토어 아이콘/썸네일은 미제작이다.
경험 이름·로고, 테이블/로비 확대, 관전 정책은 계속 [기획 필요].
카페 테마와 Blender 내부 아트 명령 허용은 이번 사용자 승인으로 해소됐다.
2D 토큰3가지 선택은 더 이상 승인 대기가 아니다. 후속 [토큰 보고](earth-token-report.md)의 결정 현황을 따른다.

로비 메시·텍스처·UI·렌더 및 원본 아트를 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 명시적으로 Apache-2.0에서 제외한다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
문서의 코드 라이선스가 시각 아트에 재사용 권리를 부여하지 않는다. AI 생성물의 독점권을 보증하지 않는다.

## 로비 worker_done — 해당 납품 이력

경로는 공유 작업공간 `C:\WOOK\pvpserver` 기준이다. 총39개 실제 파일을 열거하며 와일드카드를 사용하지 않는다.

```yaml
worker_done:
  role: Earth
  instance_index: null
  dispatch_ref: "#118 Roblox 로비 P0"
  status: completed
  files_modified:
    - "client/roblox/assets/lobby/README.md"
    - "client/roblox/assets/lobby/manifest.csv"
    - "client/roblox/assets/lobby/board-cells.csv"
    - "client/roblox/assets/lobby/meshes/board.fbx"
    - "client/roblox/assets/lobby/meshes/board.obj"
    - "client/roblox/assets/lobby/meshes/board.mtl"
    - "client/roblox/assets/lobby/meshes/chair.fbx"
    - "client/roblox/assets/lobby/meshes/chair.obj"
    - "client/roblox/assets/lobby/meshes/chair.mtl"
    - "client/roblox/assets/lobby/meshes/desk.fbx"
    - "client/roblox/assets/lobby/meshes/desk.obj"
    - "client/roblox/assets/lobby/meshes/desk.mtl"
    - "client/roblox/assets/lobby/meshes/floor.fbx"
    - "client/roblox/assets/lobby/meshes/floor.obj"
    - "client/roblox/assets/lobby/meshes/floor.mtl"
    - "client/roblox/assets/lobby/meshes/pillar.fbx"
    - "client/roblox/assets/lobby/meshes/pillar.obj"
    - "client/roblox/assets/lobby/meshes/pillar.mtl"
    - "client/roblox/assets/lobby/meshes/wall.fbx"
    - "client/roblox/assets/lobby/meshes/wall.obj"
    - "client/roblox/assets/lobby/meshes/wall.mtl"
    - "client/roblox/assets/lobby/textures/board_grid.png"
    - "client/roblox/assets/lobby/textures/chair_albedo.png"
    - "client/roblox/assets/lobby/textures/desk_albedo.png"
    - "client/roblox/assets/lobby/textures/floor_tile.png"
    - "client/roblox/assets/lobby/textures/pillar_albedo.png"
    - "client/roblox/assets/lobby/textures/wall_albedo.png"
    - "client/roblox/assets/lobby/ui/table_sign.png"
    - "client/roblox/assets/lobby/preview/table-hero.png"
    - "client/roblox/assets/lobby/preview/seat-a.png"
    - "client/roblox/assets/lobby/preview/seat-b.png"
    - "client/roblox/assets/lobby/preview/lobby-overview.png"
    - "client/roblox/assets/lobby/preview/floor-2x2.png"
    - "client/roblox/assets/lobby/preview/table-sign-9slice.png"
    - "client/docs/art/roblox-v0.5.0/lobby-source/imagegen-prompts.md"
    - "client/docs/art/roblox-v0.5.0/lobby-source/walnut-imagegen-original.png"
    - "client/docs/art/roblox-v0.5.0/lobby-source/seat-camera-qa.json"
    - "client/docs/art/roblox-v0.5.0/lobby-source/lobby-cafe.blend"
    - "client/docs/art/roblox-v0.5.0/earth-lobby-report.md"
  summary: |
    P0 6메시(FBX6+대체OBJ6/MTL6), 알베도6PNG, UI1PNG, 실제렌더6PNG.
    manifest13자산행의board cells_json에91칸좌표내장, 보조CSV91행.
    메시당12~1608tri, 4테이블아트총18652tri, 런타임텍스처최대1024.
    A/B각각높이4.5의별도검수카메라에서13행가시/91셀가림0.
    게임코드작성수정0, git쓰기0, 업로드0, 기존2D자산변경0.
  requests_to_mars: |
    실제Studio가져오기/축/피벗/콜리전/Seat유지/카메라/업로드및Part교체.
    판양끝0.4돌출현행유지, Seat중심1.25/윗면1.5유지, 반대A/B주석정리.
    검수용FOV와실제게임카메라를혼동하지말고아바타·토큰·기기별시야재검.
  planning_needed:
    - "경험 이름·로고"
    - "테이블 수/로비 확대 여부: 현행4개/140x140 유지"
    - "관전 정책과 관전석"
  qa_request: |
    Saturn 읽기전용 검수: FBX/OBJ 재반입·치수·tri·UV·alpha·91칸 매핑 확인.
    Saturn은 최종 메시/UV/텍스처/manifest 및 저장 원본의 구성·패킹을 확인했다.
    저장 원본의 최종 투영·raycast는 Earth가 별도 Blender 프로세스로 재검해 통과했다.
    Studio 실게임 테스트는 후속 Mars/Saturn 범위.
```
