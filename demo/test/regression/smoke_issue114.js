/* Issue114 v0.4.5 rules + two isolated lockstep clients. Read-only; node demo/test/regression/smoke_issue114.js [demo/index.html] */
"use strict";
const assert=require("assert/strict"), H=require("../shared/harness"), path=require("path");
const html=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0;
function test(name,fn){fn();pass++;console.log("PASS "+name);}
function board(T,mode="pvp"){
  T.activate();T.setSeed(114);H.freshPlay(T,mode);H.clearBoard(T);T.tutSkip();T.close();T.fxReleaseAll();T.TQ.length=0;
  for(const o of [0,1]){H.place(T,piece(T,o,"king"),o?1:13,o?7:1);H.place(T,piece(T,o,"minion",5),o?1:13,o?1:7);}
  return T.S;
}
const piece=(T,o,t,n=0)=>T.S.pieces.filter(p=>p.owner===o&&p.type===t)[n];
const pos=p=>[p.r,p.c];
const T=H.load(html);
test("unlimited teleport, third swap, cancellation, main action and trap walking",()=>{
  const s=board(T);const a=piece(T,0,"minion"),b=piece(T,0,"trap");H.place(T,a,3,4);H.place(T,b,11,4);
  assert.equal(T.BAL.teleMax,Infinity);s.teleUsed[0]=2;
  assert(T.doTeleportSwap(a,b));assert.equal(s.teleUsed[0],3);assert(s.mainUsed);assert.deepEqual(pos(b),[3,4]);
  assert(!T.canMoveTo(b,4,4));s.mainUsed=false;T.netAction({t:"tele"});T.netAction({t:"tele"});assert.equal(s.teleport,null);assert(!s.mainUsed);
});
test("VIP pair ignores captured fighters; both push without reveal, random or move observation",()=>{
  const s=board(T),a=piece(T,0,"ally"),b=piece(T,1,"ally");H.place(T,a,7,4);H.place(T,b,6,4);
  a.cap={...piece(T,0,"minion")};b.cap={...piece(T,1,"minion")};a.healing=b.healing=true;
  const observation=()=>JSON.stringify([s.aiSeenMoved.map(x=>[...x]),s.traces.map(x=>[...x]),s.forcedQueue,a.movedEver,b.movedEver]);
  const obs=observation();T.setSeed(818);const expected=T.rand();T.setSeed(818);
  T.initBattle(a,b);assert.equal(T.rand(),expected);assert.deepEqual([pos(a),pos(b)],[[8,4],[5,4]]);
  assert(!s.battle&&!a.revealed&&!b.revealed&&!a.healing&&!b.healing);assert.equal(s.battlesUsed,1);assert.equal(s.metrics.pushes,1);
  assert.equal(observation(),obs);
});
test("bomb to trap pushes both and never teaches that forced-moved trap walked",()=>{
  const s=board(T),a=piece(T,0,"bomb"),b=piece(T,1,"trap");H.place(T,a,7,4);H.place(T,b,6,4);
  T.initBattle(a,b);assert.deepEqual([pos(a),pos(b)],[[8,4],[5,4]]);assert(a.alive&&b.alive&&!a.revealed&&!b.revealed&&!b.movedEver);assert.equal(s.battlesUsed,1);
});
test("blocked side stays, possible side moves",()=>{
  board(T);const a=piece(T,0,"ally"),b=piece(T,1,"ally"),block=piece(T,0,"trap");H.place(T,a,7,4);H.place(T,b,6,4);H.place(T,block,8,4);
  T.pushResolve(a,b);assert.deepEqual([pos(a),pos(b)],[[7,4],[5,4]]);
});
test("relocation avoids hidden occupancy/enemies and is deterministic without random",()=>{
  const s=board(T),a=piece(T,0,"ally"),b=piece(T,1,"ally");H.place(T,a,7,4);H.place(T,b,6,4);
  H.place(T,piece(T,0,"trap"),8,4);H.place(T,piece(T,1,"trap"),5,4);
  T.setSeed(81);const expected=T.rand();T.setSeed(81);T.pushResolve(a,b);assert.equal(T.rand(),expected);
  assert.equal(s.metrics.relocations,1);for(const p of [a,b])assert(!T.alivePieces().some(e=>e.owner!==p.owner&&Math.abs(e.r-p.r)+Math.abs(e.c-p.c)<=1));
  assert.equal(T.relocZone(a.owner,a.r),0);assert.equal(T.relocZone(b.owner,b.r),0);assert.deepEqual(H.invariants(T),[]);
});
test("no safe pair keeps possible push and consumes same forced contact once",()=>{
  const s=board(T),a=piece(T,0,"ally"),b=piece(T,1,"ally");H.place(T,a,7,4);H.place(T,b,6,4);
  // A dense artificial board exhausts all relocation zones; only actor's push square is free.
  const others=[];let id=10000;for(let r=1;r<=13;r++)for(let c=1;c<=7;c++)if(![[7,4],[6,4],[8,4]].some(p=>p[0]===r&&p[1]===c))others.push({id:id++,owner:r<7?1:0,type:"trap",r,c,alive:true,placed:true,immobile:0});
  s.pieces=[a,b,...others];s.movedPiece=a;s.forcedTargets=[b.id];s.contactSet=[b.id];s.mainUsed=true;
  T.initBattle(a,b);assert.deepEqual([pos(a),pos(b)],[[8,4],[6,4]]);assert.equal(s.metrics.relocations,0);assert.equal(s.battlesUsed,1);
  assert.equal(s.forcedTargets.length,0);assert(!T.canBattle(a,b));assert.equal(T.drainForcedQueue(false),false);assert.equal(s.phase,"play");
  H.place(T,a,7,4);s.pieces.push({id:20000,owner:0,type:"trap",r:8,c:4,alive:true,placed:true,immobile:0});s.battlesUsed=0;s.forcedTargets=[b.id];s.contactSet=[b.id];
  T.initBattle(a,b);assert.deepEqual([pos(a),pos(b)],[[7,4],[6,4]]);assert.equal(s.battlesUsed,1);assert.equal(s.forcedTargets.length,0);assert(!T.canBattle(a,b));assert(!T.drainForcedQueue(false));
});
test("king reaches enemy edge before relocation even adjacent to another enemy",()=>{
  const s=board(T),a=piece(T,0,"king"),b=piece(T,1,"ally");H.place(T,a,2,4);H.place(T,b,3,4);H.place(T,piece(T,1,"trap"),1,5);
  T.pushResolve(a,b);assert.equal(s.winner,0);assert.equal(s.phase,"over");assert.equal(s.metrics.relocations,0);assert.deepEqual(pos(a),[1,4]);
});
test("full HP healing consumes action, zero HP tick, existing pose cannot repeat",()=>{
  const s=board(T),a=piece(T,0,"minion");H.place(T,a,10,4);assert(T.canHeal(a));assert(T.doHeal(a));assert(s.mainUsed&&a.healing);assert(!T.canHeal(a));T.healTick();assert.equal(s.metrics.healHp,0);assert(a.healing);
});
test("end button hidden for queue, teleport, modal and FX, restored at idle",()=>{
  const s=board(T),a=piece(T,0,"minion"),b=piece(T,1,"minion");H.place(T,a,7,4);H.place(T,b,6,4);s.mainUsed=true;
  const shown=()=>{T.renderTurnBar();return T.els.turnBar.children.some(b=>b.textContent==="싸우지 않고 종료");};assert(shown());
  s.forcedQueue=[{pid:a.id,targets:[b.id]}];assert(!shown());s.forcedQueue=[];s.teleport={stage:1};assert(!shown());s.teleport=null;
  T.els.overlay.classList.remove("hidden");assert(!shown());T.els.overlay.classList.add("hidden");T.FX.force=true;T.fxPlay({key:"pushBanner"});assert(!shown());T.drain();assert(shown());T.FX.force=false;
});
function flee(T,owner=1){
  const s=board(T),a=piece(T,owner,"minion"),b=piece(T,1-owner,"minion"),rear=piece(T,owner,"trap");
  H.place(T,a,owner?6:7,4);H.place(T,b,owner?7:6,4);H.place(T,rear,owner?3:10,4);s.current=0;s.mainUsed=true;s.battlesUsed=1;
  T.fleeSwapPrompt(a,b);return {s,a,b,rear};
}
test("defender flee owner blocks turn operations; stale buttons and frames ignored",()=>{
  const {s,a,rear}=flee(T);T.renderTurnBar();const old=T.els.turnBar.children[0],token=s.fleePick.token,oldCell=T.els.board.children.find(c=>+c.dataset.r===rear.r&&+c.dataset.c===rear.c);
  assert.equal(T.netActor(),1);assert.equal(T.autoEndReady(),null);T.endTurn();assert.equal(s.turnCount,0);
  T.netAction({t:"endTurn"});T.netAction({t:"tele"});T.netAction({t:"skipMain"});assert(s.fleePick&&!s.teleport);
  T.netAction({t:"cell",r:rear.r,c:rear.c});assert(!s.fleePick);assert.deepEqual(pos(a),[3,4]);assert.equal(s.battlesUsed,1);assert.equal(s.metrics.fleePushes,1);
  board(T);const before=JSON.stringify(T.S);old.onclick();oldCell.onclick();T.applyAction({t:"cell",r:13,c:1,pick:token});assert.equal(JSON.stringify(T.S),before);
});
test("no-rear and skip both push; queued duty candidate excluded until final positions",()=>{
  const {s,a,b,rear}=flee(T,0);T.netAction({t:"fleeSkip"});assert.deepEqual([pos(a),pos(b)],[[8,4],[5,4]]);assert.deepEqual(pos(rear),[10,4]);assert.equal(s.metrics.battles,0);assert.equal(s.metrics.pushes,1);
  flee(T,1);const p=piece(T,1,"minion"),enemy=piece(T,0,"minion");for(const x of T.alivePieces())if(x.owner===1&&x.id!==p.id)x.placed=false;
  T.S.fleePick=null;T.fleeSwapPrompt(p,enemy);assert(!T.S.fleePick);assert.equal(T.S.metrics.fleePushes,1);
  const f=flee(T,0);T.S.fleePick=null;T.S.forcedQueue=[{pid:f.rear.id,targets:[f.b.id]}];T.fleeSwapPrompt(f.a,f.b);assert(!T.S.fleePick.cands.includes(f.rear.id));assert.equal(T.S.forcedQueue.length,1);
});
test("two clients defender/attacker flee click and skip, same state/RNG, non-owner sends zero",()=>{
  for(const owner of [0,1])for(const skip of [false,true]){
    const clients=[H.load(html),H.load(html)],sent=[[],[]];
    const fixtures=clients.map((C,i)=>{const f=flee(C,owner);C.NET.mode=C.NET.started=true;C.NET.me=i;C.NET.ws={readyState:1,send:m=>sent[i].push(JSON.parse(m))};C.render();return f;});
    const non=clients[1-owner];non.activate();non.netAction({t:"fleeSkip"});assert.equal(sent[1-owner].length,0);
    const C=clients[owner],f=fixtures[owner];C.activate();C.netAction(skip?{t:"fleeSkip"}:{t:"cell",r:f.rear.r,c:f.rear.c});assert.equal(sent[owner].length,1);
    non.activate();non.NET.queue.push(sent[owner][0].a);non.netPump();assert.equal(non.NET.queue.length,0);
    const snap=X=>JSON.stringify({p:X.S.pieces,main:X.S.mainUsed,current:X.S.current,fp:X.S.fleePick,b:X.S.battlesUsed,m:X.S.metrics,forced:X.S.forcedTargets,q:X.S.forcedQueue});
    assert.equal(snap(C),snap(non));assert.equal(C.rand(),non.rand());assert.equal(sent[1-owner].length,0);
  }
});
test("online resignation remains current-player owned during defender selection",()=>{
  const C=H.load(html);flee(C,1);const sent=[];C.NET.mode=true;C.NET.me=1;C.NET.ws={readyState:1,send:m=>sent.push(m)};
  C.netAction({t:"resign"});assert.equal(sent.length,0);assert.equal(C.S.phase,"play");C.NET.me=0;C.netAction({t:"resign"});assert.equal(sent.length,1);assert.equal(C.S.winner,1);
});
test("AI fair observation: swapping unseen identities does not change VIP scoring",()=>{
  board(T);const a=piece(T,0,"ally"),b=piece(T,1,"ally");H.place(T,a,7,4);H.place(T,b,6,4);b.revealed=false;
  const first=T.aiBattlePairScore(0,a,b);b.type="king";assert.equal(T.aiBattlePairScore(0,a,b),first);assert(!T.aiVipPair(a,b));
  b.revealed=true;assert(T.aiVipPair(a,b));H.place(T,a,11,4);H.place(T,b,12,4);assert(T.aiPushScore(a,b)<0);
});
test("AI vs AI completes both levels with board/metrics invariants",()=>{
  const C=H.load(html);for(const levels of [["grade5","grade5"],["dan5","grade5"],["grade5","dan5"]])for(const seed of [114,115]){
    C.activate();const r=H.runSim(C,levels,seed,{check:25,cap:100000});assert.equal(r.phase,"over");assert.deepEqual(r.viol,[]);console.log("SIM "+JSON.stringify({levels,seed,turns:r.turns,result:r.winType,teleports:r.snap.total.teleports,steps:r.steps}));
  }
});
test("VIP push uses existing king loss/neutral evaluation at both AI levels without combat bonuses",()=>{
  for(const owner of [0,1]){
    const s=board(T),a=piece(T,owner,"ally"),b=piece(T,1-owner,"ally");s.current=owner;
    H.place(T,a,owner?3:11,4);H.place(T,b,owner?2:12,4);b.revealed=true;s.turnCount=200;
    assert.equal(T.aiPushScore(a,b),0);assert.equal(T.aiBattlePairScore(owner,a,b),0);assert.equal(T.aiBattleEV(owner,a,b),0);
    a.cap={...piece(T,owner,"minion")};a.hp=a.maxHp;assert.equal(T.aiBattlePairScore(owner,a,b),0);
    assert.equal(T.aiEvalBattles(owner),null);assert.equal(T.aiEvalBattlesStrong(owner),null);
    b.type="king";const loss=-T.aiUnitValue(b,owner);
    assert.equal(T.aiPushScore(a,b),loss);assert.equal(T.aiBattlePairScore(owner,a,b),loss);assert.equal(T.aiBattleEV(owner,a,b),loss);
    assert.equal(T.aiEvalBattles(owner),null);assert.equal(T.aiEvalBattlesStrong(owner),null);
  }
});
console.log("smoke_issue114: "+pass+" groups passed");
