# [결정] Digit-Duel 썸네일 v2 — Roblox 3D 게임 렌더 톤

2026-09-11 · Earth · Ref #118

![새 썸네일 v2](../../../../roblox/assets/marketing/digit-duel-thumbnail-v2.png)

- 최종: [digit-duel-thumbnail-v2.png](../../../../roblox/assets/marketing/digit-duel-thumbnail-v2.png)
- 실제 **1672×941 RGB8 PNG / 1,991,958 bytes / 불투명**, 3MB 미만. 약16:9.
- SHA-256: `a0e4dcffa3e0943dec277d3cca78224cffa9759713e695a49aa81174ec920fa3`
- 프롬프트는1920×1080을 희망했지만 실제 반환값은1672×941이다. 반환 PNG를 재샘플링/재인코딩 없이 그대로 복사했다.
- 제작: 내장 image_gen, CLI/API 대체 경로 미사용.
- 사용자 피드백: 기존 v1은 원본과 너무 비슷했고, 사용자 제공 타게임 썸네일들처럼 Roblox 느낌이 필요했다.
- 변경: 어두운 숲 판타지 포스터에서 **밝은 하늘·단순한 블록형 배경·장난감3D 캐릭터·굵은 제목·실제 보드를 두고 대결하는 구도**로 재구성했다. 네 기존캐릭터의 식별색/형태는 유지했다.
- 타게임 썸네일은 렌더톤만 참고했으며 그게임의 캐릭터/문구/UI/로고를 복사하지 않았다. Roblox 공식 로고, 가짜UI/버튼/배지 없음.
- 제목 `Digit-Duel` 철자와 네캐릭터, 파랑/빨강 가림 말, 보드 대결 의미를 육안 확인했다. 실제 게임스크린샷이나3D모델 파일이 아니라 홍보 일러스트다.
- 기존 [v1](../../../../roblox/assets/marketing/digit-duel-thumbnail-v1.png)은 보존했다. SHA256 `b3730ea4b50aa841784a4ed18a30a1b36eba5222debba3c500f6aa0cd449171c` 유지.
- 메타데이터용이므로 runtime manifest/AssetIds에는 넣지 않았다. 등록/게시/심사는 미실행.
- Roblox는16:9, 이상적으로1920×1080 썸네일을 권장한다. 실제표시에서는 비율/하단 정보 겹침을 확인한다. [Roblox Thumbnails](https://create.roblox.com/docs/production/publishing/thumbnails).
- 신규아트/브랜딩은 [ASSET-LICENSE.md](../../../../ASSET-LICENSE.md)에 따라 Apache-2.0 제외. Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.

## 최종 생성 프롬프트

```text
Use case: ads-marketing.
Asset type: ONE finished landscape Roblox experience thumbnail, 16:9, ideally 1920x1080, opaque full bleed.
Input image 1: ONLY the original game's character identity reference. Do NOT reuse its camera, composition, painterly rendering, forest poster design, or serif logo.
Input image 2: style/mood reference showing actual Roblox discovery thumbnails. Use its bright, simple, appealing 3D GAME-RENDER language, especially the playful smooth toy characters and board-game thumbnail, NOT its exact characters, brands, words, UI, play button, or layouts.
User specifically rejected the prior artwork as too similar to the input. Make a plainly DIFFERENT design at first glance, built as a Roblox-style toy 3D scene rather than a painted fantasy poster.
Scene: an oblique three-quarter view of a small raised tactical board on a chunky wooden game table, centered between rival creatures. Clean blue and red square territories with a small green center strip, visible thick rim, a few readable dark covered game tokens with big question marks and blue/red square bases. This is a turn-based hidden-piece board duel, not an action shooter.
Background: a bright, simple low-poly outdoor play space with green grass, a couple of blocky broad-canopy trees, and blue sky. Quiet, softly defocused shapes; no detailed forest, no ruins, no dramatic mist.
Subjects: exactly four existing original creatures interpreted as simple Roblox-compatible 3D toy pets: a cyan water fairy with ivory face, big blue eyes, a curled water crest and blue fin wings; a small warm wooden-faced leaf creature with two upright green sprouts and green leaf armor; a red baby dragon with cream horns and belly, dark red angular crown scales and small red wings; a dark navy and cream electric golem with orange eyes, a yellow crystal crest and orange circular chest core.
Preserve their recognizable identity colors, crests, horns, wings and friendly faces, but simplify geometry into chunky beveled forms, thick block-like limbs, smooth plastic surfaces, simple face decals and broad highlights. NO intricate painted scales, no realistic wood grain, no anime linework, no human characters.
Composition: water fairy and dragon are the two BIG main rivals leaning toward the tabletop from opposite sides in playful competitive poses; the leaf creature and electric golem stand slightly behind their respective partners, smaller but clearly visible. Rotate the board diagonally into the foreground for strong depth; show a few concealed blue/red pieces between the rivals. No four-creature lineup across the bottom. All faces and signature head crests remain inside safe margins. Keep the lower 10% nonessential.
Text (verbatim): "Digit-Duel" only, with the hyphen. Use very thick, friendly, rounded block lettering with a cream-white front, sunny yellow lower extrusion and strong dark navy outline/shadow. Compact clean wordmark in the upper part of the frame, fully readable at 300px, no fantasy serif lettering. The title must not cover faces.
Rendering: distinctly Roblox experience promotional 3D render aesthetic, bright toy-plastic geometry, simple ambient occlusion, crisp cast shadows, cheerful sky lighting, vivid cyan/green/red/gold, readable silhouettes, clean shapes, restrained effects, strong foreground hierarchy. A new render rather than a filter over the reference.
Avoid: realistic/painterly fantasy illustration, copied original composition, Roblox logo or wordmark, other brands, platform UI, fake buttons, arrows, NEW/UPDATE/free rewards claims, badges, borders, watermark, weapons, blood, extra creatures, unreadable small text. Only game title and question marks.
```

## worker_done

- required_role: Earth
- mode / area / mutation: IMPLEMENT / ART / assets, docs
- instance_index: null
- status: complete_art_delivery
- files_modified: `roblox/assets/marketing/digit-duel-thumbnail-v2.png`, `docs/art/roblox-v0.5.0/thumbnail-v2-source/README.md`, `docs/roblox/claude-marketing-handoff.md`
- resolution / bytes / hash: 위 실측값
- old_v1_modified / code / runtime_manifest / AssetIds / git_writes / upload: none
