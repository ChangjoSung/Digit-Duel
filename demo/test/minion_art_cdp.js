/* #89 하수인 아트 게임 적용 — 실제 브라우저(헤드리스 Chrome · CDP) 실측
   사용: node demo/test/minion_art_cdp.js [--html <index.html>] [--out <dir>] [--chrome <chrome.exe>] [--no-shots] [--no-http] [--read-only]
   --read-only: Saturn 독립 재검증용. 검증 산출물 0 — 스크린샷·보고서 JSON·스크립트 출력 파일을 만들지 않고 stdout 으로만 보고한다.
                단, 헤드리스 Chrome 자체가 쓰는 임시 프로필(os.tmpdir()/artcdp-*)은 실행 부수 리소스로 생성되며, 이 실행이 mkdtemp 로 만든
                정확한 경로 하나만 종료 시 정리한다(경로·PID 를 RESOURCE/CLEANUP 행으로 stdout 에 남긴다). "파일을 하나도 만들지 않는다"는 뜻이 아니다.
   설명창 대체 표시 회귀(roster-fb): Network.setBlockedURLs 로 portrait.webp / portrait.webp+png 실제 요청을 차단해
   정상 · webp 실패→png 성공 · 둘 다 실패 세 경우의 표시 크기(192 데스크톱 / 128 짧은 화면)·버튼 위치·모달 스크롤이 보존되는지 잰다.
   목적: 헤드리스 DOM 스텁으로는 알 수 없는 것 — 자산이 실제로 로드되는가(file:// · HTTP), 실제 래스터 크기·표시 크기,
         48px 컨테이너가 52px 칸을 넘지 않는가, 정보 행이 아이콘을 덮지 않는가, DPR·확대율별 장치 픽셀 배율,
         미공개 말 DOM 에 종 경로가 없는가 — 를 진짜 렌더 트리에서 잰다.
   측정 항목은 기계 판정이다. 선명도·대비·사람 식별성의 최종 판정은 이 숫자가 아니라 저장된 스크린샷의 사람 검수다.
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 없음. 종료 코드 1 = 실측 문제 발견. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.3","issues","89","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write"); // Saturn 독립 재검증용 — 검증 산출물 0(스크린샷·보고서·출력 파일 없음), stdout 만. Chrome 임시 프로필은 부수 생성·정리 (헤더 참조)
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const USE_HTTP=!args.includes("--no-http");
const HTTP_REQUIRED=!args.includes("--no-http"); // 기본 실행에서 HTTP 검증은 필수 — 서버가 안 뜨면 성공으로 끝내지 않는다
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(opt("--html",path.join(__dirname,"..","index.html")));
const FILE_URL="file:///"+HTML.replace(/\\/g,"/");

/* 확대율은 "CSS 뷰포트 ÷ 배율 + DPR × 배율" 로 재현한다 (tut_layout_cdp 와 같은 방식) */
const VIEWPORTS=[
  {name:"desktop-1280",            w:1280,h:800, dpr:1,    zoom:"100%"},
  {name:"desktop-1280-dpr2",       w:1280,h:800, dpr:2,    zoom:"100%"},
  {name:"desktop-1280-dpr1.5",     w:1280,h:800, dpr:1.5,  zoom:"100%"},
  {name:"desktop-1280-zoom125",    w:1024,h:640, dpr:1.25, zoom:"125%"},
  {name:"desktop-1280-zoom200",    w:640, h:400, dpr:2,    zoom:"200%"},
  {name:"desktop-1920",            w:1920,h:1080,dpr:1,    zoom:"100%"},
  {name:"mobile-390",              w:390, h:844, dpr:2,    zoom:"100%"},
  {name:"mobile-360",              w:360, h:740, dpr:2,    zoom:"100%"},
];
const SHOT_VPS=new Set(["desktop-1280","desktop-1280-dpr2","desktop-1280-dpr1.5","desktop-1280-zoom125","desktop-1280-zoom200","mobile-390","mobile-360","mobile-360-short"]);
/* 설명창 대체 표시 회귀(Saturn 1차 QA #89 P2) — @media (max-height:700px) 경계 양쪽을 실제 요청 차단으로 잰다.
   expect 는 CSS 뷰포트 높이로 결정된다(≤700 → 128, 그 외 192). DPR 은 CSS px 에 영향을 주지 않는다. */
const FB_VIEWPORTS=[
  {name:"desktop-1280",         w:1280,h:800, dpr:1,    zoom:"100%", expect:192},
  {name:"desktop-1280-zoom125", w:1024,h:640, dpr:1.25, zoom:"125%", expect:128},
  {name:"mobile-360-short",     w:360, h:640, dpr:1,    zoom:"100%", expect:128},
];
const FB_CASES=[
  {name:"normal",   block:[]},
  {name:"webpfail", block:["*/portrait.webp"]},
  {name:"allfail",  block:["*/portrait.webp","*/portrait.png"]},
];

/* ── 페이지 안에서 도는 준비·측정 스크립트 ───────────────────────────────── */
const SETUP_PLAY=`(()=>{
  try{ localStorage.setItem("tutorialSeen","1"); }catch(e){}
  if(typeof tutClose==="function") try{ tutClose(); }catch(e){}
  setSeed(4242); // 시드 고정 — 변경 전/후 뷰포트 비교를 같은 판 위에서 한다
  startMode("pve",{aiLevel:"grade5"});
  fillRosterRandom(0); autoPlaceCore(); setupDoneCore();
  // 상대 하수인 한 종만 공개해 "공개된 상대 말"과 "미공개 상대 말"이 한 화면에 함께 있게 만든다
  const op=S.pieces.filter(x=>x.owner===1&&x.type==="minion"&&x.placed);
  if(op[0]) op[0].revealed=true;
  const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.placed);
  if(me&&op[1]){ const t=S.pieces.find(x=>x.placed&&x.alive&&x.r===me.r-1&&x.c===me.c); if(t&&t!==op[1]) t.placed=false; op[1].r=me.r-1; op[1].c=me.c; }
  S.selected=me||null; render();
  return S.phase;
})()`;

const OPEN_ROSTER=`(()=>{ rosterInfo("M-F1"); return document.getElementById("overlayBox").innerHTML.indexOf("rosterArt")>=0; })()`;
const CLOSE_MODAL=`(()=>{ close(); return true; })()`;

const START_BATTLE=`(()=>{
  const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.placed&&x.rosterId);
  const op=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.placed&&x.rosterId&&x.id!==(me&&me.id));
  if(!me||!op) return "no-minions";
  const occ=S.pieces.find(x=>x.placed&&x.alive&&x.r===me.r-1&&x.c===me.c&&x.id!==op.id);
  if(occ) occ.placed=false;
  op.r=me.r-1; op.c=me.c;
  S.current=0; S.mainUsed=false; S.battlesUsed=0; S.selected=null;
  initBattle(me,op);
  return S.battle?"ok":"no-battle";
})()`;

/* 말판 실측 — 진짜 렌더 트리에서 잰다 */
const MEASURE_BOARD=`(()=>{
  const R=e=>e.getBoundingClientRect(), issues=[];
  const chips=[...document.querySelectorAll("#board .pc")];
  if(!chips.length) return {error:"말이 렌더되지 않음"};
  const dpr=window.devicePixelRatio;
  const dirs=(typeof ART_DIRS!=="undefined")?ART_DIRS:[];
  let icons=0,imgLoaded=0,imgBroken=0,natWrong=0,boxWrong=0,iconBoxWrong=0,overlap=0,outsideCell=0,hpShown=0,hiddenImg=0,hiddenLeak=0,memoGuess=0,rendering="";
  for(const ch of chips){
    const cr=R(ch), ce=R(ch.parentNode);
    if(Math.round(cr.width)!==48||Math.round(cr.height)!==48) boxWrong++;
    if(cr.left<ce.left-0.5||cr.right>ce.right+0.5||cr.top<ce.top-0.5||cr.bottom>ce.bottom+0.5) outsideCell++;
    const img=ch.querySelector("img.icon"), info=ch.querySelector(".info");
    if(img){
      icons++;
      if(img.complete&&img.naturalWidth>0) imgLoaded++; else imgBroken++;
      if(img.naturalWidth!==32||img.naturalHeight!==32) natWrong++;
      const ir=R(img);
      if(Math.round(ir.width)!==32||Math.round(ir.height)!==32) iconBoxWrong++;
      if(info&&R(info).top<ir.bottom-0.5) overlap++;
      if(!rendering) rendering=getComputedStyle(img).imageRendering;
    }
    if(ch.classList.contains("hiddenId")){
      if(ch.querySelector("img")) hiddenImg++;
      const h=ch.outerHTML;
      if(dirs.some(d=>h.indexOf(d)>=0)) hiddenLeak++;
    }
    if(ch.classList.contains("memo-guess")) memoGuess++;
    if(ch.querySelector(".hp")) hpShown++;
  }
  // 폭탄·함정에 HP 가 붙지 않는가 (실렌더 기준)
  let bombHp=0;
  for(const ch of chips){ const t=ch.textContent||""; if(/💣|🪤/.test(ch.innerHTML)&&ch.querySelector(".hp")) bombHp++; }
  // 플랫폼이 그릴 수 없는 기호와, 그래서 텍스트로 대체된 표시 개수 — 두부(빈 네모)가 남지 않았는지의 근거
  const noGlyph=(typeof MEMO_OPTS!=="undefined"&&typeof glyphOk==="function")?MEMO_OPTS.filter(o=>!glyphOk(o.emoji)).map(o=>o.emoji+"("+o.ko+")"):[];
  const ngShown=document.querySelectorAll("#board .ng").length;
  /* 오탐 가드: 확실히 그려지는 일반 문자·기호가 "글리프 없음"으로 잘못 판정되면 정상 표시가 텍스트로 바뀐다 */
  const falsePos=(typeof glyphOk==="function")?["A","가","1","※","①","♛","☂","→","●","한"].filter(ch=>!glyphOk(ch)):[];
  if(falsePos.length) issues.push("글리프 판정 오탐 — 정상 문자를 미지원으로 봄: "+falsePos.join(","));
  /* boardW 는 #board 컨테이너 폭이다 — 블록 요소라 왼쪽 패널 폭에 따라 늘어나며 칸 크기와 무관하다.
     실제 판정 대상은 7×52+6×2 = 376 × 13×52+12×2 = 700 의 "칸 그리드 실측 영역"이다. 둘을 따로 기록·판정한다. */
  const cellEls=[...document.querySelectorAll("#board .cell")];
  const gl=Math.min(...cellEls.map(c=>R(c).left)), gr=Math.max(...cellEls.map(c=>R(c).right));
  const gt=Math.min(...cellEls.map(c=>R(c).top)), gb=Math.max(...cellEls.map(c=>R(c).bottom));
  const gridW=Math.round(gr-gl), gridH=Math.round(gb-gt);
  if(cellEls.length!==91) issues.push("칸 수 "+cellEls.length+"≠91");
  if(gridW!==376||gridH!==700) issues.push("칸 그리드 실측 "+gridW+"×"+gridH+" ≠ 376×700");
  const cell=document.querySelector("#board .cell"), board=document.getElementById("board");
  const cr0=cell?R(cell):null, br=board?R(board):null;
  if(boxWrong) issues.push("말 컨테이너 48×48 아님 "+boxWrong+"개");
  if(outsideCell) issues.push("말이 칸 밖으로 나감 "+outsideCell+"개");
  if(iconBoxWrong) issues.push("아이콘 표시 32×32 아님 "+iconBoxWrong+"개");
  if(natWrong) issues.push("아이콘 원본 래스터가 32×32 아님 "+natWrong+"개");
  if(imgBroken) issues.push("아이콘 로드 실패 "+imgBroken+"개");
  if(overlap) issues.push("정보 행이 아이콘 영역을 덮음 "+overlap+"개");
  if(hiddenImg) issues.push("미공개 말에 <img> 존재 "+hiddenImg+"개");
  if(hiddenLeak) issues.push("미공개 말 DOM 에 종 폴더명 노출 "+hiddenLeak+"개");
  if(bombHp) issues.push("폭탄·함정에 HP 표시 "+bombHp+"개");
  if(rendering&&rendering!=="pixelated") issues.push("image-rendering="+rendering);
  return {dpr,falsePos,chips:chips.length,icons,imgLoaded,imgBroken,natWrong,boxWrong,iconBoxWrong,overlap,outsideCell,hpShown,hiddenImg,hiddenLeak,memoGuess,bombHp,rendering,noGlyph,ngShown,
    cellW:cr0?Math.round(cr0.width):0, boardW:br?Math.round(br.width):0, boardH:br?Math.round(br.height):0, gridW,gridH,cells:cellEls.length,
    iconDevicePx:Math.round(32*dpr), pageScrollW:document.documentElement.scrollWidth, viewportW:document.documentElement.clientWidth, issues};
})()`;

const MEASURE_ROSTER=`(()=>{
  const R=e=>e.getBoundingClientRect(), issues=[];
  const img=document.querySelector(".rosterArt img"), box=document.getElementById("overlayBox");
  if(!img) return {error:"설명창 일러스트 없음"};
  const r=R(img), br=R(box);
  const btns=[...document.querySelectorAll("#obBtns button")].map(b=>b.textContent.trim());
  if(!(img.complete&&img.naturalWidth>0)) issues.push("portrait 로드 실패 src="+img.getAttribute("src"));
  if(img.naturalWidth&&img.naturalWidth!==512) issues.push("portrait 원본이 512 아님 "+img.naturalWidth);
  if(r.width>br.width+0.5) issues.push("일러스트가 모달 폭을 넘음");
  if(btns.length!==2) issues.push("버튼 "+btns.length+"개");
  return {natW:img.naturalWidth,natH:img.naturalHeight,dispW:Math.round(r.width),dispH:Math.round(r.height),
    src:img.getAttribute("src"),rendering:getComputedStyle(img).imageRendering,
    boxScroll:box.scrollHeight>box.clientHeight+1?box.scrollHeight+">"+box.clientHeight:"",btns:btns.join("/"),
    boxW:Math.round(br.width),issues};
})()`;

/* 설명창 대체 표시 실측 — img 또는 .fb 대체상자의 실제 계산 크기, 버튼 top, 모달 스크롤을 한 번에 잰다 */
const MEASURE_ROSTER_FB=`(()=>{
  const R=e=>e.getBoundingClientRect();
  const art=document.querySelector(".rosterArt"), box=document.getElementById("overlayBox"), btns=document.getElementById("obBtns");
  if(!art||!box||!btns) return {error:"설명창 요소 없음 art="+!!art+" box="+!!box+" btns="+!!btns};
  const img=art.querySelector("img"), fb=art.classList.contains("fb");
  const target=fb?art:img; if(!target) return {error:"일러스트도 대체상자도 없음"};
  const tr=R(target), br=R(box), bt=R(btns);
  const cs=getComputedStyle(target);
  return {fb, imgCount:art.querySelectorAll("img").length, src:img?img.getAttribute("src"):"", loaded:img?(img.complete&&img.naturalWidth>0):null,
    natW:img?img.naturalWidth:0, dispW:Math.round(tr.width*100)/100, dispH:Math.round(tr.height*100)/100, cssW:cs.width, cssH:cs.height,
    artTop:Math.round((tr.top-br.top)*100)/100, btnTop:Math.round((bt.top-br.top)*100)/100, btnCount:btns.querySelectorAll("button").length,
    boxH:Math.round(br.height*100)/100, boxScrollH:box.scrollHeight, boxClientH:box.clientHeight, text:fb?art.textContent.trim():"",
    vpH:document.documentElement.clientHeight};
})()`;

const MEASURE_BATTLE=`(()=>{
  const R=e=>e.getBoundingClientRect(), issues=[];
  const stage=document.getElementById("bstage");
  if(!stage) return {error:"전투 스테이지 없음"};
  const sr=R(stage), toks=[...stage.querySelectorAll(".btok")].map(t=>{
    const img=t.querySelector("img.bsprite"), tr=R(t);
    return {id:t.id,art:t.classList.contains("art"),
      w:Math.round(tr.width),h:Math.round(tr.height),left:Math.round(tr.left-sr.left),right:Math.round(sr.right-tr.right),
      natW:img?img.naturalWidth:0,natH:img?img.naturalHeight:0,loaded:img?(img.complete&&img.naturalWidth>0):null,
      dispW:img?Math.round(R(img).width):0,rendering:img?getComputedStyle(img).imageRendering:"",
      src:img?img.getAttribute("src"):""};
  });
  for(const t of toks){
    if(t.art){
      if(t.loaded===false) issues.push(t.id+" 전투 도트 로드 실패 "+t.src);
      if(t.natW&&t.natW!==128) issues.push(t.id+" 전투 도트 원본 "+t.natW+"≠128");
      if(t.dispW&&t.dispW!==128) issues.push(t.id+" 전투 도트 표시 "+t.dispW+"≠128");
      if(t.rendering&&t.rendering!=="pixelated") issues.push(t.id+" image-rendering="+t.rendering);
    }
    const tr=R(document.getElementById(t.id));
    if(tr.left<sr.left-0.5||tr.right>sr.right+0.5) issues.push(t.id+" 토큰이 스테이지 좌우를 벗어남");
  }
  if(toks.length===2){
    const a=R(document.getElementById(toks[0].id)), b=R(document.getElementById(toks[1].id));
    const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left), oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    if(ox>1&&oy>1) issues.push("두 토큰이 겹침 "+Math.round(ox)+"×"+Math.round(oy)+"px");
  }
  return {stageW:Math.round(sr.width),stageH:Math.round(sr.height),toks,issues};
})()`;

const MEASURE_TRAY=`(()=>{
  const R=e=>e.getBoundingClientRect(), issues=[];
  const items=[...document.querySelectorAll(".trayItem")];
  if(!items.length) return {error:"트레이 없음"};
  let icons=0,broken=0,rows=new Set();
  for(const it of items){
    const img=it.querySelector("img.icon");
    if(img){ icons++; if(!(img.complete&&img.naturalWidth>0)) broken++; }
    rows.add(Math.round(R(it).top));
  }
  const tray=items[0].parentNode, tr=R(tray);
  const overflow=items.some(i=>R(i).right>tr.right+0.5);
  if(broken) issues.push("트레이 아이콘 로드 실패 "+broken+"개");
  if(overflow) issues.push("트레이 항목이 컨테이너 폭을 넘음");
  return {items:items.length,icons,broken,rows:rows.size,trayW:Math.round(tr.width),issues};
})()`;

const SETUP_TRAY=`(()=>{
  try{ localStorage.setItem("tutorialSeen","1"); }catch(e){}
  if(typeof tutClose==="function") try{ tutClose(); }catch(e){}
  setSeed(4242); startMode("pvp"); fillRosterRandom(0); render();
  return document.querySelectorAll(".trayItem").length;
})()`;

/* ── CDP 배선 (tut_layout_cdp.js 와 같은 방식) ───────────────────────────── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"artcdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.waiters=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){ const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=()=>rej(new Error("WS 오류 "+url)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* 기존 사용자 서버(8080)를 건드리지 않는다 — PORT=0 임의 포트 · 루프백 바인드로 이 검증 전용 서버만 띄우고 끝나면 이것만 정리한다 */
function startServer(){
  return new Promise((res,rej)=>{
    const p=spawn(process.execPath,[path.join(ROOT,"server","server.js")],{env:Object.assign({},process.env,{PORT:"0"}),stdio:["ignore","pipe","pipe"]});
    let out=""; const t=setTimeout(()=>{ try{p.kill();}catch(e){} rej(new Error("서버 기동 대기 시간 초과\n"+out)); },15000);
    const onData=d=>{ out+=d; const m=out.match(/listening on ([\d.]+):(\d+)/); if(m){ clearTimeout(t); res({proc:p,host:m[1],port:Number(m[2])}); } };
    p.stdout.on("data",onData); p.stderr.on("data",onData);
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("서버 종료 "+c+"\n"+out)); });
  });
}

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  let server=null;
  let httpError=null;
  if(USE_HTTP){ try{ server=await startServer(); }catch(e){ httpError=e.message; } }
  const schemes=[{name:"file",url:FILE_URL}];
  if(server) schemes.push({name:"http",url:`http://127.0.0.1:${server.port}/index.html`});

  const {proc,ws,udd}=await launch();
  /* 실행 부수 리소스는 정확한 생성 경로·PID 만 추적한다 (와일드카드 정리 금지) */
  console.log(`RESOURCE chrome pid=${proc.pid} profile=${udd}`);
  if(server) console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port}`);
  const report=[]; let bad=0;
  /* shots = 저장된 PNG 의 고유 경로 목록(파일 인벤토리) · captures = 캡처 호출 전부(같은 이름을 다시 저장한 덮어쓰기 포함).
     roster-fb 정상 경우가 desktop-1280·zoom125 의 _2-roster 를 같은 이름으로 다시 저장하므로 둘은 다를 수 있다 — 파일 수는 shots.length 다. */
  const shots=[], captures=[];
  /* 기본 실행에서 HTTP 검증은 필수다 — 서버가 안 뜨면 "생략"이 아니라 실패로 기록한다. file 단독 실행은 --no-http 를 명시할 때만 정상이다 */
  if(HTTP_REQUIRED&&!server){ report.push({scheme:"http",vp:"-",what:"server",error:"필수 HTTP 검증 불가: "+(httpError||"서버 미기동")+" (file 단독 실행은 --no-http 를 명시할 것)",issues:[]}); bad++; }
  const note=(scheme,vp,what,r)=>{ report.push({scheme,vp,what,...r}); if(r.error||(r.issues&&r.issues.length)) bad++; };
  try{
    const cdp=await connect(ws);
    const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
    const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
    await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
    const ev=async expr=>(await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true},sid)).result.value;
    const shot=async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
      const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64"));
      const rel=path.relative(ROOT,f).replace(/\\/g,"/"); captures.push(rel); if(!shots.includes(rel)) shots.push(rel); };

    for(const sc of schemes) for(const vp of VIEWPORTS){
      const tag=`${sc.name}_${vp.name}`;
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:vp.w,height:vp.h,deviceScaleFactor:vp.dpr,mobile:false},sid);
      const loaded=cdp.once("Page.loadEventFired",sid);
      await cdp.send("Page.navigate",{url:sc.url},sid); await loaded;
      await sleep(250);

      // 1) 배치 트레이
      await ev(SETUP_TRAY); await sleep(300);
      note(sc.name,vp.name,"tray",await ev(MEASURE_TRAY));
      if(SHOT_VPS.has(vp.name)) await shot(`${tag}_1-tray`);

      // 2) 로스터 설명창 (portrait)
      await ev(OPEN_ROSTER); await sleep(400);
      note(sc.name,vp.name,"roster",await ev(MEASURE_ROSTER));
      if(SHOT_VPS.has(vp.name)) await shot(`${tag}_2-roster`);
      await ev(CLOSE_MODAL);

      // 3) 말판 (내 말·공개된 상대 말·미공개 상대 말이 한 화면에)
      await ev(SETUP_PLAY); await sleep(400);
      note(sc.name,vp.name,"board",await ev(MEASURE_BOARD));
      if(SHOT_VPS.has(vp.name)) await shot(`${tag}_3-board`);

      // 4) 전투 스테이지 (양측 하수인 128 도트)
      const st=await ev(START_BATTLE); await sleep(1400);
      if(st==="ok") note(sc.name,vp.name,"battle",await ev(MEASURE_BATTLE));
      else note(sc.name,vp.name,"battle",{error:"전투 시작 실패: "+st,issues:[]});
      if(SHOT_VPS.has(vp.name)) await shot(`${tag}_4-battle`);
    }

    /* ── 설명창 대체 표시 회귀 (Saturn 1차 QA #89 P2) ─────────────────────────────
       실제 요청을 Network.setBlockedURLs 로 차단해 webp 실패→png, webp·png 모두 실패를 재현한다.
       판정: 세 경우 모두 표시 크기 = expect(192/128), 버튼 top·모달 스크롤이 정상 경우와 같다(±0.5px), webpfail 은 png 로 로드 성공, allfail 은 .fb 대체상자·img 0. */
    await cdp.send("Network.enable",{},sid);
    for(const sc of schemes) for(const vp of FB_VIEWPORTS){
      const tag=`${sc.name}_${vp.name}`;
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:vp.w,height:vp.h,deviceScaleFactor:vp.dpr,mobile:false},sid);
      await cdp.send("Network.setCacheDisabled",{cacheDisabled:true},sid); // 앞선 정상 로드의 메모리 캐시가 차단을 우회하지 않게 한다
      await cdp.send("Network.setBlockedURLs",{urls:[]},sid);
      const loaded=cdp.once("Page.loadEventFired",sid);
      await cdp.send("Page.navigate",{url:sc.url},sid); await loaded; await sleep(250);
      await ev(SETUP_TRAY); await sleep(200);
      let base=null;
      for(const cs of FB_CASES){
        await cdp.send("Network.setBlockedURLs",{urls:cs.block},sid);
        await ev(OPEN_ROSTER); await sleep(900); // webp onerror → png 재시도 → (차단 시) png onerror 까지 기다린다
        const m=await ev(MEASURE_ROSTER_FB);
        const issues=[];
        if(!m.error){
          if(Math.round(m.dispW)!==vp.expect||Math.round(m.dispH)!==vp.expect) issues.push(`표시 ${m.dispW}x${m.dispH} ≠ ${vp.expect} (vpH=${m.vpH})`);
          if(m.btnCount!==2) issues.push("버튼 "+m.btnCount+"개");
          if(cs.name==="normal"){ base=m; if(!(m.loaded&&m.natW===512&&/portrait\.webp$/.test(m.src))) issues.push("정상 webp 로드 실패 "+m.src); }
          else{
            if(!base) issues.push("정상 기준값 없음");
            else{
              if(Math.abs(m.btnTop-base.btnTop)>0.5) issues.push(`버튼 top ${m.btnTop} ≠ 정상 ${base.btnTop}`);
              if(Math.abs(m.artTop-base.artTop)>0.5) issues.push(`일러스트 top ${m.artTop} ≠ 정상 ${base.artTop}`);
              if(m.boxScrollH!==base.boxScrollH||m.boxClientH!==base.boxClientH) issues.push(`모달 스크롤 ${m.boxScrollH}/${m.boxClientH} ≠ 정상 ${base.boxScrollH}/${base.boxClientH}`);
            }
            if(cs.name==="webpfail"&&!(m.fb===false&&m.loaded&&m.natW===512&&/portrait\.png$/.test(m.src))) issues.push(`webp 차단 시 png 재시도 결과 아님 fb=${m.fb} loaded=${m.loaded} src=${m.src}`);
            if(cs.name==="allfail"&&!(m.fb===true&&m.imgCount===0&&/불러오지 못했습니다/.test(m.text))) issues.push(`둘 다 차단 시 대체상자 아님 fb=${m.fb} imgs=${m.imgCount} text=${m.text}`);
          }
        }
        note(sc.name,vp.name,"roster-fb",Object.assign({case:cs.name,expect:vp.expect,blocked:cs.block},m,{issues:(m.issues||[]).concat(issues)}));
        if(SHOT_VPS.has(vp.name)) await shot(cs.name==="normal"?`${tag}_2-roster`:cs.name==="webpfail"?`${tag}_5-roster-webpfail`:`${tag}_6-roster-allfail`);
        await ev(CLOSE_MODAL); await sleep(100);
      }
      await cdp.send("Network.setBlockedURLs",{urls:[]},sid);
      await cdp.send("Network.setCacheDisabled",{cacheDisabled:false},sid);
    }
  } finally {
    try{proc.kill();}catch(e){}
    if(server) try{server.proc.kill();}catch(e){}   // 이 스크립트가 띄운 QA 서버만 정리한다 (사용자가 켜 둔 서버는 건드리지 않는다)
    // 임시 프로필 정리는 프로세스가 끝나기 전에 동기로 한다 — 지연 타이머는 exit 뒤에 돌지 않아 찌꺼기가 남는다.
    // 재귀 삭제 대상은 이 실행이 mkdtemp 로 만든 정확한 경로 하나뿐이며, resolve 한 절대경로가 os.tmpdir() 바로 아래의 artcdp- 접두 디렉터리인지 확인한 뒤에만 지운다.
    const uddAbs=path.resolve(udd), tmpAbs=path.resolve(os.tmpdir());
    const safe=path.dirname(uddAbs)===tmpAbs&&/^artcdp-[A-Za-z0-9]+$/.test(path.basename(uddAbs));
    let removed=false;
    if(safe) for(let i=0;i<10;i++){ try{ fs.rmSync(uddAbs,{recursive:true,force:true}); }catch(e){} removed=!fs.existsSync(uddAbs); if(removed) break; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150); }
    console.log(`CLEANUP chrome pid=${proc.pid} killed=${proc.killed||proc.exitCode!==null} profile=${uddAbs} guard=${safe} removed=${removed}`+(server?` qa-server pid=${server.proc.pid} killed=${server.proc.killed||server.proc.exitCode!==null}`:""));
  }
  const payload={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),schemes:schemes.map(s=>s.name),viewports:VIEWPORTS,note:"확대율은 실제 브라우저 UI 확대 조작이 아니라 CSS 뷰포트 축소 + DPR 배수 에뮬레이션이다",
    shots, // 고유 PNG 경로 (파일 인벤토리)
    captures:{count:captures.length,overwrites:captures.filter((x,i)=>captures.indexOf(x)!==i)}, // 캡처 호출 수와 같은 이름으로 다시 저장한 경로
    report};
  const reportFile=path.join(OUT,"minion_art_cdp_report.json");
  if(READ_ONLY) console.log("\n--- READ_ONLY: 검증 산출물 0 (스크린샷·보고서 JSON·출력 파일 없음). Chrome 임시 프로필만 부수 생성 후 정리 (위 RESOURCE/CLEANUP 행). 측정 원본 JSON ---\n"+JSON.stringify(payload));
  else fs.writeFileSync(reportFile,JSON.stringify(payload,null,1));
  let cur="";
  for(const r of report){
    const k=r.scheme+" "+r.vp; if(k!==cur){ cur=k; const vp=VIEWPORTS.find(v=>v.name===r.vp);
      console.log(vp?`\n== ${k}  (${vp.w}×${vp.h} · DPR ${vp.dpr} · 확대 ${vp.zoom})`:`\n== ${k}`); }
    const s=r.what==="board"?`chips=${r.chips} icons=${r.icons} loaded=${r.imgLoaded} broken=${r.imgBroken} cell=${r.cellW} grid=${r.gridW}x${r.gridH}/${r.cells}칸 container=${r.boardW} iconDevPx=${r.iconDevicePx} render=${r.rendering} hp=${r.hpShown} hiddenImg=${r.hiddenImg} leak=${r.hiddenLeak} pageW=${r.pageScrollW}/${r.viewportW} noGlyph=[${(r.noGlyph||[]).join(",")}] ngShown=${r.ngShown}`
      :r.what==="roster"?`nat=${r.natW}x${r.natH} disp=${r.dispW}x${r.dispH} box=${r.boxW} btns=${r.btns} scroll=${r.boxScroll||"-"} src=${r.src}`
      :r.what==="battle"?`stage=${r.stageW}x${r.stageH} ${(r.toks||[]).map(t=>`${t.id}${t.art?"(art)":"(emoji)"} ${t.w}x${t.h} nat=${t.natW} disp=${t.dispW}`).join(" | ")}`
      :r.what==="tray"?`items=${r.items} icons=${r.icons} rows=${r.rows} trayW=${r.trayW}`
      :r.what==="roster-fb"?`case=${r.case} expect=${r.expect} disp=${r.dispW}x${r.dispH} fb=${r.fb} imgs=${r.imgCount} loaded=${r.loaded} nat=${r.natW} btnTop=${r.btnTop} artTop=${r.artTop} boxScroll=${r.boxScrollH}/${r.boxClientH} vpH=${r.vpH} src=${r.src||"-"}`:"";
    console.log(`  ${r.what.padEnd(7)}: ${s}${r.issues&&r.issues.length?"  ISSUES: "+r.issues.join(" | "):""}${r.error?"  ERROR "+r.error:""}`);
  }
  console.log(`\n=== minion_art_cdp: ${report.length} 측정 · 문제 ${bad}건 · 스킴 [${schemes.map(x=>x.name).join(",")}]`
    +(READ_ONLY?` · READ_ONLY(검증 산출물 0 — 스크린샷·보고서 없음 · 임시 프로필 ${udd} 부수 생성·정리)`:` · 스크린샷 파일 ${shots.length}장 (캡처 ${captures.length}회 · 같은 이름 덮어쓰기 ${captures.length-shots.length}회) · 보고서 ${path.relative(ROOT,reportFile).replace(/\\/g,"/")}`));
  console.log("확대율은 브라우저 UI 확대 조작이 아니라 CSS 뷰포트 축소 + DPR 배수 에뮬레이션이다. 위 수치는 실측값이고 PASS 는 ISSUES 가 없는 항목에 한정된다.");
  process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
