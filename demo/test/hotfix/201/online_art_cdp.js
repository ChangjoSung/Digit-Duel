/* #201 (v0.4.8) 온라인 아트 손실 — 실제 브라우저 증빙
 * 사용: node demo/test/hotfix/201/online_art_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--no-shots]
 *
 * 무엇을 실제로 하는가 (헤드리스 하네스가 흉내 낼 수 없는 것만)
 *   1. 내가 띄운 server/server.js 를 루프백 임의 포트로 기동한다 (사용자의 서버를 건드리지 않는다).
 *      접속 코드는 이 실행에서만 쓰는 값을 주입한다 — 산출물 어디에도 적지 않는다.
 *   2. 내가 띄운 헤드리스 Chrome 임시 프로필에서 **독립된 두 탭**(P1·P2)을 냉시작으로 연다.
 *   3. 두 탭이 실제 로비 입력칸·버튼 클릭으로 온라인 매칭에 들어가고, 실제 인증(하위 프로토콜)으로
 *      연결돼 로스터 선택·배치를 거쳐 보드까지 간다. 그 뒤 실제 합법 수를 주고받는다.
 *   4. 자산 요청·응답을 전부 기록한다 (URL·상태·캐시 여부). no-store 로 같은 자산이 렌더마다
 *      다시 요청되는지도 이 기록으로 센다.
 *   5. 유도 실패(모의 429)를 넣어 현행 소스가 복구하는지, 기준판 소스(인메모리 오버레이)가
 *      복구하지 못하는지를 같은 조건에서 대조한다. 유도한 429 는 기록에 induced=true 로 구분한다.
 *
 * 산출물: --out 아래 스크린샷과 report.json. --no-shots 로 스크린샷을 끌 수 있다.
 * 정리: 내가 띄운 서버 PID·Chrome PID·내가 만든 정확한 임시 프로필 경로만 종료 시 정리한다.
 * 의존: Node 22+(내장 WebSocket) + 로컬 Chrome + server/node_modules(ws). 종료 코드 1 = 판정 실패, 2 = 환경 오류.
 */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto"), {spawn,execFileSync}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","hotfix","201","Mars","artifacts")));
const SHOTS=!args.includes("--no-shots");
const BASE_REF="ff6e87a0c028ae39725d5bb5971052a84410f328"; // #201 수정 직전 출시본
const CHROME=opt("--chrome",[process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }

let pass=0,fail=0; const fails=[]; const report={issue:201,startedAt:new Date().toISOString(),checks:[],data:{}};
function ok(cond,name){ if(cond){pass++;console.log("PASS "+name);} else {fail++;fails.push(name);console.error("FAIL "+name);} report.checks.push({name,pass:!!cond}); }
const rec=(k,v)=>{ report.data[k]=v; };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha256=f=>crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");

/* ===== 내가 띄우는 릴레이 서버 ===== */
const OWNED={server:null,chrome:null,udd:null};
function startServer(){
  const code="dd"+crypto.randomBytes(12).toString("hex"); // 이 실행 전용 · 산출물에 쓰지 않는다
  return new Promise((res,rej)=>{
    const p=spawn(process.execPath,[path.join(ROOT,"server","server.js")],
      {cwd:path.join(ROOT,"server"),env:Object.assign({},process.env,{PORT:"0",DD_ACCESS_CODE:code}),stdio:["ignore","pipe","pipe"]});
    OWNED.server=p;
    let buf="",err="";
    const t=setTimeout(()=>rej(new Error("서버 기동 대기 시간 초과\n"+buf+err)),20000);
    p.stdout.on("data",d=>{ buf+=d;
      const m=buf.match(/접속 주소: (http:\/\/127\.0\.0\.1:(\d+))/);
      if(m){ clearTimeout(t); res({origin:m[1],port:Number(m[2]),code,log:buf}); } });
    p.stderr.on("data",d=>{err+=d;});
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("서버 종료 "+c+"\n"+buf+err)); });
  });
}

/* ===== 내가 띄우는 헤드리스 Chrome ===== */
function launchChrome(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i201cdp-")); OWNED.udd=udd;
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run",
      "--no-default-browser-check","--disable-gpu","--hide-scrollbars","--lang=ko-KR",
      "--disable-background-timer-throttling","--disable-renderer-backgrounding","about:blank"],{stdio:["ignore","pipe","pipe"]});
    OWNED.chrome=p;
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.handlers=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id);
        if(m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result); return; }
      if(m.method) for(const h of this.handlers) try{ h(m); }catch(e){} }; }
  on(fn){ this.handlers.push(fn); }
  send(method,params,sessionId){ const id=++this.id;
    return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
}

/* ===== 탭 하나 = 독립 클라이언트 ===== */
class Client{
  constructor(cdp,sessionId,label){ this.cdp=cdp; this.sid=sessionId; this.label=label;
    this.net=[];          // {url,status,induced,fromCache,type}
    this.pendingInduced=new Map(); // url -> 남은 유도 응답 수 (같은 건을 Network 이벤트에서 또 세지 않게 한다)
    this.intercepts=[];   // {match:fn, action:"429"|"body", body?, once?, used:0}
  }
  ev(expr){ return this.cdp.send("Runtime.evaluate",{expression:expr,awaitPromise:true,returnByValue:true},this.sid)
    .then(r=>{ if(r.exceptionDetails) throw new Error(this.label+" eval: "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)); return r.result.value; }); }
  async shot(name){ if(!SHOTS) return null;
    const r=await this.cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true},this.sid);
    fs.mkdirSync(OUT,{recursive:true});
    const f=path.join(OUT,name); fs.writeFileSync(f,Buffer.from(r.data,"base64")); return f; }
  /* 실제 클릭 — 보이는 글자로 요소를 찾아 누른다 */
  async clickText(text,sel){
    const done=await this.ev(`(()=>{const t=${JSON.stringify(text)};
      const nodes=Array.from(document.querySelectorAll(${JSON.stringify(sel||"button,.rosterCard,.trayItem,[onclick]")}));
      const el=nodes.find(n=>!n.disabled&&(n.textContent||"").indexOf(t)>=0&&n.offsetParent!==null);
      if(!el) return false; el.click(); return true;})()`);
    if(!done) throw new Error(this.label+" 클릭 대상을 찾지 못함: "+text);
    await sleep(120); return true;
  }
  /* 화면 위 연출이 완전히 걷힐 때까지 기다린다 — CSS 를 건드리지 않고, 제품이 스스로 끝내게 둔다 */
  async settle(ms){
    const okNow=`(()=>{ try{
      const hid=id=>{const e=document.getElementById(id); return !e||e.classList.contains("hidden");};
      const toasts=document.getElementById("toasts");
      return (typeof fxLocked!=="function"||!fxLocked())&&hid("fxBanner")&&hid("overlay")&&hid("tutOverlay")
        &&(!toasts||toasts.children.length===0)&&(typeof MSGPLAYING==="undefined"||!MSGPLAYING);
    }catch(e){ return true; } })()`;
    const end=Date.now()+(ms||12000);
    while(Date.now()<end){ if(await this.ev(okNow)){ await sleep(450); if(await this.ev(okNow)) return true; } await sleep(200); }
    return false;
  }
  async waitFor(expr,ms){ const end=Date.now()+(ms||15000);
    while(Date.now()<end){ if(await this.ev(expr)) return true; await sleep(150); }
    return false; }
  assetReqs(){ return this.net.filter(x=>/\/assets\//.test(x.url)); }
  countOf(url){ return this.assetReqs().filter(x=>x.url.indexOf(url)>=0).length; }
}

async function attach(cdp,url,label,width,height){
  const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
  const {sessionId}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
  const C=new Client(cdp,sessionId,label);
  await cdp.send("Page.enable",{},sessionId);
  await cdp.send("Runtime.enable",{},sessionId);
  await cdp.send("Network.enable",{},sessionId);
  await cdp.send("Network.setCacheDisabled",{cacheDisabled:false},sessionId);
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:width||390,height:height||844,deviceScaleFactor:1,mobile:false},sessionId);
  await cdp.send("Fetch.enable",{patterns:[{urlPattern:"*",requestStage:"Request"}]},sessionId);
  cdp.on(async m=>{
    if(m.sessionId!==sessionId) return;
    if(m.method==="Network.responseReceived"){
      const r=m.params.response;
      const left=C.pendingInduced.get(r.url)||0;
      if(left>0){ C.pendingInduced.set(r.url,left-1); return; } // 이미 유도 건으로 기록했다 — 자연 실패로 두 번 세지 않는다
      C.net.push({url:r.url,status:r.status,fromCache:!!r.fromDiskCache,induced:false,type:m.params.type,at:Date.now()});
    }
    if(m.method==="Fetch.requestPaused"){
      const u=m.params.request.url, rid=m.params.requestId;
      const hit=C.intercepts.find(i=>i.match(u)&&(!i.once||i.used<i.once));
      try{
        if(!hit) return void await cdp.send("Fetch.continueRequest",{requestId:rid},sessionId);
        hit.used++;
        if(hit.action==="429"){
          C.net.push({url:u,status:429,fromCache:false,induced:true,type:"Image",at:Date.now()});
          C.pendingInduced.set(u,(C.pendingInduced.get(u)||0)+1);
          await cdp.send("Fetch.fulfillRequest",{requestId:rid,responseCode:429,
            responseHeaders:[{name:"Content-Type",value:"text/plain"},{name:"Retry-After",value:"1"}],
            body:Buffer.from("too many requests (induced by #201 test)").toString("base64")},sessionId);
        } else if(hit.action==="body"){
          C.net.push({url:u,status:200,fromCache:false,induced:true,type:"Document",at:Date.now()});
          C.pendingInduced.set(u,(C.pendingInduced.get(u)||0)+1);
          await cdp.send("Fetch.fulfillRequest",{requestId:rid,responseCode:200,
            responseHeaders:[{name:"Content-Type",value:"text/html; charset=utf-8"},{name:"Cache-Control",value:"no-store"}],
            body:Buffer.from(hit.body,"utf8").toString("base64")},sessionId);
        }
      }catch(e){ /* 이미 처리된 요청 */ }
    }
  });
  if(url){ await cdp.send("Page.navigate",{url},sessionId); }
  return C;
}

/* ===== 실제 온라인 매칭·배치 ===== */
async function enterOnline(C,origin,code){
  await C.waitFor(`document.readyState==="complete"&&typeof startMode==="function"`,20000);
  // #128 튜토리얼은 매 로드 1회 뜬다 — 실제 [건너뛰기] 버튼으로 닫는다
  if(await C.ev(`!document.getElementById("tutOverlay").classList.contains("hidden")`)) await C.clickText("건너뛰기");
  await C.ev(`UI.entered=true; render(); 1`);
  await C.waitFor(`document.getElementById("app").getAttribute("data-screen")==="lobby"`,10000);
  // 주소·코드는 실제 입력칸에 넣는다 (코드는 탭 메모리에만 남는다)
  await C.ev(`(()=>{const s=document.getElementById("netServer"),c=document.getElementById("netCode");
    s.value=${JSON.stringify(origin.replace("http://",""))}; c.value=${JSON.stringify(code)}; return 1;})()`);
  await C.clickText("온라인 PVP");                                   // 실제 버튼 클릭
  await C.waitFor(`NET.preparing===true`,8000);
  // 로스터 6종 — 실제 카드 클릭 → 팝업 [선택하기]
  const ids=await C.ev(`ROSTER.slice(0,6).map(r=>r.name)`);
  for(const nm of ids){ await C.clickText(nm,".rosterCard"); await C.clickText("선택하기"); }
  await C.waitFor(`S.roster[NET.preparing?0:0].length===6||S.roster[0].length===6`,8000);
  await C.clickText("비공개 배치");                                  // 배치 탭
  await C.clickText("무작위 배치");                                  // 실제 버튼
  await C.clickText("배치 완료 → 매칭 시작");                        // 실제 버튼 → 매칭 큐 + 접속
  return true;
}

/* ===== 본체 ===== */
(async()=>{
  let srv=null,br=null,cdp=null;
  try{
    fs.mkdirSync(OUT,{recursive:true});
    srv=await startServer();
    rec("server",{origin:srv.origin,root:(srv.log.match(/클라이언트: (.+)/)||[])[1]||null,note:"접속 코드는 이 실행 전용이며 산출물에 남기지 않는다"});
    console.log("서버: "+srv.origin);
    br=await launchChrome();
    const ws=new WebSocket(br.ws);
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    cdp=new CDP(ws);

    const srcSha=sha256(path.join(ROOT,"demo","index.html"));
    rec("source",{file:"demo/index.html",sha256:srcSha});

    /* ── 1. 냉시작 두 클라이언트 · 실제 매칭 · 보드까지 ───────────────── */
    const P1=await attach(cdp,srv.origin+"/index.html","P1");
    const P2=await attach(cdp,srv.origin+"/index.html","P2");
    await Promise.all([enterOnline(P1,srv.origin,srv.code),enterOnline(P2,srv.origin,srv.code)]);
    const started=await P1.waitFor(`NET.started===true&&S.phase==="play"`,30000)
               && await P2.waitFor(`NET.started===true&&S.phase==="play"`,30000);
    ok(started,"1A 두 클라이언트가 실제 인증·매칭을 거쳐 보드까지 갔다");
    const who=await Promise.all([P1.ev(`NET.me`),P2.ev(`NET.me`)]);
    ok(who[0]!==who[1]&&who.includes(0)&&who.includes(1),`1B 서로 다른 진영을 받았다 (P1=${who[0]} P2=${who[1]})`);

    /* 냉시작 프리로드 = 고정 44 집합, 실패 0 */
    for(const C of [P1,P2]){
      const a=C.assetReqs();
      const bad=a.filter(x=>x.status>=400&&!x.induced);
      const uniq=new Set(a.map(x=>x.url.replace(/^https?:\/\/[^/]+/,"")));
      const want=await C.ev('(()=>{const o=[];for(const d of ART_DIRS)for(const f of ["icon.png","battle.png"])o.push("/"+ART_BASE+d+"/"+f);'
        +'for(const d of LEADER_DIRS)for(const f of [LEADER_FILES.icon,LEADER_FILES.battle])o.push("/"+LEADER_BASE+d+"/"+f);return o;})()');
      const missing=want.filter(u=>!uniq.has(u));
      const extra=[...uniq].filter(u=>want.indexOf(u)<0);
      rec("cold."+C.label,{requests:a.length,unique:uniq.size,failed:bad.length,corpus:want.length,
        statuses:[...new Set(a.map(x=>x.status))],missing,extra,
        extraNote:"고정 44 집합 밖의 자산 요청 — 로스터 카드를 눌러 연 설명창 일러스트(portrait)다. 말의 정체와 무관하게 내가 누른 카드에서만 나간다."});
      ok(bad.length===0,`1C ${C.label} 냉시작에서 자연 발생한 자산 실패 0건 (관측 ${bad.length})`);
      ok(missing.length===0,`1D ${C.label} 고정 44 집합을 빠짐없이 요청했다 (누락 ${missing.length} · 그 밖 ${extra.length}건은 내가 누른 로스터 카드의 설명창 일러스트)`);
    }
    const art=await Promise.all([P1,P2].map(C=>C.ev(`(()=>{
      const chip=(r,c)=>{const e=document.querySelector('#board .cell[data-r="'+r+'"][data-c="'+c+'"]'); return e?e.innerHTML:"";};
      const mine=S.pieces.filter(x=>x.owner===NET.me&&x.alive&&x.placed);
      const k=mine.find(x=>x.type==="king"), a=mine.find(x=>x.type==="ally");
      const ms=mine.filter(x=>x.type==="minion");
      const foe=S.pieces.filter(x=>x.owner!==NET.me&&x.alive&&x.placed);
      const bd=document.getElementById("board").innerHTML;
      const foeCells=foe.map(x=>chip(x.r,x.c)).join("");
      return {me:NET.me,
        failed:Array.from(ART.failed), settled:Array.from(ART.settled||[]), loaded:Array.from(ART.loaded).length,
        kingArt:!!(k&&pcFaceHtml(k).indexOf("assets/leaders/king/icon64.png")>=0),
        allyArt:!!(a&&pcFaceHtml(a).indexOf("assets/leaders/companion/icon64.png")>=0),
        minionArt:ms.filter(x=>pcFaceHtml(x).indexOf("assets/minions/")>=0).length, minions:ms.length,
        foeHiddenQ:foe.filter(x=>!x.revealed).length,
        foeCellsHaveImg:foeCells.indexOf("<img")>=0,
        foeCellsHaveAsset:foeCells.indexOf("assets/")>=0,
        boardLeaderArt:bd.indexOf("assets/leaders/")>=0};
    })()`)));
    rec("board.art",art);
    for(let i=0;i<2;i++){
      const L=i?"P2":"P1", A=art[i];
      ok(A.failed.length===0,`2A ${L} 실패한 종 0건 (관측 ${JSON.stringify(A.failed)})`);
      ok(A.kingArt,`2B ${L} 왕이 실제 아트로 보인다`);
      ok(A.allyArt,`2C ${L} 동료가 실제 아트로 보인다`);
      ok(A.minions>0&&A.minionArt===A.minions,`2D ${L} 하수인 전원이 실제 아트로 보인다 (${A.minionArt}/${A.minions})`);
      ok(!A.foeCellsHaveImg&&!A.foeCellsHaveAsset,`2E ${L} 미공개 상대 말 칸에 <img>·자산 경로가 없다 (정상 은폐 ? 유지)`);
    }
    /* 촬영 — 파일 이름의 좌석은 **실제 NET.me** 를 따른다 (브라우저 탭 순서가 아니다) */
    const shots=[];
    for(const C of [P1,P2]){
      const seat=(await C.ev(`NET.me`))+1;
      const clean=await C.settle(12000);
      rec("settle.seatP"+seat,{overlaysCleared:clean,tab:C.label});
      ok(clean,`2F 좌석 P${seat} 촬영 전에 턴 배너·연출·토스트가 모두 걷혔다 (탭 ${C.label})`);
      shots.push(await C.shot(`201-0${seat}-online-board-seat-P${seat}.png`));
    }

    /* ── 2. no-store 가 렌더마다 재요청을 만드는가 ────────────────────── */
    const probeUrl="/assets/minions/"+(await P1.ev(`ART_DIRS[0]`))+"/icon.png";
    const before=P1.countOf(probeUrl);
    await P1.ev(`for(let i=0;i<12;i++) render(); 1`);
    await sleep(1200);
    const after=P1.countOf(probeUrl);
    rec("noStore",{url:probeUrl,before,after,delta:after-before,
      note:"12회 render() 뒤 같은 자산 URL 의 추가 HTTP 응답 수. 0 이면 브라우저가 재요청하지 않은 것이다."});
    ok(true,`3A no-store 재요청 측정 완료 (12 렌더 후 추가 응답 ${after-before}건) — 판정이 아니라 관측값`);

    /* ── 3. 실제 합법 수 주고받기 + 전투 화면 ─────────────────────────── */
    const mover=(await P1.ev(`NET.me===S.current`))?P1:P2;
    const moved=await mover.ev(`(()=>{
      const me=NET.me;
      const mine=S.pieces.filter(x=>x.owner===me&&x.alive&&x.placed&&x.type==="minion");
      for(const p of mine){ for(const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const r=p.r+dr,c=p.c+dc;
        if(canMoveTo&&canMoveTo(p,r,c)&&!at(r,c)){ onCell(p.r,p.c); onCell(r,c); return {id:p.id,r,c}; } } }
      return null; })()`);
    await sleep(1500);
    /* 정본 상태 대조 — 턴 번호뿐 아니라 **모든 말의 논리 좌표·HP·생존**까지 두 클라이언트가 같아야 한다.
       P2 화면은 행이 반사돼 보이지만 그것은 표시 계층이고 S 의 논리 좌표는 양쪽이 같다 (#93). */
    const CANON=`(()=>{const rows=S.pieces.map(p=>[p.id,p.owner,p.type,p.r,p.c,p.hp,!!p.alive,!!p.placed].join(":")).sort();
      return {turn:S.turnCount,cur:S.current,phase:S.phase,n:rows.length,digest:rows.join("|")};})()`;
    const sync=await Promise.all([P1.ev(CANON),P2.ev(CANON)]);
    const movedSeen=await Promise.all([P1,P2].map(C=>C.ev(`(()=>{const p=S.pieces.find(x=>x.id===${moved?moved.id:-1});
      return p?{id:p.id,r:p.r,c:p.c}:null;})()`)));
    rec("realMove",{moverTab:mover.label,moverSeat:(await mover.ev("NET.me"))+1,moved,movedSeen,
      sync:[{turn:sync[0].turn,cur:sync[0].cur,phase:sync[0].phase,n:sync[0].n},{turn:sync[1].turn,cur:sync[1].cur,phase:sync[1].phase,n:sync[1].n}],
      digestEqual:sync[0].digest===sync[1].digest});
    ok(!!moved,"4A 실제 합법 이동을 한 수 두었다");
    ok(sync[0].digest===sync[1].digest&&sync[0].n>0,`4B 두 클라이언트의 **모든 말 논리 좌표·HP·생존**이 정확히 같다 (말 ${sync[0].n}개)`);
    ok(!!moved&&movedSeen[0]&&movedSeen[1]&&movedSeen[0].r===moved.r&&movedSeen[0].c===moved.c
       &&movedSeen[1].r===moved.r&&movedSeen[1].c===moved.c,
       `4C 움직인 그 말이 양쪽에서 같은 칸에 있다 ${JSON.stringify(movedSeen)}`);

    /* 전투 화면 — 실제 온라인 판에서 합법 전투가 성립하지 않으면 **픽스처**로 열고 그렇게 표시한다 */
    /* 전투 화면. 실제 온라인 판에서 두 말을 접촉시키려면 수십 턴이 필요해 이 증빙의 범위를 넘는다 —
       조정자 합의대로 **분명히 표시된 오프라인 픽스처**로 대신한다. 실제로 둔 온라인 전투라고 주장하지 않는다.
       픽스처는 로스터·배치가 모두 끝난 정상 플레이 상태다 (배치 화면이 아니다). */
    let battleKind="none";
    if(battleKind!=="real-online"){
      /* 픽스처 — 이 판의 실제 온라인 보드가 아니라, 같은 문서에서 오프라인 전투 화면을 열어 아트만 확인한다.
         스크린샷 이름과 보고에 FIXTURE 로 못 박는다. 실제로 둔 전투라고 주장하지 않는다. */
      await P1.ev(`(()=>{ netLeave(); startMode("pvp"); fillRosterRandom(0); fillRosterRandom(1);
        aiAutoPlace(0); aiAutoPlace(1); beginPlay(); UI.entered=true; UI.drawer=null;
        S.pieces.filter(x=>x.owner===0).forEach(x=>x.revealed=true);   // 내 진영은 내 화면에서 원래 보인다
        render(); return 1; })()`);
      await P1.settle(12000);
      const placed=await P1.ev(`(()=>({screen:document.getElementById("app").getAttribute("data-screen"),
        phase:S.phase, unplaced:S.pieces.filter(x=>!x.placed&&x.alive).length, cells:document.getElementById("board").children.length}))()`);
      rec("battleFixture.state",placed);
      ok(placed.phase==="play"&&placed.unplaced===0&&placed.screen==="board",
         `5C 전투 픽스처가 배치 완료된 정상 플레이 상태다 (화면 ${placed.screen} · 미배치 ${placed.unplaced})`);
      await P1.ev(`(()=>{ const a=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive);
        const d=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
        S.current=0; S.mainUsed=false; S.battlesUsed=0; startRounds(a,d,a,d); return 1; })()`);
      await sleep(1800);
      await P1.settle(14000);
      battleKind="fixture-offline";
    }
    const bt=await P1.ev(`(()=>{ const t=document.getElementById("tok-A"), u=document.getElementById("tok-D");
      const h=(t?t.innerHTML:"")+(u?u.innerHTML:"");
      return {open:!!S.battle, hasSprite:h.indexOf("assets/")>=0, tokA:t?t.className:null, tokD:u?u.className:null}; })()`);
    rec("battle",{kind:battleKind,dom:bt});
    ok(bt.open,`5A 전투 화면이 열렸다 (${battleKind})`);
    ok(bt.hasSprite,`5B 전투 도트가 실제 아트다 (${battleKind})`);
    shots.push(await P1.shot(battleKind==="real-online"?"201-03-battle-real-online.png":"201-03-battle-FIXTURE-offline.png"));

    /* ── 4. 유도 429 — 현행 소스는 복구한다 ──────────────────────────── */
    const D1=await attach(cdp,null,"FIX429");
    D1.intercepts.push({match:u=>/lightning_sustain\/icon\.png/.test(u),action:"429",once:1,used:0});
    D1.intercepts.push({match:u=>/leaders\/king\/icon64\.png/.test(u),action:"429",once:1,used:0});
    await cdp.send("Page.navigate",{url:srv.origin+"/index.html"},D1.sid);
    await D1.waitFor(`document.readyState==="complete"&&typeof ART!=="undefined"`,20000);
    await D1.ev(`(()=>{ if(!document.getElementById("tutOverlay").classList.contains("hidden")) tutSkip();
      startMode("pvp"); fillRosterRandom(0); fillRosterRandom(1); aiAutoPlace(0); aiAutoPlace(1); beginPlay();
      S.pieces.filter(x=>x.owner===0).forEach(x=>x.revealed=true); render(); return 1; })()`);
    const hurt=await D1.ev(`({failed:Array.from(ART.failed).sort()})`);
    rec("induced429.fixed.immediate",hurt);
    ok(hurt.failed.indexOf("lightning_sustain")>=0||hurt.failed.indexOf("king")>=0,
      `6A 유도 429 가 실제로 아트를 떨어뜨렸다 (${JSON.stringify(hurt.failed)})`);
    const recovered=await D1.waitFor(`ART.failed.size===0`,20000);
    const after429=await D1.ev(`(()=>{ render();
      const k=S.pieces.find(x=>x.owner===0&&x.type==="king");
      const m=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&artDirOf(x)==="lightning_sustain");
      return {failed:Array.from(ART.failed),settled:Array.from(ART.settled||[]),
        kingArt:!!(k&&pcFaceHtml(k).indexOf("assets/leaders/king/icon64.png")>=0),
        lsArt:m?pcFaceHtml(m).indexOf("assets/minions/lightning_sustain/icon.png")>=0:null}; })()`);
    rec("induced429.fixed.after",after429);
    ok(recovered&&after429.failed.length===0,`6B 현행 소스는 유도 429 에서 스스로 복구한다 (남은 실패 ${JSON.stringify(after429.failed)})`);
    ok(after429.kingArt,"6C 복구 후 왕이 다시 아트다");
    const induced1=D1.net.filter(x=>x.induced).length, natural1=D1.net.filter(x=>!x.induced&&x.status>=400&&/assets/.test(x.url)).length;
    rec("induced429.fixed.counts",{induced:induced1,naturalFailures:natural1,totalAssetReq:D1.assetReqs().length});
    ok(natural1===0,`6D 이 실행에서 자연 발생한 자산 실패는 0건이다 (유도 ${induced1}건과 구분)`);
    shots.push(await D1.shot("201-04-induced429-FIXED-recovered.png"));

    /* ── 5. 유도 429 — 기준판 소스(인메모리 오버레이)는 복구하지 못한다 ─ */
    const baseHtml=execFileSync("git",["show",BASE_REF+":demo/index.html"],{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024});
    const baseSha=crypto.createHash("sha256").update(Buffer.from(baseHtml,"utf8")).digest("hex");
    rec("baseline",{ref:BASE_REF,sha256OfOverlayBytes:baseSha,note:"저장소 파일을 바꾸지 않고 CDP Fetch 로 문서 본문만 기준판으로 바꿔 끼웠다"});
    const D0=await attach(cdp,null,"BASE429");
    D0.intercepts.push({match:u=>/\/index\.html$/.test(u)||/:\d+\/$/.test(u),action:"body",body:baseHtml});
    D0.intercepts.push({match:u=>/lightning_sustain\/icon\.png/.test(u),action:"429",once:1,used:0});
    D0.intercepts.push({match:u=>/leaders\/king\/icon64\.png/.test(u),action:"429",once:1,used:0});
    await cdp.send("Page.navigate",{url:srv.origin+"/index.html"},D0.sid);
    await D0.waitFor(`document.readyState==="complete"&&typeof ART!=="undefined"`,20000);
    const isBase=await D0.ev(`typeof ART_RETRY==="undefined"`);
    ok(isBase,"7A 기준판 소스가 실제로 올라갔다 (복구 예산 심볼 부재)");
    await D0.ev(`(()=>{ if(!document.getElementById("tutOverlay").classList.contains("hidden")) tutSkip();
      startMode("pvp"); fillRosterRandom(0); fillRosterRandom(1); aiAutoPlace(0); aiAutoPlace(1); beginPlay();
      S.pieces.filter(x=>x.owner===0).forEach(x=>x.revealed=true); render(); return 1; })()`);
    await sleep(8000); // 현행 소스가 복구를 끝내고도 남는 시간
    const baseAfter=await D0.ev(`(()=>{ render();
      const k=S.pieces.find(x=>x.owner===0&&x.type==="king");
      const m=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&artDirOf(x)==="lightning_sustain");
      return {failed:Array.from(ART.failed).sort(),
        kingArt:!!(k&&pcFaceHtml(k).indexOf("assets/leaders/king/icon64.png")>=0),
        kingEmoji:!!(k&&pcFaceHtml(k).indexOf("👑")>=0),
        lsArt:m?pcFaceHtml(m).indexOf("assets/minions/lightning_sustain/icon.png")>=0:null}; })()`);
    rec("induced429.baseline.after",baseAfter);
    ok(baseAfter.failed.length>0,`7B 기준판은 같은 유도 429 에서 실패가 남는다 (${JSON.stringify(baseAfter.failed)}) — #201 증상 재현`);
    ok(baseAfter.kingArt===false&&baseAfter.kingEmoji===true,"7C 기준판에서는 왕이 이모지로 남는다 (스크린샷의 증상)");
    shots.push(await D0.shot("201-05-induced429-BASELINE-broken.png"));

    /* ── 6. 빠른 새로고침 ──────────────────────────────────────────── */
    const R=await attach(cdp,srv.origin+"/index.html","RELOAD");
    await R.waitFor(`document.readyState==="complete"&&typeof ART!=="undefined"`,20000);
    for(let i=0;i<3;i++){ await cdp.send("Page.reload",{ignoreCache:true},R.sid); await sleep(700); }
    await R.waitFor(`document.readyState==="complete"&&typeof ART!=="undefined"`,20000);
    await sleep(3000);
    const rl=await R.ev(`({failed:Array.from(ART.failed),loaded:ART.loaded.size})`);
    const rlBad=R.net.filter(x=>/\/assets\//.test(x.url)&&x.status>=400&&!x.induced);
    rec("reload",{rounds:4,art:rl,failedResponses:rlBad.length,assetReqs:R.assetReqs().length});
    ok(rlBad.length===0,`8A 연속 새로고침 4회에서 자산 실패 응답 0건 (관측 ${rlBad.length})`);
    ok(rl.failed.length===0,`8B 연속 새로고침 뒤에도 실패한 종 0건 (${JSON.stringify(rl.failed)})`);

    rec("screenshots",shots.filter(Boolean).map(f=>({file:path.basename(f),sha256:sha256(f)})));
  }catch(e){
    console.error("환경/실행 오류: "+(e&&e.stack||e));
    report.error=String(e&&e.message||e);
    fail++; fails.push("실행 오류: "+String(e&&e.message||e));
  }finally{
    try{ if(OWNED.chrome&&!OWNED.chrome.killed) OWNED.chrome.kill(); }catch(e){}
    try{ if(OWNED.server&&!OWNED.server.killed) OWNED.server.kill(); }catch(e){}
    await sleep(400);
    try{ if(OWNED.udd&&/i201cdp-/.test(OWNED.udd)) fs.rmSync(OWNED.udd,{recursive:true,force:true}); }catch(e){}
    console.log("CLEANUP 내가 띄운 서버·Chrome·임시 프로필만 정리했다");
  }
  report.pass=pass; report.fail=fail; report.fails=fails; report.finishedAt=new Date().toISOString();
  try{ fs.mkdirSync(OUT,{recursive:true}); fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(report,null,2)); }catch(e){}
  console.log(`=== online_art_cdp (#201): pass ${pass} / fail ${fail} === → ${OUT}`);
  if(fail){ console.error("실패 목록:\n  "+fails.join("\n  ")); process.exit(1); }
})();
