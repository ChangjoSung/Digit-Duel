# Saturn independent QA — issue #232 integrated code / #264 Render structure

Date: 2026-09-28 KST. Target: `issue-264-render-compat` HEAD `4283e867b0f387b69219cc25ae1caeb61c0840c1`. Dispatched QA only; repository files modified: **0**.

## Verdict

- **REVISE — current source integration boundary.** The combined public proxy, PostgreSQL, auth, WebSocket, migration-ledger, and mail-failure probes passed, but a separate physical schema-drift case failed closedness: with all five ledger rows present and `match_results` missing, the server listened and `/readyz` returned 200. This violates the requested schema-missing boundary and requires a source fix before release.
- **REVISE / NO-GO — actual account deployment.** The live Render service remains `main`/`d0bc196` (old v0.4.10), without a project PostgreSQL resource, `DATABASE_URL`, or SMTP configuration. No issue #232/#264 code, account, mail, or production database behavior was tested on Render. Release/deploy and any provider/plan change remain separate CJ gates.

## Integrated scratch probe

`integrated.js` was run once successfully after correcting a QA harness output-handle timeout. The first attempt started an owned scratch PG process, and it was stopped before the successful run; no source changes resulted. The successful run exited **0** with **20 PASS checks** and both owned ports free afterward. Full results: `integrated-results.json`; raw command log: `integrated.log`.

- Fresh private-ACL, loopback PostgreSQL cluster on `127.0.0.1:55470`; server fixture bound only `127.0.0.1:10000`. `DD_AUTH_PUBLIC_DEPLOY=1`, `DD_AUTH_PUBLIC_HOST=dd-qa.example`, proxy Host/Origin/`X-Forwarded-Proto: https`, random scratch `DATABASE_URL`, and external private `DD_RESULT_OUTBOX` matched the production-shaped path. The cluster held only **2 scratch accounts**. No QA DB, credential, account file, or external mail was used.
- Unmigrated database without migrate opt-in: exit 1 and no listener. With `DD_DB_MIGRATE_ON_START=1`: all **5** migrations applied; `/healthz`, `/readyz`, and `/` returned 200, with readiness body `ok (db)`.
- Missing XFP, HTTP Origin, wrong Origin, and missing Origin each made signup return 403 with **0 account rows**. Two valid signups returned 201 and `Secure; HttpOnly; SameSite=Strict` cookies. Independent sessions restored; a new login invalidated only the older session of the same account. Wrong-origin WebSocket upgrade returned 403; same-origin account A created and account B joined a room with the expected player names.
- With SMTP absent, password-reset request for an existing scratch account returned `503 E_MAIL_UNAVAILABLE`. With SMTP pointed only at unreachable `127.0.0.1:1`, it again returned safe 503 without email, password, code, or transport error leakage. No mail was sent.
- Restart **without** migrate opt-in kept 5 migration ledger rows, 2 accounts, and a valid session. A scratch ledger row changed to its legacy CRLF checksum was accepted unchanged. A genuine checksum mismatch and a missing `005` ledger row each caused exit 1 before listen; the scratch ledger was restored afterward.
- The server and PG on owned ports 10000/55470 were stopped; protected pre-existing listeners remained PID 45248/8085, PID 38816/55462, and PID 4956/8084. Scratch ACLs allowed the current user only. Temporary plaintext password file was removed.

## Blocking source finding — schema missing despite valid ledger

A second fresh private scratch PostgreSQL cluster applied migrations 001–005, then removed only the `match_results` table while leaving all five `schema_migrations` rows valid. At HEAD `4283e867`, the public-mode server **listened** and `GET /readyz` returned **200 `ok (db)`**. `db-migrate.js::verify()` checks connectivity and ledger pending/drift/unknown rows, while `db.js::ping()` checks DB connectivity; neither checks the expected physical table. This is a concrete fail-closed/false-readiness defect. Evidence: `schema-case-results.json` and `schema-case.log` (probe exit 0 as a successful detection). The owned scratch listener and PostgreSQL were stopped and no repository file was changed.

## Focused regression and preservation

| Check | Result |
|---|---|
| `node server/test-db.js` | exit 0; DB config/migration/startup checks pass |
| `node server/test-static-load.js` | exit 0; 82-asset corpus; cold 82/82 and dual-client 164/164 all 200; rapid 246/246 all 200; abuse 1,968 requests yielded 1,415 expected 429 responses |
| `node demo/test/regression/smoke_tutorial.js` | exit 0; 139 pass, 0 fail |
| External tutorial fixture with `.tut-card{position:absolute;}` | expected exit 1; 138 pass, **G17 alone** fails, proving the scoped negative catches it |
| `python tools/art/leaders_export.py --check` | exit 0; 10/10 products match, no writes |
| `python -m unittest tools.art.test.test_leaders_export.LeadersExportTest.test_check_manifest_crlf_portable` | exit 0; external fixture accepts CRLF-only JSON manifests and rejects changed JSON/PNG; check mode writes none |
| Frozen #238 `back_nav.js` proposal | raw SHA-256 `df9b7b7141915685090770e2cbdd4618b62755a5eee5acfda5e9f5f62db10393`; external fixture 122 pass/0 fail; four negative controls exited 1 for semantic handler, misplaced button, nonempty indexed buttons, and hidden CSS (menu-position mutation trips both G1a-2 and G2) |
| Approved-art SHA comparison | 177/177: 137 PNG, 34 WEBP binary exact; 4 SVG, 1 MD, 1 JSON text verified with LF normalization where needed |
| Source freeze | 1,687/1,687 tracked and untracked nonignored paths and SHA-256 match both before/after and PD source-before; HEAD and clean status match |

One approved text SVG, `demo/assets/ui/goods.svg`, has 14 CR bytes in the Windows worktree and zero in the committed blob. Its LF-normalized SHA equals the approved SHA and the `HEAD` blob SHA; binary PNG/WEBP bytes were not normalized. No art was regenerated.

## Actual Render state and limits

Read-only dashboard inspection (project `prj-daj498jm8hqs73esrtu0`, service `srv-daj498mq1p3s73a31s3g`) showed one deployed Node Free web service in Singapore, branch `main`, live commit `d0bc196`, repo root empty, build `npm ci --prefix server`, start `npm start --prefix server`, health path `/healthz`, auto deploy **After CI Checks Pass**, PR previews **Off**, and environment **keys only** `DD_AUTH_PUBLIC_DEPLOY`, `DD_AUTH_PUBLIC_HOST`. The project Production view listed **1 service and no PostgreSQL resource**; this observation is scoped to that project, not the whole account. No environment values or deploy-hook secrets were read. Live HTTPS `/healthz` and `/` returned 200 on `digit-duel-mipa.onrender.com`, but this is the old main deployment only.

The source pins `.node-version` to **24.21.0**; the local QA runtime was Node **24.16.0**, so local tests demonstrate Node 24 major compatibility, not the exact Render runtime. Render's [Node version precedence](https://render.com/docs/node-version) supports `.node-version` after the new source is deployed; the current old-main runtime version was not inspected.

Render's [Free service limits](https://render.com/docs/free) state outbound SMTP ports **25/465/587 are blocked**, Free services spin down after 15 minutes idle, and local filesystem changes disappear on restart/redeploy/spin-down. Thus current standard SMTP reset mail is a deployment **NO-GO**; the local unreachable-port test proves only safe failure. `match-results` outbox on a Free local disk cannot be claimed durable through restart or spin-down. Room state is process memory, so active rooms are lost on process restart; Free supports one instance. Free PostgreSQL can persist relational data but expires after 30 days and has no managed backups on that plan. None of those provider-side behaviors was exercised by the scratch fixture.

## Evidence boundaries

No repository, Git index, Render/GitHub/Notion resource, production configuration, or actual QA database was mutated. No live signup, SMTP send, deployment, or browser gameplay was performed. Existing CJ UI acceptance and record-height waiver were carried forward without another full UI replay. The successful integrated probe was a local proxy simulation; it cannot prove Render's actual proxy trust path or production credential provisioning. A separate physical-schema probe disproved the source's fail-closed claim for missing tables. The #238 back-navigation review used a different frozen tree read-only and external mutated fixtures only. Report and all scratch evidence are under `C:/Users/pc_77/orca/qa/Digit-Duel/issue232-saturn` only.
