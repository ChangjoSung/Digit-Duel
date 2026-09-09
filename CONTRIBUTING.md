# Contributing to Digit-Duel

Thank you for contributing to Digit-Duel.

By intentionally submitting a contribution for inclusion in this repository,
you agree that your contribution is licensed under the Apache License,
Version 2.0, as described in section 5 of [`LICENSE`](LICENSE). You retain the
copyright in your contribution.

Only submit material that you created or that you are authorized to provide
under these terms. Clearly identify third-party code, assets, and their
licenses in the pull request. Do not submit secrets, credentials, private
keys, personal data, or production access codes.

The code license does not grant rights to Digit-Duel branding or to excluded
visual assets. See [`ASSET-LICENSE.md`](ASSET-LICENSE.md) before adding or
reusing artwork, screenshots, audio, or other media.

Development changes should be made on an issue branch and merged into `dev`
through a pull request. Release changes move from `dev` to `main` through a
separate release pull request.

## Continuous integration

`.github/workflows/ci.yml` defines checks for pull requests to `main` or `dev`
and pushes to those branches. This rollout integrates the workflow into `dev`;
the next release PR carries it to `main`. Manual dispatch is also configured,
but GitHub enables it only after the workflow reaches the default branch,
`main` ([GitHub documentation](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)).
It needs no secrets and requests only `contents: read`. Five jobs run in parallel:

| Job id | Name | What it checks |
| --- | --- | --- |
| `rules-headless` | A. 규칙 회귀·AI 완주 (헤드리스) | Headless rule regressions over `demo/index.html`, the v0.4.5 balance and tutorial contracts, the fixed-baseline comparison, the board orientation audit, and the AI vs AI completion gate |
| `server` | B. 서버 (프로토콜·보안·설정) | `npm ci` then `npm test` in `server/` — relay protocol, security, configuration, launcher |
| `server-launcher-windows` | B2. Windows 실행기 회귀 | `server/test-launcher.js` on a Windows runner, where it is not skipped |
| `docs-integrity` | C. 문서 링크·이미지 무결성 | The link checker's regression suite, supported relative Markdown/HTML links and images in tracked `*.md`, and the README media tool's self-check and offline verification |
| `assets-integrity` | D. 납품 아트 자산 무결성 | Delivered minion PNGs and manifests match, without regenerating them, plus the art pipeline tool's own tests. Runs on a Windows runner — see below |

Jobs A, B, and C run on `ubuntu-24.04`. B2 and D run on Windows, for different
reasons: B2 because `server/test-launcher.js` skips itself off `win32`, and D
because it compares **delivered bytes**. The same `Pillow==12.3.0` pin passed on
Windows and failed on `ubuntu-24.04` for 14 of the 28 delivered PNGs, so job D
pins the environment the assets were baked in — `windows-2025`, Python 3.14.3.
The evidence and what it does and does not establish is in
[the Mars report, part 4](docs/milestone/v0.4.7/issues/132/Mars/report.md).
The authoritative pass/fail for that job stays the byte and manifest comparison:
do not make a mismatch go away by regenerating approved assets, by comparing
pixels only, or by skipping files. Investigate the environment first.

Job C passes `--manifest` to `readme_media_capture.js verify` so the check reads
the manifest for the media the README currently links, not the tool's older
default. A manifest SHA mismatch there is a `WARN`, not a gate.

Reproduce a failing job locally with the same command the workflow runs. The
most common ones:

```
node demo/test/regression/smoke_turnflow.js          # and the other demo/test/regression/smoke_*.js suites
node tools/docs/docs_link_check.js --verbose   # broken links and images in tracked *.md
node tools/docs/test/docs_link_check_test.js   # the checker's own regression suite
cd server && npm ci && npm test           # relay server
python tools/art/minion_art.py --all --check --no-preview   # delivered art, no regeneration
python -m unittest discover -s tools/art/test -v   # art pipeline tool
```

The document checker does not validate external URLs, heading anchors, or all
CommonMark syntax. README media verification uses the v0.4.5 manifest; its
existing checksum mismatch policy is a warning, not a failing check. Delivered
minion art in job D uses strict byte and manifest comparison.

Two things to keep in mind when you change what CI covers.

- **Approved rule changes update the assertions in the same pull request.**
  `smoke_attack_balance.js` and `smoke_shock.js` encode the balance contract of
  the released version. If an approved planning decision changes those numbers,
  the test change belongs in the pull request that changes the rules, not in a
  follow-up.
- **Do not add exceptions to make a check pass.** If `docs_link_check` reports a
  broken link, fix the link. If a path moved, record the move in
  [the relevant move table](docs/milestone/MOVES.md) and update the
  clickable links; historical plain-text paths in past reports stay as written.

Branch protection is enabled on `main` and `dev`: pull requests are required,
force pushes and deletion are disabled, conversations must be resolved, and
all five checks above must pass on an up-to-date branch. Checks are bound to
the GitHub Actions app (ID 15368), and administrators are subject to the same
rules. GitHub's required approval count is zero; the independent Saturn review
and CJ approval contract remain in effect. See [Issue #132](https://github.com/ChangjoSung/Digit-Duel/issues/132)
for the actual PR run and protection verification.
