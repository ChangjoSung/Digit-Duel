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
{ /* 왕 이동도 다른 말과 같은 reducer 를 지난다. 끝줄에 닿지 않는 걸음은 보통 이동이고, 닿는 걸음은
     **같은 reducer 안에서** 공개 → 경기 종료(gameOver) → kingReached 표시 이벤트까지 끝낸다 (레거시 checkKingReach 대체). */
  const kingStep=T.reduceCoreAction(moveState,{t:"move",id:myKing.id,r:12,c:1});
  ok(kingStep!==null&&kingStep.events.length===1&&kingStep.events[0].type==="moved"&&kingStep.state.phase==="play"
     &&kingStep.state.pieces.find(x=>x.id===myKing.id).r===12&&myKing.r===13,
     "a king step that does not reach the far row is an ordinary Core move (no legacy path left)");
  const edgeState=Object.assign({},moveState,{pieces:moveState.pieces.map(x=>x.id===myKing.id?Object.assign({},x,{r:2,c:1}):x)});
  const reached=T.reduceCoreAction(edgeState,{t:"move",id:myKing.id,r:1,c:1});
  const reachedKing=reached.state.pieces.find(x=>x.id===myKing.id);
  ok(reached.state.phase==="over"&&reached.state.winner===0&&reached.state.metrics.winType==="edge"
     &&reachedKing.r===1&&reachedKing.revealed===true&&edgeState.phase==="play"
     &&JSON.stringify(reached.events.map(e=>e.type))===JSON.stringify(["moved","matchEnded","kingReached"])
     &&reached.events[0].kingReach===true&&reached.events[0].piece===reachedKing&&reached.events[2].owner===0,
     "a king step onto the far row finishes the match inside the same reducer — the king is revealed, the win is recorded and the display order stays moved -> matchEnded -> kingReached");
}
moveState.turnCount=T.BAL.burnStart-1;
const twoStep=T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:10,c:4}), twoStepPiece=twoStep&&twoStep.state.pieces.find(piece=>piece.id===mover.id);
ok(T.isBurning()&&mover.r===12&&mover.c===4&&twoStepPiece!==mover&&twoStepPiece.r===10&&twoStepPiece.c===4&&twoStep.state.contactKind==="move"&&twoStep.state.tempReveal===moveState.tempReveal&&twoStep.events[0].collision===false,"a burning-time two-step over an empty midpoint lands on the endpoint in Core without touching its input");
moveState.turnCount=0;
{ /* 전투 슬롯이 이미 하나 걸린 턴·앞선 강제 전투 표식이 남은 상태의 이동도 같은 reducer 가 맡는다.
     신규 접촉 판정은 **이동이 끝난 보드**에서 하므로 레거시 applyForced(=S.forcedTargets 를 비우고 S.movedPiece 를 세운 뒤 판정)와 같은 값을 낸다. */
  moveState.battlesUsed=1;
  const spent=T.reduceCoreAction(moveState,{t:"move",id:mover.id,r:11,c:4});
  ok(spent!==null&&spent.state.pieces.find(x=>x.id===mover.id).r===11&&spent.state.battlesUsed===1&&spent.state.forcedTargets.length===0,
     "a step in a turn that already spent a battle slot resolves in Core with no new forced target");
  const stale=T.reduceCoreAction(Object.assign({},moveState,{battlesUsed:0,forcedTargets:[9998]}),{t:"move",id:mover.id,r:11,c:4});
  ok(stale!==null&&JSON.stringify(stale.state.forcedTargets)==="[]",
     "a move recomputes the forced-target list from scratch — a stale marker is cleared exactly as the legacy applyForced did");
  moveState.battlesUsed=0;
}
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
ok(myKing.r===12&&myKing.c===1&&T.at(12,1)===myKing&&T.S.movedPiece===myKing&&T.S.mainUsed===true,"a king step resolves through the single Core entry point onto the same piece object");
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
ok((T.html.match(/이동 중 숨은 말과 충돌! 위치가 일시 공개되었습니다\./g)||[]).length===1&&/if\(event\.collision\) collisionLog\(event\.piece\)/.test(T.html)&&(T.html.match(/collisionLog\(/g)||[]).length===2,"the collision notice lives in one helper with exactly one call site — the moved event (the legacy caller is gone)");
ok(/forcedContactStart\(event\.piece,event\.forced\)/.test(T.html)&&(T.html.match(/신규 인접 — 강제 전투/g)||[]).length===1&&(T.html.match(/initBattle\(p,def\)/g)||[]).length===1,"forced contact display and battle initiation stay in one helper that every Core event reuses");
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
/* ===== #245 Saturn REVISE(M4) 이동 좌표·말 형태 검증 — **행동으로** 확인한다 =====
   Saturn 이 실측한 세 통과 사례(소수 좌표·문자열 좌표·보드 밖 행)와 죽은·미배치 말을 같은 자리에서 막는다.
   기대는 "거부"가 아니라 **완전한 무변경**이다: reducer 는 null 을 돌려주고, 같은 액션을 dispatch 해도
   상태 다이제스트가 한 글자도 움직이지 않는다 (아무 칸도 반쯤 바뀌지 않는다). */
{
  const snap=st=>JSON.stringify({main:st.mainUsed,cur:st.current,turn:st.turnCount,sel:st.selected&&st.selected.id,
    moved:st.movedPiece&&st.movedPiece.id,contact:st.contactSet,targets:st.forcedTargets,reveal:[...st.tempReveal],
    seen:st.aiSeenMoved.map(x=>[...x]),traces:st.traces.map(x=>[...x]),metrics:st.metrics,
    where:st.pieces.map(p=>[p.id,p.r,p.c,p.alive,p.placed,p.movedEver,p.movedPreBT])});
  const base=snap(pureState);
  const BAD=[
    {why:"칸 사이 소수 좌표 (맨해튼 거리는 1 이지만 칸이 아니다)",a:{t:"move",id:901,r:11.5,c:4.5}},
    {why:"저장된 문자열 좌표 (산술 비교만으로는 통과했다)",a:{t:"move",id:901,r:"11",c:4}},
    {why:"보드 밖 행 (13→14)",a:{t:"move",id:901,r:14,c:4}},
    {why:"보드 밖 열 (0)",a:{t:"move",id:901,r:12,c:0}},
    {why:"NaN 좌표",a:{t:"move",id:901,r:NaN,c:4}},
    {why:"좌표 생략",a:{t:"move",id:901}}];
  let rejected=0, frozen=0;
  for(const b of BAD){
    const r=T.reduceCoreAction(pureState,b.a);
    if(r===null) rejected++;
    if(snap(pureState)===base) frozen++;
  }
  ok(rejected===BAD.length&&frozen===BAD.length,"malformed move coordinates are rejected at the shared selector boundary and leave the state digest byte-identical ("+BAD.length+" cases)");
  /* 보드 밖 행 14 는 종전에 canMoveTo 가 거리 1 로 통과시켰다 — selector 자체가 막는지 직접 본다 */
  ok(T.canMoveTo(purePieces[0],14,4,pureState)===false&&T.canMoveTo(purePieces[0],11.5,4.5,pureState)===false
     &&T.canMoveTo(purePieces[0],"11",4,pureState)===false&&T.canMoveTo(purePieces[0],11,4,pureState)===true,
     "canMoveTo itself rejects off-board, fractional and string coordinates while the one legal step still passes");
  /* 죽은·미배치 말과 그 상태에 속하지 않는 복제 말 */
  const dead=Object.assign({},purePieces[0],{alive:false}), unplaced=Object.assign({},purePieces[0],{placed:false});
  const alien=Object.assign({},purePieces[0]); // 같은 id·같은 값이지만 이 보드의 그 말이 아니다
  ok(T.canMoveTo(dead,11,4,pureState)===false&&T.canMoveTo(unplaced,11,4,pureState)===false&&T.canMoveTo(alien,11,4,pureState)===false,
     "dead, unplaced and foreign piece objects are refused by the same selector");
  /* 공개(서버 권위) 프레임과 같은 모양의 입력도 같은 게이트를 지난다 — 회선에서 온 값이 우회로를 갖지 않는다 */
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const mover=T.S.pieces.find(p=>p.owner===0&&p.type==="minion"); H.place(T,mover,12,4);
  H.place(T,T.S.pieces.find(p=>p.owner===0&&p.type==="king"),13,1);
  H.place(T,T.S.pieces.find(p=>p.owner===1&&p.type==="king"),1,7);
  T.S.current=0; T.S.mainUsed=false;
  const before=lockstepDigest(T), at0=[mover.r,mover.c];
  T.netAction({t:"cell",r:11.5,c:4.5});               // 사람 입력·회선 재생이 함께 쓰는 공개 경로
  T.applyAction({t:"move",id:mover.id,r:"11",c:4});   // 회선 프레임 모양 그대로
  T.applyAction({t:"move",id:mover.id,r:14,c:4});
  ok(lockstepDigest(T)===before&&mover.r===at0[0]&&mover.c===at0[1]&&T.S.mainUsed===false,
     "the public action path (netAction cell and replayed move frames) rejects the same malformed coordinates with an exact no-op on the lockstep digest");
}
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
{ /* 왕이 섞인 교환도 같은 reducer 가 맡는다 (레거시 분기 없음). 끝줄에 닿지 않으면 보통 교환이고,
     닿으면 이동과 같은 kingReachResult 로 경기가 그 자리에서 끝난다. 복제 객체 거부(P2)는 그대로다. */
  const kingSwap=T.reduceCoreAction(swapState,{t:"teleSwap",a:sKing,b:sb});
  ok(kingSwap!==null&&kingSwap.events[0].type==="teleSwapped"&&kingSwap.state.phase==="play"
     &&kingSwap.state.pieces.find(x=>x.id===sKing.id).r===12&&sKing.r===13,
     "a king swap that lands off the far row is an ordinary Core swap (no legacy path left)");
  const edgeSwap=Object.assign({},swapState,{pieces:swapState.pieces.map(x=>x.id===sb.id?Object.assign({},x,{r:1,c:5}):x)});
  const eb=edgeSwap.pieces.find(x=>x.id===sb.id);
  const swapWin=T.reduceCoreAction(edgeSwap,{t:"teleSwap",a:eb,b:sKing});
  ok(swapWin.state.phase==="over"&&swapWin.state.winner===0&&swapWin.state.metrics.winType==="edge"
     &&swapWin.state.pieces.find(x=>x.id===sKing.id).revealed===true
     &&JSON.stringify(swapWin.events.map(e=>e.type))===JSON.stringify(["teleSwapped","matchEnded","kingReached"])
     &&swapWin.events[0].kingReach===true&&edgeSwap.phase==="play",
     "a swap that carries the king onto the far row finishes the match inside the same reducer, in the legacy display order");
  ok(T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:Object.assign({},sb)})!==null
     &&T.reduceCoreAction(swapState,{t:"teleSwap",a:sa,b:Object.assign({},sb)}).events[0].type==="teleRefused",
     "a cloned piece object is still refused by object identity");
}
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
ok(/const result=dispatchCoreAction\(\{t:"teleSwap",a,b\}\);/.test(T.html)&&!/doTeleportSwapLegacy/.test(T.html)&&/forcedContactStart\(event\.pieces\.find\(/.test(T.html)&&!/S\.teleUsed\[S\.current\]\+\+/.test(T.html)&&(T.html.match(/teleUsed\[state\.current\]\+\+/g)||[]).length===1,"UI, AI and network replay share one teleport swap entry point, the legacy swap path is gone and the teleport counter moves in the reducer only");
ok(/function doMove\(p,r,c\)\{ if\(p\) dispatchCoreAction\(\{t:"move",id:p\.id,r,c\}\); \}/.test(T.html)&&!/doMoveLegacy/.test(T.html),"UI, AI and network replay share one canonical move entry point and no legacy move path survives");
/* 끝줄 도달 판정은 레거시 래퍼(checkKingReach)와 reducer 가 같은 한 줄을 본다 — 판정이 두 벌이 되지 않는다 */
ok((T.html.match(/p\.type==="king"&&\(\(p\.owner===0&&p\.r===1\)\|\|\(p\.owner===1&&p\.r===ROWS\)\)/g)||[]).length===1&&(T.html.match(/kingAtEdge\(/g)||[]).length===4&&(T.html.match(/왕이 적진 최후방에 도달/g)||[]).length===2,"the edge-reach predicate has a single implementation that the legacy wrapper and both reducers share");
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
ok(/function endTurn\(\)\{ return dispatchCoreAction\(\{t:"endTurn"\}\); \}/.test(T.html)&&!/case "endTurn"\s*:/.test(fs.readFileSync(path.join(demo,"js","network.js"),"utf8"))&&(T.html.match(/startTurnMessages\(/g)||[]).length===4&&(T.html.match(/healLogs\(/g)||[]).length===3,"turn bar, AI and network replay share one Core end-turn entry point, and the turn banner and heal-tick logs keep a single display helper each (the banner helper is now called from its definition plus the three turn-start events — playBegan, turnStarted, turnEnded — and from nowhere that writes state)");

/* #245 경기 개시·턴 시작도 커밋 경계를 지난다 — 표시 계층에 S.phase·S.current·metrics.firstPlayer 직접 쓰기가 남지 않는다 */
ok(/function beginPlay\(\)\{ dispatchCoreAction\(\{t:"beginPlay"\}\); \}/.test(T.html)
  &&/function startTurn\(\)\{ dispatchCoreAction\(\{t:"startTurn"\}\); \}/.test(T.html)
  &&!/Object\.assign\(S,/.test(T.html)
  &&!/S\.phase="play"/.test(T.html)
  &&!/S\.metrics\.firstPlayer\s*=/.test(T.html),
  "match start and turn-start initialisation go through Core actions — no display path assigns the phase, the first player or the turn-start reset onto S");
{ // 선공은 rand 1회로 뽑히고 지표에 남는다 (같은 시드 → 같은 선공)
  const seat=seed=>{ const X=H.load(index); X.setSeed(seed); X.newGame("pvp"); X.aiAutoPlace(0); X.aiAutoPlace(1);
    const before=X.S.metrics; X.beginPlay();
    return {cur:X.S.current,first:X.S.metrics.firstPlayer,phase:X.S.phase,fresh:X.S.metrics!==before,used:X.S.mainUsed,turn:X.S.turnCount}; };
  const a=seat(2450), b=seat(2450), c=seat(2451);
  ok(a.phase==="play"&&a.cur===a.first&&(a.cur===0||a.cur===1)&&a.used===false&&a.turn===0&&a.fresh,
     "beginPlay leaves the board in play with the drawn first player recorded in a cloned metrics object and the turn reset");
  ok(JSON.stringify(a)===JSON.stringify(b),"the same seed draws the same first player (one rand, same place as before the split)");
  ok(c.cur===0||c.cur===1,"another seed still draws a legal seat");
}

/* ===== #245 회선 사전 배치의 신뢰 경계 — 정수가 아닌 좌표는 보드에 앉지 못한다 =====
   기존 락스텝(hello/hello2)의 setup 은 **상대가 보낸 값**이다. 행은 zoneOf 목록 일치라 소수가 통과할 수 없었지만
   열은 `q[1]>=1&&q[1]<=COLS` 범위 검사뿐이라 3.5 같은 값이 그대로 말의 c 가 됐다 — 그 자리는 클릭·인접·이동 판정
   어디에도 존재하지 않는 칸이라 두 좌석의 보드가 갈리고(락스텝 파괴) 그 말은 영영 접촉되지 않는다.
   아래는 그 한 칸을 실제 진입점(applyNetSetup)으로 넣어 본다: 거부되면 종전 손상 데이터와 같은 결정적 무작위 배치로
   대체되고, 통과하면 좌표가 그대로 남는다. 양성 대조(정수 열)가 함께 있어 "아무것도 안 받아서 통과"가 아니다. */
{
  const setupOf=pos=>{ const X=H.load(index); X.setSeed(24540); X.newGame("pvp");
    const roster=X.ROSTER.slice(0,6).map(r=>r.id);
    X.applyNetSetup(0,{roster,pos});
    const mine=X.S.pieces.filter(x=>x.owner===0);
    return {cells:mine.map(x=>[x.r,x.c]),placed:mine.every(x=>x.placed),log:X.S.log.map(l=>l.msg).join("|")}; };
  const good=[]; for(const r of [11,12,13]) for(let c=1;c<=7&&good.length<14;c++) good.push([r,c]);
  const frac=good.map((q,i)=>i===3?[q[0],3.5]:q.slice());          // 열만 소수 — 종전 검증을 그대로 통과하던 값
  const fracRow=good.map((q,i)=>i===3?[11.5,q[1]]:q.slice());      // 행 소수 — 종전에도 거부됐다 (대조군)
  const strCol=good.map((q,i)=>i===3?[q[0],"3"]:q.slice());        // 문자열 열 — 범위 비교는 통과하지만 정수가 아니다
  const ok0=setupOf(good), bad=setupOf(frac), badRow=setupOf(fracRow), badStr=setupOf(strCol);
  ok(JSON.stringify(ok0.cells)===JSON.stringify(good)&&ok0.placed&&ok0.log.indexOf("배치 데이터 손상")<0,
     "a well-formed peer setup is applied verbatim (positive control — the guard does not reject good data)");
  ok(bad.placed&&bad.cells.every(([r,c])=>Number.isInteger(r)&&Number.isInteger(c)&&[11,12,13].includes(r)&&c>=1&&c<=7)
     &&JSON.stringify(bad.cells)!==JSON.stringify(good)&&bad.log.indexOf("배치 데이터 손상")>=0,
     "a peer setup carrying a fractional column is rejected at the network trust boundary and replaced by the deterministic fallback placement");
  ok(badRow.log.indexOf("배치 데이터 손상")>=0&&badStr.log.indexOf("배치 데이터 손상")>=0
     &&badRow.cells.every(([r,c])=>Number.isInteger(r)&&Number.isInteger(c))
     &&badStr.cells.every(([r,c])=>Number.isInteger(r)&&Number.isInteger(c)),
     "a fractional row and a string column are rejected by the same gate");
  ok(JSON.stringify(setupOf(frac).cells)===JSON.stringify(bad.cells),
     "the fallback placement is deterministic for the same seed — both seats replace corrupt data the same way (lockstep holds)");
}

/* ===== #245 경기 종료(gameOver·기권) — 규칙 상태는 Core reducer, 화면 정리·배너·문구는 matchEnded 이벤트 ===== */
const goPieces=[{id:801,owner:0,type:"minion",alive:true,placed:true,r:12,c:4,hp:30,maxHp:40,burn:4,shield:6,powerBuff:true,fleeBoost:true,cd:3,skills:null},
  {id:802,owner:1,type:"minion",alive:true,placed:true,r:11,c:4,hp:20,maxHp:40,burn:2,shield:7,powerBuff:true,cd:1,skills:null}];
const goState={phase:"play",mode:"pvp",current:0,turnCount:9,winner:null,battle:null,recruit:{pick:1},pieces:goPieces,
  pkgs:[{itemGift:2,battleBuff:1},{itemGift:0,battleBuff:0}],metrics:{endTurn:0,winType:null,winner:null,byPlayer:[{},{}]}};
const resign=T.reduceCoreAction(goState,{t:"resign"});
ok(resign.state!==goState&&resign.state.phase==="over"&&resign.state.winner===1&&resign.state.metrics!==goState.metrics&&resign.state.metrics.winner===1&&resign.state.metrics.winType==="resign"&&resign.state.metrics.endTurn===9&&resign.state.battle===null&&resign.state.recruit===null&&goState.phase==="play"&&goState.winner===null&&goState.recruit!==null&&goState.metrics.winType===null,"resign reducer ends the match on a cloned state and leaves its input state untouched");
ok(resign.events.length===1&&resign.events[0].type==="matchEnded"&&resign.events[0].resignLoser===0&&resign.events[0].winner===1&&resign.events[0].winType==="resign"&&resign.events[0].interrupted===false&&resign.events[0].banner===true&&resign.state.pieces===goPieces&&resign.state.pkgs===goState.pkgs,"an ordinary resign emits one matchEnded naming the loser, moves no piece and keeps the unused package stock");
const draw=T.reduceCoreAction(goState,{t:"gameOver",winner:null,winType:"draw"});
ok(draw.state.winner===null&&draw.state.metrics.winner===null&&draw.state.metrics.winType==="draw"&&draw.state.metrics.endTurn===9&&draw.events[0].winner===null&&draw.events[0].resignLoser===undefined&&draw.events[0].banner===true,"a null winner draw keeps the null through state, metrics and the event");
ok(T.reduceCoreAction(goState,{t:"gameOver",winner:0,winType:"king",endingBattle:true}).events[0].banner===false&&T.reduceCoreAction(goState,{t:"gameOver",winner:0,winType:"king",endingBattle:false}).events[0].banner===true,"the battle-ending window arrives in the action, not from a global, and only it suppresses the match banner");
/* 전투 한가운데 종료: 본체 출전(말 자신)과 대리 출전(말에 매달린 포획 하수인) 둘 다 복제본에서만 정리된다 */
const goCap={hp:10,maxHp:20,burn:3,shield:9,cd:2,powerBuff:true,fleeBoost:true,skills:null,onceUsed:{used:1}};
const iPieces=[Object.assign({},goPieces[0]),Object.assign({},goPieces[1],{cap:goCap})];
const iState=Object.assign({},goState,{pieces:iPieces,battle:{attP:iPieces[0],defP:iPieces[1],fa:iPieces[0],fd:goCap,buffA:"power",maxRounds:9}});
const inter=T.reduceCoreAction(iState,{t:"gameOver",winner:1,winType:"resign"});
const iA=inter.state.pieces[0], iD=inter.state.pieces[1];
ok(inter.state.battle===null&&iA!==iPieces[0]&&iA.powerBuff===false&&iA.fleeBoost===false&&iA.burn===0&&iA.shield===0&&iA.cd===0&&iA.hp===30&&iD!==iPieces[1]&&iD.cap!==goCap&&iD.cap.powerBuff===false&&iD.cap.fleeBoost===false&&iD.cap.burn===0&&iD.cap.shield===0&&iD.cap.hp===10,"a game over inside a live battle clears both fighters — body and stand-in alike — on clones, keeping their HP");
ok(iPieces[0].powerBuff===true&&iPieces[0].burn===4&&iPieces[1].cap===goCap&&goCap.powerBuff===true&&goCap.burn===3&&iState.battle!==null&&iState.pieces===iPieces&&inter.events[0].interrupted===true&&inter.events[0].banner===true,"the input battle and its fighter graph stay untouched and the event marks the interrupted cleanup for the display layer");
/* 상태 순수성: 리듀서 상태와 전역 S 가 갈려도 결과는 **받은 상태만** 따른다 (온라인 재생·AI 탐색 경로) */
const goDigest=r=>JSON.stringify({ev:r.events,phase:r.state.phase,winner:r.state.winner,metrics:r.state.metrics,
  where:r.state.pieces.map(piece=>[piece.id,piece.powerBuff,piece.burn,piece.shield,piece.cap?piece.cap.burn:null])});
const goAgreed=goDigest(T.reduceCoreAction(iState,{t:"gameOver",winner:1,winType:"resign"}));
const liveOver={phase:T.S.phase,current:T.S.current,turnCount:T.S.turnCount,winner:T.S.winner,battle:T.S.battle,pieces:T.S.pieces};
Object.assign(T.S,{phase:"over",current:1,turnCount:999,winner:0,battle:null,pieces:[]});
const goHostile=goDigest(T.reduceCoreAction(iState,{t:"gameOver",winner:1,winType:"resign"})), resignHostile=T.reduceCoreAction(goState,{t:"resign"});
Object.assign(T.S,liveOver);
ok(goHostile===goAgreed&&resignHostile.state.winner===1&&resignHostile.events[0].resignLoser===0&&resignHostile.state.metrics.endTurn===9,"the match-end reducer reads the board, turn count and current player from its state argument only, so a hostile global S changes nothing");
/* end-to-end: 오프라인 기권 — 상태·로그·배너가 각각 정확히 한 번 */
H.freshPlay(T,"pvp"); T.S.turnCount=7; T.S.matchFxDone=false; T.FX.log.length=0;
T.applyAction({t:"resign"});
ok(T.S.phase==="over"&&T.S.winner===1&&T.S.metrics.winType==="resign"&&T.S.metrics.winner===1&&T.S.metrics.endTurn===7&&T.S.log.filter(line=>/기권 —/.test(line.msg)).length===1&&T.FX.log.filter(x=>x.key==="resultBanner").length===1,"an offline resign applies once through the Core boundary: one match end, one resign log and exactly one match banner");
T.FX.log.length=0; T.applyAction({t:"resign"});
ok(T.S.matchFxDone===true&&T.FX.log.filter(x=>x.key==="resultBanner").length===0,"a repeated match end plays no second banner (the match-level flag stays consumed)");
/* end-to-end: 수신한 온라인 기권 프레임도 같은 Core 액션 하나를 지난다 */
H.freshPlay(T,"pvp"); T.S.current=1; T.S.matchFxDone=false; T.FX.log.length=0;
T.NET.mode=true; T.NET.me=0; T.NET.replaying=true;
T.netAction({t:"resign"});
T.NET.replaying=false; T.NET.mode=false; T.NET.me=null;
ok(T.S.phase==="over"&&T.S.winner===0&&T.S.metrics.winType==="resign"&&T.S.log.filter(line=>/기권 —/.test(line.msg)).length===1&&T.FX.log.filter(x=>x.key==="resultBanner").length===1,"a received network resign frame routes through the same Core action and ends the match exactly once");
/* end-to-end: 살아 있는 전투 중 기권 — 본체 출전(공격)·대리 출전(방어, piece.cap) 둘 다 호출처가 들고 있는 그 객체에서 정리되고, 낡은 전투창 마크업은 비워진다 */
H.freshPlay(T,"pvp"); T.S.matchFxDone=false; T.FX.log.length=0;
const bAtt=H.mine(T,0,"minion")[0], bDef=H.mine(T,1,"ally")[0];
H.place(T,bAtt,12,4); H.place(T,bDef,11,4);
bDef.cap={element:"fire",hp:40,maxHp:60,atk:10,skillAtk:12,cd:0,cdMax:3,skills:null,cds:null,revealedSkills:[],artRosterId:null};
const heldCap=bDef.cap; // 전투원 fa/fd·전투 UI·AI·예약 콜백이 들고 있는 바로 그 참조
T.startRounds(bAtt,bDef,bAtt,heldCap);
bAtt.powerBuff=true; bAtt.shield=8; heldCap.burn=3; heldCap.shield=5; heldCap.powerBuff=true; heldCap.fleeBoost=true;
T.applyAction({t:"resign"});
const liveDef=T.S.pieces.find(x=>x.id===bDef.id);
ok(T.S.battle===null&&T.S.recruit===null&&T.S.pieces.includes(bAtt)&&liveDef===bDef&&bAtt.powerBuff===false&&bAtt.shield===0&&(T.byId("overlayBox")?T.byId("overlayBox").innerHTML==="":true)&&T.S.phase==="over","a resign during a live battle clears the battle on the very piece objects the callers hold and empties the stale battle markup");
ok(liveDef.cap===heldCap&&heldCap.powerBuff===false&&heldCap.fleeBoost===false&&heldCap.burn===0&&heldCap.shield===0&&heldCap.cd===0&&heldCap.hp===40,"commit keeps the canonical stand-in fighter object identity, so the cap reference the callers hold is still exactly S.pieces[i].cap and carries the reset battle flags");
/* Saturn M2 회귀: 중단된 전투의 화면 정리(fxReleaseAll)와 경기 결과 배너의 **순서**. 정리가 배너 뒤에 오면 방금 시작한
   resultBanner 가 큐·기록과 함께 지워지는데, 1회 보장 플래그(matchFxDone)는 이미 소비돼 배너가 영영 다시 나오지 않는다.
   연출 시간이 실제로 흐르는 화면(FX.force)에서 배너가 **살아 있는 현재 항목**으로 남는지까지 본다 — 0ms 헤드리스만 보면
   "즉시 끝난 배너"와 "지워진 배너"가 구분되지 않는다. */
{
  H.freshPlay(T,"pvp"); T.S.matchFxDone=false; T.FX.log.length=0;
  const mAtt=H.mine(T,0,"minion")[0], mDef=H.mine(T,1,"minion")[0];
  H.place(T,mAtt,12,4); H.place(T,mDef,11,4);
  T.startRounds(mAtt,mDef,mAtt,mDef);
  T.FX.force=true; T.FX.log.length=0; T.TQ.length=0;   // 여기부터만 사람 화면과 같은 시간 — 전투 준비는 종전과 같은 0ms 경로
  T.applyAction({t:"resign"});
  const live=T.FX.cur, banners=T.FX.log.filter(x=>x.key==="resultBanner");
  T.FX.force=false; T.FX.q.length=0; T.FX.cur=null; T.TQ.length=0;
  ok(T.S.phase==="over"&&T.S.battle===null&&T.S.matchFxDone===true,"resigning inside a live battle still ends the match and consumes the once-per-match banner latch");
  ok(banners.length===1&&!!live&&live.key==="resultBanner"&&/match/.test(live.cls||""),
     `the interrupted-battle cleanup reaches the display layer before the match banner, so the banner survives as the live FX item instead of being erased by fxReleaseAll (live=${live?live.key+"/"+(live.cls||""):"none"}, logged=${banners.length})`);
}
/* 단일 경로: 정규 래퍼 하나가 Core 로 들어가고 레거시 종료 변이 경로는 남지 않는다 */
ok(/function gameOver\(winner,type\)\{ dispatchCoreAction\(\{t:"gameOver",winner,winType:type,endingBattle:ENDING_BATTLE\}\); \}/.test(T.html)&&!/case "resign"\s*:/.test(fs.readFileSync(path.join(demo,"js","network.js"),"utf8"))&&(T.html.match(/type:"matchEnded"/g)||[]).length===1&&!/S\.phase="over"; *S\.winner=/.test(T.html),"one canonical gameOver wrapper dispatches the Core action, and no legacy match-end mutation or duplicate resign path survives");
/* #245 Saturn REVISE(M3) 행동 검증: 경기 결과 배너의 **1회 보장**은 규칙 상태(S.matchFxDone)이고 Core 가 소유한다.
   화면이 그 배너를 그리든 말든 두 번째 경기 종료는 배너를 다시 내지 않는다 — 표시 계층을 거치지 않고 확인한다. */
{
  const X=H.load();
  H.freshPlay(X,"pvp");
  ok(X.S.matchFxDone===false&&typeof X.matchEndBanner==="function","match banner latch starts down on a fresh game");
  const first=X.matchEndBanner();
  ok(!!first&&typeof first.title==="string"&&X.S.matchFxDone===true,"the first match-end banner is issued by Core and raises the once-per-match latch in game state");
  ok(X.matchEndBanner()===null,"a second request in the same match returns nothing — the guarantee is rule state, not a display flag");
}

/* ===== #245 Saturn REVISE(M1·M2·M3·M4) 최종 경계 — **행동으로** 확인한다 =====
   (a) 어댑터 포트는 데이터 싱크와 값 질의뿐이다 (콜백 계약 없음)
   (b) 화면·AI 어댑터가 하나도 없어도 규칙은 끝까지 진행된다
   (c) 전투 개시는 신뢰 경계를 지난다 (떨어진 말·죽은 말·같은 편·형태 위반은 정확한 무변경)
   (d) 새 경기는 단일 커밋 경계를 지난다 */
{
  const X=H.load();
  /* (a) 포트에 남은 것은 event/seat/replaying 셋뿐이고, 기본 구현은 어느 것도 콜백을 실행하지 않는다 */
  const stateSrc=fs.readFileSync(path.join(demo,"js","state.js"),"utf8");
  const portBody=stateSrc.slice(stateSrc.indexOf("const UI_PORT={"),stateSrc.indexOf("/** @type {GameState} */"));
  ok(/event\(ev\)\{\}/.test(portBody)&&/defer\(action\)\{ return false; \}/.test(portBody)
     &&!/onStart|onEnd|aiSchedule|aiSetup|aiRecruit|whenIdle|battleEndFx|fx\(/.test(portBody),
     "어댑터 포트 기본 구현에는 콜백 실행도 AI 훅도 없다 — 데이터 싱크(event)·값 질의(seat·replaying)·지연 거절(defer→false)뿐이다");
  const coreSrc245=fs.readFileSync(path.join(demo,"js","core.js"),"utf8");
  const portCalls=(coreSrc245.match(/UI_PORT\.[a-zA-Z]+\(/g)||[]).map(s=>s.slice(8,-1));
  ok(portCalls.every(n=>n==="event"||n==="seat"||n==="replaying"||n==="defer"),
     "Core 가 부르는 포트는 event·seat·replaying·defer 뿐이다 (실측: "+[...new Set(portCalls)].join(",")+")");
  /* #245 Saturn REVISE(M2): defer 로 건너가는 것도 **직렬화 가능한 액션 값** 하나뿐이다 — 콜백은 경계를 넘지 않는다 */
  ok(/function resumeCoreAction\(action\)\{ if\(!UI_PORT\.defer\(action\)\) dispatchCoreAction\(action\); \}/.test(coreSrc245)
     &&!/type:"whenIdle"/.test(coreSrc245)&&!/resume:\{/.test(coreSrc245),
     "규칙을 잇는 다음 액션은 Core 가 소유한다 — 미루지 않으면 그 자리에서 실행하고, whenIdle·resume 이벤트는 남아 있지 않다");
  /* (a2) **결정적 증거**: data.js·state.js·core.js 만 완전히 빈 VM 에 실어도 규칙이 끝까지 돈다.
     이 VM 에는 window·document·타이머·ui.js·network.js·ai.js·bootstrap.js 가 하나도 없다 — Jupiter 가 소비할 경계 그대로다.
     소스 문자열 검사가 아니라 **실제로 돌려 본 결과**로 본다 (합법 이동 커밋 · 형태 위반 거부 · 턴 종료). */
  {
    const vm=require("vm");
    const ctx=vm.createContext(Object.create(null));
    vm.runInContext("var globalThis=this;",ctx);
    for(const n of ["data.js","state.js","core.js"]) vm.runInContext(fs.readFileSync(path.join(demo,"js",n),"utf8"),ctx,{filename:n});
    const r=JSON.parse(vm.runInContext(`(function(){
      newGame("pvp",{});
      const rows0=[11,12,13], rows1=[1,2,3];
      S.pieces.filter(x=>x.owner===0).forEach((x,i)=>{x.r=rows0[i%3];x.c=(i%7)+1;x.placed=true;});
      S.pieces.filter(x=>x.owner===1).forEach((x,i)=>{x.r=rows1[i%3];x.c=(i%7)+1;x.placed=true;});
      S.phase="play"; S.current=0; S.mainUsed=false;
      const m=S.pieces.find(x=>x.owner===0&&x.type==="minion"); m.r=7; m.c=4;
      const moved=!!dispatchCoreAction({t:"move",id:m.id,r:6,c:4});
      const at=[m.r,m.c];
      const bad=[{r:5.5,c:4},{r:"5",c:4},{r:14,c:4},{r:6,c:0}]
        .map(q=>dispatchCoreAction({t:"move",id:m.id,r:q.r,c:q.c}));
      const still=[m.r,m.c];
      const ended=!!dispatchCoreAction({t:"endTurn"});
      return JSON.stringify({moved,at,badRejected:bad.every(x=>x===false),still,ended,turn:S.turnCount,log:S.log.length});
    })()`,ctx));
    ok(r.moved===true&&r.at[0]===6&&r.at[1]===4,"빈 VM(data+state+core 만): 합법 이동이 실제로 커밋된다 — 화면·AI·네트워크 없이 규칙이 돈다");
    ok(r.badRejected===true&&r.still[0]===6&&r.still[1]===4,"빈 VM: 소수·문자열·보드 밖 좌표는 전부 거부되고 말은 제자리다");
    ok(r.ended===true&&r.turn===1&&r.log>0,"빈 VM: 턴 종료까지 진행되고 공개 기록도 Core 가 쓴다");
    /* #245 Saturn REVISE(M2): 규칙을 **잇는 다음 단계**도 같은 VM 에서 끝난다. 종전에는 도망 성공 뒤 교환 화면과
       탐색 완료 래치가 whenIdle·battleEndFx.resume 이벤트로만 나가서, ui.js 가 없으면 규칙이 그 자리에 멈췄다. */
    const c=JSON.parse(vm.runInContext(`(function(){
      newGame("pvp",{});
      const rows0=[11,12,13], rows1=[1,2,3];
      S.pieces.filter(x=>x.owner===0).forEach((x,i)=>{x.r=rows0[i%3];x.c=(i%7)+1;x.placed=true;});
      S.pieces.filter(x=>x.owner===1).forEach((x,i)=>{x.r=rows1[i%3];x.c=(i%7)+1;x.placed=true;});
      S.phase="play"; S.current=0; S.mainUsed=false;
      const m=S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=S.pieces.find(x=>x.owner===1&&x.type==="minion");
      m.r=7; m.c=4; e.r=6; e.c=4;                       // 나머지 말은 양쪽 자기 진영에 남아 후방 후보가 된다
      const opened=!!dispatchCoreAction({t:"battleStart",attId:m.id,defId:e.id})&&!!S.battle;
      const qPending=S.battle.msgQ.length;              // 개시 메시지가 **쌓인 채로** 둔다 — 규칙은 표시 큐를 보지 않는다
      BAL.fleeProb=1;                                   // 도망 성공을 확정해 **연속만** 본다
      const oks0=S.metrics.fleeOks;
      dispatchCoreAction({t:"flee",frame:battleCmdFrame()});
      const swap=S.fleePick?{owner:S.fleePick.owner,cands:S.fleePick.cands.length}:null;
      S.searchEndSeq=5;                                 // 탐색 완료 토큰 — searchDone 이 그 자리에서 래치해야 한다
      applyCoreEffects({type:"searchDone",owner:0,seq:5,title:"",sub:"",fxKey:"itemFx"});
      return JSON.stringify({opened,qPending,fled:S.metrics.fleeOks-oks0,battle:!!S.battle,swap,latch:S.searchEndSeq});
    })()`,ctx));
    ok(c.opened&&c.fled===1&&!c.battle&&!!c.swap&&c.swap.cands>0,
       "빈 VM: 도망 성공의 **다음 단계**(후방 말 교환 화면)가 화면 없이 그 자리에서 열린다 (후보 "+(c.swap?c.swap.cands:"없음")+")");
    ok(c.qPending>0,"빈 VM 전제: 전투 개시로 표시 큐에 메시지가 "+c.qPending+"개 쌓여 있었다 (손으로 비우지 않았다)");
    ok(c.latch===5.5,"빈 VM: 탐색 완료 래치도 연출을 기다리지 않고 그 자리에서 올라간다 (실측 "+c.latch+")");
  }
  /* (a3) #245 Saturn REVISE(M2) **결정적 증거**: data·state·core·**ai** 만 빈 VM 에 실어도 AI 가 전투와 탐색 보상을 끝낸다.
     이 VM 에는 window·document·타이머·netAction·ui.js 가 하나도 없다 — 종전 AI 는 window.__act/__flee/__useItem/
     __recruitCore 와 netAction 을 지나 **표시 계층이 자기 렌더에 굳혀 둔 프레임**을 빌려 썼기 때문에 여기서 한 수도 두지 못했다. */
  {
    const vm=require("vm");
    const ctx=vm.createContext(Object.create(null));
    vm.runInContext("var globalThis=this;",ctx);
    for(const n of ["data.js","state.js","core.js","ai.js"]) vm.runInContext(fs.readFileSync(path.join(demo,"js",n),"utf8"),ctx,{filename:n});
    const r=JSON.parse(vm.runInContext(`(function(){
      setSeed(245);
      newGame("sim",{});                               // 양측 AI — 전투 행동을 고르는 쪽이 둘 다 어댑터다
      const rows0=[11,12,13], rows1=[1,2,3];
      S.pieces.filter(x=>x.owner===0).forEach((x,i)=>{x.r=rows0[i%3];x.c=(i%7)+1;x.placed=true;});
      S.pieces.filter(x=>x.owner===1).forEach((x,i)=>{x.r=rows1[i%3];x.c=(i%7)+1;x.placed=true;});
      S.phase="play"; S.current=1; S.mainUsed=true;    // 주 행동은 끝난 자리 — 여기서는 전투 경로만 본다
      const att=S.pieces.find(x=>x.owner===1&&x.type==="minion"), def=S.pieces.find(x=>x.owner===0&&x.type==="minion");
      att.r=7; att.c=4; def.r=6; def.c=4;
      const opened=!!dispatchCoreAction({t:"battleStart",attId:att.id,defId:def.id})&&!!S.battle;
      let acts=0, guard=0, qMax=0;                     // 표시 큐는 **한 번도 비우지 않는다** — 아무도 재생하지 않으니 계속 쌓인다
      while(S.battle&&guard++<400){
        const B=S.battle, seq=B.actSeq, blen=B.blog.length; // 아이템·패키지는 **행동 미소모**라 토큰이 아니라 전투 이력이 는다
        aiBattleAction();
        qMax=Math.max(qMax,(S.battle===B?B.msgQ.length:0));
        if(B.actSeq===seq&&B.blog.length===blen&&S.battle===B) break; // 한 수도 두지 못했다 — 아래 단언이 잡는다
        acts++;
      }
      const battleDone=!S.battle&&acts>0;
      /* 탐색 보상: recruit 을 규칙 경로로 열고 AI 가 같은 Core 액션(recruit)으로 끝낸다 */
      S.battle=null; S.fleePick=null; S.mainUsed=false; S.current=1; S.forcedTargets=[]; S.movedPiece=null;
      const p=alivePieces().find(x=>x.owner===1&&x.type==="minion");
      p.r=4; p.c=4; S.events=[{r:4,c:4,kind:"recruit",consumed:false}]; S.traces[1].add("4_4");
      const searched=!!dispatchCoreAction({t:"search",id:p.id,r:4,c:4,ei:0});
      const recruitOpen=!!S.recruit;
      if(S.recruit) aiRecruitResolve(1,p);
      return JSON.stringify({opened,acts,qMax,battleDone,searched,recruitOpen,recruitLeft:!!S.recruit});
    })()`,ctx));
    ok(r.opened&&r.battleDone,"빈 VM(data+state+core+ai): AI 가 window·netAction·표시 계층 없이 전투를 끝까지 둔다 (AI 전투 행동 "+r.acts+"회)");
    ok(r.qMax>0,"빈 VM: 표시 큐를 손으로 비우지 않아도(잔여 최대 "+r.qMax+"개) 규칙이 끝까지 나아간다 — Core 합법성이 msgQ 를 보지 않는다");
    ok(r.searched&&r.recruitOpen&&!r.recruitLeft,"빈 VM: AI 탐색 보상 선택도 같은 Core 액션(recruit)으로 그 자리에서 끝난다");
  }
  /* (b) 화면도 AI 도 없는 런타임: 포트를 데이터 싱크로 갈아 끼우고 같은 seed 로 진행해도 규칙 상태가 그대로 나아간다 */
  {
    const Y=H.load();
    H.freshPlay(Y,"pvp"); H.clearBoard(Y);
    const mover=Y.S.pieces.find(p=>p.owner===0&&p.type==="minion");
    H.place(Y,mover,12,4);
    H.place(Y,Y.S.pieces.find(p=>p.owner===0&&p.type==="king"),13,1);
    H.place(Y,Y.S.pieces.find(p=>p.owner===1&&p.type==="king"),1,7);
    Y.S.current=0; Y.S.mainUsed=false;
    const seen=[];
    Y.UI_PORT.event=ev=>{ seen.push(ev.type); };   // 화면 없음 — 이벤트를 받아 버리기만 한다
    const moved=Y.dispatchCoreAction({t:"move",id:mover.id,r:11,c:4});
    ok(!!moved&&mover.r===11&&mover.c===4&&Y.S.mainUsed===true&&seen.length>0,
       "화면이 이벤트를 버리기만 해도 이동 규칙은 dispatch 안에서 끝난다 (상태 전이가 화면 소비에 매달려 있지 않다)");
    const endOk=Y.dispatchCoreAction({t:"endTurn"});
    ok(!!endOk&&Y.S.turnCount===1&&Y.S.mainUsed===false,"턴 종료도 같다 — 규칙 진행에 표시 계층이 필요 없다");
  }
  /* (b2) Core → 어댑터로 나가는 이벤트에는 **함수가 하나도 실리지 않는다**. 소스 검사가 아니라 실제 한 판을 끝까지 돌려
     포트를 지나간 모든 이벤트를 깊이 훑는다 (규칙 실행 이벤트는 Core 가 먼저 소비하므로 여기 오지 않는다). */
  {
    const W=H.load();
    const fnHits=[];
    const scan=(v,p,seen)=>{ if(v===null||typeof v!=="object"){ if(typeof v==="function") fnHits.push(p); return; }
      if(seen.has(v)) return; seen.add(v);
      if(v instanceof Set||v instanceof Map) return;
      for(const k of Object.keys(v)){ const x=v[k];
        if(typeof x==="function"){ fnHits.push(p+"."+k); continue; }
        if(x&&typeof x==="object") scan(x,p+"."+k,seen); } };
    const base=W.UI_PORT.event;
    let count=0;
    W.UI_PORT.event=ev=>{ count++; scan(ev,ev.type,new Set()); return base(ev); };
    const sim=H.runSim(W,["grade5","grade5"],4245);
    ok(count>50&&!!sim,"한 판을 끝까지 돌려 포트를 지나간 이벤트를 전부 검사했다 (이벤트 "+count+"건)");
    ok(fnHits.length===0,"Core 가 어댑터로 내보내는 이벤트에는 함수가 한 칸도 없다 — 전부 직렬화 가능한 값이다"+(fnHits.length?" (실측: "+fnHits.slice(0,5).join(",")+")":""));
  }
  /* (c) 전투 개시의 신뢰 경계 */
  {
    H.freshPlay(X,"pvp"); H.clearBoard(X);
    const a=X.S.pieces.find(p=>p.owner===0&&p.type==="minion");
    const foes=X.S.pieces.filter(p=>p.owner===1&&p.type==="minion");
    const d=foes[0], far=foes[1], mate=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[1];
    H.place(X,a,7,4); H.place(X,d,6,4); H.place(X,far,3,1); H.place(X,mate,7,5);
    H.place(X,X.S.pieces.find(p=>p.owner===0&&p.type==="king"),13,1);
    H.place(X,X.S.pieces.find(p=>p.owner===1&&p.type==="king"),1,7);
    X.S.current=0; X.S.battlesUsed=0; X.S.battle=null;
    const snap=()=>JSON.stringify([X.S.battlesUsed,X.S.metrics.forcedBattles,X.S.forcedTargets,
      X.S.pieces.map(p=>[p.id,p.alive,p.immobile,p.revealed])]);
    const before=snap();
    const BAD=[
      {why:"보드에서 떨어져 있는 적",a:{t:"battleStart",attId:a.id,defId:far.id}},
      {why:"같은 편",a:{t:"battleStart",attId:a.id,defId:mate.id}},
      {why:"같은 말",a:{t:"battleStart",attId:a.id,defId:a.id}},
      {why:"없는 말 id",a:{t:"battleStart",attId:a.id,defId:999999}},
      {why:"정수가 아닌 id",a:{t:"battleStart",attId:a.id,defId:"6"}}];
    let rej=0, frozen=0;
    for(const b of BAD){ if(X.reduceCoreAction(X.S,b.a)===null) rej++; if(snap()===before) frozen++; }
    ok(rej===BAD.length&&frozen===BAD.length&&X.S.battle===null,
       "전투 개시는 신뢰 경계를 지난다 — 떨어진 말·같은 편·같은 말·없는 id·형태 위반은 전부 정확한 무변경 ("+BAD.length+" 사례)");
    const dead=X.S.pieces.find(p=>p.owner===1&&p.type==="minion"&&p!==d&&p!==far);
    H.place(X,dead,8,4); dead.alive=false;
    const before2=snap();
    ok(X.reduceCoreAction(X.S,{t:"battleStart",attId:a.id,defId:dead.id})===null,"제거된 말로는 전투가 열리지 않는다");
    /* 대조: 인접한 살아 있는 적과는 정상적으로 열린다 (개시 실행은 dispatch 안에서 끝난다) */
    const okStart=X.reduceCoreAction(X.S,{t:"battleStart",attId:a.id,defId:d.id});
    ok(!!okStart&&okStart.events.length===1&&okStart.events[0].type==="battleBegan",
       "대조: 인접한 적과의 개시는 battleBegan 이벤트 하나로 나간다 (reducer 는 말을 건드리지 않는다)");
    ok(snap()===before2,"거부·수락 어느 쪽도 reducer 단계에서는 말·전투 회계를 건드리지 않는다");
    /* #245 Saturn REVISE(M4 후속): **세부 합법성도** 같은 경계에서 본다. 종전에는 canBattle·forcedPickOk 를
       부르는 쪽(클릭 경로·AI)에만 맡겨 두어, 그 게이트를 지나지 않은 호출이 남의 차례·세 번째 전투·강제 표식 밖
       대상·도망 교환 중에도 전투를 열 수 있었다. 네 갈래 전부 정확한 무변경(null)이어야 한다. */
    {
      const probe=(why,mut,undo)=>{ mut(); const b=snap();          // 기준선은 **그 불법 상황 그대로**의 상태다
        const r=X.reduceCoreAction(X.S,{t:"battleStart",attId:a.id,defId:d.id});
        const frozen=snap()===b; undo(); return {why,rejected:r===null,frozen}; };
      const P=[
        probe("남의 차례(공격측이 행동자가 아니다)",()=>{X.S.current=1;},()=>{X.S.current=0;}),
        probe("전투 횟수 소진(세 번째 전투)",()=>{X.S.battlesUsed=2;},()=>{X.S.battlesUsed=0;}),
        probe("강제 표식 밖 대상",()=>{X.S.movedPiece=a; X.S.forcedTargets=[far.id];},()=>{X.S.movedPiece=null; X.S.forcedTargets=[];}),
        probe("강제 표식의 공격측이 아닌 말",()=>{X.S.movedPiece=mate; X.S.forcedTargets=[d.id];},()=>{X.S.movedPiece=null; X.S.forcedTargets=[];}),
        probe("도망 교환 선택 중",()=>{X.S.fleePick={owner:0,cands:[],token:"t"};},()=>{X.S.fleePick=null;})];
      ok(P.every(x=>x.rejected&&x.frozen)&&X.S.battle===null,
         "전투 개시는 canBattle·forcedPickOk 계약도 지난다 — "+P.map(x=>x.why).join(" · ")+" 는 전부 정확한 무변경"
         +(P.every(x=>x.rejected&&x.frozen)?"":" (실패: "+P.filter(x=>!(x.rejected&&x.frozen)).map(x=>x.why).join(",")+")"));
      /* 대조 1: 합법 강제 전투는 그대로 열리고 표식·지표만 reducer 가 순수하게 정리한다 */
      X.S.movedPiece=a; X.S.forcedTargets=[d.id];
      const forcedOk=X.reduceCoreAction(X.S,{t:"battleStart",attId:a.id,defId:d.id});
      ok(!!forcedOk&&forcedOk.events[0].type==="battleBegan"&&forcedOk.state.forcedTargets.length===0
         &&forcedOk.state.metrics.forcedBattles===X.S.metrics.forcedBattles+1,
         "대조: 합법 강제 전투는 열리고 표식 회수·forcedBattles 만 reducer 안에서 끝난다");
      /* 대조 2: 폭탄은 **강제 접촉일 때만** 공격측이 된다 (능동 클릭 경로의 폭탄 공격 불가는 그대로) */
      const bomb=X.S.pieces.find(p=>p.owner===0&&p.type==="bomb");
      H.place(X,bomb,7,3); H.place(X,d,6,3);
      X.S.movedPiece=bomb; X.S.forcedTargets=[];
      ok(X.reduceCoreAction(X.S,{t:"battleStart",attId:bomb.id,defId:d.id})===null,
         "강제 표식 없는 폭탄 공격은 종전대로 열리지 않는다 (canBattle 의 폭탄 제외)");
      X.S.forcedTargets=[d.id];
      const bombOk=X.reduceCoreAction(X.S,{t:"battleStart",attId:bomb.id,defId:d.id});
      ok(!!bombOk&&bombOk.events[0].type==="battleBegan",
         "대조: 강제 접촉의 폭탄 갈래(contactEligible)는 그대로 열린다");
      X.S.movedPiece=null; X.S.forcedTargets=[];
    }
  }
  /* (d) 새 경기 단일 커밋 경계 — 전역 S 대입은 state.js 의 commitNewGame 한 곳뿐이다 */
  {
    const assigns=["data.js","state.js","ui.js","core.js","ai.js","ui-overlays.js","network.js","bootstrap.js"]
      .map(n=>{ const src=fs.readFileSync(path.join(demo,"js",n),"utf8").replace(/\blet\s+S\s*=\s*null;/,""); // 선언은 대입이 아니다
        return [n,(src.match(/(^|[^.$\w])S\s*=[^=]/gm)||[]).length]; });
    const total=assigns.reduce((n,[,k])=>n+k,0);
    ok(total===1&&assigns.find(([n])=>n==="state.js")[1]===1,
       "전역 S 에 대입하는 자리는 state.js 한 곳뿐이다 (실측 "+total+"곳: "+assigns.filter(([,k])=>k).map(([n,k])=>n+"×"+k).join(",")+")");
    ok(/function commitNewGame\(game\)\{[\s\S]*?S=game;/.test(stateSrc)&&/commitNewGame\(newGameState\(mode,opts\)\);/.test(stateSrc),
       "새 경기는 commitNewGame 한 곳에서 교체되고 '이전 경기 무효' 고지가 같은 자리에 붙어 있다");
    const Z=H.load(); const g1=Z.S; Z.newGame("pvp",{});
    ok(Z.S!==g1&&Z.S.turnCount===0&&Z.S.phase==="setup","새 경기는 같은 객체를 덮어쓰지 않고 새 정체성으로 교체된다 (옛 예약 콜백의 세대 구분이 살아 있다)");
  }
}
/* ===== #245 탐색·보상 선택 — 규칙 상태는 Core reducer, 모달·로그·토스트·튜토리얼·연출은 이벤트 ===== */
const J245=JSON.stringify;
/* #245 Saturn REVISE: recruit 액션은 모든 step 에 토큰이 필수다. 픽스처의 토큰 형식도 코어와 같다 — "탐색한 말 id#이 게임의 몇 번째 recruit" */
const RTOK="901#1";
const RC=(step,i)=>T.__recruitCore(step,i,T.S.recruit&&T.S.recruit.token); // 살아 있는 recruit 의 토큰을 실어 주는 테스트 호출기
const srchPieces=[{id:901,owner:0,type:"minion",alive:true,placed:true,r:9,c:3,hp:50,maxHp:50,healing:true,skills:["s0","s1","s2","s3"],cds:[2,1,0,0],revealedSkills:[0,1]},
  {id:902,owner:0,type:"ally",alive:true,placed:true,r:9,c:4,hp:40,maxHp:40,cap:null}];
const srchState={phase:"play",mode:"pvp",current:0,mainUsed:false,selected:null,recruit:null,balls:[3,3],pieces:srchPieces,
  events:[{r:9,c:3,kind:"battleBuff",consumed:false}],pkgs:[{itemGift:0,battleBuff:0},{itemGift:0,battleBuff:0}],
  traces:[new Set(["9_3"]),new Set()],metrics:{searches:0,minionSearches:0,byPlayer:[{},{}]}};
const pkgR=T.reduceCoreAction(srchState,{t:"search",id:901,r:9,c:3});
ok(srchState.mainUsed===false&&srchState.recruit===null&&srchState.searchEndSeq===undefined&&srchPieces[0].healing===true&&srchState.events[0].consumed===false&&srchState.pkgs[0].battleBuff===0&&srchState.metrics.searches===0&&srchState.metrics.byPlayer[0].searches===undefined,"search reducer leaves the input piece, event cell, package stock, metrics and main-action flag untouched");
ok(pkgR.state!==srchState&&pkgR.state.mainUsed===true&&pkgR.state.events!==srchState.events&&pkgR.state.events[0]!==srchState.events[0]&&pkgR.state.events[0].consumed===true&&pkgR.state.pieces[0]!==srchPieces[0]&&pkgR.state.pieces[0].healing===false&&pkgR.state.pieces[1]===srchPieces[1]&&pkgR.state.pkgs[0].battleBuff===1&&pkgR.state.pkgs[1]===srchState.pkgs[1]&&pkgR.state.metrics.searches===1&&pkgR.state.metrics.minionSearches===1&&pkgR.state.metrics.byPlayer[0].searches===1&&pkgR.state.recruit===null&&pkgR.state.searchEndSeq===1,"search reducer returns the spent main action, consumed cell, broken heal posture, package grant and metrics on cloned state only");
ok(J245(pkgR.events.map(e=>e.type))===J245(["searched","searchDone"])&&pkgR.events[0].piece===pkgR.state.pieces[0]&&pkgR.events[0].owner===0&&pkgR.events[0].healBroken===true&&pkgR.events[1].tut==="pkg"&&pkgR.events[1].seq===1&&/보유 1개/.test(pkgR.events[1].sub),"search reducer emits the public-log event then the owner-only completion event carrying the piece that lives in the returned state");
ok(T.reduceCoreAction(Object.assign({},srchState,{pieces:[Object.assign({},srchPieces[0],{type:"bomb"})]}),{t:"search",id:901,r:9,c:3}).events[0].type==="searchRefused"&&T.reduceCoreAction(srchState,{t:"search",id:901,r:9,c:4}).events.length===0&&T.reduceCoreAction(srchState,{t:"search",id:999,r:9,c:3}).events.length===0&&T.reduceCoreAction(Object.assign({},srchState,{events:[{r:9,c:3,kind:"battleBuff",consumed:true}]}),{t:"search",id:901,r:9,c:3}).events.length===0,"search reducer refuses a bomb with a reason, and silently drops a mismatched cell, an unknown id and an already consumed cell");
ok(T.reduceCoreAction(Object.assign({},srchState,{events:[{r:9,c:3,kind:"potion",consumed:false}]}),{t:"search",id:901,r:9,c:3}).state.pkgs[0].battleBuff===0,"a discarded legacy event kind consumes the cell with no reward");
/* recruit 개시: 후보 종 추첨에 rand 를 **정확히 1회**만 쓴다 (계약 6 후보 고정) */
const recState=Object.assign({},srchState,{events:[{r:9,c:3,kind:"recruit",consumed:false}]});
T.setSeed(245); const randSeq=[T.rand(),T.rand()];
T.setSeed(245); const recR=T.reduceCoreAction(recState,{t:"search",id:901,r:9,c:3});
ok(T.rand()===randSeq[1]&&recState.recruit===null&&recState.recruitToken===undefined&&recR.state.recruit.owner===0&&recR.state.recruit.pieceId===901&&recR.state.recruit.stage==="root"&&recR.state.recruit.token===RTOK&&recR.state.recruitToken===1&&recR.state.searchEndSeq===undefined&&J245(recR.events.map(e=>e.type))===J245(["searched","recruitOpened"]),"recruit search draws the candidate species with exactly one rand and opens the choice without finishing the search");
/* 단계 전이·선택 값은 전부 복제본에만 쓴다 */
const rootState=Object.assign({},recState,{recruit:{owner:0,pieceId:901,species:T.ROSTER[0].id,stage:"root",skill:null,targetId:null,recvId:null,token:RTOK}});
const capR=T.reduceCoreAction(rootState,{t:"recruit",step:"cap",i:0,token:RTOK});
ok(rootState.recruit.stage==="root"&&capR.state!==rootState&&capR.state.recruit!==rootState.recruit&&capR.state.recruit.stage==="capRecv"&&capR.state.recruit.species===rootState.recruit.species&&capR.events[0].type==="recruitStage","recruit stage reducer advances on a cloned recruit record and keeps the fixed candidate species");
const recvR=T.reduceCoreAction(capR.state,{t:"recruit",step:"recv",i:0,token:RTOK});
const backR=T.reduceCoreAction(recvR.state,{t:"recruit",step:"back",i:0,token:RTOK});
ok(recvR.state.recruit.recvId===902&&recvR.state.recruit.stage==="capMode"&&capR.state.recruit.recvId===null&&backR.state.recruit.stage==="capRecv"&&backR.state.recruit.recvId===null&&recvR.state.recruit.recvId===902,"the receiver pick and the step back each return a fresh recruit record, clearing only the field that step drops");
T.setSeed(7);
const modeR=T.reduceCoreAction(recvR.state,{t:"recruit",step:"mode",i:0,token:RTOK}); // 안전 포획 (볼 2 · 100%)
const capPiece=modeR.state.pieces[1];
ok(srchPieces[1].cap===null&&srchState.balls[0]===3&&srchState.metrics.captures===undefined&&capPiece!==srchPieces[1]&&capPiece.cap&&capPiece.cap.rosterId===T.ROSTER[0].id&&modeR.state.balls!==srchState.balls&&modeR.state.balls[0]===1&&modeR.state.metrics.captures===1&&modeR.state.pieces[0]!==srchPieces[0]&&modeR.state.pieces[0].hp===50&&srchPieces[0].hp===50&&modeR.state.recruit===null&&modeR.state.searchEndSeq===1,"capture reducer spends the balls, attaches the stand-in and records the metric on clones only — the searcher that takes the attack-capture recoil is cloned too and keeps its HP on a safe capture");
/* 공격 포획 실패: 반동은 **탐색 말**이 받고(수령 말이 아니다) 그것도 복제본에만 쓴다 */
T.setSeed(2);
const failR=T.reduceCoreAction(Object.assign({},recvR.state,{balls:[1,3]}),{t:"recruit",step:"mode",i:2,token:RTOK});
ok(srchPieces[0].hp===50&&srchPieces[1].cap===null&&failR.state.pieces[0]!==srchPieces[0]&&failR.state.pieces[0].hp<50&&failR.state.pieces[1].cap===null&&failR.state.balls[0]===0&&failR.state.metrics.captureFails===1&&failR.state.metrics.captures===undefined&&/포획 실패/.test(failR.events[0].title)&&/탐색 말 HP/.test(failR.events[0].sub),"a failed attack capture puts the recoil on the cloned searcher, not the receiver, and leaves the input board whole");
ok(J245(modeR.events.map(e=>e.type))===J245(["searchDone"])&&modeR.events[0].fxKey==="captureFx"&&modeR.events[0].owner===0&&modeR.events[0].tut===undefined&&/포획 성공/.test(modeR.events[0].title),"a finished capture emits one owner-scoped searchDone with the capture effect key");
ok(T.reduceCoreAction(Object.assign({},recvR.state,{balls:[1,3]}),{t:"recruit",step:"mode",i:0,token:RTOK}).events.length===0&&T.reduceCoreAction(recvR.state,{t:"recruit",step:"mode",i:9,token:RTOK}).events.length===0&&T.reduceCoreAction(Object.assign({},rootState,{recruit:null}),{t:"recruit",step:"cap",i:0,token:RTOK}).events[0].type==="recruitClosed"&&T.reduceCoreAction(Object.assign({},rootState,{current:1}),{t:"recruit",step:"cap",i:0,token:RTOK}).events[0].type==="recruitClosed","the capture cost, an unknown method and a stale callback after a turn handover are all refused in Core, not in the modal");
const giveR=T.reduceCoreAction(rootState,{t:"recruit",step:"giveup",i:0,token:RTOK});
ok(giveR.state.recruit===null&&giveR.state.searchEndSeq===1&&giveR.state.events===rootState.events&&giveR.state.pkgs===rootState.pkgs&&giveR.state.balls===rootState.balls&&rootState.recruit!==null&&giveR.events[0].type==="searchDone","giving up clears the recruit record and issues the completion token without refunding the cell, the stock or the balls");
/* 기술 교체 확정 (#234 로 기본 비활성 — 분기는 보존되므로 켜서 계약을 확인한다) */
T.V2_INTERP.recruitSkillSwap=true;
const slotState=Object.assign({},recState,{recruit:{owner:0,pieceId:901,species:T.ROSTER[0].id,stage:"slot",skill:T.NEW_SKILLS[0],targetId:901,recvId:null,token:RTOK}});
const slotR=T.reduceCoreAction(slotState,{t:"recruit",step:"slot",i:0,token:RTOK});
const swapped=slotR.state.pieces[0];
ok(srchPieces[0].skills[0]==="s0"&&J245(srchPieces[0].revealedSkills)===J245([0,1])&&swapped!==srchPieces[0]&&swapped.skills!==srchPieces[0].skills&&swapped.skills[0]===T.NEW_SKILLS[0]&&J245(swapped.cds)===J245([2,1,0,0])&&J245(swapped.revealedSkills)===J245([1])&&slotR.state.recruit===null&&slotR.events[0].type==="searchDone","skill replacement writes the new skill and the re-hidden slot onto a cloned piece and skill list, inheriting the remaining cooldown");
ok(T.reduceCoreAction(slotState,{t:"recruit",step:"slot",i:4,token:RTOK}).events.length===0&&T.reduceCoreAction(Object.assign({},slotState,{recruit:Object.assign({},slotState.recruit,{skill:"s1"})}),{t:"recruit",step:"slot",i:0,token:RTOK}).events.length===0,"an out-of-range slot and a skill the target already carries are both refused in Core");
T.V2_INTERP.recruitSkillSwap=false;
ok(T.reduceCoreAction(slotState,{t:"recruit",step:"slot",i:0,token:RTOK}).events.length===0&&T.reduceCoreAction(rootState,{t:"recruit",step:"skills",i:0,token:RTOK}).events.length===0&&T.reduceCoreAction(rootState,{t:"recruit",step:"cap",i:0,token:RTOK}).events[0].type==="recruitStage","the #234 transitional switch closes the skill-swap steps in Core while capture and give-up stay open");
/* 상태 순수성: 리듀서 상태와 전역 S 가 갈려도 결과는 받은 상태만 따른다 (온라인 재생·AI 탐색 경로) */
const srchDigest=r=>J245({ev:r.events.map(e=>[e.type,e.owner,e.title||null]),main:r.state.mainUsed,pkg:r.state.pkgs,rec:r.state.recruit});
const srchAgreed=srchDigest(T.reduceCoreAction(srchState,{t:"search",id:901,r:9,c:3}));
const liveSearch={phase:T.S.phase,current:T.S.current,mainUsed:T.S.mainUsed,pieces:T.S.pieces,events:T.S.events,recruit:T.S.recruit};
Object.assign(T.S,{phase:"over",current:1,mainUsed:true,pieces:[],events:[],recruit:{owner:1,pieceId:1,stage:"capMode"}});
const srchHostile=srchDigest(T.reduceCoreAction(srchState,{t:"search",id:901,r:9,c:3})), capHostile=T.reduceCoreAction(rootState,{t:"recruit",step:"cap",i:0,token:RTOK});
Object.assign(T.S,liveSearch);
ok(srchHostile===srchAgreed&&capHostile.state.recruit.stage==="capRecv"&&capHostile.events[0].type==="recruitStage","the search and recruit reducers read the board, event cells, stock and recruit record from their state argument only, so a hostile global S changes nothing");
/* end-to-end: 턴바 [탐색] 한 번이 Core 를 정확히 한 번 지난다 — 주 행동·칸 소모·재고·회복 해제·공용 로그 */
H.freshPlay(T,"pvp");
const seeker=H.mine(T,0,"minion")[0];
T.S.current=0; T.S.mainUsed=false; T.S.selected=seeker; seeker.healing=true;
T.S.events=[{r:seeker.r,c:seeker.c,kind:"itemGift",consumed:false}]; T.S.traces[0].add(seeker.r+"_"+seeker.c);
const heldEv=T.S.events[0];
T.netAction({t:"search"});
ok(T.S.mainUsed===true&&heldEv.consumed===true&&T.S.events[0]===heldEv&&T.S.pkgs[0].itemGift===1&&T.S.pieces.includes(seeker)&&seeker.healing===false&&T.S.metrics.searches===1&&T.S.metrics.byPlayer[0].searches===1&&T.S.recruit===null&&T.S.log.filter(line=>/숲 이벤트 발생/.test(line.msg)).length===1&&T.S.log.filter(line=>/회복 자세 해제/.test(line.msg)).length===1,"an offline turn-bar search applies once through the Core boundary and commits onto the very event cell and piece the callers hold");
ok(!T.S.log.some(line=>/아이템 선물|전투 버프|보유 1개/.test(line.msg)),"the public log names neither the package kind nor the stock (GDD-13 4.7)");
T.netAction({t:"search"});
ok(T.S.pkgs[0].itemGift===1&&T.S.metrics.searches===1,"a second turn-bar search with the main action spent grants nothing");
/* end-to-end: recruit → 포획. 후보 종은 단계를 오가도 고정이고, 늦은 콜백은 아무것도 소모하지 않는다 */
H.freshPlay(T,"pvp");
const rSeeker=H.mine(T,0,"minion")[0], rRecv=H.mine(T,0,"ally")[0];
rRecv.cap=null; T.S.balls=[3,3]; T.S.current=0; T.S.mainUsed=false; T.S.selected=rSeeker;
T.S.events=[{r:rSeeker.r,c:rSeeker.c,kind:"recruit",consumed:false}]; T.S.traces[0].add(rSeeker.r+"_"+rSeeker.c);
T.setSeed(245); T.netAction({t:"search"});
const species=T.S.recruit&&T.S.recruit.species;
ok(!!species&&T.S.recruit.stage==="root"&&T.S.recruit.owner===0&&T.S.mainUsed===true&&T.S.events[0].consumed===true,"a recruit search opens the choice in Core while the cell and the main action are already spent");
RC("cap",0);
const recvIdx=T.capReceivers(0).findIndex(x=>x.id===rRecv.id);
RC("recv",recvIdx); RC("back",0); RC("recv",recvIdx);
ok(T.S.recruit.stage==="capMode"&&T.S.recruit.recvId===rRecv.id&&T.S.recruit.species===species&&T.S.balls[0]===3,"walking the capture stages back and forth re-draws no candidate species and spends nothing");
RC("mode",0);
ok(T.S.recruit===null&&T.S.pieces.includes(rRecv)&&rRecv.cap&&rRecv.cap.rosterId===species&&T.S.balls[0]===1&&T.S.metrics.captures===1,"the safe capture commits onto the very receiver object the callers hold and spends two balls");
RC("mode",0);
ok(T.S.balls[0]===1&&T.S.metrics.captures===1&&T.S.recruit===null,"a late duplicate capture callback after the recruit record is cleared changes nothing");
/* end-to-end: 포기도 칸·주 행동을 되돌리지 않는다 */
H.freshPlay(T,"pvp");
const gSeeker=H.mine(T,0,"minion")[0];
T.S.current=0; T.S.mainUsed=false; T.S.selected=gSeeker;
T.S.events=[{r:gSeeker.r,c:gSeeker.c,kind:"recruit",consumed:false}]; T.S.traces[0].add(gSeeker.r+"_"+gSeeker.c);
T.setSeed(9); T.netAction({t:"search"}); RC("giveup",0);
ok(T.S.recruit===null&&T.S.mainUsed===true&&T.S.events[0].consumed===true&&T.S.pkgs[0].itemGift===0&&T.S.pkgs[0].battleBuff===0,"giving up ends the search without refunding the cell or the main action");
/* 단일 경로: UI·AI·Network 는 탐색·보상 상태를 직접 쓰지 않는다 */
const aiSrc=fs.readFileSync(path.join(demo,"js","ai.js"),"utf8");
const netSrc=fs.readFileSync(path.join(demo,"js","network.js"),"utf8");
const uiSrc=fs.readFileSync(path.join(demo,"js","ui.js"),"utf8");
const coreSrc=fs.readFileSync(path.join(demo,"js","core.js"),"utf8");
const mutates=/S\.recruit\s*=[^=]|S\.recruitToken\s*=|S\.searchEndSeq\s*=|R\.stage\s*=[^=]|\.consumed\s*=[^=]|S\.pkgs\[[^\]]*\]\[[^\]]*\]\s*\+\+/;
ok(!/case "search"\s*:/.test(netSrc)&&!mutates.test(netSrc)&&!mutates.test(aiSrc)&&!mutates.test(uiSrc),"no UI, AI or network path writes the search, package or recruit state — network replay has no second search path either");
/* #245 Saturn REVISE(M1): 선택 창의 HTML·window 콜백은 표시 계층(ui.js)이 소유하고 Core 에는 한 줄도 없다.
   Core 쪽은 "보상 적용·완료 토큰이 한 곳뿐"이라는 사실만 본다 (단계 변이 R.stage 는 reducer 밖에 없다). */
ok(!/R\.stage\s*=[^=]/.test(coreSrc)&&!/window\./.test(coreSrc)&&!/<h2>|<div |<button /.test(coreSrc)
   &&/window\.__recruitCore=\(step,i,token\)=>\{ dispatchCoreAction\(\{t:"recruit",step,i,token\}\); \};/.test(uiSrc)
   &&(coreSrc.match(/type:"searchDone"/g)||[]).length===1&&(coreSrc.match(/\[ev\.kind\]\+\+/g)||[]).length===1,
   "Core carries no window hook and no modal markup; the recruit entry point and every reward screen live in the display layer while the grant and completion token each keep one Core home");
ok(/function doSearch\(p,ev\)\{\r?\n  const result=dispatchCoreAction\(\{t:"search"/.test(coreSrc)&&(T.html.match(/tryCapture\(/g)||[]).length===2,"the search wrapper is a thin Core entry point and the capture roll keeps its single implementation");

/* ===== Saturn REVISE 회귀 — 세 수정이 각각 없으면 떨어지는 최소 probe ===== */
/* (1) 좌표를 실은 직접 액션도 좌표 없는 턴바 프레임과 **같은** 합법성 게이트를 지난다 (searchLegalEvent 한 곳) */
{
  const bad=patch=>T.reduceCoreAction(Object.assign({},srchState,patch),{t:"search",id:901,r:9,c:3});
  const noTrace=bad({traces:[new Set(),new Set()]});
  ok(bad({mainUsed:true}).events.length===0&&bad({current:1}).events.length===0&&bad({phase:"setup"}).events.length===0
     &&noTrace.events.length===0
     &&bad({pieces:[Object.assign({},srchPieces[0],{alive:false})]}).events.length===0
     &&bad({pieces:[Object.assign({},srchPieces[0],{placed:false})]}).events.length===0
     &&bad({pieces:[Object.assign({},srchPieces[0],{owner:1})]}).events.length===0
     &&srchState.mainUsed===false&&srchState.events[0].consumed===false&&srchState.pkgs[0].battleBuff===0,
     "a coordinate-bearing search is refused without mutation when the main action is spent, it is not that owner's turn, the phase is not play, the trace was never found, or the piece is dead, unplaced or not the caller's");
  /* 같은 게이트가 레거시 래퍼(doSearch — AI·테스트의 직접 진입점)에도 걸린다 */
  H.freshPlay(T,"pvp");
  const gateSeeker=H.mine(T,0,"minion")[0];
  T.S.events=[{r:gateSeeker.r,c:gateSeeker.c,kind:"itemGift",consumed:false}]; T.S.traces[0].add(gateSeeker.r+"_"+gateSeeker.c);
  T.S.current=0; T.S.mainUsed=true;
  const spentEv=T.S.events[0];
  ok(T.doSearch(gateSeeker,spentEv)===false&&spentEv.consumed===false&&T.S.pkgs[0].itemGift===0&&T.S.metrics.searches===0,
     "doSearch refuses a direct search once the main action is spent, exactly like the turn-bar frame (the legacy wrapper checked neither)");
  T.S.mainUsed=false; T.S.traces[0].delete(gateSeeker.r+"_"+gateSeeker.c);
  ok(T.doSearch(gateSeeker,spentEv)===false&&spentEv.consumed===false&&T.S.metrics.searches===0,
     "doSearch refuses a cell whose trace was never found");
}
/* (2) recruit step 은 자기 단계에서만 합법이다 — 단계를 건너뛰면 수령 말·비용 검사 앞에서 멈춘다 */
{
  const jump=step=>T.reduceCoreAction(rootState,{t:"recruit",step,i:0,token:RTOK});
  ok(jump("recv").events.length===0&&jump("mode").events.length===0&&jump("slot").events.length===0
     &&jump("skill").events.length===0&&jump("target").events.length===0
     &&rootState.recruit.stage==="root"&&rootState.recruit.recvId===null&&rootState.balls[0]===3,
     "recruit steps that do not belong to the current stage are refused without mutation — root can no longer jump straight to recv, mode or slot");
  ok(T.reduceCoreAction(rootState,{t:"recruit",step:"cap",i:0,token:99}).events.length===0
     &&T.reduceCoreAction(rootState,{t:"recruit",step:"cap",i:0,token:rootState.recruit.token}).events[0].type==="recruitStage",
     "a button carrying another recruit record's token is refused, while the current record's token passes");
  ok(T.reduceCoreAction(capR.state,{t:"recruit",step:"cap",i:0,token:RTOK}).events.length===0,
     "a late duplicate click on the stage that already advanced is refused (the stage contract, not the modal, catches it)");
}
/* (3) 완료 래치는 게임별이다 — 새 게임의 첫 탐색도 searchEndCheck 를 탄다 (프로세스 전역 숫자였을 때는 묻혔다) */
{
  const Z=H.load(index); Z.BAL.fx.autoEnd=true; Z.tutSkip();
  const play=()=>{ H.freshPlay(Z,"pvp"); Z.tutSkip(); Z.byId("overlay").classList.add("hidden");
    const me=H.mine(Z,0,"minion")[0];
    for(const x of Z.S.pieces) if(x.owner===1) x.placed=false;          // 남은 선택 전투를 없앤다 (autoEndReady 전제)
    Z.S.events=[{r:me.r,c:me.c,kind:"itemGift",consumed:false}]; Z.S.traces[0].add(me.r+"_"+me.c);
    Z.S.current=0; Z.S.mainUsed=false; Z.S.selected=me;
    const t=Z.S.turnCount, e=Z.S.metrics.autoEnds;
    Z.netAction({t:"search"});
    Z.drain(1);                                        // 결과 연출 끝점(탐색 완료 콜백) 하나만 실행
    const own=Z.S.turnCount===t+1;                     // 계약 7-3: 전역 1000ms 유예를 더 기다리지 않고 searchEndCheck 가 끝낸다
    Z.drain(20000);
    return {own,ended:Z.S.turnCount===t+1,auto:Z.S.metrics.autoEnds===e+1,seq:Z.S.searchEndSeq}; };
  const g1=play(), g2=play();
  ok(g1.own&&g1.ended&&g1.auto&&g1.seq===1.5,"game 1: the search completion callback itself ends the turn exactly once and leaves the spent-token latch (1 → 1.5, the pre-split value)");
  ok(g2.own&&g2.ended&&g2.auto&&g2.seq===1.5,"game 2 reuses completion sequence 1 and its own callback still ends the turn — the latch lives in that game's own state, not in a process-global number (a process-global latch swallowed it and left the generic grace timer to finish the turn a step later)");
  Z.TQ.length=0;
}
/* (4) 이벤트 칸 대조는 자리로 한다 — 좌표가 겹치는 항목 둘이 첫 원본 하나로 뭉치지 않는다 */
{
  H.freshPlay(T,"pvp");
  const dupSeeker=H.mine(T,0,"minion")[0];
  T.S.events=[{r:dupSeeker.r,c:dupSeeker.c,kind:"itemGift",consumed:false},
              {r:dupSeeker.r,c:dupSeeker.c,kind:"battleBuff",consumed:false}]; // 같은 칸을 가리키는 두 항목 (저장 상태·픽스처)
  T.S.traces[0].add(dupSeeker.r+"_"+dupSeeker.c);
  T.S.current=0; T.S.mainUsed=false; T.S.selected=dupSeeker;
  const e0=T.S.events[0], e1=T.S.events[1];
  T.netAction({t:"search"});
  ok(T.S.events.length===2&&T.S.events[0]===e0&&T.S.events[1]===e1&&e0!==e1
     &&e0.consumed===true&&e0.kind==="itemGift"&&e1.consumed===false&&e1.kind==="battleBuff"
     &&T.S.pkgs[0].itemGift===1&&T.S.pkgs[0].battleBuff===0,
     "duplicate-coordinate event cells keep their own object identity and order through the commit — only the searched entry is consumed and only its reward is granted");
}
/* (5) Saturn REVISE — recruit 검증 엄격화: 토큰은 모든 step 에 필수이고, 위조된 소유자·말·종·대상·수령 말·인덱스는 전부 거부된다 */
{
  const capRecvState=T.reduceCoreAction(rootState,{t:"recruit",step:"cap",i:0,token:RTOK}).state;
  const noTok=step=>T.reduceCoreAction(capRecvState,{t:"recruit",step,i:0});
  ok(noTok("recv").events.length===0&&noTok("back").events.length===0&&noTok("giveup").events.length===0&&noTok("mode").events.length===0
     &&capRecvState.recruit.stage==="capRecv"&&capRecvState.recruit.recvId===null&&capRecvState.searchEndSeq===undefined&&capRecvState.balls[0]===3,
     "every recruit step refuses a frame that carries no token — back and give-up included (the omitted-token escape let any late callback advance the live record)");
  ok(T.reduceCoreAction(capRecvState,{t:"recruit",step:"back",i:0,token:RTOK}).state.recruit.stage==="root"
     &&T.reduceCoreAction(capRecvState,{t:"recruit",step:"giveup",i:0,token:RTOK}).events[0].type==="searchDone",
     "negative control: the same back and give-up frames carrying the live token still pass");
  ok(T.reduceCoreAction(rootState,{t:"recruit",step:"back",i:0,token:RTOK}).events.length===0&&rootState.recruit.stage==="root",
     "there is no step back out of the root stage");
  /* 기록 자신의 토큰도 발급 형식이어야 한다 — 손상된 토큰은 같은 값을 실은 호출과 비교를 통과해 버린다 */
  const badTok=t=>Object.assign({},rootState,{recruit:Object.assign({},rootState.recruit,{token:t})});
  const BADS=[undefined,null,"",0,1,"901#","#1","901#0","901#1x","902#1","901",{},["901#1"],NaN,true];
  ok(BADS.every(t=>{ const st=badTok(t), keep=JSON.stringify(st);
       return ["cap","recv","back","giveup","mode","skills","skill","target","slot"].every(step=>{
         const r=T.reduceCoreAction(st,{t:"recruit",step,i:0,token:t});
         return r.state===st&&J245(r.events.map(e=>e.type))===J245(["recruitClosed"])&&JSON.stringify(st)===keep; }); })
     &&BADS.every(t=>T.reduceCoreAction(badTok(t),{t:"recruit",step:"cap",i:0}).events[0].type==="recruitClosed"),
     "a recruit record whose own token is missing, null, empty or malformed executes no step — even when the frame carries the very same malformed token — and leaves the input state byte-identical with a display-only recruitClosed");
  ok(T.reduceCoreAction(badTok(RTOK),{t:"recruit",step:"cap",i:0,token:RTOK}).events[0].type==="recruitStage"
     &&T.reduceCoreAction(badTok("901#2"),{t:"recruit",step:"cap",i:0,token:"901#2"}).events[0].type==="recruitStage",
     "negative control: a record carrying a properly generated token still advances on that token");
  /* 위조 recruit 기록 — 소유자·탐색 말·후보 종 */
  const foreign=[{id:903,owner:1,type:"minion",alive:true,placed:true,r:2,c:2,hp:50,maxHp:50,skills:["s0","s1","s2","s3"],cds:[0,0,0,0]},
                 {id:904,owner:1,type:"ally",alive:true,placed:true,r:2,c:3,hp:40,maxHp:40,cap:null}];
  const forged=patch=>T.reduceCoreAction(Object.assign({},rootState,{pieces:srchPieces.concat(foreign),recruit:Object.assign({},rootState.recruit,patch)}),
    {t:"recruit",step:"cap",i:0,token:RTOK});
  const closed=r=>r.events.length===1&&r.events[0].type==="recruitClosed"&&r.state.recruit!==null;
  ok(closed(forged({owner:1}))&&closed(forged({owner:"0"}))&&closed(forged({owner:2}))
     &&closed(forged({pieceId:903}))&&closed(forged({pieceId:999}))
     &&closed(forged({pieceId:901,species:"__no_such_species"}))
     &&forged({}).events[0].type==="recruitStage",
     "a recruit record whose owner is not the player to move, whose searching piece is missing or belongs to the opponent, or whose candidate species is unknown is closed instead of being played out (no shared-minion fallback)");
  /* 수령 말: 살아 있고 배치된 **내** 동료·왕 중 포획 슬롯이 빈 말만 */
  const recvForge=patch=>T.reduceCoreAction(Object.assign({},recvR.state,{pieces:srchPieces.concat(foreign),recruit:Object.assign({},recvR.state.recruit,patch)}),
    {t:"recruit",step:"mode",i:0,token:RTOK});
  ok(recvForge({recvId:901}).events.length===0&&recvForge({recvId:904}).events.length===0&&recvForge({recvId:999}).events.length===0
     &&recvForge({}).events[0].type==="searchDone"&&srchPieces[1].cap===null&&foreign[1].cap===null&&srchState.balls[0]===3,
     "a forged receiver — the searching minion itself, the opponent's ally or a missing id — is refused before the balls are spent, while the legitimate receiver still goes through");
  /* 인덱스는 정수·음수 아님 */
  const idx=(step,i)=>T.reduceCoreAction(capRecvState,{t:"recruit",step,i,token:RTOK});
  ok(idx("recv",0.5).events.length===0&&idx("recv",-1).events.length===0&&idx("recv","0").events.length===0&&idx("recv",NaN).events.length===0
     &&idx("recv",0).events[0].type==="recruitStage",
     "fractional, negative, string and NaN button indices are refused while the integer index passes (AI findIndex misses hand over -1)");
  /* 기술 교체 대상·기술도 같은 잣대 (#234 로 기본 닫힘이라 켜서 확인한다) */
  T.V2_INTERP.recruitSkillSwap=true;
  const slotForge=patch=>T.reduceCoreAction(Object.assign({},slotState,{pieces:srchPieces.concat(foreign),recruit:Object.assign({},slotState.recruit,patch)}),
    {t:"recruit",step:"slot",i:0,token:RTOK});
  ok(slotForge({targetId:903}).events.length===0&&slotForge({targetId:902}).events.length===0&&slotForge({targetId:999}).events.length===0
     &&slotForge({skill:"__no_such_skill"}).events.length===0
     &&T.reduceCoreAction(Object.assign({},slotState,{pieces:srchPieces.concat(foreign)}),{t:"recruit",step:"slot",i:1.5,token:RTOK}).events.length===0
     &&slotForge({}).events[0].type==="searchDone"&&srchPieces[0].skills[0]==="s0"&&foreign[0].skills[0]==="s0",
     "a forged skill-swap target — the opponent's minion, my own ally, a missing id — and a skill outside the three offers are all refused, and so is a fractional slot");
  const tgtForge=patch=>T.reduceCoreAction(Object.assign({},recState,{pieces:srchPieces.concat(foreign),
    recruit:Object.assign({},rootState.recruit,{stage:"target",skill:T.NEW_SKILLS[0]},patch)}),{t:"recruit",step:"target",i:0,token:RTOK});
  ok(tgtForge({skill:"__no_such_skill"}).events.length===0&&tgtForge({}).events[0].type==="recruitStage"&&tgtForge({}).state.recruit.targetId===901,
     "the target step refuses a skill outside the three offers too, and otherwise picks my own roster minion");
  T.V2_INTERP.recruitSkillSwap=false;
}
/* (6) Saturn REVISE — 좌표가 겹치는 흔적은 **요청한 자리**만 소모한다 */
{
  const dup=Object.assign({},srchState,{events:[{r:9,c:3,kind:"itemGift",consumed:false},{r:9,c:3,kind:"battleBuff",consumed:false}]});
  const second=T.reduceCoreAction(dup,{t:"search",id:901,r:9,c:3,ei:1});
  const first=T.reduceCoreAction(dup,{t:"search",id:901,r:9,c:3,ei:0});
  const free=T.reduceCoreAction(dup,{t:"search",id:901,r:9,c:3});
  /* 좌표 없는 턴바·재생 프레임은 resolve 에서 **자리**로 해석된다 — 양 피어가 같은 항목을 고른다 */
  const resolved=T.resolveCoreAction(Object.assign({},dup,{selected:srchPieces[0]}),{t:"search"});
  ok(second.state.events[0].consumed===false&&second.state.events[1].consumed===true&&second.state.pkgs[0].battleBuff===1&&second.state.pkgs[0].itemGift===0
     &&first.state.events[0].consumed===true&&first.state.events[1].consumed===false&&first.state.pkgs[0].itemGift===1
     &&free.state.events[0].consumed===true&&free.state.events[1].consumed===false&&free.state.pkgs[0].itemGift===1
     &&resolved.ei===0&&resolved.id===901&&resolved.r===9&&resolved.c===3
     &&dup.events[0].consumed===false&&dup.events[1].consumed===false,
     "a direct search that asks for the second entry of a shared cell consumes exactly that entry and grants its reward, while the coordinate-free frame resolves to the first entry's index deterministically");
  ok(T.reduceCoreAction(dup,{t:"search",id:901,r:9,c:3,ei:5}).events.length===0
     &&T.reduceCoreAction(dup,{t:"search",id:901,r:9,c:3,ei:0.5}).events.length===0
     &&T.reduceCoreAction(dup,{t:"search",id:901,r:9,c:3,ei:-1}).events.length===0
     &&T.reduceCoreAction(dup,{t:"search",id:901,r:9,c:3,ei:1}).events.length===2,
     "an out-of-range, fractional or negative entry index is refused while the real one passes");
  /* 실제 호출처(doSearch)도 자기가 건넨 그 항목을 소모한다 */
  H.freshPlay(T,"pvp");
  const dSeeker=H.mine(T,0,"minion")[0];
  T.S.events=[{r:dSeeker.r,c:dSeeker.c,kind:"itemGift",consumed:false},{r:dSeeker.r,c:dSeeker.c,kind:"battleBuff",consumed:false}];
  T.S.traces[0].add(dSeeker.r+"_"+dSeeker.c); T.S.current=0; T.S.mainUsed=false; T.S.selected=dSeeker;
  const d0=T.S.events[0], d1=T.S.events[1];
  ok(T.doSearch(dSeeker,d1)===true&&d0.consumed===false&&d1.consumed===true&&T.S.events[0]===d0&&T.S.events[1]===d1
     &&T.S.pkgs[0].battleBuff===1&&T.S.pkgs[0].itemGift===0,
     "doSearch consumes the very event object the caller handed it, not the first entry that happens to share its coordinates");
}
/* (7) Saturn REVISE — 폭탄·함정 사유는 다른 모든 게이트를 통과한 시도에만 나간다 */
{
  const bombPiece=extra=>[Object.assign({},srchPieces[0],{type:"bomb"},extra||{})];
  const bomb=patch=>T.reduceCoreAction(Object.assign({},srchState,{pieces:bombPiece()},patch||{}),{t:"search",id:901,r:9,c:3});
  ok(bomb({mainUsed:true}).events.length===0&&bomb({current:1}).events.length===0&&bomb({phase:"setup"}).events.length===0
     &&bomb({traces:[new Set(),new Set()]}).events.length===0
     &&bomb({events:[{r:9,c:3,kind:"battleBuff",consumed:true}]}).events.length===0
     &&bomb({events:[]}).events.length===0
     &&bomb({pieces:bombPiece({alive:false})}).events.length===0
     &&bomb({pieces:bombPiece({placed:false})}).events.length===0
     &&bomb({pieces:bombPiece({owner:1})}).events.length===0
     &&T.reduceCoreAction(Object.assign({},srchState,{pieces:bombPiece()}),{t:"search",id:901,r:9,c:4}).events.length===0,
     "an out-of-turn, spent, wrong-phase, unseen, consumed, event-free, dead, unplaced or foreign bomb search says nothing — the refusal itself would have told the player that cell held a discovered event");
  ok(bomb().events.length===1&&bomb().events[0].type==="searchRefused"&&bomb().events[0].owner===0,
     "negative control: a bomb standing on its own discovered, unspent event cell on its own turn still hears the type refusal");
  ok(bomb().state.mainUsed===false&&bomb().state.events[0].consumed===false&&bomb().state.pkgs[0].battleBuff===0,
     "the refused bomb search changes nothing — the cell, the main action and the stock all stay as they were");
}
/* (8) Saturn REVISE — recruit 토큰은 게임을 가로질러 유일하다 */
{
  const Z=H.load(index); Z.tutSkip();
  const openRecruit=()=>{ H.freshPlay(Z,"pvp"); Z.tutSkip();
    const me=H.mine(Z,0,"minion")[0], recv=H.mine(Z,0,"ally")[0];
    recv.cap=null; Z.S.balls=[3,3]; Z.S.current=0; Z.S.mainUsed=false; Z.S.selected=me;
    Z.S.events=[{r:me.r,c:me.c,kind:"recruit",consumed:false}]; Z.S.traces[0].add(me.r+"_"+me.c);
    Z.setSeed(245); Z.netAction({t:"search"});
    return Z.S.recruit.token; };
  const t1=openRecruit();          // 게임 1 의 첫 recruit — 버튼 콜백이 이 토큰을 들고 있다
  const t2=openRecruit();          // 게임 2 의 첫 recruit (게임별 카운터로는 둘 다 "1번째")
  Z.__recruitCore("cap",0,t1);     // 앞 게임의 버튼을 지금 누른 격
  ok(t1!==t2&&Z.S.recruit&&Z.S.recruit.stage==="root"&&Z.S.recruit.token===t2&&Z.S.recruitToken===1,
     "a held button from the previous game cannot advance the new game's first recruit — the token carries the searching piece id, so the per-game counter alone no longer collides");
  Z.__recruitCore("cap",0,t2);
  ok(Z.S.recruit.stage==="capRecv","negative control: the live game's own token advances the very same step");
  Z.TQ.length=0;
}
/* (9) Saturn REVISE 4차 — ei 는 **생략만** 기본 해석을 얻는다. 명시적으로 실린 값은 모양이 어떻든 엄격 거부다.
   종전 `ei===undefined||ei===null` 은 조작된·손상된 프레임의 null 을 "좌표 없는 프레임"으로 둔갑시켜 첫 항목을
   대신 소모했다 — 요청하지 않은 흔적이 사라지고 그 보상이 나갔다. */
{
  const explicit=v=>T.reduceCoreAction(srchState,{t:"search",id:901,r:9,c:3,ei:v});
  T.setSeed(2451); const nextRand=T.rand(); T.setSeed(2451);
  const badEi=[null,undefined,"0","1","","0.0",0.5,1.5,-1,-0.5,NaN,Infinity,-Infinity,1,5,99,true,false,[0],[],{}];
  const refusedExact=badEi.every(v=>{ const r=explicit(v); return r.events.length===0&&r.state===srchState; });
  ok(refusedExact&&srchState.mainUsed===false&&srchState.events[0].consumed===false&&srchState.pkgs[0].battleBuff===0
     &&srchState.metrics.searches===0&&srchPieces[0].healing===true&&T.rand()===nextRand,
     "an explicitly supplied entry index is refused for every unusable shape — null, undefined, string, fractional, negative, NaN, infinite, out-of-range, boolean, array and object — and each refusal returns the very input state with no event cell spent and no rand drawn");
  T.setSeed(2451);
  const omitted=T.reduceCoreAction(srchState,{t:"search",id:901,r:9,c:3});
  const zero=T.reduceCoreAction(srchState,{t:"search",id:901,r:9,c:3,ei:0});
  ok(omitted.events.length===2&&omitted.state.events[0].consumed===true&&omitted.state.pkgs[0].battleBuff===1
     &&zero.events.length===2&&zero.state.events[0].consumed===true&&zero.state.pkgs[0].battleBuff===1,
     "negative control: the same frame with the ei property omitted resolves once to the deterministic first legal index, and the real index 0 supplied explicitly passes too");
  /* 같은 잣대가 id 에도 걸린다 — 명시적 undefined 는 좌표 없는 프레임이 아니다 */
  const selState=Object.assign({},srchState,{selected:srchPieces[0]});
  const resolvedFree=T.resolveCoreAction(selState,{t:"search"});
  const resolvedUndef=T.resolveCoreAction(selState,{t:"search",id:undefined});
  const undefResult=T.reduceCoreAction(selState,{t:"search",id:undefined,r:9,c:3,ei:0});
  ok(resolvedFree.id===901&&resolvedFree.ei===0&&resolvedUndef.id===undefined&&resolvedUndef.ei===undefined
     &&undefResult.events.length===0&&undefResult.state===selState,
     "resolve treats only an omitted id as the coordinate-free turn-bar frame — an explicit id:undefined is passed through and rejected instead of being re-resolved to whatever piece happens to be selected");
  ok(T.doSearch(srchPieces[0],undefined)===false,"doSearch with no event object hands the reducer an explicit -1 and is refused rather than falling back to the first legal entry");
  /* Saturn REVISE 5차 — 좌표 없는 프레임은 id·r·c·ei 가 **모두** 생략된 것뿐이다. 하나라도 실려 있으면 resolve 가 그 값을
     버리고 ei=0 을 재구성하지 않고 그대로 넘겨, reducer 의 엄격 검증이 거부한다 (resolve→reduce→commit 전 경로). */
  H.freshPlay(T,"pvp"); T.tutSkip();
  const fSeek=H.mine(T,0,"minion")[0];
  const arm=()=>{ T.S.events=[{r:fSeek.r,c:fSeek.c,kind:"itemGift",consumed:false},{r:fSeek.r,c:fSeek.c,kind:"battleBuff",consumed:false}];
    T.S.traces[0].add(fSeek.r+"_"+fSeek.c); T.S.current=0; T.S.mainUsed=false; T.S.selected=fSeek;
    T.S.pkgs=[{itemGift:0,battleBuff:0},{itemGift:0,battleBuff:0}]; };
  const untouched=()=>T.S.events.every(e=>!e.consumed)&&T.S.mainUsed===false&&T.S.pkgs[0].itemGift===0&&T.S.pkgs[0].battleBuff===0;
  const forged=[{ei:null},{ei:undefined},{ei:1},{ei:"1"},{ei:0.5},{ei:0},{id:fSeek.id},{r:fSeek.r},{c:fSeek.c},
                {r:fSeek.r,c:fSeek.c},{id:fSeek.id,r:fSeek.r},{id:undefined,c:fSeek.c}];
  const forgedRefused=forged.every(patch=>{ arm();
    const res=T.dispatchCoreAction(Object.assign({t:"search"},patch));
    return !!res&&res.events.length===0&&untouched(); });
  arm(); const bare=T.dispatchCoreAction({t:"search"});
  ok(forgedRefused&&bare.events.some(e=>e.type==="searched")&&T.S.events[0].consumed===true&&T.S.events[1].consumed===false
     &&T.S.pkgs[0].itemGift===1&&T.S.pkgs[0].battleBuff===0&&T.S.mainUsed===true,
     "a search frame carrying id, r, c or ei — null, undefined, a string, a fraction or half the coordinates — goes to the strict reducer untouched and is refused, so a supplied entry index can no longer be discarded and re-resolved into spending the first trace, while the wholly coordinate-free turn-bar frame still resolves and spends entry 0");
  T.TQ.length=0;
}
/* (10) Saturn REVISE 4차 — recruit 기록·단계·인덱스 엄격화 */
{
  const STAGES=["root","skill","target","slot","capRecv","capMode"]; // recruitModal 이 그리는 단계 전부 (이 목록을 못 박는다)
  const ALL_STEPS=["skills","cap","skill","target","slot","recv","mode","back","giveup"];
  const staged=stage=>Object.assign({},rootState,{recruit:Object.assign({},rootState.recruit,{stage})});
  const closedAt=(stage,step)=>{ const st=staged(stage);
    const r=T.reduceCoreAction(st,{t:"recruit",step,i:0,token:RTOK});
    return r.state===st&&r.events.length===1&&r.events[0].type==="recruitClosed"&&st.recruit.stage===stage&&st.balls[0]===3; };
  ok(["__nope","","ROOT","capmode","root ",null,undefined,0,1,{}].every(s=>ALL_STEPS.every(p=>closedAt(s,p))),
     "a recruit record parked on a stage the modal never renders is closed for every step — give-up and back included, so an unknown stage can no longer be cashed out as a finished choice");
  ok(STAGES.every(s=>{ const st=staged(s); return T.reduceCoreAction(st,{t:"recruit",step:"giveup",i:0,token:RTOK}).events[0].type==="searchDone"; })
     &&STAGES.filter(s=>s!=="root").every(s=>{ const st=staged(s);
        const r=T.reduceCoreAction(st,{t:"recruit",step:"back",i:0,token:RTOK});
        return r.events[0].type==="recruitStage"&&r.state.recruit.stage!==s; })
     &&T.reduceCoreAction(staged("root"),{t:"recruit",step:"back",i:0,token:RTOK}).events.length===0,
     "negative control: give-up passes from every stage the modal renders, back passes from every non-root stage and only root has no step back");
  /* 탐색을 실행할 수 없는 말의 기록은 성립하지 않는다 (#20 폭탄·함정) */
  const asType=type=>{ const st=Object.assign({},rootState,{pieces:[Object.assign({},srchPieces[0],{type}),srchPieces[1]]});
    return {st,r:T.reduceCoreAction(st,{t:"recruit",step:"cap",i:0,token:RTOK})}; };
  ok(["bomb","trap","","minion ",null,undefined,0].every(t=>{ const {st,r}=asType(t);
       return r.state===st&&r.events.length===1&&r.events[0].type==="recruitClosed"&&srchPieces[1].cap===null; })
     &&["minion","ally","king"].every(t=>asType(t).r.events[0].type==="recruitStage"),
     "a recruit record whose searching piece is a bomb, a trap or any type that cannot run a search is closed instead of being played out, while the three types that can search still advance");
  /* 선택이 아닌 명령은 실제 UI sentinel 인 0 만 받는다 */
  const capRecv=T.reduceCoreAction(rootState,{t:"recruit",step:"cap",i:0,token:RTOK}).state;
  const cmd=(state,step,i)=>T.reduceCoreAction(state,{t:"recruit",step,i,token:RTOK});
  ok([1,2,3,99].every(i=>cmd(rootState,"skills",i).events.length===0&&cmd(rootState,"cap",i).events.length===0
       &&cmd(rootState,"giveup",i).events.length===0&&cmd(capRecv,"back",i).events.length===0
       &&cmd(capRecv,"giveup",i).events.length===0&&cmd(rootState,"__unknown_step",i).events.length===0)
     &&rootState.recruit.stage==="root"&&rootState.balls[0]===3&&capRecv.recruit.stage==="capRecv"&&capRecv.searchEndSeq===undefined,
     "the root branches, back and give-up carry a single UI button each, so any index other than the real sentinel 0 is refused — a forged frame can no longer smuggle the same command in at another slot");
  ok(cmd(rootState,"cap",0).events[0].type==="recruitStage"&&cmd(capRecv,"back",0).events[0].type==="recruitStage"
     &&cmd(capRecv,"giveup",0).events[0].type==="searchDone",
     "negative control: the same commands at index 0 still pass");
  /* 선택 step 의 범위는 그 화면 목록으로 정확히 본다 — 경계 바로 밖까지 */
  T.V2_INTERP.recruitSkillSwap=true;
  const tgtState=Object.assign({},recState,{recruit:Object.assign({},rootState.recruit,{stage:"target",skill:T.NEW_SKILLS[0]})});
  const skillState=Object.assign({},recState,{recruit:Object.assign({},rootState.recruit,{stage:"skill"})});
  const nMin=T.rosterMinions(0,srchState).length, nRecv=T.capReceivers(0,srchState).length, nSlot=srchPieces[0].skills.length;
  const nMode=3; // CAP_MODES 는 안전·위험·공격 셋이다 (UI·AI·온라인 중계 공용 순서 — 여기에 기대값으로 못 박는다)
  ok(cmd(skillState,"skill",T.NEW_SKILLS.length).events.length===0&&cmd(skillState,"skill",T.NEW_SKILLS.length-1).events[0].type==="recruitStage"
     &&cmd(tgtState,"target",nMin).events.length===0&&cmd(tgtState,"target",nMin-1).events[0].type==="recruitStage"
     &&cmd(capRecv,"recv",nRecv).events.length===0&&cmd(capRecv,"recv",nRecv-1).events[0].type==="recruitStage"
     &&cmd(recvR.state,"mode",nMode).events.length===0&&cmd(recvR.state,"mode",nMode-1).events[0].type==="searchDone"
     &&cmd(slotState,"slot",nSlot).events.length===0&&cmd(slotState,"slot",nSlot-1).events[0].type==="searchDone",
     "every choice step stops exactly at the length of the list its own screen shows — offered skills, my roster minions, the eligible receivers, the three capture methods and the target's real skill slots");
  /* 슬롯 상한은 상수 4 가 아니라 **그 말의 실제 칸 수**다 — 칸이 덜 달린 손상·승계 기록에 없는 슬롯을 쓰지 않는다 */
  const shortM=Object.assign({},srchPieces[0],{skills:["s0","s1"],cds:[0,0],revealedSkills:[]});
  const shortState=Object.assign({},slotState,{pieces:[shortM,srchPieces[1]]});
  const shortSlot=i=>T.reduceCoreAction(shortState,{t:"recruit",step:"slot",i,token:RTOK});
  ok(shortSlot(2).events.length===0&&shortSlot(3).events.length===0&&shortSlot(2).state===shortState
     &&shortSlot(1).events[0].type==="searchDone"&&J245(shortSlot(1).state.pieces[0].skills)===J245(["s0",T.NEW_SKILLS[0]])
     &&J245(shortM.skills)===J245(["s0","s1"]),
     "the slot bound follows the target's own skill list, so a two-slot record refuses slots 2 and 3 instead of letting a fixed bound of four write past the end — and its real slot 1 still passes");
  T.V2_INTERP.recruitSkillSwap=false;
}
/* (11) Saturn REVISE 4차 — 진행 중 보상 선택은 락스텝 요약에 실린다 (온라인 갈라짐을 그 자리에서 잡는다) */
{
  const X=H.load(index); X.tutSkip(); H.freshPlay(X,"pvp"); X.tutSkip();
  const me=H.mine(X,0,"minion")[0], recv=H.mine(X,0,"ally")[0];
  recv.cap=null; X.S.balls=[3,3]; X.S.current=0; X.S.mainUsed=false; X.S.selected=me;
  X.S.events=[{r:me.r,c:me.c,kind:"recruit",consumed:false}]; X.S.traces[0].add(me.r+"_"+me.c);
  X.setSeed(245); X.netAction({t:"search"});
  const R=X.S.recruit, base=lockstepDigest(X);
  ok(!!R&&!!R.token,"a recruit search opens a live record carrying a token");
  const swap=(k,v)=>{ const old=R[k]; R[k]=v; const moved=lockstepDigest(X)!==base; R[k]=old; return moved&&lockstepDigest(X)===base; };
  ok(swap("owner",1)&&swap("pieceId",recv.id)&&swap("species",X.ROSTER.find(r=>r.id!==R.species).id)
     &&swap("stage","capRecv")&&swap("skill",X.NEW_SKILLS[0])&&swap("targetId",me.id)&&swap("recvId",recv.id)
     &&swap("token",R.token+"x"),
     "the lockstep digest separates two seats that disagree on the recruit owner, searching piece, candidate species, stage, chosen skill, target, receiver or token — every field a later step reads back");
  const seq0=X.S.searchEndSeq||0; X.S.searchEndSeq=seq0+1; const seqMoved=lockstepDigest(X)!==base; X.S.searchEndSeq=seq0;
  X.S.recruit=null; const goneMoved=lockstepDigest(X)!==base; X.S.recruit=R;
  ok(seqMoved&&goneMoved&&lockstepDigest(X)===base,
     "the digest also separates a diverged search-completion sequence and a record that only one seat still holds, and restoring the state restores the digest");
  const bare={owner:R.owner,pieceId:R.pieceId,species:R.species,stage:R.stage};
  X.S.recruit=bare; const dBare=lockstepDigest(X);
  X.S.recruit=Object.assign({},bare,{skill:null,targetId:null,recvId:null,token:null}); const dNull=lockstepDigest(X);
  X.S.recruit=R;
  ok(dBare===dNull&&lockstepDigest(X)===base,
     "the digest canonicalises the optional recruit fields — an absent skill, target, receiver or token reads the same as an explicit null, so a peer that stores the defaults differently is not reported as a divergence");
  X.TQ.length=0;
}
/* (12) #245 전투 커맨드 — 가방·패키지·포획·도망·넘기기·기술 선택이 **전부** 단일 Core 경계를 지난다.
   종전에는 같은 규칙이 battleModal() 렌더 클로저 안에 있었고 네트워크 재생이 그 전역 클로저를 다시 불렀다. */
{
  const X=H.load(index); X.tutSkip(); H.freshPlay(X,"pvp"); X.tutSkip(); X.BAL.dmgVar=0;
  H.clearBoard(X);
  const me=X.S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=X.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(X,me,12,4); H.place(X,em,11,4);
  H.place(X,X.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(X,X.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  X.S.balls=[3,3]; X.S.reserve=[null,null]; X.S.inv=[["potion","cool"],["potion","cool"]];
  X.S.pkgs=[{itemGift:1,battleBuff:1},{itemGift:1,battleBuff:1}];
  X.S.battle=null; X.S.battlesUsed=0; X.TQ.length=0;
  X.setSeed(24521); X.startRounds(me,em,me,em); X.drain(20000);
  const B=X.S.battle, dg=()=>lockstepDigest(X), owner=()=>((X.actorOfPhase()==="A")?B.attP:B.defP).owner;
  ok(!!B,"전투 커맨드 절 전제: 실제 전투가 열렸다");

  /* 12-1 Core 소유: 전투 어휘는 reduceCoreAction 의 케이스다. 프레임(그 렌더의 전투·행동자·행동 토큰)이 없는
     호출은 Core 가 맡지 않고(null) 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다 — 프레임은 회선에 실리지 않는다. */
  const VERBS=["act","item","ball","flee","pass","pkgOpen","pkgPick"];
  const before=dg();
  ok(VERBS.every(t=>X.reduceCoreAction(X.S,{t})===null),"전투 어휘 7종은 프레임 없이는 Core 가 맡지 않는다 (진입점이 붙여 다시 부른다)");
  ok(VERBS.every(t=>X.dispatchCoreAction({t})===false)&&dg()===before,"프레임 없는 직접 dispatch 는 아무것도 커밋하지 않는다");
  const coreSrc=fs.readFileSync(path.join(demo,"js","core.js"),"utf8");
  const uiSrc12=fs.readFileSync(path.join(demo,"js","ui.js"),"utf8");
  const entries=uiSrc12.match(/window\.__(?:openPkgCore|pkgPickCore|pkgCancelCore|useItemCore|throwBallCore|fleeCore|passCore|actCore)=[^\n]*/g)||[];
  ok(entries.length===8&&entries.every(line=>/dispatchCoreAction\(\{t:"/.test(line))&&!/window\.__/.test(coreSrc),
     "전투 커맨드 진입점 8종(개봉 취소 포함)은 **표시 계층에서** 전부 한 줄로 Core 액션만 보낸다 — Core 에는 window 콜백이 한 줄도 없다");
  /* 12-1b #245 Saturn REVISE(MEDIUM): 합법성 판정은 **표시 큐(B.msgQ)** 를 읽지 않는다 — 그건 UI 가 소유한 재생 큐이지 규칙 상태가 아니다.
     Core 가 그걸 보면 화면 없는 런타임(헤드리스·서버 좌석 엔진·AI)이 연출 큐를 손으로 비워야 합법 행동을 이어갈 수 있다.
     연출 중 입력 차단은 그대로 **경계**가 맡는다: UI 의 busy·입력 경계 netAction(fxLocked)·수신 경계 netReady(빈 msgQ). */
  const cmdCtxSrc=coreSrc.slice(coreSrc.indexOf("function battleCmdCtx("),coreSrc.indexOf("function battleActionFrame("));
  ok(cmdCtxSrc.length>0&&cmdCtxSrc.indexOf("msgQ")<0,
     "12-1b 전투 합법성 게이트(battleCmdCtx)에 표시 큐(msgQ) 참조가 한 줄도 없다 — 규칙이 연출 큐에 묶이지 않는다");
  ok(/const busy=B\.msgQ\.length>0\|\|fxLocked\(\);/.test(uiSrc12)&&/const dis=aiActor\|\|busy\|\|/.test(uiSrc12),
     "12-1c 대신 **표시 계층**이 재생·연출 중 전투 커맨드를 비활성화한다 (battleModal 의 busy → dis)");
  ok(/S\.battle\.msgQ\.length===0/.test(fs.readFileSync(path.join(demo,"js","network.js"),"utf8")),
     "12-1d 수신 경계(netReady)도 빈 msgQ 를 그대로 기다린다 — 온라인 재생 순서·결정성은 바뀌지 않는다");
  /* 취소는 **표시 계층의 일**이 아니다: 개봉 화면의 [취소] 버튼이 B 를 직접 고치거나 화면만 닫고 끝내면
     발급된 표가 살아남아 뒤늦은 확정을 인가한다 (아래 12-13). 버튼은 Core 경계만 부른다. */
  ok(!/\[\"취소\",\(\)=>\{close\(\); battleModal\(\);\}\]/.test(uiSrc12)&&(uiSrc12.match(/\["취소",\(\)=>window\.__pkgCancelCore\(id\)\]/g)||[]).length===2,
     "개봉 화면의 취소 버튼 2곳은 UI 가 전투 상태를 직접 고치지 않고 Core 취소 액션을 부른다");

  /* 12-2 커밋은 **바뀐 칸만** 옮긴다. 같은 전투 객체를 다시 대입하면 S.battle 에 접근자를 건 관찰자(공개 방 서버
     엔진)가 그때마다 '새 전투 시작'으로 읽어 battleId·표시 이벤트를 새로 발급한다. */
  let backing=X.S.battle, reassigned=0;
  Object.defineProperty(X.S,"battle",{configurable:true,enumerable:true,get(){return backing;},set(v){reassigned++;backing=v;}});
  const own=owner(), invBefore=X.S.inv[own].slice();
  X.__useItemCore(0); X.drain(20000);
  ok(X.S.inv[own].length===invBefore.length-1,"12-2 전제: 아이템 사용이 Core 를 지나 재고를 하나 줄였다");
  ok(reassigned===0,"전투 중 커밋은 같은 S.battle 을 다시 대입하지 않는다 (재대입은 관찰자에게 새 전투다)");

  /* 12-3 중복·재생 입력 안전: 같은 진입점을 다시 불러도 라운드 1회 게이트가 재고를 더 쓰지 않는다 */
  const useAgain=X.__useItemCore, invAfter=X.S.inv[own].slice();
  useAgain(0); X.drain(20000);
  ok(JSON.stringify(X.S.inv[own])===JSON.stringify(invAfter),"같은 아이템 진입점의 두 번째 호출은 재고를 더 쓰지 않는다 (라운드 1회)");

  /* 12-4 손상된 프레임·인덱스는 난수도 상태도 건드리지 않는다 (Core 가 값 자체를 본다 — 참/거짓이 아니라) */
  X.setSeed(24522); const r0=X.rand(); X.setSeed(24522);
  const d0=dg();
  for(const a of [{t:"item",i:"0"},{t:"item",i:-1},{t:"item",i:1.5},{t:"item",i:99},{t:"act",k:{}},{t:"pkgOpen",kind:"__proto__"},{t:"pkgOpen",kind:"toString"},{t:"ball"}]) X.applyAction(a);
  for(const a of [["gift","0"],["gift",-1],["gift",1.5],["gift",99],["__proto__",0],["buff",99]]) X.__pkgPickCore(a[0],a[1]);
  X.drain(20000);
  ok(dg()===d0,"손상된 전투 프레임(문자열·음수·소수·범위 밖 인덱스, 원형 오염 종류)은 상태를 바꾸지 않는다");
  ok(X.rand()===r0,"그 거부들은 난수를 하나도 소비하지 않는다 (락스텝·재현성 보존)");

  /* 12-5 낡은 진입점: 차례가 넘어간 뒤의 옛 렌더 호출은 새 행동자를 대신 쓰지 않는다 (#146 Saturn REVISE P1 계약) */
  const staleFlee=X.__fleeCore, staleItem=X.__useItemCore;
  X.applyAction({t:"act",k:0}); X.drain(20000);
  ok(!!X.S.battle,"12-5 전제: 한 번의 기술 행동으로는 전투가 끝나지 않았다");
  X.setSeed(24523); const r1=X.rand(); X.setSeed(24523);
  const d1=dg(), tries=X.S.metrics.byPlayer[0].fleeTries+X.S.metrics.byPlayer[1].fleeTries;
  staleFlee(); staleItem(0); X.drain(20000);
  ok(dg()===d1&&X.S.metrics.byPlayer[0].fleeTries+X.S.metrics.byPlayer[1].fleeTries===tries,
     "차례가 넘어간 뒤의 옛 도망·아이템 진입점은 상태도 지표도 바꾸지 않는다");
  ok(X.rand()===r1,"그 거부도 난수를 소비하지 않는다 — 도망 판정이 몰래 굴러가지 않는다");
  /* 12-6 규칙 본체가 정말 reducer 에 있다: 프레임을 직접 지어 넣으면 reducer 하나가 판정·재고·이벤트를 다 낸다.
     소유자 재고(inv)는 reducer 계약대로 복제되고, 전투 인스턴스(B)는 이 tranche 가 명시한 예외로 제자리에서 고쳐 쓴다. */
  const B2=X.S.battle, side2=X.actorOfPhase(), own2=(side2==="A"?B2.attP:B2.defP).owner;
  X.S.inv[own2]=["potion","cool"]; B2.itemRoundA=false; B2.itemRoundD=false;
  const invRef=X.S.inv[own2];
  const probe=X.reduceCoreAction(X.S,{t:"item",i:0,frame:{B:B2,side:side2,seq:B2.actSeq||0,round:B2.round,phase:B2.phase}});
  ok(!!probe&&probe.events[0].type==="battleItemUsed"&&probe.state.inv[own2].length===1&&probe.state.inv!==X.S.inv,
     "아이템 사용의 판정·재고·이벤트가 reduceCoreAction 한 곳에서 나온다");
  ok(X.S.inv[own2]===invRef&&invRef.length===2,"소유자 재고 배열은 그대로 두고 복제본에만 쓴다 (reducer 계약)");
  ok((side2==="A"?B2.itemRoundA:B2.itemRoundD)===true,"전투 인스턴스의 라운드 게이트는 제자리에서 바뀐다 (이 tranche 가 명시한 예외 — 복제 전환은 스케줄러 tranche)");

  /* 12-7 Saturn REVISE — 회선·재생 프레임의 정체성. 받는 쪽 진입점은 **자기 렌더의** 프레임을 붙이므로, 보낸 쪽이
     겨냥한 행동자·전투 진행 지점을 함께 싣지 않으면 늦게·다시 도착한 프레임이 지금 차례인 다른 행동자를 대신 쓴다. */
  X.battleModal();
  const B3=X.S.battle, side3=X.actorOfPhase(), f3=side3==="A"?B3.fa:B3.fd;
  const slotOk=f3.skills?f3.skills.findIndex((s,i)=>X.slotUsable(f3,i,side3)):-1;
  ok(slotOk>=0,"12-7 전제: 지금 행동자에게 실제로 쓸 수 있는 기술 슬롯이 있다");
  const liveBf=()=>({side:side3,seq:B3.actSeq||0,round:B3.round,phase:B3.phase});
  const d7=dg(); X.setSeed(24530); const r7=X.rand(); X.setSeed(24530);
  for(const bf of [Object.assign(liveBf(),{seq:(B3.actSeq||0)+1}),Object.assign(liveBf(),{round:B3.round+1}),
                   Object.assign(liveBf(),{phase:B3.phase+1}),Object.assign(liveBf(),{side:side3==="A"?"D":"A"}),{}])
    X.applyAction({t:"act",k:slotOk,bf});
  X.drain(20000);
  ok(dg()===d7,"낡은·재생된·부분적인 회선 프레임(행동 토큰·라운드·단계·행동자 불일치, 정체성 없음)은 지금 행동자를 대신 쓰지 않는다");
  ok(X.rand()===r7,"그 거부들도 난수를 하나도 소비하지 않는다");

  /* 12-8 쓸 수 없는 슬롯은 내보내지 않는다 — execSlot 은 사신의 낫만 다시 검사하므로 여기가 유일한 합법성 게이트다 */
  f3.cds[slotOk]=2;
  const d8=dg(); X.setSeed(24531); const r8=X.rand(); X.setSeed(24531);
  X.applyAction({t:"act",k:slotOk}); X.drain(20000);
  ok(dg()===d8&&X.rand()===r8,"쿨타임 중인 슬롯 번호는 battleSlot 로 나가지 않는다 (상태·난수 무변경)");
  f3.cds[slotOk]=0;

  /* 12-9 패키지 확정은 **살아 있는 개봉 표**에서만 나온다: 표 없이·다른 종류로·이미 쓴 표로 온 확정은 재고를 움직이지 않는다.
     성공한 확정은 말을 건드리지 않으므로 S.pieces 배열 정체성도 그대로여야 한다. */
  X.battleModal();
  const own9=((X.actorOfPhase()==="A")?X.S.battle.attP:X.S.battle.defP).owner, B9=X.S.battle;
  X.S.pkgs[own9]={itemGift:2,battleBuff:1}; B9.pkgSel=null; B9.buffA=null; B9.buffD=null;
  X.__pkgPickCore("gift",0,1); X.drain(20000);
  ok(X.S.pkgs[own9].itemGift===2,"개봉 없이 온 확정(표 없음)은 재고를 움직이지 않는다");
  X.__openPkgCore("itemGift"); const tk9=B9.pkgSel.id;
  X.__pkgPickCore("buff",0,tk9); X.drain(20000);
  ok(X.S.pkgs[own9].battleBuff===1&&!B9.buffA&&!B9.buffD,"선물 상자 표로 버프를 확정하는 남의 선택(종류 불일치)은 거부된다");
  const pieces9=X.S.pieces, invLen9=X.S.inv[own9].length;
  X.__pkgPickCore("gift",0,tk9); X.drain(20000);
  ok(X.S.pkgs[own9].itemGift===1&&X.S.inv[own9].length+X.S.balls[own9]>=invLen9,"표가 있는 확정은 정상 동작한다 (재고 1 소모)");
  ok(X.S.pieces===pieces9,"말을 건드리지 않는 전투 커맨드는 S.pieces 배열 정체성을 갈아 치우지 않는다");
  X.__pkgPickCore("gift",0,tk9); X.drain(20000);
  ok(X.S.pkgs[own9].itemGift===1,"이미 쓴 표로 다시 온 확정(재생·중복 클릭)은 한 번 더 적용되지 않는다");

  /* 12-10 거부된 no-op 은 값도 참조도 그대로 둔다 — 커밋이 배열 정체성을 갈아 치우면 그 참조를 들고 있던 호출처·관찰자가 끊긴다 */
  const pieces10=X.S.pieces, sel10=X.S.selected, moved10=X.S.movedPiece, ev10=X.S.events, d10=dg();
  X.applyAction({t:"act",k:99}); X.applyAction({t:"item",i:99}); X.dispatchCoreAction({t:"heal",id:-1}); X.drain(20000);
  ok(X.S.pieces===pieces10&&X.S.selected===sel10&&X.S.movedPiece===moved10&&X.S.events===ev10&&dg()===d10,
     "거부된 no-op 은 S.pieces·selected·movedPiece·events 의 참조와 값을 그대로 둔다");

  /* 12-11 Saturn REVISE 2차 — **회선에서 온 전투 프레임은 bf 없이는 재생되지 않는다.** 받는 쪽 진입점은 자기 렌더의
     프레임을 붙이므로, 이 관문이 없으면 bf 를 뺀 프레임이 "지금 차례인 누군가"에 그대로 다시 묶인다.
     버림은 조용하고 **뒤 프레임을 막지 않는다** — 유효한 프레임은 같은 pump 에서 그대로 재생된다. */
  X.battleModal();
  const B11=X.S.battle, side11=X.actorOfPhase(), f11=side11==="A"?B11.fa:B11.fd;
  const slot11=f11.skills?f11.skills.findIndex((s,i)=>X.slotUsable(f11,i,side11)):-1;
  ok(slot11>=0,"12-11 전제: 지금 행동자에게 쓸 수 있는 기술 슬롯이 있다");
  X.NET.mode="host"; X.NET.me=B11[side11==="A"?"attP":"defP"].owner; X.NET.started=true;
  const d11=dg(); X.setSeed(24540); const r11=X.rand(); X.setSeed(24540);
  for(const a of [{t:"act",k:slot11},{t:"item",i:0},{t:"ball"},{t:"flee"},{t:"pass"},{t:"pkgOpen",kind:"itemGift"}]){
    X.NET.queue.push(a); X.netPump(); X.drain(20000); }
  ok(X.NET.queue.length===0&&dg()===d11&&X.rand()===r11,
     "bf 없는 수신 전투 프레임 6종은 큐에서 조용히 버려진다 — 상태·참조·난수 무변경");
  const bf11=X.battleActionFrame(X.S), hp11=(side11==="A"?B11.fd:B11.fa).hp;
  X.NET.queue.push({t:"act",k:slot11}); X.NET.queue.push({t:"act",k:slot11,bf:bf11}); X.netPump(); X.drain(20000);
  ok(X.NET.queue.length===0&&dg()!==d11,"앞의 bf 없는 프레임이 뒤의 정상 프레임을 막지 않는다 (큐 정체 없음)");
  X.NET.mode=null; X.NET.me=0; X.NET.started=false;

  /* 12-11' Saturn REVISE 3차 — bf 는 **온전하고 정확해야** 한다. 네 값이 다 맞아도 여분 키가 붙어 있으면 거부다
     (서버 room.js frameMatches 와 같은 판정). 여분 키를 흘려 보내면 조작 프레임이 문맥만 맞춰 놓고 소비자마다
     다르게 읽히는 필드를 함께 싣는다. 부분·빈 객체·배열·원시값·다른 값도 같은 자리에서 떨어진다.
     거부는 상태·참조·난수를 하나도 건드리지 않는다. */
  X.battleModal();
  if(X.S.battle){
    const good=X.battleActionFrame(X.S);
    const bads=[Object.assign({},good,{x:1}),                        // 여분 키 1개 (네 값은 정확)
                Object.assign({},good,{B:X.S.battle}),               // 렌더 프레임 흉내
                {side:good.side,seq:good.seq,round:good.round},      // 부분 (키 3개)
                {side:good.side,seq:good.seq,round:good.round,phase:good.phase,extra:undefined}, // 값이 undefined 여도 키는 키다
                {},[good.side,good.seq,good.round,good.phase],       // 빈 객체 · 배열
                Object.assign({},good,{seq:good.seq+1}),             // 낡은/앞선 행동 토큰
                Object.assign({},good,{side:good.side==="A"?"D":"A"})]; // 다른 행동자
    const B11b=X.S.battle, side11b=X.actorOfPhase(), f11b=side11b==="A"?B11b.fa:B11b.fd;
    const slot11b=f11b.skills?f11b.skills.findIndex((sk,i)=>X.slotUsable(f11b,i,side11b)):-1;
    const pcs=X.S.pieces, ev=X.S.events, dB=dg(); X.setSeed(24542); const rB=X.rand(); X.setSeed(24542);
    for(const bf of bads){
      if(slot11b>=0) X.applyAction({t:"act",k:slot11b,bf});
      X.applyAction({t:"pkgOpen",kind:"itemGift",bf}); X.applyAction({t:"pass",bf}); X.drain(20000); }
    ok(dg()===dB&&X.rand()===rB&&X.S.pieces===pcs&&X.S.events===ev&&!X.S.battle.pkgSel,
       "여분 키·부분·빈 객체·배열·낡은 값의 bf 는 전부 거부된다 — 상태·참조·난수·표 무변경");
    /* 대조: 같은 자리의 **온전한** bf 는 그대로 통한다 (가드가 기능을 죽이지 않았다) */
    X.applyAction({t:"pkgOpen",kind:"itemGift",bf:X.battleActionFrame(X.S)}); X.drain(20000);
    ok(!!X.S.battle.pkgSel&&X.S.battle.pkgSel.kind==="itemGift","온전한 bf(정확히 네 키)는 그대로 통한다");
    X.__pkgCancelCore(X.S.battle.pkgSel.id); X.drain(20000);
  } else ok(true,"12-11' 생략: 전투가 이미 끝났다");

  /* 12-12 같은 행동자의 **재생(replay)** — 한 번 적용된 bf 를 그대로 다시 보내도 두 번 쓰이지 않는다.
     행동 토큰(actSeq)이 이미 올라갔으므로 같은 프레임은 자기 문맥과 어긋난다. */
  X.battleModal();
  if(X.S.battle){
    const B12=X.S.battle, bf12=X.battleActionFrame(X.S), side12=X.actorOfPhase(), f12=side12==="A"?B12.fa:B12.fd;
    const slot12=f12.skills?f12.skills.findIndex((s,i)=>X.slotUsable(f12,i,side12)):-1;
    if(slot12>=0){
      X.applyAction({t:"act",k:slot12,bf:bf12}); X.drain(20000);
      const d12=dg(); X.setSeed(24541); const r12=X.rand(); X.setSeed(24541);
      X.applyAction({t:"act",k:slot12,bf:bf12}); X.drain(20000);   // 같은 side·같은 프레임의 재생
      ok(dg()===d12&&X.rand()===r12,"같은 행동자의 재생 프레임(이미 쓴 행동 토큰)은 상태도 난수도 바꾸지 않는다");
    } else ok(true,"12-12 생략: 이 시점 행동자에게 합법 슬롯이 없다");
  } else ok(true,"12-12 생략: 전투가 이미 끝났다");

  /* 12-13 Saturn MEDIUM — 레거시 별칭(k='skill'·'common')도 **실제 기술 칸**을 가리켜야 한다. slotUsable 은 없는 칸
     (skills[i]===undefined)을 막지 않아 1칸 전투원의 'skill'(슬롯1)·'common'(슬롯2)이 합법으로 읽혔고 execSlot 이 그 자리를
     기본 공격으로 대신 내보냈다. 권위 서버(room.js _legalAct 의 slotOk)와 같은 경계다 — 없는 별칭은 정확한 무동작이다.
     프레임을 직접 지어 reducer 만 부른다(커밋 없음): 거부는 받은 상태 **그 객체**를 이벤트 없이 돌려주고 행동 토큰도 그대로다. */
  {
    const mkB=n=>({phase:0,round:1,actSeq:7,firstSide:"A",menu:{open:true},bonus:null,msgQ:[],
      attP:{owner:0},defP:{owner:1},
      fa:{skills:["s0","s1","s2","s3"].slice(0,n),cds:[0,0,0,0].slice(0,n),skillAtk:9,cd:0},
      fd:{skills:["s0"],cds:[0],skillAtk:9,cd:0}});
    const hit=(B,k)=>{ const st={battle:B};
      return {st,r:X.reduceCoreAction(st,{t:"act",k,frame:{B,side:"A",seq:B.actSeq,round:B.round,phase:B.phase}})}; };
    const one=mkB(1); X.setSeed(24560); const rL=X.rand(); X.setSeed(24560);
    const noop=["skill","common"].map(k=>hit(one,k));
    ok(noop.every(x=>x.r.events.length===0&&x.r.state===x.st)&&one.actSeq===7&&one.menu&&one.menu.open===true&&X.rand()===rL,
       "1칸 전투원의 레거시 별칭 'skill'·'common' 은 없는 칸이므로 정확한 무동작이다 — 상태 참조·이벤트·메뉴·행동 토큰·난수 무변경, 기본 공격으로 대체되지 않는다");
    ok(hit(one,1).r.events.length===0&&hit(one,2).r.events.length===0&&hit(one,"__nope").r.events.length===0,
       "같은 전투원의 없는 슬롯 번호 1·2 와 알 수 없는 종류도 종전대로 거부된다");
    const four=mkB(4);
    ok(J245(["basic","skill","common",3].map(k=>hit(four,k).r.events[0]))===J245([{type:"battleSlot",side:"A",slot:0},
       {type:"battleSlot",side:"A",slot:1},{type:"battleSlot",side:"A",slot:2},{type:"battleSlot",side:"A",slot:3}]),
       "대조: 칸이 실제로 있는 전투원의 'basic'·'skill'·'common' 과 슬롯 번호는 종전대로 슬롯 0·1·2·3 으로 나간다");
    const legacy=mkB(0); legacy.fa.skills=null; legacy.fa.cds=null;
    ok(hit(legacy,"basic").r.events[0].slot===-1&&hit(legacy,"skill").r.events[0].type==="battleLegacySkill"
       &&hit(legacy,"common").r.events.length===0,
       "대조: skills 없는 구형 전투원의 'basic'·'skill' 은 그대로 살아 있고, 슬롯2 를 가리키는 'common' 만 서버와 같이 거부된다");
    const cooled=mkB(0); cooled.fa.skills=null; cooled.fa.cds=null; cooled.fa.cd=2;
    const noSkill=mkB(0); noSkill.fa.skills=null; noSkill.fa.cds=null; noSkill.fa.skillAtk=0;
    /* Saturn MEDIUM(#245): 종전 검사는 이벤트만 봤다 — 거부가 B.menu 를 이미 지운 뒤였어도 통과했다.
       가용성 게이트를 B.menu=null 앞으로 옮겼으므로 거부는 **메뉴까지 포함해** 정확한 무동작이다. */
    X.setSeed(24561); const rL2=X.rand(); X.setSeed(24561);
    const badLegacy=[hit(cooled,"skill"),hit(noSkill,"skill")];
    ok(badLegacy.every(x=>x.r.events.length===0&&x.r.state===x.st&&x.st.battle===x.r.state.battle)
       &&cooled.menu&&cooled.menu.open===true&&noSkill.menu&&noSkill.menu.open===true
       &&cooled.actSeq===7&&noSkill.actSeq===7&&cooled.fa.cd===2&&noSkill.fa.skillAtk===0&&X.rand()===rL2,
       "쿨 중이거나 속성 스킬이 없는 구형 전투원의 'skill' 도 정확한 무동작이다 — 상태·전투 참조·이벤트·메뉴·행동 토큰·난수 무변경 (서버 _legalAct·UI canSkill 과 같은 조건)");
    const okLegacy=mkB(0); okLegacy.fa.skills=null; okLegacy.fa.cds=null;
    ok(hit(okLegacy,"skill").r.events[0].type==="battleLegacySkill"&&okLegacy.menu===null,
       "대조: 합법한 구형 'skill' 은 종전대로 발동하고 그때만 메뉴가 닫힌다");
  }
  X.TQ.length=0;
}
/* (12b) #245 개봉 표(pkgSel)의 수명 — 취소·교체·행동 전환에서 회수된다.
   표는 확정(pkgPick)의 겨냥 문맥이자 일회용 인가다: 살아남으면 늦게 온 확정이 재고를 움직인다. */
{
  const X=H.load(index); X.tutSkip(); H.freshPlay(X,"pvp"); X.tutSkip(); X.BAL.dmgVar=0;
  H.clearBoard(X);
  const me=X.S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=X.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(X,me,12,4); H.place(X,em,11,4);
  H.place(X,X.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(X,X.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  X.S.balls=[3,3]; X.S.reserve=[null,null]; X.S.inv=[[],[]];
  X.S.battle=null; X.S.battlesUsed=0; X.TQ.length=0;
  X.setSeed(24550); X.startRounds(me,em,me,em); X.drain(20000);
  const B=X.S.battle, dg2=()=>lockstepDigest(X);
  ok(!!B,"12b 전제: 전투가 열렸다");
  const own=()=>((X.actorOfPhase()==="A")?B.attP:B.defP).owner;

  /* 12b-1 취소 — 표를 회수한다. 취소 뒤의 확정은 인가받지 못한다 (재고·난수 무변경) */
  X.battleModal(); const o1=own(); X.S.pkgs[o1]={itemGift:2,battleBuff:1}; B.pkgSel=null; B.buffA=null; B.buffD=null;
  X.__openPkgCore("itemGift"); X.drain(20000);
  ok(!!B.pkgSel&&B.pkgSel.kind==="itemGift"&&B.pkgSel.owner===o1&&B.pkgSel.side===X.actorOfPhase()
     &&B.pkgSel.seq===(B.actSeq||0)&&B.pkgSel.round===B.round&&B.pkgSel.phase===B.phase
     &&Number.isInteger(B.pkgSel.id),
     "개봉이 발급한 표는 종류·소유자·겨냥 문맥 4필드와 **발급 번호(id)** 를 싣는다");
  const tk1=B.pkgSel.id;
  X.__pkgCancelCore(tk1); X.drain(20000);
  ok(B.pkgSel===null,"취소는 표를 회수한다 (표시 계층이 아니라 Core 가)");
  const dC=dg2(); X.setSeed(24551); const rC=X.rand(); X.setSeed(24551);
  X.__pkgPickCore("gift",0,tk1); X.drain(20000);
  ok(X.S.pkgs[o1].itemGift===2&&dg2()===dC&&X.rand()===rC,"취소된 표로는 확정이 인가되지 않는다 — 재고·상태·난수 무변경");

  /* 12b-2 교체 — 새 개봉이 앞의 표를 대신한다. 앞 종류의 확정은 더 이상 인가되지 않는다 */
  X.battleModal(); X.__openPkgCore("itemGift"); X.drain(20000); const tk2a=B.pkgSel.id;
  X.battleModal(); X.__openPkgCore("battleBuff"); X.drain(20000);
  ok(B.pkgSel&&B.pkgSel.kind==="battleBuff"&&B.pkgSel.id!==tk2a,"두 번째 개봉이 표를 교체하고 새 번호를 발급한다");
  const giftBefore=X.S.pkgs[o1].itemGift;
  X.__pkgPickCore("gift",0,tk2a); X.drain(20000);
  ok(X.S.pkgs[o1].itemGift===giftBefore,"교체된 앞 표(선물)로는 확정이 인가되지 않는다");
  /* 12b-2' **같은 종류**의 재개봉 — 종류·소유자·겨냥 문맥 4필드가 글자 그대로 같아 표 내용만으로는 구별되지 않는다.
     남은 근거는 발급 번호뿐이다: 앞 개봉의 살아 있는 모달 콜백이 뒤 개봉의 표(와 재고)를 소모하면 안 된다. */
  X.__pkgCancelCore(B.pkgSel.id); X.drain(20000);
  X.battleModal(); const o2=own(); X.S.pkgs[o2]={itemGift:2,battleBuff:1}; X.S.inv[o2]=[]; B.pkgSel=null;
  X.__openPkgCore("itemGift"); X.drain(20000); const tkA=B.pkgSel.id;
  X.battleModal(); X.__openPkgCore("itemGift"); X.drain(20000); const tkB=B.pkgSel.id;
  ok(tkA!==tkB&&B.pkgSel.kind==="itemGift"&&B.pkgSel.owner===o2&&B.pkgSel.side===X.actorOfPhase()
     &&B.pkgSel.seq===(B.actSeq||0)&&B.pkgSel.round===B.round&&B.pkgSel.phase===B.phase,
     "같은 종류·같은 문맥의 재개봉도 **다른 번호**의 새 표를 발급한다");
  const dR=dg2(); X.setSeed(24554); const rR=X.rand(); X.setSeed(24554);
  X.__pkgPickCore("gift",0,tkA); X.drain(20000);
  ok(X.S.pkgs[o2].itemGift===2&&X.S.inv[o2].length===0&&B.pkgSel&&B.pkgSel.id===tkB&&dg2()===dR&&X.rand()===rR,
     "앞 개봉의 남은 콜백은 같은 종류로 재발급된 표·재고를 소모하지 못한다 — 표·재고·상태·난수 무변경");
  X.__pkgCancelCore(tkA); X.drain(20000);
  ok(B.pkgSel&&B.pkgSel.id===tkB,"앞 개봉의 [취소] 콜백도 재발급된 표를 회수하지 못한다");
  X.__pkgPickCore("gift",0,tkB); X.drain(20000);
  ok(X.S.pkgs[o2].itemGift===1&&B.pkgSel===null,"지금 살아 있는 표(뒤 개봉)의 확정은 정상 동작한다");
  X.__pkgCancelCore(tkB); X.drain(20000);

  /* 12b-3 행동 전환 — 차례가 넘어가면 열려 있던 표가 만료된다 (nextPhase 가 표 자체를 회수한다) */
  X.battleModal(); const o3=own(); X.S.pkgs[o3]={itemGift:2,battleBuff:1};
  X.__openPkgCore("itemGift"); X.drain(20000);
  ok(!!B.pkgSel,"12b-3 전제: 표가 발급됐다");
  const tk3=B.pkgSel.id;
  X.nextPhase(); X.drain(20000);
  ok(B.pkgSel===null,"행동 전환(nextPhase)은 열려 있던 개봉 표를 만료시킨다");
  const dT=dg2(); X.setSeed(24552); const rT=X.rand(); X.setSeed(24552);
  X.__pkgPickCore("gift",0,tk3); X.drain(20000);
  ok(X.S.pkgs[o3].itemGift===2&&dg2()===dT&&X.rand()===rT,"차례가 넘어간 뒤의 늦은 확정은 인가되지 않는다 — 재고·상태·난수 무변경");

  /* 12b-4 대조: 가드가 기능을 죽이지 않았다 — 같은 렌더의 정상 개봉→확정은 정확히 한 번 통한다 */
  X.battleModal(); const o4=own(); X.S.pkgs[o4]={itemGift:1,battleBuff:0}; X.S.inv[o4]=[]; B.pkgSel=null;
  X.__openPkgCore("itemGift"); X.drain(20000);
  X.__pkgPickCore("gift",0,B.pkgSel&&B.pkgSel.id); X.drain(20000);
  ok(X.S.pkgs[o4].itemGift===0&&B.pkgSel===null,"정상 개봉→확정은 한 번 통하고 표는 그 자리에서 소모된다");

  /* 12b-5 **같은 행동자**의 라운드 경계 뒤 옛 진입점·재생 프레임 (#146 F9 계열의 비-strict 판).
     side 가 그대로라 '행동자 불일치'로는 걸리지 않는다 — 남는 근거는 겨냥 문맥의 행동 토큰(actSeq)뿐이고,
     종전에는 그 토큰을 도망·넘기기(strict)에서만 봤다. 가방·패키지·기술도 같은 게이트를 지나야 한다. */
  X.battleModal();
  const side5=X.actorOfPhase(), bf5=X.battleActionFrame(X.S);
  const staleItem5=X.__useItemCore, staleOpen5=X.__openPkgCore, staleAct5=X.__actCore;
  X.nextPhase(); X.drain(20000);
  if(X.S.battle&&X.actorOfPhase()!==side5){ X.nextPhase(); X.drain(20000); }
  /* #233 (GDD-23 4.4) 라운드 경계에서 선턴이 같은 쪽으로 굳은 판을 만든다 (smoke_issue146 F9 와 같은 상황) —
     행동자는 그대로이고 행동 토큰·라운드만 올라간 상태다. 옛 진입점은 다시 그리지 않는다. */
  if(X.S.battle&&X.S.battle.phase===0) B.firstSide=side5;
  if(X.S.battle&&X.actorOfPhase()===side5&&(B.actSeq||0)!==bf5.seq){
    const o5=own(); X.S.pkgs[o5]={itemGift:1,battleBuff:1}; X.S.inv[o5]=["potion"];
    B.itemRoundA=false; B.itemRoundD=false; B.pkgSel=null;
    const d5=dg2(); X.setSeed(24553); const r5=X.rand(); X.setSeed(24553);
    staleItem5(0); staleOpen5("itemGift"); staleAct5(0);      // 옛 렌더의 진입점(회선 문맥 없음 — 그 렌더의 프레임을 쓴다)
    X.applyAction({t:"item",i:0,bf:bf5});                     // 재생된 회선 프레임도 같은 근거로 떨어진다
    X.drain(20000);
    ok(dg2()===d5&&X.rand()===r5&&B.pkgSel===null&&X.S.inv[o5].length===1&&X.S.pkgs[o5].itemGift===1,
       "라운드 경계를 넘은 뒤 같은 행동자의 옛 진입점·재생 프레임(가방·패키지·기술)은 행동 토큰만으로 거부된다 — 상태·재고·난수 무변경");
    /* 대조: 지금 렌더의 같은 입력은 정상 동작한다 (가드가 기능을 죽이지 않았다) */
    X.battleModal(); X.__useItemCore(0); X.drain(20000);
    ok(X.S.inv[o5].length===0,"같은 자리의 **지금 렌더** 아이템 사용은 정상 동작한다");
  } else ok(true,"12b-5 생략: 라운드 경계에서 행동자가 바뀌었거나 전투가 끝났다");

  /* 12b-6 **전투를 넘는** 표 번호 (Saturn REVISE 4차). 발급 카운터가 전투 인스턴스 안에 있으면 전투마다 0 으로
     돌아가 두 번째 전투의 첫 표가 첫 전투의 첫 표와 같은 번호를 받는다 — 그러면 앞 전투에 남은 모달 콜백이
     지금 살아 있는 표를 회수하거나(취소) 재고를 움직인다(확정). 번호는 **경기 안에서** 유일해야 한다. */
  const staleTickets=[tk1,tk2a,tkA,tkB,tk3];                                 // 첫 전투가 발급한 번호들 (1 부터 시작한다)
  const staleCancel6=X.__pkgCancelCore, stalePick6=X.__pkgPickCore;          // 첫 전투의 개봉 화면에 남은 콜백 (그 렌더의 프레임을 든다)
  X.S.battle=null; X.setSeed(24556); X.startRounds(me,em,me,em); X.drain(20000);
  const B6=X.S.battle;
  ok(!!B6,"12b-6 전제: 같은 경기에서 두 번째 전투가 열렸다");
  const o6=((X.actorOfPhase()==="A")?B6.attP:B6.defP).owner;
  X.battleModal(); X.S.pkgs[o6]={itemGift:2,battleBuff:1}; X.S.inv[o6]=[]; B6.pkgSel=null;
  X.__openPkgCore("itemGift"); X.drain(20000);
  const tk6=B6.pkgSel&&B6.pkgSel.id;
  ok(Number.isInteger(tk6)&&!staleTickets.includes(tk6),
     "새 전투의 표는 앞 전투가 쓴 어떤 번호와도 겹치지 않는다 (발급 카운터가 전투가 아니라 경기 단위)");
  const d6=dg2(); X.setSeed(24557); const r6=X.rand(); X.setSeed(24557);
  staleCancel6(staleTickets[0]); X.__pkgCancelCore(staleTickets[0]); X.drain(20000);   // 앞 전투의 [취소] 콜백 · 같은 번호를 든 지금 렌더의 취소
  ok(B6.pkgSel&&B6.pkgSel.id===tk6,"앞 전투의 취소 콜백은 새 전투의 살아 있는 표를 회수하지 못한다");
  stalePick6("gift",0,staleTickets[0]); X.__pkgPickCore("gift",0,staleTickets[0]); X.drain(20000);
  ok(X.S.pkgs[o6].itemGift===2&&X.S.inv[o6].length===0&&B6.pkgSel&&B6.pkgSel.id===tk6&&dg2()===d6&&X.rand()===r6,
     "앞 전투의 확정 콜백도 새 전투의 재고를 움직이지 못한다 — 표·재고·상태·난수 무변경");
  X.__pkgPickCore("gift",0,tk6); X.drain(20000);
  ok(X.S.pkgs[o6].itemGift===1&&B6.pkgSel===null,"대조: 새 전투의 살아 있는 표는 정상 동작한다");
  X.TQ.length=0;
}
/* (13) #245 전투 규칙의 사본이 표시·네트워크·AI 계층에 남아 있지 않다 */
{
  const netSrc=fs.readFileSync(path.join(demo,"js","network.js"),"utf8");
  const aiSrc=fs.readFileSync(path.join(demo,"js","ai.js"),"utf8");
  ok(!/\b(execSlot|nextPhase|finishBattle|finishByCapture|bmsg)\s*\(/.test(netSrc),"네트워크 계층은 전투 엔진을 직접 부르지 않는다 (프로토콜·중계만)");
  ok(!/\b(execSlot|nextPhase|finishBattle|finishByCapture|bmsg)\s*\(/.test(aiSrc)&&!/S\.battle\.[A-Za-z]+\s*=[^=]/.test(aiSrc),
     "AI 는 전투 상태를 직접 바꾸지 않는다 — 액션만 돌려준다");
  /* #245 Saturn REVISE(M2): AI 에는 **표시·네트워크 진입점이 한 칸도 남지 않는다**. 종전에는 window.__act/__flee/
     __useItem/__throwBall/__pass/__openPkgCore/__pkgPickCore/__recruitCore 와 netAction 을 지나, 표시 계층이 자기
     렌더에 굳혀 둔 프레임을 빌려 썼다 — 화면이 없으면 AI 가 전투에서 한 수도 두지 못했다. */
  const aiCode=aiSrc.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*\/\/.*$/gm,"").replace(/([^:"'])\/\/.*$/gm,"$1"); // 주석(이력 서술)은 제외하고 실제 호출만 본다
  ok(!/\bwindow\b/.test(aiCode)&&!/\bnetAction\s*\(/.test(aiCode)&&!/\bdocument\b/.test(aiCode),
     "AI 코드에는 window·document·netAction 이 하나도 없다 — 고른 행동을 Core 액션으로 직접 보낸다");
  ok(/const aiCmd=a=>dispatchCoreAction\(Object\.assign\(\{frame:battleCmdFrame\(\)\},a\)\);/.test(aiSrc)
     &&/function battleCmdFrame\(state\)/.test(fs.readFileSync(path.join(demo,"js","core.js"),"utf8")),
     "전투 커맨드의 겨냥 문맥은 **지금 상태에서** Core 가 짓는다 (렌더가 굳혀 둔 프레임을 빌리지 않는다)");
  /* 표시 계층의 예약·잠금·보류는 있으면 쓰고 없으면 그 자리에서 실행한다 — ai.js 가 그 자리의 존재를 전제하지 않는다 */
  ok(/typeof fxWhenIdle==="function"/.test(aiSrc)&&/typeof setTimeout==="function"/.test(aiSrc)&&/typeof UI!=="undefined"/.test(aiSrc)
     &&!/(^|[^.\w])render\(\)/.test(aiCode),
     "AI 의 예약·보류는 표시 계층이 없으면 즉시 실행으로 떨어지고, 화면 갱신도 render() 직접 호출이 아니라 Core 이벤트다");
}
/* ===== (14) #245 예고·지연 효과 스케줄러(#233 GDD-23 4.3·4.6) — 예약·카운트는 Core reducer, 발동은 delayedFired 이벤트 ===== */
{
  const liveBattle=T.S.battle, fired=[];
  /* #245 Saturn REVISE(M3): 액션은 **전투원을 싣지 않는다** — 상태 안의 자리(side)만 싣고 reducer 가 그 자리의
     살아 있는 전투원을 찾아 대기열을 고친다. 전투원을 복제하지 않으므로 #233 의 run 훅·execSlot 이 붙잡은 정체성은 그대로다. */
  const mkSide=()=>{ const B={fa:{pendingFx:[]},fd:{pendingFx:[]},msgQ:[]}; T.S.battle=B; return B; };
  const B1=mkSide();
  const sched=T.reduceCoreAction(T.S,{t:"delaySchedule",side:"A",delayRounds:2,run:()=>{},tag:"tide_warning"});
  const f1=B1.fa;
  ok(sched.state===T.S&&sched.events.length===0&&f1.pendingFx.length===1&&f1.pendingFx[0].roundsLeft===2&&f1.pendingFx[0].tag==="tide_warning"&&typeof f1.pendingFx[0].run==="function"&&f1===T.S.battle.fa,
     "예약은 Core 액션 하나로 들어가고 서버 락스텝 요약이 읽는 roundsLeft·tag·run 을 그대로 보존한다 (전투원 객체는 복제되지 않는다)");
  T.reduceCoreAction(T.S,{t:"delaySchedule",side:"A",delayRounds:1,run:()=>{}});
  ok(f1.pendingFx[1].tag===null&&T.reduceCoreAction(T.S,{t:"delaySchedule",side:null,delayRounds:1,run:()=>{}}).events.length===0,
     "tag 없는 예약은 null 로 떨어지고(서버 요약 역호환) 가리킬 자리가 없는 예약은 조용한 무동작이다");
  /* 액션에는 전투원이 없다 — 상태를 우회해 남의 객체를 건네는 통로가 없다 */
  const actions=[{t:"delaySchedule",side:"A",delayRounds:1,run:()=>{},tag:"x"},{t:"delayTick",side:"A"}];
  ok(actions.every(a=>Object.keys(a).every(k=>typeof a[k]!=="object"||a[k]===null)&&!("f" in a)),
     "예약·카운트 액션은 전투원 객체를 싣지 않는다 — 자리(side)와 값만 싣는다 (상태 우회 통로 없음)");
  /* 카운트는 reducer 가 내리고 콜백은 그 **다음**에 — 커밋된 대기열을 보고 도는지 훅 안에서 직접 확인한다 */
  const B2=mkSide();
  let seenQueue=null;
  B2.fa.pendingFx=[{roundsLeft:1,tag:"a",run:()=>{ seenQueue=T.S.battle.fa.pendingFx.slice(); fired.push("a"); }},
                   {roundsLeft:5,tag:"later",run:()=>fired.push("never")}];
  const tick=T.reduceCoreAction(T.S,{t:"delayTick",side:"A"});
  ok(fired.length===0&&B2.fa.pendingFx.length===1&&B2.fa.pendingFx[0].tag==="later"&&tick.events.length===1&&tick.events[0].type==="delayedFired"&&tick.events[0].side==="A"&&tick.events[0].fired.length===1&&tick.events[0].fired[0].tag==="a",
     "reducer 가 대기열을 확정하고 콜백은 부르지 않는다 — 발동은 delayedFired 이벤트로만 나간다");
  T.applyCoreEffects(tick.events[0]);
  ok(fired.length===1&&!!seenQueue&&seenQueue.length===1&&seenQueue[0].tag==="later"&&seenQueue[0].roundsLeft===4,
     "실행 훅은 **대기열이 커밋된 뒤에만** 돈다 — 훅 안에서 본 대기열은 이미 발동 항목이 빠지고 카운트가 내려간 상태다");
  const B3=mkSide();
  B3.fa.pendingFx=[{roundsLeft:2,tag:null,run:()=>fired.push("b")}];
  const wait=T.reduceCoreAction(T.S,{t:"delayTick",side:"A"});
  ok(wait.events.length===0&&B3.fa.pendingFx.length===1&&B3.fa.pendingFx[0].roundsLeft===1&&T.reduceCoreAction(T.S,{t:"delayTick",side:"D"}).events.length===0,
     "대기 중인 예약은 카운트만 내려가고 빈 대기열은 이벤트를 내지 않는다");
  /* 4.6 취소 규칙은 항목마다 다시 본다 — tickDelayed() 래퍼는 종전과 같은 결과를 낸다 */
  const B4=mkSide(); const f4=B4.fa;
  f4.pendingFx=[{roundsLeft:1,tag:null,run:()=>fired.push("c")}];
  T.S.battle=null; T.tickDelayed(f4);
  ok(fired.indexOf("c")<0&&f4.pendingFx.length===1,"전투가 없으면 가리킬 자리가 없어 대기열도 콜백도 움직이지 않는다 (4.6 취소 경로는 resetAfter 가 비운다)");
  const B5=mkSide();
  B5.fa.pendingFx=[{roundsLeft:1,tag:null,run:()=>fired.push("d")}];
  T.tickDelayed(B5.fa);
  ok(fired.filter(x=>x==="d").length===1&&B5.fa.pendingFx.length===0,"전투가 살아 있으면 tickDelayed() 한 번에 정확히 한 번 발동한다");
  /* 음성 대조: 발동한 효과가 전투를 끝내면(resetAfter 가 대기열을 비운다) 남은 예약은 되살아나지 않는다.
     분리 전은 콜백을 먼저 돌리고 **그 뒤에** 남은 목록을 다시 대입해, 이미 취소된 예약이 다음 전투로 살아서 넘어갔다. */
  const B6=mkSide(); const f6=B6.fa;
  f6.pendingFx=[{roundsLeft:1,tag:"end",run:()=>{ T.S.battle=null; T.resetAfter(f6); fired.push("e"); }},
                {roundsLeft:1,tag:"later2",run:()=>fired.push("f")}];
  T.tickDelayed(f6);
  ok(fired.indexOf("e")>=0&&fired.indexOf("f")<0&&(!f6.pendingFx||f6.pendingFx.length===0),
     "발동한 효과가 전투를 끝내면 남은 예약은 되살아나지 않는다 (4.6) — 종전은 실행 뒤에 대기열을 다시 대입해 취소된 예약을 부활시켰다");
  T.S.battle=liveBattle;
  /* 단일 경로: 래퍼 둘은 Core 액션 호출뿐이고, 표시·AI·네트워크 계층은 대기열을 직접 건드리지 않는다 */
  const coreSrc=fs.readFileSync(path.join(demo,"js","core.js"),"utf8");
  ok(/function scheduleDelayed\(f,delayRounds,run,tag\)\{ return dispatchCoreAction\(\{t:"delaySchedule",side:battleSideOf\(f\),delayRounds,run,tag\}\); \}/.test(coreSrc)
    &&/function tickDelayed\(f\)\{ return dispatchCoreAction\(\{t:"delayTick",side:battleSideOf\(f\)\}\); \}/.test(coreSrc),
     "#233 래퍼 둘은 Core 액션 하나를 부르는 줄만 남기고 전투원 대신 그 자리(side)를 싣는다 (계약은 그대로, 대기열 변이는 reducer 한 곳)");
  const delayCase=coreSrc.slice(coreSrc.indexOf('case "delayTick"'),coreSrc.indexOf("default: return null;"));
  ok(delayCase.length>0&&!/\.run\(\)/.test(delayCase)&&delayCase.indexOf("S.")<0&&!/action\.f\b/.test(delayCase),
     "delayTick reducer 안에는 콜백 실행도 전역 S 참조도 액션이 실어 온 전투원도 없다");
  ok(["ui.js","ui-overlays.js","ai.js","network.js","state.js","data.js"].every(name=>
      !/pendingFx\s*(?:=[^=]|\.(?:push|splice|pop|shift|unshift))/.test(fs.readFileSync(path.join(demo,"js",name),"utf8"))),
     "표시·AI·네트워크·데이터 계층은 예약 대기열을 직접 변이하지 않는다");
}
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
  /* #245: 요약은 **원본 그대로** 대조한다 — 걷어내는 항목도, 값을 맞춰 주는 정규화도 없다.
     종전에는 searchEndSeq 만 표현이 달라(분리 전은 래치가 `S.searchEndSeq=tk.seq+0.5` 로 되써서 완료마다 1.5 씩
     올랐고, 래치를 게임별 WeakMap 으로 옮긴 판은 완료 횟수 그대로였다) 이 항목을 대조에서 지웠지만, 그것은 실제
     동작 차이를 검사에서 가린 것이었다. 래치를 분리 전과 같은 값·같은 경로(Core searchEndLatch 액션)로 되돌렸으므로
     지금은 두 판의 요약이 글자 하나까지 같다. */
  const trace=(opts,seed)=>{
    const X=H.load(index,opts), stateTrace=[];
    const result=H.runSim(X,["grade5","grade5"],seed,{cap:3000000,trace:Y=>stateTrace.push(lockstepDigest(Y))});
    return JSON.stringify({stateTrace,digest:lockstepDigest(X),snapshot:result.snap,winner:result.winner,phase:result.phase,turns:result.turns,winType:result.winType,steps:result.steps,viol:result.viol});
  };
  // 24511 은 텔레포트 스왑 3회, 24512 는 2회 + 왕 끝줄 도달(edge) 승리 — Core 로 옮긴 스왑과 왕 끝줄 승리 경로를 둘 다 지난다 (레거시 분기는 남아 있지 않다)
  for(const seed of [24501,24502,24511,24512]) ok(trace({html:baseHtml},seed)===trace({},seed),"seed "+seed+" snapshot/digest/winner matches the pre-split baseline");
}

/* ===== #245 반복 스킬 선언 표 — 데이터 한 곳 · 예외만 좁은 hook =====
   표로 옮긴 15종은 V2_FX 손글씨 구현이 없고 스킬 데이터의 self* 필드만으로 돈다.
   달궈진 껍질만 좁은 hook 으로 남는다 — 경화 → 반격 표식 순서를 표의 고정 순서로 낼 수 없어서다. 아래 (3b) 가 그 순서를 본다.
   검사는 실제 엔진 경로(execSlot → execV2 → v2Default → v2Self)로 몰아서 전환 전과 같은 **로그 전문과 상태**를 본다.
   기대값은 전환 전 손글씨 구현을 같은 무대에서 돌려 받은 실측이다. 끝에 음성 대조 둘이 붙는다. */
{
  const realRandom=Math.random;
  /* 무대: 내 HP 60/120 · 자기 화상 1개(정화가 보이게) · 방어막 10 · 상대 HP 300. 난수 0.5 = 회피·치명 없음 */
  const tableArena=(skillId,probe)=>{
    H.freshPlay(T,"pvp"); H.clearBoard(T);
    const mine=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), foe=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
    H.place(T,mine,7,4); H.place(T,foe,6,4);
    H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
    H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
    const set=(piece,o)=>{ piece.hp=o.hp; piece.maxHp=o.maxHp; piece.atk=20; piece.def=0; piece.spd=10; piece.dodge=0; piece.crit=0;
      piece.statusPct=0; piece.grade=1; piece.element=o.element; piece.shieldStartPct=0; piece.skills=o.skills; piece.revealedSkills=[]; piece.legend=null;
      piece.name=o.name; }; // 종 이름은 무작위 배치를 타므로 로그 대조를 위해 고정한다
    set(mine,{hp:60,maxHp:120,element:"fire",skills:["M-F1-1",skillId],name:"새끼 화룡"});
    set(foe,{hp:300,maxHp:300,element:"grass",skills:["M-F1-1"],name:"상대"});
    T.S.battle=null; T.S.battlesUsed=0; T.TQ.length=0;
    T.startRounds(mine,foe,mine,foe); T.TQ.length=0;
    const B=T.S.battle;
    T.applyTimedFx(B.fa,"burn",2,"burnMag",0.05); B.fa.burnBy="D";
    T.shieldAdd(B.fa,10,"test");
    B.blog.length=0; B.msgQ.length=0;
    B.phase=(B.firstSide==="A")?0:1;
    T.setSeed(null); Math.random=()=>0.5;
    if(probe) probe(B.fa);
    T.execSlot("A",1); T.TQ.length=0;
    Math.random=realRandom; T.setSeed(null);
    const f=T.S.battle?T.S.battle.fa:B.fa;
    const state={};
    for(const key of ["hp","shield","harden","hardenPct","evadeBuff","evadeBuffR","dmgUpBuff","dmgUpBuffR","vanguardTurn",
      "retaliateBurnR","reflectR","counterR","overloadR","ringR","burn","absorbR"]) if(f[key]) state[key]=f[key];
    return {blog:B.blog.slice(),state};
  };
  /* [스킬 id, 전환 전 로그 전문, 전환 전 자기 상태] */
  const TABLE=[
    ["M-F1-3",["새끼 화룡의 달군 비늘!","🫧 방어막 22 · 가하는 피해 +20% (1R)"],{hp:60,shield:22,dmgUpBuff:0.2,dmgUpBuffR:1,burn:2}],
    ["M-W1-3",["새끼 화룡의 맑은 물!","✨ 새끼 화룡의 상태이상 1개가 해제되었다.","💚 새끼 화룡 맑은 물 — HP 10 회복!"],{hp:70,shield:10}],
    ["M-W2-3",["새끼 화룡의 잠영!","💨 회피 +20% · 다음 라운드 선턴"],{hp:60,shield:10,evadeBuff:0.2,evadeBuffR:1,vanguardTurn:1,burn:2}],
    ["M-W3-4",["새끼 화룡의 빙벽 반사!","🧊 빙벽 반사 (2R)"],{hp:60,shield:10,reflectR:2,burn:2}],
    ["M-W4-3",["새끼 화룡의 안개 걸음!","💨 회피 +30% (1R)"],{hp:60,shield:10,evadeBuff:0.3,evadeBuffR:1,burn:2}],
    ["M-W6-3",["새끼 화룡의 껍질 닫기!","🫧 방어막 32"],{hp:60,shield:32,burn:2}],
    ["M-W6-4",["새끼 화룡의 집게 반격!","🦀 집게 반격 (2R) — 방어막이 막은 피해 50% 반사"],{hp:60,shield:10,counterR:2,burn:2}],
    ["M-L3-4",["새끼 화룡의 과부하 방벽!","⚡ 과부하 방벽 (2R)"],{hp:60,shield:10,overloadR:2,burn:2}],
    ["M-L6-3",["새끼 화룡의 축전!","🫧 축전 방어막 34"],{hp:60,shield:34,burn:2}],
    ["M-E3-3",["새끼 화룡의 강철 가죽!","🛡 새끼 화룡 경화 30% (1R)"],{hp:60,shield:10,harden:1,hardenPct:0.3,burn:2}],
    ["M-E5-4",["새끼 화룡의 태고의 각성!","💚 새끼 화룡 태고의 각성 — HP 36 회복!","🛡 새끼 화룡 경화 20% (2R)"],{hp:96,shield:10,harden:2,hardenPct:0.2,burn:2}],
    ["M-E6-3",["새끼 화룡의 웅크린 공!","🫧 방어막 40"],{hp:60,shield:40,burn:2}],
    ["M-G3-3",["새끼 화룡의 나이테!","🌳 나이테 (2R)"],{hp:60,shield:10,ringR:2,burn:2}],
    ["M-G6-3",["새끼 화룡의 포자 막!","🫧 포자 막 방어막 28","💚 새끼 화룡 포자 막 — HP 7 회복!"],{hp:67,shield:28,burn:2}],
    ["L-DRAGON-2",["새끼 화룡의 비늘 세우기!","🛡 새끼 화룡 경화 15% (1R)"],{hp:60,shield:28,harden:1,hardenPct:0.15,burn:2}]
  ];
  const SELF_FIELDS=["selfShield","selfHarden","selfAbsorb","selfEvade","selfDmgUp","selfTimed","selfCleanse","selfHealPct"];
  /* (1) 구조 — 표로 옮긴 15종에는 손글씨 hook 이 없고, 동작은 전부 선언 필드로 적혀 있다 */
  ok(TABLE.every(([id])=>!Object.prototype.hasOwnProperty.call(T.V2_FX,T.SKILLS[id].fx)),
     "표로 옮긴 15종은 V2_FX 손글씨 구현을 하나도 갖지 않는다");
  ok(TABLE.every(([id])=>SELF_FIELDS.some(key=>T.SKILLS[id][key]!==undefined)),
     "표로 옮긴 15종은 전부 선언 필드(self*)로 동작을 적는다");
  /* fx 이름은 남는다 — V2_AI_HINT 표가 그 이름으로 def·heal·debuff 를 붙이고 AI 가 그대로 읽는다.
     이름과 힌트 값을 스킬마다 **정확히** 대조한다(있다/없다가 아니라 무엇인지) — 전환 전 V2_AI_HINT 분류 그대로다 */
  const AI_HINT={"M-F1-3":["emberScale","def"],"M-W1-3":["clearWater","heal"],"M-W2-3":["dive","def"],
    "M-W3-4":["iceReflect","def"],"M-W4-3":["mistStep","def"],"M-W6-3":["shellClose","def"],"M-W6-4":["clawCounter","def"],
    "M-L3-4":["overloadWall","def"],"M-L6-3":["capacitor","def"],"M-E3-3":["steelHide","def"],"M-E5-4":["ancientAwaken","heal"],
    "M-E6-3":["curlBall","def"],"M-G3-3":["treeRing","heal"],"M-G6-3":["sporeFilm","def"],"L-DRAGON-2":["scaleUp","def"]};
  const hintOk=()=>TABLE.every(([id])=>AI_HINT[id]&&T.SKILLS[id].fx===AI_HINT[id][0]&&T.SKILLS[id].ai===AI_HINT[id][1]);
  ok(Object.keys(AI_HINT).length===TABLE.length&&hintOk(),
     "표로 옮긴 15종은 fx 이름과 AI 힌트 값(def·heal·debuff)이 전환 전과 글자 그대로 같다");
  ok(T.SKILLS["M-F3-3"].fx==="heatShell"&&T.SKILLS["M-F3-3"].ai==="def","hook 으로 남은 달궈진 껍질도 fx 이름·AI 힌트가 그대로다");
  /* 음성 대조 — 힌트 값이 한 칸만 달라도(heal → def) 위 검사가 잡는다 */
  const hintSkill=T.SKILLS["M-G3-3"], keepAi=hintSkill.ai;
  hintSkill.ai="def"; const hintCaught=!hintOk(); hintSkill.ai=keepAi;
  ok(hintCaught&&hintOk(),"음성 대조 — 나이테의 AI 힌트를 heal → def 로 바꾸면 같은 검사가 잡아낸다");
  /* 남은 hook 은 전부 살아 있는 스킬이 쓴다 — 죽은 hook 이 남지 않는다 */
  const usedFx=new Set(Object.keys(T.SKILLS).map(id=>T.SKILLS[id].fx).filter(Boolean));
  ok(Object.keys(T.V2_FX).every(key=>usedFx.has(key)),"남은 V2_FX hook 은 전부 실제 스킬이 쓰는 것뿐이다 (죽은 hook 없음)");
  /* (2) 동작 동등성 — 실제 엔진 경로가 전환 전과 같은 로그 전문·같은 상태를 낸다 */
  let same=0;
  for(const [id,blog,state] of TABLE){
    const got=tableArena(id);
    if(JSON.stringify(got.blog)===JSON.stringify(blog)&&JSON.stringify(got.state)===JSON.stringify(state)) same++;
    else console.error("  선언 표 불일치 "+id+" | 기대 "+JSON.stringify([blog,state])+" | 실측 "+JSON.stringify([got.blog,got.state]));
  }
  ok(same===TABLE.length,"선언 표 15종이 전환 전과 같은 로그 전문·자기 상태를 낸다 ("+same+"/"+TABLE.length+")");
  /* (3) 고정 순서 — 방어막 문구가 회복보다 먼저, 회복이 경화보다 먼저 (전환 전 손글씨 순서) */
  const film=tableArena("M-G6-3").blog, awaken=tableArena("M-E5-4").blog;
  ok(film.findIndex(line=>line.indexOf("방어막")>=0)<film.findIndex(line=>line.indexOf("회복")>=0)
    &&awaken.findIndex(line=>line.indexOf("회복")>=0)<awaken.findIndex(line=>line.indexOf("경화")>=0),
     "선언 표는 방어막 → 회복 → 경화 고정 순서로 적용한다");
  /* (3b) 달궈진 껍질 — 경화 → 반격 화상 표식. 두 적용은 서로 독립이라 최종 상태·로그가 순서를 드러내지 않는다.
     그래서 전투원 필드의 **쓰기 순서**를 직접 본다 (접근자로 바꿔 기록 — 값은 그대로 흐른다). */
  const writeOrder=(f,keys)=>{ const seen=[],val={};
    for(const key of keys){ val[key]=f[key];
      Object.defineProperty(f,key,{configurable:true,enumerable:true,
        get(){return val[key];},set(v){ if(seen[seen.length-1]!==key) seen.push(key); val[key]=v; }}); }
    return seen; };
  const shell=tableArena("M-F3-3");
  ok(JSON.stringify(shell.blog)===JSON.stringify(["새끼 화룡의 달궈진 껍질!","🛡 새끼 화룡 경화 20% (1R)"])
    &&JSON.stringify(shell.state)===JSON.stringify({hp:60,shield:10,harden:1,hardenPct:0.2,retaliateBurnR:1,burn:2}),
     "달궈진 껍질은 전환 전과 같은 로그 전문·자기 상태를 낸다");
  let shellOrder=null;
  tableArena("M-F3-3",f=>{ shellOrder=writeOrder(f,["harden","retaliateBurnR"]); });
  ok(JSON.stringify(shellOrder)===JSON.stringify(["harden","retaliateBurnR"]),
     "달궈진 껍질은 경화를 먼저 적용하고 반격 화상 표식을 뒤에 적용한다 (전환 전 순서)");
  /* 음성 대조 — 두 적용을 뒤바꾸면 같은 검사가 쓰기 순서에서 잡는다 (최종 상태는 같다) */
  const keepHeat=T.V2_FX.heatShell;
  T.V2_FX.heatShell=c=>{ T.applyTimedFx(c.f,"retaliateBurnR",1); T.applyTimedFx(c.f,"harden",1,"hardenPct",0.20); };
  let flipped=null;
  const flippedRun=tableArena("M-F3-3",f=>{ flipped=writeOrder(f,["harden","retaliateBurnR"]); });
  T.V2_FX.heatShell=keepHeat;
  ok(JSON.stringify(flipped)===JSON.stringify(["retaliateBurnR","harden"])
    &&flippedRun.state.harden===1&&flippedRun.state.retaliateBurnR===1,
     "음성 대조 — 경화와 반격 표식의 적용 순서를 뒤바꾸면 같은 상태가 나와도 쓰기 순서에서 잡아낸다");
  /* (4) 음성 대조 A — 표 값 한 칸(방어막 18% → 19%)만 틀려도 위 검사가 잡는다 */
  const shellSkill=T.SKILLS["M-W6-3"], keepShield=shellSkill.selfShield;
  shellSkill.selfShield=0.19;
  const perturbed=tableArena("M-W6-3");
  shellSkill.selfShield=keepShield;
  ok(JSON.stringify(perturbed.blog)!==JSON.stringify(TABLE.find(row=>row[0]==="M-W6-3")[1])&&perturbed.state.shield===33,
     "음성 대조 — 표의 방어막 값을 18% → 19% 로 한 칸 틀리면 같은 검사가 로그·상태에서 잡아낸다 (32 → 33)");
  ok(JSON.stringify(tableArena("M-W6-3").blog)===JSON.stringify(TABLE.find(row=>row[0]==="M-W6-3")[1]),
     "음성 대조를 되돌리면 다시 기준값과 같다");
  /* (5) 음성 대조 B — 문구도 표가 낸다. selfMsg 를 지우면 방어막 기본 문구로 바뀐다 */
  const filmSkill=T.SKILLS["M-G6-3"], keepMsg=filmSkill.selfMsg;
  delete filmSkill.selfMsg;
  const noMsg=tableArena("M-G6-3").blog;
  filmSkill.selfMsg=keepMsg;
  ok(noMsg[1]==="🫧 방어막 28!"&&noMsg.length===film.length,
     "음성 대조 — selfMsg 를 지우면 표의 방어막 기본 문구가 대신 나온다 (문구도 손글씨가 아니라 표가 낸다)");
  Math.random=realRandom; T.setSeed(null);
}

/* ===== #245 Saturn REVISE 출전 선택(entryPick)의 수명 — 보류 결정은 **이미 열린 전투 하나**이고, 경기 종료는 그것을 거둔다 =====
   1) 보류 중에는 독립된 전투가 겹쳐 열리지 않는다 2) 늦게 돌아온 답은 살아 있는 전투를 갈아치우지 못한다
   3) 기권·경기 종료는 보류 결정을 그 자리에서 무효로 만든다 — 끝난 경기 위에 전투가 되살아나지 않는다 */
{
  const X=H.load();
  /* 동료(ally)가 상대 하수인과 붙으면 출전 선택이 열리고, 사람 차례라 reveal 단계에서 답을 기다린다 */
  const openEntry=()=>{
    H.freshPlay(X,"pvp"); H.clearBoard(X);
    const att=X.S.pieces.find(piece=>piece.owner===0&&piece.type==="ally");
    const def=X.S.pieces.filter(piece=>piece.owner===1&&piece.type==="minion")[0];
    const spare=X.S.pieces.filter(piece=>piece.owner===0&&piece.type==="minion")[0];
    const spareFoe=X.S.pieces.filter(piece=>piece.owner===1&&piece.type==="minion")[1];
    const k0=X.S.pieces.find(piece=>piece.owner===0&&piece.type==="king"), k1=X.S.pieces.find(piece=>piece.owner===1&&piece.type==="king");
    H.place(X,att,7,4); H.place(X,def,7,5); H.place(X,spare,10,4); H.place(X,spareFoe,10,5);
    H.place(X,k0,13,1); H.place(X,k1,1,7);
    X.S.current=0; X.S.mainUsed=true; X.S.battlesUsed=0; X.TQ.length=0;
    X.dispatchCoreAction({t:"battleStart",attId:att.id,defId:def.id});
    return {att,def,spare,spareFoe};
  };
  const first=openEntry();
  ok(!!X.S.entryPick&&X.S.entryPick.stage==="reveal"&&X.S.entryPick.attId===first.att.id&&X.S.battle===null,
     "a VIP entry stays as a pending decision in game state and opens no battle until the answer arrives");
  ok(X.dispatchCoreAction({t:"battleStart",attId:first.spare.id,defId:first.spareFoe.id})===false&&X.S.battle===null&&X.S.entryPick.attId===first.att.id,
     "no independent battle opens on top of a pending VIP entry — the pending decision is already one open battle");
  /* 그 사이 전투가 열린 상황(늦은 프레임·재생 경로)을 세워 두고, 옛 답이 그것을 갈아치우지 못하는지 본다 */
  X.startRounds(first.spare,first.spareFoe,first.spare,first.spareFoe);
  const live=X.S.battle;
  ok(X.dispatchCoreAction({t:"battleEntryGo"})===false&&X.S.battle===live&&first.att.revealed===false,
     "a late entry answer cannot replace a live battle — no new battle, no revealed piece");
  /* 기권 — 보류 결정이 함께 거둬지고, 그 뒤 도착한 답은 아무것도 열지 못한다 */
  openEntry();
  ok(!!X.dispatchCoreAction({t:"resign"})&&X.S.phase==="over"&&X.S.entryPick===null&&X.S.battle===null,
     "a resign clears the pending VIP entry along with the battle and recruit state");
  ok(X.dispatchCoreAction({t:"battleEntryGo"})===false&&X.S.battle===null&&X.S.phase==="over",
     "an entry answer arriving after a resign cannot revive a battle in the ended match");
  openEntry();
  X.dispatchCoreAction({t:"gameOver",winner:0,winType:"edge"});
  ok(X.S.entryPick===null&&X.dispatchCoreAction({t:"battleEntryGo"})===false&&X.S.battle===null,
     "a game over outside battle (king edge) invalidates the pending entry at the same place and refuses the late answer");
  /* 음성 대조 — 거부 조건은 좁다: 진행 중인 경기에서 전투 자리가 비어 있으면 같은 답이 그대로 전투를 연다 */
  const goodGo=openEntry();
  ok(!!X.dispatchCoreAction({t:"battleEntryGo"})&&X.S.entryPick===null&&!!X.S.battle&&X.S.battle.attP.id===goodGo.att.id,
     "negative control — in a live match with no battle open, the very same answer still starts the battle");
}

/* ===== #245 Saturn REVISE 지난 전투 스냅샷 렌더 — 최대 라운드·슬롯·사신 판정은 **넘겨받은 보드**를 읽는다 ===== */
{
  const X=H.load();
  H.freshPlay(X,"pvp"); H.clearBoard(X);
  const att=X.S.pieces.filter(piece=>piece.owner===0&&piece.type==="minion")[0];
  const def=X.S.pieces.filter(piece=>piece.owner===1&&piece.type==="minion")[0];
  const k0=X.S.pieces.find(piece=>piece.owner===0&&piece.type==="king"), k1=X.S.pieces.find(piece=>piece.owner===1&&piece.type==="king");
  H.place(X,att,7,4); H.place(X,def,7,5); H.place(X,k0,13,1); H.place(X,k1,1,7);
  X.S.current=0; X.S.mainUsed=true; X.TQ.length=0;
  X.startRounds(att,def,att,def);
  const live=X.S.battle;
  /* 서버가 보낸 지난 전투 스냅샷 — 그 전투만 3라운드(🧭 시간의 수호자)였고 2라운드까지 갔다 (netSynthBattle 이 만드는 모양) */
  const snap=Object.assign({},live,{maxRounds:3,round:2,msgQ:[],menu:null,intro:true});
  snap.bannerKey=snap.round+"-"+snap.phase;
  const roundLabel=()=>((X.byId("overlayBox").innerHTML.match(/라운드 \d+\/\d+/)||[])[0]||null);
  ok(live.maxRounds===null&&X.BAL.maxRounds===6,"premise: the live battle carries no instance cap and uses the global 6 rounds");
  X.S.battle=null; X.battleModal(snap);
  ok(roundLabel()==="라운드 2/3","a historical snapshot renders 2/3 from its own maxRounds even with no live battle in S");
  X.S.battle=live; X.battleModal(snap);
  ok(roundLabel()==="라운드 2/3"&&X.S.battle===live,"the same snapshot still renders 2/3 while a different battle is live, and the authoritative state never moves");
  X.battleModal();
  ok(roundLabel()==="라운드 1/6","the same render draws the live battle with its own cap (1/6)");
  /* 판정 헬퍼도 같은 규약이다 — 인자로 받은 보드를 읽고, 인자가 없을 때만 전역을 본다 */
  ok(X.battleMaxRounds({battle:snap})===3&&X.battleMaxRounds()===6,"battleMaxRounds reads the supplied board and falls back to the global only without one");
  ok(/3라운드까지/.test(X.reaperWhy("A",{battle:snap})||"")&&!/3라운드까지/.test(X.reaperWhy("A")||""),
     "the reaper seal reason splits on the supplied board's round cap, not on the global battle");
  const slot=live.fa.skills?live.fa.skills.findIndex((sid,i)=>X.slotUsable(live.fa,i,"A")):-1;
  ok(slot>=0,"premise: the live fighter has one legal slot right now");
  const bonusSnap=Object.assign({},snap,{bonus:{side:"A",stage:"active",allowed:[slot===0?1:0],saved:{}}});
  ok(X.slotUsable(live.fa,slot,"A")===true&&X.slotUsable(live.fa,slot,"A",{battle:bonusSnap})===false,
     "slotUsable reads the supplied board's bonus-attack stage as well (argument, not global)");
}

console.log(`\n=== smoke_issue245: pass ${pass} / fail ${fail} ===`);
if(fail) process.exit(1);
