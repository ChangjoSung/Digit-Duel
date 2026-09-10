# Issue #106 — Saturn_2 최종 독립 QA

> 2026-09-08. PD가 Orca 메시지 `msg_cc5c45f99561`의 전체 inline 보고를 보존했다. Saturn은 파일을 수정하지 않았다.

PASS — Saturn_2 independent final #106 turn-flow QA, 2026-09-08.
Task task_ac25f36f826b / dispatch ctx_db164ebf2352. filesModified=[].
Final product SHA256 a4932cb80a1407fc728ace6ee918315880840c76010de7b21361a7f618e97280; blob f580e4f9aa4b5ce3daceef940891a875586a1e34; 282568 bytes. No unresolved failure observed in the scoped #106 contracts after repair. Two existing 390px board-layout observations remain explicitly excluded by PD; this is not a blanket mobile-UI PASS. v0.4.4 remains unreleased and CJ play QA remains separate.

I read full CLAUDE.md, the full turn-flow spec including sections 3/7, Mars implementation and final shield reports, the final supplemental browser report, repaired orientation QA report, product diff and new/modified tests. I did not modify product, tools, tests, reports, screenshots, temporary HTML/JS/JSON, Git/GitHub/Notion, or call subworkers. No access to root art/ or orca-hook-latency-report.md. The separately approved docs/art/minions-v0.4.3/delivery-manifest.csv was inspected: all 28 rows resolve exclusively to approved demo/assets/minions.

Candidate provenance and independently found defects:
- Initial frozen a20be021eb0048fb53a40639e749eb0e5eccfdf18ebde3506a2af1d0d925d073 was REVISE despite author/new-suite green results. My own retained old playMsgs timer erased the new game's queue and unlocked it; my own style setter probe saw HP before shield; my own actual __flee + forcedQueue fixture saw result onEnd start then immediately discard the same-generation additional-contact banner. Reported promptly in msg_d847280b3dba and msg_db013b1c24df. I also identified F4/B11a tautological assertions and did not treat them as proof.
- d01845cd8e1595b514bd14fe8e5b96a551cb233b35c220f0b1f2d07c110effe5 fixed the two callback defects. My independent genuine-2000ms old/new-message reproduction retained the new queue/lock at ~2119ms; my forced-queue flee reproduction retained the new 2000ms contact banner and lock. Merely reordering synchronous shield/HP setters was insufficient visual timing proof, so I kept that issue open.
- Final a493 adds real barStep=600 staging, effective CSS .6s, and generation/battle/DOM/per-side-sequence guards. It preserves pending fxIdle callbacks in order, drops obsolete-generation continuations, and preserves a new current FX created inside onEnd. Final G26/G27/K regressions pass, and actual Chrome independently proves temporal shield-first rendering below. I made no patches.

Independent executions on FINAL a493 (all exit 0):
1. node demo/test/smoke_turnflow.js — 198 pass / 0 fail.
2. node demo/test/smoke_turnflow_timers.js — 36 / 0. Real Node setTimeout with reduced test durations (mostly 70ms; staged-bar tests 30ms), NOT default-2000ms browser proof.
3. node demo/test/smoke_cross_skill.js — 116 / 0; node demo/test/smoke_cycle5.js — 69 / 0; node demo/test/smoke_minion_art.js — 199 / 0.
4. node demo/test/smoke_orientation_audit.js --path demo/index.html — 8910 / 0. Repaired tool abe1516f, current106 explicitly selected, not its default frozen104. AUDIT done14170/skipped736/agreeFull7066/agreePartial368/steps3683; fuzz battles50/forced48/pushes1/tele0/flee5/captures3/searches0/BT6 of6. Zero-count fuzz features are not claimed covered by that segment; targeted rule tests cover them. Did not count the known false-green old orientation tool, and did not mislabel the separate frozen6baa orientation Chrome tool as current106.
5. node demo/test/issue106_cdp.js --read-only — 50 / 0, actual Chrome/real loopback relay/DOM clicks.
6. node demo/test/issue106_browser_audit.js --read-only — ALL hotseat,pve,online sections, 65 pass / 0 fail / 2 excluded WARN / 67 assertions in 265623ms. Frozen tool 756a2236, source read once into memory at startup. No timing overrides. Our count exceeds author's64 because our AI-first PVE path also executed P1b.

Earlier independent regression evidence on a20 (not mislabeled as final reruns):
- Commands node demo/test/<suite>.js: smoke_cycle5 69, smoke_memo 122, smoke_tutorial 124, smoke_testclient 41, smoke_attack_balance 50, smoke_shock 65, smoke_own_side 66, smoke_cross_skill 116, smoke_online_sync 23 = 676 pass / 0 fail.
- smoke_online.js safe in-memory equivalent: 157 / 0. I did NOT execute its native disk-mutant path. A stdin Node wrapper compiled unchanged test code and virtualized only its exact digitduel_stale_mutant_<pid>.html using a Map; other mutation APIs threw. One virtual put, one virtual delete, residual0, realwrites0. Three stale-socket negative scenarios detected the unsafe mutant. This is independently observed, not author-only.
- With approved-asset 199 above, the eleven-suite legacy arithmetic is 1032, NOT the stale author's1199. This total spans the disclosed candidates; only cycle/cross/art were rerun on final after the presentation-only repair, as PD requested.
- node demo/test/ai_compare.js 8 500 (no output argument) — 24 natural headless AI-vs-AI sim games, seeds500–507 across dan/grade, grade/grade, dan/dan, all completed, invariant violations0, draws0; mean turns120.3/120.4/190.8. This is simulation, not browser human play.
- Fair observation: cycle5 checks 450 grade5 +450 dan5 hidden-state substitutions, 0 decision differences, 0 differences due to teleport blocking. Independently repeated on final a493. Healing-specific observation/masking tests also pass.
- Initial rules171/timers28/primaryChrome50/orientation8922 were actually run, but are historical a20 evidence; the final counts above supersede their changed areas. Legacy expectation changes were inspected: HP-ratio judgment supersedes damage-counter victory, and cross-skill comparison requires identical prefix only until an intentional #106 event (healing/trap/bomb/judgment). The harness autoEnd=false default is not used as blanket auto-end proof: E/I/timer/Chrome tests explicitly enable it.

Meaningful independent negative controls, all in memory, all expected exit1:
- On a20, removing fxIdle pending-callback retention => 166 pass/5 fail (G21–G23); removing generation change check inside idle callback =>169/2 (G24); removing onEnd generation guard =>170/1 (G25); doubling heal tick5%->10% =>164/7. These test observable effects, not just presence of guard text.
- On final a493, disabling stage delay =>192/6, including K1 immediate-HP violation and stale-update cases. Removing per-side latest-update guard =>197/1 (K4b reverts newer HP). Mutant hashes: noStaging 453b4eddaa61d14825fdd9d286c52a8910babebbe4db63696f05aa448cb2e811; noLatestGuard 37c3270d60fd22176a13436e100448bdcff1203969fc3272a40af37497532567. Wrapper hashes d074f0a5c1c6d603064c857c3ad292294e21724809d1f817a201c909be7ff5d6 and16423fb70709af38851c24664b3959ef15c7bb8033eed5a5de2b87775b0fea46.
- Initial mutant hashes respectively 1fac09b0f6fae39c5f5ca38b64bec864e392677cb1cd944d63c724036d44dc0d / 47d12d241813a252dd657dde87ec2ddd2a4fa90c7740392eeafdca962cfcc32c / ba2ef090477996968239d9127c07d3c7935a81c9f781f7306d6d13491b1faed0 / 1823cde1c36f803d17c79076e4157273451df12bb3f1d1258a01fb0b9b4bef5d.
- Setup attempts rejected for command-length/API/provenance mismatch were not counted as tests; no saved mutants were created.

Acceptance coverage and actual timing:
- Healing rule A/A-prime: board minion/ally/king eligibility below maxHP, main-action cost, no separate instant tick, each individual endTurn heals all active friendly/enemy healers by round(maxHP*.05), designation turn included, duplicate guard, multiple/full postures persist. Same-piece move/search/teleport/attack/defend/bomb/trap/push clears; other-piece action does not. Hidden opponent healing is masked from chips/effects, HP/log identity and AI observation. Actual final primaryChrome: damaged revealed minion51/95, designation leaves51, own endTurn56, opponent endTurn61, both clients equal.
- Bomb/trap rule matrix: new adjacency move/teleport/forest collision; minion both removed, VIP bomb only, bomb/trap ineffective; no manual old-adjacency trigger or ineffective-contact reselect; forced queue and teleport budget checks. Trap and victim reveal, immobile2; actual primaryChrome reveals only IDs69/71. Bomb contact metrics0->1, retained explosion ghosts2->0 with visibility tests. #104 actor-view contract preserved by targeted sync23 and repaired current106 orientation.
- Actual primaryChrome natural path: two distinct six-minion rosters, 14 manually clicked pieces per client, real hello/matching/canonical positions, natural walking into battle. Five battle actions, mirrored results; actor-only autoend P1=32/P2=33 total65 with receiver self-send0. Default turn2041ms; contact/count gaps2004/2015/1000/1010/1009/1612ms, total entry10917ms (last gap includes opening message). Skill-to-damage polling1967ms is an approximate sample, not exact-minimum2s evidence. Primary burn segment is FAST600ms and approach/other traversal segments use reduced timings; no claim they prove default2s. PVE AI acted2690ms after banner onset (2000+650 delay).
- Supplemental actualChrome defaults: hotseat handoff BEFORE banner, confirmation ->2003ms banner, blocked input, enabled autoend1107ms -> next handoff. PVE fixture battle completed with my3 clicks/AI4 actions, all AI unlocked and 654/655/656/655ms after banner; result2512ms; subsequent AI turn2014ms plus657ms delay.
- Online supplement uses natural distinct-roster/manual setup/real hello, then DECLARED fixtures: F-pve relocation; F-B1 minion relocation before actual contact; F-B2 relocation plus maxHP=HP1000; F-tie equal full HP/cooldown immediately before 12th real action; F-bt65 turnCount63/reset flag. These setup assignments are not counted as natural gameplay or UI clicks. Subsequent network actions/menus/battle clicks are real.
- Four menus/submenus local, zero extra sends; opponent controls disabled, capture/flee reasons, hidden opponent inventory. Item2011ms -> same actor/round1.phase0, item frame1/act0, no action consumed. B1 eight actual actions, each act1/extra0. Skill2014ms then damage2001ms (five damage samples all observed >=2000ms); shield posture22, later absorption26 and remaining HP damage11 (60->49).
- Critical visible shield sequence: 105 real-width samples, initial shield39px/HP90px; first shield reduction at1634ms relative to sampled action origin, HP remains90px then; first HP reduction2249ms (615ms later); last changing sample2792ms (1158ms from shield start), inside damage2s. This is actual computed geometry over time, not only setter order or arithmetic. The tool's last-sample 'shieldEnd' field is not interpreted as the shield's first settled timestamp.
- Result2512ms before close/continuation; B2 twelve actual clicks -> judgment2015ms, 100%/100% -> defender survives/attacker removed, ties1/judged1, mirrored win/loss. Unequal HP ratios, shield exclusion, reserve70/100 and retained recA/recD metrics are separately covered by rule tests.
- Default BT65 fixture: exact Korean '버닝타임입니다! 2칸씩 이동 가능합니다', both clients once before normal turn banner; durations2012ms/2013ms then2015ms. Only actor endTurn frame1, peer0, presentation rand calls0/0, btEnterTurn65. Primary natural progression independently verifies no repeat at66.
- FX input blocks, optional battle/forced queue/modal/teleport guards, retained network-frame order and later pump, stale modal/battle/newgame/timer tokens, memo opponent-turn idle behavior and AI scheduling have targeted headless/timer coverage plus static inspection. No claim that every asynchronous schedule or real suspended-browser case was exercised.

State comparison scope:
Primary SNAP includes phase/current/turn/main/battlesUsed/forced targets; battle piece IDs/round/phase; event positions/kind/consumed; temp reveals; piece IDs/owners/rosters/positions/alive/placed/HP/revealed/immobile/healing/shield; modal sequence/receive queue count; selected metrics. Supplement SNAP additionally includes balls/inventory/reserve, active battle HP/shield, piece maxHP/cooldowns and ties. Neither is every S field: local menu/selection/memos/view state, full trace/log, RNG closure/internal pending callbacks, several metrics and other state are excluded. Separate frame/RNG/queue assertions support their specific claims. 'same' means these declared canonical projections only.

Visual/operational limits:
I viewed existing author PNGs issue106/11-explosion-hold.png and15-narrow-battle-menu.png plus final supplemental10-b1-390px-menu-root.png and11-b1-390px-submenu-fight.png; I saved no captures. Author captures are labeled author visual evidence; independent geometry/timing comes from my own browser runs. At390px battle box right374, no internal overflow, menu/skill buttons clipped0/outside0. Underlying document778–929px with2 turn buttons outside is the pre-existing PD-excluded observation; flee label wraps readably. Author sidebar item-count lag is an author-only observation, not independently measured here.
Both browser tools use headless local Chrome with background throttling disabled. They do not prove LAN two-device operation, suspended-browser wallclock deadlines, exhaustive capture/flee RNG branches, or CJ play feel. A watchdog cannot guarantee wallclock while the browser suspends timers; resumption/generation/order tests support recovery only for exercised schedules. Old issue104/93/memo/92 Chrome tools have pre106 timing/menu assumptions; their author failures are not relabeled independent current106 successes. No105 README rerun.

Exact runtime cleanup independently verified:
- Historical a20 primary: Chrome86484, relay76736, loopback61752, profile C:/Users/pc_77/AppData/Local/Temp/i106cdp-iYH7yN — both PIDs absent/profile absent/matching Chrome0/listener0.
- Final primary: Chrome121724, relay50984, loopback64781, profile C:/Users/pc_77/AppData/Local/Temp/i106cdp-R4osC0 — same four absence checks passed.
- Final supplement: Chrome76104, relay86808, loopback49910, profile C:/Users/pc_77/AppData/Local/Temp/i106audit-XymLiz — same four checks passed after tool CLEANUP; exit0.
Read-only guards inspected before execution: mkdir/report paths gated by !READ_ONLY, screenshots gated off; only exact tool-generated profile and PORT0 relay runtime exceptions used. DD_BIND/DD_LAN overrides absent. No broad kill/delete; other workers' resources untouched. An unrelated author's broad-cleanup incident was disclosed by that author; it did not affect these i106 runs and is not my action.

Hash audit:
All executed final source/tool/harness hashes below were checked before their runs and again after completion and remained identical during those runs. Initial-to-final changes are authored revisions/freeze transitions, not worker edits. 134 tracked source/tool/approved-asset files were hashed initially/finally; all101 demo/assets files (100 images + README) identical, no image bytes changed. Source final remaineda493 through both Chrome runs; supplement only executed after exact756a freeze authorization. SHA256:
demo/index.html: a4932cb80a1407fc728ace6ee918315880840c76010de7b21361a7f618e97280 (initial inventory: a20be021eb0048fb53a40639e749eb0e5eccfdf18ebde3506a2af1d0d925d073)
demo/test/harness.js: 8a3596fdf73acdcec4c071e435c5b64ffaee371211b825e9a43df0e2ff0d336c (initial=final)
demo/test/smoke_turnflow.js: 9fd756b6470e35d1166234ac8b04b4d6767936fc923454ebdc40f4420c706999 (initial inventory: dbd6b6590ac9beef92f08c7254783c2ee2c91bfb1bf254e93c330cc2555b01fc)
demo/test/smoke_turnflow_timers.js: 05cfce336b8ab98f88cd5db165004b0ce7275269fff3dec36868f5944d5d911f (initial inventory: 3352fbb4248359000b65631aff195f39057843c6ea1ce34ddb9475017cf35e53)
demo/test/issue106_cdp.js: af8c2dd9b11cbc5b52b30f5ae83a54d25e43f8dd47d0de5ce6ef66f8dc67297b (initial=final)
demo/test/issue106_browser_audit.js: 756a2236f1bf5ab5f59025fccf041695bdbb15bea5816efd4fd1f294394651c0 (initial inventory: 421bd0ec8450e881fed142bd67d5eaf64d26feef493f4cc6e42232dbc3c22075)
demo/test/smoke_orientation_audit.js: abe1516f79ffeecb5660ada7f96218122a051d961c94527a30c77b2334d69dfa (initial=final)
demo/test/ai_compare.js: 771b94e5c20fabd8f0f31ab6ecd703a074a61b00e11bbe938d8bd49b0c43e4b5 (initial=final)
demo/test/smoke_cycle5.js: 7930970ce16e5adecf3f12f583674b42a670fe968174494682c439a4f311e7e3 (initial=final)
demo/test/smoke_memo.js: 6ce4d233aa4701ce06494e723f57ba195e8e05cfc440dc89861840363c711eee (initial=final)
demo/test/smoke_tutorial.js: f78ff20a35745b5da23dfbe588ffbe982f2c3a1cfb4c052b886a1c14b2227e7f (initial=final)
demo/test/smoke_testclient.js: a03030b6ae276455d1bda2a1e409b1a2cdf7e78ce512d3a98efc03c7a0bf94ca (initial=final)
demo/test/smoke_minion_art.js: 389f99311413e89330e5997cb541286111908329e6b2cdfca8df03a4c62de7e6 (initial=final)
demo/test/smoke_attack_balance.js: e7479403eba06e38796f6087b799d6ac86eec92f97d81430a3a7c2a83fcef5a8 (initial=final)
demo/test/smoke_shock.js: 6db34bf0caccdacd616a4cb5b32cd6f3f37f97a37ad9be0499156cb0ac512a27 (initial=final)
demo/test/smoke_own_side.js: 4211943867fd407974c45e7fb282430223c702e0941532536183e515579b7e80 (initial=final)
demo/test/smoke_cross_skill.js: 141e1b1fb26e536c51f6b816ff770b2aab9d3a2e184c519b7280321e94960a08 (initial=final)
demo/test/smoke_online_sync.js: 8381e2384280f3f50556c26cdc9aef211947e6720bc2a8c7be4c1b717560688b (initial=final)
demo/test/smoke_online.js: 4adff2176240fb3d4834611c0a0a916bf56a2446e23765c6cb7705941f1a0af7 (initial=final)
server/server.js: a774b86a122710b8ac84eda3a8d305055642e190eb28123548954c44a794422e (initial=final)
server/security.js: 0ea54ceb244d89a546d17674aff31551b7c302cd3e328f77e73c1bb6f0eb8c48 (initial=final)
Additional read-only dependencies:
server/package-lock.json c799c5bf0e7798b5cb9b01ec1c9f8cbf9ed6911b1279465380281d0824060ce1
server/node_modules/ws/package.json a56a3fd55945a3ce177e3ca165dafae6f7eb03b7aefd58c092ac723d5741a6fb
approved delivery-manifest e978075b30645461103cfacf0ae8e8bb75b4c9ee860743a659a74e2c182a3fbf
CLAUDE.md ed8b513a9b9f923fa69eef3ea67adf4e74e01ef7598f01c4ec5731545d0fb26d
turn-flow spec 3cdcb38841f4047eb3ae8feb4553cb87efaba2598df50e15fbc7134c587dbb35
Final read author reports: issue106-mars.md 3d301623ddd1118e67c7d7352ee5da4c885957ababdf00a79f8a48729f7da433; issue106-shield-mars.md 3b1c7e1439b9993daced1845603572d9a73adcd88f944d549b23cfa11a91c7f9; issue106-browser-mars.md 4f5cf78ef43b4dcb9e51abd37d002f92af730f24db90f0d0d0f9e82d9701f3f1. These author reports were read as evidence, not accepted as independent QA.
Final author390px viewed PNG hashes: root2aed3aee387d4ac4a7a745edf3618157b963ae46ad047c7bd1e7b8972f5b42b0; fight5799fcc129aa32590fb605875eccc05d38d50d25a7080c6be0e4cf5596f9819e.

PASS is the final scoped QA verdict. No worker-created report file exists; PD should persist this inline report. filesModified=[]; no work remains for this dispatch beyond recording worker_done.
