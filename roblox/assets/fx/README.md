# [결정] 전투 FX·메모 적용 계약

2026-09-10 · Ref #118 · Earth 아트 납품. **13 FX 시트 + 메모2PNG**.
[전체 납품 보고·해시·원고](../../../docs/art/roblox-v0.5.0/earth-fx-report.md) · [P1 프레임 시트](../../../docs/art/roblox-v0.5.0/review/fx/p1-frames.png) · [P2 프레임 시트](../../../docs/art/roblox-v0.5.0/review/fx/p2-frames.png).

| 항목 | 값 |
|---|---|
| 파일 | `<id>_96x8.png` |
| kind / 키 | fx96 / fx96_접두 + id |
| 크기 | **768×96**, 96×96 프레임8개 가로 배열 |
| ImageRectSize | **96,96** |
| ImageRectOffset | **96*n,0**, n=0..7 |
| 마지막 프레임 | 완전 투명. 1회 재생 후 숨김 |
| ResampleMode | Pixelated |
| 9-slice | 사용하지 않음 |
| 원본 | native48 프레임8개 → 최근접2배 |
| alpha | RGBA8,0/255 |

P1 id: hit / explosion / trap / shield / heal / burn / weaken / shock / capture / flee.
P2 id: dragon / witch / reaper.

**tint=yes는 hit·shield·heal만**, 불투명 RGB 순백. 나머지 FX10은 ImageColor3 흰색.
메모 `board_hl_memo`, `token64_memo`도 tint=no다.
메모 하이라이트128×128의 SliceCenter는32,32,96,96. **32px 셀에는 SliceScale0.25** 또는 균등 축소를 쓴다.
메모 배지는64×64이며 수동 메모 존재만 뜻한다. 숨겨진 실제 유닛 타입을 표현하지 않는다.

현행 전투원 그림은76×76이라 납품 프레임96×96과 구분한다. FX의 실제 표시 크기·위치·ZIndex·재생 속도·중첩·입력 정책은 Mars/CJ 구현 범위다.
이 아트는 재생 시간·입력 잠금·전체화면 플래시·화면 흔들림을 확정하지 않는다.
접근자·프레임 재생기·이벤트 연결·업로드·AssetIds 갱신은 포함하지 않는다.

FX는 내장 image_gen 원화 + Blender 내부 규격 정리로 제작했다. 메모는 기존 편집 가능한 native 픽셀 UI 체계를 확장했다.
편집 JSON과 생성 프롬프트·원화·정리 방식은 보고서에 있다. 생성 원화는 런타임 PNG가 아니다.
시각 아트는 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 **Apache-2.0 제외**.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
