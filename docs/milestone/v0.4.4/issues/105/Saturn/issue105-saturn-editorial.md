# Issue #105 — Saturn 독립 아트·문안 검수

2026-09-08 · PD가 Saturn inline 보고를 취합. 전체 미디어/렌더 QA는 별도다.

[피드백] Saturn_1 / required_role=Saturn / mode=QA / area=QA / mutation=none / instance_index=1 / provider=codex
Bounded Issue #105 ART + release-editorial + README-content review completed; files_modified=[]; no scripts, tests, reports, screenshots, temporary files, Git writes, GitHub writes, Notion writes, asset mutations, or delegated workers.

ART verdict: PASS (asset-level independent visual QA).
- Inspected docs/media/digit-duel-hero.png and all four approved portrait.png references through view_image, rather than relying on the Earth production record.
- Fire preserves orange-red dragon, cream horns/belly, dark lava plates and wing; water preserves curled cyan crest, pale face, blue eyes and translucent fin wings; grass preserves wooden round body, leaf armor, amber eyes and two tall leaves; lightning preserves navy automaton, cream face, gold electrodes and lightning chest emblem.
- Four readable faces and clean silhouettes, six anonymous question-mark tokens, coherent forest/board staging, blue/red sides, exact Digit-Duel title including hyphen, generous title margins, no observed character/title clipping or malformed lettering, no fake HUD/stats/store claim/watermark. Composition is recognizably promotional rather than a literal game state; README.md:4 and :6 provide accurate alt text and explicit illustration labeling.
- Native 1672x941 is approximately 16:9 and accepted. The displayed image preview has strong title/character/token readability; exact 900px/browser placement remains for rendered README QA. Provenance in docs/art/readme-hero-v0.4.4.md:15, :22, :28 identifies project references, reference-guided generation and interpretation limits; tool seed/backend was not exposed. This review verifies visible fidelity, not the artist tool-run audit or universal originality.

Release-editorial verdict: PASS.
- Read all six standalone docs/releases files against the complete original bodies in .git/releases-before-renewal.json, local annotated tags/history, and live read-only GitHub API releases/main.
- All six live Release IDs, published_at values, target_commitish fields, and asset id/name/size/digest/created_at tuples still match the saved original. Actual main = origin/main = v0.4.3 peeled commit cc3f382496473233334f374896d46639b83d7974; latest release is v0.4.3, published 2026-09-07T10:02:56Z.
- Header dates are correct: v0.3.0 Sep 2; v0.3.1 Sep 3; v0.4.0 Sep 5; v0.4.1/v0.4.2 Sep 6; v0.4.3 Sep 7, 2026. All matching UTC timestamps also fall on those dates in Korea.
- docs/releases/v0.3.0.md:10 adds roster/slot detail absent from the old Release prose but independently supported by that original tag: demo/index.html:164, :193, :205 and six-choice setup logic. This is valid provenance, not a retroactive feature.
- docs/releases/v0.4.0.md:9 server-address persistence exists in that tag at demo/index.html:2678/:2687. v0.4.2.md:15 same-version reissue is supported by the original Release; diff between 341b41b and reissued tag has no demo/server changes. v0.4.3.md:7/:8/:12 tracks actual original art/icon/fallback delivery.
- No proxy minion art fix, new search skill replacement, bottom-facing view, opponent-turn memo or attack/shock rebalance is attributed to an old release. Those v0.4.4 changes are absent from README Patch Note too. No incorrect dates or unsupported historical feature additions found.

README content verdict: PASS with one optional precision nit; rendered README/media QA PENDING.
- CJ source read directly via Notion fetch: [Doc] README 전체 리뉴얼, page 3d51e7f1708580f18f2dc4a643721059, last edited 2026-09-08T05:41:39.856Z. Its eight requested categories map to README.md:16, :22, :31, :70, :82, :96, :118, :147. Intro/features use player-facing prose; gallery order is hero, board, battle, ten-step expandable tutorial; latest-only patch note is v0.4.3; game-info table includes release/date/Stars/Forks/environment/developer/first release; instructions, structure and license follow.
- README.md:106-114 matches main launchers and server: Node prerequisite, first npm dependency installation, LAN executable, shared HTTP address and code, both players ready before automatic matching, restart changes default generated code, same-router scope and remote matching deferred. Offline :100-102 correctly retains demo/assets. Main launchers explicitly check Node and fixed LAN/local mode; server default port is 8080 and security.js generates random codes.
- Existing main supports 14 pieces, 20 minions/6 choices/4 slots, 7x13 board, elemental cycle, persistent HP/cooldowns, capture, teleport and 65-turn burning rule including expedition restriction. README.md:74/:86/:87/:93 dates/version match releases.
- README.md:149-155 and ASSET-LICENSE.md:3-15 cover source/tests/config/documentation as Apache-2.0, and identify artwork/branding/rendered screenshots (including new docs/media material) as exclusions. The wording scopes exclusions to media, not all docs/qa or docs/art records; production/report documents are not newly excluded. LICENSE and NOTICE checked.
- Optional P3 precision improvement at README.md:24: 한 번 싸운 말만 정체가 드러납니다 is absolute; main demo/index.html:1167-1174 also reveals an unbattled king when it reaches the far edge and wins. Suggested wording: 전투를 치른 말은 정체가 드러납니다. This is an end-of-game edge case, not a release/content blocker.
- docs/media and docs/releases are intended new documentation directories in this delivery and are not yet in released main; the other summarized runtime directories were checked against main. Full tutorial captures, screenshot correctness, GitHub-rendered table/details layout, scaled image clipping, and link rendering are reserved for the known Mars_2 handoff. Their pending state does not block this ART/release verdict, and this report does not grant full Issue #105 PASS or CJ approval. Issue #104 and active product edits were outside scope.

Exact input SHA256 values (workspace-relative paths):
README.md 9E001EEEA4849B9F19629EEC3CB57B519CDEE7DDFB2E39C301C96DA4D5020619
ASSET-LICENSE.md C9921DAE0D626572CD9E90894503286365BC84D08D01C9594D5078AEC8F01044
LICENSE 1EB85FC97224598DAD1852B5D6483BBCF0AA8608790DCC657A5A2A761AE9C8C6
NOTICE 7FAC84FBEA21320BD3336590249CA9664437DBFF7006291CFCCC88896BD348BE
CLAUDE.md ED8B513A9B9F923FA69EEF3EA67ADF4E74E01EF7598F01C4EC5731545D0FB26D
docs/art/readme-hero-v0.4.4.md 728A2A4072B778080DEBEE93B1553656019831FB1AFDB88BDC46323657F8FE6A
docs/media/digit-duel-hero.png 3215151A1CF978B90C8BD654B752C205FBD8A79B7A15188449ED4C4F49F33832
demo/assets/minions/fire_std/portrait.png DBEF4CC84DB3E0EDEA96614D378EB2D336A6F0C4A614A032B32BB5005B78F149
demo/assets/minions/water_std/portrait.png 28F37EE5DE71E5E934258B6D35650A294F1CBDFC9ED9CC27E72339146924D702
demo/assets/minions/grass_std/portrait.png BC6842518B07237DCBD3489BDA078D3A9931D7BDC663FA886AE27335DC39BF42
demo/assets/minions/lightning_std/portrait.png FE03A36ACB199753A15D157F8EB14144AEA538AB84F75BE944782D739A787BCB
.git/releases-before-renewal.json 442D9C2F9090F6F34C1C733F9A3B78E299D7EB5C371DC2AA0F689538BDEB785C
docs/releases/v0.3.0.md F9CA64BADA42D7329B1FF75CEE455B893BD543CF4D63F12F2C5F02F8A6AD1E22
docs/releases/v0.3.1.md FD56C12E1D282E4671B9651C382F8301DCF699C659ED19A1AA87DEA738C3D291
docs/releases/v0.4.0.md 4B6406B026943CB1D027070757D7D3EFC00EE947E8BA8AF26BF597431DDA9BE6
docs/releases/v0.4.1.md 9431E409E56CA96602D48A6DEF09E39400D079E485D6EF62B25B14F24E4B6AC8
docs/releases/v0.4.2.md 2ED39AB684EDFAD0FC2EF922A8A186C58A8820D566A300E13CB68CB9DA093927
docs/releases/v0.4.3.md EC8EA18171D4E177A53FCF832D014CA40B853C102BD761A01F3237D0ABCF9BB6
Git object identities: main demo/index.html dd4bc556e1788755e0c23e793927bf3504acd66c; v0.3.0 demo/index.html bc374f5602d8b11f033363f4d9a8c7db4df31f9a; v0.4.0 demo/index.html 4fcb39f7255138cf6348e225ffda03ce6fdde11f; main server/LAN서버시작.bat 234c508a4ecb1d8488f2bfd702c8f51cd232f361; main server/서버시작.bat 274be1aee85e01abf76ed4725c55c33a775aa6a7; main server/server.js 8c963ebdc91c25c6b96df0763177dd426b74af22; main server/security.js 731261cd0db5b639cfa28df93b15ffda0e650bab.
Outcome for assigned bounded review: succeeded; files_modified=[]; PD owns durable report, publication/archive/release.

PD 후속: README의 '한 번 싸운 말만' 표현은 '전투를 치른 말은'으로 정정한다. 새 검증 주장이나 규칙 변경은 없다.
