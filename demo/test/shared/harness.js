/* Digit Dual 헤드리스 하네스 — demo/index.html의 <script>를 DOM 스텁 위에서 eval하고 내부 심볼을 노출한다.
   사용: const H=require("../shared/harness"); const T=H.load(); (T.S, T.BAL, T.newGame, ... ) */
"use strict";
const fs=require("fs"), path=require("path");

/* #54 REVISE(Saturn_3): 요소는 자기를 만든 문서(ownerDocument)를 들고 다닌다.
   포커스/블러가 전역 document를 건드리면, 나중 load()가 전역을 갈아끼운 뒤 앞선 T의 포커스가
   "가장 최근 로드"의 문서에 기록된다. doc를 인자로 받아 그 문서에만 쓴다. */
/* #217 최소 querySelector 지원 — 실제 제품 코드가 쓰는 패턴("#id .cls[data-x=\"v\"][data-y=\"v2\"]",
   공백=후손 결합자, 조각당 태그?·.클래스*·[attr=val]*)만 지원한다. doc.querySelector*와 el.querySelector*가
   함께 쓴다(모듈 top-level — mkEl보다 먼저 정의되어야 요소 메서드에서 바로 참조할 수 있다). */
function parseSimple(part){
  let tag=null,id=null; const classes=[],attrs=[];
  const re=/#[\w-]+|\.[\w-]+|\[[\w-]+(=("[^"]*"|'[^']*'))?\]|^[a-zA-Z][\w-]*/g;
  let m; while((m=re.exec(part))){ const t=m[0];
    if(t[0]==="#") id=t.slice(1);
    else if(t[0]===".") classes.push(t.slice(1));
    else if(t[0]==="["){ const mm=/\[([\w-]+)(?:=("[^"]*"|'[^']*'))?\]/.exec(t); attrs.push({name:mm[1],val:mm[2]!==undefined?mm[2].slice(1,-1):undefined}); }
    else tag=t; }
  return {tag,id,classes,attrs};
}
function elClasses(el){ // 제품 코드는 classList.add()도 cell.className="a b"(문자열 대입)도 둘 다 쓴다 — 합쳐서 본다
  const set=new Set(el._cls?Array.from(el._cls):[]);
  if(el.className) String(el.className).split(/\s+/).filter(Boolean).forEach(c=>set.add(c));
  return set;
}
function matchesSimple(el,sel){
  if(sel.id&&el.id!==sel.id) return false;
  if(sel.classes.length){ const cls=elClasses(el); for(const c of sel.classes) if(!cls.has(c)) return false; }
  for(const a of sel.attrs){
    const v=a.name.indexOf("data-")===0?(el.dataset&&el.dataset[a.name.slice(5)]):el.getAttribute(a.name);
    if(a.val===undefined){ if(v===undefined||v===null) return false; }
    else if(String(v)!==a.val) return false;
  }
  return true;
}
function descendants(root){ const out=[]; (function walk(e){ for(const c of (e.children||[])){ out.push(c); walk(c); } })(root); return out; }
function queryAllFrom(root,selector){ // el.querySelector*: root 자신은 제외하고 후손만 본다(실제 DOM과 동일)
  const parts=String(selector).trim().split(/\s+/).map(parseSimple);
  let pool=[root];
  for(const sel of parts){ const next=[]; for(const base of pool) for(const d of descendants(base)) if(matchesSimple(d,sel)) next.push(d); pool=next; }
  return pool;
}
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
  querySelectorAll(sel){ return queryAllFrom(this,sel); }, querySelector(sel){ return queryAllFrom(this,sel)[0]||null; },
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

function localAsset(htmlPath,ref){
  const clean=String(ref).split(/[?#]/,1)[0];
  if(!clean||/^(?:[a-z]+:|\/|\\)/i.test(clean)) throw new Error("external asset is not local: "+ref);
  const root=path.dirname(path.resolve(htmlPath));
  const file=path.resolve(root,clean);
  if(file!==root&&!file.startsWith(root+path.sep)) throw new Error("external asset escapes demo root: "+ref);
  return fs.readFileSync(file,"utf8");
}
function inlineAssets(source,htmlPath){
  let html=String(source).replace(/<link\b([^>]*)>/gi,(tag,attrs)=>{
    const rel=/\brel\s*=\s*(["'])(.*?)\1/i.exec(attrs);
    if(!rel||rel[2].toLowerCase()!=="stylesheet") return tag;
    const href=/\bhref\s*=\s*(["'])(.*?)\1/i.exec(attrs);
    if(!href) return tag;
    return "<style>"+localAsset(htmlPath,href[2])+"</style>";
  });
  const scripts=[];
  const marker="<!-- harness-script -->";
  html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(tag,attrs,body)=>{
    const src=/\bsrc\s*=\s*(["'])(.*?)\1/i.exec(attrs);
    scripts.push(src?localAsset(htmlPath,src[2]):body);
    return scripts.length===1?marker:"";
  });
  if(!scripts.length) throw new Error("script block not found");
  const script=scripts.join("\n");
  return {html:html.replace(marker,"<script>"+script+"</script>"),script};
}

function load(htmlPath,opts){
  opts=opts||{};
  htmlPath=htmlPath||path.join(__dirname,"..","..","index.html");
  const loaded=inlineAssets(opts.html!==undefined?String(opts.html):fs.readFileSync(htmlPath,"utf8"),htmlPath); // #94·#96 메모리 HTML과 #245 외부 정적 파일을 같은 실행 소스로 정규화
  const html=loaded.html;
  const els={};
  const cookieWrites=[];
  // doc를 먼저 만들고 모든 요소를 mkEl(doc)로 생성한다 — 포커스는 이 로드의 문서에만 기록된다
  const doc={getElementById:id=>els[id]||(els[id]=mkEl(doc)),createElement:()=>mkEl(doc),body:null,activeElement:null,
    contains(n){return !!n&&n.isConnected!==false;}}; // #26: 포커스 추적·속성 스텁
  /* #217 최소 querySelector(doc 레벨) — 실제 제품 코드가 쓰는 유일한 패턴 "#id .cls[data-x=\"v\"]..."만 지원한다.
     조각 파서·매칭기(parseSimple/matchesSimple/descendants)는 모듈 top-level에 있다(el.querySelector와 공유). */
  function queryAll(selector){
    const parts=String(selector).trim().split(/\s+/).map(parseSimple);
    if(!parts.length) return [];
    let candidates;
    if(parts[0].id){ const start=els[parts[0].id]; candidates=start?[start]:[]; }
    else candidates=descendants(doc.body||{children:Object.values(els)});
    let pool=candidates;
    for(let i=(parts[0].id?1:0);i<parts.length;i++){
      const sel=parts[i]; const next=[];
      for(const base of pool) for(const d of descendants(base)) if(matchesSimple(d,sel)) next.push(d);
      pool=next;
    }
    return pool;
  }
  doc.querySelectorAll=selector=>queryAll(selector);
  doc.querySelector=selector=>queryAll(selector)[0]||null;
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
  /* opts.WebSocketCtor: 실제 WebSocket 생성자(전역 네이티브 WebSocket 또는 ws 패키지)를 주입하는 탈출구 —
     헤드리스 스모크(회귀)는 여전히 기본 스텁(mkWebSocket)을 쓴다. #217 실서버 통합 검증(진짜 소켓)에서만
     쓰는 선택 사항이며, 생략하면 기존 동작과 완전히 같다. */
  const WebSocketCtor=opts.WebSocketCtor||mkWebSocket(wsLog);
  const storage=resolveStorage(opts);
  const sessionStorage=opts.sessionStorage!==undefined?opts.sessionStorage:mkStorage();
  const indexedDB={opens:[],open(){this.opens.push(Array.prototype.slice.call(arguments));return {};}};
  /* window.localStorage 경로(tutStore)도 자기 로드의 저장소를 보도록 얇은 프록시로 감싼다.
     읽기 중 스토리지·location·WebSocket만 가로채고 나머지(window.__act 등 제품이 붙이는 심볼)는 전역 그대로 — 격리 최소 침습. */
  const OVERRIDE={location:loc,WebSocket:WebSocketCtor,sessionStorage,indexedDB,document:doc};
  /* #94: 제품이 window.xxx= 로 붙이는 진입점(startMode·autoPlaceCore·__actCore …)을 로드별로도 기록한다.
     window.xxx 읽기는 항상 자기 로드의 것을 돌려주고, 전역(bare 식별자 호출 경로)은 종전대로 "마지막 로드"가 갖되
     T.activate() 로 어느 로드든 다시 전역의 주인이 될 수 있다 — 두 온라인 클라이언트를 한 프로세스에서 번갈아 구동하는 락스텝 픽스처용.
     단일 로드 실행에서는 종전과 완전히 같다 (기록된 값 = 전역 값). */
  const winProps={};
  const win=new Proxy(global,{
    get(t,p){ if(p==="localStorage"){ if(storage&&storage.__throws) throw new Error(storage.__throws); return storage; }
      if(Object.prototype.hasOwnProperty.call(OVERRIDE,p)) return OVERRIDE[p];
      if(p==="window"||p==="self"||p==="globalThis") return win;
      if(Object.prototype.hasOwnProperty.call(winProps,p)) return winProps[p];
      return t[p]; },
    set(t,p,v){ winProps[p]=v; t[p]=v; return true; },
    has(t,p){ return p in t; }});

  // 전역 미러 — 테스트가 global.location / global.localStorage 로 "현재 로드"를 관찰하는 기존 방식 유지
  global.location=loc; global.WebSocket=WebSocketCtor;
  global.sessionStorage=sessionStorage; global.indexedDB=indexedDB;
  defineStorage(global,storage);

  // 가짜 타이머 — opts.realTimers: #217 실서버 통합 검증에서만 진짜 setTimeout/setInterval을 쓴다(생략 시 기존 그대로 스텁)
  const TQ=[];
  const ownSetTimeout=fn=>{TQ.push(fn);return 0;};
  if(opts.realTimers){ global.setTimeout=setTimeout; global.setInterval=setInterval; global.clearInterval=clearInterval; }
  else { global.setTimeout=ownSetTimeout; global.setInterval=()=>0; global.clearInterval=()=>{}; } // #41: 헤드리스에서는 무동작 (프로세스가 안 끝나던 회귀 방지)
  const drain=(cap)=>{cap=cap||5000000; let n=0; while(TQ.length&&n<cap){TQ.shift()();n++;} return n;};
  const __ENV={document:doc,location:loc,WebSocket:WebSocketCtor,localStorage:storage,sessionStorage,indexedDB,window:win};
  /* 렉시컬 캡처 — 이 줄은 제품 코드 1행과 같은 줄에 이어 붙지 않도록 개행 없이 앞에 둔다 (에러 행 번호 보존) */
  const code=`"use strict";const {document,location,WebSocket,localStorage,sessionStorage,indexedDB,window}=__ENV;`+loaded.script+`
;global.__T={get S(){return S;},set S(v){S=v;},BAL,ROSTER,SKILLS,ELEMS,BEATS,PLAYER_METRIC_KEYS,AI_LEVEL_KO,
  /* #233 (GDD-23 3-4장) 8스탯 전투 엔진 계약 — 기준판 로드 호환을 위해 typeof 가드를 둔다(부재 시 undefined) */
  ARCHETYPE_BASE:typeof ARCHETYPE_BASE!=="undefined"?ARCHETYPE_BASE:undefined, KING_BASE:typeof KING_BASE!=="undefined"?KING_BASE:undefined,
  ALLY_BASE:typeof ALLY_BASE!=="undefined"?ALLY_BASE:undefined, LEGEND_BASE:typeof LEGEND_BASE!=="undefined"?LEGEND_BASE:undefined,
  gradeHp:typeof gradeHp==="function"?gradeHp:undefined, gradeAtk:typeof gradeAtk==="function"?gradeAtk:undefined,
  applyArchStats:typeof applyArchStats==="function"?applyArchStats:undefined, applyFixedStats:typeof applyFixedStats==="function"?applyFixedStats:undefined,
  shieldAdd:typeof shieldAdd==="function"?shieldAdd:undefined, shieldConsume:typeof shieldConsume==="function"?shieldConsume:undefined, shieldClearAll:typeof shieldClearAll==="function"?shieldClearAll:undefined,
  resolveHit:typeof resolveHit==="function"?resolveHit:undefined, resolveReflect:typeof resolveReflect==="function"?resolveReflect:undefined,
  resolveCounter:typeof resolveCounter==="function"?resolveCounter:undefined, instaKill:typeof instaKill==="function"?instaKill:undefined,
  scheduleDelayed:typeof scheduleDelayed==="function"?scheduleDelayed:undefined, tickDelayed:typeof tickDelayed==="function"?tickDelayed:undefined,
  resolveTyped:typeof resolveTyped==="function"?resolveTyped:undefined, // 4.3 타입별 피해 공통 진입점(연쇄 금지 chainLock 포함)
  applyTimedFx:typeof applyTimedFx==="function"?applyTimedFx:undefined, // 5.6 중첩·재부여·지속
  applyCrack:typeof applyCrack==="function"?applyCrack:undefined, applyHarden:typeof applyHarden==="function"?applyHarden:undefined,
  applyEvadeBuff:typeof applyEvadeBuff==="function"?applyEvadeBuff:undefined, applyDmgUpBuff:typeof applyDmgUpBuff==="function"?applyDmgUpBuff:undefined,
  decideFirstSide:typeof decideFirstSide==="function"?decideFirstSide:undefined, // 4.4 선턴 확정
  fighterOrderCat:typeof fighterOrderCat==="function"?fighterOrderCat:undefined, // 4.4 순서 효과 분류(0=선턴 1=기본 2=후턴)
  finishBattle:typeof finishBattle==="function"?finishBattle:undefined, // 4.6 전투 종료 경로(HP만 유지 검증용)
  /* #234 (GDD-23 6장) 로스터·스킬 계약 — 기준판 로드 호환 typeof 가드 */
  V2_INTERP:typeof V2_INTERP!=="undefined"?V2_INTERP:undefined, V2_SPECIES:typeof V2_SPECIES!=="undefined"?V2_SPECIES:undefined, V2_SPECIES_DEF:typeof V2_SPECIES_DEF!=="undefined"?V2_SPECIES_DEF:undefined, V2_SKELETON:typeof V2_SKELETON!=="undefined"?V2_SKELETON:undefined, V2_ELEM_ORDER:typeof V2_ELEM_ORDER!=="undefined"?V2_ELEM_ORDER:undefined, V2_ELEM_FX:typeof V2_ELEM_FX!=="undefined"?V2_ELEM_FX:undefined, V2_KINGDOM_STAGE2:typeof V2_KINGDOM_STAGE2!=="undefined"?V2_KINGDOM_STAGE2:undefined,
  /* #235 시너지 — 왕국·아키타입·전설 패시브 표와 Core 집계·선택자 (기준판 로드 호환: 부재 시 undefined) */
  V2_KINGDOM_STEPS:typeof V2_KINGDOM_STEPS!=="undefined"?V2_KINGDOM_STEPS:undefined, V2_KINGDOM_STAGES:typeof V2_KINGDOM_STAGES!=="undefined"?V2_KINGDOM_STAGES:undefined,
  V2_ARCH_STEPS:typeof V2_ARCH_STEPS!=="undefined"?V2_ARCH_STEPS:undefined, V2_ARCH_SYN:typeof V2_ARCH_SYN!=="undefined"?V2_ARCH_SYN:undefined,
  V2_LEGEND_SYN:typeof V2_LEGEND_SYN!=="undefined"?V2_LEGEND_SYN:undefined,
  v2KingdomEffectOf:typeof v2KingdomEffectOf==="function"?v2KingdomEffectOf:undefined, effAtk:typeof effAtk==="function"?effAtk:undefined,
  synCount:typeof synCount==="function"?synCount:undefined, synKingdomStage:typeof synKingdomStage==="function"?synKingdomStage:undefined,
  synArchBonus:typeof synArchBonus==="function"?synArchBonus:undefined,
  synElemKinds:typeof synElemKinds==="function"?synElemKinds:undefined, synDragonEl:typeof synDragonEl==="function"?synDragonEl:undefined,
  synView:typeof synView==="function"?synView:undefined, LEGEND_ROSTER:typeof LEGEND_ROSTER!=="undefined"?LEGEND_ROSTER:undefined, V2_FX:typeof V2_FX!=="undefined"?V2_FX:undefined,
  speciesSkills:typeof speciesSkills==="function"?speciesSkills:undefined, applySpecies:typeof applySpecies==="function"?applySpecies:undefined, applyLegend:typeof applyLegend==="function"?applyLegend:undefined, leaderSkillIds:typeof leaderSkillIds==="function"?leaderSkillIds:undefined, syncLeaderSkills:typeof syncLeaderSkills==="function"?syncLeaderSkills:undefined, syncOwnerLeaders:typeof syncOwnerLeaders==="function"?syncOwnerLeaders:undefined, leaderDefaultElement:typeof leaderDefaultElement==="function"?leaderDefaultElement:undefined, assignLeaderElements:typeof assignLeaderElements==="function"?assignLeaderElements:undefined, execV2:typeof execV2==="function"?execV2:undefined, v2Apply:typeof v2Apply==="function"?v2Apply:undefined, v2Heal:typeof v2Heal==="function"?v2Heal:undefined, v2CdUpTarget:typeof v2CdUpTarget==="function"?v2CdUpTarget:undefined, v2ReqOk:typeof v2ReqOk==="function"?v2ReqOk:undefined, v2RoundStart:typeof v2RoundStart==="function"?v2RoundStart:undefined, effSpd:typeof effSpd==="function"?effSpd:undefined, resetV2:typeof resetV2==="function"?resetV2:undefined, aiV2SupportScore:typeof aiV2SupportScore==="function"?aiV2SupportScore:undefined, aiPickRoster:typeof aiPickRoster==="function"?aiPickRoster:undefined,
  /* #241 스킬 정리 — 회피율 감소 · 해일 예고 · 거울 수면 · AI 예정 선턴 (기준판 로드 호환: 부재 시 undefined) */
  effEvade:typeof effEvade==="function"?effEvade:undefined, v2TideCheck:typeof v2TideCheck==="function"?v2TideCheck:undefined, v2PeekStatus:typeof v2PeekStatus==="function"?v2PeekStatus:undefined,
  aiScheduledLead:typeof aiScheduledLead==="function"?aiScheduledLead:undefined, aiV2DmgAdj:typeof aiV2DmgAdj==="function"?aiV2DmgAdj:undefined,
  EVENT_POOL:typeof EVENT_POOL!=="undefined"?EVENT_POOL:undefined, // v0.4.6 이하 기준판 호환 (v0.4.7 에서 EVENT_KINDS 로 대체)
  EVENT_KINDS:typeof EVENT_KINDS!=="undefined"?EVENT_KINDS:undefined, EVENT_KO:typeof EVENT_KO!=="undefined"?EVENT_KO:undefined, // #121 계약 1.1
  ITEMS:typeof ITEMS!=="undefined"?ITEMS:undefined,
  GIFT_PICKS:typeof GIFT_PICKS!=="undefined"?GIFT_PICKS:undefined, GIFT_KO:typeof GIFT_KO!=="undefined"?GIFT_KO:undefined, // #121 계약 2.2
  BUFFS:typeof BUFFS!=="undefined"?BUFFS:undefined, BUFF_KEYS:typeof BUFF_KEYS!=="undefined"?BUFF_KEYS:undefined, // #121 계약 3
  NEW_SKILLS:typeof NEW_SKILLS!=="undefined"?NEW_SKILLS:undefined, SKILL_CLS_KO:typeof SKILL_CLS_KO!=="undefined"?SKILL_CLS_KO:undefined, // #121 계약 5
  WITCH_EFFECTS:typeof WITCH_EFFECTS!=="undefined"?WITCH_EFFECTS:undefined, WITCH_COMBOS:typeof WITCH_COMBOS!=="undefined"?WITCH_COMBOS:undefined,
  witchApply:typeof witchApply==="function"?witchApply:undefined, reaperWhy:typeof reaperWhy==="function"?reaperWhy:undefined,
  slotUsable:typeof slotUsable==="function"?slotUsable:undefined, battleMaxRounds:typeof battleMaxRounds==="function"?battleMaxRounds:undefined,
  resetAfter:typeof resetAfter==="function"?resetAfter:undefined, resetBattleTemps:typeof resetBattleTemps==="function"?resetBattleTemps:undefined, // #121 계약 3.1 전투 종료 정리 검증용
  recruitState:typeof recruitState==="function"?recruitState:undefined, searchFinalizeFx:typeof searchFinalizeFx==="function"?searchFinalizeFx:undefined, // #121 계약 4·6 · #129 계약 7 (#245: 상태는 reducer, 이 이름은 표시 전용)
  searchEndCheck:typeof searchEndCheck==="function"?searchEndCheck:undefined, rosterMinions:typeof rosterMinions==="function"?rosterMinions:undefined,
  capReceivers:typeof capReceivers==="function"?capReceivers:undefined,
  get __openPkgCore(){return window.__openPkgCore;}, get __pkgPickCore(){return window.__pkgPickCore;}, get __pkgCancelCore(){return window.__pkgCancelCore;}, // #245 취소도 Core 경계 // #121 전투 중 패키지 (battleModal 클로저 — 매 렌더 교체되므로 getter)
  get __recruitCore(){return window.__recruitCore;},
  get __openPkg(){return window.__openPkg;}, get __act(){return window.__act;}, get __useItem(){return window.__useItem;}, // netAction 래퍼 (온라인 송신 경로 검증용)
  get __useItemCore(){return window.__useItemCore;}, get __throwBallCore(){return window.__throwBallCore;}, // 전투 모달 클로저 — 매 렌더 교체되므로 getter
  get __fleeCore(){return window.__fleeCore;}, get __actCore(){return window.__actCore;}, get __menu(){return window.__menu;},
  get __passCore(){return window.__passCore;}, get __pass(){return window.__pass;}, get __flee(){return window.__flee;}, // #146 수동 전투 행동 넘기기 · netAction 래퍼
  fleeProbOf:typeof fleeProbOf==="function"?fleeProbOf:undefined, // #146 전투원별 도망 성공률 (기준판 로드 호환: 부재 시 undefined)
  teleportSwapValid:typeof teleportSwapValid==="function"?teleportSwapValid:undefined, // #131 실행 직전 재검사
  NO_ATTACK_MSG:typeof NO_ATTACK_MSG!=="undefined"?NO_ATTACK_MSG:undefined, // #146 안내 문구
  TELE_PICK1_MSG:typeof TELE_PICK1_MSG!=="undefined"?TELE_PICK1_MSG:undefined, TELE_PICK2_MSG:typeof TELE_PICK2_MSG!=="undefined"?TELE_PICK2_MSG:undefined,
  TELE_TRAP_MSG:typeof TELE_TRAP_MSG!=="undefined"?TELE_TRAP_MSG:undefined, // #131 거부 안내
  newGame,genEvents,doSearch,canSearchPiece,applyRoster,aiAutoPlace,startTurn,endTurn,doMove,canMoveTo,canBattle,
  initBattle,startRounds,doTeleportSwap,teleportAvailable,checkWipe,alivePieces,at,fleeSwap,visibleTo,inForest,
  finishByCapture,tryCapture,afterBattle,vipChoice,mkPiece,adjEnemies,archOf,archSkills,isBurning,beginPlay,
  aiMain,aiMainStrong,aiStep,aiVisible,aiThreatOf,aiStaticRisk,aiSeenMoved,aiLevelOf,aiBattleEV,aiEvalPos,aiEvalBattles,aiEvalBattlesStrong,aiUnitValue,
  aiBattleAction,aiBattleActionStrong,aiProf,observeMove,met,metricsSnapshot,setSeed,rand,gameOver,doPush,judge,execSlot,nextPhase,
  applyAction,resolveCoreAction:typeof resolveCoreAction==="function"?resolveCoreAction:undefined,reduceCoreAction:typeof reduceCoreAction==="function"?reduceCoreAction:undefined,dispatchCoreAction:typeof dispatchCoreAction==="function"?dispatchCoreAction:undefined,commitCoreState:typeof commitCoreState==="function"?commitCoreState:undefined,
  /* #245 Saturn REVISE(M3): 규칙 이벤트의 소유자(Core)와 그 소비 루프 — 화면 없이 규칙 진행을 검증하는 경로 */
  applyCoreEffects:typeof applyCoreEffects==="function"?applyCoreEffects:undefined,runCoreEvents:typeof runCoreEvents==="function"?runCoreEvents:undefined,
  emitCore:typeof emitCore==="function"?emitCore:undefined,UI_PORT:typeof UI_PORT!=="undefined"?UI_PORT:undefined,
  battleSideOf:typeof battleSideOf==="function"?battleSideOf:undefined,entryStep:typeof entryStep==="function"?entryStep:undefined,
  AI:typeof AI!=="undefined"?AI:undefined,aiMem:typeof aiMem==="function"?aiMem:undefined,aiCloneBoard:typeof aiCloneBoard==="function"?aiCloneBoard:undefined, // #245 M2 AI 어댑터 기록·사본 보드
  boardCellOk:typeof boardCellOk==="function"?boardCellOk:undefined,movablePiece:typeof movablePiece==="function"?movablePiece:undefined,netPump,slotPow,dmgRange,SKIND_KO,ELEM_KO,ELEM_EMO,TYPE_KO,WINTYPE_KO,shuffle, // #92 온라인 수신 경로·표시 헬퍼 · #245 점진 Core 경계
  recruitCandidates:typeof recruitCandidates==="function"?recruitCandidates:undefined,aiRecruitSlot:typeof aiRecruitSlot==="function"?aiRecruitSlot:undefined, // #92 (기준판 로드 호환: 없으면 undefined)
  atkElOf:typeof atkElOf==="function"?atkElOf:undefined,skillNameKo:typeof skillNameKo==="function"?skillNameKo:undefined,recruitModal:typeof recruitModal==="function"?recruitModal:undefined,
  SKILL_TIER_KO:typeof SKILL_TIER_KO!=="undefined"?SKILL_TIER_KO:undefined,
  renderSide,renderMetrics,render,startMode,modal,close:typeof closeModal==="function"?closeModal:close,closeModal:typeof closeModal==="function"?closeModal:undefined,onCell,humanViewer,idLabel,
  MEMO_OPTS,MEMO_UI,memoOpt,memoSet,memoModal, // #36 추측 메모 피커
  memoClickTarget:typeof memoClickTarget==="function"?memoClickTarget:undefined, memoTargetOk:typeof memoTargetOk==="function"?memoTargetOk:undefined, // #94 로컬 메모 분기 (변경 전 소스로 음성 대조를 돌릴 수 있게 부재 허용)
  ART,ART_BASE,ART_DIRS,ART_DIR_SET,artUrl,artDirOf,artDirOfFighter:typeof artDirOfFighter==="function"?artDirOfFighter:undefined,artOk,artPreload,pcFaceHtml,pcInfoHtml,pcBodyHtml,pcLabel,pieceEmoji,memoEmoji,
  GLYPH,glyphOk,glyphSpan,memoShort,pieceMemoKey,
  /* #201 후속(2026-09-11) 함정 전용 도형 (기준판 로드 호환: 부재 시 undefined) */
  SYM_SVG:typeof SYM_SVG!=="undefined"?SYM_SVG:undefined, symSvgHtml:typeof symSvgHtml==="function"?symSvgHtml:undefined,
  artFail:window.artFail,artSpriteFail:window.artSpriteFail,artPortraitFail:window.artPortraitFail,
  /* #201 (v0.4.8) 일시적 로드 실패의 유한 복구 (기준판 로드 호환: 부재 시 undefined) */
  ART_RETRY:typeof ART_RETRY!=="undefined"?ART_RETRY:undefined, artFilesOf:typeof artFilesOf==="function"?artFilesOf:undefined,
  artScheduleFile:typeof artScheduleFile==="function"?artScheduleFile:undefined, artProbeFile:typeof artProbeFile==="function"?artProbeFile:undefined,
  artBattleOk:typeof artBattleOk==="function"?artBattleOk:undefined, artGone:typeof artGone==="function"?artGone:undefined, artMarkSettled:typeof artMarkSettled==="function"?artMarkSettled:undefined,
  artScheduleRecovery:typeof artScheduleRecovery==="function"?artScheduleRecovery:undefined, artProbe:typeof artProbe==="function"?artProbe:undefined,
  artRerender:typeof artRerender==="function"?artRerender:undefined, artLeaderReady:typeof artLeaderReady==="function"?artLeaderReady:undefined,
  rosterInfo:window.rosterInfo,battleModal,toggleRoster:window.toggleRoster, // #89 하수인 아트 연결 (표시 계층)
  NET,NET_LOCAL_DEFAULT,NET_PROTOCOL_MARKER,NET_CODE_MIN,NET_CODE_MAX,NET_CODE_HINT,netCodeValid,netParseAddr,netIpv4Class,netIpv6Allowed,NET_ADDR_HINT,netCaptureCode,netCodePrompt,escAttr, // #63 안전 접속 — 기본 주소·접속 코드 분리·하위 프로토콜 계약 검증용
  netServerDefault,netActor,netAction,netPrepare,netConnect,netPump,netCancelQueue,applyNetSetup,netStart,setupDoneCore,autoPlaceCore,fillRosterRandom,zoneOf,showToast, // #54 온라인 PVP — 주소 기본값·정규화·ws/wss·사전 배치 검증용 최소 노출
  netUiTab:typeof netUiTab==="function"?netUiTab:undefined, netRoomsHtml:typeof netRoomsHtml==="function"?netRoomsHtml:undefined, // #217/#218 공개 방(초대 코드 없는 목록·참가)
  netListRooms:typeof netListRooms==="function"?netListRooms:undefined, netCreatePublicRoom:typeof netCreatePublicRoom==="function"?netCreatePublicRoom:undefined,
  netJoinPublicRoom:typeof netJoinPublicRoom==="function"?netJoinPublicRoom:undefined, netRoomReady:typeof netRoomReady==="function"?netRoomReady:undefined,
  netLeaveRoom:typeof netLeaveRoom==="function"?netLeaveRoom:undefined, netHandlePublicMessage:typeof netHandlePublicMessage==="function"?netHandlePublicMessage:undefined,
  /* #217 재접속(bounded resume) — setInterval이 헤드리스에서 무동작이므로 tick을 직접 호출해 검증한다 */
  netResumeTick:typeof netResumeTick==="function"?netResumeTick:undefined, netResumeAttempt:typeof netResumeAttempt==="function"?netResumeAttempt:undefined,
  netBeginResume:typeof netBeginResume==="function"?netBeginResume:undefined, netClearResume:typeof netClearResume==="function"?netClearResume:undefined,
  netCancelResume:typeof netCancelResume==="function"?netCancelResume:undefined, netHandlePublicSocketClosed:typeof netHandlePublicSocketClosed==="function"?netHandlePublicSocketClosed:undefined,
  /* #217 공개 방 표시 계층 — fx 재생 큐·battleId 무대 소유·원본 전투 화면 재사용 검증용 */
  netApplyRoomState:typeof netApplyRoomState==="function"?netApplyRoomState:undefined, netFxIngest:typeof netFxIngest==="function"?netFxIngest:undefined,
  netFxPump:typeof netFxPump==="function"?netFxPump:undefined, netSyncOverlays:typeof netSyncOverlays==="function"?netSyncOverlays:undefined,
  netSynthBattle:typeof netSynthBattle==="function"?netSynthBattle:undefined, netRenderBattleStage:typeof netRenderBattleStage==="function"?netRenderBattleStage:undefined,
  netFlushSetupReady:typeof netFlushSetupReady==="function"?netFlushSetupReady:undefined, netSendAction:typeof netSendAction==="function"?netSendAction:undefined,
  /* #263 게임 시한 다섯 종(상점 90·배치 90·행동 30·전투 60·B08 20) · 단절 정지 — 시계 자리와 정지·시한 경과 판정 검증용.
     복수 강제 대상 선택의 30초는 **행동 30초를 한 번 더 도는 것**이라 종류를 따로 세지 않는다(저장 자리만 다르다). */
  get TURNCLK(){return typeof TURNCLK!=="undefined"?TURNCLK:undefined;},
  turnClockText:typeof turnClockText==="function"?turnClockText:undefined, turnClockSync:typeof turnClockSync==="function"?turnClockSync:undefined,
  turnClockLate:typeof turnClockLate==="function"?turnClockLate:undefined, turnClockWants:typeof turnClockWants==="function"?turnClockWants:undefined,
  netPaused:typeof netPaused==="function"?netPaused:undefined, netResignBtn:typeof netResignBtn==="function"?netResignBtn:undefined,
  bagPickShow:typeof bagPickShow==="function"?bagPickShow:undefined, netEcoResign:typeof netEcoResign==="function"?netEcoResign:undefined,
  netRenderEcoOverlay:typeof netRenderEcoOverlay==="function"?netRenderEcoOverlay:undefined,
  netClockText:typeof netClockText==="function"?netClockText:undefined,
  autoEndReady:typeof autoEndReady==="function"?autoEndReady:undefined, toLobby:typeof toLobby==="function"?toLobby:undefined,
  NET_RESUME_GRACE_MS:typeof NET_RESUME_GRACE_MS!=="undefined"?NET_RESUME_GRACE_MS:undefined, NET_RESUME_RETRY_MS:typeof NET_RESUME_RETRY_MS!=="undefined"?NET_RESUME_RETRY_MS:undefined,
  TUT,TUT_STEPS,TUT_HINTS,tutSeen,tutOpen,tutClose,tutNext,tutPrev,tutSkip,tutGo,tutRender,tutKeydown,tutHint,tutHintClose,tutFocus,tutScrollTop, // #26 튜토리얼 (S와 분리) · #42 tutScrollTop = 새 단계 스크롤 최상단 복귀
  /* #128: 현행 제품에는 튜토리얼 영구 저장이 없다(TUT_KEY·tutStore 삭제). 고정 ref 기준판(#92 d614392·#93 6baa0b5 등)은 아직 갖고 있으므로 부재를 허용한다 */
  TUT_KEY:typeof TUT_KEY!=="undefined"?TUT_KEY:undefined, tutStore:typeof tutStore!=="undefined"?tutStore:undefined,
  // #106 턴 흐름·연출 계약 (기준판 로드 호환: 부재 시 undefined)
  FX:typeof FX!=="undefined"?FX:undefined,fxLocked:typeof fxLocked==="function"?fxLocked:undefined,fxPlay:typeof fxPlay==="function"?fxPlay:undefined,fxReleaseAll:typeof fxReleaseAll==="function"?fxReleaseAll:undefined,
  fxLive:typeof fxLive==="function"?fxLive:undefined,fxMs:typeof fxMs==="function"?fxMs:undefined,fxWhenIdle:typeof fxWhenIdle==="function"?fxWhenIdle:undefined,fxIdle:typeof fxIdle==="function"?fxIdle:undefined,
  doHeal:typeof doHeal==="function"?doHeal:undefined,canHeal:typeof canHeal==="function"?canHeal:undefined,healTick:typeof healTick==="function"?healTick:undefined,healBreak:typeof healBreak==="function"?healBreak:undefined,
  contactText:typeof contactText==="function"?contactText:undefined,contactEligible:typeof contactEligible==="function"?contactEligible:undefined,forcedPickOk:typeof forcedPickOk==="function"?forcedPickOk:undefined,bombAttack:typeof bombAttack==="function"?bombAttack:undefined,
  autoEndCheck:typeof autoEndCheck==="function"?autoEndCheck:undefined,autoEndReady:typeof autoEndReady==="function"?autoEndReady:undefined,anyMainActionLeft:typeof anyMainActionLeft==="function"?anyMainActionLeft:undefined,optionalBattleLeft:typeof optionalBattleLeft==="function"?optionalBattleLeft:undefined,
  turnBannerFx:typeof turnBannerFx==="function"?turnBannerFx:undefined,viewerIsOwner:typeof viewerIsOwner==="function"?viewerIsOwner:undefined,fxTurnLabel:typeof fxTurnLabel==="function"?fxTurnLabel:undefined,resultBannerOf:typeof resultBannerOf==="function"?resultBannerOf:undefined,
  renderTurnBar,renderBoard,netReady,netAction,onCellCore,execSlot,aiSchedule,aiScheduleBattle,
  playMsgs,applyFx,bmsg,liveBattleDom,stIcons,aiHealPick:typeof aiHealPick==="function"?aiHealPick:undefined,aiMainStrong,teleportSwapBlock,newAdjAt,forcedEligible,drainForcedQueue,applyForced,fleeSwap,actorOfPhase,battleActionFrame:typeof battleActionFrame==="function"?battleActionFrame:undefined,fighterName, // #245 bf — 수신 프레임 재생 검증용 (기준판 대조 로드에는 없다)
  // #114 v0.4.5 (기준판 로드 호환: 부재 시 undefined) — 양측 밀기·재배치·도망 보드 교환·AI 밀기 평가
  pushResolve:typeof pushResolve==="function"?pushResolve:undefined,pushPair:typeof pushPair==="function"?pushPair:undefined,relocatePair:typeof relocatePair==="function"?relocatePair:undefined,relocCandidates:typeof relocCandidates==="function"?relocCandidates:undefined,relocZone:typeof relocZone==="function"?relocZone:undefined,
  fleeSwapPrompt:typeof fleeSwapPrompt==="function"?fleeSwapPrompt:undefined,fleeResolve:typeof fleeResolve==="function"?fleeResolve:undefined,fleePickMine:typeof fleePickMine==="function"?fleePickMine:undefined,
  aiPushScore:typeof aiPushScore==="function"?aiPushScore:undefined,aiVipPair:typeof aiVipPair==="function"?aiVipPair:undefined,aiTeleportPick:typeof aiTeleportPick==="function"?aiTeleportPick:undefined,aiHistTele:typeof aiHistTele==="function"?aiHistTele:undefined,aiBattlePairScore:typeof aiBattlePairScore==="function"?aiBattlePairScore:undefined,aiWorstReply:typeof aiWorstReply==="function"?aiWorstReply:undefined,netActor:typeof netActor==="function"?netActor:undefined,
  /* #122 (v0.4.7) 세로 UI 셸 · #126 경기 종료 연출 · #124 왕·동료 아트 훅 (기준판 로드 호환: 부재 시 undefined) */
  UI:typeof UI!=="undefined"?UI:undefined, uiScreenName:typeof uiScreenName==="function"?uiScreenName:undefined,
  uiApply:typeof uiApply==="function"?uiApply:undefined, fitBoard:typeof fitBoard==="function"?fitBoard:undefined,
  renderBoardInfo:typeof renderBoardInfo==="function"?renderBoardInfo:undefined,
  matchBannerOf:typeof matchBannerOf==="function"?matchBannerOf:undefined, matchEndBanner:typeof matchEndBanner==="function"?matchEndBanner:undefined,
  matchEndFx:typeof matchEndFx==="function"?matchEndFx:undefined, fxFxLayer:typeof fxFxLayer==="function"?fxFxLayer:undefined,
  netLeave:typeof netLeave==="function"?netLeave:undefined, uiResetScreen:typeof uiResetScreen==="function"?uiResetScreen:undefined,
  get toLobby(){return window.toLobby;}, get rematch(){return window.rematch;},
  get uiDrawer(){return window.uiDrawer;}, get uiPrep(){return window.uiPrep;}, get uiStart(){return window.uiStart;},
  LEADER_BASE:typeof LEADER_BASE!=="undefined"?LEADER_BASE:undefined, LEADER_DIRS:typeof LEADER_DIRS!=="undefined"?LEADER_DIRS:undefined,
  LEADER_FILES:typeof LEADER_FILES!=="undefined"?LEADER_FILES:undefined, leaderDirOf:typeof leaderDirOf==="function"?leaderDirOf:undefined,
  leaderArtDir:typeof leaderArtDir==="function"?leaderArtDir:undefined, leaderBattleDir:typeof leaderBattleDir==="function"?leaderBattleDir:undefined,
  get MSGPLAYING(){return MSGPLAYING;},get MSGQ(){return MSGQ;},
  /* #236 경제 — 기준판 로드 호환을 위해 부재 시 undefined */
  ECO:typeof ECO!=="undefined"?ECO:undefined, ecoKey:typeof ecoKey==="function"?ecoKey:undefined, ecoUnitOf:typeof ecoUnitOf==="function"?ecoUnitOf:undefined,
  ecoEmptyField:typeof ecoEmptyField==="function"?ecoEmptyField:undefined, ecoPrice:typeof ecoPrice==="function"?ecoPrice:undefined,
  ecoBuyable:typeof ecoBuyable==="function"?ecoBuyable:undefined, ecoReserveNeed:typeof ecoReserveNeed==="function"?ecoReserveNeed:undefined,
  ecoSynView:typeof ecoSynView==="function"?ecoSynView:undefined,
  ecoOpenShop:typeof ecoOpenShop==="function"?ecoOpenShop:undefined, checkDeath:typeof checkDeath==="function"?checkDeath:undefined,
  battleCmdFrame:typeof battleCmdFrame==="function"?battleCmdFrame:undefined,
  ballWhy:typeof ballWhy==="function"?ballWhy:undefined, aiShop:typeof aiShop==="function"?aiShop:undefined, aiBagPick:typeof aiBagPick==="function"?aiBagPick:undefined,
  shopHtml:typeof shopHtml==="function"?shopHtml:undefined, shopViewer:typeof shopViewer==="function"?shopViewer:undefined,
  get __shop(){return window.__shop;},
  html:${JSON.stringify(html)}};`;
  eval(code);
  const T=global.__T;
  T.drain=drain; T.TQ=TQ; T.els=els; T.document=doc;
  T.wsLog=wsLog; T.WebSocketCtor=WebSocketCtor; T.location=loc;
  T.storage=storage; T.sessionStorage=sessionStorage; T.indexedDB=indexedDB; T.cookieWrites=cookieWrites;
  T.byId=id=>doc.getElementById(id); // 이 로드의 문서에서만 요소를 집는다 (전역 document 경유 금지)
  T.setLocation=href=>{ Object.assign(loc,mkLocation(href)); return loc; }; // 객체 정체성 유지 → 제품이 묶은 location 그대로
  /* #94: 이 로드를 다시 전역의 주인으로 — window 진입점·가짜 타이머·전역 미러를 이 로드의 것으로 되돌린다 (다중 로드 락스텝용) */
  T.activate=()=>{ for(const k of Object.keys(winProps)) global[k]=winProps[k];
    global.setTimeout=ownSetTimeout; global.document=doc; global.window=global; global.location=loc; global.WebSocket=WebSocketCtor;
    global.sessionStorage=sessionStorage; global.indexedDB=indexedDB; defineStorage(global,storage); return T; };
  T.BAL.aiDelay=0; T.BAL.simDelay=0;
  if(T.BAL.fx) T.BAL.fx.autoEnd=false; // #106: 기존 회귀는 endTurn 을 직접 부른다 — 자동 턴 종료는 전용 테스트(smoke_turnflow)에서 명시적으로 켜서 검증한다
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

/* #235 시너지 중립 무대 — 고정 수치·난수 소비를 보는 회귀(#233·#234·#241)의 전제.
   그 무대들은 freshPlay 의 **무작위 로스터** 위에 서 있어서, 같은 속성(왕 속성 포함)이나 같은 아키타입이
   우연히 한 좌석에 2칸 모이면 왕국 (2) · 아키타입 2단계가 켜지고 피해·회피·선턴·상태 확률·rand 소비가 흔들린다.
   전투원(fighters)의 속성은 그대로 두고 **나머지 필드 칸의 집계 입력만** 비운다 — 남은 전투원은 좌석당 1칸이라
   어느 단계도 켜지지 않아 두 좌석의 집계가 0 으로 못 박힌다. 제품 규칙은 건드리지 않고 입력만 중립으로 놓는다. */
function synNeutral(T,fighters){
  const keep=new Set(fighters||[]);
  for(const x of T.S.pieces) if(!keep.has(x)&&(x.type==="minion"||x.type==="king"||x.type==="ally")){ x.element=null; x.legend=null; x.rosterId=null; }
  if(T.S.reserve) T.S.reserve=[null,null]; // 가방 전설도 아키타입 집계에 든다
  return T.S;
}

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
    if(opts.trace) opts.trace(T,n);
    if(opts.check&&(n%opts.check===0)){ const v=invariants(T); if(v.length){viol.push(...v.map(x=>"t"+T.S.turnCount+" "+x));} }
    /* #245 M2: 사고 시간은 게임 상태가 아니라 AI 어댑터 기록이다 (AI.lastThinkMs) */
    const mem=T.AI; if(mem&&mem.lastThinkMs){ think.push(mem.lastThinkMs); mem.lastThinkMs=0; }
    if(n>=(opts.cap||5000000)) break;
  }
  const v=invariants(T); if(v.length) viol.push(...v);
  return {snap:T.metricsSnapshot(),winner:T.S.winner,phase:T.S.phase,turns:T.S.turnCount,winType:T.S.metrics.winType,steps:n,viol:[...new Set(viol)],
    thinkAvg:think.length?think.reduce((a,b)=>a+b,0)/think.length:0, thinkMax:think.length?Math.max(...think):0};
}

module.exports={load,freshPlay,clearCell,place,mine,clearBoard,synNeutral,invariants,runSim,mkLocation,setLocation,
  mkStorage,setStorage,resetStorage,throwingStorage,storageExtras,storageTrace,storageSnapshot,persistApiHits,DEFAULT_HREF};
