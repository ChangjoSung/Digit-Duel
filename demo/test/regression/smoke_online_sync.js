/* #104 온라인 양측 말·위치 불일치 — 자연 흐름 2클라이언트 락스텝 회귀 (헤드리스)
   사용: node demo/test/regression/smoke_online_sync.js [demo/index.html] [--seeds N] [--steps M] [--verbose]
        git show <sha>:demo/index.html | node demo/test/regression/smoke_online_sync.js --stdin   (음성 대조 — 파일 작성 0)
   #93 픽스처(양측 "무작위 배치" 버튼 + 1칸 전진 1회)의 사각지대를 메운다:
     A. 서로 다른 로스터 6종을 실제 토글 순서로 고르고, 14개를 서로 다른 비공개 배치로 수동 배치(selTray→onCell) →
        실제 matched→hello→hello2 순서로 시작 → 28개 말 정규 스냅샷(id·owner·rosterId·name·hp·기술·좌표)이 양 클라이언트 동일,
        각자가 제출한 배치가 정규 좌표(P2 는 14−r 행 미러·열 유지)로 정확히 반영, 뷰어 DOM 이 자기 S 와 일치
     B. 중앙(7행)·숲 경계를 양방향으로 실제 클릭 경로로 넘는 대본 — 매 행동 뒤 S·DOM 대조
     C. 시드 무작위 완주 퍼즈(이동·전투·강제 전투·탐색·턴 교대·BT 2칸) — 매 행동 뒤 28개 말 정규 스냅샷·수신 큐·행위자 합의 대조
   파일을 쓰지 않는다 (Saturn --read-only 재실행 가능). */
"use strict";
const fs=require("fs"), path=require("path");
const DEFAULT_HTML=path.join(__dirname,"..","..","index.html");
const args=process.argv.slice(2);
const optNum=(k,d)=>{ const i=args.indexOf(k); return i>=0&&args[i+1]?Number(args[i+1]):d; };
const SEEDS=optNum("--seeds",12), STEPS=optNum("--steps",700), VERBOSE=args.includes("--verbose");
let htmlPath=args.find(a=>!a.startsWith("--")&&!/^\d+$/.test(a))||DEFAULT_HTML;
if(args.includes("--stdin")){ const src=fs.readFileSync(0,"utf8"); const orig=fs.readFileSync; const target=path.resolve(htmlPath);
  fs.readFileSync=function(p,enc){ if(typeof p==="string"&&path.resolve(p)===target) return src; return orig.apply(fs,arguments); }; }
const H=require("../shared/harness");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const ROWS=13, COLS=7, FILE_HREF="file:///C:/Digit-Duel/demo/index.html", CODE="5F65J3YKGD";

/* ── 두 로드를 번갈아 구동: 제품이 bare 식별자로 부르는 window 진입점(startMode·netConnect …)은 전역이므로 조작 직전 activate() ── */
function load(){ const T=H.load(htmlPath,{href:FILE_HREF,storage:H.mkStorage({tutorialSeen:"1"})});
  /* 브라우저처럼: overlayBox.innerHTML 교체는 그 안의 옛 #obBtns 버튼을 없앤다 (하네스 스텁은 id 캐시라 누적됨 — 동기화 모달 래퍼의 버튼 인덱스가 어긋난다) */
  const box=T.byId("overlayBox"), ob=T.byId("obBtns");
  Object.defineProperty(box,"innerHTML",{configurable:true,get(){return this._html;},set(v){this._html=v; this.children.length=0; ob.children.length=0;}});
  return T; }
const act=(T,fn)=>{ T.activate(); const r=fn(); T.drain(); return r; };

/* ── 자연 배치: 로스터 토글 순서·비공개 배치가 서로 다른 두 클라이언트 ── */
const SETUPS=[
  {roster:["M-F2","M-W1","M-G3","M-L4","M-F5","M-W2"],
   pos:{minion:[[11,1],[11,2],[11,3],[11,4],[11,5],[11,6]],bomb:[[12,1],[12,7],[11,7]],ally:[[12,3],[12,5]],trap:[[13,1],[13,7]],king:[[13,4]]}},
  {roster:["M-L1","M-G2","M-W3","M-F4","M-L5","M-G1"],
   pos:{minion:[[11,7],[11,5],[11,3],[11,1],[12,6],[12,2]],bomb:[[11,2],[11,4],[11,6]],ally:[[13,3],[13,5]],trap:[[12,1],[12,7]],king:[[12,4]]}}];
function prepare(T,setup){
  T.byId("netCode").value=CODE;
  act(T,()=>global.netPrepare());
  for(const rid of setup.roster) act(T,()=>global.toggleRoster(rid));        // 실제 토글 순서 = 로스터 배열 순서
  const used={};
  for(const p of T.S.pieces.filter(x=>x.owner===0)){                          // 트레이 클릭 → 칸 클릭 (실제 경로)
    const k=used[p.type]=(used[p.type]||0); used[p.type]++;
    const [r,c]=setup.pos[p.type][k];
    act(T,()=>global.selTray(p.id)); act(T,()=>T.onCell(r,c));
  }
  const intended=T.S.pieces.filter(x=>x.owner===0).map(x=>({type:x.type,rosterId:x.rosterId,name:x.name,r:x.r,c:x.c}));
  act(T,()=>global.setupDone());                                              // 배치 캡처 → 매칭 큐 (stub 소켓 생성)
  return intended;
}
function pair(){
  const T1=load(), T2=load();
  const intended=[prepare(T1,SETUPS[0]),prepare(T2,SETUPS[1])];
  const ws=[T1.wsLog[T1.wsLog.length-1],T2.wsLog[T2.wsLog.length-1]]; ws.forEach(w=>{ w.readyState=1; });
  const R={T:[T1,T2],ws,sent:[0,0],intended};
  const deliver=(i,m)=>act(R.T[i],()=>ws[i].onmessage({data:JSON.stringify(m)}));
  deliver(0,{type:"matched",room:1,you:"p1"}); deliver(1,{type:"matched",room:1,you:"p2"});   // 서버 순서: p1 → p2
  relay(R);                                                                                  // hello → hello2
  return R;
}
function relay(R){ // 양쪽 새 송신을 상대에게 전달 — 서버는 내용 무해석 중계, 도착 순서 보존
  for(let k=0;k<50;k++){ let moved=0;
    for(const i of [0,1]){ const w=R.ws[i];
      while(R.sent[i]<w.sent.length){ const m=JSON.parse(w.sent[R.sent[i]++]); act(R.T[1-i],()=>R.ws[1-i].onmessage({data:JSON.stringify(m)})); moved++; } }
    if(!moved) break; }
  for(const T of R.T) act(T,()=>T.netPump());
}

/* ── 정규 스냅샷: 28개 말 전부 (뷰어 무관 필드만) ── */
function canon(T,withId){ return T.S.pieces.map((p,i)=>({i,id:withId?p.id:undefined,owner:p.owner,type:p.type,rosterId:p.rosterId,name:p.name,element:p.element,
  hp:p.hp,maxHp:p.maxHp,atk:p.atk,skills:p.skills,cds:p.cds,r:p.r,c:p.c,placed:p.placed,alive:p.alive,revealed:p.revealed,immobile:p.immobile,
  cap:p.cap?{el:p.cap.element,hp:p.cap.hp,skills:p.cap.skills}:null,burn:p.burn,weaken:p.weaken,shield:p.shield,shock:p.shock,movedEver:p.movedEver})); }
function gameCanon(T){ const S=T.S; return {phase:S.phase,current:S.current,turn:S.turnCount,mainUsed:S.mainUsed,battlesUsed:S.battlesUsed,
  sel:S.selected?(S.selected.tray?"tray":S.selected.id):null,forced:S.forcedTargets.slice(),tele:S.teleport?{stage:S.teleport.stage,piece:S.teleport.piece?S.teleport.piece.id:null}:null,
  moved:S.movedPiece?S.movedPiece.id:null,battle:S.battle?{att:S.battle.attP.id,def:S.battle.defP.id,round:S.battle.round,phase:S.battle.phase}:null,
  events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),balls:S.balls.slice(),inv:S.inv.map(a=>a.slice()),reserve:S.reserve.map(x=>x?x.element:null),
  traces:S.traces.map(t=>[...t].sort()),tempReveal:[...S.tempReveal].sort(),winner:S.winner,seq:T.NET.modalSeq,sync:T.NET.syncModal?T.NET.syncModal.seq:null,pieces:canon(T,true)}; }
function firstDiff(a,b,pathStr){ // 첫 불일치 경로
  if(typeof a!=="object"||typeof b!=="object"||a===null||b===null) return a===b?null:`${pathStr}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  const keys=new Set([...Object.keys(a),...Object.keys(b)]);
  for(const k of keys){ const d=firstDiff(a[k],b[k],pathStr+"."+k); if(d) return d; }
  return null;
}
/* ── 뷰어 DOM ↔ 자기 S 대조: 칸 dataset 은 논리 좌표, 칩은 그 칸의 말·가시성·공개 여부와 일치, 순서는 (반사 여부에 따른) 순열 ── */
function domCheck(T){
  const S=T.S, me=T.NET.me, viewer=S.phase==="over"?2:me, flip=T.NET.mode&&me===1;
  if(S.battle||!T.byId("overlay")._cls.has("hidden")) return null; // 전투·모달 오버레이가 열린 동안 보드는 그 뒤에 있고 닫힐 때(afterBattle·버튼 콜백) 다시 그린다 — 공개 표시는 닫힌 뒤 대조
  const cells=T.byId("board").children; if(cells.length!==ROWS*COLS) return "cells "+cells.length;
  if(String(T.byId("board").dataset.flip)!==(flip?"1":"0")) return "flip attr";
  for(let i=0;i<cells.length;i++){ const x=cells[i], r=+x.dataset.r, c=+x.dataset.c;
    const exp=((flip?ROWS+1-r:r)-1)*COLS+(c-1); if(exp!==i) return `order (${r},${c}) at ${i}`;
    const p=T.at(r,c), chip=x.children.find(k=>/\bpc\b/.test(k.className))||null;
    const vis=p&&(viewer===2||T.visibleTo(viewer,p));
    if(!!chip!==!!vis) return `chip ${chip?"present":"missing"} at (${r},${c}) piece=${p?p.id:"-"}`;
    if(chip){ const known=viewer===2||p.owner===viewer||p.revealed;
      if(!new RegExp("\\bp"+p.owner+"\\b").test(chip.className)) return `owner class (${r},${c})`;
      if((p.owner===viewer)!==/\bown\b/.test(chip.className)) return `own class (${r},${c})`;
      if(known===/\bhiddenId\b/.test(chip.className)) return `known class (${r},${c})`;
      if(!known&&chip.innerHTML!=="?"&&!/guess/.test(chip.className)) return `hidden body (${r},${c})`; } }
  return null;
}
const overlayOpen=T=>!T.byId("overlay")._cls.has("hidden");
const curBtns=(T,n)=>T.byId("obBtns").children.slice(-n);
const pickerOpen=T=>overlayOpen(T)&&/정체 추측/.test(T.byId("overlayBox").innerHTML);
function ownBottom(T){ const cs=T.byId("board").children.slice(70); const chips=cs.flatMap(x=>x.children.filter(k=>/\bpc\b/.test(k.className))); return chips.length===14&&chips.every(k=>/\bown\b/.test(k.className)); }

/* ── 락스텝 대조 (매 행동 뒤): 정규 S 동일 · 큐 비었음 · 행위자 합의 ── */
function agree(R,tag){
  const [A,B]=R.T; const d=firstDiff(gameCanon(A),gameCanon(B),"S");
  const q=A.NET.queue.length+B.NET.queue.length;
  const actorA=act(A,()=>A.netActor()), actorB=act(B,()=>B.netActor());
  const dom=[domCheck(A),domCheck(B)];
  const bad=d||q?`${tag}: ${d||""}${q?` queue A=${A.NET.queue.length} B=${B.NET.queue.length}`:""}`:(actorA!==actorB?`${tag}: actor A=${actorA} B=${actorB}`:null);
  return {bad,dom:dom[0]||dom[1]?`${tag}: DOM A=${dom[0]} B=${dom[1]}`:null};
}

/* ===== A. 자연 배치 → 시작 직후 ===== */
{
  const R=pair(); const [A,B]=R.T;
  ok(A.NET.mode&&B.NET.mode&&A.NET.me===0&&B.NET.me===1&&A.S.phase==="play"&&B.S.phase==="play","A1 실제 matched→hello→hello2 로 양측 대전 시작 (A=P1, B=P2)");
  ok(JSON.stringify(canon(A,false))===JSON.stringify(canon(B,false)),"A2 28개 말 정규 스냅샷(owner·type·rosterId·name·hp·기술·좌표) 양 클라이언트 동일");
  ok(A.S.pieces.every((p,i)=>p.id===B.S.pieces[i].id),"A3 말 id 까지 동일 (같은 newGame 횟수)");
  const mapped=(m,i)=>i.map(x=>({type:x.type,rosterId:x.rosterId,name:x.name,r:m===1?ROWS+1-x.r:x.r,c:x.c}));
  for(const m of [0,1]){ const T=R.T[m];
    for(const [who,X] of [["자기",T],["상대",R.T[1-m]]]){
      const got=X.S.pieces.filter(x=>x.owner===m).map(x=>({type:x.type,rosterId:x.rosterId,name:x.name,r:x.r,c:x.c}));
      ok(JSON.stringify(got)===JSON.stringify(mapped(m,R.intended[m])),`A4 P${m+1} 가 제출한 배치(로스터 순서·이름·좌표)가 ${who} 클라이언트 정규 좌표에 정확히 반영 (P2 는 14−r·열 유지)`); } }
  ok(A.S.roster[0].join()===SETUPS[0].roster.join()&&A.S.roster[1].join()===SETUPS[1].roster.join()&&B.S.roster[1].join()===SETUPS[1].roster.join(),"A5 로스터 배열이 양측 모두 제출 순서 그대로");
  const ag=agree(R,"A6"); ok(!ag.bad,"A6 시작 직후 락스텝 대조 (S·큐·행위자) "+(ag.bad||"")); ok(!ag.dom,"A7 양측 뷰어 DOM 이 자기 S 와 일치 "+(ag.dom||""));
  ok(ownBottom(B)&&ownBottom(A),"A8 양측 모두 화면 아래 3행에 자기 말 14개");
  ok(B.S.pieces.filter(x=>x.owner===1).every(x=>x.r>=1&&x.r<=3),"A9 P2 말은 논리 1~3행");
}

/* ===== B. 중앙·숲 경계 양방향 실제 클릭 대본 ===== */
function actor(R){ const a=act(R.T[0],()=>R.T[0].netActor()); return R.T[a]; }
function step(R,tag,fn){ const X=actor(R); act(X,()=>fn(X)); relay(R); const ag=agree(R,tag); if(ag.bad) fails.push(ag.bad); if(ag.dom) fails.push(ag.dom); return !ag.bad&&!ag.dom; }
function walk(R,tag,pieceSel,path){ // 말 하나를 경로대로 한 턴에 한 칸씩 (상대 턴은 주 행동 생략+턴 종료)
  let all=true;
  for(const [r,c] of path){
    while(actor(R).NET.me!==pieceSel.owner){ all=step(R,tag+" skip",X=>{ X.netAction({t:"skipMain"}); }) && step(R,tag+" end",X=>{ X.netAction({t:"endTurn"}); }) && all; }
    const X=actor(R); const p=X.S.pieces.find(x=>x.owner===pieceSel.owner&&x.type==="minion"&&x.rosterId===pieceSel.rosterId);
    if(!p||!p.alive){ fails.push(tag+" piece lost"); return false; }
    all=step(R,`${tag} sel(${p.r},${p.c})`,X=>{ X.onCell(p.r,p.c); })&&all;
    const before=[p.r,p.c];
    all=step(R,`${tag} mv→(${r},${c})`,X=>{ X.onCell(r,c); })&&all;
    const now=X.S.pieces.find(x=>x.rosterId===pieceSel.rosterId&&x.owner===pieceSel.owner);
    if(now.r===before[0]&&now.c===before[1]&&!X.S.battle&&!X.S.forcedTargets.length){ fails.push(`${tag} move (${before})→(${r},${c}) not applied`); all=false; }
    if(X.S.battle||X.S.forcedTargets.length) return all; // 전투 진입 시 대본 종료 (퍼즈가 이어서 검증)
    all=step(R,tag+" end",X=>{ X.netAction({t:"endTurn"}); })&&all;
  }
  return all;
}
{
  const R=pair(); const n0=fails.length;
  // P1 의 (11,4) 하수인이 숲(10·9)→중앙(8·7·6)→상대 숲(5)까지, P2 의 (3,3) 하수인이 4·5→6·7·8→9 까지 번갈아 건넌다
  const w1=walk(R,"B-P1↑",{owner:0,rosterId:"M-L4"},[[10,4],[9,4],[8,4],[7,4],[6,4],[5,4]]);
  const w2=walk(R,"B-P2↓",{owner:1,rosterId:"M-W3"},[[4,3],[5,3],[6,3],[7,3],[8,3],[9,3]]);
  ok(w1&&w2&&fails.length===n0,"B1 양방향 중앙·숲 경계 횡단 — 매 클릭 뒤 양측 S·DOM 일치 "+(fails.slice(n0).join(" | ")));
  const [A,B]=R.T; const p1=A.S.pieces.find(x=>x.rosterId==="M-L4"), p2=B.S.pieces.find(x=>x.rosterId==="M-W3");
  ok(p1&&p2&&(p1.r<=5||A.S.battle||A.S.forcedTargets.length)&&(p2.r>=9||B.S.battle||B.S.forcedTargets.length),"B2 두 말이 실제로 중앙을 넘어 상대 숲 경계까지 도달(또는 접촉 전투 진입)");
}

/* ===== C. 시드 무작위 완주 퍼즈 — 실제 클릭·버튼 경로만 ===== */
function lcg(seed){ let s=seed>>>0; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
function fuzz(seed){
  const rnd=lcg(seed), pick=a=>a[Math.floor(rnd()*a.length)];
  const R=pair(); let last=null, steps=0, crossed=0, battles=0, forced=0, searches=0, bt=0;
  let noise=0;
  for(;steps<STEPS;steps++){
    const X=actor(R); const S=X.S, me=X.NET.me; if(!X.NET.mode||S.phase==="over") break;
    let tag;
    if(rnd()<0.5){ // 자연 잡음: 상대(비행위자)가 자기 화면에서 아무 칸이나 클릭 (상대 턴 토스트·로컬 메모 피커 경로) — 동기화에 영향이 없어야 한다
      const Y=R.T[1-me]; const r=1+Math.floor(rnd()*ROWS), c=1+Math.floor(rnd()*COLS); noise++;
      if(!overlayOpen(Y)) act(Y,()=>{ Y.onCell(r,c); if(pickerOpen(Y)) curBtns(Y,2)[1].onclick(); }); // 브라우저처럼 오버레이가 열려 있으면 보드를 클릭할 수 없다
      relay(R); const a0=agree(R,`seed ${seed} step ${steps} noise P${2-me} click(${r},${c})`); if(a0.bad||a0.dom){ last=a0.bad||a0.dom; break; } }
    if(rnd()<0.1&&!S.battle&&!overlayOpen(X)){ // 행위자 오클릭: 아무 칸 (빈 칸·자기 말·숨은 상대 말 포함)
      const r=1+Math.floor(rnd()*ROWS), c=1+Math.floor(rnd()*COLS); noise++;
      act(X,()=>{ X.onCell(r,c); if(pickerOpen(X)) curBtns(X,2)[1].onclick(); });
      relay(R); const a0=agree(R,`seed ${seed} step ${steps} misclick P${me+1} (${r},${c})`); if(a0.bad||a0.dom){ last=a0.bad||a0.dom; break; }
      if(X.S.battle||X.S.forcedTargets.length||X.NET.syncModal) continue; }
    if(X.NET.syncModal&&overlayOpen(X)){ // 동기화 모달(출전 공개·포획·교체·도망 스왑 …) — 소유자가 버튼 클릭
      const own=X.NET.syncModal.owner, O=R.T[own]; const btns=curBtns(O,O.NET.syncModal.fns.length).filter(b=>!b.disabled);
      if(!btns.length){ last=`step ${steps}: sync modal without enabled buttons`; break; }
      const b=pick(btns); tag=`modal(owner P${own+1}) "${b.textContent}"`;
      act(O,()=>b.onclick()); }
    else if(S.battle){ battles++; const B=S.battle;
      const sd=(function(){ const b=X.S.battle; const first=b.round%2===1; return b.phase===0?(first?"A":"D"):(first?"D":"A"); })();
      const f=sd==="A"?B.fa:B.fd; const slots=f.skills?[0,1,2,3].filter(k=>f.cds[k]===0):[];
      const choice=rnd()<0.15&&X.S.balls[me]>0&&B.defP.owner!==me?"ball":rnd()<0.1?"flee":slots.length?pick(slots):"basic";
      tag=`battle ${choice}`;
      act(X,()=>{ if(choice==="ball") global.__throwBall(); else if(choice==="flee") global.__flee(); else global.__act(choice); }); }
    else if(S.forcedTargets.length){ forced++; const t=pick(S.forcedTargets.map(id=>X.alivePieces().find(p=>p.id===id)).filter(Boolean)); tag=`forced→(${t.r},${t.c})`; act(X,()=>X.onCell(t.r,t.c)); }
    else if(S.mainUsed||rnd()<0.08){ tag="endTurn"; act(X,()=>X.netAction({t:"endTurn"})); }
    else {
      const mine=X.alivePieces().filter(p=>p.owner===me&&p.immobile===0&&p.type!=="trap");
      const cands=[];
      for(const p of mine){ for(let r=1;r<=ROWS;r++) for(let c=1;c<=COLS;c++) if(X.canMoveTo(p,r,c)) cands.push({p,r,c,kind:"move",fwd:me===0?p.r-r:r-p.r});
        for(const e of X.alivePieces()) if(e.owner!==me&&Math.abs(e.r-p.r)+Math.abs(e.c-p.c)===1&&X.visibleTo(me,e)&&X.canBattle(p,e)) cands.push({p,r:e.r,c:e.c,kind:"attack"}); }
      const sel=X.S.selected&&!X.S.selected.tray?X.S.selected:null;
      const ev=sel?S.events.find(e=>e.r===sel.r&&e.c===sel.c&&!e.consumed&&S.traces[me].has(e.r+"_"+e.c)):null;
      if(ev&&X.canSearchPiece(sel)&&rnd()<0.8){ searches++; tag="search"; act(X,()=>X.netAction({t:"search"})); }
      else if(!cands.length){ tag="skipMain"; act(X,()=>X.netAction({t:"skipMain"})); }
      else { const atk=cands.filter(k=>k.kind==="attack"); const fw=cands.filter(k=>k.kind==="move"&&k.fwd>0);
        const k=atk.length&&rnd()<0.6?pick(atk):fw.length&&rnd()<0.7?pick(fw):pick(cands);
        if(k.kind==="move"&&((me===0&&k.p.r>=8&&k.r<=7)||(me===1&&k.p.r<=6&&k.r>=7))) crossed++;
        if(Math.abs(k.p.r-k.r)+Math.abs(k.p.c-k.c)===2) bt++;
        tag=`${k.kind} ${k.p.type}#${k.p.id}(${k.p.r},${k.p.c})→(${k.r},${k.c})`;
        act(X,()=>X.onCell(k.p.r,k.p.c)); relay(R); const a1=agree(R,`seed ${seed} step ${steps} select`); if(a1.bad||a1.dom){ last=a1.bad||a1.dom; break; }
        act(X,()=>X.onCell(k.r,k.c)); }
    }
    relay(R);
    const ag=agree(R,`seed ${seed} step ${steps} P${me+1} ${tag}`);
    if(ag.bad||ag.dom){ last=ag.bad||ag.dom; break; }
  }
  const [A,B]=R.T;
  return {seed,steps,turn:A.S.turnCount,phase:A.S.phase,winner:A.S.winner,crossed,battles,forced,searches,bt,noise,last};
}
{
  const results=[]; for(let s=1;s<=SEEDS;s++) results.push(fuzz(1000+s));
  for(const r of results){ if(VERBOSE||r.last) console.log(`seed ${r.seed}: steps=${r.steps} turn=${r.turn} phase=${r.phase} winner=${r.winner} crossed=${r.crossed} battles=${r.battles} forced=${r.forced} searches=${r.searches} bt2=${r.bt} noise=${r.noise}${r.last?"\n   ✗ "+r.last:""}`); }
  const broken=results.filter(r=>r.last);
  ok(!broken.length,`C1 ${SEEDS}개 시드 무작위 완주 — 매 행동 뒤 양측 정규 S·수신 큐·행위자·DOM 일치 (불일치 ${broken.length}건${broken.length?": "+broken[0].last:""})`);
  ok(results.reduce((a,r)=>a+r.crossed,0)>=SEEDS*4&&results.reduce((a,r)=>a+r.battles,0)>0&&results.reduce((a,r)=>a+r.forced,0)>0,"C2 퍼즈가 중앙 횡단·전투·강제 전투를 실제로 밟았다");
  ok(results.some(r=>r.phase==="over")||results.some(r=>r.turn>=20),"C3 퍼즈가 게임 종료 또는 20턴 이상까지 진행");
  ok(results.some(r=>r.bt>0),"C4 버닝 타임 2칸 이동(숨은 말 충돌 경로)까지 도달한 시드가 있다");
}

/* ===== D. 결정적 재현 — 중앙을 넘어 상대 숲에 숨은 말 위로 BT 2칸 이동 (fail-first) =====
   P1 하수인(M-G3)이 11→5행으로 중앙을 넘어 P2 쪽 숲 (5,3) 에 숨는다(P2 말과 비인접 → P2 화면에는 안 보임). 65턴(BT) 뒤 P2 가 (3,3) 하수인을 (5,3) 으로 2칸 이동 클릭.
   행위자(P2) 클라이언트: 목적지의 숨은 말과 충돌 → (4,3) 정지·일시 공개·강제 전투. 상대(P1) 클라이언트가 같은 {t:"cell",5,3} 을 재생할 때도 같은 결과여야 한다. */
{
  const R=pair(); const [A,B]=R.T; const n0=fails.length;
  const w=walk(R,"D-P1↑",{owner:0,rosterId:"M-G3"},[[10,3],[9,3],[8,3],[7,3],[6,3],[5,3]]);
  while(A.S.turnCount<64&&A.S.phase==="play"&&!A.S.battle){ step(R,"D skip",X=>{ X.netAction({t:"skipMain"}); }); step(R,"D end",X=>{ X.netAction({t:"endTurn"}); }); }
  while(actor(R).NET.me!==1&&A.S.phase==="play"){ step(R,"D skip",X=>{ X.netAction({t:"skipMain"}); }); step(R,"D end",X=>{ X.netAction({t:"endTurn"}); }); }
  const hid=A.at(5,3), mover=B.at(3,3);
  const pre=w&&fails.length===n0&&hid&&hid.owner===0&&mover&&mover.owner===1&&mover.type==="minion"&&!B.visibleTo(1,hid)&&A.visibleTo(0,hid)&&!A.at(4,3)&&A.S.turnCount>=64&&act(B,()=>B.netActor())===1;
  ok(pre,`D0 전제: BT 진입(턴 ${A.S.turnCount+1}) · P1 말이 (5,3) 에 숨음(P2 시점 비가시·P1 시점 가시) · P2 하수인 (3,3) · (4,3) 빈 칸 · P2 턴`);
  act(B,()=>B.onCell(3,3)); relay(R);
  ok(B.canMoveTo(mover,5,3),"D1 행위자(P2) 클라이언트에서 (3,3)→(5,3) 2칸 이동은 합법 (목적지의 숨은 말은 canMoveTo 가 막지 않는다)");
  act(B,()=>B.onCell(5,3)); relay(R);
  const mB=B.S.pieces.find(x=>x.id===mover.id), mA=A.S.pieces.find(x=>x.id===mover.id);
  ok(mB.r===4&&mB.c===3&&B.S.tempReveal.has(hid.id)&&B.S.mainUsed,"D2 행위자(P2) 클라이언트: 경유 칸 (4,3) 정지 · 충돌 일시 공개 · 주 행동 소모");
  ok(mA.r===mB.r&&mA.c===mB.c&&A.S.mainUsed===B.S.mainUsed&&A.S.tempReveal.has(hid.id)===B.S.tempReveal.has(hid.id)&&!!A.S.battle===!!B.S.battle,
    `D3 상대(P1) 클라이언트가 같은 클릭을 재생한 결과가 동일 — P1: 말 (${mA.r},${mA.c}) mainUsed=${A.S.mainUsed} reveal=${A.S.tempReveal.has(hid.id)} battle=${!!A.S.battle} / P2: 말 (${mB.r},${mB.c}) mainUsed=${B.S.mainUsed} reveal=${B.S.tempReveal.has(hid.id)} battle=${!!B.S.battle}`);
  const ag=agree(R,"D4"); ok(!ag.bad,"D4 28개 말 정규 스냅샷·큐·행위자 합의 "+(ag.bad||""));
}

console.log(`\n=== smoke_online_sync (#104): pass ${pass} / fail ${fail} ===`);
if(fail){ console.log(fails.map(f=>" - "+f).join("\n")); process.exit(1); }
