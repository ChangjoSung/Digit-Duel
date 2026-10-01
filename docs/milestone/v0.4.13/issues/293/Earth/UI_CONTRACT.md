# #293 UI visual contract

**Status:** Updated for CJ’s latest [#293 REVISE](../references/CJ_QA_REVISE_20261001.md) and its six original images. This contract supersedes earlier #293 visual rules wherever they conflict. Runtime rules follow Venus’s [implementation contract](../Venus/implementation-contract.md); this file covers their visual presentation and does not claim product QA approval.

## Latest visual requirements

### Preparation and ready state

- Show one shared **180-second** preparation countdown in the top bar through the start shop and placement. It is server-based, has the same deadline for both players, and does not restart when the phase changes or a player becomes ready.
- Keep `01 상점 / 02 배치 / 03 완료` on the step bar and place both players’ badges (`P1`, `P2`) at their reported current steps. Remove the detached opponent status box and the bottom waiting strip.
- When this player is ready and the other is still preparing, show an opaque popup centered over the board with `준비 완료 · 상대 기다리는 중…` only; keep `준비 취소` in the existing top-right header progress-button position (image 2). The button closes the popup and returns to placement; the countdown stays visible and continues.

### Sales and attribute ticket

- Keep the field sell action available immediately after buying a minion while the shop remains open. A stocked-out shop row alone must not make the sale control look unavailable; existing validation such as the reserve-coin rule may still show its normal feedback.
- Field and bag sales happen directly without a confirmation window; the gold display updates as feedback. Upgrade and ticket-use confirmations keep their existing behavior.
- In the **start shop only**, show the existing ticket icon and `무료` beside the `왕·동료 속성` title, regardless of ticket balance. The regular shop keeps its existing ticket-count display.

### Piece faces and synergies

Board, deployment-tray, and result faces use the same piece layout:

| Position | Minion | King or companion |
|---|---|---|
| Top-left | Actual kingdom icon | Actual assigned kingdom icon when available |
| Top-right | Actual archetype icon | Existing king / companion role icon; no invented archetype |
| Center | Existing portrait | Existing portrait |
| Bottom | Heart icon and actual current HP number; no percent | Heart icon and actual current HP number; no percent |
| Background | Existing grade 1–5 color token | Neutral background; no invented grade |

- Remove stars from board, deployment-tray, and result faces. Shop and replacement cards retain their existing grade border, star, and current/max HP presentation.
- Keep the grade fill opaque and all labels and icons readable against it, using existing contrasting UI treatments. State treatments use distinct opaque badges or panels: selection keeps its own ring and `선택` label; a dead piece shows `사망` and its HP. Do not cover the grade fill with a translucent wash or use color as the only state cue.
- King and companion faces have no archetype. Before an attribute is assigned, leave the kingdom position neutral; after assignment, show the actual kingdom. Hidden opponent pieces reveal no identity, kingdom, role/archetype, HP, or grade until they are public.
- Keep the existing kingdom and archetype synergy chips, and show the existing King/companion synergy chip. Add a personal legendary synergy chip only while that legend is owned and its existing effect is active. A bag-held legend qualifies only if its existing rule activates that effect in the bag; hide inactive or unowned effects. Keep existing values and thresholds, with readable counts or labels alongside color.

## Grade tokens and existing assets

Use the current `demo/css/game.css` `--g1`–`--g5` tokens as opaque **background fills** for grade-bearing board, tray, and result faces; do not add or substitute grade colors.

| Grade | Token | Color |
|---:|---|---|
| 1 | `--g1` | `#ffffff` |
| 2 | `--g2` | `#bce2cf` |
| 3 | `--g3` | `#376bce` |
| 4 | `--g4` | `#7651a8` |
| 5 | `--g5` | `#c89c3c` |

Reuse the existing project atlas at `demo/assets/ui/ui-icons.png` and the existing minion portraits. Relevant atlas indices from `demo/js/ui.js`: crown 13; fire, water, grass, lightning, land 14–18; atk, def, swift 19–21; heart 22; std, sustain, guard 35–37. Element and archetype names stay visible on full-size faces; compact faces retain clear accessible names.

## Responsive controls

- At both **320px and 390px** viewport widths, every visible button has a hit area of at least **44×44px**. Small glyphs may sit inside a larger target; reflow controls instead of shrinking targets.
- Keep the top bar and step bar readable at both widths. The centered ready popup must not cover either bar; the existing top-right header progress button remains at least 44×44px.

Use the six preserved originals linked from the latest CJ REVISE document as visual evidence. Do not add a raster, dependency, or new UI asset for these changes.
