/* #93/#104 온라인 보드 방향 독립 감사 — 실제 Chrome 2클라이언트 (Mars_3, 2026-09-08)
   사용: node demo/test/milestone/v0.4.4/issues/104/orientation_audit_cdp.js [--ref 6baa0b5] [--read-only] [--out <dir>] [--chrome <chrome.exe>] [--no-shots]
   원리:
     · 검증 전용 릴레이 서버(server/server.js, PORT=0 루프백)를 띄우고, 두 탭이 그 서버 주소로 /index.html 을 연다.
       단, 두 탭은 서버의 같은 출처 빈 URL(/qa-orientation-blank, 404 텍스트)로 간 뒤 **Page.setDocumentContent** 로 문서 본문을 **git show <ref>:demo/index.html(메모리)** 로 바꿔 넣는다
       — 작업 트리의 demo/index.html(병렬 #106 편집 중)을 읽지 않고, 서버와 같은 출처(Origin)라 WebSocket Origin 검사도 그대로 통과한다. (CDP Fetch 가로채기는 이후 WebSocket 핸드셰이크를 깨뜨려 쓰지 않는다.)
       아트(demo/assets)는 서버가 디스크에서 읽어 서빙한다(승인된 자산 읽기).
     · 화면 좌표는 DOM 순서·dataset 이 아니라 **getBoundingClientRect 픽셀**로 잰다: 91칸의 중심 y 를 정렬해 화면 행, x 를 정렬해 화면 열을 정한다.
       각 칸의 dataset(r,c)·칩(owner 클래스·own·hiddenId·아트 경로)이 **독자 변환**(P1 항등 / P2 행 반사 row=14−r·열 유지)과 **상대 탭의 S** 로 예측한 값과 맞는지 91칸 전수 대조하고,
       같은 자리에서 180° 회전·항등 가설이 맞는 칸수도 센다. elementFromPoint(중심 픽셀) 가 그 칸을 돌려주는지도 본다.
     · 클릭은 셀렉터가 아니라 **독자 변환으로 계산한 픽셀**에 실제 마우스 이벤트를 넣고, 페이지의 WebSocket.send 를 감싸 실제로 나간 {t:"cell",r,c} 페이로드를 관측해
       "픽셀 → 논리 좌표 → 페이로드 → 상대 탭 재생" 사슬을 끝까지 확인한다.
     · 자연 흐름: 서로 다른 로스터(카드 클릭)·서로 다른 수동 배치(트레이→칸 클릭)·실제 서버 매칭 → P1 열 2 / P2 열 6 횡단 말이 **65턴 이전에** 1칸 전·측·후 뒤 중앙 7행·양쪽 숲을 넘어 2행/12행까지
       → 실제 턴 버튼으로 65턴 → 두 번째 하수인(P1 열 4 / P2 열 4… 자동 선택)으로 BT 2칸 전·후 → 65턴 이후 중앙 횡단(상대 숲 5행/9행) → 기권 → 종료 화면. 매 클릭 뒤 양 탭 S 동일 + 양 탭 91칸 픽셀 대조.
   --read-only: 산출물 0(스크린샷·JSON 없음). 그 외에는 docs/milestone/v0.4.4/issues/104/Mars/orientation-artifacts/ 에 PNG·JSON 을 쓴다 (다른 이슈의 증빙 폴더는 건드리지 않는다).
   rev 3 (Saturn_1 REVISE 반영): 매 step 뒤의 91칸 픽셀 대조에서 elementFromPoint(칸 중심)=그 칸 91/91 도 함께 판정한다(이전엔 시작 직후 2d 에서만) ·
     공개 하수인 칩의 아트는 경로만이 아니라 **실제 로드 성공**(img.complete && naturalWidth>0) 을 세어 종료 화면(전체 공개)에서 전부 로드됐는지 판정한다(7).
     CANON 은 위치·표시에 필요한 선택 필드(phase·current·turn·mainUsed·battlesUsed·forced·teleUsed·events·tempReveal·battle·modalSeq·말의 id/owner/type/rosterId/name/element/hp/r/c/alive/placed/revealed/immobile/skills) 이며 S 전체가 아니다(cds·memos·traces·inv·reserve·selected 제외).
   의존: Node 22+ · 로컬 Chrome · server/node_modules(ws). 제품 코드·서버 무수정. 종료 코드: 0 통과 · 1 판정 실패 · 2 Chrome 없음 · 3 실행 예외(대조 도중 중단). */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn,execFileSync}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const REF=opt("--ref","6baa0b5");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.4","issues","104","Mars","orientation-artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const INJECT=!args.includes("--no-inject"); // --no-inject: 서버가 디스크에서 서빙하는 작업 트리 demo/index.html 을 그대로 쓴다 (진단용 — 감사 결과로 쓰지 않는다)
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const SRC=execFileSync("git",["show",REF+":demo/index.html"],{cwd:ROOT,maxBuffer:64*1024*1024});
const SRC_SHA=require("crypto").createHash("sha256").update(SRC).digest("hex");
const VP={width:1280,height:1000};
const ROWS=13, COLS=7;

/* ── CDP 배선 ── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"orient-cdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.waiters=[]; this.handlers=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){ for(const h of this.handlers) if(h.method===m.method&&(!h.sid||h.sid===m.sessionId)) h.fn(m.params,m.sessionId);
        const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
  on(method,sid,fn){ this.handlers.push({method,sid,fn}); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=()=>rej(new Error("WS 오류 "+url)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function startServer(){
  return new Promise((res,rej)=>{
    const p=spawn(process.execPath,[path.join(ROOT,"server","server.js")],{env:Object.assign({},process.env,{PORT:"0"}),stdio:["ignore","pipe","pipe"]});
    let out=""; const t=setTimeout(()=>{ try{p.kill();}catch(e){} rej(new Error("서버 기동 대기 시간 초과\n"+out)); },15000);
    const onData=d=>{ out+=d; const m=out.match(/listening on ([\d.]+):(\d+)/), c=out.match(/접속 코드: (\S+)/); if(m&&c){ clearTimeout(t); res({proc:p,host:m[1],port:Number(m[2]),code:c[1]}); } };
    p.stdout.on("data",onData); p.stderr.on("data",onData);
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("서버 종료 "+c+"\n"+out)); });
  });
}

/* ── 자연 배치 (headless 감사와 다른 로스터·배치) — P1 은 열 2 로, P2 는 열 6 으로 횡단. 각자 상대 횡단 열 주변(로컬 11~13행 프레임)을 비운다 ── */
const TYPE_ORDER=["minion","minion","minion","minion","minion","minion","bomb","bomb","bomb","ally","ally","trap","trap","king"];
function mkSetup(roster,empties,front){ const cells=[]; for(const r of [11,12,13]) for(let c=1;c<=COLS;c++) if(!empties.has(r+"_"+c)&&!(front[0]===r&&front[1]===c)) cells.push([r,c]);
  if(cells.length!==13) throw new Error("setup cells "+cells.length); const pos={minion:[],bomb:[],ally:[],trap:[],king:[]}; let k=0;
  for(const t of TYPE_ORDER){ if(t==="minion"&&!pos.minion.length){ pos.minion.push(front); continue; } pos[t].push(cells[k++]); } return {roster,pos}; }
const WC1=2, WC2=6;
const SETUPS=[mkSetup(["M-G1","M-F3","M-W5","M-L2","M-G4","M-F1"],new Set(["11_6","12_6","13_6","11_5","11_7","12_5","12_7"]),[11,WC1]),   // P1: 열 6 주변 비움
              mkSetup(["M-W2","M-L5","M-F4","M-G3","M-W1","M-L3"],new Set(["11_2","12_2","13_2","11_1","11_3","12_1","12_3"]),[11,WC2])];  // P2: 열 2 주변 비움

/* ── 페이지 안 스크립트 ── */
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){}
  window.__errs=[]; window.addEventListener("error",e=>window.__errs.push(String(e.message))); const oe=console.error; console.error=function(){ window.__errs.push([...arguments].map(String).join(" ")); return oe.apply(console,arguments); };
  window.__sent=[]; const os=WebSocket.prototype.send; WebSocket.prototype.send=function(m){ try{ const j=JSON.parse(m); if(j&&j.t==="a") window.__sent.push(j.a); }catch(e){} return os.apply(this,arguments); }; // 관측만 — 내용·순서 무변경
  return S.phase; })()`;
const SET_CODE=code=>`(()=>{ document.getElementById("netCode").value=${JSON.stringify(code)}; return true; })()`;
const STATE=`(()=>({started:NET.started,phase:S.phase,cur:S.current,me:NET.me,turn:S.turnCount,main:S.mainUsed,battle:!!S.battle,forced:S.forcedTargets.slice(),actor:netActor(),
  overlay:!document.getElementById("overlay").classList.contains("hidden"),sync:NET.syncModal?{seq:NET.syncModal.seq,owner:NET.syncModal.owner}:null,queue:NET.queue.length,playing:MSGPLAYING,sel:S.selected?S.selected.id:null,flip:document.getElementById("board").dataset.flip,bt:isBurning()}))()`;
const CANON=`(()=>JSON.stringify({phase:S.phase,cur:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,forced:S.forcedTargets,tele:S.teleUsed,events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),reveal:[...S.tempReveal].sort(),
  battle:S.battle?[S.battle.attP.id,S.battle.defP.id,S.battle.round,S.battle.phase]:null,seq:NET.modalSeq,
  pieces:S.pieces.map(p=>({id:p.id,owner:p.owner,type:p.type,rosterId:p.rosterId,name:p.name,element:p.element,hp:p.hp,r:p.r,c:p.c,alive:p.alive,placed:p.placed,revealed:p.revealed,immobile:p.immobile,skills:p.skills}))}))()`;
const OWN_PIECES=`(()=>S.pieces.filter(x=>x.owner===0).map(x=>({id:x.id,type:x.type,rosterId:x.rosterId,name:x.name,r:x.r,c:x.c,placed:x.placed})))()`;
const SENT=`(()=>window.__sent.slice(-1)[0]||null)()`;
const SENT_N=`(()=>window.__sent.length)()`;
/* 픽셀 그리드 + 91칸 전수 대조. ref = 상대 탭의 CANON JSON 문자열 (없으면 자기 S) */
const PX_AUDIT=(refJson)=>`(()=>{ const ref=${refJson?JSON.stringify(refJson):"null"}?JSON.parse(${JSON.stringify(refJson||"null")}):null;
  const me=NET.me, viewer=(S.phase==="over")?2:me, flip=NET.mode&&me===1;
  const cells=[...document.querySelectorAll("#board .cell")]; if(cells.length!==91) return {bad:"cells "+cells.length};
  const rects=cells.map(el=>{ const r=el.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; });
  const ys=[...new Set(rects.map(r=>r.y))].sort((a,b)=>a-b), xs=[...new Set(rects.map(r=>r.x))].sort((a,b)=>a-b);
  if(ys.length!==13||xs.length!==7) return {bad:"grid "+ys.length+"x"+xs.length};
  if(document.getElementById("board").dataset.flip!==(flip?"1":"0")) return {bad:"flip attr "+document.getElementById("board").dataset.flip};
  const P=ref?ref.pieces:S.pieces.map(p=>({id:p.id,owner:p.owner,type:p.type,rosterId:p.rosterId,r:p.r,c:p.c,alive:p.alive,placed:p.placed,revealed:p.revealed}));
  const reveal=ref?ref.reveal:[...S.tempReveal];
  const alive=P.filter(p=>p.alive&&p.placed); const inF=r=>(r>=4&&r<=5)||(r>=9&&r<=10);
  const vis=p=>viewer===2||p.owner===viewer||!inF(p.r)||reveal.includes(p.id)||alive.some(m=>m.owner===viewer&&Math.abs(m.r-p.r)+Math.abs(m.c-p.c)===1);
  const arch=Object.fromEntries(ROSTER.map(r=>[r.id,r.element+"_"+r.arch]));
  const hyp={reflect:0,rotate:0,identity:0}; let efp=0, minKnown=0, imgLoaded=0; const grid={};
  for(let i=0;i<cells.length;i++){ const el=cells[i], sRow=ys.indexOf(rects[i].y)+1, sCol=xs.indexOf(rects[i].x)+1, r=+el.dataset.r, c=+el.dataset.c;
    grid[r+"_"+c]={x:rects[i].x,y:rects[i].y,sRow,sCol};
    const ex={reflect:me===1?[14-r,c]:[r,c],rotate:me===1?[14-r,8-c]:[r,c],identity:[r,c]};
    for(const h in ex) if(ex[h][0]===sRow&&ex[h][1]===sCol) hyp[h]++;
    if(ex.reflect[0]!==sRow||ex.reflect[1]!==sCol) return {bad:"pixel screen("+sRow+","+sCol+") holds logical ("+r+","+c+") expected reflect ("+ex.reflect+")",hyp};
    const hit=document.elementFromPoint(rects[i].x,rects[i].y); if(hit&&(hit===el||el.contains(hit))) efp++; else if(i===0) hyp.efpSample=hit?hit.tagName+"#"+hit.id+"."+hit.className:"null";
    const zone=r<=3?"zA":r<=5?"forest":r<=8?"":r<=10?"forest":"zB"; if(zone&&!el.classList.contains(zone)) return {bad:"zone class ("+r+","+c+")",hyp};
    const p=alive.find(q=>q.r===r&&q.c===c)||null, chip=el.querySelector(".pc"), v=!!p&&vis(p);
    if(!!chip!==v) return {bad:"chip "+(chip?"present":"missing")+" at screen("+sRow+","+sCol+") logical ("+r+","+c+") piece="+(p?p.id+"/P"+(p.owner+1):"-"),hyp};
    if(chip){ const known=viewer===2||p.owner===viewer||p.revealed;
      if(!chip.classList.contains("p"+p.owner)) return {bad:"owner class ("+r+","+c+")",hyp};
      if((p.owner===viewer)!==chip.classList.contains("own")) return {bad:"own class ("+r+","+c+")",hyp};
      if(known===chip.classList.contains("hiddenId")) return {bad:"known/hiddenId ("+r+","+c+")",hyp};
      if(known&&p.type==="minion"&&p.rosterId){ minKnown++; const img=chip.querySelector("img"); if(img&&!img.getAttribute("src").includes("/"+arch[p.rosterId]+"/")) return {bad:"art ("+r+","+c+") "+img.getAttribute("src"),hyp};
        if(img&&img.complete&&img.naturalWidth>0) imgLoaded++; } } } // 경로 검사와 별개로 실제 로드 성공(디코딩된 픽셀 폭>0)을 센다 — img 가 없으면(폴백 렌더) 로드 실패로 집계된다
  return {bad:null,hyp,efp,minKnown,imgLoaded,grid,flip:flip?1:0,viewer,ys,xs}; })()`;
const RECT=sel=>`(()=>{ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; el.scrollIntoView({block:"center"}); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,disabled:!!el.disabled,vis:r.top>=0&&r.bottom<=innerHeight}; })()`;
const GRID=`(()=>{ const cells=[...document.querySelectorAll("#board .cell")]; if(cells.length!==91) return null; const rects=cells.map(el=>{ const r=el.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; });
  const ys=[...new Set(rects.map(r=>r.y))].sort((a,b)=>a-b), xs=[...new Set(rects.map(r=>r.x))].sort((a,b)=>a-b); return ys.length===13&&xs.length===7?{ys,xs}:null; })()`; // dataset·DOM 순서 무관: 픽셀만으로 화면 격자
const PIECE=id=>`(()=>{ const p=S.pieces.find(x=>x.id===${id}); return p?{id:p.id,r:p.r,c:p.c,alive:p.alive,reveal:S.tempReveal.has(p.id)}:null; })()`;
const FIND=(owner,r,c)=>`(()=>{ const p=S.pieces.find(x=>x.owner===${owner}&&x.type==="minion"&&x.r===${r}&&x.c===${c}&&x.alive&&x.placed); return p?p.id:null; })()`;
const HL=`(()=>{ const out={sel:[],move:[]}; for(const el of document.querySelectorAll("#board .cell")){ const r=el.getBoundingClientRect(); const k=[Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)]; if(el.classList.contains("hl-sel")) out.sel.push(k); if(el.classList.contains("hl-move")) out.move.push(k); } return out; })()`;
const BTN_TEXT=sel=>`(()=>[...document.querySelectorAll(${JSON.stringify(sel)})].map(b=>[b.textContent.trim(),b.disabled]))()`;

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const report=[]; let bad=0; const shots=[]; const extra={};
  const note=(what,r)=>{ report.push({what,...r}); if(r.error||r.ok===false) bad++; console.log((r.ok===false||r.error?"FAIL ":"ok   ")+what+(r.detail?" — "+r.detail:"")+(r.error?" — "+r.error:"")); };
  let server=null, chrome=null; let served=0;
  try{
    server=await startServer();
    console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port} (접속 코드는 출력하지 않는다) · index.html 본문=git:${REF} sha256=${SRC_SHA.slice(0,16)}… (메모리 주입)`);
    chrome=await launch();
    console.log(`RESOURCE chrome pid=${chrome.proc.pid} profile=${chrome.udd}`);
    const cdp=await connect(chrome.ws);
    const tab=async url=>{ const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
      const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
      await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.width,height:VP.height,deviceScaleFactor:1,mobile:false},sid);
      // /index.html 만 고정 ref 본문으로 대체 (같은 출처 유지) — 그 외(아트·ws)는 서버 그대로
      const t={sid,targetId,name:"",
        ev:async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("page: "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails)); return r.result.value; },
        nav:async u=>{ if(INJECT){ // 같은 출처의 빈 URL(서버 404 텍스트)로 간 뒤 문서 본문만 고정 ref 로 바꿔 넣는다 — 네트워크 가로채기 없음 (CDP Fetch 주입은 이후 WebSocket 핸드셰이크를 깨뜨렸다: 실측)
            const blank=u.replace(/\/index\.html$/,"/qa-orientation-blank"); const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url:blank},sid); await loaded;
            const {frameTree}=await cdp.send("Page.getFrameTree",{},sid); await cdp.send("Page.setDocumentContent",{frameId:frameTree.frame.id,html:SRC.toString("utf8")},sid); served++; await sleep(600); }
          else { const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url:u},sid); await loaded; }
          await sleep(300); await t.ev(PREP); },
        clickXY:async(x,y)=>{ for(const type of ["mousePressed","mouseReleased"]) await cdp.send("Input.dispatchMouseEvent",{type,x,y,button:"left",clickCount:1},sid); await sleep(90); },
        click:async sel=>{ const p=await t.ev(RECT(sel)); if(!p) throw new Error("클릭 대상 없음 "+sel); await t.clickXY(p.x,p.y); await t.ev("(()=>{ window.scrollTo(0,0); return true; })()"); return p; },
        shot:async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
          const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); const rel=path.relative(ROOT,f).replace(/\\/g,"/"); shots.push(rel); console.log("SHOT "+rel); }};
      await t.nav(url); return t; };
    const until=async(fn,ms,label)=>{ const t0=Date.now(); for(;;){ const v=await fn(); if(v) return v; if(Date.now()-t0>ms) throw new Error("대기 시간 초과: "+label); await sleep(120); } };
    const same=async(A,B)=>(await A.ev(CANON))===(await B.ev(CANON));
    const settled=async(A,B,label)=>until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.queue===0&&b.queue===0&&!a.playing&&!b.playing&&(await same(A,B)); },8000,label);
    const cellSel=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;

    const URL=`http://127.0.0.1:${server.port}/index.html`;
    const A=await tab(URL), B=await tab(URL); A.name="A"; B.name="B";
    const srcOk=await A.ev(`(()=>document.documentElement.outerHTML.includes("#104: 상대 말 분기는 행위자(S.current)"))()`);
    note(`0 두 탭이 고정 ref(git:${REF}) 본문을 받았다 (setDocumentContent 주입 ${served}회 · #104 주석 존재 · 출처=${await A.ev("location.origin")})`,{ok:served>=2&&srcOk,detail:`served=${served}`});

    /* ── 1. 자연 배치 (실제 클릭) + 배치 단계 픽셀 위치 기록 ── */
    const placedPx=[];
    for(const [i,T] of [A,B].entries()){
      await T.ev(SET_CODE(server.code)); await T.click('button[onclick="netPrepare()"]'); await sleep(150);
      for(const rid of SETUPS[i].roster){ await T.click(`.rosterCard[onclick="rosterInfo('${rid}')"]`); await sleep(100); await T.click('#obBtns button:first-child'); await sleep(100); }
      const used={}; let own=await T.ev(OWN_PIECES); const px=[];
      for(const p of own){ const k=used[p.type]=(used[p.type]||0); used[p.type]++; const [r,c]=SETUPS[i].pos[p.type][k];
        await T.click(`.trayItem[onclick="selTray(${p.id})"]`); await T.click(cellSel(r,c)); const q=await T.ev(`(()=>{ const el=document.querySelector(${JSON.stringify(cellSel(r,c))}); const b=el.getBoundingClientRect(); return {x:Math.round(b.left+b.width/2),y:Math.round(b.top+b.height/2)}; })()`); px.push({type:p.type,localR:r,localC:c,x:q.x,y:q.y}); }
      placedPx.push(px);
      const st=await T.ev(`(()=>({placed:S.pieces.filter(x=>x.owner===0&&x.placed).length,roster:S.roster[0].slice(),flip:document.getElementById("board").dataset.flip}))()`);
      note(`1${"ab"[i]} 탭${T.name}: 로스터 카드 클릭 6종 · 트레이→칸 클릭 14개 (배치 단계 flip=${st.flip})`,{ok:st.placed===14&&st.roster.join()===SETUPS[i].roster.join()&&st.flip==="0",detail:`placed=${st.placed}`});
      const bq=await T.click('#sidePanel button.primary'); await sleep(250);
      const q=await T.ev(`(()=>({queued:NET.queued,phase:S.phase,toasts:[...document.querySelectorAll("#toasts .toast")].map(t=>t.textContent),btn:(document.querySelector("#sidePanel button.primary")||{}).outerHTML,overlay:!document.getElementById("overlay").classList.contains("hidden"),box:document.getElementById("overlayBox").innerHTML.slice(0,160)}))()`);
      if(!q.queued) console.log(`DIAG setupDone 탭${T.name}: btn=${JSON.stringify(bq)} ${JSON.stringify(q)}`);
    }
    const DIAG=`(()=>({queued:NET.queued,preparing:NET.preparing,started:NET.started,me:NET.me,ws:NET.ws?{rs:NET.ws.readyState,url:NET.ws.url,proto:NET.ws.protocol}:null,status:(document.getElementById("netStatus")||{}).textContent,errs:window.__errs,sent:window.__sent.length,phase:S.phase,href:location.href}))()`;
    try{ await until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"온라인 매칭·시작"); }
    catch(e){ console.log("DIAG A "+JSON.stringify(await A.ev(DIAG))); console.log("DIAG B "+JSON.stringify(await B.ev(DIAG))); throw e; }
    await settled(A,B,"시작 직후 정착");
    const sa=await A.ev(STATE), sb=await B.ev(STATE);
    const P1=sa.me===0?A:B, P2=P1===A?B:A; const px1=placedPx[P1===A?0:1], px2=placedPx[P2===A?0:1];
    note("1c 실제 서버 매칭 — A/B 가 P1·P2 로 갈렸다",{ok:sa.me!==sb.me&&[sa.me,sb.me].sort().join()==="0,1",detail:`A me=${sa.me} B me=${sb.me} 선공 P${sa.cur+1}`});

    /* ── 2. 시작 직후: 양 탭 픽셀 91칸 전수 (상대 S 기준) · 가설 판별 · 배치 보존(픽셀) ── */
    const audit=async(T,O,label)=>{ const ref=await O.ev(CANON); const a=await T.ev(PX_AUDIT(ref)); note(label,{ok:a.bad===null,detail:a.bad||`hyp=${JSON.stringify(a.hyp)} elementFromPoint=${a.efp}/91 flip=${a.flip}`}); return a; };
    const a2=await audit(P1,P2,"2a P1 탭 픽셀 91칸 ↔ 독자 변환(항등) ↔ P2 탭 S"), b2=await audit(P2,P1,"2b P2 탭 픽셀 91칸 ↔ 독자 변환(행 반사) ↔ P1 탭 S");
    note("2c 가설 판별: P2 화면 = 행 반사 91/91 · 180° 회전은 중앙열 13칸만 · 항등은 7행 7칸만",{ok:!!b2.hyp&&b2.hyp.reflect===91&&b2.hyp.rotate===13&&b2.hyp.identity===7&&a2.hyp&&a2.hyp.identity===91,detail:JSON.stringify([a2.hyp,b2.hyp])});
    note("2d elementFromPoint(칸 중심) 이 그 칸을 돌려준다 (양 탭 91/91)",{ok:a2.efp===91&&b2.efp===91,detail:`${a2.efp},${b2.efp}`});
    extra.grid={P1:a2.ys&&{ys:a2.ys,xs:a2.xs},P2:b2.ys&&{ys:b2.ys,xs:b2.xs}};
    // 배치 보존: 배치 단계에 클릭한 픽셀 == 시작 후 자기 화면에서 그 말이 있는 칸의 픽셀 (P2 는 논리 14−r 로 미러됐지만 화면은 그대로)
    for(const [m,T,px,g] of [[0,P1,px1,a2.grid],[1,P2,px2,b2.grid]]){ const mine=await T.ev(`(()=>S.pieces.filter(x=>x.owner===${m}).map(x=>({type:x.type,r:x.r,c:x.c})))()`); let same=0;
      mine.forEach((p,j)=>{ const q=px[j]; const gg=g&&g[p.r+"_"+p.c]; if(gg&&q&&q.type===p.type&&gg.x===q.x&&gg.y===q.y) same++; });
      note(`2e P${m+1} 배치 단계에 클릭한 픽셀 자리 14개 = 시작 후 자기 화면의 그 말 픽셀 자리 (배치 보존)`,{ok:same===14,detail:`same=${same}`}); }
    await P2.shot("http_desktop-1280_1-p2-start");

    /* ── 3. 픽셀 클릭 → 페이로드 관측 → 상대 재생 (횡단) ── */
    const pxOf=async(T,me,r,c)=>{ const g=await T.ev(GRID); if(!g) return null; const sRow=me===1?14-r:r, sCol=c; // 독자 변환으로 화면 좌표 → 지금 픽셀 격자(정렬된 중심 y/x)에서 좌표 (dataset·DOM 순서 미사용)
      return {x:g.xs[sCol-1],y:g.ys[sRow-1],sRow,sCol}; };
    const actorTab=async()=>{ const s=await P1.ev(STATE); return s.actor===0?P1:P2; };
    const stepBad=[]; let clicks=0, payloadMismatch=0;
    let audits=0, efpAudits=0; // 매 step 뒤 실제 수행된 양 탭 픽셀 대조 수 · 그중 elementFromPoint 91/91 도 통과한 수
    const afterEach=async label=>{ await settled(P1,P2,label); const a=await P1.ev(PX_AUDIT(await P2.ev(CANON))), b=await P2.ev(PX_AUDIT(await P1.ev(CANON))); audits++;
      if(a.bad||b.bad) stepBad.push(`${label}: P1=${a.bad} P2=${b.bad}`);
      else if(a.efp!==91||b.efp!==91) stepBad.push(`${label}: elementFromPoint P1=${a.efp}/91 P2=${b.efp}/91`); else efpAudits++; };
    const passTurn=async()=>{ const T=await actorTab(); const s=await T.ev(STATE); if(!s.main) await T.click('#turnBar button:first-child'); await sleep(60); await T.click('#turnBar button.primary'); await afterEach(`turn ${s.turn+1} pass`); };
    const clickCell=async(T,me,r,c,label)=>{ const p=await pxOf(T,me,r,c); if(!p) throw new Error("pixel for "+r+","+c); const n0=await T.ev(SENT_N); await T.clickXY(p.x,p.y); clicks++;
      await until(async()=>(await T.ev(SENT_N))>n0,3000,"payload "+label); const sent=await T.ev(SENT);
      if(!(sent&&sent.t==="cell"&&sent.r===r&&sent.c===c)){ payloadMismatch++; stepBad.push(`${label}: pixel(${p.x},${p.y}) screen(${p.sRow},${p.sCol}) sent ${JSON.stringify(sent)} expected cell(${r},${c})`); } return p; };
    const moveTo=async(me,id,r,c,label)=>{ const T=me===0?P1:P2; let n=0; while(n++<6){ const s=await T.ev(STATE); if(s.actor===me&&!s.main&&!s.battle&&!s.forced.length) break; await passTurn(); }
      const b=await T.ev(PIECE(id)); await clickCell(T,me,b.r,b.c,label+" sel"); await settled(P1,P2,label+" sel");
      const h=await T.ev(HL); const pFrom=await pxOf(T,me,b.r,b.c), pTo=await pxOf(T,me,r,c);
      const selOk=h.sel.length===1&&h.sel[0][0]===pFrom.x&&h.sel[0][1]===pFrom.y, mvOk=h.move.some(k=>k[0]===pTo.x&&k[1]===pTo.y);
      const fwd=me===0?b.r-r:r-b.r; const dirOk=fwd===0||(fwd>0?pTo.y<pFrom.y:pTo.y>pFrom.y);
      if(!selOk||!mvOk||!dirOk) stepBad.push(`${label}: hl sel=${selOk} move=${mvOk} dir=${dirOk} (fwd ${fwd}: from y=${pFrom.y} to y=${pTo.y})`);
      const hO=await (me===0?P2:P1).ev(HL); if(hO.sel.length||hO.move.length) stepBad.push(`${label}: opponent screen shows highlights`);
      await clickCell(T,me,r,c,label+" mv"); await afterEach(label+" mv");
      const a1=await P1.ev(PIECE(id)), a2_=await P2.ev(PIECE(id)); if(!(a1.r===r&&a1.c===c&&a2_.r===r&&a2_.c===c)) stepBad.push(`${label}: after move P1=(${a1.r},${a1.c}) P2=(${a2_.r},${a2_.c}) expected (${r},${c})`);
      const st=await T.ev(STATE); if(!st.battle&&!st.forced.length){ await T.click('#turnBar button.primary'); await afterEach(label+" end"); } };
    const w1=await P1.ev(FIND(0,11,WC1)), w2=await P2.ev(FIND(1,3,WC2));
    note("3a 횡단 말 존재: P1 (11,2) · P2 (3,6)",{ok:!!w1&&!!w2});
    const n0=stepBad.length;
    for(let i=1;i<=3;i++){ await moveTo(0,w1,11-i,WC1,`3 pre P1 →${11-i}`); await moveTo(1,w2,3+i,WC2,`3 pre P2 →${3+i}`); }
    await moveTo(0,w1,8,WC1+1,"3 pre P1 lateral"); await moveTo(1,w2,6,WC2-1,"3 pre P2 lateral");
    await moveTo(0,w1,9,WC1+1,"3 pre P1 back");    await moveTo(1,w2,5,WC2-1,"3 pre P2 back");
    await moveTo(0,w1,8,WC1+1,"3 pre P1 fwd-again"); await moveTo(1,w2,6,WC2-1,"3 pre P2 fwd-again");
    await moveTo(0,w1,8,WC1,"3 pre P1 lateral-back");  await moveTo(1,w2,6,WC2,"3 pre P2 lateral-back");
    note("3b BT 이전 실제 픽셀 클릭(전진 3·측면·후진·전진·측면 복귀) — 매 클릭 페이로드·강조·양 탭 S·91칸 픽셀 대조",{ok:stepBad.length===n0,detail:stepBad.slice(n0).join(" | ").slice(0,600)||`clicks=${clicks}`});
    const n0b=stepBad.length;
    for(let r=7;r>=2;r--){ await moveTo(0,w1,r,WC1,`3 PRE65 cross P1 →${r}`); await moveTo(1,w2,14-r,WC2,`3 PRE65 cross P2 →${14-r}`); }
    const p1c=await P1.ev(PIECE(w1)), p2c=await P2.ev(PIECE(w2)), s3=await P1.ev(STATE);
    note("3c **65턴 이전** 중앙 7행·양쪽 숲 횡단 → P1 (2,2) · P2 (12,6) — 매 클릭 페이로드·강조·양 탭 S·91칸 픽셀 대조",{ok:stepBad.length===n0b&&p1c.r===2&&p1c.c===WC1&&p2c.r===12&&p2c.c===WC2&&s3.turn<64&&!s3.bt,detail:`P1=(${p1c.r},${p1c.c}) P2=(${p2c.r},${p2c.c}) turn=${s3.turn+1} bt=${s3.bt} ${stepBad.slice(n0b).join(" | ").slice(0,600)}`});
    await P2.shot("http_desktop-1280_2-p2-pre65-after-crossing");

    /* ── 4. 실제 버튼으로 65턴 → 2칸 후·전 → 중앙 횡단 → 2행/12행 ── */
    const n1=stepBad.length;
    while((await P1.ev(STATE)).turn<64) await passTurn();
    const s4=await P1.ev(STATE); note("4a 65턴 BT 진입 (실제 턴 버튼) — 매 교대 뒤 양 탭 91칸 픽셀 대조",{ok:s4.bt&&stepBad.length===n1,detail:`turn=${s4.turn+1} ${stepBad.slice(n1).join(" | ").slice(0,300)}`});
    const n2=stepBad.length;
    // 두 번째 하수인: P1 11행·P2 3행에서 상대 횡단 열과 2열 이상 떨어진 열 (서로도 2열 이상) — 자연 배치에서 자동 선택
    const c1=await P1.ev(`(()=>S.pieces.filter(x=>x.owner===0&&x.type==="minion"&&x.alive&&x.placed&&x.r===11&&x.c!==${WC1}&&Math.abs(x.c-${WC2})>=2).map(x=>({id:x.id,c:x.c})))()`);
    const c2=await P2.ev(`(()=>S.pieces.filter(x=>x.owner===1&&x.type==="minion"&&x.alive&&x.placed&&x.r===3&&x.c!==${WC2}&&Math.abs(x.c-${WC1})>=2).map(x=>({id:x.id,c:x.c})))()`);
    let s1=null,s2=null; for(const a of c1){ for(const b of c2) if(Math.abs(a.c-b.c)>=2){ s1=a; s2=b; break; } if(s1) break; }
    note("4b 65턴 이후용 두 번째 하수인 선택",{ok:!!(s1&&s2),detail:`P1 (11,${s1&&s1.c}) P2 (3,${s2&&s2.c})`});
    if(s1&&s2){ const x=s1.c, y=s2.c;
      await moveTo(0,s1.id,10,x,"4 post65 P1 fwd");  await moveTo(1,s2.id,4,y,"4 post65 P2 fwd");
      await moveTo(0,s1.id,8,x,"4 post65 P1 fwd2");  await moveTo(1,s2.id,6,y,"4 post65 P2 fwd2");
      await moveTo(0,s1.id,10,x,"4 post65 P1 back2"); await moveTo(1,s2.id,4,y,"4 post65 P2 back2");
      await moveTo(0,s1.id,8,x,"4 post65 P1 fwd2b"); await moveTo(1,s2.id,6,y,"4 post65 P2 fwd2b");
      for(const r of [7,6,5]){ await moveTo(0,s1.id,r,x,`4 post65 cross P1 →${r}`); await moveTo(1,s2.id,14-r,y,`4 post65 cross P2 →${14-r}`); }
      const f1=await P1.ev(PIECE(s1.id)), f2=await P2.ev(PIECE(s2.id));
      note("4c 65턴 이후 BT 2칸 전·후·전 + 중앙 횡단 → P1 (5,x) · P2 (9,y) — 매 클릭 페이로드·강조·S·91칸",{ok:stepBad.length===n2&&f1.r===5&&f1.c===x&&f2.r===9&&f2.c===y,detail:`P1=(${f1.r},${f1.c}) P2=(${f2.r},${f2.c}) ${stepBad.slice(n2).join(" | ").slice(0,600)}`}); }
    const fl=[await P1.ev(STATE),await P2.ev(STATE)];
    note("4d 횡단·BT·턴 교대 내내 flip 불변 (P1=0 · P2=1) · 페이로드 불일치 0 · 매 step 뒤 양 탭 91칸 픽셀 대조 + elementFromPoint 91/91 실제 수행",{ok:fl[0].flip==="0"&&fl[1].flip==="1"&&payloadMismatch===0&&audits>0&&efpAudits===audits,detail:`clicks=${clicks} mismatch=${payloadMismatch} stepAudits=${audits} efp91=${efpAudits}`});
    await P2.shot("http_desktop-1280_3-p2-after-crossing"); await P1.shot("http_desktop-1280_4-p1-after-crossing");

    /* ── 5. 기권 → 종료 화면 (전체 공개, flip 유지) ── */
    const T5=await actorTab(); await T5.click('#turnBar button.danger'); await sleep(150); await T5.click('#obBtns button:first-child'); await settled(P1,P2,"기권 정착");
    const o1=await P1.ev(PX_AUDIT(await P2.ev(CANON))), o2=await P2.ev(PX_AUDIT(await P1.ev(CANON)));
    const so=[await P1.ev(STATE),await P2.ev(STATE)];
    note("5 기권 → 양 탭 over · 종료 화면 91칸 픽셀 대조(전체 공개) · P2 는 여전히 행 반사",{ok:so[0].phase==="over"&&so[1].phase==="over"&&!o1.bad&&!o2.bad&&o2.flip===1&&o1.flip===0,detail:o1.bad||o2.bad||`viewer=${o1.viewer},${o2.viewer}`});
    const e1=await P1.ev(`(()=>window.__errs)()`), e2=await P2.ev(`(()=>window.__errs)()`);
    note("6 콘솔 오류 0 (두 탭)",{ok:e1.length===0&&e2.length===0,detail:JSON.stringify(e1.concat(e2)).slice(0,300)});
    note("7 아트 실제 로드 성공: 종료 화면(전체 공개)의 공개 하수인 칩 img 가 전부 디코딩됨 (complete·naturalWidth>0) — 경로 검사가 아닌 로드 검사",{ok:!o1.bad&&!o2.bad&&o1.minKnown>0&&o2.minKnown>0&&o1.imgLoaded===o1.minKnown&&o2.imgLoaded===o2.minKnown,detail:`P1 ${o1.imgLoaded}/${o1.minKnown} · P2 ${o2.imgLoaded}/${o2.minKnown} (시작 직후: P1 ${a2.imgLoaded}/${a2.minKnown} · P2 ${b2.imgLoaded}/${b2.minKnown})`});
    extra.stepBad=stepBad; extra.clicks=clicks; extra.stepAudits=audits; extra.efpAudits=efpAudits;
    for(const t of [A,B]) try{ await cdp.send("Target.closeTarget",{targetId:t.targetId}); }catch(e){}
  }catch(e){ note("실행",{error:e.message}); }
  finally{
    if(chrome){ try{ chrome.proc.kill(); }catch(e){} await sleep(300); try{ fs.rmSync(chrome.udd,{recursive:true,force:true}); console.log("CLEANUP profile="+chrome.udd); }catch(e){} }
    if(server){ try{ server.proc.kill(); }catch(e){} }
  }
  const summary={source:"git:"+REF,sha256:SRC_SHA,viewport:VP,date:new Date().toISOString(),readOnly:READ_ONLY,pass:report.filter(r=>r.ok!==false&&!r.error).length,fail:bad,shots,report,extra};
  if(!READ_ONLY){ const f=path.join(OUT,"orientation_audit_cdp_report.json"); fs.writeFileSync(f,JSON.stringify(summary,null,2)); console.log("REPORT "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  console.log(`\n=== orientation_audit_cdp [git:${REF}]: pass ${summary.pass} / fail ${summary.fail}${READ_ONLY?" (read-only · 산출물 0)":""} ===`);
  if(summary.fail) console.log(report.filter(r=>r.ok===false||r.error).map(r=>"  - "+r.what+(r.detail?" — "+r.detail:"")+(r.error?" — "+r.error:"")).join("\n"));
  process.exit(report.some(r=>r.error)?3:bad?1:0);
})();
