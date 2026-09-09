/* #91 공용/적 포획 하수인 대리 출전 아트 — 실제 브라우저(헤드리스 Chrome · CDP) 실측 + 스크린샷
   사용: node demo/test/issue91_cdp.js [--html <index.html>] [--out <dir>] [--chrome <chrome.exe>] [--no-shots] [--no-http] [--read-only]
   --read-only: Saturn 독립 재검증용. 검증 산출물 0 — 스크린샷·보고서 JSON 을 만들지 않고 stdout 으로만 보고한다.
                헤드리스 Chrome 임시 프로필(os.tmpdir()/art91cdp-*)만 부수 생성되며 이 실행이 mkdtemp 로 만든 정확한 경로 하나만 종료 시 정리한다.
   장면 3개 × 스킴(file:// · HTTP) × 뷰포트(desktop-1280 · mobile-390 은 HTTP 만):
     1-neutral-proxy : PVE — 내 왕이 중립 포획 하수인(불 → fire_std)으로 대리 출전 vs 상대 하수인 본체
     2-both-proxy    : 핫시트 — 1P 왕(중립 포획 물 → water_std) vs 2P 동료(전투 중 적 포획 예비 = 1P 원래 하수인 종) — 양측 대리
     3-proxy-fallback: 1 과 같은 판에서 대리 전투원 종의 battle.png 요청을 차단 → 즉시 현행 이모지 토큰 대체 · 전투 진행
   측정은 기계 판정(로드 여부·원본 128·표시 128·src·대체 내용·전투 진행)이고, 선명도·식별성은 저장된 스크린샷의 사람 검수 소관이다.
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 없음. 종료 코드 1 = 실측 문제 발견. minion_art_cdp.js 의 기동·측정 골격을 재사용한다. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.4","issues","91","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const USE_HTTP=!args.includes("--no-http");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(opt("--html",path.join(__dirname,"..","index.html")));
const FILE_URL="file:///"+HTML.replace(/\\/g,"/");
const VIEWPORTS=[
  {name:"desktop-1280", w:1280,h:800, dpr:1, schemes:["file","http"]},
  {name:"mobile-390",   w:390, h:844, dpr:2, schemes:["http"]},
];

/* ── 페이지 안에서 도는 준비 스크립트 ─────────────────────────────────────── */
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){} return true; })()`;
/* 지정 속성의 중립 포획 하수인을 제품 tryCapture 경로로 만든다 (시드 탐색) */
const CAP_FN=`const neutralCap=(piece,el)=>{ let got=null; for(let seed=1;seed<400&&got!==el;seed++){ setSeed(seed); piece.cap=null; S.balls[piece.owner]=5; tryCapture(piece,"safe"); got=piece.cap&&piece.cap.element; } return got===el; };
  const adjacent=(a,b)=>{ const occ=S.pieces.find(x=>x.placed&&x.alive&&x.r===a.r-1&&x.c===a.c&&x.id!==b.id); if(occ) occ.placed=false; b.r=a.r-1; b.c=a.c; b.placed=true; b.alive=true; };`;
const SCENE_NEUTRAL=`(()=>{ ${CAP_FN}
  setSeed(4242); newGame("pve",{aiLevel:"grade5"}); aiAutoPlace(0); aiAutoPlace(1);
  S.phase="play"; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.movedPiece=null; S.contactSet=[]; S.forcedTargets=[]; S.forcedQueue=[];
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king"), op=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.rosterId);
  if(!king||!op) return "no-pieces";
  adjacent(king,op); op.revealed=false;
  if(!neutralCap(king,"fire")) return "no-cap";
  S.selected=null; render();
  initBattle(king,op);
  return {capId:king.cap.artRosterId,capEl:king.cap.element,opDir:artDirOf(op),modal:document.getElementById("overlayBox").innerText.slice(0,40)};
})()`;
const SCENE_BOTH=`(()=>{ ${CAP_FN}
  setSeed(777); newGame("pvp"); aiAutoPlace(0); aiAutoPlace(1);
  S.phase="play"; S.current=1; S.mainUsed=false; S.battlesUsed=0; S.movedPiece=null; S.contactSet=[]; S.forcedTargets=[]; S.forcedQueue=[];
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king"), me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.rosterId);
  const em=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.rosterId), eAlly=S.pieces.find(x=>x.owner===1&&x.type==="ally");
  if(!king||!me||!em||!eAlly) return "no-pieces";
  // 1) 2P 하수인이 1P 하수인을 전투 중 포획 → S.reserve[1] = 1P 하수인의 원래 종
  adjacent(me,em); initBattle(em,me); if(!S.battle) return "no-battle-1";
  finishByCapture("A");
  const rv=S.reserve[1]; if(!rv||rv.artRosterId!==me.rosterId) return "no-reserve";
  const rd=ROSTER.find(r=>r.id===rv.artRosterId);
  window.__91={reserveId:rv.artRosterId,reserveDir:rd.element+"_"+rd.arch};
  return {step:1,reserveId:rv.artRosterId};
})()`;
const SCENE_BOTH_2=`(()=>{ ${CAP_FN}
  try{ close(); }catch(e){}
  S.battle=null;
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king"), eAlly=S.pieces.find(x=>x.owner===1&&x.type==="ally");
  const em=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.rosterId); if(em) em.placed=false;
  adjacent(king,eAlly);
  if(!neutralCap(king,"water")) return "no-cap";
  S.current=0; S.mainUsed=false; S.battlesUsed=0; S.selected=null; S.forcedTargets=[]; render();
  initBattle(king,eAlly);
  return {capId:king.cap.artRosterId,reserveDir:window.__91.reserveDir,modal:document.getElementById("overlayBox").innerText.slice(0,40)};
})()`;
const CLICK=i=>`(()=>{ const b=document.querySelectorAll("#obBtns button")[${i}]; if(!b) return "no-btn"; const t=b.textContent; b.click(); return t; })()`;
const MEASURE=`(()=>{
  const R=e=>e.getBoundingClientRect(), issues=[];
  const stage=document.getElementById("bstage"); if(!stage) return {error:"전투 스테이지 없음: "+document.getElementById("overlayBox").innerText.slice(0,80)};
  const B=S.battle; if(!B) return {error:"S.battle 없음"};
  const sr=R(stage);
  const toks=[...stage.querySelectorAll(".btok")].map(t=>{ const img=t.querySelector("img.bsprite"), tr=R(t);
    return {id:t.id,art:t.classList.contains("art"),w:Math.round(tr.width),h:Math.round(tr.height),
      natW:img?img.naturalWidth:0,dispW:img?Math.round(R(img).width):0,loaded:img?(img.complete&&img.naturalWidth>0):null,
      src:img?img.getAttribute("src"):"",alt:img?img.getAttribute("alt"):"",text:t.textContent.trim(),bg:t.style.background||""}; });
  for(const t of toks){ const tr=R(document.getElementById(t.id)); if(tr.left<sr.left-0.5||tr.right>sr.right+0.5) issues.push(t.id+" 토큰이 스테이지를 벗어남"); }
  const fa=B.fa, fd=B.fd;
  return {toks,issues,proxyA:fa!==B.attP,proxyD:fd!==B.defP,faId:fa.artRosterId||null,fdId:fd.artRosterId||null,faRosterId:fa.rosterId===undefined?"undefined":String(fa.rosterId),fdRosterId:fd.rosterId===undefined?"undefined":String(fd.rosterId),faEl:fa.element,fdEl:fd.element,
    faHp:fa.hp+"/"+fa.maxHp,fdHp:fd.hp+"/"+fd.maxHp,faAtk:fa.atk,fdAtk:fd.atk,attType:B.attP.type,defType:B.defP.type,
    bodyHasHiddenDirs:null};
})()`;
const PROGRESS=`(()=>{ const B=S.battle; if(!B) return {error:"no battle"}; const hpD=B.fd.hp, hpA=B.fa.hp, n=B.blog.length; __act("basic"); return {hpA,hpD,n}; })()`;
const PROGRESS_CHECK=`(()=>{ const B=S.battle; if(!B) return {ended:true}; return {hpA:B.fa.hp,hpD:B.fd.hp,n:B.blog.length,tokA:(document.getElementById("tok-A")||{}).className||""}; })()`;

/* ── Chrome 기동 · CDP · QA 서버 (minion_art_cdp.js 와 같은 방식) ───────────── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"art91cdp-"));
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
  let server=null, httpError=null;
  if(USE_HTTP){ try{ server=await startServer(); }catch(e){ httpError=e.message; } }
  const schemes=[{name:"file",url:FILE_URL}];
  if(server) schemes.push({name:"http",url:`http://127.0.0.1:${server.port}/index.html`});
  const {proc,ws,udd}=await launch();
  console.log(`RESOURCE chrome pid=${proc.pid} profile=${udd}`);
  if(server) console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port}`);
  const report=[]; let bad=0; const shots=[];
  if(USE_HTTP&&!server){ report.push({scheme:"http",vp:"-",scene:"server",error:"필수 HTTP 검증 불가: "+(httpError||"서버 미기동")+" (file 단독 실행은 --no-http 를 명시할 것)",issues:[]}); bad++; }
  const note=(scheme,vp,scene,r)=>{ report.push(Object.assign({scheme,vp,scene},r)); if(r.error||(r.issues&&r.issues.length)) bad++; };
  try{
    const cdp=await connect(ws);
    const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
    const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
    await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid); await cdp.send("Network.enable",{},sid); await cdp.send("Log.enable",{},sid);
    /* 콘솔 오류 수집 (AC 4 "콘솔 오류 없음"): JS 예외 + console.error + 브라우저 오류 로그. 장면 3 의 의도된 차단(ERR_BLOCKED_BY_CLIENT · 차단한 battle.png)만 제외한다 */
    const consoleErrs=[]; const ws2=cdp.ws; const prevMsg=ws2.onmessage;
    ws2.onmessage=ev=>{ try{ const m=JSON.parse(ev.data); if(m.method==="Runtime.exceptionThrown") consoleErrs.push("exception: "+((m.params.exceptionDetails.exception||{}).description||m.params.exceptionDetails.text||"").slice(0,200));
      else if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error") consoleErrs.push("console.error: "+m.params.args.map(a=>a.value||a.description||"").join(" ").slice(0,200));
      else if(m.method==="Log.entryAdded"&&m.params.entry.level==="error") consoleErrs.push("log: "+(m.params.entry.text||"").slice(0,120)+" "+(m.params.entry.url||"")); }catch(e){} prevMsg(ev); };
    /* favicon.ico 404 는 QA 서버(server/server.js)가 파비콘을 제공하지 않아 HTTP 첫 탐색에서 나는 기존 로그로 #91 과 무관하다 — 판정에서 빼되 보고서에 ignoredConsole 로 남긴다 */
    const IGNORE_ALWAYS=/favicon\.ico/;
    const takeErrs=(ignoreRe)=>{ const all=consoleErrs.splice(0), errs=[], ignored=[]; for(const x of all) (IGNORE_ALWAYS.test(x)||(ignoreRe&&ignoreRe.test(x))?ignored:errs).push(x); return {errs,ignored}; };
    const ev=async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) return {error:"JS 예외: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)}; return r.result.value; };
    const shot=async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
      const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); shots.push(path.relative(ROOT,f).replace(/\\/g,"/")); };
    const nav=async(url,vp)=>{ await cdp.send("Emulation.setDeviceMetricsOverride",{width:vp.w,height:vp.h,deviceScaleFactor:vp.dpr,mobile:false},sid);
      const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url},sid); await loaded; await sleep(300); await ev(PREP); };
    /* 출전 선택(대리=두 번째 버튼) → (방어측 선택) → 출전 공개(전투 시작) */
    const enterProxy=async(both)=>{ const c=[]; c.push(await ev(CLICK(1))); await sleep(150); if(both){ c.push(await ev(CLICK(1))); await sleep(150); } c.push(await ev(CLICK(0))); await sleep(900); return c; };
    const check=(m,expA,expD,label)=>{ const issues=(m.issues||[]).slice(); if(m.error){ return {issues,error:m.error}; }
      const tA=m.toks.find(t=>t.id==="tok-A"), tD=m.toks.find(t=>t.id==="tok-D");
      if(!tA||!tD) issues.push("토큰 2개 아님");
      for(const [t,exp,who] of [[tA,expA,"A"],[tD,expD,"D"]]){ if(!t) continue;
        if(exp&&exp.art){ if(!t.art) issues.push(who+" art 토큰 아님"); if(!t.loaded) issues.push(who+" 전투 도트 로드 실패 "+t.src);
          if(t.natW&&t.natW!==128) issues.push(who+" 원본 "+t.natW+"≠128"); if(t.dispW&&t.dispW!==128) issues.push(who+" 표시 "+t.dispW+"≠128");
          if(exp.src&&t.src!==exp.src) issues.push(who+" src "+t.src+" ≠ "+exp.src); if(exp.alt&&t.alt!==exp.alt) issues.push(who+" alt '"+t.alt+"' ≠ '"+exp.alt+"'"); }
        else if(exp){ if(t.art||t.src) issues.push(who+" 그림이 있으면 안 됨 "+t.src); if(exp.text&&t.text.indexOf(exp.text)<0) issues.push(who+" 대체 내용 '"+t.text+"' 에 '"+exp.text+"' 없음"); } }
      return {issues}; };

    for(const vp of VIEWPORTS) for(const sc of schemes){ if(!vp.schemes.includes(sc.name)) continue;
      const tag=`${sc.name}_${vp.name}`;
      // 1) 중립 포획 대리 출전 (PVE)
      await cdp.send("Network.setBlockedURLs",{urls:[]},sid); await cdp.send("Network.setCacheDisabled",{cacheDisabled:false},sid);
      await nav(sc.url,vp);
      let s1=await ev(SCENE_NEUTRAL); let clicks=[], m={error:"장면 준비 실패: "+JSON.stringify(s1)};
      if(s1&&s1.capId){ clicks=await enterProxy(false); m=await ev(MEASURE); }
      let chk=check(m,{art:true,src:"assets/minions/fire_std/battle.png",alt:"포획 하수인·불"},{art:true,src:s1.opDir?"assets/minions/"+s1.opDir+"/battle.png":null},"1");
      if(!m.error&&!(m.proxyA===true&&m.proxyD===false&&m.faId==="M-F1"&&m.attType==="king")) chk.issues.push("전투원 구성 불일치 "+JSON.stringify({proxyA:m.proxyA,proxyD:m.proxyD,faId:m.faId,attType:m.attType}));
      if(!m.error&&!(m.faHp==="100/100"&&m.faAtk===20)) chk.issues.push("대리 전투원 수치가 공용 규격(100/100·공 20)이 아님 "+m.faHp+"·"+m.faAtk);
      { const {errs,ignored}=takeErrs(null); if(errs.length) chk.issues.push("콘솔 오류 "+errs.length+"건: "+errs.join(" || ")); chk.consoleErrors=errs; chk.ignoredConsole=ignored; }
      note(sc.name,vp.name,"1-neutral-proxy",Object.assign({setup:s1,clicks},m,chk));
      await shot(`${tag}_1-neutral-proxy`);
      // 2) 양측 대리 출전 (핫시트)
      await nav(sc.url,vp);
      let s2=await ev(SCENE_BOTH); await sleep(1500); // finishByCapture 메시지 재생·모달 닫힘 대기
      let s2b=(s2&&s2.step===1)?await ev(SCENE_BOTH_2):{error:"1단계 실패 "+JSON.stringify(s2)};
      clicks=[]; m={error:"장면 준비 실패: "+JSON.stringify(s2b)};
      if(s2b&&s2b.capId){ clicks=await enterProxy(true); m=await ev(MEASURE); }
      chk=check(m,{art:true,src:"assets/minions/water_std/battle.png",alt:"포획 하수인·물"},{art:true,src:s2b.reserveDir?"assets/minions/"+s2b.reserveDir+"/battle.png":null},"2");
      if(!m.error&&!(m.proxyA===true&&m.proxyD===true&&m.faId==="M-W1"&&m.fdId===(s2&&s2.reserveId)&&m.attType==="king"&&m.defType==="ally")) chk.issues.push("양측 대리 구성 불일치 "+JSON.stringify({proxyA:m.proxyA,proxyD:m.proxyD,faId:m.faId,fdId:m.fdId,attType:m.attType,defType:m.defType}));
      if(!m.error&&!(m.fdHp==="70/100"&&m.fdAtk===20)) chk.issues.push("적 포획 예비의 수치가 공용 규격(70/100·공 20)이 아님 "+m.fdHp+"·"+m.fdAtk);
      { const {errs,ignored}=takeErrs(null); if(errs.length) chk.issues.push("콘솔 오류 "+errs.length+"건: "+errs.join(" || ")); chk.consoleErrors=errs; chk.ignoredConsole=ignored; }
      note(sc.name,vp.name,"2-both-proxy",Object.assign({setup:s2b,reserve:s2,clicks},m,chk));
      await shot(`${tag}_2-both-proxy`);
      // 3) 대리 전투원 종의 battle.png 차단 → 이모지 대체 · 전투 진행
      await cdp.send("Network.setCacheDisabled",{cacheDisabled:true},sid);
      await cdp.send("Network.setBlockedURLs",{urls:["*/fire_std/battle.png"]},sid);
      await nav(sc.url,vp);
      s1=await ev(SCENE_NEUTRAL); clicks=[]; m={error:"장면 준비 실패: "+JSON.stringify(s1)};
      if(s1&&s1.capId){ clicks=await enterProxy(false); await sleep(400); m=await ev(MEASURE); }
      chk=check(m,{art:false,text:"🔥"},{art:true,src:s1.opDir?"assets/minions/"+s1.opDir+"/battle.png":null},"3");
      let prog=null;
      if(!m.error){ const before=await ev(PROGRESS); await sleep(2500); const after=await ev(PROGRESS_CHECK); prog={before,after};
        if(!(after.ended||(after.hpD<before.hpD&&after.n>before.n))) chk.issues.push("대체 후 전투가 진행되지 않음 "+JSON.stringify(prog));
        if(after.tokA&&/\bart\b/.test(after.tokA)) chk.issues.push("실패 종이 다시 art 로 복원됨 "+after.tokA); }
      { const {errs,ignored}=takeErrs(/ERR_BLOCKED_BY_CLIENT|fire_std\/battle\.png/); if(errs.length) chk.issues.push("콘솔 오류 "+errs.length+"건: "+errs.join(" || ")); chk.consoleErrors=errs; chk.ignoredConsole=ignored; }
      note(sc.name,vp.name,"3-proxy-fallback",Object.assign({setup:s1,clicks,progress:prog,blocked:["*/fire_std/battle.png"]},m,chk));
      await shot(`${tag}_3-proxy-fallback`);
      await cdp.send("Network.setBlockedURLs",{urls:[]},sid); await cdp.send("Network.setCacheDisabled",{cacheDisabled:false},sid);
    }
  } finally {
    try{proc.kill();}catch(e){}
    if(server) try{server.proc.kill();}catch(e){}
    const uddAbs=path.resolve(udd), tmpAbs=path.resolve(os.tmpdir());
    const safe=path.dirname(uddAbs)===tmpAbs&&/^art91cdp-[A-Za-z0-9]+$/.test(path.basename(uddAbs));
    let removed=false;
    if(safe) for(let i=0;i<10;i++){ try{ fs.rmSync(uddAbs,{recursive:true,force:true}); }catch(e){} removed=!fs.existsSync(uddAbs); if(removed) break; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150); }
    console.log(`CLEANUP chrome pid=${proc.pid} killed=${proc.killed||proc.exitCode!==null} profile=${uddAbs} guard=${safe} removed=${removed}`+(server?` qa-server pid=${server.proc.pid} killed=${server.proc.killed||server.proc.exitCode!==null}`:""));
  }
  const payload={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),schemes:schemes.map(s=>s.name),viewports:VIEWPORTS,shots,report};
  const reportFile=path.join(OUT,"issue91_cdp_report.json");
  if(READ_ONLY) console.log("\n--- READ_ONLY: 검증 산출물 0 (스크린샷·보고서 JSON 없음). 측정 원본 JSON ---\n"+JSON.stringify(payload));
  else fs.writeFileSync(reportFile,JSON.stringify(payload,null,1));
  for(const r of report){
    const toks=(r.toks||[]).map(t=>`${t.id}${t.art?"(art)":"(emoji)"} ${t.w}x${t.h} nat=${t.natW} disp=${t.dispW} loaded=${t.loaded} src=${t.src||"-"} alt=${t.alt||"-"} text=${JSON.stringify(t.text)}`).join(" | ");
    console.log(`== ${r.scheme} ${r.vp} ${r.scene}: proxyA=${r.proxyA} proxyD=${r.proxyD} fa=${r.faId}(${r.faEl} ${r.faHp} rosterId=${r.faRosterId}) fd=${r.fdId}(${r.fdEl} ${r.fdHp} rosterId=${r.fdRosterId}) consoleErrors=${(r.consoleErrors||[]).length} ignored=${(r.ignoredConsole||[]).length} ${toks}${r.progress?" progress="+JSON.stringify(r.progress):""}${r.issues&&r.issues.length?"  ISSUES: "+r.issues.join(" | "):""}${r.error?"  ERROR "+r.error:""}`);
  }
  console.log(`\n=== issue91_cdp: ${report.length} 측정 · 문제 ${bad}건 · 스킴 [${schemes.map(x=>x.name).join(",")}]`+(READ_ONLY?` · READ_ONLY(검증 산출물 0 · 임시 프로필 ${udd} 부수 생성·정리)`:` · 스크린샷 ${shots.length}장 · 보고서 ${path.relative(ROOT,reportFile).replace(/\\/g,"/")}`));
  process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
