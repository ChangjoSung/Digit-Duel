/* #201 후속(2026-09-11 CJ 지시) 함정 전용 아이콘 — 실제 브라우저 증빙
 * 사용: node demo/test/hotfix/201/trap_icon_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--no-shots]
 *
 * 헤드리스 하네스가 흉내 낼 수 없는 것만 여기서 본다
 *   1. 내가 띄운 server/server.js 를 루프백 임의 포트로 기동한다 (사용자의 서버를 건드리지 않는다).
 *      접속 코드는 이 실행에서만 쓰는 값을 주입하고 산출물 어디에도 적지 않는다.
 *   2. 내가 띄운 헤드리스 Chrome 임시 프로필에서 독립된 두 탭(P1·P2)이 실제 로비 입력·버튼 클릭으로
 *      온라인 매칭에 들어가 로스터·배치를 마치고 보드까지 간다.
 *   3. **실제 렌더된 SVG**를 본다 — getComputedStyle 로 실제 상자 크기와 가시성을, getBBox 로 도형이
 *      실제로 그려졌는지를(폭·높이 0 이 아닌지) 확인한다. 문자열 검사로는 알 수 없는 것들이다.
 *   4. 은폐 불변식을 실제 DOM 에서 다시 본다 — 상대 미공개 말 칸에 함정 도형·정체 식별자가 없다.
 *   5. 그 브라우저에서 실제로 글리프를 측정해 🪤 가 이 플랫폼 폰트에 없다는 사실(#89 관측)을 기록하고,
 *      그럼에도 함정이 도형으로 보인다는 것을 같은 실행에서 대조한다.
 *   6. 자산 요청·응답을 전부 기록한다 — 이번 변경이 새 HTTP 요청을 만들지 않았는지 실제 요청 목록으로 확인한다.
 *
 * 산출물: --out 아래 P1·P2 보드 스크린샷과 report.json. --no-shots 로 스크린샷을 끌 수 있다.
 * 정리: 내가 띄운 서버 PID·Chrome PID·내가 만든 정확한 임시 프로필 경로만 종료 시 정리한다.
 * 의존: Node 22+(내장 WebSocket) + 로컬 Chrome + server/node_modules(ws). 종료 코드 1 = 판정 실패, 2 = 환경 오류.
 */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto"), {spawn,execFileSync}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","hotfix","201","Mars","trap-icon")));
const SHOTS=!args.includes("--no-shots");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }

let pass=0,fail=0; const fails=[]; const report={issue:201,topic:"trap-icon",startedAt:new Date().toISOString(),checks:[],data:{}};
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
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i201trap-")); OWNED.udd=udd;
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
    rec("server",{origin:srv.origin,note:"접속 코드는 이 실행 전용이며 산출물에 남기지 않는다"});
    console.log("서버: "+srv.origin);
    br=await launchChrome();
    const ws=new WebSocket(br.ws);
    await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
    cdp=new CDP(ws);

    /* 소스·원본 자산 지문 — 이 판정이 어느 바이트에 대한 것인지 못 박는다 */
    const srcFile=path.join(ROOT,"demo","index.html"), assetFile=path.join(ROOT,"demo","assets","symbols","trap.svg");
    rec("source",{file:"demo/index.html",sha256:sha256(srcFile),
                  asset:"demo/assets/symbols/trap.svg",assetSha256:sha256(assetFile)});

    /* ── 1. 냉시작 두 클라이언트 · 실제 매칭 · 보드까지 ───────────────── */
    const P1=await attach(cdp,srv.origin+"/index.html","P1");
    const P2=await attach(cdp,srv.origin+"/index.html","P2");
    await Promise.all([enterOnline(P1,srv.origin,srv.code),enterOnline(P2,srv.origin,srv.code)]);
    const started=await P1.waitFor(`NET.started===true&&S.phase==="play"`,30000)
               && await P2.waitFor(`NET.started===true&&S.phase==="play"`,30000);
    ok(started,"1A 두 클라이언트가 실제 인증·매칭을 거쳐 보드까지 갔다");
    const who=await Promise.all([P1.ev(`NET.me`),P2.ev(`NET.me`)]);
    ok(who[0]!==who[1]&&who.includes(0)&&who.includes(1),`1B 서로 다른 진영을 받았다 (P1=${who[0]} P2=${who[1]})`);

    /* ── 2. 이 플랫폼에서 🪤 글리프가 실제로 없는가 (증상의 근거) ─────── */
    const glyph=await P1.ev(`(()=>{ GLYPH.cache={}; return {trap:glyphOk("🪤"),bomb:glyphOk("💣"),king:glyphOk("👑")}; })()`);
    rec("glyph",Object.assign({},glyph,{note:"제품 자신의 측정기(캔버스 픽셀 대조)로 이 브라우저에서 실측한 값"}));
    ok(glyph.trap===false,`2A 이 브라우저에는 🪤 글리프가 실제로 없다 (#89 관측 재확인 · 측정값 ${glyph.trap}) — 이번 보완의 전제`);
    ok(glyph.bomb===true&&glyph.king===true,`2B 💣·👑 는 있다 — 문제는 폰트 전반이 아니라 🪤 하나다 (측정 💣 ${glyph.bomb} · 👑 ${glyph.king})`);

    /* ── 3. 내 함정이 실제로 그려진 도형인가 ─────────────────────────── */
    for(const C of [P1,P2]){
      const seat=(await C.ev(`NET.me`))+1;
      const t=await C.ev(`(()=>{
        const me=NET.me;
        const mine=S.pieces.filter(x=>x.owner===me&&x.alive&&x.placed);
        const traps=mine.filter(x=>x.type==="trap");
        const cellOf=p=>document.querySelector('#board .cell[data-r="'+p.r+'"][data-c="'+p.c+'"]');
        const out=traps.map(p=>{
          const cell=cellOf(p), svg=cell&&cell.querySelector('svg.symv[data-sym="trap"]');
          if(!svg) return {id:p.id,found:false};
          const span=svg.parentNode, rs=span.getBoundingClientRect(), cs=getComputedStyle(svg);
          let bb=null; try{ bb=svg.getBBox(); }catch(e){}
          return {id:p.id,found:true,
            boxW:Math.round(rs.width),boxH:Math.round(rs.height),
            cssW:getComputedStyle(span).width,cssH:getComputedStyle(span).height,
            display:cs.display,visibility:cs.visibility,opacity:cs.opacity,
            paths:svg.querySelectorAll("path,circle").length,
            bbW:bb?Math.round(bb.width):null,bbH:bb?Math.round(bb.height):null,
            hasImg:!!cell.querySelector("img.icon"),
            textFallback:!!cell.querySelector(".sym.ng")};
        });
        /* 기준자: 같은 보드의 하수인 종 아이콘(32px 계약). 보드 전체는 --bs 로 축소되므로 절대 픽셀은 화면마다 다르다 —
           의미 있는 불변식은 "함정 도형이 하수인 아이콘과 **같은 자리·같은 크기**를 차지한다" 쪽이다. */
        const ref=document.querySelector("#board .pc img.icon");
        const rr=ref?ref.getBoundingClientRect():null;
        return {traps:traps.length,out,
          scale:getComputedStyle(document.getElementById("board")).transform,
          refIcon:rr?{w:Math.round(rr.width),h:Math.round(rr.height),cssW:getComputedStyle(ref).width}:null,
          minionArt:mine.filter(x=>x.type==="minion"&&pcFaceHtml(x).indexOf("assets/minions/")>=0).length,
          minions:mine.filter(x=>x.type==="minion").length};
      })()`);
      rec("trap.seatP"+seat,t);
      ok(t.traps===2,`3A 좌석 P${seat} 내 함정 2개가 판에 있다 (관측 ${t.traps})`);
      ok(t.out.length>0&&t.out.every(x=>x.found),`3B 좌석 P${seat} 내 함정이 전부 전용 도형으로 그려졌다`);
      /* 보드는 세로 화면 맞춤으로 --bs 만큼 축소돼 그려진다(#122). 그래서 절대 픽셀 32 를 요구하지 않고,
         (1) CSS 상자가 계약값 32px 이고 (2) 실제 그려진 크기가 같은 보드의 하수인 아이콘과 정확히 같은지를 본다. */
      ok(t.out.every(x=>x.cssW==="32px"&&x.cssH==="32px"),
         `3C 좌석 P${seat} 도형의 CSS 상자가 계약값 32×32 다 (${JSON.stringify(t.out.map(x=>x.cssW+"×"+x.cssH))})`);
      ok(!!t.refIcon&&t.refIcon.cssW==="32px"&&t.out.every(x=>x.boxW===t.refIcon.w&&x.boxH===t.refIcon.h),
         `3C2 좌석 P${seat} 실제 그려진 크기가 같은 보드의 하수인 아이콘과 같다 — 함정만 크거나 작게 튀지 않는다 `
         +`(함정 ${JSON.stringify(t.out.map(x=>x.boxW+"×"+x.boxH))} · 하수인 ${t.refIcon?t.refIcon.w+"×"+t.refIcon.h:"없음"} · 보드 축소 ${t.scale})`);
      ok(t.out.every(x=>x.display!=="none"&&x.visibility!=="hidden"&&Number(x.opacity)>0),
         `3D 좌석 P${seat} 도형이 실제로 보이는 상태다 (display·visibility·opacity)`);
      ok(t.out.every(x=>x.bbW>0&&x.bbH>0&&x.paths>=9),
         `3E 좌석 P${seat} 도형이 실제로 그려졌다 — getBBox 가 0 이 아니고 도형 요소가 남김없이 있다 (${JSON.stringify(t.out.map(x=>x.paths+"요소 "+x.bbW+"×"+x.bbH))})`);
      ok(t.out.every(x=>!x.textFallback&&!x.hasImg),
         `3F 좌석 P${seat} 함정 자리에 '함정' 텍스트 폴백도 <img> 자산도 없다`);
      /* #201 (v0.4.8) 에서 되살린 하수인 아트가 이번 변경으로 깨지지 않았는지 같은 화면에서 확인한다 */
      ok(t.minions>0&&t.minionArt===t.minions,
         `3G 좌석 P${seat} 하수인 아트 회귀 없음 (${t.minionArt}/${t.minions}) — #201 복구분 보존`);
    }

    /* ── 4. 은폐 불변식 — 상대 미공개 말에 도형·정체가 새지 않는다 ───── */
    for(const C of [P1,P2]){
      const seat=(await C.ev(`NET.me`))+1;
      const h=await C.ev(`(()=>{
        const me=NET.me;
        const foe=S.pieces.filter(x=>x.owner!==me&&x.alive&&x.placed);
        const cells=foe.map(p=>document.querySelector('#board .cell[data-r="'+p.r+'"][data-c="'+p.c+'"]')).filter(Boolean);
        const html=cells.map(c=>c.outerHTML).join("");
        const q=cells.filter(c=>{ const pc=c.querySelector(".pc"); return pc&&pc.textContent.trim()==="?"; }).length;
        return {foe:foe.length,cellsRendered:cells.length,questionMarks:q,
          hiddenTraps:foe.filter(p=>p.type==="trap"&&!p.revealed).length,
          anyTrapSvg:/data-sym="trap"/.test(html), anySymSvg:/svg class="symv"/.test(html),
          anyDataSym:/data-sym=/.test(html), anyAsset:html.indexOf("assets/")>=0,
          anyTrapWord:html.indexOf("함정")>=0,
          boardHasTrapSvgAnywhere:!!document.querySelector('#board svg.symv[data-sym="trap"]'),
          myTrapCount:S.pieces.filter(x=>x.owner===me&&x.type==="trap"&&x.alive&&x.placed).length};
      })()`);
      rec("conceal.seatP"+seat,h);
      ok(h.hiddenTraps>0,`4A 좌석 P${seat} 상대의 미공개 함정이 실제로 판에 있다 (관측 ${h.hiddenTraps}) — 4B~4E 가 공허하지 않다`);
      ok(!h.anyTrapSvg&&!h.anySymSvg,`4B 좌석 P${seat} 상대 말 칸 어디에도 기호 도형이 없다`);
      ok(!h.anyDataSym,`4C 좌석 P${seat} 정체 식별자(data-sym)가 상대 말 칸에 새지 않는다`);
      ok(!h.anyAsset&&!h.anyTrapWord,`4D 좌석 P${seat} 상대 말 칸에 자산 경로도 '함정'이라는 말도 없다`);
      ok(h.cellsRendered>0&&h.questionMarks===h.cellsRendered,
         `4E 좌석 P${seat} 보이는 상대 말은 전부 물음표다 (${h.questionMarks}/${h.cellsRendered})`);
      ok(h.boardHasTrapSvgAnywhere&&h.myTrapCount>0,
         `4F 양성 대조: 같은 보드에 **내** 함정 도형은 있다 (${h.myTrapCount}개) — 4B 가 '아무것도 안 그려서' 통과한 것이 아니다`);
    }

    /* ── 5. 새 HTTP 요청을 만들지 않았다 ─────────────────────────────── */
    for(const C of [P1,P2]){
      const seat=(await C.ev(`NET.me`))+1;
      const a=C.assetReqs();
      const sym=C.net.filter(x=>/\/symbols\//.test(x.url)||/\.svg(\?|$)/.test(x.url));
      const bad=a.filter(x=>x.status>=400&&!x.induced);
      rec("net.seatP"+seat,{assetRequests:a.length,symbolRequests:sym.length,failed:bad.length,
        statuses:[...new Set(a.map(x=>x.status))],
        note:"도형은 문서에 인라인이라 자기 파일을 부르지 않는다 — 요청 목록이 정체와 상관관계를 만들지 않는다"});
      ok(sym.length===0,`5A 좌석 P${seat} 기호 자산(.svg·/symbols/) HTTP 요청 0건 (관측 ${sym.length})`);
      ok(bad.length===0,`5B 좌석 P${seat} 자연 발생한 자산 실패 0건 (관측 ${bad.length}) — 기존 아트 로드 회귀 없음`);
    }

    /* ── 6. 촬영 — 파일 이름의 좌석은 실제 NET.me 를 따른다 ──────────── */
    const shots=[];
    for(const C of [P1,P2]){
      const seat=(await C.ev(`NET.me`))+1;
      const clean=await C.settle(12000);
      rec("settle.seatP"+seat,{overlaysCleared:clean,tab:C.label});
      ok(clean,`6A 좌석 P${seat} 촬영 전에 턴 배너·연출·토스트가 모두 걷혔다 (탭 ${C.label})`);
      shots.push(await C.shot(`201-trap-0${seat}-online-board-seat-P${seat}.png`));
    }
    rec("screenshots",shots.filter(Boolean).map(f=>({file:path.basename(f),sha256:sha256(f),
      caption:"실제 온라인 매칭 두 클라이언트 중 한 좌석의 보드 — 내 함정은 전용 도형, 상대 미공개 말은 물음표"})));
  }catch(e){
    console.error("환경/실행 오류: "+(e&&e.stack||e));
    report.error=String(e&&e.message||e);
    fail++; fails.push("실행 오류: "+String(e&&e.message||e));
  }finally{
    try{ if(OWNED.chrome&&!OWNED.chrome.killed) OWNED.chrome.kill(); }catch(e){}
    try{ if(OWNED.server&&!OWNED.server.killed) OWNED.server.kill(); }catch(e){}
    await sleep(400);
    try{ if(OWNED.udd&&/i201trap-/.test(OWNED.udd)) fs.rmSync(OWNED.udd,{recursive:true,force:true}); }catch(e){}
    console.log("CLEANUP 내가 띄운 서버·Chrome·임시 프로필만 정리했다");
  }
  report.pass=pass; report.fail=fail; report.fails=fails; report.finishedAt=new Date().toISOString();
  try{ fs.mkdirSync(OUT,{recursive:true}); fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(report,null,2)); }catch(e){}
  console.log(`=== trap_icon_cdp (#201 후속): pass ${pass} / fail ${fail} === → ${OUT}`);
  if(fail){ console.error("실패 목록:\n  "+fails.join("\n  ")); process.exit(1); }
})();
