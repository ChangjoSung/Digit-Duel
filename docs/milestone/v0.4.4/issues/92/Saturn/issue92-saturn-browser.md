# Issue #92 — Saturn_1 독립 브라우저 QA

Mercury가 Orca inline 납품을 원문 취합. 코드·테스트 작성 없음. 메시지 `msg_691ff7eabcf9` · 2026-09-07.

[Feedback] Saturn_1 completed independent read-only browser QA of target 1322c1d using three approved CDP suites and a finite in-memory combined-modal probe. All 56 existing browser checks and 22 additional checks passed, including privacy, stale-callback safety, replay and negative controls, with unchanged product/tool hashes and files_modified=[]. No browser-scope blocker remains; core QA stays with Saturn_3 and natural full-match, mobile, LAN, wss and human balance validation remain outside this result.

```json
{
  "taskId": "task_f8618d0beefd",
  "dispatchId": "ctx_cc06343550b6",
  "outcome": "succeeded",
  "filesModified": [],
  "files_modified": [],
  "required_role": "Saturn",
  "role": "Saturn",
  "instance": "Saturn_1",
  "instance_index": 1,
  "mode": "QA",
  "area": "HTML",
  "mutation": "none",
  "provider": "codex",
  "verdict": "PASS",
  "target": "C:/Users/pc_77/orca/Digit-Duel commit1322c1de50c2701efa2c39b46c2e8359e2fd73a2; SHA256 0fe0bf450c5c29bd3d2a65034cdd832b16927fc898774f5b7d3c2ebecbcb7fbb",
  "contract": "Read CLAUDE.md fully, gameplay-spec sections2/5/6 and latest issue92-integration.md. Independent observed evidence, not author endorsement.",
  "commands": [
    "node demo/test/issue92_cdp.js --read-only =>20/20 exit0",
    "node demo/test/issue93_cdp.js --read-only =>18/18 exit0",
    "node demo/test/memo_cdp.js --read-only =>18/18 exit0",
    "additionalProbeCommand exact PowerShell here-string/node in-memory adaptation =>22/22 exit0",
    "git rev-parse HEAD => target before/after",
    "git diff --name-only -- demo/index.html demo/test/issue92_cdp.js demo/test/issue93_cdp.js demo/test/memo_cdp.js => empty",
    "Get-FileHash demo/index.html,demo/test/issue92_cdp.js,demo/test/issue93_cdp.js,demo/test/memo_cdp.js,docs/qa/issue92/*.png,docs/qa/issue92/issue92_cdp_report.json -Algorithm SHA256"
  ],
  "counts": "56 existing browser checks (20+18+18), plus22 independent probe assertions:18 across3 clean-client choice fixtures,3 bypass-mutant assertions,1 console check; no repeats counted unique; separate from Saturn_3 core and author1009.",
  "evidence": [
    "PVE seed30 actual clicks select/search/slot0/battle: lightning_effect inherits cooldown[2,1,0,0], reveal[1], generic log; water defender damage29/hp71/shock1/burn0/cd0=2; title50 percent shock/lightning affinity.",
    "Actual online2 clients candidates water_heavy slot0, grass_stable slot1, water_effect keep; skills/cooldowns/reveal/seq/shared RNG same after each; seq3, waiting sent0/recvA9; no candidate in waiting mutation history/body increase/title/aria/URL/game log.",
    "Actual ball capture seed1/HP20 fixture: both reserves skills[water_heavy,grass_stable,sup_heal,sig_std], cooldown zeros, reveal[],HP70/100,fire,art M-F1,atk20,skills alias false,target removed,subsequent RNG same.",
    "P2 actual DOM order(13,1)..(1,7),columns preserved,y1=729/y13=81,14 own pieces below14 foes,ownMin621>foeMax189; elementFromPoint logical13,1; actual move1,1->2,1 replicated, P2 y675/P1 y135; selection/highlights and local memo logical12,6/y135 correct;snapshots equal,peer memo absent.",
    "Memo socket checks:waiting picker/save sent0,actor recvA0,local bomb memo;wrong-turn own-piece blocked;actor select+move sent2 with equal replay;own-turn memo sent0,own selection sent1;delete local;file PVE AI-delay120s picker/save passed.",
    "Independent combined T0/T1/T2 fresh pairs with fixture current0/1/0:actual visible foe click,bomb save,reopen;retain old king-save/delete/close refs;remote actual select/search opens recruit;waiting token null/open true/buttons0/memoClickTarget blocked;each stale callback preserves full overlay/memos/seq/sync/queue/selected/sent snapshot,unchanged[true,true,true].",
    "Owner still completes slot0 lightning_stable(reveal[1]),slot1 lightning_stable(reveal[0]),keep lightning_heavy(original skills/reveal[0,1]);both clients equal,seq1,queue0,mainused,cooldown[2,1,0,0],RNG equal,local bomb memo preserved,waiting sent0.",
    "Independent privacy: synchronous overlay innerHTML setter argument history plus MutationObserver text/additions and all-document attribute old-values; candidate writeLeak=false/attributeLeak=false,body/title/URL/game-log clear.",
    "Negative controls:transient candidate text/title and body attribute injected then removed in memory detected by synchronous write capture,text observer and attribute old-value detector in all3 fixtures;in-memory bypass-core modal mutant leaves token live and stale callbacks change snapshot(unchanged[false,false,false]),detecting historical integration defect.",
    "Actual recruit card DOM3/3 fixtures inside1280x800,no horizontal overflow,all3 buttons positive size/inside card;console errors0.",
    "Viewed all5 delivered issue92 PNGs plus issue93 P2-start and issue94 memo-picker via view_image;recruit comparison/buttons,battle sprites/status panels readable and unclipped;issue94 historical screenshot not used to infer current combined behavior."
  ],
  "limits": [
    "No full natural-match claim:#92 installs positions/events/cooldowns/reveal,seed30,dmgVar0/shockProb1,captureHP20/seed1;independent combined sets current and matched recruit fixtures;actual input/render/socket/replay real,not balance/occurrence-rate evidence.",
    "Desktop headless Chrome,file and127.0.0.1 HTTP only;no mobile/LAN/wss/human balance claim;core QA owned Saturn_3,smoke_online.js not executed.",
    "UI/DOM/attribute/game-log/URL privacy only;shared lockstep client memory is not secret.",
    "Initial inline runner attempt failed on non-ASCII anchor before resource launch;ASCII anchor substituted only in-memory harness;successful exact command supplied;no product/test edits."
  ],
  "cleanup": "Inspected code write paths first;read-only report/screenshot gates suppress artifacts;only authorized exact temporary Chrome profiles and PORT=0 loopback relays;all8 parent PIDs absent and all4 exact profile paths absent at final check;files_modified=[]/filesModified=[];no workspace,test,report,scratch,Git,GitHub,Notion writes;no art/ or orca-hook-latency-report.md read/write;no delegation.",
  "resources": [
    "cross92cdp-kBNFp5 chrome73492/server119524/64646 removed",
    "i93cdp-70hqPX chrome120148/server47672/64490 removed",
    "memocdp-tOj918 chrome32308/server96464/64491 absent",
    "cross92cdp-2nNbpA chrome76840/server113660/64764 removed"
  ],
  "hashes": {
    "demo/index.html": "0fe0bf450c5c29bd3d2a65034cdd832b16927fc898774f5b7d3c2ebecbcb7fbb",
    "demo/test/issue92_cdp.js": "04545d72f386675bc1c4f7220ba93a83d86aa82ce977eb8485f96a0eefdbe3ef",
    "demo/test/issue93_cdp.js": "8e1c3cb9b5039b632471412ca70799b988a1e6292b770ccad2fd1d50b91226ed",
    "demo/test/memo_cdp.js": "8431545b37f636b4ac7f408d776797606546196335fb87ca042717853cd3662e",
    "issue92/report": "4787fd14a9583024372eef6bb3abcbc52283b493b51f6cf2ecc39614c4565d08",
    "issue92/1-pve-recruit-modal.png": "e9f6d64df07ac05b0f9a422aedd2b20dc1da3969b5797e271e4c9a5be8080bdf",
    "issue92/2-pve-battle-buttons.png": "0892e7319917f3397001b15fdadcffb91a2817f7443f50c9ebe2599d829bbf48",
    "issue92/3-pve-cross-skill-hit.png": "b974aeaaf7ba0c45bc3fb58785d52bb2a5f2bf152f6ead2edbc412a6a6efeab8",
    "issue92/4-online-actor-recruit-modal.png": "350d2f1fdc265444ae584e54448b54f7ec5bd2dc64dc15c46af5f6c6a3c7fafc",
    "issue92/5-online-waiting-view.png": "deafc69e935e7511ac5b3fb935b6fc499d85f77eb971694d64bade52c5485a8f"
  }
}
```

추가 검증 명령은 Orca 메시지의 additionalProbeCommand에 보존했다. in-memory 브라우저 도구 변형이며 제품·테스트 파일로 납품하지 않았다.
