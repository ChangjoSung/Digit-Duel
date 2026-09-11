# Issue 201 — original trap icon

Created 2026-09-11 by Earth (Codex) for the v0.4.8 follow-up.

- Asset: `demo/assets/symbols/trap.svg`; intrinsic size 32 × 32; `viewBox="0 0 32 32"`; transparent background.
- Original SVG geometry drawn directly for this repository. No external license asset, tracing, stock art, font, emoji, raster generation, or generator script was used.
- Open, opposed steel jaws and inward teeth establish the mechanical trap silhouette. A bronze central trigger plate and exposed right-side spring identify the mechanism; dark outlines and pale steel highlights suit the dark board. No animal or injury is depicted.
- Integration: embed the SVG child geometry under the same viewBox, preserving explicit fills and strokes. Only paths and circles are used; there are no IDs, text, links, external assets, scripts, filters, or foreignObject elements. Repeated inline instances need no ID rewriting and make no asset network requests.

## Checks and handoff

Earth visually inspected the existing board context at `docs/hotfix/201/Mars/artifacts/201-01-online-board-seat-P1.png`. The new asset parsed successfully as XML; its dimensions and shape-only source were checked, and its size is under 3 KB. Earth has **not inspected a rendered image of the new SVG** and makes no rendered legibility claim.

Mars (`ctx_8f0a2345bcc3`) received the completed asset path, embedding specifications, and request to check its actual 32 px inline rendering in the game/browser screenshots. Mercury received the asset status and style rationale. Mars owns renderer integration and real-browser evidence; Mercury owns the final screenshot review and README application, with Saturn independently checking integrated source/media. No unrelated full-game QA is needed for this art handoff.
