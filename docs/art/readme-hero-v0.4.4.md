# README hero production record — v0.4.4

[결정] Earth_1 · ART / IMPLEMENT · Issue #105 · 2026-09-08

## Deliverables (workspace relative)

- `docs/media/digit-duel-hero.png` — PNG, **1672 × 941**, aspect ratio 1.7768:1 (approximately 16:9).
- `docs/art/readme-hero-v0.4.4.md` — this production record.
- Hero SHA256: `3215151A1CF978B90C8BD654B752C205FBD8A79B7A15188449ED4C4F49F33832`.

## Sources and provenance

Confirmed brief: CJ's Notion page “[Doc] README 전체 리뉴얼,” page ID `3d51e7f1-7085-80f1-8f2d-c4a643721059`, section 3, read through Notion fetch; it requests an Earth-produced main image before gameplay and tutorial images. The dispatched brief supplies the bounded composition and output requirements.

The following approved project portraits were each inspected with `view_image` and supplied to the built-in `image_gen.imagegen` tool in this order:

1. `demo/assets/minions/fire_std/portrait.png`
2. `demo/assets/minions/water_std/portrait.png`
3. `demo/assets/minions/grass_std/portrait.png`
4. `demo/assets/minions/lightning_std/portrait.png`

One reference-guided generation, one selected output, no variations or postprocessing. The tool's native PNG was copied byte-for-byte to the delivery path, preserving embedded provenance. Tool mode: built-in imagegen; no fallback API/CLI, rendering scripts, or source edits. Exact backend model settings and seed were not exposed by the invocation. Existing approved assets were read as references and were not modified.

## Author visual check and limits

Confirmed: reopened the saved deliverable with `view_image`; PNG decoded successfully, all four character faces and signature elements remain recognizable, the exact “Digit-Duel” title including hyphen is legible, and six anonymous question-mark tokens communicate concealed identities between blue and red sides. Forest, board, lighting, and title form a coherent landscape composition; no obvious clipping, extra character, fake HUD, release/mobile claim, or developer jargon was observed. The image was also inspected in its displayed reduced preview; an actual README/browser placement check remains for integration.

Art interpretation: the forest staging, token shapes, and elemental pairing on each colored side are promotional composition, not a rules specification or a literal gameplay screenshot. The supplied approved portraits have a smooth illustrated finish, which the hero preserves; squared board tiles provide compatibility with the game's board aesthetic without converting the characters into a different pixel-sprite design. Generated characters are faithful visual interpretations, not pixel-identical pasted sprites.

Independent Saturn review and CJ approval remain pending; this is the artist's file/visual check only. PD owns README integration, Issue #105's single PR, publication, archive, and release.

## License

This original/derived hero artwork and its Digit-Duel branding are **explicitly excluded from Apache-2.0** under `ASSET-LICENSE.md`. Copyright 2026 Sung Changjo and the respective contributors; all rights reserved, subject to that file's stated identification/description and permission exceptions. Only the four project portraits were supplied as image references; no third-party game artwork or example screenshot from Notion was used as an image input. AI generation does not establish copyright eligibility, exclusive ownership, or a guarantee against all visual similarity.

## Exact generation prompt

```text
Use case: ads-marketing
Asset type: ONE finished landscape README gallery hero / original game key art, approximately 16:9, ideally 1536x864 or 1600x900.
Primary request: compose the four supplied existing Digit-Duel minion characters into a polished original hidden-identity 1v1 tactical board-game confrontation in an enchanted forest clearing. This is an illustrative promotional composition.
Input images in order, all character identity and rendering references: 1 fire_std orange baby lava dragon with cream horns/belly, charcoal lava plates, small wings and magma tail; 2 water_std cyan water sprite with curled droplet crest, pale face, blue eyes, translucent fin wings; 3 grass_std small round wooden sprout with green leaf armor, amber eyes and two tall leaves; 4 lightning_std navy round little automaton, cream face, amber eyes, three gold crystal electrodes with arcs, gold lightning chest emblem.
Preserve these four recognizable designs faithfully, matching their rounded detailed illustrated minion style and proportions. Do not redesign them into unrelated creatures. Repose and light them naturally for the scene.
Scene: lush deep teal forest with broad tree silhouettes, mossy square-tile tactical board in clear oblique perspective; quiet luminous mist behind the board. Strong silhouette readability. Subtle squared pixel-like tile edges connect to the game board aesthetic; maintain the reference character illustration finish.
Composition: prominent centered exact title at top within generous safe margins, with clean dark canopy behind it. Characters below it, two facing inward from the blue-lit left flank and two facing inward from the red-lit right flank, with open tactical space between them. Water and grass on the blue side; fire and lightning on the red side for visual composition only. Show all four faces and signature details, large enough to read at README width. A few small opaque standing board tokens on blue/red bases occupy the central board; each token bears a simple question-mark motif indicating concealed identity. They are anonymous game tokens, not new creature designs. Keep the central board restrained and clearly visible, avoid clutter.
Lighting and palette: sapphire/cyan rim light on left, warm scarlet/amber on right, deep forest greens, warm ivory title. Vivid yet balanced with controlled glow, crisp edges and atmospheric depth.
Text verbatim: "Digit-Duel". Large handsome bold readable fantasy game lettering with restrained gold bevel/dark outline, integrated in top center. The hyphen must be present. No other text except the simple question marks on concealed tokens.
Constraints: original art using only the supplied project character references; no third-party game artwork, recognizable borrowed settings, logos or UI; no screenshot imitation, buttons, HUD, numbers, stats, badges, store/download marks, release/mobile availability claims, developer or QA jargon, watermarks, extra characters, slogans, border or collage panels. Intentional polished key art that remains legible when reduced to about 900 pixels wide. One output only.
```
