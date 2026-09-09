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

PD committed the corrections as `5de47a9db4960ae7392e85ed3a811248743d090b`, then sent `CAPTURE_GO` in `msg_0f1f473ef41e` after accepting independent Saturn's report `msg_07b3163164df`. All captures below were made after that message. This report records Mars implementation verification; independent media QA remains with Saturn/PD.

- Exact capture SHA: `5de47a9db4960ae7392e85ed3a811248743d090b`.
- Captured and final working product blob: `61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92`.
- Captured/final product SHA-256: `f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33`.
- Manifest: [issue114-media/capture-manifest.json](artifacts/capture-manifest.json).
- Capture environment: Windows 10.0.19045, Node v24.16.0, Chrome 152.0.7977.82; viewport 1280×900, DPR 2, common clip x84/y43/1112×814 CSS pixels. Each PNG is 2224×1628. All 10 steps had zero internal vertical scrolling.
- README retains eight H2 sections and identifies v0.4.4 as the released version. Gallery heading, captions/alt text and the former paragraph-82 provenance distinguish these unreleased v0.4.5 screenshots. Final README SHA-256: `18911a9a496ab190853f3a1635fd518c08b40f119695f11a65ce080c0451f13d`.

| Command | Final result |
|---|---|
| `node tools/readme_media_capture.js capture --ref 5de47a9db4960ae7392e85ed3a811248743d090b --out docs/media --manifest docs/qa/issue114-media/capture-manifest.json` | Exit 0; ten images, no reported problems. Exact commit served from memory. |
| `node tools/readme_media_capture.js verify --manifest docs/qa/issue114-media/capture-manifest.json --out docs/qa/issue114-media --viewport 1100x900` | Exit 0; 10/10 images loaded, captions/links/anchor resolved, no page/table overflow, gallery 2×5 with 162px thumbnails. |
| `node tools/readme_media_capture.js verify --manifest docs/qa/issue114-media/capture-manifest.json --out docs/qa/issue114-media --viewport 390x844` | Exit 0; 10/10 images loaded, captions/links/anchor resolved, no page/table overflow, gallery 2×5 with 44px thumbnails. |
| `node demo/test/issue114_cdp.js --shots --out docs/qa/issue114-media` | Exit 0; nine checks, failed=false; real relay, two Chrome clients and actual mouse input, plus three UI screenshots. Both owners select/skip, nonowner sends zero, canonical gameplay states/RNG and public events agree; private healing details intentionally differ. Flee/relocation logs normalize existing viewer labels only. fleePush adds no battle, full-HP healing auto-ends once, resignation and stale callbacks covered. PD clarified this validation shorthand after Saturn media review; raw log identity is not claimed. |

Both README checks used the real read-only `gh api markdown` sanitizer followed by local Chrome rendering with approximate GitHub CSS. No `--no-gh`/`--no-render` fallback was used. External URL existence and external badge availability are outside these checks, and local CSS is not pixel-identical to github.com. Narrow-gallery thumbnails are intentionally small; clicking opens the original-size PNG. All ten tutorial images, both gallery widths and the three UI proof images were inspected locally. No product change followed capture.

UI proof uses deterministic battle fixtures in the actual current HTML and relay; it is not a natural-play match capture. The optional screenshot path dismisses the nonowner's legitimate private memo using its real close button, then records the waiting UI. The conditional-end fixture refreshes the cleared fixture log and toast layer before capture, removing stale text from the preceding healing scenario. The screenshot helper brings each tab to the foreground before capture. Default and `--read-only` runs do not write screenshots.

Tool iteration record: the initial valid screenshot run passed nine checks, but inspection showed a private memo overlay obscuring waiting proof and stale preceding-fixture logs in conditional-end proof. One subsequent run exited 1 on a test-only reference to a nonexistent `modalOpen` helper (replaced with the actual overlay class assertion), and another exited 1 on a background-tab screenshot timeout (resolved by `Page.bringToFront`). No product failure was concealed; final outputs replace those temporary evidence attempts. The enhanced layout tool's first experimental committed-page load also failed because redeclaring page constants left the tutorial hidden; the final loader uses a fresh about:blank document, and only the subsequent valid negative-control run supplies the 36/140 clipping result above.

Capture cleanup: owned Chrome PID 52924/profile `readme-media-profile-IqcuOe` removed and its memory HTTP server closed. Final README verification cleaned owned Chrome PIDs 88528/60868 and profiles `readme-media-profile-RyG251`/`readme-media-profile-hp95Nj`; earlier verification runs also reported owned cleanup. Browser retry PIDs 98184/89376 and 91768/114852 with their exact `issue114-SAq6au`/`issue114-hjMur6` profiles were cleaned. No unrelated process or directory was targeted.

Final dual-client run cleaned owned Chrome PID 77400, relay PID 96620 and exact profile `issue114-ObGKNF`.

## Tutorial PNG SHA-256

| Relative path | SHA-256 |
|---|---|
| `docs/media/tutorial-01.png` | `fcc234c1eac28f01b48b07203827e042048ebfe7f4903670faaa41a970b2f76f` |
| `docs/media/tutorial-02.png` | `5be4b02b432e0c80b7e5a62ef260890a5b348caf83ee8c4297946bfa7fe3f55e` |
| `docs/media/tutorial-03.png` | `5821f7c5ac466da619e5d089b1e7064bc480f22fa90c9c813324c8d15e09d315` |
| `docs/media/tutorial-04.png` | `81e7e244fa3cac88310cc433ee509542341101e28afaec9abd40a45298a51fce` |
| `docs/media/tutorial-05.png` | `95210446af4577076ab33791603f6c6c1ac4e62dbe5c132ce3675ffcf2f85fbd` |
| `docs/media/tutorial-06.png` | `550af4d74d8502e9db8eef269933ba01d2f05974450e268ddebbcb6956acae2d` |
| `docs/media/tutorial-07.png` | `ff19476d53d4c5d42b4082a6b4a89f29b392f656ac4002d9d4efa175c228ee21` |
| `docs/media/tutorial-08.png` | `b6d15875c4c6a5a55b4fb8eb997444d4c50f1f57e8dfc6339ffaa62e0cca86c3` |
| `docs/media/tutorial-09.png` | `28ac171c224b9fd0e8dc338d5d1a595cd81ee7d03eef6007ca7faebd7b8df65e` |
| `docs/media/tutorial-10.png` | `8f3913f2c7217e19a9c970e9d2b1675fa2da68560c55913d80701b2a153fe490` |

## Scope and handoff

No worker Git mutations, external GitHub/Notion writes, tag, release or new art. `tools/readme_media_capture.js` was reused without changes. Historical issue105/106 reports and their original assets were preserved; the shared docs/media/tutorial images were intentionally refreshed. Other concurrent documentation edits belong to Venus/PD and are excluded from this file list. Remaining work is PD's commit/publication sequence and independent Saturn media QA.

Final integrity check exited 0: all 10 PNG hashes equal the explicit manifest, both verification reports reference the final README hash and contain zero findings, the nine-check browser report references the unchanged product SHA-256, and all 47 relative files below exist. Final `git diff --check` exited 0 with ordinary LF/CRLF notices. The pre-completion orchestration inbox was checked; PD's request to replace the pending capture wording is satisfied by this completed report.

Exact relative files modified by this dispatch, including corrections already committed by PD (47):

```text
README.md
demo/index.html
demo/test/harness.js
demo/test/smoke_issue114.js
demo/test/tut_layout_cdp.js
demo/test/issue114_cdp.js
docs/qa/issue114-mars-followup.md
docs/qa/issue114-media/tut_layout_report.json
docs/qa/issue114-media/issue114_cdp_report.json
docs/media/tutorial-01.png
docs/media/tutorial-02.png
docs/media/tutorial-03.png
docs/media/tutorial-04.png
docs/media/tutorial-05.png
docs/media/tutorial-06.png
docs/media/tutorial-07.png
docs/media/tutorial-08.png
docs/media/tutorial-09.png
docs/media/tutorial-10.png
docs/qa/issue114-media/capture-manifest.json
docs/qa/issue114-media/conditional-end-option.png
docs/qa/issue114-media/flee-attacker-waiting.png
docs/qa/issue114-media/flee-defender-choice.png
docs/qa/issue114-media/gallery-open.png
docs/qa/issue114-media/gallery-open-w390.png
docs/qa/issue114-media/readme-gh-render.html
docs/qa/issue114-media/readme-gh-render-w390.html
docs/qa/issue114-media/verify-report.json
docs/qa/issue114-media/verify-report-w390.json
docs/qa/issue114-media/section-00.png
docs/qa/issue114-media/section-00-w390.png
docs/qa/issue114-media/section-01.png
docs/qa/issue114-media/section-01-w390.png
docs/qa/issue114-media/section-02.png
docs/qa/issue114-media/section-02-w390.png
docs/qa/issue114-media/section-03.png
docs/qa/issue114-media/section-03-w390.png
docs/qa/issue114-media/section-04.png
docs/qa/issue114-media/section-04-w390.png
docs/qa/issue114-media/section-05.png
docs/qa/issue114-media/section-05-w390.png
docs/qa/issue114-media/section-06.png
docs/qa/issue114-media/section-06-w390.png
docs/qa/issue114-media/section-07.png
docs/qa/issue114-media/section-07-w390.png
docs/qa/issue114-media/section-08.png
docs/qa/issue114-media/section-08-w390.png
```
