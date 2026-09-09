# Issue #105 — Saturn media first review

2026-09-08 · PD collated inline msg_eedceca26c80; completion msg_666ca5c4f551. Worker archived and released. Initial REVISE preserved; a later recheck must identify corrected input hashes.

[피드백] Saturn_2 / required_role=Saturn / mode=QA / area=QA / mutation=none / instance_index=2 / provider=codex.
Verdict: REVISE for full Issue #105 media/render gate; bounded static/media review PASS, files_modified=[]. PD instruction msg_0230ca55bf74 explicitly retains strict READ_ONLY and requests return for Mars repair.

REVISE findings (confirmed by complete code inspection):
1. tools/readme_media_capture.js:117-118 unconditionally creates a temporary directory and writes tag index.html even for capture --read-only. This exceeds the authorized Chrome-profile/server-only runtime exception; capture was not run. serveGitRef already returns git bytes directly, so Mars can remove the unnecessary source-copy write.
2. tools/readme_media_capture.js:229 unconditionally writes a temporary JSON request in ghRenderMarkdown, including verify --read-only. Full verify was not run; Mars should use stdin or an in-memory request.
3. tools/readme_media_capture.js:254 forces doRender=false under READ_ONLY; browser image loading, gallery open/full-image navigation and narrow viewport cannot be independently exercised by the allowed command. Add an in-memory rendering path with owned Chrome profile and loopback PORT0 server, no HTML/JSON/report/screenshot files, plus narrow viewport support, then redispatch QA.
Additional limitation: :279 catches GitHub render failure as WARN without increasing fail, and :170 permits same-size image hash DIFF with zero exit; a zero command exit alone cannot establish complete sanitize/capture equivalence.

Executed evidence:
- Read full UTF8 CLAUDE.md, capture tool, Mars report, prior independent editorial report, current README and ASSET-LICENSE.
- node tools/readme_media_capture.js verify --read-only --no-gh: exit 0, zero failures; 13 local images + 19 local file/directory links + 1 anchor resolve with exact case, 10 captions/alt match manifest titles, all tutorials 2224x1096. Independently compared all 10 SHA256 values to capture-manifest.json: 10/10 match.
- view_image inspected actual hero, actual board and battle, all ten tutorial PNGs, all nine existing section renders and existing gallery-open image. Full tutorial crops retain titles, counters, all cards/paragraphs, dots and previous/next/skip or game-start controls; no clipped content observed. Tutorial 09 uses three cards with unused right space from the released layout, without losing content. Hero title is legible with margins and all four characters; explicit promotional label is present. Desktop board/battle two-column preview and details two-row/five-column gallery are clean; 162px tutorial previews require full-image clicks as README explains, an accepted preview limitation.
- Stored readme-gh-render.html inspection: 20 img, 30 a, 1 details, 8 H2, 0 script, corrected wording present. Current README has the required eight sections, latest-only v0.4.3 patch note/date and media-only license exclusions, no v0.4.4 release claim. These are existing sanitized-output/approximate-CSS screenshots, NOT a fresh independent GitHub rendering or native GitHub CSS test.
- git rev-parse v0.4.3 commit = cc3f382496473233334f374896d46639b83d7974; tag demo/index.html and eff5c16 demo/index.html both dd4bc556e1788755e0c23e793927bf3504acd66c. git hash-object on board/battle equals their v0.4.3 blobs 032bac90f6dbabd3af42cfe94b2731bd21e010ea and 65be55ee7ce575da3f2e53dd2979fa426f6f5919. Source inspection confirms the capture server reads the requested tag and actual next-button click flow rather than current development HTML, but runtime navigation and recapture remain unexecuted.
- Read-only gh api releases/latest confirms v0.4.3; gh api releases comparison finds all six live bodies byte-for-text exact to docs/releases/v0.3.0.md, docs/releases/v0.3.1.md, docs/releases/v0.4.0.md, docs/releases/v0.4.1.md, docs/releases/v0.4.2.md, docs/releases/v0.4.3.md. All six id/published_at/target_commitish fields and asset id/name/size/digest/created_at tuples equal .git/releases-before-renewal.json; published dates remain Sep 2, Sep 3, Sep 5, Sep 6, Sep 6, Sep 7 respectively.

Input SHA256:
README.md 85D993CD4E1790D4879475B71A4443E0FF4D15AA9E18D5F54186E0323193336E
tools/readme_media_capture.js BB6D002BCD6F2C6C56CC31BED409ECB36406CF7E34F1EF465E78F72E65B55C38
docs/qa/issue105-media.md A429098546BED63316A59EF5853C135E047D5C04FBA4831C3D9177C54959A50C
docs/qa/issue105-media/capture-manifest.json 58AC5A270D59C260688916017CC7288F44959B928B5704CA580BC862331A9AC7
docs/qa/issue105-media/verify-report.json 07BBDBFDF65008CF5AF1BE87FEAEC1E7D66B5C18761096D0AB1DEF66653DA3BA
docs/qa/issue105-media/readme-gh-render.html 7C21991C86C6DE41AD6A78EBC5DFDA8C72E463CF79EC268A0B9144EEF05CD290
docs/media/digit-duel-hero.png 3215151A1CF978B90C8BD654B752C205FBD8A79B7A15188449ED4C4F49F33832
ASSET-LICENSE.md C9921DAE0D626572CD9E90894503286365BC84D08D01C9594D5078AEC8F01044
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

Resource cleanup: this QA created no Chrome process/profile, server, screenshots, reports, temporary code or other files; nothing remains to clean. No Git writes, external writes, user-art access, approved-asset edits, worker delegation or Issue104 product test runs. Full Issue105 PASS and CJ acceptance remain pending; Mars owns tool fixes and PD owns durable reporting/archive/releases.
