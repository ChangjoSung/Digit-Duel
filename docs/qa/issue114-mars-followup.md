# Issue 114 — Mars bounded correction and exact-SHA capture follow-up

[피드백] Mars / Codex, task `task_098edd0768cb`, dispatch `ctx_9351b9848b46`, 2026-09-08. CJ authorized the same-role Codex takeover. This report supplements the earlier implementation report; it does not replace independent Saturn QA.

## Saturn correction: AI push values

Saturn's `msg_e87654d79b8d` identified newly introduced `-500` and `+2` push weights. Both have been removed rather than moved into BAL. A publicly identified enemy king whose projected push reaches its goal now returns `-aiUnitValue(def, att.owner)`, reusing the existing king valuation (`aiUnitValue` already returns 200 for kings). A push without removal returns `0`, the existing neutral expectation used in `aiBattleEV` for bomb/bomb or bomb/trap contact. There are no new coefficients.

`aiBattlePairScore` now returns that push expectation directly: combat HP, aggression/caution scaling and the edge-attack bonus do not turn a neutral no-battle push into a rewarded battle. `aiBattleEV` uses the same helper. The public `revealed` gate remains; hidden identities are not supplied to this helper.

Added a regression that exercises both owners and both AI evaluation paths, at high turn count and with a captured proxy/full HP, verifies the neutral score remains exactly zero, verifies edge risk equals the existing king-loss value, and verifies both optional-battle selectors decline those neutral/loss-only contacts. The harness exports the preexisting `aiUnitValue` solely for this check.

Stable corrected working product:

- Git blob (AI and SVG corrections): `61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92`.
- SHA-256: `f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33`.
- Starting PD commit: `e393fe67dffd5b934dda600b9310914857f7a202`; no worker Git writes.

Validation (final correction run, counts are not added to earlier repeated runs):

| Command | Result |
|---|---|
| `node demo/test/smoke_issue114.js` | 16 groups passed, including six AI completions and the new both-owner/evaluator check. |
| `node demo/test/smoke_cycle5.js` | 69/0; 450 identity-substitution samples per level, zero differences. Eight simulations used 4 teleports, 54 flee attempts, 115 battles. |
| `node demo/test/smoke_cross_skill.js` | 116/0. |
| `node demo/test/smoke_orientation_audit.js --path demo/index.html` | Final combined product: 8914/0; explicit current file, 15050 audits, 746 skips, 7506 full/373 partial agreements, 3687 steps. Fuzz counts describe this run only. |
| `node demo/test/smoke_tutorial.js` | 124/0 after the SVG correction. |
| `git diff --check` | Exit 0, ordinary LF/CRLF notices only. |

The six focused AI scenarios retain the earlier turn/result/teleport totals. This is sampled completion evidence, not proof against all possible repetition. Independent Saturn's decision belongs to PD's QA sequence.

## Saturn correction: SVG ink bounds

PD relayed Saturn's `msg_1e2739764732` in `msg_11564f279dbf`: the explosion glyphs in step 3/card 3 and step 6/card 2, and swords in step 8/card 3, extended above their SVG viewBoxes. The previous 140-measurement layout check covered DOM boxes, not individual SVG ink bounds.

Added text `getBBox()` checks transformed into each root SVG viewBox, plus glyph-to-glyph overlap checks. `--ref` reads the exact committed HTML into a fresh browser document and `--read-only` disables all evidence writes. The negative control `node demo/test/tut_layout_cdp.js --ref e393fe67dffd5b934dda600b9310914857f7a202 --read-only` exited 1: 36 of 140 measurements contained clipping, including explosion y-minimum -4.127 at 1920×1080 and sword y-minimum -0.401 at 360×640. No baseline images or report were written.

Each affected scene is translated down within a taller viewBox (6 units for explosions, 2 for swords), preserving relative icon and arrow positions. The final `node demo/test/tut_layout_cdp.js --html demo/index.html --out docs/qa/issue114-media` exited 0 with 140 measurements and no clipping/overlap findings across 1280×720, 1440×900, 1920×1080, 640×360/DPR2 and 360×640/DPR2. Its report includes individual glyph bounds. Owned Chrome PID/profile cleanup completed on both runs. Tutorial DOM scrolling remains intentional on smaller screens; the underlying game's existing fixed width is reported separately.

## Capture gate and evidence

Pending explicit PD `CAPTURE_GO` with a verified commit SHA. No tutorial or PR proof image has been captured in this follow-up yet. The browser tool has an optional `--shots` switch prepared to collect defender choice, nonowner waiting and conditional-end UI evidence after authorization; default and `--read-only` operation do not write screenshots.

README keeps its existing eight major sections and current release distinction. Final capture SHA/blob, 10 PNG hashes, manifest path, 1100/390 verification results, UI proof files and exact modified-file list will be recorded here after the gate.
