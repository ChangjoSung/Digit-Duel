# #295 Turn-Shop UI Contract

**Status:** CJ-approved design contract. The preserved images below are references only; no #295 render or visual PASS is claimed. CJ's 2026-10-02 approval replaces the older 90-second recommendation with 180 seconds per acting shop seat.

## Layout

- Reuse the existing vertical shop sheet and art inside the game frame. Review at 320px and 390px viewport widths; on desktop, keep the game frame centered at 432px and clamp the sheet to the available frame/viewport width.
- Keep the shared `.topBar` exactly 50/50: player identities occupy the left half; existing screen tools occupy the right half. Do not add another identity or status row.
- Keep `N턴 상점` and `완료` together in the regular-shop title/action row; place the active seat's server-authoritative 180-second clock, own coin count, and existing refresh control in the same compact header. Do not show the start-preparation `01 상점 / 02 배치 / 03 완료` step bar here.
- Keep one vertical, scrollable shop body in this order: one-item-per-row purchase list; own 3-column field; own bag (3 columns above 360px, 2 columns at 360px and below); the three king/attack-ally/defense-ally icon rows; item cards. Put own synergies in the existing right rail, not a second body section.
- The right rail shows only this seat's existing synergy chips, including the existing active personal-legend chip. Preserve its 44px chips, order, independent scrolling, and access to the final chip.
- Preserve current grade faces/tokens, minion art, item atlas, coin icon, prices, sale behavior, bag capacity, and selection semantics. Add no assets, dependencies, routes, or server fields.

## Done and waiting

- On `완료`, close the shop sheet and reuse the existing board-centered `.readyPop` shape with `role="status"` and polite live announcement. Use a strong own-complete headline (for example, `내 구매 완료`) and a short readable body of at least 12px (for example, `상대 상점 구매 중 · 잠시 기다려 주세요`). Do not offer a cancel or reopen action.
- Say the opponent is buying only while existing server state confirms that. If authoritative connectivity/clock state reports the opponent paused or missing, say that and that the shop clock is paused; if state is unavailable, say `상대 상태 확인 중`. Never infer opponent activity or time from this client's clock.
- Preserve server-authoritative deadlines, disconnect pause/reconnect remaining time, non-cancelable completion, committed trades, and privacy boundaries. Modal open/close does not restart a deadline.

## Sizing, controls, and preserved details

- Keep visible buttons, purchase actions, leader choices, rail chips, and popup close controls at least 44×44px. Current CSS uses 3 columns for field and bag; at <=360px, keep the field at 3 and let the later bag rule switch only the bag to 2 columns (the older 6-column default is already overridden).
- Use the existing modal overlay's max-height and vertical scrolling; the last item and last rail chip must remain reachable. Keep the existing emote button at its frame-anchored top-right position and preserve the overlay's emote-safe top inset/max-height. Do not place the title, clock, or `완료` under that button.
- Keep the shared eight-stat detail at 4×2 and preserve future-locked skill styling and wording.
- Retain existing `--g1`–`--g5` opaque grade fills, `ui-icons.png`, goods atlas, coin icon, and minion portraits; do not recolor or substitute artwork.

## Existing implementation references

- Approval: `references/CJ_IMPLEMENT_APPROVAL_20261002.md:5-10`.
- Shop markup/actions and own synergy rail: `demo/js/ui.js:2069-2128,2178-2200,2201-2232,2233-2248,2255-2283`.
- Existing sheet/targets, responsive bag, rail, 50/50 bar, ready popup, emote-safe overlay, and 4×2 stats: `demo/css/game.css:175-178,557-569,813-820,990-1018,1028-1030,1094-1101,1230-1255,1291-1292,1317-1319,1333-1337,1343-1348,1420-1424`.
- Existing waiting status and modal lifecycle: `demo/js/ui.js:1033-1039`; `demo/js/ui-overlays.js:6-29`.
- Preserved visual references: `issues/293/Mars/12-shop-desktop.png`; `issues/294/Mars/evidence/390-prep-done-header.png`; `issues/294/Mars/evidence/revise2-20261002/1100-wire-bag-g2-sustain-status10.png`.
- Grade/art contract: `issues/293/Earth/UI_CONTRACT.md:36-48`; shared 4×2 stats and future locks: `issues/294/Earth/UI_CONTRACT.md:85-88`, `demo/css/game.css:1420-1424`.
