"use strict";
const fs=require("fs");
const path=require("path");
const {execFileSync}=require("child_process");
const H=require("../shared/harness");
const {lockstepDigest}=require("../../../server/authoritative/room");

const demo=path.join(__dirname,"..","..");
const index=path.join(demo,"index.html");
const html=fs.readFileSync(index,"utf8");
const expected=["data.js","state.js","ui.js","core.js","ai.js","ui-overlays.js","network.js","bootstrap.js"];
let pass=0,fail=0;
function ok(value,name){ if(value) pass++; else { fail++; console.error("FAIL: "+name); } }

const scripts=[...html.matchAll(/<script\s+src="js\/([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
ok(JSON.stringify(scripts)===JSON.stringify(expected),"scripts load once in dependency order");
ok(/<link rel="stylesheet" href="css\/game\.css">/.test(html),"stylesheet is external");
ok(!/<style>|<script>(?![\s\S]*src=)/.test(html),"entry document has no inline CSS or JavaScript");
ok(expected.every(name=>fs.existsSync(path.join(demo,"js",name))),"all JavaScript files exist");
ok(fs.existsSync(path.join(demo,"css","game.css")),"stylesheet exists");

const T=H.load(index);
ok(typeof T.newGame==="function"&&typeof T.netConnect==="function","combined source executes in the test harness");
ok(typeof T.reduceCoreAction==="function"&&typeof T.dispatchCoreAction==="function","Core action boundary is exposed");
const input={current:1,mainUsed:false,selected:{id:7},teleport:null};
const reduced=T.reduceCoreAction(input,{t:"skipMain",origin:"ai"});
ok(input.mainUsed===false&&reduced.state!==input&&reduced.state.mainUsed===true&&reduced.events[0].type==="mainSkipped","Core reducer is pure and returns a semantic event");
T.newGame("pvp");
const rosterBefore=T.S.roster[0].slice(), piecesBefore=T.S.pieces.map(piece=>({placed:piece.placed,rosterId:piece.rosterId}));
const rosterResult=T.reduceCoreAction(T.S,{t:"roster",rid:"M-F1"});
ok(JSON.stringify(T.S.roster[0])===JSON.stringify(rosterBefore)&&JSON.stringify(T.S.pieces.map(piece=>({placed:piece.placed,rosterId:piece.rosterId})))===JSON.stringify(piecesBefore)&&rosterResult.state.roster[0][0]==="M-F1","setup roster reducer leaves its nested input unchanged");
const setupState=Object.assign({},T.S,{selected:{tray:true,id:T.S.pieces[0].id}}), cellResult=T.reduceCoreAction(setupState,{t:"cell",r:11,c:1});
ok(!setupState.pieces[0].placed&&cellResult.state.pieces[0].placed&&cellResult.state.pieces[0].r===11&&cellResult.state.selected===null,"setup cell reducer places a cloned piece without mutating its input");
const badCells=[{r:"11",c:1},{r:11.5,c:1},{r:11,c:"1"},{r:11,c:1.5},{r:11,c:0},{r:11,c:99},{r:1,c:1}];
ok(badCells.every(cell=>T.reduceCoreAction(setupState,{t:"cell",r:cell.r,c:cell.c}).state.pieces.every(piece=>!piece.placed)),"setup cell reducer stores no string, fractional or out-of-range coordinate");
ok(T.reduceCoreAction(Object.assign({},setupState,{selected:{tray:true,id:-1}}),{t:"cell",r:11,c:1}).state.pieces.every(piece=>!piece.placed),"setup cell reducer ignores a tray selection with an unknown piece id");
T.setSeed(245); const autoAction=T.resolveCoreAction(T.S,{t:"auto"}), autoResult=T.reduceCoreAction(T.S,autoAction);
ok(T.S.roster[0].length===0&&T.S.pieces.every(piece=>!piece.placed)&&autoResult.state.roster[0].length===6&&autoResult.state.pieces.filter(piece=>piece.owner===0&&piece.placed).length===14,"resolved auto-placement action is applied without mutating its input");
const confirmResult=T.reduceCoreAction(autoResult.state,{t:"setupConfirm",preparing:false,publicMode:false});
ok(autoResult.state.setupPlayer===0&&confirmResult.state.setupPlayer===1&&confirmResult.events[0].type==="setupHandoff","setup confirmation returns the next player and handoff event without mutating its input");
const bothPlaced=(()=>{ const s=Object.assign({},autoResult.state,{setupPlayer:1}); return T.reduceCoreAction(s,T.resolveCoreAction(s,{t:"auto"})).state; })();
ok(T.reduceCoreAction(bothPlaced,{t:"setupConfirm",preparing:false,publicMode:false}).events[0].type==="setupBegin","hotseat PVP confirmation by the second player begins play");
ok(T.reduceCoreAction(Object.assign({},autoResult.state,{mode:"pve"}),{t:"setupConfirm",preparing:false,publicMode:false}).events[0].type==="setupAiBegin","PVE confirmation hands placement to the AI");
const netEvent=T.reduceCoreAction(autoResult.state,{t:"setupConfirm",preparing:true,publicMode:true}).events[0];
ok(netEvent.type==="setupNetworkReady"&&netEvent.publicMode===true&&netEvent.setup.roster.length===6&&netEvent.setup.pos.length===14&&T.reduceCoreAction(autoResult.state,{t:"setupConfirm",preparing:true,publicMode:false}).events[0].publicMode===false,"network confirmation captures the setup once for both public and matchmaking rooms");
ok(T.reduceCoreAction(T.S,{t:"setupConfirm",preparing:false,publicMode:false}).events[0].type==="toast","incomplete setup confirmation only warns");
/* #245 텔레포트 대상 선택: 단계 전이·함정 거부는 Core 가 소유하고, 둘째 말(스왑 실행)만 onCellCore 로 떨어진다 */
const teleBase={phase:"play",mode:"pvp",current:0,battle:null,fleePick:null,teleport:{stage:1,piece:null},
  pieces:[{id:1,owner:0,alive:true,placed:true,r:7,c:4,immobile:0},{id:2,owner:0,alive:true,placed:true,r:7,c:5,immobile:2},{id:3,owner:0,alive:true,placed:true,r:7,c:6,immobile:0}]};
const telePick=T.reduceCoreAction(teleBase,{t:"cell",r:7,c:4}), teleStage2=Object.assign({},teleBase,{teleport:{stage:2,piece:teleBase.pieces[0]}});
ok(teleBase.teleport.stage===1&&telePick.state.teleport.stage===2&&telePick.state.teleport.piece===teleBase.pieces[0]&&T.reduceCoreAction(teleStage2,{t:"cell",r:7,c:4}).state.teleport.stage===1,"teleport pick reducer advances and cancels the stage without mutating its input");
const teleTrapped=T.reduceCoreAction(teleStage2,{t:"cell",r:7,c:5});
ok(teleTrapped.state===teleStage2&&teleTrapped.events[0].type==="teleTrapped"&&T.reduceCoreAction(teleStage2,{t:"cell",r:7,c:6})===null,"a trapped piece is refused in Core with the stage kept, and only the swap click falls through");
/* #245 자기 말 선택: Core 가 소유하고, 강제 전투 대상·상대 말·빈 칸 클릭만 onCellCore 로 떨어진다 */
const selBase=Object.assign({},teleBase,{teleport:null,selected:null,forcedTargets:[]}), selPick=T.reduceCoreAction(selBase,{t:"cell",r:7,c:4});
ok(selBase.selected===null&&selPick.state.selected===selBase.pieces[0]&&selPick.events[0].type==="render"&&T.reduceCoreAction(selBase,{t:"cell",r:9,c:9})===null,"own-piece selection reducer keeps its input and drops non-own and empty clicks");
/* #245 회복 주 행동: 검증·자세·지표는 Core 가 소유하고 표시는 healStarted 이벤트로만 나간다 */
const healBase={phase:"play",mode:"pvp",current:0,mainUsed:false,teleport:null,fleePick:null,forcedTargets:[],metrics:{heals:0,byPlayer:[{},{}]},
  pieces:[{id:1,owner:0,alive:true,placed:true,type:"minion",healing:false},{id:2,owner:1,alive:true,placed:true,type:"minion",healing:false}]};
healBase.selected=healBase.pieces[0];
const healResult=T.reduceCoreAction(healBase,{t:"heal",id:1}), healPiece=healResult.state.pieces[0];
ok(healBase.mainUsed===false&&healBase.selected===healBase.pieces[0]&&healBase.pieces[0].healing===false&&healBase.metrics.heals===0&&healBase.metrics.byPlayer[0].heals===undefined,"heal reducer leaves the input piece, metrics, selection and main-action flag untouched");
ok(healResult.state.mainUsed===true&&healResult.state.selected===null&&healPiece.healing===true&&healPiece!==healBase.pieces[0]&&healResult.state.pieces[1]===healBase.pieces[1]&&healResult.state.metrics.heals===1&&healResult.state.metrics.byPlayer[0].heals===1&&healResult.state.metrics.byPlayer[1]!==healBase.metrics.byPlayer[1],"heal reducer returns the posture, metric and scalar updates on cloned pieces and metrics only");
ok(healResult.events.length===1&&healResult.events[0].type==="healStarted"&&healResult.events[0].piece===healPiece,"heal reducer emits one healStarted carrying the piece that lives in the returned state");
ok(T.reduceCoreAction(healResult.state,{t:"heal",id:1})===null&&T.reduceCoreAction(healBase,{t:"heal",id:2})===null&&T.reduceCoreAction(healBase,{t:"heal",id:99})===null&&T.reduceCoreAction(Object.assign({},healBase,{battle:{}}),{t:"heal",id:1})===null,"heal reducer refuses a spent main action, an opponent piece, an unknown id and a battle in progress");
ok(!/case\s*"heal"/.test(fs.readFileSync(path.join(demo,"js","network.js"),"utf8")),"network replay has no second heal path");
ok(!/S\.(teleport|selected)\s*=/.test(T.html.slice(T.html.indexOf("function onCellCore"),T.html.indexOf("function observeMove"))),"onCellCore no longer assigns the teleport pick or selection state directly");
ok((T.html.match(/<script>/g)||[]).length===1&&!T.html.includes('<script src='),"harness exposes one compatible inline script");
ok(T.html.includes("<style>")&&T.html.includes("</style>"),"harness exposes compatible inline CSS");
let blocked=false;
try { H.load(index,{html:'<script src="../package.json"></script>'}); } catch(error) { blocked=/escapes demo root/.test(error.message); }
ok(blocked,"harness rejects asset traversal");

let baseHtml=null;
try { baseHtml=execFileSync("git",["show","9853a2c:demo/index.html"],{cwd:path.resolve(demo,".."),maxBuffer:1<<26}).toString("utf8"); }
catch(error) { console.error(error.message); }
ok(!!baseHtml,"pre-split baseline source is available");
if(baseHtml){
  const setupTrace=opts=>{
    const X=H.load(index,opts); X.setSeed(245); X.newGame("pvp"); X.autoPlaceCore();
    return JSON.stringify({roster:X.S.roster,pieces:X.S.pieces.map(piece=>[piece.id,piece.r,piece.c,piece.placed,piece.rosterId,piece.element,piece.hp,piece.atk])});
  };
  ok(setupTrace({html:baseHtml})===setupTrace({}),"resolved auto-placement matches the pre-split setup state");
  const trace=(opts,seed)=>{
    const X=H.load(index,opts), stateTrace=[];
    const result=H.runSim(X,["grade5","grade5"],seed,{cap:3000000,trace:Y=>stateTrace.push(lockstepDigest(Y))});
    return JSON.stringify({stateTrace,digest:lockstepDigest(X),snapshot:result.snap,winner:result.winner,phase:result.phase,turns:result.turns,winType:result.winType,steps:result.steps,viol:result.viol});
  };
  for(const seed of [24501,24502]) ok(trace({html:baseHtml},seed)===trace({},seed),"seed "+seed+" snapshot/digest/winner matches the pre-split baseline");
}

console.log(`\n=== smoke_issue245: pass ${pass} / fail ${fail} ===`);
if(fail) process.exit(1);
