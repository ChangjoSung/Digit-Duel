"use strict";
/* #245 정적 계약 검사 자체의 회귀 — "검사가 켜져 있고, 실제로 잡는가"를 본다.
   검사가 통과한다는 사실만으로는 계약이 살아 있다는 증거가 못 된다: 설정을 느슨하게 바꾸거나
   전부 any 로 만들어도 똑같이 통과한다. 그래서 여기서는 **일부러 틀린 코드**가 계약마다 실제로
   걸리는지와, 계약을 무력화하는 설정·억제 주석이 늘지 않았는지를 확인한다.

   Saturn REVISE: 음성 대조군이 **별도 파일**뿐이면 "선언이 존재한다"까지만 증명된다 — 실제 게임 코드가
   그 선언에 묶여 있는지는 별개 문제다. 그래서 3절에서 **진짜 소스(demo/js/*.js)를 변이시킨 사본**을
   같은 설정으로 다시 검사해, 변이한 그 줄이 실제로 진단을 받는지 본다. 저장소 파일은 건드리지 않는다.

   실행: node tools/typecheck/test/typecheck_test.js   (루트에서 `npm run test:typecheck`) */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const here = __dirname;                       // tools/typecheck/test
const tcDir = path.join(here, "..");          // tools/typecheck
const root = path.join(tcDir, "..", "..");    // 저장소 루트
const jsDir = path.join(root, "demo", "js");
let pass = 0, fail = 0;
function ok(value, name) { if (value) { pass++; } else { fail++; console.error("FAIL: " + name); } }

const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
ok(fs.existsSync(tsc), "typescript 가 루트 devDependency 로 설치돼 있다 (npm ci)");
const baseCfg = JSON.parse(fs.readFileSync(path.join(tcDir, "tsconfig.json"), "utf8"));

/** tsc 를 한 번 돌려 `error TS…` 줄만 돌려준다 (경로 구분자는 / 로 통일). */
function tscErrors(project) {
  const run = spawnSync(process.execPath, [tsc, "-p", project], { cwd: root, encoding: "utf8" });
  return ((run.stdout || "") + (run.stderr || "")).split(/\r?\n/)
    .filter(l => /error TS\d+/.test(l)).map(l => l.split("\\").join("/"));
}

// ── 1. 음성 대조군 — 계약마다 일부러 틀린 **별도 파일**이 걸려야 한다 ──────────
const negative = tscErrors(path.join(here, "tsconfig.negative.json"));

for (const contract of ["state", "action", "event", "protocol", "battle"]) {
  const hits = negative.filter(l => l.includes("negative/" + contract + ".js"));
  ok(hits.length > 0, "음성 대조군: " + contract + " 계약 위반이 tsc 에서 걸린다");
}
// 대조군 밖(실제 게임 코드)에서는 한 건도 나오지 않아야 한다 — 나오면 양성 검사가 이미 깨진 것이다.
ok(negative.every(l => l.includes("negative/")),
  "음성 대조군 실행에서 demo/js 쪽 오류는 0 이다 (양성 검사와 같은 설정)");

// 대조군 파일마다 **줄 단위로** 걸리는지 본다 — 한 줄만 걸리고 나머지가 조용하면 계약에 구멍이 있는 것이다.
for (const file of fs.readdirSync(path.join(here, "negative")).filter(f => f.endsWith(".js"))) {
  const src = fs.readFileSync(path.join(here, "negative", file), "utf8").split(/\r?\n/);
  const flagged = new Set(negative.filter(l => l.includes("negative/" + file))
    .map(l => Number((l.match(/\((\d+),/) || [])[1])));
  // 계약 위반을 적은 줄 = 주석(//)이 붙은 실행 줄. 그 줄이 전부 걸려야 한다.
  const expected = src.map((text, i) => ({ text, n: i + 1 }))
    .filter(x => /^\s{2}\S/.test(x.text) && /\/\/\s/.test(x.text) && !/^\s*\/\//.test(x.text));
  ok(expected.length > 0, file + ": 위반 줄이 실제로 들어 있다");
  const missed = expected.filter(x => !flagged.has(x.n));
  ok(missed.length === 0,
    file + ": 적어 둔 위반이 전부 걸린다" + (missed.length ? " (놓친 줄: " + missed.map(x => x.n).join(",") + ")" : ""));
}

// ── 2. 설정이 무력화되지 않았는가 ────────────────────────────────────────────
ok(baseCfg.compilerOptions.checkJs === true && baseCfg.compilerOptions.allowJs === true,
  "tsconfig 가 여전히 JS 를 검사한다 (allowJs·checkJs)");
ok(baseCfg.compilerOptions.noEmit === true, "검사 전용이다 — 산출물을 만들지 않는다");
ok(baseCfg.include.includes("../../demo/js/*.js"), "검사 대상이 demo/js 전체다");
ok(!baseCfg.exclude, "검사에서 빼 둔 파일이 없다");

const sources = fs.readdirSync(jsDir).filter(f => f.endsWith(".js"));
const suppressed = [];
for (const f of sources) {
  const lines = fs.readFileSync(path.join(jsDir, f), "utf8").split(/\r?\n/);
  ok(!lines.some(l => /@ts-nocheck/.test(l)), f + ": 파일 전체 검사 해제(@ts-nocheck)가 없다");
  lines.forEach((line, i) => {
    const m = line.match(/@ts-(ignore|expect-error)/);
    if (!m) return;
    // 억제 주석의 **정체**는 "그 주석이 무엇을 덮고 있는가" 다 — 바로 다음 비어 있지 않은 소스 줄로 고정한다.
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    suppressed.push({ file: f, kind: m[1], covers: (lines[j] || "").trim() });
  });
}
/* Saturn REVISE(LOW): 개수만 세면 한 건을 지우고 다른 곳에 한 건을 새로 다는 교체가 통과한다.
   지금 둘 다 network.js 의 **레거시 함수 선언 덮어쓰기**(ui-overlays.js 의 modal·render 재대입)뿐이고,
   둘 다 사유가 바로 윗줄 주석에 있다. 여기서는 파일·종류·덮는 구문까지 정확히 대조한다 —
   늘리거나 옮기려면 사유와 함께 이 표를 고쳐야 한다. */
const SUPPRESS_ALLOWED = [
  { file: "network.js", kind: "ignore", covers: "modal=function(html,buttons){" },
  { file: "network.js", kind: "ignore", covers: "render=_renderWithOverlays;" },
];
const key = s => s.file + " @ts-" + s.kind + " → " + s.covers;
const got = suppressed.map(key).sort(), want = SUPPRESS_ALLOWED.map(key).sort();
ok(got.length === want.length && got.every((v, i) => v === want[i]),
  "검사 억제 주석은 알려진 2건뿐이고 덮는 구문까지 그대로다 (실제: " + (got.join(" | ") || "없음") + ")");

// ── 3. 실제 소스 변이 — 게임 코드가 정말 계약에 묶여 있는가 ───────────────────
/* 선언이 존재한다는 사실과 **그 선언이 실제 코드에 걸려 있다**는 사실은 다르다.
   여기서는 demo/js 사본에 실제 오타·뒤바꿈을 넣고 같은 설정으로 다시 검사해, 변이한 그 줄이
   진단을 받는지 본다. 걸리지 않으면 그 경로는 계약 밖에 있는 것이다. 저장소 파일은 읽기만 한다.
   group: 같은 줄을 건드리는 변이끼리만 나눠 담는다 (tsc 실행 횟수 = group 수). */
const MUTATIONS = [
  // HIGH 1 — 전투 겨냥 문맥(BattleWire)의 네 칸이 실제 코드에 묶여 있는가
  { g: 1, file: "core.js", contract: "BattleWire side/phase 뒤바꿈",
    from: 'return B?{side:actorOfPhase(st),seq:B.actSeq||0,round:B.round,phase:B.phase}:null;',
    to:   'return B?{side:B.phase,seq:B.actSeq||0,round:B.round,phase:actorOfPhase(st)}:null;' },
  { g: 2, file: "core.js", contract: "BattleWire 칸 이름 오타(phase→phse)",
    from: 'return B?{side:actorOfPhase(st),seq:B.actSeq||0,round:B.round,phase:B.phase}:null;',
    to:   'return B?{side:actorOfPhase(st),seq:B.actSeq||0,round:B.round,phse:B.phase}:null;' },
  { g: 1, file: "core.js", contract: "actorOfPhase 가 A|D 가 아닌 값을 돌려줌",
    from: 'return B.phase===0 ? firstSide : (firstSide==="A"?"D":"A");',
    to:   'return B.phase;' },
  { g: 1, file: "network.js", contract: "applyAction → __actCore 인자 뒤바꿈 (kind ↔ wire)",
    from: 'case "act": if(window.__actCore) window.__actCore(a.k,a.bf); break;',
    to:   'case "act": if(window.__actCore) window.__actCore(a.bf,a.k); break;' },
  // HIGH 2 — recruit 토큰(문자열)과 상태 카운터(숫자)의 구분
  { g: 1, file: "core.js", contract: "recruit 토큰을 숫자 카운터로 발급",
    from: 'stage:"root",skill:null,targetId:null,recvId:null,token:p.id+"#"+next.recruitToken};',
    to:   'stage:"root",skill:null,targetId:null,recvId:null,token:next.recruitToken};' },
  { g: 1, file: "core.js", contract: "recruit 토큰 대조를 숫자 칸과 비교",
    from: 'if(action.token!==R.token) return {state,events:[]};',
    to:   'if(action.token!==R.pieceId) return {state,events:[]};' },
  /* #245 Saturn REVISE(M1): 탐색 보상 선택 창과 그 window 콜백은 표시 계층(ui.js)으로 옮겼다 — 변이 기준점도 그 파일이다 */
  { g: 1, file: "ui.js", contract: "__recruitCore 에 숫자 토큰을 넘김",
    from: 'window.__recruitCore("back",0,tk); return; } // #245 되돌림도 Core 가 소유한다 (표시 계층은 단계를 쓰지 않는다)',
    to:   'window.__recruitCore("back",0,0); return; } // #245 되돌림도 Core 가 소유한다 (표시 계층은 단계를 쓰지 않는다)' },
  // HIGH 3 — 이벤트 payload: 내보내는 쪽과 읽는 쪽 **둘 다**
  { g: 1, file: "core.js", contract: "이벤트 emit 칸 오타 (battleSlot.slot→slto)",
    from: '      if(slot!==null) return {state,events:[{type:"battleSlot",side,slot}]};',
    to:   '      if(slot!==null) return {state,events:[{type:"battleSlot",side,slto:slot}]};' },
  { g: 1, file: "core.js", contract: "이벤트 소비 칸 오타 (event.slot→event.slto)",
    from: '    case "battleSlot": execSlot(event.side,event.slot); return true;',
    to:   '    case "battleSlot": execSlot(event.side,event.slto); return true;' },
  { g: 1, file: "core.js", contract: "종전 개방 이벤트의 emit 칸 오타 (pkgOpenModal.owner→ownr)",
    from: 'events:[{type:"pkgOpenModal",kind:action.kind,owner:ownerP,round:B.round,id}]};',
    to:   'events:[{type:"pkgOpenModal",kind:action.kind,ownr:ownerP,round:B.round,id}]};' },
  { g: 1, file: "ui.js", contract: "종전 개방 이벤트의 소비 칸 오타 (event.owner→event.ownr)",
    from: 'if(event.type==="pkgOpenModal"){ pkgOpenModal(event.kind,event.owner,event.round,event.id); continue; }',
    to:   'if(event.type==="pkgOpenModal"){ pkgOpenModal(event.kind,event.ownr,event.round,event.id); continue; }' },
  // HIGH 4 — 권위 명령 봉투
  { g: 1, file: "network.js", contract: "명령 이름 오타 (ready→ready_typo)",
    from: '  netSendCmd("ready");',
    to:   '  netSendCmd("ready_typo");' },
  { g: 1, file: "network.js", contract: "action 봉투에서 baseRevision 누락",
    from: 'netSendCmd("action",{baseRevision:NET.revision,action:a});',
    to:   'netSendCmd("action",{action:a});' },
  { g: 1, file: "network.js", contract: "credential 없는 명령 봉투 송신",
    from: 'NET.roomsLoading=true; render(); netSend({v:1,t:"list_rooms"}); return; }\n  if(m.type==="lobby_rooms")',
    to:   'NET.roomsLoading=true; render(); netSend({v:1,t:"ready"}); return; }\n  if(m.type==="lobby_rooms")' },
  // MEDIUM — 전투·탐색 보상 상태
  { g: 1, file: "core.js", contract: "전투 상태에 없는 칸 쓰기 (B.pkgSel→B.pkgSell)",
    from: '  B.pkgSel=null; // #121:',
    to:   '  B.pkgSell=null; // #121:' },
  { g: 1, file: "data.js", contract: "전투 상태에 없는 칸 읽기 (B.maxRounds→B.maxRoundz)",
    from: 'function battleMaxRounds(state){ const B=(state||S).battle; return (B&&B.maxRounds)||BAL.maxRounds; }',
    to:   'function battleMaxRounds(state){ const B=(state||S).battle; return (B&&B.maxRoundz)||BAL.maxRounds; }' },
  { g: 1, file: "core.js", contract: "탐색 보상 상태에 없는 칸 읽기 (R.stage→R.stagee)",
    from: 'if(!RECRUIT_STAGES.has(R.stage)) return null;',
    to:   'if(!RECRUIT_STAGES.has(R.stagee)) return null;' },
];

const mutTmp = fs.mkdtempSync(path.join(os.tmpdir(), "dd245-mut-"));
try {
  for (const g of [...new Set(MUTATIONS.map(m => m.g))].sort()) {
    const batch = MUTATIONS.filter(m => m.g === g);
    const dir = path.join(mutTmp, "g" + g);
    fs.mkdirSync(dir);
    const expected = [];
    for (const f of sources) {
      let src = fs.readFileSync(path.join(jsDir, f), "utf8");
      for (const m of batch.filter(x => x.file === f)) {
        const at = src.indexOf(m.from);
        ok(at >= 0 && src.indexOf(m.from, at + 1) < 0, "변이 기준점이 " + f + " 에 정확히 1곳 있다: " + m.contract);
        if (at < 0) continue;
        src = src.slice(0, at) + m.to + src.slice(at + m.from.length);
        expected.push({ m, line: src.slice(0, at).split("\n").length });
      }
      fs.writeFileSync(path.join(dir, f), src);
    }
    const project = path.join(dir, "tsconfig.json");
    // 설정은 **양성 검사와 같은 것**을 그대로 쓴다 (읽어서 옮긴다 — 여기만 느슨해지는 일이 없게)
    fs.writeFileSync(project, JSON.stringify({
      compilerOptions: baseCfg.compilerOptions,
      include: [path.join(tcDir, "env.d.ts"), path.join(tcDir, "contracts.d.ts"), path.join(dir, "*.js")],
    }));
    const errs = tscErrors(project);
    for (const e of expected) {
      const hit = errs.some(l => l.includes("/" + e.m.file + "(" + e.line + ","));
      ok(hit, "실제 소스 변이가 걸린다 — " + e.m.file + ":" + e.line + " " + e.m.contract);
    }
  }
} finally {
  fs.rmSync(mutTmp, { recursive: true, force: true });
}

// ── 4. 클라이언트 ↔ 서버 액션 어휘 대조 ───────────────────────────────────────
/* 서버 protocol.js 의 ACTION_TYPES 는 "회선으로 받아 주는 액션"이고, 클라이언트 계약의 t 는 "재생할 수 있는 액션"이다.
   서버가 받아 놓고 클라이언트가 모르는 어휘가 생기면 그 프레임은 조용히 아무 일도 하지 않는다 — 그 어긋남을 여기서 본다.
   (읽기만 한다. 서버 파일은 이 작업의 편집 범위 밖이다.) */
const contracts = fs.readFileSync(path.join(tcDir, "contracts.d.ts"), "utf8");
/** `type X = …` 선언 한 덩어리(들여쓴 줄 전부)를 돌려준다 — 중간 주석에서 끊기지 않게 "들여쓰기"로 자른다. */
function declBlock(typeName) {
  const all = contracts.split(/\r?\n/);
  const start = all.findIndex(l => l.startsWith("type " + typeName + " ="));
  ok(start >= 0, "contracts.d.ts 에 " + typeName + " 선언이 있다");
  const lines = [all[start]];
  for (let i = start + 1; i < all.length && (!all[i].trim() || /^\s/.test(all[i])); i++) lines.push(all[i]);
  return lines;
}
function actionNames(typeName) {
  return declBlock(typeName).map(l => (l.match(/\{\s*t:\s*"([^"]+)"/) || [])[1]).filter(Boolean);
}

const clientVocab = new Set([...actionNames("CoreAction"), ...actionNames("NetOnlyAction")]);
ok(clientVocab.size > 20, "클라이언트 액션 어휘를 읽어 냈다 (" + clientVocab.size + "종)");
const server = require(path.join(root, "server", "authoritative", "protocol.js"));
const orphan = [...server.ACTION_TYPES].filter(t => !clientVocab.has(t));
ok(orphan.length === 0, "서버가 받는 액션 어휘가 전부 클라이언트 계약에 있다 (미아: " + orphan.join(",") + ")");
/* 명령 어휘도 같은 이유로 대조한다 — 봉투 유니온(NetCommandFrame)이 서버 COMMAND_TYPES 를 전부 덮어야
   "보낼 수는 있는데 타입엔 없는" 명령이 생기지 않는다. */
const cmdVocab = new Set(declBlock("NetCommandFrame").join("\n").match(/"[^"]+"/g).map(s => s.slice(1, -1)));
const cmdOrphan = [...server.COMMAND_TYPES].filter(t => !cmdVocab.has(t));
ok(cmdOrphan.length === 0, "서버가 받는 명령 어휘가 전부 봉투 계약에 있다 (미아: " + cmdOrphan.join(",") + ")");

console.log((fail ? "FAIL" : "PASS") + " typecheck_test: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
