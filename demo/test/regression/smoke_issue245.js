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
/* #245 이동: 합법 이동(1칸·BT 직선 2칸·숲 충돌 정지)과 그 이동이 만든 신규 접촉까지 Core 가 소유하고, 왕 끝줄 도달·전투 슬롯이 걸린 턴만 레거시로 떨어진다 */
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
/* #245 상태 순수성(이동): 위 단언들은 moveState 가 T.S 그 자체라 둘이 같을 때만 본다.
   여기서는 말 객체까지 전역 S 와 완전히 분리한 보드를 넘기고 S 만 적대적으로 어긋나게 둔다 — 온라인 재생·AI 탐색 경로 */
const purePieces=[{id:901,owner:0,type:"minion",alive:true,placed:true,r:12,c:4,immobile:0,movedEver:false,movedPreBT:false,healing:false,revealed:false},
  {id:902,owner:1,type:"minion",alive:true,placed:true,r:10,c:4,immobile:0,movedEver:false,movedPreBT:false,healing:false,revealed:false}];
const pureState={phase:"play",mode:"pvp",current:0,mainUsed:false,battle:null,teleport:null,fleePick:null,battlesUsed:0,firstBattleWonByMover:false,
  forcedTargets:[],forcedQueue:[],turnCount:0,selected:purePieces[0],movedPiece:null,contactSet:[],contactKind:null,pieces:purePieces,
  events:[],tempReveal:new Set(),traces:[new Set(),new Set()],aiSeenMoved:[new Set(),new Set()],metrics:{minionInvades:0,byPlayer:[{},{}]}};
const moveDigest=r=>JSON.stringify(r&&{ev:r.events.map(e=>e.type),forced:r.events[0].forced,collision:r.events[0].collision,trace:r.events[0].trace,
  healBroken:r.events[0].healBroken,main:r.state.mainUsed,kind:r.state.contactKind,targets:r.state.forcedTargets,contact:r.state.contactSet,
  sel:r.state.selected&&r.state.selected.id,same:r.state.selected===r.state.movedPiece,reveal:[...r.state.tempReveal],
  seen:r.state.aiSeenMoved.map(x=>[...x]),traces:r.state.traces.map(x=>[...x]),metrics:r.state.metrics,
  where:r.state.pieces.map(piece=>[piece.id,piece.r,piece.c,piece.movedEver,piece.movedPreBT,piece.healing])});
const moveAgreed=moveDigest(T.reduceCoreAction(pureState,{t:"move",id:901,r:11,c:4}));
const liveMove={pieces:T.S.pieces,phase:T.S.phase,current:T.S.current,mainUsed:T.S.mainUsed,turnCount:T.S.turnCount,
  battlesUsed:T.S.battlesUsed,forcedTargets:T.S.forcedTargets,movedPiece:T.S.movedPiece,contactSet:T.S.contactSet,tempReveal:T.S.tempReveal};
T.S.pieces=purePieces.map(piece=>Object.assign({},piece,{r:11,c:4,owner:1})); T.S.phase="setup"; T.S.current=1; T.S.mainUsed=true;
T.S.turnCount=T.BAL.burnStart; T.S.battlesUsed=2; T.S.forcedTargets=[999]; T.S.movedPiece=null; T.S.contactSet=[]; T.S.tempReveal=new Set([901,902]);
const moveHostile=T.reduceCoreAction(pureState,{t:"move",id:901,r:11,c:4}), hostileDigest=moveDigest(moveHostile);
Object.assign(T.S,liveMove);
const purePiece=moveHostile&&moveHostile.state.pieces.find(piece=>piece.id===901);
ok(hostileDigest===moveAgreed&&!!moveHostile&&purePiece!==purePieces[0]&&purePiece.r===11&&purePiece.c===4&&purePiece.movedEver===true&&purePiece.movedPreBT===true&&moveHostile.state.pieces[1]===purePieces[1],"move reducer reads the board, turn and burning time from its state argument only, so a hostile global S still produces the same step");
ok(!!moveHostile&&moveHostile.state.mainUsed===true&&moveHostile.state.contactKind==="move"&&moveHostile.state.selected===purePiece&&moveHostile.state.movedPiece===purePiece&&JSON.stringify(moveHostile.state.forcedTargets)===JSON.stringify([902])&&JSON.stringify(moveHostile.state.contactSet)===JSON.stringify([902])&&moveHostile.state.tempReveal===pureState.tempReveal&&moveHostile.state.metrics===pureState.metrics&&moveHostile.state.traces===pureState.traces,"the hostile-S step keeps the contact, selection, reveal, metric and trace contract of the given state");
ok(!!moveHostile&&moveHostile.state.aiSeenMoved!==pureState.aiSeenMoved&&moveHostile.state.aiSeenMoved[1].has(901)&&pureState.aiSeenMoved[1].size===0&&moveHostile.events.length===1&&moveHostile.events[0].type==="moved"&&moveHostile.events[0].collision===false&&moveHostile.events[0].trace===false&&JSON.stringify(moveHostile.events[0].forced)===JSON.stringify([902]),"the hostile-S observation is recorded on a cloned set and one moved event carries the new contact");
ok(pureState.mainUsed===false&&pureState.selected===purePieces[0]&&pureState.movedPiece===null&&pureState.contactSet.length===0&&pureState.forcedTargets.length===0&&purePieces[0].r===12&&purePieces[0].c===4&&purePieces[0].movedEver===false,"the independent input state and its piece graph stay untouched under a hostile global S");
/* #245 텔레포트 스왑: 재검사·차단·위치 교환·자원·지표·흔적·회복 자세와 교환 직후의 강제 전투 큐 적재·첫 항목 승격까지 Core 가 소유하고,
   문구·배너·전투 개시는 teleSwapped 이벤트가 레거시 헬퍼(forcedContactStart)로 넘긴다. 왕이 섞인 교환만 레거시(끝줄 도달 즉시 승리)다 */
const swapState=H.freshPlay(T,"pvp"); H.clearBoard(T);
const sMine=T.S.pieces.filter(piece=>piece.owner===0&&piece.type==="minion"), sFoe=T.S.pieces.filter(piece=>piece.owner===1&&piece.type==="minion");
const sa=sMine[0], sb=sMine[1], sd=sFoe[0], se=sFoe[1], sf=sFoe[2];
const sKing=T.S.pieces.find(piece=>piece.owner===0&&piece.type==="king");
H.place(T,sKing,13,1); H.place(T,T.S.pieces.find(piece=>piece.owner===1&&piece.type==="king"),1,7);
H.place(T,sa,2,2); H.place(T,sb,12,4); // sa 가 상대 진영(1~3행)에 있어야 텔레포트가 가용하다
swapState.current=0; swapState.mainUsed=false; swapState.battlesUsed=0; swapState.teleport={stage:2,piece:sa}; swapState.events=[];
const swapNone=T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:sb});
ok(sa.r===2&&sa.c===2&&sb.r===12&&sb.c===4&&swapState.mainUsed===false&&swapState.teleUsed[0]===0&&swapState.metrics.teleports===0&&swapState.teleport.stage===2&&swapState.pieces.includes(sa),"teleport swap reducer leaves the input pieces, resources, metrics and pick stage untouched");
const na=swapNone.state.pieces.find(piece=>piece.id===sa.id), nb=swapNone.state.pieces.find(piece=>piece.id===sb.id);
ok(na!==sa&&nb!==sb&&na.r===12&&na.c===4&&nb.r===2&&nb.c===2&&na.movedEver===sa.movedEver&&na.healing===false&&swapNone.state.mainUsed===true&&swapNone.state.teleport===null&&swapNone.state.selected===null&&swapNone.state.contactKind==="tele"&&swapNone.state.teleUsed!==swapState.teleUsed&&swapNone.state.teleUsed[0]===1&&swapNone.state.metrics.teleports===1&&swapNone.state.metrics.byPlayer[0].teleports===1,"teleport swap reducer returns the exact swapped coordinates, resources and metrics on cloned pieces without marking a walked move");
ok(swapNone.state.forcedQueue.length===0&&swapNone.events.length===1&&swapNone.events[0].type==="teleSwapped"&&swapNone.events[0].forced===null&&swapNone.events[0].pieces[0]===na&&swapNone.events[0].pieces[1]===nb&&swapNone.events[0].traces===0,"a swap with no new contact emits one teleSwapped carrying the pieces that live in the returned state");
H.place(T,sd,2,3); // 교환 뒤 sb 가 (2,2)로 오면서 새로 인접 — sa 는 이미 인접이라 신규가 아니다
const swapOne=T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:sb});
ok(JSON.stringify(swapOne.state.forcedQueue)==="[]"&&JSON.stringify(swapOne.state.forcedTargets)===JSON.stringify([sd.id])&&swapOne.state.movedPiece===swapOne.state.pieces.find(piece=>piece.id===sb.id)&&swapOne.state.contactSet.includes(sd.id)&&swapOne.state.selected===null&&swapOne.events[0].forced.id===sb.id&&swapState.forcedTargets.length===0&&swapState.movedPiece===null,"one new contact is promoted out of the queue inside Core with the pre-existing adjacency exempt");
H.place(T,se,12,5); // sa 도 (12,4)에서 새로 인접 — 두 항목이 순서대로 적재되고 첫 항목만 승격된다
const swapTwo=T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:sb});
ok(swapTwo.state.forcedQueue.length===1&&swapTwo.state.forcedQueue[0].pid===sb.id&&JSON.stringify(swapTwo.state.forcedQueue[0].targets)===JSON.stringify([sd.id])&&JSON.stringify(swapTwo.state.forcedTargets)===JSON.stringify([se.id])&&swapTwo.state.movedPiece.id===sa.id&&swapTwo.events[0].forced.id===sa.id&&swapState.forcedQueue.length===0,"two new contacts queue in swapped-piece order and only the first is promoted, leaving the second for drainForcedQueue");
/* #245 상태 순수성: 리듀서 상태와 전역 S 가 갈려도 결과는 **받은 상태만** 따른다 (온라인 재생·AI 탐색 경로).
   swapState 는 T.S 그 자체라 기존 단언들은 둘이 같을 때만 본다 — 여기서는 별개 상태를 넘기고 S 만 어긋나게 둔다 */
const swapPure=Object.assign({},swapState,{pieces:swapState.pieces.slice()});
const swapDigest=r=>JSON.stringify({ev:r.events.map(e=>e.type),forced:r.events[0].forced,queue:r.state.forcedQueue,
  targets:r.state.forcedTargets,contact:r.state.contactSet,moved:r.state.movedPiece&&r.state.movedPiece.id,
  main:r.state.mainUsed,tele:r.state.teleUsed,where:r.state.pieces.filter(p=>p.id===sa.id||p.id===sb.id).map(p=>[p.id,p.r,p.c])});
const swapAgreed=swapDigest(T.reduceCoreAction(swapPure,{t:"teleSwap",a:sa,b:sb}));
const liveP=T.S.pieces, livePhase=T.S.phase, liveCur=T.S.current, liveMain=T.S.mainUsed, liveTele=T.S.teleUsed;
T.S.pieces=[sa,sb]; T.S.phase="setup"; T.S.current=1; T.S.mainUsed=true; T.S.teleUsed=[T.BAL.teleMax,T.BAL.teleMax]; // 전역 S 만 어긋나게 (말 객체는 그대로)
const swapDisagreed=swapDigest(T.reduceCoreAction(swapPure,{t:"teleSwap",a:sa,b:sb}));
T.S.pieces=liveP; T.S.phase=livePhase; T.S.current=liveCur; T.S.mainUsed=liveMain; T.S.teleUsed=liveTele;
ok(swapDisagreed===swapAgreed&&swapPure.mainUsed===false&&swapPure.teleUsed[0]===0&&sa.r===2&&sa.c===2&&sb.r===12&&sb.c===4,"teleport swap reducer reads the board, teleport availability and forced contacts from its state argument only, so a disagreeing global S changes nothing");
const swapBlocked=T.reduceCoreAction(Object.assign({},swapState,{battlesUsed:1,selected:sa}),{t:"teleSwap",a:sa,b:sb});
ok(swapBlocked.events[0].type==="teleRefused"&&/차단/.test(swapBlocked.events[0].message)&&swapBlocked.state.teleport.stage===1&&swapBlocked.state.selected===null&&swapBlocked.state.mainUsed===false&&swapBlocked.state.teleUsed[0]===0&&swapBlocked.state.pieces===swapState.pieces&&swapBlocked.state.forcedQueue.length===0,"a swap blocked by the battle budget only rewinds the pick and selection, consuming no resource and moving no piece");
se.placed=false; sa.immobile=2;
const swapRefused=T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:sb});
ok(swapRefused.events[0].type==="teleRefused"&&swapRefused.events[0].message.indexOf(T.TELE_TRAP_MSG)>=0&&swapRefused.state.teleport.stage===1&&swapRefused.state.mainUsed===false&&swapRefused.state.pieces===swapState.pieces,"a trapped piece rewinds the pick in Core and consumes nothing");
sa.immobile=0;
ok(T.reduceCoreAction(swapState,{t:"teleSwap",a:sKing,b:sb})===null&&T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:Object.assign({},sb)})!==null&&T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:Object.assign({},sb)}).events[0].type==="teleRefused","a king swap falls through to the legacy edge-reach path and a cloned piece object is still refused");
/* #245 end-to-end: 승격된 강제 전투의 개시는 레거시 initBattle 이 같은 말 객체로 그대로 한다 */
const forcedBefore=T.S.metrics.forcedBattles;
ok(T.doTeleportSwap(sa,sb)===true&&sa.r===12&&sa.c===4&&sb.r===2&&sb.c===2&&T.at(2,2)===sb&&T.at(12,4)===sa&&T.S.teleport===null&&T.S.mainUsed===true&&T.S.teleUsed[0]===1&&T.S.movedPiece===sb&&!!T.S.battle&&T.S.battle.attP===sb&&T.S.battle.defP===sd&&T.S.forcedTargets.length===0&&T.S.metrics.forcedBattles===forcedBefore+1,"doTeleportSwap commits the swap on the same piece objects and the legacy battle initiation consumes the promoted contact");
T.S.battle=null; T.S.battlesUsed=0; T.S.forcedTargets=[]; T.S.forcedQueue=[]; T.S.movedPiece=null; T.S.mainUsed=false;
ok(T.doTeleportSwap(sa,Object.assign({},sb))===false&&T.S.mainUsed===false&&T.S.teleUsed[0]===1,"a refused swap still returns false through the single Core entry point without consuming a resource");
/* #245: 거부 결과도 commitCoreState 를 지난다 — S.pieces 에 같은 id 가 둘이어도 원본 말이 사라지거나 한 객체로 겹치면 안 된다 */
const dupBefore=T.S.pieces, dupGhost=Object.assign({},sf,{hp:1}); // 같은 id 두 개 (손상 상태 재현)
T.S.pieces=dupBefore.concat([dupGhost]);
const dupRefs=T.S.pieces.slice(), dupBytes=JSON.stringify(dupRefs), dupTele=JSON.stringify(T.S.teleUsed);
const dupRefused=T.doTeleportSwap(sa,Object.assign({},sb));
ok(dupRefused===false&&T.S.pieces.length===dupRefs.length&&T.S.pieces.every((piece,i)=>piece===dupRefs[i])&&JSON.stringify(T.S.pieces)===dupBytes&&T.S.mainUsed===false&&JSON.stringify(T.S.teleUsed)===dupTele,"a refused swap mutates no piece and drops no object reference even when S.pieces holds duplicate ids");
T.S.pieces=dupBefore;
/* #245 강제 전투 큐 소비(drainForced): 큐 꺼내기·면제 판정·승격(movedPiece·contactSet·forcedTargets·selected·contactKind)은 Core 가 소유하고,
   면제 사유 로그·토스트, "추가 접촉" 배너, 전투 개시(forcedContactStart→initBattle)는 forcedExempt·forcedPromoted 이벤트가 표시 계층으로 넘긴다 */
const dq=H.freshPlay(T,"pvp"); H.clearBoard(T);
const dMine=T.S.pieces.filter(piece=>piece.owner===0&&piece.type==="minion"), dFoe=T.S.pieces.filter(piece=>piece.owner===1&&piece.type==="minion");
const dA=dMine[0], dB=dMine[1], dC=dMine[2], dX=dFoe[0], dY=dFoe[1], dZ=dFoe[2], dW=dFoe[3];
const dBomb=T.S.pieces.find(piece=>piece.owner===0&&piece.type==="bomb"), dTrap=T.S.pieces.find(piece=>piece.owner===0&&piece.type==="trap");
H.place(T,dA,7,2); H.place(T,dX,7,3); H.place(T,dZ,6,2); // dA 는 두 적과 인접
H.place(T,dB,9,2); H.place(T,dY,9,3); H.place(T,dC,11,2); // dC 는 고립 — 대상 재검사로 면제된다
H.place(T,dBomb,12,2); H.place(T,dW,12,3); H.place(T,dTrap,13,3); // 폭탄은 강제 접촉 적격, 함정은 공격 불가
dq.current=0; dq.battlesUsed=0; dq.battle=null; dq.fleePick=null; dq.forcedTargets=[]; dq.movedPiece=null; dq.contactSet=[]; dq.selected=null; dq.contactKind="tele";
dq.forcedQueue=[{pid:dA.id,targets:[dX.id]},{pid:dB.id,targets:[dY.id]}];
const drainPick=T.reduceCoreAction(dq,{t:"drainForced",autoStart:false});
ok(dq.forcedQueue.length===2&&dq.forcedTargets.length===0&&dq.movedPiece===null&&dq.selected===null&&dq.contactKind==="tele","drain reducer leaves the input queue, forced targets, mover, selection and banner kind untouched");
ok(drainPick.state.forcedQueue.length===1&&drainPick.state.forcedQueue[0].pid===dB.id&&JSON.stringify(drainPick.state.forcedTargets)===JSON.stringify([dX.id])&&drainPick.state.movedPiece===dA&&drainPick.state.selected===dA&&drainPick.state.contactSet.length===2&&drainPick.state.contactSet.includes(dX.id)&&drainPick.state.contactSet.includes(dZ.id)&&drainPick.state.contactKind==="again","FIFO: the first entry is promoted with the full contact set, the click selection and the additional-contact banner kind, leaving the rest queued");
ok(drainPick.events.length===1&&drainPick.events[0].type==="forcedPromoted"&&drainPick.events[0].autoStart===false&&drainPick.events[0].piece===dA&&JSON.stringify(drainPick.events[0].list)===JSON.stringify([dX.id]),"the click promotion emits exactly one forcedPromoted carrying the piece and the revalidated target list");
const drainAuto=T.reduceCoreAction(dq,{t:"drainForced",autoStart:true});
ok(JSON.stringify(drainAuto.state.forcedTargets)===JSON.stringify([dX.id])&&drainAuto.state.movedPiece===dA&&drainAuto.state.selected===null&&drainAuto.state.contactKind==="tele"&&drainAuto.events[0].autoStart===true&&drainAuto.state.forcedQueue.length===1,"autoStart promotes the same single target but leaves the selection and banner kind alone for the immediate start");
const drainAutoMulti=T.reduceCoreAction(Object.assign({},dq,{forcedQueue:[{pid:dA.id,targets:[dX.id,dZ.id]}]}),{t:"drainForced",autoStart:true});
ok(drainAutoMulti.state.forcedTargets.length===2&&drainAutoMulti.state.selected===dA&&drainAutoMulti.events[0].list.length===2,"autoStart with two targets keeps the promoted piece selected for the pick, as applyForced did");
/* 면제: 말 소멸(원격 재생의 pid:null 포함)·대상 재검사 실패·함정 공격 불가를 연달아 건너뛰고 유효 항목까지 간다 — 건너뛴 항목도 큐에서 빠진다 */
const drainSkip=T.reduceCoreAction(Object.assign({},dq,{forcedQueue:[{pid:null,targets:[dX.id]},{pid:dC.id,targets:[dY.id]},{pid:dTrap.id,targets:[dW.id]},{pid:dA.id,targets:[dX.id]}]}),{t:"drainForced",autoStart:false});
ok(drainSkip.events.length===4&&drainSkip.events.slice(0,3).every(event=>event.type==="forcedExempt")&&/제거되었습니다/.test(drainSkip.events[0].message)&&/사라졌습니다/.test(drainSkip.events[1].message)&&/사라졌습니다/.test(drainSkip.events[2].message)&&drainSkip.events[3].piece===dA&&drainSkip.state.forcedQueue.length===0,"three exempt entries (missing piece, target no longer adjacent, trap attacker) are logged and dropped before the valid entry is promoted");
const drainBomb=T.reduceCoreAction(Object.assign({},dq,{forcedQueue:[{pid:dBomb.id,targets:[dW.id]}]}),{t:"drainForced",autoStart:true});
ok(drainBomb.events[0].type==="forcedPromoted"&&drainBomb.events[0].piece===dBomb&&JSON.stringify(drainBomb.state.forcedTargets)===JSON.stringify([dW.id]),"a bomb stays forced-contact eligible on promotion");
const drainBudget=T.reduceCoreAction(Object.assign({},dq,{battlesUsed:2}),{t:"drainForced",autoStart:false});
ok(drainBudget.events.length===2&&drainBudget.events.every(event=>event.type==="forcedExempt"&&event.owner===0&&/전투 횟수 소진/.test(event.toast))&&drainBudget.state.forcedQueue.length===0&&drainBudget.state.forcedTargets.length===0&&drainBudget.state.movedPiece===null,"an exhausted battle budget exempts every queued entry with an owner-gated toast and promotes nothing");
/* 무동작 계약: 큐 없음·전투 중·플레이 단계 아님·이미 걸린 강제 전투는 아무것도 꺼내지 않는다 (도망 교환 중은 큐 정규화도 하지 않는다) */
const drainNoops=[Object.assign({},dq,{forcedQueue:[]}),Object.assign({},dq,{battle:{}}),Object.assign({},dq,{phase:"over"}),Object.assign({},dq,{forcedTargets:[dX.id]})];
ok(drainNoops.every(state=>{ const r=T.reduceCoreAction(state,{t:"drainForced",autoStart:false}); return r.events.length===0&&r.state.forcedQueue.length===state.forcedQueue.length&&r.state.movedPiece===state.movedPiece&&r.state.selected===state.selected&&r.state.contactKind===state.contactKind&&r.state.forcedTargets===state.forcedTargets; })&&dq.forcedQueue.length===2,"no queue, an open battle, a finished match and an already-active forced battle all consume nothing");
const drainFlee=Object.assign({},dq,{fleePick:{owner:0},forcedQueue:null});
const drainFleeResult=T.reduceCoreAction(drainFlee,{t:"drainForced",autoStart:true});
ok(drainFleeResult.state===drainFlee&&drainFleeResult.events.length===0&&drainFleeResult.state.forcedQueue===null,"a pending flee swap returns the state untouched without even normalising a missing queue");
ok(JSON.stringify(T.reduceCoreAction(Object.assign({},dq,{forcedQueue:null}),{t:"drainForced",autoStart:false}).state.forcedQueue)==="[]","a missing queue is normalised to an empty array, as the legacy guard did");
/* 상태 순수성: 전역 S 가 적대적으로 어긋나도 결과는 받은 상태만 따른다 (온라인 재생·AI 탐색 경로) */
const drainDigest=r=>JSON.stringify({ev:r.events.map(e=>[e.type,e.autoStart,e.owner,e.message]),queue:r.state.forcedQueue,targets:r.state.forcedTargets,
  moved:r.state.movedPiece&&r.state.movedPiece.id,sel:r.state.selected&&r.state.selected.id,contact:r.state.contactSet,kind:r.state.contactKind});
const drainPure=Object.assign({},dq,{forcedQueue:[{pid:dA.id,targets:[dX.id]},{pid:dB.id,targets:[dY.id]}],pieces:dq.pieces.slice()});
const drainAgreed=drainDigest(T.reduceCoreAction(drainPure,{t:"drainForced",autoStart:false}));
const liveDrain={pieces:T.S.pieces,phase:T.S.phase,battle:T.S.battle,battlesUsed:T.S.battlesUsed,forcedTargets:T.S.forcedTargets,fleePick:T.S.fleePick,forcedQueue:T.S.forcedQueue};
T.S.pieces=[]; T.S.phase="over"; T.S.battle={}; T.S.battlesUsed=2; T.S.forcedTargets=[999]; T.S.fleePick={owner:1}; T.S.forcedQueue=[];
const drainDisagreed=drainDigest(T.reduceCoreAction(drainPure,{t:"drainForced",autoStart:false}));
Object.assign(T.S,liveDrain);
ok(drainDisagreed===drainAgreed&&drainPure.forcedQueue.length===2&&drainPure.forcedTargets.length===0&&drainPure.movedPiece===null,"drain reducer reads the board, phase, battle and budget from its state argument only, so a hostile global S changes nothing and the input queue stays whole");
/* end-to-end: 단일 진입점 drainForcedQueue 는 종전 반환 계약(승격했으면 true)을 지키고, 승격은 같은 말 객체로 커밋된다 */
T.S.forcedQueue=[{pid:dA.id,targets:[dX.id]},{pid:dB.id,targets:[dY.id]}]; T.S.forcedTargets=[]; T.S.movedPiece=null; T.S.selected=null; T.S.battle=null; T.S.battlesUsed=0; T.S.current=0; T.S.contactKind="tele";
ok(T.drainForcedQueue(false)===true&&T.S.movedPiece===dA&&T.S.selected===dA&&JSON.stringify(T.S.forcedTargets)===JSON.stringify([dX.id])&&T.S.contactKind==="again"&&T.S.forcedQueue.length===1&&T.S.forcedQueue[0].pid===dB.id&&!T.S.battle,"drainForcedQueue commits the click promotion onto the same piece objects the UI, AI and replay callers hold and returns true");
ok(T.drainForcedQueue(false)===false&&T.S.forcedQueue.length===1&&T.S.movedPiece===dA,"a second drain with an active forced battle promotes nothing and returns false");
T.S.forcedTargets=[]; T.S.movedPiece=null; T.S.selected=null; T.S.forcedQueue=[{pid:dB.id,targets:[dY.id]}];
ok(T.drainForcedQueue(true)===true&&T.S.movedPiece===dB&&!!T.S.battle&&T.S.battle.attP===dB&&T.S.battle.defP===dY&&T.S.forcedTargets.length===0&&T.S.forcedQueue.length===0,"drainForcedQueue(true) hands the promoted contact to the legacy battle initiation on the same piece objects");
T.S.battle=null; T.S.forcedTargets=[]; T.S.movedPiece=null; T.S.forcedQueue=[];
ok(T.drainForcedQueue(false)===false&&T.drainForcedQueue(true)===false,"an empty queue promotes nothing for either start mode");
ok(/function drainForcedQueue\(autoStart\)\{\s*const result=dispatchCoreAction\(\{t:"drainForced",autoStart:!!autoStart\}\);/.test(T.html)&&(T.html.match(/type:"forcedExempt"/g)||[]).length===3&&(T.html.match(/forcedContactStart\(event\.piece,event\.list\)/g)||[]).length===1,"AI, end turn, flee and battle completion share one Core drain entry point and the promoted battle reuses the shared display helper");
ok(/const result=dispatchCoreAction\(\{t:"teleSwap",a,b\}\);/.test(T.html)&&/return doTeleportSwapLegacy\(a,b\);/.test(T.html)&&/forcedContactStart\(event\.pieces\.find\(/.test(T.html)&&(T.html.match(/S\.teleUsed\[S\.current\]\+\+/g)||[]).length===1,"UI, AI and network replay share one teleport swap entry point and the promoted contact reuses the shared display helper");
ok(/function doMove\(p,r,c\)\{ if\(p&&dispatchCoreAction\(\{t:"move",id:p\.id,r,c\}\)\) return; doMoveLegacy\(p,r,c\); \}/.test(T.html),"UI, AI and network replay share one canonical move entry point");
ok(!/S\.(teleport|selected)\s*=/.test(T.html.slice(T.html.indexOf("function onCellCore"),T.html.indexOf("function observeMove"))),"onCellCore no longer assigns the teleport pick or selection state directly");
/* #245 턴 종료: 강제 전투 잔여 확인 → immobile 감소 → 지표 → 회복 틱 → turnCount++ → 교대(플립·턴 초기화·메모 정리)까지 Core 가 소유하고,
   회복 로그·턴 배너·핫시트 넘김·AI 스케줄·sim 무승부 gameOver 는 turnEnded 이벤트가 표시 계층으로 넘긴다 */
H.freshPlay(T,"pvp"); H.clearBoard(T);
const eMine=T.S.pieces.filter(piece=>piece.owner===0&&piece.type==="minion"), eFoes=T.S.pieces.filter(piece=>piece.owner===1&&piece.type==="minion");
const eStuck=eMine[0], eNear=eMine[1], eHeal=eMine[2], eKing=T.S.pieces.find(piece=>piece.owner===0&&piece.type==="king");
const eFoe=eFoes[0], eGone=eFoes[1];
H.place(T,eStuck,7,2); H.place(T,eNear,7,4); H.place(T,eFoe,7,5); H.place(T,eHeal,11,2); H.place(T,eKing,9,4); // eKing 은 숲(9행)·eNear 는 보이는 적과 인접
eStuck.immobile=2; eHeal.healing=true; eHeal.hp=10;
const eGain=Math.round(eHeal.maxHp*T.BAL.healPostPct);
const etBase=Object.assign({},T.S,{current:0,phase:"play",battle:null,fleePick:null,teleport:null,battlesUsed:0,mainUsed:true,
  forcedTargets:[],forcedQueue:[],contactSet:[eFoe.id],movedPiece:eNear,selected:eNear,turnCount:4,healTickTurn:-1,
  memos:[{[eGone.id]:"bomb",[eFoe.id]:"trap"},{}],
  metrics:Object.assign({},T.S.metrics,{byPlayer:T.S.metrics.byPlayer.map(x=>Object.assign({},x))})});
const etResult=T.reduceCoreAction(etBase,{t:"endTurn"});
ok(etBase.turnCount===4&&etBase.current===0&&etBase.mainUsed===true&&etBase.selected===eNear&&eStuck.immobile===2&&eHeal.hp===10&&etBase.pieces.includes(eStuck)&&etBase.metrics.kingForestTurns===0&&etBase.metrics.battleRefusals===0&&etBase.metrics.healHp===0&&etBase.memos[0][eGone.id]==="bomb"&&etBase.tempReveal.size===0,"end turn reducer leaves the input turn counter, action flags, pieces, metrics and memos untouched");
const etStuck=etResult.state.pieces.find(piece=>piece.id===eStuck.id), etHealed=etResult.state.pieces.find(piece=>piece.id===eHeal.id);
ok(etStuck!==eStuck&&etStuck.immobile===1&&etHealed!==eHeal&&etHealed.hp===10+eGain&&etResult.state.pieces.find(piece=>piece.id===eNear.id)===eNear,"end turn reducer decrements the immobile counter and applies the heal tick on cloned pieces only");
ok(etResult.state.metrics!==etBase.metrics&&etResult.state.metrics.kingForestTurns===1&&etResult.state.metrics.byPlayer[0].kingForestTurns===1&&etResult.state.metrics.battleRefusals===1&&etResult.state.metrics.byPlayer[0].battleRefusals===1&&etResult.state.metrics.healHp===eGain&&etResult.state.metrics.byPlayer[0].healHp===eGain,"the king forest stay, the refused battle and the healed HP are counted once for the ending player on cloned metrics");
ok(etResult.state.turnCount===5&&etResult.state.healTickTurn===4&&etResult.state.current===1&&etResult.state.mainUsed===false&&etResult.state.battlesUsed===0&&etResult.state.movedPiece===null&&etResult.state.selected===null&&etResult.state.contactSet.length===0&&etResult.state.forcedTargets.length===0&&etResult.state.forcedQueue.length===0&&etResult.state.teleport===null&&etResult.state.tempReveal!==etBase.tempReveal,"the turn counter, heal-tick guard, player flip and the start-of-turn reset all land in one returned state");
ok(etResult.state.memos!==etBase.memos&&etResult.state.memos[0][eGone.id]===undefined&&etResult.state.memos[0][eFoe.id]==="trap","the memo of a piece that left the board is cleaned on a cloned memo map only");
ok(etResult.events.length===1&&etResult.events[0].type==="turnEnded"&&etResult.events[0].player===0&&etResult.events[0].bt===false&&JSON.stringify(etResult.events[0].healed)===JSON.stringify([{id:eHeal.id,gain:eGain}]),"end turn emits one turnEnded carrying the ending player and the heal-tick log rows");
/* 강제 전투 잔여: 사람은 턴을 마칠 수 없고(토스트만·상태 전이 없음) AI 는 이행 불가 상태를 해소하고 진행한다 */
const etForced=Object.assign({},etBase,{forcedTargets:[eFoe.id]});
const etBlock=T.reduceCoreAction(etForced,{t:"endTurn"});
ok(etBlock.state.turnCount===4&&etBlock.state.current===0&&etBlock.state.mainUsed===true&&JSON.stringify(etBlock.state.forcedTargets)===JSON.stringify([eFoe.id])&&etBlock.events.length===1&&etBlock.events[0].type==="toast"&&/강제 전투 대상과 전투해야/.test(etBlock.events[0].message),"an unfulfilled forced battle blocks a human turn end with a toast and no state transition");
const etAiClear=T.reduceCoreAction(Object.assign({},etForced,{mode:"sim"}),{t:"endTurn"});
const etAiPve=T.reduceCoreAction(Object.assign({},etForced,{mode:"pve",current:1}),{t:"endTurn"});
ok(etAiClear.state.forcedTargets.length===0&&etAiClear.state.turnCount===5&&etAiClear.state.current===1&&etAiClear.events[0].type==="turnEnded"&&etAiPve.state.forcedTargets.length===0&&etAiPve.state.turnCount===5&&etAiPve.state.current===0&&etForced.forcedTargets.length===1,"an AI clears an unfulfillable forced battle and finishes the turn, leaving the input targets whole");
/* 대기 큐는 같은 reducer 의 drainForced 로 먼저 꺼내고, 승격되면 그 턴은 끝나지 않는다 */
const etQueued=Object.assign({},etBase,{forcedQueue:[{pid:eNear.id,targets:[eFoe.id]}]});
const etDrain=T.reduceCoreAction(etQueued,{t:"endTurn"});
ok(etDrain.events.length===2&&etDrain.events[0].type==="forcedPromoted"&&etDrain.events[0].piece===eNear&&etDrain.events[1].type==="toast"&&etDrain.state.turnCount===4&&JSON.stringify(etDrain.state.forcedTargets)===JSON.stringify([eFoe.id])&&etDrain.state.forcedQueue.length===0&&etQueued.forcedQueue.length===1,"a queued forced battle is drained through the same reducer before the turn can end, and then blocks it");
/* sim 무승부: turnCount 까지가 Core 이고 gameOver·문구·렌더는 표시 계층이 맡는다 (전투 회계 정리를 포함한 경기 종료 경로) */
const etDraw=T.reduceCoreAction(Object.assign({},etBase,{mode:"sim",turnCount:T.BAL.simMaxTurns-1}),{t:"endTurn"});
ok(etDraw.state.turnCount===T.BAL.simMaxTurns&&etDraw.state.current===0&&etDraw.state.phase==="play"&&etDraw.state.winner===null&&etDraw.events.length===1&&etDraw.events[0].simDraw===true&&etDraw.events[0].bt===undefined,"the simulation draw stops at the turn counter without flipping the player and hands gameOver to the display layer");
/* BT 진입 1회 고지는 교대 시점의 상태에서 결정된다 (배너 예약·지표 모두 복제본에만) */
const etBt=T.reduceCoreAction(Object.assign({},etBase,{turnCount:T.BAL.burnStart-2}),{t:"endTurn"});
ok(etBt.events[0].bt===true&&etBt.state.btBannerDue===true&&etBt.state.metrics.btReached===true&&etBt.state.metrics.btEnterTurn===T.BAL.burnStart&&etBase.btBannerDue===false&&etBase.metrics.btReached===false&&T.reduceCoreAction(etBt.state,{t:"endTurn"}).events[0].bt===false,"burning time is announced exactly once at the flip, on cloned banner and metric fields only");
/* 가드로 막힌 프레임도 auto 표식은 기록한다 — 레거시 applyAction 이 met() 를 endTurn() 앞에서 불렀다 */
const etGuards=[{battle:{}},{fleePick:{owner:0}},{teleport:{stage:1,piece:null}},{phase:"over"}];
ok(etGuards.every(guard=>{ const r=T.reduceCoreAction(Object.assign({},etBase,guard),{t:"endTurn",auto:true});
  return r.events.length===0&&r.state.turnCount===4&&r.state.current===0&&r.state.metrics.autoEnds===1&&r.state.metrics.byPlayer[0].autoEnds===1; })
  &&etGuards.every(guard=>T.reduceCoreAction(Object.assign({},etBase,guard),{t:"endTurn"}).state.metrics.autoEnds===0)
  &&T.reduceCoreAction(etBase,{t:"endTurn",auto:true}).state.metrics.autoEnds===1&&etBase.metrics.autoEnds===0,"a blocked end turn changes nothing but still records the auto marker on cloned metrics, exactly where the legacy replay counted it");
/* 상태 순수성: 전역 S 가 적대적으로 어긋나도 결과는 받은 상태만 따른다 (온라인 재생·AI 탐색 경로) */
const etDigest=r=>JSON.stringify({ev:r.events.map(e=>[e.type,e.player,e.bt,e.simDraw,e.healed,e.message]),turn:r.state.turnCount,cur:r.state.current,
  tick:r.state.healTickTurn,metrics:r.state.metrics,memos:r.state.memos,pieces:r.state.pieces.map(x=>[x.id,x.hp,x.immobile])});
const etAgreed=etDigest(T.reduceCoreAction(etBase,{t:"endTurn"}));
const etLive={pieces:T.S.pieces,phase:T.S.phase,mode:T.S.mode,current:T.S.current,turnCount:T.S.turnCount,battle:T.S.battle,battlesUsed:T.S.battlesUsed,
  fleePick:T.S.fleePick,teleport:T.S.teleport,forcedTargets:T.S.forcedTargets,forcedQueue:T.S.forcedQueue,healTickTurn:T.S.healTickTurn,metrics:T.S.metrics,memos:T.S.memos};
T.S.pieces=[]; T.S.phase="over"; T.S.mode="sim"; T.S.current=1; T.S.turnCount=999; T.S.battle={}; T.S.battlesUsed=2; T.S.fleePick={owner:1};
T.S.teleport={stage:1,piece:null}; T.S.forcedTargets=[999]; T.S.forcedQueue=[]; T.S.healTickTurn=999; T.S.memos=[{},{}];
const etDisagreed=etDigest(T.reduceCoreAction(etBase,{t:"endTurn"}));
Object.assign(T.S,etLive);
ok(etDisagreed===etAgreed&&etBase.turnCount===4&&eStuck.immobile===2&&eHeal.hp===10,"end turn reducer reads the board, phase, mode, budget and heal-tick guard from its state argument only, so a hostile global S changes nothing");
/* end-to-end: 사람 턴바·AI·온라인 재생이 같은 Core 진입점을 쓰고, 커밋은 호출처가 들고 있는 말 객체 그대로다 */
Object.assign(T.S,{mode:"pve",current:0,phase:"play",battle:null,fleePick:null,teleport:null,battlesUsed:0,mainUsed:true,
  forcedTargets:[],forcedQueue:[],contactSet:[eFoe.id],movedPiece:eNear,selected:eNear,turnCount:4,healTickTurn:-1});
eStuck.immobile=2; eHeal.hp=10; eHeal.healing=true;
const etRefusalsBefore=T.S.metrics.battleRefusals;
T.endTurn();
ok(T.S.turnCount===5&&T.S.current===1&&T.S.mainUsed===false&&T.S.selected===null&&T.S.pieces.includes(eStuck)&&eStuck.immobile===1&&T.S.pieces.includes(eHeal)&&eHeal.hp===10+eGain&&T.S.metrics.battleRefusals===etRefusalsBefore+1,"endTurn() commits the transition onto the same piece objects the UI, AI and replay callers hold");
Object.assign(T.S,{current:0,turnCount:4,mainUsed:true,healTickTurn:-1,forcedTargets:[],forcedQueue:[],battle:null,teleport:null,fleePick:null,phase:"play"});
const etAutoBefore=T.S.metrics.autoEnds;
T.applyAction({t:"endTurn",auto:true});
ok(T.S.metrics.autoEnds===etAutoBefore+1&&T.S.metrics.byPlayer[0].autoEnds===etAutoBefore+1&&T.S.turnCount===5&&T.S.current===1,"the online replay frame routes through the same Core action and records the auto marker exactly once");
ok(/function endTurn\(\)\{ return dispatchCoreAction\(\{t:"endTurn"\}\); \}/.test(T.html)&&!/case "endTurn"\s*:/.test(fs.readFileSync(path.join(demo,"js","network.js"),"utf8"))&&(T.html.match(/startTurnMessages\(/g)||[]).length===3&&(T.html.match(/healLogs\(/g)||[]).length===3,"turn bar, AI and network replay share one Core end-turn entry point, and the turn banner and heal-tick logs keep a single display helper each");

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
  // 24511 은 텔레포트 스왑 3회, 24512 는 2회 + 왕 끝줄 도달(edge) 승리 — Core 로 옮긴 스왑과 레거시로 남긴 왕 경로를 둘 다 지난다
  for(const seed of [24501,24502,24511,24512]) ok(trace({html:baseHtml},seed)===trace({},seed),"seed "+seed+" snapshot/digest/winner matches the pre-split baseline");
}

console.log(`\n=== smoke_issue245: pass ${pass} / fail ${fail} ===`);
if(fail) process.exit(1);
