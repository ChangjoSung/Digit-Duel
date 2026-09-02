/* Digit Dual 헤드리스 하네스 — demo/index.html의 <script>를 DOM 스텁 위에서 eval하고 내부 심볼을 노출한다.
   사용: const H=require("./harness"); const T=H.load(); (T.S, T.BAL, T.newGame, ... ) */
"use strict";
const fs=require("fs"), path=require("path");

function mkEl(){return {_html:"",textContent:"",style:{},className:"",dataset:{},value:"",disabled:false,
  scrollTop:0,scrollHeight:0,offsetWidth:0,children:[],onclick:null,parentNode:null,
  get innerHTML(){return this._html;}, set innerHTML(v){this._html=v; this.children.length=0;}, // 실제 DOM처럼 innerHTML 대입 시 자식 제거 (다경기 실행 시 누수 방지)
  get firstChild(){return this.children[0]||null;},
  classList:{add(){},remove(){},contains(){return false;}},
  appendChild(c){c.parentNode=this;this.children.push(c);},
  removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);},focus(){}};}

function load(htmlPath){
  htmlPath=htmlPath||path.join(__dirname,"..","index.html");
  const html=fs.readFileSync(htmlPath,"utf8");
  const m=html.match(/<script>([\s\S]*)<\/script>/);
  if(!m) throw new Error("script block not found");
  const els={};
  global.document={getElementById:id=>els[id]||(els[id]=mkEl()),createElement:()=>mkEl()};
  global.window=global;
  global.location={reload(){}};
  // 가짜 타이머
  const TQ=[];
  global.setTimeout=fn=>{TQ.push(fn);return 0;};
  const drain=(cap)=>{cap=cap||5000000; let n=0; while(TQ.length&&n<cap){TQ.shift()();n++;} return n;};
  const code=m[1]+`
;global.__T={get S(){return S;},set S(v){S=v;},BAL,ROSTER,SKILLS,EVENT_POOL,ELEMS,BEATS,PLAYER_METRIC_KEYS,AI_LEVEL_KO,
  newGame,genEvents,doSearch,canSearchPiece,applyRoster,aiAutoPlace,startTurn,endTurn,doMove,canMoveTo,canBattle,
  initBattle,startRounds,doTeleportSwap,teleportAvailable,checkWipe,alivePieces,at,fleeSwap,visibleTo,inForest,
  finishByCapture,tryCapture,afterBattle,vipChoice,mkPiece,adjEnemies,archOf,isBurning,beginPlay,
  aiMain,aiMainStrong,aiStep,aiVisible,aiThreatOf,aiStaticRisk,aiSeenMoved,aiLevelOf,aiBattleEV,aiEvalPos,aiEvalBattles,aiEvalBattlesStrong,
  aiBattleAction,aiBattleActionStrong,aiProf,observeMove,met,metricsSnapshot,setSeed,rand,gameOver,doPush,judge,execSlot,nextPhase,
  renderSide,renderMetrics,render,startMode,html:${JSON.stringify(html)}};`;
  eval(code);
  const T=global.__T;
  T.drain=drain; T.TQ=TQ; T.els=els;
  T.BAL.aiDelay=0; T.BAL.simDelay=0;
  return T;
}

/* 배치 완료된 플레이 상태 */
function freshPlay(T,mode,aiLevel){
  T.newGame(mode||"pve",{aiLevel:aiLevel});
  T.aiAutoPlace(0); T.aiAutoPlace(1);
  T.S.phase="play"; T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0;
  T.S.movedPiece=null; T.S.contactSet=[]; T.S.forcedTargets=[]; T.S.forcedQueue=[];
  T.TQ.length=0;
  return T.S;
}
function clearCell(T,r,c){const x=T.at(r,c); if(x) x.placed=false;}
function place(T,p,r,c){clearCell(T,r,c); p.r=r;p.c=c;p.placed=true;p.alive=true;}
function mine(T,o,type){return T.S.pieces.filter(x=>x.owner===o&&x.type===type&&x.alive&&x.placed);}
function clearBoard(T){for(const x of T.S.pieces) x.placed=false;}

/* 불변식 검사 — 위반 목록 반환 */
function invariants(T){
  const S=T.S, out=[];
  const seen={};
  for(const p of T.alivePieces()){
    const k=p.r+"_"+p.c;
    if(seen[k]) out.push("겹침 "+k); seen[k]=1;
    if(p.r<1||p.r>13||p.c<1||p.c>7) out.push("보드 밖 "+p.id);
    if((p.type==="minion"||p.type==="ally"||p.type==="king")&&(p.hp<1||p.hp>p.maxHp)) out.push("HP 범위 "+p.id+" "+p.hp+"/"+p.maxHp);
    if(p.cap&&(p.cap.hp<1||p.cap.hp>p.cap.maxHp)) out.push("cap HP 범위 "+p.id);
  }
  if(S.battlesUsed>2) out.push("battlesUsed>2");
  for(const p of [0,1]){
    if(S.teleUsed[p]>T.BAL.teleMax) out.push("teleUsed>max p"+p);
    if(S.balls[p]<0||S.balls[p]>T.BAL.ballMax) out.push("balls 범위 p"+p+" "+S.balls[p]);
    if(S.inv[p].length>T.BAL.invMax) out.push("inv>max p"+p);
    if(S.reserve[p]&&(S.reserve[p].hp<1||S.reserve[p].hp>S.reserve[p].maxHp)) out.push("reserve HP p"+p);
  }
  for(const k of T.PLAYER_METRIC_KEYS){
    const a=S.metrics.byPlayer[0][k]||0, b=S.metrics.byPlayer[1][k]||0;
    if(a+b!==(S.metrics[k]||0)) out.push("지표 이중집계 불일치 "+k+" "+a+"+"+b+"!="+S.metrics[k]);
  }
  return out;
}

/* sim 완주 — 매 타이머 콜백 후 불변식 검사 (옵션) */
function runSim(T,levels,seed,opts){
  opts=opts||{};
  if(seed!==undefined) T.setSeed(seed);
  T.TQ.length=0;
  T.startMode("sim",{aiLevel:levels});
  let n=0, viol=[], think=[];
  while(T.TQ.length&&n<opts.cap||5000000){
    if(!T.TQ.length) break;
    T.TQ.shift()(); n++;
    if(opts.check&&(n%opts.check===0)){ const v=invariants(T); if(v.length){viol.push(...v.map(x=>"t"+T.S.turnCount+" "+x));} }
    if(T.S.aiLastThinkMs!==undefined){think.push(T.S.aiLastThinkMs); T.S.aiLastThinkMs=undefined;}
    if(n>=(opts.cap||5000000)) break;
  }
  const v=invariants(T); if(v.length) viol.push(...v);
  return {snap:T.metricsSnapshot(),winner:T.S.winner,phase:T.S.phase,turns:T.S.turnCount,winType:T.S.metrics.winType,steps:n,viol:[...new Set(viol)],
    thinkAvg:think.length?think.reduce((a,b)=>a+b,0)/think.length:0, thinkMax:think.length?Math.max(...think):0};
}

module.exports={load,freshPlay,clearCell,place,mine,clearBoard,invariants,runSim};
