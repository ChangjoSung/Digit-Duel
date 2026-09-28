# #253 Earth — common UI art

[결정] Approved work direction implemented as an art-only delivery, 2026-09-24. Earth / IMPLEMENT / ART / assets / single editor. Reference: [GDD-24 §00.9](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8), [Venus report](../Venus/report.md), existing `demo/css/game.css` and `demo/assets`. Baseline supplied by dispatch: milestone/v0.4.11 `5c833b5`; no Git commands used.

## Files and use

All paths below are relative to this Earth directory. Reusable runtime SVG assets are standalone, font-free editable originals and game-readable exports; the review contact sheet depends on sibling SVG files and a local system font, while its PNG preview is standalone. Text in the preview is illustrative and is not baked into reusable assets.

| File | Dimensions | Screen / state / slicing |
|---|---|---|
| `frame.svg` | 432×800 | T01/L01/L02/L03/S02/S03 shared navy surround and background. Top 48px and bottom 48px are fixed-height strips; five equal bottom segments are visual slots only. Keep 24px corners fixed, stretch center/edge lengths. Interior is background, not a board replacement. |
| `panel.svg`, `panel.png` | 64×64 | Basic, confirmation, information and waiting modal surface across S/M/B/X screens. Nine-slice insets **12px each side**, center 40×40; scale edge lengths, never corners. Confirmation uses same surface with two separately laid-out buttons. |
| `buttons.svg` | 480×240 | All common screens. Atlas of **160×48** cells; columns primary / secondary / danger, rows default / hover-focus / pressed / disabled / loading. Cell origin `(160×column,48×row)`, zero-based. 8px corner insets for normal button backgrounds; loading glyph must remain 24px rather than stretch. Use full 48px cell for hit area, including transparent bevel margin. |
| `icons.svg` | 288×24 | Twelve 24×24 cells, left-to-right: help, personal detail, history, back, close, resign, timer, refresh, currency, lock, complete, indeterminate loading. White single-colour strokes, transparent background. Shared top bar and matching existing actions; currency is a generic symbol, not a new economy. |
| `icons-1x.png`, `icons-2x.png` | 288×24 / 576×48 | Transparent raster icon exports; cell width 24 / 48 respectively. Display at 24 logical pixels with ≥44px interaction area. |
| `wait.svg` | 320×160 | X01 opponent connection wait; same neutral treatment reusable for L03 entrance waiting and X03 reconnect with appropriate live text. Fixed pause emblem; text safe area x24–296, y88–140. Reuse panel nine-slice for variable height, rather than scaling the emblem. No percentage, countdown, promise of reconnection or extra action. |
| `privacy.svg` | 432×800 | X02 fully opaque flat `#12151c` base covering every pixel, no alpha/filter/mask. Stretch to the complete viewport; content/icon/button are separate and retain logical size. Intended for existing handover; proposed S01/S05/B02/B08 coverage remains #238 scope. |
| `status.svg` | 128×32 | Four 32px cells: notification dot, empty neutral number capsule, 72% dim tile, neutral pause badge. Used where existing state requires them; no invented status meaning or read/unread behavior. |
| `contact-sheet.svg`, `contact-sheet.png` | 1200×1380 | Review composition: frames/modals, all fifteen button cells, small icons, panel tile, status samples and X02 at actual widths 320/390/432px. SVG requires sibling assets; PNG is standalone. |

## Visual decisions and reuse

Existing palette retained: background `#12151c`, panel `#1c2130`, raised panel `#242b3d`, line `#333c52`, navy `#132139` / `#1c2f4d`, text `#e8ecf5`, muted `#8a93a8`, primary fill `#2f5fd0`, focus accent `#5b8cff`, danger line `#ff5b6e`. Subtle cut corners and inset lines provide a restrained dark-fantasy frame without competing with pieces. Danger fill reuses zone-B `#502a33`; no pale text on the brighter accent fill.

Reuse the existing CSS board tiles, terrain, 7×13 board geometry, title typography and leader/minion illustrations; existing `demo/assets/symbols/trap.svg` stays unchanged. These are reuse recommendations, not copied or modified resources. Native solid rectangles suffice for ordinary modal scrim (`#000c`, as existing), separators, hit areas and dim overlays; do not produce duplicate assets for them. **Ordinary translucent scrim must never substitute for X02.** One panel covers the four modal treatments; no artificial asset count.

The compact top-row contact-sheet frames are art studies, not proposed screen heights. At integration, preserve 48px bar height and fixed corner sizes. Keep all text live/localizable and icons at 24 logical pixels. The loading glyph is indeterminate; its static form is also the reduced-motion treatment. Decorative edges are not the sole state indication: keep text labels, focus ring, disabled semantics and accessible names in runtime.

## Motion handoff — Venus proposals, not newly approved timing

| Token | Proposed duration | Reduced motion |
|---|---:|---:|
| button | 120ms | 0ms; colour/state change |
| panel-in | 200ms | 0ms; immediate visible panel |
| panel-out | 160ms | 0ms |
| screen-in | 240ms | 0ms |
| screen-out | 180ms | 0ms |
| emphasis-max | ≤1200ms, once | 0ms; retain colour and text |

Suggested native curves: ease-out for entry, ease-in for exit. These are documentation tokens only, not runtime code. X02 must cover immediately and stay fully opaque while private state changes; any later reveal is #238 integration, not permission to fade through private content. CJ timing confirmation remains open.

## Inspection and limits

Rendered with installed Chrome headless, then visually inspected the PNG. Twelve icons are distinct at 24px; the sheet also shows a 36px visual enlargement. X02 samples at **320, 390 and 432px** show readable fixed-size lock/copy/actions with no clipping. Bright magenta rectangles deliberately sit behind each privacy sample: none shows through the opaque surface. The first sandboxed render failed to start Chrome's GPU process; the permitted retry produced the review PNG. PNG exports were also opened for inspection.

This proves the art's visual treatment, not runtime privacy or focus management. #238 must verify full viewport/safe-area coverage, stacking above all private content, locked underlying input, accessible modal focus, and no private-state transition flash. No runtime, build, tools, test, GDD, GitHub or Git files were edited; only this Earth directory was written. No custom generation code or subagents were used.

## Source / license and #238 handoff

All new vector geometry is original hand-authored Earth art, derived only from the project's existing palette and common geometric shapes; PNGs are browser exports. No stock art or AI bitmap generation was used. All **SVG and PNG artwork here is explicitly excluded from Apache-2.0**, copyright 2026 Sung Changjo and the respective contributors, all rights reserved, under `ASSET-LICENSE.md`'s future-original-art exclusion. This Markdown documentation remains under the code license. Mercury should add the explicit Earth path to the root exclusion list; Earth did not edit that file.

#238 owns final screen composition and all behavior after #236/#237 contracts: shop cards/prices/SOLD OUT, field/bag slot states, ranks, notification placement and clearing, consumable/guardian/ticket/ball art, synergy chips, specific confirmation layouts, B02 candidates, battle HUD, skill FX, B08 overflow, S04 final result, and server-driven wait/timer display. No account/login/chat, fixed-percent loading, server facts or game rules were added. CJ confirmation of open Venus proposals and Saturn independent review remain with the coordinator.
