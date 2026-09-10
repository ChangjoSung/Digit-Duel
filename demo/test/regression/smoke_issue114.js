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
/* #122 REVISE(2026-09-10 CJ QA 1): #114 상황 8(동료↔동료 = 밀기)이 폐지돼 이제 **전투**가 된다.
   여기서 고정하는 것: 밀기가 더는 일어나지 않고(위치 불변·pushes 0) 출전 선택 체인이 열리며,
   그 시점까지 난수를 쓰지 않고 정체도 아직 공개되지 않는다(공개는 양측 선택이 끝난 뒤). 회복 자세 해제는 종전대로 유지. */
test("VIP pair now battles: no push, proxy-choice chain opens, no random or reveal yet",()=>{
  const s=board(T),a=piece(T,0,"ally"),b=piece(T,1,"ally");H.place(T,a,7,4);H.place(T,b,6,4);
  a.cap={...piece(T,0,"minion")};b.cap={...piece(T,1,"minion")};a.healing=b.healing=true;
  const observation=()=>JSON.stringify([s.aiSeenMoved.map(x=>[...x]),s.traces.map(x=>[...x]),s.forcedQueue,a.movedEver,b.movedEver]);
  const obs=observation();T.setSeed(818);const expected=T.rand();T.setSeed(818);
  T.initBattle(a,b);assert.equal(T.rand(),expected);assert.deepEqual([pos(a),pos(b)],[[7,4],[6,4]]);
  assert(/출전 선택/.test(T.els.overlayBox.innerHTML));
  assert(!a.revealed&&!b.revealed&&!a.healing&&!b.healing);assert.equal(s.metrics.pushes,0);
  assert.equal(observation(),obs);T.close();s.battle=null;T.TQ.length=0;
});
/* #122 REVISE(2026-09-10 CJ QA 5): #114 상황 6(폭탄↔폭탄·폭탄↔함정 = 밀기)이 폐지돼 **그 자리에서 둘 다 제거**된다.
   밀기가 없으므로 "강제로 밀린 함정이 스스로 걸어간 것처럼 보이는" 관측 누출도 애초에 생기지 않는다(movedEver 불변).
   함정 발동이 아니라 폭탄 폭발이므로 trapTriggers·이동 불가(immobile)는 붙지 않는다. */
test("bomb to trap detonates on the spot and removes both",()=>{
  const s=board(T),a=piece(T,0,"bomb"),b=piece(T,1,"trap");H.place(T,a,7,4);H.place(T,b,6,4);
  const tt=s.metrics.trapTriggers;
  T.initBattle(a,b);assert(!a.alive&&!b.alive&&!b.movedEver);assert.equal(s.battlesUsed,1);
  assert.equal(s.metrics.trapTriggers,tt);assert.equal(s.metrics.bombContacts,1);assert(!a.immobile&&!b.immobile);
});
test("bomb to bomb detonates on the spot and removes both",()=>{
  const s=board(T),a=piece(T,0,"bomb"),b=piece(T,1,"bomb");H.place(T,a,7,4);H.place(T,b,6,4);
  T.initBattle(a,b);assert(!a.alive&&!b.alive);assert.equal(s.battlesUsed,1);assert.equal(s.metrics.pushes,0);
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
/* #122 REVISE(2026-09-10 CJ QA 1): 동료↔동료가 전투가 되면서 이 검사는 둘로 나뉜다.
   (a) "재배치할 안전한 자리가 없으면 밀기 결과를 유지한다"는 규칙 자체는 도망 성공 후 밀기로 살아 있으므로 pushResolve 를 직접 검사한다.
   (b) 강제 접촉을 한 번만 소비하는 책임은 이제 전투 경로가 맡는다 — initBattle 이 강제 대상을 비우고 출전 선택/공개로 이어진다. */
test("no safe pair keeps possible push; forced VIP contact is consumed once by the battle path",()=>{
  const s=board(T),a=piece(T,0,"ally"),b=piece(T,1,"ally");H.place(T,a,7,4);H.place(T,b,6,4);
  // A dense artificial board exhausts all relocation zones; only actor's push square is free.
  const others=[];let id=10000;for(let r=1;r<=13;r++)for(let c=1;c<=7;c++)if(![[7,4],[6,4],[8,4]].some(p=>p[0]===r&&p[1]===c))others.push({id:id++,owner:r<7?1:0,type:"trap",r,c,alive:true,placed:true,immobile:0});
  s.pieces=[a,b,...others];s.mainUsed=true;
  T.pushResolve(a,b);assert.deepEqual([pos(a),pos(b)],[[8,4],[6,4]]);assert.equal(s.metrics.relocations,0);assert.equal(s.phase,"play");
  H.place(T,a,7,4);s.pieces.push({id:20000,owner:0,type:"trap",r:8,c:4,alive:true,placed:true,immobile:0});
  T.pushResolve(a,b);assert.deepEqual([pos(a),pos(b)],[[7,4],[6,4]]);assert.equal(s.metrics.relocations,0);
  s.movedPiece=a;s.forcedTargets=[b.id];s.contactSet=[b.id];s.battlesUsed=0;
  T.initBattle(a,b);assert.equal(s.forcedTargets.length,0);assert(/출전/.test(T.els.overlayBox.innerHTML));
  assert.deepEqual([pos(a),pos(b)],[[7,4],[6,4]]);assert.equal(s.phase,"play");assert(!T.drainForcedQueue(false));
  T.close();s.battle=null;T.TQ.length=0;
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
/* #122 REVISE(2026-09-10 CJ QA 1·6): 동료↔동료·동료↔왕·왕↔왕이 전투가 되면서 AI 의 **밀기 평가 우회가 제거**됐다.
   여기서 고정하는 것: (a) aiPushScore 자체는 값이 바뀌지 않았다(도망 후 밀기용으로 남는다) (b) 전투 평가가 더는 그 값을
   그대로 돌려주지 않고 보통 전투 EV 를 낸다 (c) 왕이 걸린 방향성 — 적 왕을 치는 것은 크게 유리, 내 왕 **본체**로 치는 것은
   불리(경기 패배 위험 -400), 같은 상황도 포획 하수인 대리가 있으면 유리로 뒤집힌다 (d) 이제 AI 가 이 전투들을 실제로 후보에 올린다. */
test("VIP pairs are evaluated as real battles; king risk flips the sign; aiPushScore itself is unchanged",()=>{
  for(const owner of [0,1]){
    const s=board(T),a=piece(T,owner,"ally"),b=piece(T,1-owner,"ally");s.current=owner;
    H.place(T,a,owner?3:11,4);H.place(T,b,owner?2:12,4);b.revealed=true;s.turnCount=200;
    assert.equal(T.aiPushScore(a,b),0);                                   // (a) 밀기 평가 함수는 그대로
    const evAlly=T.aiBattleEV(owner,a,b);
    assert(Number.isFinite(evAlly)&&evAlly>0);                            // (b) 밀기 우회(0) 가 아니라 실제 EV
    assert.equal(T.aiBattlePairScore(owner,a,b)>0,true);
    assert(T.aiEvalBattles(owner)!==null&&T.aiEvalBattlesStrong(owner)!==null); // (d) 후보에 오른다
    b.type="king";
    assert.equal(T.aiPushScore(a,b),-T.aiUnitValue(b,owner));             // (a) 왕 밀기 손실 값도 그대로
    assert(T.aiBattleEV(owner,a,b)>evAlly);                               // (c) 적 왕을 치는 쪽이 더 매력적
    b.type="ally";
    const keep=a.type;a.type="king";a.cap=null;
    const evKingBody=T.aiBattleEV(owner,a,b);assert(evKingBody<0);        // (c) 내 왕 본체로 치면 불리
    a.cap={...piece(T,owner,"minion")};
    assert(T.aiBattleEV(owner,a,b)>evKingBody);                           // (c) 대리 출전이 있으면 뒤집힌다
    a.type=keep;a.cap=null;
  }
});
/* #122 REVISE(2026-09-10 CJ QA 6): 왕 vs 왕 불가침 폐지 — 능동 전투·강제 전투 양쪽에서 성립해야 한다 */
test("king vs king can battle and is forced-battle eligible",()=>{
  const s=board(T),a=piece(T,0,"king"),b=piece(T,1,"king");s.current=0;
  H.place(T,a,11,4);H.place(T,b,12,4);b.revealed=true;
  assert(T.canBattle(a,b));assert(T.forcedEligible(a,b));
  assert(Number.isFinite(T.aiBattleEV(0,a,b)));
});
console.log("smoke_issue114: "+pass+" groups passed");
