# #293 UI visual contract

**Status:** Earth visual proposal for the latest CJ #293 comment. Runtime behavior follows [Venus’s finalized implementation contract](../Venus/implementation-contract.md); these static assets do not execute it or claim product QA.

## Minion card examples

The six examples below are read-only entries from `demo/js/data.js` `ROSTER`; each is a grade-1 starting-shop minion. HP is the source base HP at grade 1 and is shown full as current/max. S01 draws only grade 1; `ecoPrice(1)=1`, so the price pill is a separate one-coin value.

| Roster ID | Name | Kingdom icon | Archetype icon | Grade / stars | HP | Reused art |
|---|---|---|---|---:|---:|---|
| M-F2 | 화염 투사 | fire | atk | 1 / ★1 | 90/90 | `demo/assets/minions/fire_atk/portrait.png` |
| M-W4 | 안개 무희 | water | swift | 1 / ★1 | 85/85 | `demo/assets/minions/water_swift/portrait.png` |
| M-L2 | 뇌격수 | lightning | atk | 1 / ★1 | 90/90 | `demo/assets/minions/lightning_atk/portrait.png` |
| M-G1 | 새싹 파수꾼 | grass | std | 1 / ★1 | 100/100 | `demo/assets/minions/grass_std/portrait.png` |
| M-E3 | 철갑 코뿔소 | land | def | 1 / ★1 | 120/120 | `demo/assets/minions/land_def/portrait.png` |
| M-F6 | 화산 딱정벌레 | fire | guard | 1 / ★1 | 110/110 | `demo/assets/minions/fire_guard/portrait.png` |

All six appear in the shop, replacement, and contributor-gallery views; the field and bag views show five field cards plus the sixth bag card. Deployment shows one full selected card alongside a deliberately compressed 14-slot schematic tray. In runtime, every minion in that tray carries grade border + star count, kingdom, archetype, HP, portrait, and an accessible name; the static tray icons do not depict those card fields. King and ally retain their existing kingdom data; do not invent grade/star, archetype, or HP for them. Grade 2–5 cards are not shown as S01 stock.

## Token map

| Meaning | Token | Use |
|---|---|---|
| Grade 1 | `#FFFFFF` white | existing neutral/white proposal |
| Grade 2 | `#BCE2CF` green/mint | existing project mint |
| Grade 3 | `#376BCE` blue | existing project blue |
| Grade 4 | `#7651A8` purple | visual proposal |
| Grade 5 | `#C89C3C` gold | visual proposal |
| Synergy below first threshold | `#D7D2C9` muted | muted icon/edge; count stays visible |
| Synergy rank 0 / 1 / 2 | `#B8754A` bronze / `#9EA9B7` silver / `#C99B39` gold | achieved-stage edge/fill |
| Synergy rank 3 | `#376BCE` blue | achieved stage 4 |
| Synergy rank 4 | `#7651A8` purple | achieved stage 5; archetypes with five thresholds only |
| Active card selection | `#E8907A` coral | 3px outer ring plus visible `선택` label |
| Dead card | `#58675F` label on `#D7D2C9` overlay | separate hatch/skull and `사망`/HP text; preserve the grade edge |
| Primary progress action | `#B3261E` fill / `#5E0F0B` border / `#FFFFFF` text | red next-step/ready CTA; white-text contrast 6.54:1 |

Grade border communicates grade only; the separate star count communicates the unit’s star level, and the coin pill communicates price. Synergy uses a chip fill/edge, never a minion rarity border. Selection uses its own coral ring and label, not a replacement grade color. A dead-state overlay is also separate from grade and synergy.

## Existing icon atlas and thresholds

Concept SVGs reference the project atlas `demo/assets/ui/ui-icons.png` (64×64 cells, in the existing `GI` order from `demo/js/ui.js`). Used indices: coin 12, crown 13, fire 14, water 15, grass 16, lightning 17, land 18, atk 19, def 20, swift 21, HP/heart 22, gear 4, refresh 8, close 11, timer 33, std 35, sustain 36, guard 37. Element and archetype names remain visible beside icons on full cards.

Colors map one-to-one to achieved rank: -1 muted, 0 bronze, 1 silver, 2 gold, 3 blue, 4 purple. There is no shared `3+` color. Counts and thresholds remain written in text so color is never the only signal. Existing source thresholds and caps are:

- Kingdom: `V2_KINGDOM_STEPS = [2, 4, 6, 9]`, achieved ranks 0–3 (four stages).
- Archetypes: `V2_ARCH_STEPS = [2, 3, 4, 5, 6]`; `synSteps` uses the existing per-archetype cap. std/atk/sustain reach rank 4 at 6 units (fifth stage); def/swift/guard use the existing first four thresholds and cap at rank 3, even at 6 units.
- The six cards in screen E are a roster-card gallery, not the result for a selected synergy chip. Runtime contributors must be filtered to exactly the selected chip and their count must equal that chip’s displayed count. The gallery’s read-only values are fire 2, water 1, lightning 1, land 1, grass 1; std 1, atk 2, def 1, swift 1, sustain 0, guard 1. Only fire and atk reach rank 0 in that gallery. No threshold or effect was added.

## Layout and redundant state

| Screen element | Concept size at 390px | Constraint |
|---|---:|---|
| Flow sheet viewports | 390×844 each | six static views in `flow-overview.svg` |
| Shop row / purchase control | 302×60 / 67×44 | grade border + star count; price separate |
| Field card / sell control | 96×136 / 84×44 | name, portrait, grade + stars, two icons, HP |
| Bag card / replace and sell | 96×136 / 44×44 each | card keeps grade + stars; actions side by side |
| Deployment selected card | 154×204 | full grade border + star count, kingdom, archetype, HP, art, name |
| Replacement card / close / cancel | 106×130 / 44×44 / 334×44 | six grade + star cards, separate selection ring |
| Synergy chip / tray cell | 66×52 or 108×44 / 44×44 | labels/counts accompany icons |
| Board diagram | 196×364; cell 26×26, pitch 28×28 | exact 7:13 ratio; diagram scale only |

The runtime clock is 90 seconds for S01 and deployment. At 390px runtime width, the progress bar and primary action share one row; the static flow’s full-width action is illustrative, not runtime geometry. Its red fill, dark border, and white label use the primary-progress token above. The online opponent phase marker stays neutral until `ready=true`, then appears only at phase 3; the static player markers are layout examples, not opponent-phase disclosure. Runtime settings use `방 나가기`, never forfeiture. Visible action controls in these concepts are at least 44px high; the topbar gear glyph is 22×22 and needs a 44×44 runtime hit target. The board cells are reduced only to fit an overview; they are not product touch dimensions. A 44px square cell would make a 7×13 board 308×572 while preserving the ratio. Do not copy the 28px pitch into product UI.

Phase segments show `01 상점 / 02 배치 / 03 완료` and both player markers (`창`, `꾸`) on the relevant phase. Runtime accessible names should state the full player name and phase. Grade numerals, synergy counts/thresholds, `선택`, and `사망`/HP text provide non-color cues; runtime controls need matching accessible names. SVG art is static and does not implement those controls.

## Scope and reference

Portraits and atlas sprites are relative references to existing project assets; no new sprite dependency is added. Latest CJ comment #293 accepts the flow and requires readable card data, grade/tier color, one-line TopBar and bag actions before implementation. Static SVGs do not execute selection, eligibility, confirmation, completion, room-exit, or contributor filtering; Venus’s finalized implementation contract governs those runtime rules. Remaining palette choices and CJ product QA remain pending.

[TFT tier differentiation reference](https://teamfighttactics.leagueoflegends.com/en-ph/news/game-updates/tft-7-year-bash/) is used only for the principle of distinct tier colors; this proposal does not claim to reproduce TFT’s exact palette.
