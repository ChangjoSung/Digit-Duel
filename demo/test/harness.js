/* Digit Dual 헤드리스 하네스 — demo/index.html의 <script>를 DOM 스텁 위에서 eval하고 내부 심볼을 노출한다.
   사용: const H=require("./harness"); const T=H.load(); (T.S, T.BAL, T.newGame, ... ) */
"use strict";
const fs=require("fs"), path=require("path");

function mkEl(){const el={_html:"",textContent:"",style:{},className:"",dataset:{},value:"",disabled:false,
  scrollTop:0,scrollHeight:0,clientHeight:0,scrollWidth:0,clientWidth:0,offsetWidth:0,children:[],onclick:null,parentNode:null,isConnected:true,
  get innerHTML(){return this._html;}, set innerHTML(v){this._html=v; this.children.length=0;}, // 실제 DOM처럼 innerHTML 대입 시 자식 제거 (다경기 실행 시 누수 방지)
  get firstChild(){return this.children[0]||null;},
  _cls:new Set(), classList:null, // #26: 실제 클래스 추적 (hidden 토글 검증)
  _attrs:{}, setAttribute(k,v){this._attrs[k]=String(v);}, getAttribute(k){return k in this._attrs?this._attrs[k]:null;},
  removeAttribute(k){delete this._attrs[k];}, hasAttribute(k){return k in this._attrs;},
  _listeners:{}, addEventListener(t,fn){(this._listeners[t]=this._listeners[t]||[]).push(fn);},
  dispatch(t,ev){for(const fn of (this._listeners[t]||[])) fn(ev);}, // 테스트용: 등록된 리스너 직접 호출
  contains(n){for(let x=n;x;x=x.parentNode) if(x===this) return true; return false;},
  appendChild(c){c.parentNode=this;this.children.push(c);},
  removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);},
  focusOpts:undefined,focusCount:0,
  /* #42 REVISE: focus(opt) 인자를 기록해 preventScroll 계약을 검증하고, opt 없이 부른 포커스는 실제 브라우저처럼
     "포커스 요소를 보이게 하려고 스크롤 조상을 끝까지 끌어내리는" 동작을 흉내 낸다 (tutBox가 맨 아래로 밀리던 회귀 재현). */
  focus(opt){if(this.disabled) return; this.focusOpts=opt||null; this.focusCount++;
    if(!(opt&&opt.preventScroll)){ for(let a=this.parentNode;a;a=a.parentNode) if(a.scrollHeight>a.clientHeight) a.scrollTop=a.scrollHeight-a.clientHeight; }
    global.document.activeElement=this;},
  blur(){if(global.document.activeElement===this) global.document.activeElement=global.document.body;}};
  el.classList={add(c){el._cls.add(c);},remove(c){el._cls.delete(c);},contains(c){return el._cls.has(c);}};
  return el;}

function load(htmlPath){
  htmlPath=htmlPath||path.join(__dirname,"..","index.html");
  const html=fs.readFileSync(htmlPath,"utf8");
  const m=html.match(/<script>([\s\S]*)<\/script>/);
  if(!m) throw new Error("script block not found");
  const els={};
  const body=mkEl();
  global.document={getElementById:id=>els[id]||(els[id]=mkEl()),createElement:()=>mkEl(),body,activeElement:body,
    contains(n){return !!n&&n.isConnected!==false;}}; // #26: 포커스 추적·속성 스텁
  global.window=global;
  global.location={reload(){}};
  // 가짜 타이머
  const TQ=[];
  global.setTimeout=fn=>{TQ.push(fn);return 0;};
  global.setInterval=()=>0; global.clearInterval=()=>{}; // #41 온라인 PVP 수신 펌프(setInterval) — 헤드리스에서는 무동작 (Node 이벤트 루프 유지로 프로세스가 안 끝나던 회귀 방지)
  const drain=(cap)=>{cap=cap||5000000; let n=0; while(TQ.length&&n<cap){TQ.shift()();n++;} return n;};
  const code=m[1]+`
;global.__T={get S(){return S;},set S(v){S=v;},BAL,ROSTER,SKILLS,EVENT_POOL,ELEMS,BEATS,PLAYER_METRIC_KEYS,AI_LEVEL_KO,
  newGame,genEvents,doSearch,canSearchPiece,applyRoster,aiAutoPlace,startTurn,endTurn,doMove,canMoveTo,canBattle,
  initBattle,startRounds,doTeleportSwap,teleportAvailable,checkWipe,alivePieces,at,fleeSwap,visibleTo,inForest,
  finishByCapture,tryCapture,afterBattle,vipChoice,mkPiece,adjEnemies,archOf,isBurning,beginPlay,
  aiMain,aiMainStrong,aiStep,aiVisible,aiThreatOf,aiStaticRisk,aiSeenMoved,aiLevelOf,aiBattleEV,aiEvalPos,aiEvalBattles,aiEvalBattlesStrong,
  aiBattleAction,aiBattleActionStrong,aiProf,observeMove,met,metricsSnapshot,setSeed,rand,gameOver,doPush,judge,execSlot,nextPhase,
  renderSide,renderMetrics,render,startMode,modal,close,onCell,humanViewer,idLabel,
  MEMO_OPTS,MEMO_UI,memoOpt,memoSet,memoModal, // #36 추측 메모 피커
  TUT,TUT_STEPS,TUT_HINTS,TUT_KEY,tutStore,tutSeen,tutOpen,tutClose,tutNext,tutPrev,tutSkip,tutGo,tutRender,tutKeydown,tutHint,tutHintClose,tutFocus,tutScrollTop, // #26 튜토리얼 (S와 분리) · #42 tutScrollTop = 새 단계 스크롤 최상단 복귀
  html:${JSON.stringify(html)}};`;
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
