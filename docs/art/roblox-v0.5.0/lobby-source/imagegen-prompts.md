# 로비 텍스처 생성 이력

2026-09-09. CJ 승인: 어두운 보드게임 카페 테마, 게임 코드 변경 없이 Blender 내부 아트 제작 명령 허용.
생성 방식: imagegen 스킬의 기본 내장 도구. 외부 이미지·브랜드·글리프 참조 없음.

## walnut-imagegen-original.png

원본 생성 파일: `exec-6aa0f403-f45a-47b3-9627-175a72612569.png`.
생성 결과는 원본 그대로 이 폴더에 보존하며, Roblox에 직접 업로드하는 이미지가 아니다.
최종 메시 UV에 Blender 알베도 베이크로 적용하며 런타임 텍스처는 각 변 1024 이하로 출력한다.

```text
Use case: stylized-concept
Asset type: seamless tileable game texture, albedo only, square 1024x1024 PNG.
Primary request: warm smoked walnut furniture wood grain for a dark, quiet board-game cafe in a low-poly Roblox game.
Composition: perfectly flat orthographic surface scan filling the entire square edge to edge, fine elongated mostly vertical wood grain, a few very subtle flowing grain arcs but no prominent knots; NOT a rendered table, NOT a room. Uniform mid-dark warm brown around #6e4e32, restrained gentle grain value variation, stylized clean premium finish.
Lighting: absolutely flat diffuse albedo, no directional light, no shadow, no highlight, no vignette, no baked ambient occlusion.
Constraints: seamless left/right and top/bottom boundaries for repetition, continuous texture, no plank joints, no borders, no text, letters, labels, logos, numbers, watermark, props, or perspective. Single opaque texture asset, not a contact sheet.
```

판 격자와 상태 표지는 AI 이미지가 아닌 정확한 픽셀/UV 배치를 사용하는 Blender 내부 생성 자산이다.
원본과 파생 시각 아트는 ASSET-LICENSE.md에 따라 Apache-2.0에서 제외된다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.

