# [결정] 튜토리얼 그림 10종

2026-09-11 · Earth · Ref #118 · `tut512_<id>` / `Art.tut(id)`.

![512×288 원크기 검수 시트](../../../docs/art/roblox-v0.5.0/review/tutorial-panels-contact.png)

| 순서 | id | 파일 |
|---|---|---|
| 1 | win | [tut_win.png](tut_win.png) |
| 2 | pieces | [tut_pieces.png](tut_pieces.png) |
| 3 | move | [tut_move.png](tut_move.png) |
| 4 | search | [tut_search.png](tut_search.png) |
| 5 | battle | [tut_battle.png](tut_battle.png) |
| 6 | bomb | [tut_bomb.png](tut_bomb.png) |
| 7 | capture | [tut_capture.png](tut_capture.png) |
| 8 | tele | [tut_tele.png](tut_tele.png) |
| 9 | burn | [tut_burn.png](tut_burn.png) |
| 10 | check | [tut_check.png](tut_check.png) |

- 각각 **512×288 RGBA8**, native256×144 최근접2배. 전체 알파255, 바깥 배경 `#13161e`.
- `ImageColor3` 흰색, `ResampleMode=Pixelated`, `ScaleType=Fit`, 16:9 유지. 9-slice 사용 안 함.
- 글자·숫자·폰트 글리프 없음. 최신 HTML `TUT_STEPS`/현재 `TutorialUi`의 설명문을 함께 표시한다. 그림은 설명의 핵심을 요약하며 전체 규칙을 대체하지 않는다.
- 포획 도구는 기존 보라색 다면체, 함정은 기계식 덫. 숨은 말은 종류별 모양을 새로 노출하지 않는다.
- [픽셀 원고 JSON](../../../docs/art/roblox-v0.5.0/tutorial-source/native-assets.json), [Blender 원고](../../../docs/art/roblox-v0.5.0/tutorial-source/tutorial-art.blend), [납품 보고](../../../docs/art/roblox-v0.5.0/earth-tutorial-report.md), [Claude 최종 인계](../../../docs/roblox/claude-tutorial-thumbnail-handoff.md).
- Blender 내부 제작 명령 허용을 받은 뒤 기존 네이티브 픽셀 도형·아이콘을 확장했다. 이번 튜토리얼에 imagegen을 사용하지 않았으며 Luau/JS/Python 스크립트 파일을 추가하거나 수정하지 않았다.

이 PNG와 픽셀/Blender 원고·검수 이미지는 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 Apache-2.0에서 제외된다. Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
