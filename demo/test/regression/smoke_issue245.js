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
/* #245 평이동: 빈 칸으로의 합법 1칸 이동만 Core 가 소유하고, 왕 끝줄·BT 2칸·신규 접촉·전투 슬롯은 레거시로 떨어진다 */
const moveState=H.freshPlay(T,"pvp"); H.clearBoard(T);
const mover=T.S.pieces.find(piece=>piece.owner===0&&piece.type==="minion"), foe=T.S.pieces.find(piece=>piece.owner===1&&piece.type==="minion");
const myKing=T.S.pieces.find(piece=>piece.owner===0&&piece.type==="king"), foeKing=T.S.pieces.find(piece=>piece.owner===1&&piece.type==="king");
H.place(T,mover,12,4); H.place(T,myKing,13,1); H.place(T,foeKing,1,7);
moveState.current=0; moveState.mainUsed=false; moveState.events=[]; moveState.selected=mover;
const moveResult=T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:11,c:4}), movedPiece=moveResult.state.pieces.find(piece=>piece.id===mover.id);
ok(mover.r===12&&mover.c===4&&mover.movedEver===false&&moveState.mainUsed===false&&moveState.movedPiece===null&&moveState.contactSet.length===0&&moveState.pieces.includes(mover),"move reducer leaves the input piece, main-action flag and contact record untouched");
ok(movedPiece!==mover&&movedPiece.r===11&&movedPiece.c===4&&movedPiece.movedEver===true&&moveResult.state.mainUsed===true&&moveResult.state.contactKind==="move"&&moveResult.state.movedPiece===movedPiece&&moveResult.state.selected===movedPiece&&moveResult.state.contactSet.length===0,"move reducer returns the step, main-action flag and contact record on a cloned piece");
ok(moveResult.events.length===1&&moveResult.events[0].type==="moved"&&moveResult.events[0].piece===movedPiece&&moveResult.events[0].trace===false&&moveResult.events[0].healBroken===false,"move reducer emits one moved event carrying the piece that lives in the returned state");
moveState.events=[{r:11,c:4,kind:"itemGift",consumed:false}];
const traceResult=T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:11,c:4});
ok(!moveState.traces[0].has("11_4")&&traceResult.state.traces!==moveState.traces&&traceResult.state.traces[0].has("11_4")&&traceResult.state.traces[1]===moveState.traces[1]&&traceResult.events[0].trace===true,"move reducer records a discovered trace on a cloned set only");
moveState.events=[];
const bomb=T.S.pieces.find(piece=>piece.owner===0&&piece.type==="bomb"); H.place(T,bomb,12,2);
const bombResult=T.reduceCoreAction(moveState,{t:"move",id:bomb.id,r:11,c:2});
ok(moveState.metrics.bombMoves===0&&bombResult.state.metrics!==moveState.metrics&&bombResult.state.metrics.bombMoves===1&&bombResult.state.metrics.byPlayer[0].bombMoves===1,"move reducer counts a bomb step on cloned metrics only");
ok(T.reduceCoreAction(moveState,{t:"move",id:myKing.id,r:12,c:1})===null,"a king step stays on the legacy path (edge-reach win)");
moveState.turnCount=T.BAL.burnStart-1;
const twoStep=T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:10,c:4}), twoStepPiece=twoStep&&twoStep.state.pieces.find(piece=>piece.id===mover.id);
ok(T.isBurning()&&mover.r===12&&mover.c===4&&twoStepPiece!==mover&&twoStepPiece.r===10&&twoStepPiece.c===4&&twoStep.state.contactKind==="move"&&twoStep.state.tempReveal===moveState.tempReveal&&twoStep.events[0].collision===false,"a burning-time two-step over an empty midpoint lands on the endpoint in Core without touching its input");
moveState.turnCount=0;
moveState.battlesUsed=1; ok(T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:11,c:4})===null,"a step in a turn that already spent a battle slot stays on the legacy path"); moveState.battlesUsed=0;
/* #245 신규 접촉: 강제 전투 대상 확정까지 Core 가 소유하고, 전투 개시만 표시 단계(forcedContactStart)에 남는다 */
H.place(T,foe,10,4); moveState.selected=mover;
const contact=T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:11,c:4}), contactPiece=contact&&contact.state.pieces.find(piece=>piece.id===mover.id);
ok(moveState.forcedTargets.length===0&&moveState.selected===mover&&mover.r===12&&foe.r===10,"contact move reducer leaves the input forced targets, selection and pieces untouched");
ok(JSON.stringify(contact.state.forcedTargets)===JSON.stringify([foe.id])&&contact.state.movedPiece===contactPiece&&contact.state.selected===contactPiece&&contact.state.contactSet.includes(foe.id)&&JSON.stringify(contact.events[0].forced)===JSON.stringify([foe.id]),"contact move reducer returns the forced target on the cloned state and carries it on the moved event");
const foe2=T.S.pieces.filter(piece=>piece.owner===1&&piece.type==="minion")[1]; H.place(T,foe2,11,5);
const multi=T.reduceCoreAction(Object.assign({},moveState,{selected:null}),{t:"move",id:mover.id,r:11,c:4});
ok(multi.state.forcedTargets.length===2&&multi.state.selected===multi.state.pieces.find(piece=>piece.id===mover.id)&&multi.events[0].forced.length===2,"two new contacts keep the moved piece selected for the pick, as the legacy path did");
/* #245 숲 충돌: 도착 칸의 숨은 말 → 경유 칸 정지 · 양측 일시 공개 · 신규 접촉까지 Core 가 소유한다 (#104 D2 와 같은 상황) */
foe2.placed=false;
moveState.turnCount=T.BAL.burnStart-1;
const collide=T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:10,c:4}), collidePiece=collide&&collide.state.pieces.find(piece=>piece.id===mover.id);
ok(mover.r===12&&mover.c===4&&mover.movedEver===false&&moveState.tempReveal.size===0&&moveState.contactKind==="move"&&moveState.forcedTargets.length===0,"forest collision reducer leaves the input piece, temporary reveal set and contact record untouched");
ok(collidePiece.r===11&&collidePiece.c===4&&collidePiece.movedEver===true&&collide.state.mainUsed===true&&collide.state.contactKind==="collision"&&collide.state.tempReveal!==moveState.tempReveal&&collide.state.tempReveal.has(foe.id)&&collide.state.tempReveal.has(mover.id),"forest collision stops on the midpoint and temporarily reveals both pieces on a cloned set");
ok(collide.events.length===1&&collide.events[0].collision===true&&collide.events[0].trace===false&&JSON.stringify(collide.events[0].forced)===JSON.stringify([foe.id])&&JSON.stringify(collide.state.forcedTargets)===JSON.stringify([foe.id])&&collide.state.contactSet.includes(foe.id),"the collision emits one moved event carrying the collision flag and the new forced contact");
moveState.turnCount=0;
moveState.mainUsed=true;
ok(T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:12,c:5})===null,"move reducer refuses a step once the main action is spent (canMoveTo stays the only gate)");
moveState.mainUsed=false;
ok(T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:12,c:5})!==null&&T.reduceCoreAction(moveState,{t:"move",id:9999,r:12,c:5})===null&&T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:9,c:4})===null,"move reducer accepts a legal empty step and refuses an unknown id or an illegal distance");
foe.placed=false;
T.doMove(mover,11,4);
ok(T.at(11,4)===mover&&mover.r===11&&mover.movedEver===true&&T.S.mainUsed===true&&T.S.movedPiece===mover&&T.S.selected===mover&&T.S.contactKind==="move","doMove commits the Core step onto the same piece object the UI, AI and replay callers hold");
/* #245 commit 경계: Core 이벤트에 실린 말도 commit 후 S.pieces 의 그 객체다 — UI 핸들러가 떨어진 복제본을 보지 않는다 */
T.S.mainUsed=false; const commitMove=T.reduceCoreAction(T.S,{t:"move",id:mover.id,r:10,c:4}); T.commitCoreState(commitMove.state,commitMove.events);
T.S.mainUsed=false; const commitHeal=T.reduceCoreAction(T.S,{t:"heal",id:mover.id}); T.commitCoreState(commitHeal.state,commitHeal.events);
ok(commitMove.events[0].piece===mover&&commitHeal.events[0].piece===mover&&T.S.pieces.includes(mover)&&T.S.movedPiece===mover&&mover.r===10&&mover.healing===true,"commit canonicalizes the piece carried by the moved and healStarted events onto the S.pieces object");
T.S.mainUsed=false; T.doMove(myKing,12,1);
ok(myKing.r===12&&myKing.c===1&&T.at(12,1)===myKing&&T.S.movedPiece===myKing&&T.S.mainUsed===true,"a king step still resolves through the legacy path with the same piece object");
/* #245 신규 접촉 end-to-end: 대상은 Core 가 commit 하고 전투 개시는 표시 단계의 레거시 initBattle 이 그대로 한다 */
T.S.mainUsed=false; T.S.battlesUsed=0; T.S.forcedTargets=[]; T.S.movedPiece=null; T.S.battle=null; T.S.current=0; mover.healing=false;
H.place(T,mover,12,4); H.place(T,foe,10,4); T.S.selected=mover;
T.doMove(mover,11,4);
ok(mover.r===11&&T.S.movedPiece===mover&&T.S.contactSet.includes(foe.id)&&!!T.S.battle&&T.S.battle.attP===mover&&T.S.battle.defP===foe&&T.S.forcedTargets.length===0&&T.S.metrics.forcedBattles===1,"doMove commits the forced contact and the legacy battle initiation still consumes it on the same piece objects");
/* #245 숲 충돌 end-to-end: 정지 위치·일시 공개까지 Core 가 commit 하고 문구·전투 개시는 표시 단계가 그대로 한다 */
T.S.battle=null; T.S.battlesUsed=0; T.S.mainUsed=false; T.S.forcedTargets=[]; T.S.movedPiece=null; T.S.tempReveal.clear(); T.S.turnCount=T.BAL.burnStart-1;
H.place(T,mover,12,4); H.place(T,foe,10,4); T.S.selected=mover; mover.healing=false;
T.doMove(mover,10,4);
ok(mover.r===11&&mover.c===4&&T.at(11,4)===mover&&T.S.contactKind==="collision"&&T.S.tempReveal.has(foe.id)&&T.S.tempReveal.has(mover.id)&&T.S.movedPiece===mover&&!!T.S.battle&&T.S.battle.defP===foe,"doMove commits the collision stop, the temporary reveal and the forced battle on the same piece objects");
T.S.turnCount=0; T.S.battle=null; T.S.battlesUsed=0; foe.placed=false;
ok((T.html.match(/이동 중 숨은 말과 충돌! 위치가 일시 공개되었습니다\./g)||[]).length===1&&/if\(event\.collision\) collisionLog\(event\.piece\)/.test(T.html)&&/^\s*collisionLog\(p\);$/m.test(T.html),"the collision notice lives in one helper shared by the Core event and the legacy path");
ok(/forcedContactStart\(event\.piece,event\.forced\)/.test(T.html)&&(T.html.match(/신규 인접 — 강제 전투/g)||[]).length===1&&(T.html.match(/initBattle\(p,def\)/g)||[]).length===1,"forced contact display and battle initiation stay in one helper shared by the Core event and the legacy path");
ok(/function doMove\(p,r,c\)\{ if\(p&&dispatchCoreAction\(\{t:"move",id:p\.id,r,c\}\)\) return; doMoveLegacy\(p,r,c\); \}/.test(T.html),"UI, AI and network replay share one canonical move entry point");
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
