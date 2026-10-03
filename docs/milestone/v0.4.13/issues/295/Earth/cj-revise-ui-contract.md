# #295 CJ REVISE — Turn Shop UI Contract

**Status:** Design contract only; no render or visual PASS is claimed. Supplements `docs/milestone/v0.4.13/issues/295/Earth/UI_CONTRACT.md` for this REVISE.
**CJ sources:** `docs/milestone/v0.4.13/issues/295/references/CJ_REVISE_20261002.md` and `CJ_REVISE_20261002_1.png`, `CJ_REVISE_20261002_2.png`, `CJ_REVISE_20261002_3_TFT.png` in the same `references/` directory.
**Existing grade contract:** `docs/milestone/v0.4.13/issues/293/Earth/UI_CONTRACT.md:38-48`.
**Read-only touchpoints:** `demo/js/ui.js` (`shopHtml`, `topBarHtml`, `unitCard`, `infoBtn`); `demo/css/game.css` (`#app`, `.overlay`, `#overlayBox:has(.shopSheet)`, `.topBar`, `#emoteLayer`, `.shopSheet.turn`, `.shopCard`, `.uSlot.uCard`, `.synRail`, `--g1`–`--g5`); `demo/index.html` (`#emoteLayer`).

## Information button

- On the main screen's selected-minion info button, show the species name followed by `하수인 정보`, as in the sketch. Keep its existing info action.

## Turn-shop frame and header

- Apply the frame layout only to `.shopSheet.turn`: bound it to the measured `#app` rectangle (including desktop inset), from frame top to bottom; leave no board/header gutter visible above it. Do not alter ordinary board, room, battle, or help-popup anchoring.
- Keep exactly one shared `.topBar` at frame top: `.idHead` owns the left 50% identities and `.tbTools` the right 50% tools. Include the existing `#emoteLayer #emoteBtn` in that header; do not duplicate the header or emote control.
- Keep the active seat's server-authoritative 180-second `#shopClock`, own coin count, existing emote button, and gear readable together at 320px, 390px, and the 432px frame. Compact clock/coin icon-number displays when needed; retain all functions and every button at least 44×44px.
- Fill the available frame height. Keep the header visible while the shop body scrolls independently; preserve independent `.synRail` scrolling and bottom safe-area reach. Size against `#app`/inner content width, accounting for document and `#overlayBox` scrollbar gutters without horizontal clipping or a double scrollbar.

## Purchase rows and grade cues

- Keep each `.shopCard` the base card's single-row height: compact from-grade ↓ to-grade stars stacked at left; existing minion art, name, tags, and actual HP in the middle; actual-price purchase control at right. Remove the extra bottom `.up` badge row; do not change prices, grade rules, sale behavior, or stats.
- Show each unit's actual grade border consistently in purchase list `.shopCard.gN`, field `.uSlot.uCard.gN`, and bag `.uSlot.uCard.gN`, using existing `.g1`–`.g5` / `--gc` and `--g1`–`--g5` palette only. Keep existing fills and art; selection/death cues remain separate from grade.
- Keep the start shop, 44px controls, eight-stat 4×2 detail, and future-locked skill styling/wording intact. Preserve all existing game, economy, 180-second wait, privacy, and popup rules; handwritten reference values are illustrative.
