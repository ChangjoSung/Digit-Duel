# Issue 114 — Mars Codex takeover implementation report

[결정] 2026-09-08 · Mars / IMPLEMENT / CLIENT-HTML-TOOLING / Codex (CJ same-role provider override). Task `task_6aa634c2926e`, dispatch `ctx_e7c4f5e3f0b1`. This is implementation validation, not Saturn's independent QA verdict.

Preserved and finished the stopped Mars implementation on `feature/114-v045-turn-flow`, HEAD `c92ad57d049f3a34f1f9f0368ec227c0d604ffde`. No Git mutation, external write, release tag, README capture, or historical Issue 105/106 report modification was performed. Venus/PD document edits were left intact. Root art, the latency report, Downloads, and approved-art locations were not read or edited.

Final product identity (uncommitted working file):

- `demo/index.html` Git blob: `94b6d41afefe2681b336d89bfe95831171362d65` (`git hash-object`, without `-w`).
- SHA-256: `ff54b6db923b89b1888b975dbb05bed7452c6493c0d303a5cbfccf8da5da40d2`.
- This is a working-file identity, not a new commit SHA. PD owns the later commit and exact-SHA capture dispatch.

## Completed behavior and corrections

The preserved implementation enables unlimited teleport uses while retaining main-action cost, entry condition, cancel, battle-slot preflight, and independent forced queue. VIP/VIP contact ignores captured proxies and pushes both pieces without newly revealing them; bomb/bomb and bomb/trap contact similarly push without removal or new reveal. Full-HP healing can be selected as a wait action, ticks for zero at full HP, and cannot be selected again while already posed.

Pushes move both pieces one square along the contact axis in opposite directions. A blocked piece stays while the other can move. The king's actual enemy-edge arrival wins before any relocation. Remaining enemy adjacency, including hidden enemies, causes deterministic relocation; when no safe pair exists, the possible push result remains and that forced contact is consumed once, with no invented elimination or win. Trap voluntary walking remains forbidden; existing teleport/flee swaps and forced push/relocation remain allowed. Forced moves do not call `observeMove`, change voluntary-move flags, add traces, or create forced contacts.

Human flee success now offers board candidates and skip to the fleeing piece's owner, including a defender whose owner differs from `S.current`. Queue-duty pieces are excluded from rear candidates. The queue advances only after swap/push/relocation and rechecks adjacency. Hotseat temporarily uses the choosing owner's view with the established look-away notice; online nonowners see the waiting message and no candidate highlights. New selection tokens fence stale network actions, and game/selection identity guards fence stale board and skip-button callbacks. Existing FX generation guards protect the pending result/flee banners.

Fixed inherited gaps: conditional end is hidden during forced queue, teleport, modal, or FX and reappears at FX idle; turn operations cannot bypass active flee selection; direct end cannot abandon the selection; resignation remains authorized by `S.current` even when the defender owns the selection. The resign confirmation also checks its original game/turn. No-rear/skip and swapped-front paths each push the correct pair without adding a battle slot.

Kept rule-aware, publicly observed VIP AI scoring. Removed the inherited, unapproved teleport-repeat score multipliers/penalties; PD explicitly accepted this correction in `msg_5954aa003304`. Existing AI policy coefficients remain otherwise unchanged. Completion and hidden-identity substitution were measured rather than inventing a new repeat penalty.

Tutorial remains exactly **10 steps**. Updated win-by-push, cross-element skill replacement, VIP push/relocation, bomb/trap force movement, board flee choice, unlimited teleport and hint, burning-time trap wording, conditional end, and healing tick/release wording. Step 5 gains one VIP-push card (five cards there; three/four elsewhere). Card and paragraph counts remain paired, and all prose paragraphs remain at most 78 characters. No stale two-use teleport or manual regular-end instruction remains in the changed tutorial/hints.

## Exact metrics and deterministic ranking

| Item | Implemented policy |
|---|---|
| `battlesUsed`, `battles` | VIP direct push or bomb contact consumes the contact's one battle slot; flee already consumed its slot when battle started, so its follow-up adds **zero** slots and zero `battles`. |
| `pushes` | One event per adjacent `pushResolve` invocation, credited to its supplied owner. Includes flee follow-up. It counts a resolved push attempt, **not squares/pieces physically displaced**; a fully blocked pair still counts once. |
| `fleePushes` | One additional classified event when flee resolves an adjacent front/opponent pair, credited to the fleeing owner. Thus one flee push increases both `pushes` and `fleePushes`, never `battlesUsed`. |
| `relocations` | One successful pair relocation, credited to the contact actor, or the fleeing owner for flee follow-up. Failed safe-pair search does not increment it. |
| Candidate ranking | Zone (home territory, own forest, central plaza), Manhattan distance from the **post-push** position, row toward owner's home edge, column. |
| Pair ranking | **zoneSum → distanceSum → actor candidate index → defender candidate index**, lexicographically. This explicitly documents the inherited deterministic choice; it is not a per-player greedy selection. |
| Occupancy and randomness | Rules engine tests all occupied squares and enemy adjacency, including hidden pieces; both starting squares are virtually empty during pair selection. No RNG consumption; candidate lists, rejected squares and hidden coordinates are not put in product AI inputs, DOM, or logs. Result-position inference remains the approved residual limitation. |

## Verification commands and results

All commands below exited 0 on their final execution. Counts are each suite's assertions/groups, not a deduplicated total across suites. Repeated executions during fixes are not added to these counts.

| Command | Final result |
|---|---|
| `node demo/test/smoke_issue114.js` | **15 groups**, including four two-client owner × click/skip variants, partial/full blockage, no safe pair, king priority, full-HP heal, stale DOM/frame, queue and end guards, resign ownership, observation checks, six AI completions. |
| `node demo/test/smoke_turnflow.js` | **199 pass / 0 fail**. |
| `node demo/test/smoke_turnflow_timers.js` | **36 / 0**. |
| `node demo/test/smoke_tutorial.js` | **124 / 0**. |
| `node demo/test/smoke_cycle5.js` | **69 / 0**, including 450 hidden-identity substitutions per level, **900 samples / 0 decision differences**. |
| `node demo/test/smoke_online_sync.js` | **23 / 0**, default 12 seeds × up to 700 steps; natural distinct roster/setup and frame replay. |
| `node demo/test/smoke_online.js` | **157 / 0**. |
| `node demo/test/smoke_cross_skill.js` | **116 / 0**; same current-version seed replay plus original baseline/recruit contrast. |
| `node demo/test/smoke_minion_art.js` | **199 / 0**. |
| `node demo/test/smoke_memo.js` | **122 / 0**. |
| `node demo/test/smoke_attack_balance.js` | **50 / 0**. |
| `node demo/test/smoke_shock.js` | **65 / 0**, shock sample 469/1000. |
| `node demo/test/smoke_own_side.js` | **66 / 0**. |
| `node demo/test/smoke_testclient.js` | **41 / 0**. |
| `node demo/test/smoke_orientation_audit.js --path demo/index.html` | **8916 / 0** on final current-product run; 15182 audits, 764 skips, 7572 full/382 partial agreements, 3689 steps. Explicit `--path` avoids the historic default source. Earlier successful fuzz runs had slightly different coverage totals; they are not added. |
| `node demo/test/tut_layout_cdp.js --html demo/index.html --out docs/qa/issue114-media` | **140 measurements / 0 tutorial layout issues**, 10 steps × navigation paths × 5 desktop/narrow/zoom-equivalent viewport configurations. |
| `node demo/test/issue114_cdp.js` | **9 named browser checks / 0 failures**; real Chrome, real relay and mouse gameplay input. See report JSON and scope below. |
| `git diff --check` | Exit 0; only ordinary Git LF/CRLF notices, no whitespace errors. |
| `git rev-parse HEAD`, `git hash-object demo/index.html`, `Get-FileHash -Algorithm SHA256 demo/index.html` | Read-only provenance checks match the identities above. |

Six focused AI completions (seeded fixtures, no new repeat penalty):

| Levels P1/P2 | Seed | Turns | Result | Teleports |
|---|---:|---:|---|---:|
| grade5/grade5 | 114 | 75 | king | 1 |
| grade5/grade5 | 115 | 216 | wipe | 1 |
| dan5/grade5 | 114 | 89 | king | 0 |
| dan5/grade5 | 115 | 126 | wipe | 0 |
| grade5/dan5 | 114 | 293 | wipe | 2 |
| grade5/dan5 | 115 | 108 | king | 1 |

These six are scenarios inside one group, not six extra suite assertions. The existing cycle suite's eight simulations additionally observed 3 teleports, 54 flee attempts, 104 battles and no invariant failure. This sampling does not prove the absence of every possible AI repetition.

### Browser evidence and limits

`issue114_cdp.js` matches two actual Chrome tabs via the real repository relay and public setup APIs; it then installs identical disclosed position/HP/phase fixtures. Gameplay flee/category/candidate/skip, forced bomb contact, healing and resignation use actual CDP mouse events. This is real transport/UI verification with controlled scenarios, not a claim of natural play from setup to those rare positions.

- Defender and attacker × click and skip: actual successful flee action, 2000ms flee-selection/push effects, clicks blocked during FX, owner-only candidate highlights and input, waiting UI on the other tab. Each scenario sends **2 owner frames**, receives **2 on the other tab**, and has **0 nonowner frames** and **0 queued frames remaining**. RNG next values and canonical rules state agree.
- Bomb/trap forced-contact click produces relocation and the same canonical result on both tabs.
- Full-HP healing emits one action and exactly one owner auto-end; the other tab emits zero. Rules state agrees. Healing's private identity/tick details intentionally differ: the test separately validates one common heal event and ordered remaining public logs after excluding private pose-tick detail.
- Flee and relocation ordered logs are compared, normalizing only existing `pname` viewer labels (`나(P1)` / `상대(P1)` → `P1`). Raw log byte equality is **not** claimed.
- Current-player resignation during defender selection works in both clients. A separate local browser fixture invokes an old flee DOM callback after a new game and waits past the old 2s banner; new state remains unchanged.
- No product console error was observed in the four owner variants. Each run prints owned Chrome/server PIDs, stops only those children, verifies the temporary profile is a direct `issue114-*` child of the system temp directory, and removes that exact profile. Failed fixture iterations were also cleaned up.
- Other unrelated FX are shortened in these controlled browser scenarios; the existing timer regressions retain their own declared-duration checks. This does not certify all effects at production timing, remote LAN, physical mobile, non-Chrome browsers, or natural full-match browser completion.
- Tutorial layout evidence reports zero card/text overlap or clipping. At 360px the **underlying game page** still has the previously reported fixed-width horizontal overflow (about 722px); tutorial overlay content fits and scrolls vertically. The layout tool classifies that existing page overflow separately, so its zero tutorial-issue count does not mean the entire app is responsive at 360px.
- No screenshot, README PNG, manifest capture, or release tag was generated. The two JSON outputs are runtime/layout reports only.

### Legitimate regression changes and initial failures

The first inherited-code run failed stale full-HP, old contact-text, auto-skip fixture, immediate post-flee queue, teleport-count, and tutorial-size expectations. Product guards were fixed, and regressions now assert the new contract: full HP is healable; all-actions-unavailable uses already-healing immobile pieces; queue waits through board choice and push; reentrant FX duration/order checks remain; step 5 alone allows its additional card while keeping 78-character prose bounds.

The art suite formerly entered a now-illegal VIP/VIP proxy battle. It now exercises actual attacker and defender proxy paths separately against minions, preserving image/identity/reserve assertions. Its isolated art-vs-combat calculation test explicitly uses a low-level two-fighter fixture to retain the original art-metadata invariance check; that fixture is not claimed as a legal VIP contact. The helper now assigns choices to the actual VIP side. No art file was changed.

The old cross-skill comparison could no longer require pre-event AI logs to match a pre-v0.4.4 build because new public VIP scoring changes decisions before contact. It retains original baseline loading and the recruit positive/negative contrast, and for v0.4.5 adds full same-version seeded replay equality (winner/turn/logs/metrics). No blanket skip was introduced. The memo static guard expectation now recognizes current-player resignation versus selection-owner actions, with behavioral ownership coverage in the new suite.

Initial browser iterations exposed test-fixture issues (wrong category selector; bomb optional click instead of forced-contact selection) and intentional preexisting mirrored/private log differences. Fixed those fixtures and narrowed only the known private healing log comparison; full flee/relocation state and ordered-message comparisons remain. Initial Python stdin and Node shell-quoting edit attempts failed before writing; subsequent edits used `apply_patch`, and UTF-8 remained intact.

## Exact Mars-owned relative files

- `demo/index.html`
- `demo/test/harness.js`
- `demo/test/smoke_turnflow.js`
- `demo/test/smoke_tutorial.js`
- `demo/test/smoke_cross_skill.js`
- `demo/test/smoke_memo.js`
- `demo/test/smoke_minion_art.js`
- `demo/test/smoke_issue114.js`
- `demo/test/issue114_cdp.js`
- `docs/qa/issue114-mars.md`
- `docs/qa/issue114-media/issue114_cdp_report.json`
- `docs/qa/issue114-media/tut_layout_report.json`

## Documentation alignment / remaining owner

| Subject | Alignment location / owner |
|---|---|
| Approved implementation scope | `docs/v0.4.5-analysis.md` §§2–4; CJ implementation approval already given. |
| Rules, flee ownership, turn UI | `docs/v0.4.5-gameplay-spec.md` §§2–5; Venus/PD own the spec. Metrics/ranking precision above is the final Mars implementation policy. |
| Tutorial content | `demo/index.html` `TUT_SCENES`, `TUT_STEPS`, `TUT_HINTS`; spec §6. |
| Test evidence | This report and `docs/qa/issue114-media` JSON files. |
| Next steps | PD receives stable files; independent Saturn product QA remains. PD commits the validated product, then dispatches exact-SHA tutorial10 capture with explicit manifest/output paths. README/media publication and CJ play QA remain later gates. |

No additional approval is needed to review this implementation; remaining independent QA and exact-SHA capture belong to the coordinator's stated sequence.
