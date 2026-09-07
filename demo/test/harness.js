/* Digit Dual 헤드리스 하네스 — demo/index.html의 <script>를 DOM 스텁 위에서 eval하고 내부 심볼을 노출한다.
   사용: const H=require("./harness"); const T=H.load(); (T.S, T.BAL, T.newGame, ... ) */
"use strict";
const fs=require("fs"), path=require("path");

/* #54 REVISE(Saturn_3): 요소는 자기를 만든 문서(ownerDocument)를 들고 다닌다.
   포커스/블러가 전역 document를 건드리면, 나중 load()가 전역을 갈아끼운 뒤 앞선 T의 포커스가
   "가장 최근 로드"의 문서에 기록된다. doc를 인자로 받아 그 문서에만 쓴다. */
function mkEl(doc){const el={ownerDocument:doc||null,_html:"",textContent:"",style:{},className:"",dataset:{},value:"",disabled:false,
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
    const d=this.ownerDocument; if(d) d.activeElement=this;},
  blur(){const d=this.ownerDocument; if(d&&d.activeElement===this) d.activeElement=d.body;}};
  el.classList={add(c){el._cls.add(c);},remove(c){el._cls.delete(c);},contains(c){return el._cls.has(c);}};
  return el;}

const DEFAULT_HREF="file:///C:/Digit-Duel/demo/index.html"; // #54: 기본 실행 경로 = html 파일 직접 열기(file:)
/* #54: 실제 브라우저에 가까운 location 스텁 — netServerDefault()/netConnect()가 protocol·host를 읽는다.
   기본값은 html 파일을 직접 여는 실사용 경로(file:, host 빈 문자열)이고, 테스트는 load({href})로 http/https를 바꿔 끼운다. */
function mkLocation(href){
  const u=new URL(href||DEFAULT_HREF);
  return {href:u.href,protocol:u.protocol,host:u.host,hostname:u.hostname,port:u.port,pathname:u.pathname,
    search:u.search,hash:u.hash,origin:u.origin,
    reloadCount:0,reload(){this.reloadCount++;}, // #54: reload 스텁 유지 (결과 화면 "처음으로")
    assign(h){Object.assign(this,mkLocation(h));},replace(h){this.assign(h);},
    toString(){return this.href;}};
}
/* 현재 활성 로드(가장 최근 load())의 전역 미러를 바꿔 끼운다 — 테스트 편의용. 제품 코드는 로드별 렉시컬 바인딩을
   보므로(아래 load() 참조) 이 함수는 이미 만들어진 환경의 location을 갈아끼우지 않는다. T.setLocation()을 쓸 것. */
function setLocation(href){ global.location=mkLocation(href); if(global.window) global.window.location=global.location; return global.location; }

/* #54 REVISE: WebSocket 스텁은 load()마다 새 생성자 + 새 로그를 갖는다.
   (회귀: 모듈 전역 WS_LOG 하나를 공유하고 load()가 그것을 비워, 나중 load가 앞선 T.wsLog를 지워버렸다.) */
/* #63: 하위 프로토콜 인자(접속 코드 통로)까지 기록한다 — new WebSocket(url, [마커, 코드]) 계약 검증용.
   실제 브라우저처럼 배열·문자열 어느 쪽으로 넘겨도 받고, 넘기지 않으면 undefined 로 남긴다. */
function mkWebSocket(log){
  const F=function(url,protocols){
    /* 생성 실패 재현용 스위치 — 브라우저가 하위 프로토콜 토큰을 거부하면 그 예외 메시지에 코드가 들어 있다.
       제품 코드가 그 메시지를 화면에 싣지 않는지(#63) 검증하려면 실제로 던지는 생성자가 필요하다. */
    if(F.throwNext){ F.throwNext=false; throw new Error(F.throwMessage||"SyntaxError: invalid subprotocol"); }
    this.url=String(url); this.readyState=0; this.sent=[]; this.closed=false;
    this.protocols=protocols===undefined?undefined:(Array.isArray(protocols)?protocols.map(String):[String(protocols)]);
    this.protocol=""; // 서버가 고른 하위 프로토콜 (핸드셰이크 전에는 빈 문자열)
    this.onopen=this.onclose=this.onerror=this.onmessage=null;
    this.send=m=>{this.sent.push(m);}; this.close=()=>{this.readyState=3;this.closed=true;};
    log.push(this); };
  F.CONNECTING=0; F.OPEN=1; F.CLOSING=2; F.CLOSED=3; F.log=log;
  return F;
}

/* #54 REVISE: 기록형 인메모리 웹 스토리지 스텁.
   Storage는 setItem()뿐 아니라 obj.k="v" 직접 대입으로도 저장되므로, 저장 흔적 판정은 정규식이 아니라
   (1) 저장된 키 (2) 쓰기 기록 (3) 스텁에 새로 생긴 own 프로퍼티 세 가지를 함께 본다 — 표기법과 무관하다. */
function mkStorage(init){
  const st=Object.assign({},init||{}), writes=[];
  const s={st,writes,
    getItem(k){k=String(k);return Object.prototype.hasOwnProperty.call(st,k)?st[k]:null;},
    setItem(k,v){k=String(k);writes.push({op:"setItem",key:k,value:String(v)});st[k]=String(v);},
    removeItem(k){k=String(k);writes.push({op:"removeItem",key:k});delete st[k];},
    clear(){writes.push({op:"clear",key:null});for(const k of Object.keys(st)) delete st[k];},
    get length(){return Object.keys(st).length;},key(i){return Object.keys(st)[i]||null;}};
  const base=new Set(Object.keys(s));
  Object.defineProperty(s,"__base",{value:base,enumerable:false,configurable:true});
  // setItem 키 목록 별칭 (기존 테스트 호환) — 열거되지 않으므로 "새로 생긴 프로퍼티"로 잡히지 않는다
  Object.defineProperty(s,"log",{enumerable:false,configurable:true,
    get(){return writes.filter(w=>w.op==="setItem").map(w=>w.key);}});
  return s;
}
/* 스텁에 새로 생긴 own 프로퍼티 = localStorage.foo="1" 같은 직접 대입 저장 */
function storageExtras(s){ if(!s||!s.__base) return []; return Object.keys(s).filter(k=>!s.__base.has(k)); }
/* 저장소가 손댄 흔적 전부 — 현재 키·쓰기 기록·직접 대입 (표기법 무관) */
function storageTrace(s){
  if(!s||!s.st) return {keys:[],writes:[],extras:[],all:[]};
  const keys=Object.keys(s.st), writes=(s.writes||[]).map(w=>w.key).filter(Boolean), extras=storageExtras(s);
  return {keys,writes,extras,all:[...new Set(keys.concat(writes,extras))]};
}
/* 조작 전후 비교용 스냅샷 — 값까지 같아야 "무변화" */
function storageSnapshot(s){ return s&&s.st?JSON.stringify({st:s.st,extras:storageExtras(s)}):"none"; }
/* 접근 자체가 예외인 환경(시크릿 모드·정책 차단) — window.localStorage 접근도, 메서드 호출도 던진다 */
function throwingStorage(msg){
  msg=msg||"SecurityError: denied";
  const t=()=>{throw new Error(msg);};
  return {__throws:msg,getItem:t,setItem:t,removeItem:t,clear:t,key:t,get length(){return t();}};
}

/* 명시적으로 미리 설치한 테스트 스토리지 계약 — 이것을 설정한 경우에만 load()가 storage 옵션 없이도 물려받는다.
   (#54 REVISE: 옵션을 생략한 load가 "앞선 load가 남긴 전역"을 우연히 물려받던 비결정성 제거) */
let PREINSTALLED=null; // {value} 또는 null(미설정)
function setStorage(s){ PREINSTALLED={value:s===null?undefined:s}; defineStorage(global,s===null?undefined:s); return s; }
function resetStorage(){ PREINSTALLED=null; defineStorage(global,undefined); }
function defineStorage(obj,s){
  if(s&&s.__throws){ const msg=s.__throws; Object.defineProperty(obj,"localStorage",{configurable:true,enumerable:true,get(){throw new Error(msg);}}); }
  else Object.defineProperty(obj,"localStorage",{configurable:true,enumerable:true,writable:true,value:s});
}

/* 영구·외부 저장 API 토큰 스캔 — 파서가 아니라 "이름이 등장하는가"만 본다.
   대괄호 접근(localStorage["setItem"])·별칭(const ls=localStorage)·직접 대입(localStorage.k="v")이 모두
   localStorage라는 이름을 지나가므로, 구간 단위 "직접 금지"에는 파싱이 필요 없다. */
const PERSIST_API=[/\blocalStorage\b/,/\bsessionStorage\b/,/\bindexedDB\b/,/\bopenDatabase\b/,/\bcookie\b/,
  /\bcaches\b/,/navigator\s*\.\s*storage/,/\bXMLHttpRequest\b/,/\bfetch\s*\(/,/\bsendBeacon\b/,/\bBroadcastChannel\b/];
function persistApiHits(src){ return PERSIST_API.filter(re=>re.test(String(src))).map(re=>re.source); }

function load(htmlPath,opts){
  opts=opts||{};
  htmlPath=htmlPath||path.join(__dirname,"..","index.html");
  const html=opts.html!==undefined?String(opts.html):fs.readFileSync(htmlPath,"utf8"); // #96: opts.html = 파일을 쓰지 않고 메모리 HTML(예: git show 기준판)을 로드 — before/after 대조용
  const m=html.match(/<script>([\s\S]*)<\/script>/);
  if(!m) throw new Error("script block not found");
  const els={};
  const cookieWrites=[];
  // doc를 먼저 만들고 모든 요소를 mkEl(doc)로 생성한다 — 포커스는 이 로드의 문서에만 기록된다
  const doc={getElementById:id=>els[id]||(els[id]=mkEl(doc)),createElement:()=>mkEl(doc),body:null,activeElement:null,
    contains(n){return !!n&&n.isConnected!==false;}}; // #26: 포커스 추적·속성 스텁
  doc.body=mkEl(doc); doc.activeElement=doc.body;
  Object.defineProperty(doc,"cookie",{configurable:true,enumerable:true,
    get(){return "";},set(v){cookieWrites.push(String(v));}}); // 쿠키 저장도 런타임으로 잡는다
  global.document=doc;
  global.window=global;

  /* #54 REVISE: document·location·WebSocket·localStorage는 load()마다 고유 객체를 만들고 eval 스코프에 렉시컬로 묶는다.
     제품 코드가 보는 것은 전역이 아니라 자기 로드의 객체이므로, 나중 load()가 앞선 T의 관측을 흔들지 못한다.
     (window는 전역 그대로 두되 저장소·location·WebSocket 읽기만 얇은 프록시로 이 로드의 것을 돌려준다 — 최소 침습.) */
  const loc=mkLocation(opts.href);
  const wsLog=[];
  const WebSocketCtor=mkWebSocket(wsLog);
  const storage=resolveStorage(opts);
  const sessionStorage=opts.sessionStorage!==undefined?opts.sessionStorage:mkStorage();
  const indexedDB={opens:[],open(){this.opens.push(Array.prototype.slice.call(arguments));return {};}};
  /* window.localStorage 경로(tutStore)도 자기 로드의 저장소를 보도록 얇은 프록시로 감싼다.
     읽기 중 스토리지·location·WebSocket만 가로채고 나머지(window.__act 등 제품이 붙이는 심볼)는 전역 그대로 — 격리 최소 침습. */
  const OVERRIDE={location:loc,WebSocket:WebSocketCtor,sessionStorage,indexedDB,document:doc};
  const win=new Proxy(global,{
    get(t,p){ if(p==="localStorage"){ if(storage&&storage.__throws) throw new Error(storage.__throws); return storage; }
      if(Object.prototype.hasOwnProperty.call(OVERRIDE,p)) return OVERRIDE[p];
      if(p==="window"||p==="self"||p==="globalThis") return win;
      return t[p]; },
    set(t,p,v){ t[p]=v; return true; },
    has(t,p){ return p in t; }});

  // 전역 미러 — 테스트가 global.location / global.localStorage 로 "현재 로드"를 관찰하는 기존 방식 유지
  global.location=loc; global.WebSocket=WebSocketCtor;
  global.sessionStorage=sessionStorage; global.indexedDB=indexedDB;
  defineStorage(global,storage);

  // 가짜 타이머
  const TQ=[];
  global.setTimeout=fn=>{TQ.push(fn);return 0;};
  global.setInterval=()=>0; global.clearInterval=()=>{}; // #41 온라인 PVP 수신 펌프(setInterval) — 헤드리스에서는 무동작 (Node 이벤트 루프 유지로 프로세스가 안 끝나던 회귀 방지)
  const drain=(cap)=>{cap=cap||5000000; let n=0; while(TQ.length&&n<cap){TQ.shift()();n++;} return n;};
  const __ENV={document:doc,location:loc,WebSocket:WebSocketCtor,localStorage:storage,sessionStorage,indexedDB,window:win};
  /* 렉시컬 캡처 — 이 줄은 제품 코드 1행과 같은 줄에 이어 붙지 않도록 개행 없이 앞에 둔다 (에러 행 번호 보존) */
  const code=`const {document,location,WebSocket,localStorage,sessionStorage,indexedDB,window}=__ENV;`+m[1]+`
;global.__T={get S(){return S;},set S(v){S=v;},BAL,ROSTER,SKILLS,EVENT_POOL,ELEMS,BEATS,PLAYER_METRIC_KEYS,AI_LEVEL_KO,
  newGame,genEvents,doSearch,canSearchPiece,applyRoster,aiAutoPlace,startTurn,endTurn,doMove,canMoveTo,canBattle,
  initBattle,startRounds,doTeleportSwap,teleportAvailable,checkWipe,alivePieces,at,fleeSwap,visibleTo,inForest,
  finishByCapture,tryCapture,afterBattle,vipChoice,mkPiece,adjEnemies,archOf,archSkills,isBurning,beginPlay,
  aiMain,aiMainStrong,aiStep,aiVisible,aiThreatOf,aiStaticRisk,aiSeenMoved,aiLevelOf,aiBattleEV,aiEvalPos,aiEvalBattles,aiEvalBattlesStrong,
  aiBattleAction,aiBattleActionStrong,aiProf,observeMove,met,metricsSnapshot,setSeed,rand,gameOver,doPush,judge,execSlot,nextPhase,
  applyAction,netPump,slotPow,dmgRange,SKIND_KO,ELEM_KO,ELEM_EMO,shuffle, // #92 온라인 수신 경로·표시 헬퍼
  recruitCandidates:typeof recruitCandidates==="function"?recruitCandidates:undefined,aiRecruitSlot:typeof aiRecruitSlot==="function"?aiRecruitSlot:undefined, // #92 (기준판 로드 호환: 없으면 undefined)
  atkElOf:typeof atkElOf==="function"?atkElOf:undefined,skillNameKo:typeof skillNameKo==="function"?skillNameKo:undefined,recruitModal:typeof recruitModal==="function"?recruitModal:undefined,
  SKILL_TIER_KO:typeof SKILL_TIER_KO!=="undefined"?SKILL_TIER_KO:undefined,
  renderSide,renderMetrics,render,startMode,modal,close,onCell,humanViewer,idLabel,
  MEMO_OPTS,MEMO_UI,memoOpt,memoSet,memoModal, // #36 추측 메모 피커
  ART,ART_BASE,ART_DIRS,ART_DIR_SET,artUrl,artDirOf,artDirOfFighter:typeof artDirOfFighter==="function"?artDirOfFighter:undefined,artOk,artPreload,pcFaceHtml,pcInfoHtml,pcBodyHtml,pcLabel,pieceEmoji,memoEmoji,
  GLYPH,glyphOk,glyphSpan,memoShort,pieceMemoKey,
  artFail:window.artFail,artSpriteFail:window.artSpriteFail,artPortraitFail:window.artPortraitFail,
  rosterInfo:window.rosterInfo,battleModal,toggleRoster:window.toggleRoster, // #89 하수인 아트 연결 (표시 계층)
  NET,NET_LOCAL_DEFAULT,NET_PROTOCOL_MARKER,NET_CODE_MIN,NET_CODE_MAX,NET_CODE_HINT,netCodeValid,netParseAddr,netIpv4Class,netIpv6Allowed,NET_ADDR_HINT,netCaptureCode,netCodePrompt,escAttr,close, // #63 안전 접속 — 기본 주소·접속 코드 분리·하위 프로토콜 계약 검증용
  netServerDefault,netActor,netAction,netPrepare,netConnect,netCancelQueue,applyNetSetup,netStart,setupDoneCore,autoPlaceCore,fillRosterRandom,zoneOf,showToast, // #54 온라인 PVP — 주소 기본값·정규화·ws/wss·사전 배치 검증용 최소 노출
  TUT,TUT_STEPS,TUT_HINTS,TUT_KEY,tutStore,tutSeen,tutOpen,tutClose,tutNext,tutPrev,tutSkip,tutGo,tutRender,tutKeydown,tutHint,tutHintClose,tutFocus,tutScrollTop, // #26 튜토리얼 (S와 분리) · #42 tutScrollTop = 새 단계 스크롤 최상단 복귀
  html:${JSON.stringify(html)}};`;
  eval(code);
  const T=global.__T;
  T.drain=drain; T.TQ=TQ; T.els=els; T.document=doc;
  T.wsLog=wsLog; T.WebSocketCtor=WebSocketCtor; T.location=loc;
  T.storage=storage; T.sessionStorage=sessionStorage; T.indexedDB=indexedDB; T.cookieWrites=cookieWrites;
  T.byId=id=>doc.getElementById(id); // 이 로드의 문서에서만 요소를 집는다 (전역 document 경유 금지)
  T.setLocation=href=>{ Object.assign(loc,mkLocation(href)); return loc; }; // 객체 정체성 유지 → 제품이 묶은 location 그대로
  T.BAL.aiDelay=0; T.BAL.simDelay=0;
  return T;
}

/* storage 옵션 해석 — 생략은 "빈 저장소"가 기본이다 (앞선 load의 저장소를 우연히 물려받지 않는다).
   명시적으로 setStorage()로 미리 설치한 계약이 있을 때만 그것을 물려받는다. */
function resolveStorage(opts){
  if(opts.storage===undefined) return PREINSTALLED?PREINSTALLED.value:mkStorage();
  if(opts.storage==="inherit"){ if(PREINSTALLED) return PREINSTALLED.value;
    throw new Error('load({storage:"inherit"})에는 setStorage()로 미리 설치한 저장소가 필요하다'); }
  if(opts.storage===null) return undefined; // 웹 스토리지 미지원 환경
  return opts.storage;
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

module.exports={load,freshPlay,clearCell,place,mine,clearBoard,invariants,runSim,mkLocation,setLocation,
  mkStorage,setStorage,resetStorage,throwingStorage,storageExtras,storageTrace,storageSnapshot,persistApiHits,DEFAULT_HREF};
