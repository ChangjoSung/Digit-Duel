# [결정] Claude 최종 인계 — 튜토리얼 아트 전량 + Digit-Duel 썸네일

2026-09-11 · Earth → Claude/Mars · Ref #118 · Roblox v0.5.0

**아트 납품 완료: 필수13 + 선택 패널1 = 신규14개, 134,605 bytes.** 기존 썸네일도 포함했습니다. Saturn 독립 아트 QA PASS. 게임 코드 변경·Roblox 업로드·Studio 적용은 하지 않았습니다.

원 요청: [earth-tutorial-request.md](earth-tutorial-request.md) · [납품/검수 보고](../art/roblox-v0.5.0/earth-tutorial-report.md) · [파일별 해시/측정값](../art/roblox-v0.5.0/tutorial-source/delivery-inventory.json)

## 1. 먼저 확인할 코드 문제 — P1, Earth 미수정

기준 HEAD `678586e7276996cd81c56ad462671b6904167972`에서 읽기 전용 검수로 발견했습니다.

[로비 코드](../../roblox/src/server/Lobby.luau)의 기존 `buildSign(id, desk)`(273행)를 새 `local function buildSign(parent)`(311행)가 가립니다. 테이블 생성의 `buildSign(id, desk)`(381행)가 새 함수를 호출하여 `model.Parent = parent`(345행)에 숫자 id를 넘기게 됩니다. **로비 초기화를 막을 수 있으므로 적용 전에 우선 수정/검증하세요.**

새 튜토리얼 간판 함수를 별도 이름으로 분리하고, 499행의 튜토리얼 호출만 새 이름에 맞추면 기존 테이블 상태 간판 호출과 분리할 수 있습니다. 정적 확인이며 이번 턴에 게임 실행/수정은 하지 않았습니다. 인계 시점에 다른 변경으로 이미 해결됐는지 먼저 확인하세요.

## 2. 튜토리얼 그림 10장 — 현재 코드 키와 일치

![튜토리얼 10장 원크기 시트](../art/roblox-v0.5.0/review/tutorial-panels-contact.png)

각 그림은 **512×288 RGBA8**, native256×144 최근접2배, 전체 alpha255입니다. 시트는 2열×5행이며 각 그림을 512×288 그대로 배치했습니다.

| 순서 | AssetIds 키 | 파일 |
|---|---|---|
| 1 | `tut512_win` | [tut_win.png](../../roblox/assets/tutorial/tut_win.png) |
| 2 | `tut512_pieces` | [tut_pieces.png](../../roblox/assets/tutorial/tut_pieces.png) |
| 3 | `tut512_move` | [tut_move.png](../../roblox/assets/tutorial/tut_move.png) |
| 4 | `tut512_search` | [tut_search.png](../../roblox/assets/tutorial/tut_search.png) |
| 5 | `tut512_battle` | [tut_battle.png](../../roblox/assets/tutorial/tut_battle.png) |
| 6 | `tut512_bomb` | [tut_bomb.png](../../roblox/assets/tutorial/tut_bomb.png) |
| 7 | `tut512_capture` | [tut_capture.png](../../roblox/assets/tutorial/tut_capture.png) |
| 8 | `tut512_tele` | [tut_tele.png](../../roblox/assets/tutorial/tut_tele.png) |
| 9 | `tut512_burn` | [tut_burn.png](../../roblox/assets/tutorial/tut_burn.png) |
| 10 | `tut512_check` | [tut_check.png](../../roblox/assets/tutorial/tut_check.png) |

manifest는 **kind=`tut512`, id=`win` 등**입니다. `tut_win`을 id로 넣거나 `tut512_tut_win` 키를 새로 만들지 마세요. 현재 `Art.tut("win")`과 `TutorialUi`의 10키에 맞췄습니다.

- 현재 `TutorialUi`의 Fit/Pixelated 표시 방식을 유지하고 `ImageColor3`는 흰색으로 둡니다. **틴트·반투명·9-slice를 적용하지 않습니다.**
- 바깥 배경은 `#13161e`. 그림에는 문장·숫자·폰트 글리프를 굽지 않았습니다.
- 설명은 최신 HTML `TUT_STEPS`와 현재 `TutorialUi` 문구를 사용하세요. 그림은 핵심 요약이며 모든 세부 규칙을 대체하지 않습니다.
- 의미 검수 완료: 전멸은 하수인6+동료2, 탐색은 다음 차례, 불→풀→번개→물, 기계식 덫, 기존 보라색 다면체 포획 도구, 덫 종류는 교환 가능/덫에 걸린 말은 양끝 모두 교환 불가, 상대 숲·땅에서는 버닝 이동1칸.
- 포획70%/도망30%는 각각 7/10·3/10 점으로 표현했습니다. HP 조건은 포획에만 적용됩니다. 도망 실패의 최신 설명(상대 기본 공격1회)을 오래된 문구로 덮어쓰지 마세요.

## 3. 도움말과 선택 간판 패널

![기존12행동 아이콘과 도움말 비교](../art/roblox-v0.5.0/review/tutorial-actions-compare.png)

- `action48_help`: [help_48.png](../../roblox/assets/actions/help_48.png), 48×48, 펼친 책, native24 최근접2배. 현재 HUD/보드의 `Art.action("help")` 연결을 사용합니다. 비교 시트의 두 번째 줄 마지막 금색 테두리가 신규 도움말입니다.
- `ui_panel_sign`: [panel_sign.png](../../roblox/assets/ui/panel_sign.png), 128×64, **SliceCenter=(12,12,116,52), SliceScale=1**, tint=no. 좌/상/우/하 여백4개가 아니라 사각형 좌표입니다.
- 둘 다 RGBA8, 알파0/255, Pixelated, ImageColor3 흰색. **패널 중앙이 어두우므로 현재 간판의 어두운 글자색(40,26,14)을 밝은 색, 예: #e8ecf5로 변경해야 합니다.** 글자는 런타임 텍스트로 유지합니다.

## 4. 월넛 간판 — 업로드만으로 자동 교체되지 않음

![간판과 키5stud 아바타 비교](../art/roblox-v0.5.0/review/tutorial-sign-scale.png)

| 자산 | 납품 |
|---|---|
| `signpost` 메시 | [signpost.fbx](../../roblox/assets/lobby/meshes/signpost.fbx), 19,900 bytes, **88삼각형 / 메시1개 / 재질1개** |
| `signpost_albedo` | [signpost_albedo.png](../../roblox/assets/lobby/textures/signpost_albedo.png), **512×512**, 42,108 bytes |
| OBJ 대안 | [signpost.obj](../../roblox/assets/lobby/meshes/signpost.obj) + [signpost.mtl](../../roblox/assets/lobby/meshes/signpost.mtl) |
| 편집 원고 | [tutorial-art.blend](../art/roblox-v0.5.0/tutorial-source/tutorial-art.blend), [원고 안내](../art/roblox-v0.5.0/tutorial-source/README.md) |

- 전체 크기 **4×4.6×0.35 stud**, Y-up, 1unit=1stud, front local **−Z**, 밑단 pivot(0,0,0). FBX `bake_space_transform=true`, custom properties 없음.
- 로컬 bounds=(-2,0,−0.175)..(2,4.6,0.175), **bbox 중심=(0,2.3,0)**. MeshPart 중심 배치와 밑단 피벗을 혼동하지 마세요.
- 판은4×2.2×0.25, 중심(0,3.5,0). 전면 중심(0,3.5,−0.125). 앞면 글자 없음, 단일 사각 UV 섬입니다. 알베도는 기존 로비 월넛에서 파생했으며 조명을 굽지 않았습니다.
- 현재 `Lobby`의 `MESH_SIZE`/`MESH_TEX`/템플릿 로드·배치에는 signpost가 아직 없습니다. **해당 메시 연결은 Mars가 추가해야 합니다.**
- `TutorialSign/Board` 캐리어를 보존해 기존 `SurfaceGui`/`ProximityPrompt`와 클라이언트가 찾는 경로가 유지되게 하세요. 전체 간판 MeshPart에 SurfaceGui를 바로 붙이면 글자가 기둥까지 포함한 bbox에 펼쳐질 수 있습니다. 글자용 판4×2.2 캐리어와 표시용 메시의 역할을 구분합니다.
- 현재 `CFrame.lookAt(SIGN_POS, SIGN_POS + Vector3.new(0,0,1))`는 로컬−Z를 스폰(+Z) 방향으로 돌립니다. **기존 의자의 180도 보정을 간판에 무조건 복사하지 마세요.** Studio에서 정면/뒷면을 확인합니다.
- Blender 원고의 `REVIEW_ONLY_*` 바닥·아바타·카메라·조명과 QA 장면은 검수 전용입니다. 런타임으로 올리지 않습니다.

## 5. 썸네일 — 요청한 사진 포함

![Digit-Duel Roblox 경험 썸네일](../../roblox/assets/marketing/digit-duel-thumbnail-v1.png)

[**digit-duel-thumbnail-v1.png**](../../roblox/assets/marketing/digit-duel-thumbnail-v1.png): **1672×941 PNG / 2,678,576 bytes**, 약16:9. 프롬프트의 희망 해상도가 아니라 실제 파일 규격입니다. 1920×1080 파일로 표기하지 마세요.

SHA-256: `b3730ea4b50aa841784a4ed18a30a1b36eba5222debba3c500f6aa0cd449171c`.

이전 턴의 내장 image_gen 결과를 바이트 그대로 보존했습니다. [최종 프롬프트/제작 기록](../art/roblox-v0.5.0/thumbnail-source/README.md). 사용자 참조의 캐릭터4종·금색 Digit-Duel 로고·가림 말을 유지한 **경험 홍보용 가로 썸네일**이며, 정사각형 경험 아이콘이나 게임 UI 그림이 아닙니다.

**runtime manifest/AssetIds에 넣지 않습니다.** 게시 요청/권한이 있는 담당자가 Creator Dashboard의 경험 썸네일로 등록해야 합니다. 실제 업로드·심사는 미실행입니다. 작은 화면의 크롭/하단 오버레이를 미리 확인하세요. [Roblox 썸네일 가이드](https://create.roblox.com/docs/production/publishing/thumbnails).

## 6. 확정된 CJ 결정 — 대기 항목 아님

최신 요청서의2026-09-11 결정대로 **자동 표시 없음**, 간판/HUD/[H]로 열기, 간판은 **(0,0,40)에서 스폰 방향**, **대전 중에도 열기 허용**입니다. 이전 초안의 “기획3건 미정” 설명은 폐기합니다. Earth가 새 기획 결정을 내린 것이 아닙니다.

## 7. Claude 적용 순서와 작업 경계

1. 위 P1 함수 이름 충돌이 남아 있는지 확인/수정하고 로비 생성부터 검증합니다.
2. 신규 manifest **root12행 + lobby2행**의14자산을 업로드하고 실제 반환 ID를 연결합니다. 기존 자산169개는 변경하지 않았습니다.
3. 그림10장/도움말을 현재 접근자로 연결하고, signpost 메시/텍스처 연결 및 판 캐리어·선택 패널을 적용합니다.
4. Studio에서 E/H/HUD/대전중 열기, 10단계 이동/닫기, 모바일 비율, 메시 크기/방향/밑단, 글자 대비, 기존 테이블4개를 검증합니다.
5. 썸네일은 게임 자산 업로드와 분리하여 게시 권한/요청에 따라 등록합니다.

실제 저장소는 `C:\WOOK\pvpserver\client`, 기준 브랜치는 `milestone/v0.5.0`입니다. 이슈 브랜치/PR 기준도 이 트랙이며 Git 쓰기는 Mercury 담당입니다. Earth는 **Luau/JS/Python 파일·기존 자산·기존 manifest 행을 변경하지 않았고**, commit/push/PR/게시를 실행하지 않았습니다.

문서화 스킬에 따라 납품 완료와 Claude의 적용 작업을 구분했고, 이미지 제작 스킬의 기존 아이콘 체계 재사용 원칙에 따라 튜토리얼은 Blender 내부 아트 명령으로 제작했습니다. 사용자에게 해당 명령 사용 승인을 받았습니다. 신규 아트·브랜딩·원고·검수 이미지는 `ASSET-LICENSE.md`에 따라 Apache-2.0 제외입니다.
