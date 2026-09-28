# #238 Earth_1 visual handoff

2026-09-28 · Earth_1 / IMPLEMENT / ART / assets / instance_index=1. Original raster art generated with native imagegen; runtime installation, crops and resized exports belong to Mars. No runtime files changed. Latest CJ instruction preserves B04 battle composition and replaces the old goods-only art restriction.

## Accepted files

| File | Actual size | Use |
|---|---|---|
| `lobby-pedestal-bg-v1.png` | 1024×1536 | Original text-free navy/royal-blue textured room and turquoise/gold pedestal. Lobby/title hero ground. |
| `ui-icons-24-alpha-v1.png` | 1536×1024 RGBA | Atlas A: 24 navigation, action and synergy symbols. |
| `ui-goods-lobby-24-alpha-v2.png` | 1536×1024 RGBA | Atlas B: 24 complementary lobby, archetype and eight goods symbols. |
| `lobby-shop-board-proof-v2.png` | 1391×1131 | Three representative compositions for a 432px logical viewport: lobby, shop, main board. Proof only; never install as runtime UI. |

`lobby-shop-board-proof-v1.png` and `ui-goods-lobby-24-alpha-v1.png` are superseded review iterations. Do not install them. The proof generator returned 1391px rather than the requested 1296px sheet; Mars should crop source panels x=0..464, 465..926, 927..1390 (full height) and export each at 432px width. Do not call these source panels already 432px images. Native labels, balances, names and unit placement override illustrative proof content.

## Reference trace

Directly viewed the four CJ/reference images, existing 20-minion contact sheet (`docs/milestone/v0.4.3/assets/minions/review/icons-contact-sheet.png`), existing water-def portrait, #253 contact sheet, and #238 Mars shop/main-board/battle captures. Source region coordinates below follow [Venus's measured matrix](../Venus/visual-alignment.md), which remains authoritative for behavior.

| Reference | Region used |
|---|---|
| `C:/Users/pc_77/orca/qa/Digit-Duel/reference-game-lobby.png` | Overall top status density, hero prominence, large action and bottom tabs only. No copied character, logo, chest or UI graphic. |
| `C:/Users/pc_77/orca/qa/Digit-Duel/cj-system-flow.jpg` | SYS: title (0,80)-(1045,690); login (150,850)-(590,1320); signup (100,1565)-(540,2170); lobby (1000,80)-(1800,1100); room search (1950,100)-(2365,855); waiting (2680,100)-(3105,855). |
| `C:/Users/pc_77/orca/qa/Digit-Duel/cj-battle-flow.jpg` | BAT: start-board (365,127)-(795,765); shop (1080,80)-(1990,1250); placement (2145,95)-(2545,765); main board (2780,80)-(3174,1400); result (2010,1335)-(2370,1980); battle (2780,1305)-(3165,1930). |
| `C:/Users/pc_77/orca/qa/Digit-Duel/cj-shop-sketch.png` | Horizontal offer rows, six owned slots, three bag slots; the five drawn offer rows expand to the existing six-offer rule. |

## Screen contract — top to bottom

Use navy #09172C, royal blue #17447A, turquoise #43DCF0, gold #F7C44F, cream #FFF3D4 as overlay starting colors; check actual text contrast in runtime. Main actions are gold, secondary actions royal blue, selected slots turquoise. Keep all labels as native text, all inputs real controls, all icons named for accessibility. Controls are at least 44px; decorative art has no accessible name. Apply skins per screen so B04 does not change through shared styles.

| Screen / CJ region | Before → intended composition | Art / exact handling |
|---|---|---|
| Title / SYS title | Generic entry surface → centered native Digit Duel wordmark in upper third, small existing board illustration, one large login action and locked Google secondary. | Backdrop, existing minion and existing board graphic; native type, not a generated logo. No external logo copied into atlas. |
| Login / SYS login | Three-tab form → one framed modal on title, close at upper right; ID then password; gold login; two short links to signup and recovery. | Existing #253 panel corners, navy input fills, gold focus outline; close=A12. Preserve inline validation and alert text. |
| Signup / SYS signup | Dense competing modes → same modal and single vertical form: ID, password, confirmation, nickname, required email, submit. | 48px fields, short hints; scroll modal at 320px. Email stays despite older sketch omission. No new duplicate-check API. |
| Recovery / SYS lower-left flow | Preserve existing ID → code → new password stages in the same modal frame. | Short heading and one main action; errors remain visible. Never bake field labels into raster. |
| Loading / SYS adjacent title | Long stages exposed → same wordmark/board, native progress bar and existing minion as runner, real percent when known. | Loading detail under help; visible retry on error. No invented percentage or new character asset required. |
| Lobby / SYS lobby + REF | Text-heavy cards/locked grid → compact profile/record/help/settings line; two currency chips; exactly two shallow locked mission/daily tiles; dominant existing minion on pedestal; official-record book left and locked event star right; multiplayer and locked solo; four bottom tabs. | Hero width 55–65%; backdrop pedestal top around 48% of source height. Tabs are shop, team, HOME selected, rank; three locked. Settings remains locked; logout remains reachable with accessible label. Official-record icon opens existing official records, not a new history drawer. |
| Room search / SYS upper-right | Long creation/form blocks → compact profile/header/back, room-name search and create/join/refresh row, compact list with occupancy/name/ping. | Search=A08, refresh=A09, back=A11, party=A04; native 4-bar ping. Existing create form opens as modal. Busy room visibly unavailable; no new chat input. |
| Waiting / SYS far-right | Generic waiting text → opponent portrait/profile above, large native VS, own portrait/profile below; host crown; short waiting state and exit. | Existing minion portraits, A14 crown, A06 exit. Do not invent rank, ready handshake or chat; second-player automatic start stays. |
| Shop S01/M01 / BAT shop + SHOP | Prior 2×3 cards and eleven long chips → SIX full-width rows, then own FIELD six in one row, BAG three, SYNERGY eleven compact icons, GOODS eight. | Offer row: grade, actual minion thumb, short name, two type symbols, coin buy action at right. Purchased row receives native SOLD OUT state. Field and bag order stays exactly as sketch. Synergy detail opens on tap; description prose collapsed. Goods purchase-only in S01; existing M01 rules unchanged. |
| Placement / BAT placement | Keep board and separate minion/other-piece trays; concise timer/coin and done header. | Six minion slots separate from king/companions/bombs/traps. No invented board rule. |
| Main board S03 / BAT board | Prior text header/status blocks → compact identity/timer/turn/coin, board as dominant region, small synergy/emote access, six bottom controls. | Seven columns and thirteen rows remain authoritative runtime board. Reuse existing forest and token assets. Enemy unknowns remain unknown. Controls: scout A08, warp B09, heal A23, shop A03 + countdown, bag A03 or existing bag resource + count, resign B11. No history toggle. |
| Battle B04 / BAT battle | PRESERVE prior Mars layout: diagonal combatants, HP cards, four actions 2×2. | No new background, button atlas or shared reskin applied here. Remove only history toggle; Earth_2 minion mapping may update art. |
| Result S04 / BAT result | Long explanation/history → winner profile + concise outcome + own roster/synergy, native VS, loser roster/synergy, lobby action. | Existing actual portraits and new compact symbols; values come only from final.sides. Hide forbidden opponent rank/unused skills. No history replacement. |
| Reconnect X01/X03 | Preserve current blocking behavior, overlay order, timing and privacy; concise lock/connection state. | Opaque existing #253 panel over blocked gameplay; B08 lock and A09 retry motif only when existing action allows. No new abandon action or fabricated countdown. |

### Concrete mobile geometry

- At 432px: 12–16px outer gutter; 44–48px utility controls; 56–64px primary actions; 16px normal labels; 12–14px secondary numbers. Lobby profile 56px, currencies 40px, mission tiles 64px, hero region about 280–340px. The proof's extra tall hero/mission spacing may compress before controls shrink.
- Shop inner width 408px at 432: six owned slots use 6×60px + 5×8px = 400px. At 320: inner width 296px, use 6×44px + 5×6px = 294px. Bag is always three slots. Offer rows stay 56–64px tall and single-column; long names ellipsize with full accessible name.
- Synergy order is five kingdoms then six archetypes. Use five badges followed by six at both widths, each 44px target; goods are four by two, eight total. Native detail reveals name/count/threshold; no eleven long sentence chips.
- Main-board square size follows available width; at 320px seven 44px cells exceed a 296px interior. Preserve the board and use a 44px accessible confirm/selection control for the selected small square rather than overlapping hit boxes. This is the only inherent small-target geometry limitation; do not claim every board square is 44px at 320. Six footer actions fit 6×44px + 5×6px = 294px.
- Vertical scrolling is allowed for shop/auth/results; keep action access clear and avoid fixed-footer overlap. No horizontal scrolling. B04 preserves its existing tested geometry.

## Atlas geometry and pixel validation

Coordinates are source PNG pixels; rectangles are `(x,y,width,height)`, half-open. Atlas A has six 256px-wide columns and row bands `[0,280)`, `[280,512)`, `[512,736)`, `[736,1024)`. Atlas B has regular 256px cells. **A is not a uniform 256×256 crop grid.** Crop the tight bounds below, then center the silhouette in a transparent square before a 32/48px export; Mars owns these transforms. Keep a 44px native hit area regardless of icon artwork size. No letters, outside logos or checkerboard artwork occurs in either atlas.

Read-only System.Drawing inspection scanned every source pixel. A: 1,156,436 pixels at alpha 0; B: 1,135,098 at alpha 0. All column/row seams and outer edges have **zero nontransparent pixels**. Interior alpha peaks predominantly at 253 (A: 222,030 pixels; B: 212,380), with antialiased edges and faint extraction fringe; neither sheet has pixels at 255. This is real usable transparency, not an opaque tile sheet. Native preview showed hidden RGB behind alpha 0; the initial opaque-backdrop inference was false and is superseded by pixel evidence. Preserve alpha during export; judge icons over actual navy UI at 32/48px, not from a viewer ignoring alpha.

| A | Name / role | Tight rectangle |
|---|---|---|
| 01 | home | 63,94,180,164 |
| 02 | duel / crossed swords | 319,99,163,159 |
| 03 | shop satchel | 555,104,176,154 |
| 04 | party / multiplayer | 798,112,194,144 |
| 05 | settings | 1051,95,167,164 |
| 06 | logout | 1309,91,171,169 |
| 07 | menu | 73,331,156,135 |
| 08 | search / scout | 323,318,163,158 |
| 09 | refresh | 559,305,162,191 |
| 10 | confirm | 815,323,166,142 |
| 11 | back | 1054,336,162,129 |
| 12 | close | 1311,326,150,152 |
| 13 | coin | 65,543,187,159 |
| 14 | crown / host | 318,540,170,151 |
| 15 | fire kingdom | 567,540,153,164 |
| 16 | water kingdom | 832,543,117,166 |
| 17 | grass kingdom | 1057,542,221,163 |
| 18 | lightning kingdom | 1328,543,126,177 |
| 19 | land kingdom | 62,768,183,162 |
| 20 | attack archetype | 316,751,166,177 |
| 21 | defense archetype | 566,753,154,199 |
| 22 | swift archetype | 803,753,174,176 |
| 23 | heal action | 1033,773,186,195 |
| 24 | synergy summary | 1291,751,195,163 |

| B | Name / role | Tight rectangle |
|---|---|---|
| 01 | trophy / rank | 47,79,203,158 |
| 02 | secondary currency | 318,85,150,131 |
| 03 | mission | 521,63,200,175 |
| 04 | daily reward | 816,79,162,148 |
| 05 | event / grade star | 1073,76,159,153 |
| 06 | official records | 1327,32,159,208 |
| 07 | profile | 60,306,148,175 |
| 08 | locked | 323,307,136,169 |
| 09 | teleport | 551,257,172,223 |
| 10 | timer | 815,295,177,173 |
| 11 | resign | 1071,303,166,175 |
| 12 | standard archetype | 1287,305,203,173 |
| 13 | sustain archetype | 61,543,149,176 |
| 14 | protect archetype | 301,558,179,147 |
| 15 | goods potion | 572,543,150,169 |
| 16 | goods cool | 813,543,163,177 |
| 17 | goods cure | 1071,525,163,193 |
| 18 | goods ball | 1327,550,153,156 |
| 19 | goods ticket | 43,798,195,146 |
| 20 | goods power | 317,775,148,169 |
| 21 | goods time | 561,769,163,176 |
| 22 | goods escape | 793,771,183,186 |
| 23 | help lantern | 1051,771,227,197 |
| 24 | ready / complete seal | 1325,778,163,169 |

Synergy mapping: fire=A15, water=A16, lightning=A18, land=A19, grass=A17; standard=B12, attack=A20, defense=A21, swift=A22, sustain=B13, protect=B14. Goods map B15–B22 to the existing IDs `potion,cool,cure,ball,ticket,power,time,escape` without changing prices or behavior. Help lantern is optional decorative art; retain the recognizable native `?` for the actual help control. Reuse existing #253 panels and native borders for inputs/buttons/slot frames, native text for VS/Win/Lose/SOLD OUT, native bars for ping/progress; no new raster panel is necessary.

## Prompt record and boundaries

Generation accounting: nine native calls total — background one; atlas A three (second selected; the third was an unnecessary fresh attempt caused by the alpha-ignoring preview inference); atlas B two (second selected for separation); proof three (third selected after CJ/Venus reconciliation). All calls returned actual images. No API/CLI fallback and no genuine opaque-atlas capability failure occurred. Read-only inspection, not another generation, resolved the transparency question.

Native background prompt: original text-free 1024×1536 navy/royalblue enchanted pixel room, turquoise/gold low central pedestal, quiet top/bottom for overlays, no characters/logo/UI controls. Final background accepted for lobby/title; not applied behind the battle composition.

Native atlas A prompt: 1536×1024, 6×4, exactly the A01–A24 motifs above, crisp navy-outlined gold/turquoise fantasy pixel icons, true alpha, no text/logo/grid/checkerboard. Correction reduced each icon and requested transparent gutters. Native atlas B prompt used B01–B24, then reduced artwork to 65% and requested removal of stray alpha between cells. Delivered rectangles are measured output, not assumed prompt geometry.

Native proof prompt: three 432-logical-width compositions, original background plus exact existing water-def portrait and 20-minion sheet as references; large lobby hero, six single-column shop offers followed by 6/3/11/8 sections, seven-by-thirteen main board. Revisions concealed opponents, removed invented levels/lives/purchase buttons, locked unavailable features, changed missions to two, corrected synergy/goods motifs and changed board footer to six actions. Proof English names/numbers are illustrative; Mars uses existing Korean functional labels and real state. Gold capture orb reads coin-like in the small proof; use B18 and accessible name in actual UI.

No new battle mockup, no Earth_2 minion outputs, no gameplay code, no scripts/tests, no Git commands, no server/account/DB/SMTP changes. Runtime integration and actual 432/320 browser checks remain Mars/Saturn work, not evidence claimed by this art handoff.
