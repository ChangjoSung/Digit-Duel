# Issue #105 — Saturn independent media recheck

2026-09-08 · PD collated msg_1814d1b3e646; completion msg_272a15bf1595. This report covers README85d993 before the two Stars link corrections; the subsequent delta report is the final verdict for the current README. Full prior evidence and the REVISE finding are preserved below.

[피드백] Saturn_2 final independent QA, 2026-09-08T06:25:51Z.
required_role=Saturn; mode=QA; area=QA; mutation=none; instance_index=2; provider=codex; taskId=task_d79e28cf36ed; dispatchId=ctx_395a53af69f8; files_modified=[].

Entire Issue105 QA verdict: REVISE on the literal no-dead-links acceptance criterion. Repaired README media/capture/render tool and assets verdict: PASS. All prior media first-review blocking findings are resolved at the frozen input hashes below. No new approval sought and no patch made.

Confirmed remaining finding:
- README.md:11 and :88 link to https://github.com/ChangjoSung/Digit-Duel/stargazers. Anonymous HEAD and repeated GET (including a Mozilla User-Agent and trailing-slash variant) return HTTP 404 with body Not Found. The repository URL returns 200; its own response embeds canOpenStargazersAndWatchers=false, stargazerCount=1, and the same stargazersPath. Authenticated read-only gh api repos/ChangjoSung/Digit-Duel/stargazers succeeds with length 1.
- This is a confirmed public-visitor access limitation, not proof of deleted repository data or a misspelled endpoint. Of 13 unique external README HTTPS URLs tested by HEAD with redirects, 12 returned 200 and this one returned 404; it occurs twice in the README. The local-link gate passes, but an unqualified claim of no dead links is unsupported. PD/Mars should resolve the intended public-link behavior or explicitly record the authenticated-only limitation before declaring the literal full gate PASS. No unrelated redesign or release change is requested.

Independent execution and counts:
1. node tools/readme_media_capture.js verify --read-only --viewport 1100x900: exit 0, zero failures, actual Chrome rendering performed. Fresh gh api markdown --input - output is 18,513 bytes, SHA256 7c21991c86c6de41ad6a78ebc5dfda8c72e463cf79ec268a0b9144eef05cd290; 8 H2 sections plus H1, 20 img, 30 a, 1 details, 0 dropped README images, 0 script. 13/13 local images, 19/19 local file/directory references and 1/1 heading-slug anchor resolve; exact-case source scan passes. Page 1100x4200, article 1012px, three tables 948px, page overflow 0 and internal table horizontal scrolling 0. Gallery 10/10, 2x5, 162px thumbnails. Nine section screenshots plus gallery were captured in memory; their printed 12-digit hash prefixes and sizes match saved desktop PNGs.
2. node tools/readme_media_capture.js verify --read-only --viewport 390x844: exit 0, zero failures, fresh GitHub sanitize and actual Chrome. Page 390x5528, article 390px, three tables 358px, page overflow 0 and internal table scrolling 0; gallery 10/10, 2x5, 44px thumbnails.
3. node tools/readme_media_capture.js capture --read-only --ref v0.4.3: exit 0, actual first-visit tutorial automatically opens from a fresh profile; two real next-button traversals, no forced tutorial opener. Ten sequential counters/titles, 3/3/3/4/3/3/4/3/3/3 cards, no tutorial box vertical scroll. Source ref v0.4.3 commit cc3f382496473233334f374896d46639b83d7974, demo/index.html blob dd4bc556e1788755e0c23e793927bf3504acd66c, 228842 bytes. CSS clip (84,176)1112x548 at DPR2 produces 2224x1096 for all ten. All ten full SHA256 comparisons with saved PNGs PASS; total saved bytes 1346943. Manifest hashes and current PNG hashes match 10/10; all ten caption/alt mappings pass.
4. Supplementary stdin-only CDP inspection loaded the existing tool helper definitions in memory with --read-only, its fs gate, owned-profile launch/cleanup and loopback PORT0 server. No source/temp code file or screenshot file was created. Used fresh GitHub sanitize output, clicked the details summary, then real CDP Input.dispatchMouseEvent presses/releases on every tutorial thumbnail. Actual browser navigation reached the correct original PNG URL and natural 2224x1096 dimensions 10/10 at desktop and 10/10 at narrow. Open-gallery page widths remained 1100 and 390; the expanded tables also had zero internal overflow. This supplements the tool, which otherwise opens details and validates image loading but does not click all image anchors.
5. Required GitHub failure detection independently exercised using only child environment GH_HOST=github.invalid and the unchanged verify --read-only command: observed child exit 2, FAIL gh api markdown, one problem, render skipped, artifact writes 0 and unchanged snapshot. One preceding PowerShell try/finally wrapper masked its shell exit; the follow-up spawnSync explicitly recorded the real child exit 2.
6. Required same-dimension recapture DIFF independently exercised with unchanged tool capture --read-only --ref v0.4.3 --viewport 1282x900. Controlled 2px viewport change kept all PNGs 2224x1096 but changed all ten image hashes: child exit 1, byte-identical 0/10, FAIL byte mismatch 10 and other problems 0. No --allow-hash-diff override was used. This is an expected negative control, not a defect in the default capture.
7. No product tests, orientation audits or product edits were run. No Git/GitHub/Notion writes, asset modifications, user-art access or latency-report access occurred.

Source and read-only audit:
- Read complete UTF8 CLAUDE.md, both prior Saturn reports, updated issue105-media.md, full capture tool, the new test harness, README and ASSET-LICENSE.
- captureTutorial/serveGitRef now use git-show bytes in memory, with no temporary tag HTML. ghRenderMarkdown at tool L327-331 sends JSON through stdin and disables the gh update notifier; no request JSON file. renderReadme serves an in-memory page and performs actual Chrome under READ_ONLY; artifact writes are guarded.
- Independently inspected fs and child-process call sites: actual direct writes are confined to guarded writeArtifact/ensureDir, owned-profile mkdtemp and owned-profile rm. Read-only operations use git show/rev-parse/config --get and gh api markdown. The tool selfcheck passes, but this and the fs gate were treated as supporting evidence, not a complete filesystem sandbox proof.
- tools/test/readme_media_readonly_test.js was inspected but NOT executed: its unconditional negative fixture block L39 onward creates rmc-negtest-* and altered source copies, and control D intentionally creates STRAY.txt. It implements only --quick/--no-gh, with no true --read-only mode. Its A/B/C/D negative checks are author-reported evidence only. No claim is made that this QA independently ran that unsafe fixture harness.
- The fs gate is not an OS sandbox, and its enumeration does not cover every possible asynchronous/native write path; inspected commands and external scoped snapshots support this run. Chrome launch timeout/error cleanup was not fault-injected; the successful launches exercised their finally cleanup. Do not generalize these results to arbitrary unreviewed code or child processes.

Visual verification:
- view_image inspected the actual hero, selected tutorial-04 and tutorial-09 PNGs, saved newly regenerated desktop section-00, section-03 and gallery-open. The prior first pass inspected all ten tutorials; their complete hashes remain unchanged. Hero title/characters and explicit promotional caption are readable without clipping. Tutorial titles, counters, cards and navigation remain fully visible; tutorial09 retains the released unused right-hand space.
- Fresh actual narrow section00, gameplay section03 and expanded gallery captures were displayed directly from in-memory PNG bytes, with no files. Full SHA256: section00 23ca2d9f5b008abaf85fa1c4f6a3e546c3676c159b13b2869beb82d659b17af2; section03 7cdf75548dfdafd16b3c20445daae17389e66296725ab430385c61afb5c132a5; gallery c1177f54e1af6df4c4fb087e6d4cb3771d2664b6eaa7998ddbe1a97a97edb156. They match the required read-only narrow render prefixes. No clipped titles/media/captions observed. Narrow captions wrap heavily and 44px tutorial thumbnails are unreadable at preview size, as expected for the accepted five-column design; verified full-image navigation provides readable originals.
- CSS is custom approximate GitHub Markdown CSS, not native github.com CSS or pixel-identical rendering. Anchor validation compares heading slugs; the API HTML lacks native heading IDs. Results establish sanitizer output, the tested approximation and actual image navigation, not universal native-GitHub layout equivalence.

README/assets/releases:
- README contains the eight required sections, v0.4.3 Patch Note dated 2026-09-07 and current game v0.4.3, no v0.4.4 patch/release claim. Hero is explicitly promotional. Source/documentation remain Apache-2.0 while branding/art/rendered images have media-only exclusions; report documents are not blanket excluded. Prior P3 wording nit is resolved to 전투를 치른 말은.
- git rev-parse confirms v0.4.3 and eff5c16 demo HTML blobs are identical. Saved board/battle git hash-object values equal their v0.4.3 objects: 032bac90f6dbabd3af42cfe94b2731bd21e010ea and 65be55ee7ce575da3f2e53dd2979fa426f6f5919. These are staged gameplay scenes from the released renderer, not proof of naturally played sessions.
- Fresh gh api releases/latest confirms v0.4.3. Fresh releases?per_page=100 has exactly six releases, the same six as .git/releases-before-renewal.json. All six live body texts exactly match docs/releases/v0.3.0 through v0.4.3. All six id/published_at/target_commitish plus asset id/name/size/digest/created_at tuples match the baseline; no new release. v0.4.1 and v0.4.2 each have three assets, others zero. Dates remain Sep2/Sep3/Sep5/Sep6/Sep6/Sep7. Baseline file is UTF16LE BOM; comparison was rerun correctly after an initial UTF8 decoding error.

Cleanup and frozen inputs:
- Every required tool run reported artifact writes 0, 26 watched files unchanged and new readme-media-* remnants 0. Independent PowerShell snapshots retained only in orchestration memory compared 39 scoped files before/after by path, size, mtime ticks and full SHA256: 39/39 identical, additions/deletions/changes 0.
- Owned server ports were 52889,52944,52997,53117,53239; Chrome PIDs 90328,69184,78956,91592,119700 and Node PIDs 84192,105720,82876,80496. All tested processes are gone, all five listeners are absent, readme-media-* temp directory count is zero, and no Chrome process retained the owned profile arguments. Profile suffixes bOtA70,lQ8Kee,wLo6Mh,fHlQFS,J9DCAs all reported owned=true removed=true and were independently absent. Other processes/servers/profiles were not touched.
- Tool SHA256 remains 79b2e7548986f9e494216d6fb584bc26e4fa8adac4ab1c6f2d0353c903ab9dc8 and report SHA256 remains 8017c1f0a7aae5a6b23f1003ab86109b4c9c953e4ce7481830f02e8529dee4b2 before and after. Full frozen file hashes follow.

.git/releases-before-renewal.json 442d9c2f9090f6f34c1c733f9a3b78e299d7eb5c371dc2aa0f689538bdeb785c
ASSET-LICENSE.md c9921dae0d626572cd9e90894503286365bc84d08d01c9594d5078aec8f01044
CLAUDE.md ed8b513a9b9f923fa69eef3ea67adf4e74e01ef7598f01c4ec5731545d0fb26d
docs/media/digit-duel-hero.png 3215151a1cf978b90c8bd654b752c205fbd8a79b7a15188449ed4c4f49f33832
docs/media/tutorial-01.png 108e819f986ccb0d642edc9ca32dc4bd71037a9858b6e27f00c03c7f3c98b797
docs/media/tutorial-02.png 6e22f119ce14b9e3d516a2b8baf4b933f4f3468ac317e57a492362e576c7cb08
docs/media/tutorial-03.png 2355f0d9527a2ed5e9761800edb65aae2d988b5fccd4d7538da03ba842cca0c6
docs/media/tutorial-04.png 36abb371a3bc5809bfe917ac3bb59bc5485173cff25820ba147f8478b9a417d8
docs/media/tutorial-05.png 19b1ee47ad2f3ca6e50ce016f9561f06a76bd5ed304a59d348a1bcf6668d6092
docs/media/tutorial-06.png 859020bec4c7536a66b449f43fcb261c9b10985de30ffc0544f636ee9123c97f
docs/media/tutorial-07.png 4dbb655196c105573f614ea427643a07667593cbdb5fd21efd57535f2c43b208
docs/media/tutorial-08.png 09e087e9bf44fc41c9176ec25d8ca61f221846595e7cc5b2975d1d5dc74d1183
docs/media/tutorial-09.png deb18b303ad031d95a160d3a2199239585d541c184d849ea7fcdc9df469eb4f3
docs/media/tutorial-10.png 24a19d5953261cdd13aa7a2067cc1c0b1550bb3162cdfc82622b8a3fc28355e0
docs/qa/issue105-media.md 8017c1f0a7aae5a6b23f1003ab86109b4c9c953e4ce7481830f02e8529dee4b2
docs/qa/issue105-media/capture-manifest.json 58ac5a270d59c260688916017cc7288f44959b928b5704ca580bc862331a9ac7
docs/qa/issue105-media/gallery-open.png 07e1657de9139397b8f7c7baa9677fc5fe98594de6f86a9fc2bf48e0b2e1f989
docs/qa/issue105-media/readme-gh-render.html 7c21991c86c6de41ad6a78ebc5dfda8c72e463cf79ec268a0b9144eef05cd290
docs/qa/issue105-media/section-00.png d71c87aeea5c189095cb95174b9ff397f5c52a11917a2fa7cfa8b6ccece323a8
docs/qa/issue105-media/section-01.png 323a046a1a2605d7c666b8bba9a2c777cfcd84bd7f51e9ed0770ee775695d983
docs/qa/issue105-media/section-02.png 50efdd2eab0dc5e2bc417c72b26cfd90b4273d9de1a968757128ed7ec86e8c2a
docs/qa/issue105-media/section-03.png 9decc6a4469715ba14853190cb110b18b1a8ea1e432cc061213ca33f404b5e3e
docs/qa/issue105-media/section-04.png 09c583db363870255261d6cc6955e6d49af5dab9a82175d04f6b27342a0a87eb
docs/qa/issue105-media/section-05.png 418624805fec8e342ac76848462fcbb9fb0c736d295c7567731504a850cfe21d
docs/qa/issue105-media/section-06.png 2d35d8b1c70e18d62ab00c6d9c2a116fbf01e8da9959cd409b9a890026dd4872
docs/qa/issue105-media/section-07.png 5bb94169a441c4cfed35e2d036423b252a4aa6714af4d461da4fe664979d08db
docs/qa/issue105-media/section-08.png 943ea70e0e7b0b4205f4b63cdfd2e6c957a468b09f263850f57d85b7c1e5ecf5
docs/qa/issue105-media/verify-report.json de4f7fa49a4c2e02b5bad76604cbbe742f268c59b5e3dd0ff4c65e40fc999cf8
docs/qa/issue105-saturn-editorial.md 6ae3e8c6ee8fe3fd6ebfb481a37cfd28119b783a9b32bf79fdf6b5ba79cca25e
docs/qa/issue105-saturn-media-first.md cfed3254665dd1ec21dd88fb65cf5b85f000e960f7a3e4ecda287c14b45d6c37
docs/releases/v0.3.0.md f9ca64bada42d7329b1ff75cee455b893bd543cf4d63f12f2c5f02f8a6ad1e22
docs/releases/v0.3.1.md fd56c12e1d282e4671b9651c382f8301dcf699c659ed19a1aa87dea738c3d291
docs/releases/v0.4.0.md 4b6406b026943cb1d027070757d7d3efc00ee947e8ba8af26bf597431dda9be6
docs/releases/v0.4.1.md 9431e409e56ca96602d48a6def09e39400d079e485d6ef62b25b14f24e4b6ac8
docs/releases/v0.4.2.md 2ed39ab684edfad0fc2ef922a8a186c58a8820d566a300e13cb68cb9da093927
docs/releases/v0.4.3.md ec8ea18171d4e177a53fcf832d014ca40b853c102bd761a01f3237d0abcf9bb6
README.md 85d993cd4e1790d4879475b71a4443e0ff4d15aa9e18d5f54186e0323193336e
tools/readme_media_capture.js 79b2e7548986f9e494216d6fb584bc26e4fa8adac4ab1c6f2d0353c903ab9dc8
tools/test/readme_media_readonly_test.js cd1663a0c34b4cf17b3b858a3b92c69da12f731f99bb866f24cc2c19738f5df3

Work complete for this QA dispatch; files_modified=[]. PD owns the durable report and final acceptance disposition. The media-tool REVISE is cleared; the literal entire no-dead-links gate remains REVISE solely for the confirmed anonymous Stargazers limitation above.
