/* #106 턴 흐름·연출 — 실제 브라우저 보완 감사 (Mars_2, 2026-09-08) · 헤드리스 Chrome · CDP · 실제 릴레이 서버(PORT=0) · 실제 마우스 클릭 · 기본 연출 시간(BAL.fx 기본값 그대로 — 빠른 구간 없음)
   사용: node demo/test/milestone/v0.4.4/issues/106/issue106_browser_audit.js [--read-only] [--out <dir>] [--chrome <chrome.exe>] [--ref <git-ref>] [--sections hotseat,pve,online] [--no-shots]
   Mars_1 의 issue106_cdp.js(자연 배치·턴 배너·자동 종료·하수인 전투·회복·폭탄→하수인·함정·65턴 배너·PVE 대기)를 고치지 않고 그 도구가 다루지 않는 수용 기준만 보완한다:
     hotseat: 기기 넘김 모달이 배너보다 먼저 · 확인 뒤 "나의 턴!" 2초 · 자동 종료 뒤 다음 넘김 · 390px 보드 넘침 없음
     pve:     실제 버튼으로 시작 → (픽스처 재배치) → 실제 클릭 접촉 → AI 는 잠금 중 행동하지 않고 라운드 배너 뒤 aiDelay 를 기산 · 전투·AI 턴 완주
     online:  자연 로스터·수동 배치·실제 매칭 → (픽스처 재배치, 양 탭 동일) → 실제 클릭 접촉 → B1: 4카테고리·하위 메뉴 송신 0·가드 사유·가방 보너스 행동(같은 행동자 복귀)·
              방어막 바(수호 자세)·흡수 순서(방어막→HP)·기술 2초→피해 2초·KO→결과 배너(뷰어 기준)·390px 실제 전투 화면 넘침 측정 / B2: 동료 출전 선택 동기 모달이 연출 뒤 재개 → 12행동 → 동률 픽스처 → HP 비율 판정 → 방어자 승
   소스 고정: 시작 시 demo/index.html 을 한 번 메모리에 읽어(sha256 출력) 서버 출처의 빈 URL 에 Page.setDocumentContent 로 넣는다(Mars_3 orientation_audit_cdp.js 와 같은 방법). --ref 는 git show <ref>:demo/index.html.
   픽스처(FIXTURE 행): 자연 진행으로 만들기 어려운 위치·HP 조건만 양 탭에 같은 값으로 넣고 SNAP 동일을 확인한 뒤, 그 뒤의 접촉·전투·모달은 전부 실제 네트워크+UI 경로. 픽셀 클릭 증거로 세지 않는다.
   --read-only: 산출물 0(디렉터리·스크린샷·JSON 없음) · stdout 만. 부수 리소스는 임시 Chrome 프로필(os.tmpdir()/i106audit-*)·PORT=0 서버뿐이며 실패해도 정리(CLEANUP 행).
   의존: Node 22+ · 로컬 Chrome · server/node_modules(ws). 종료 코드 1 = 판정 실패, 2 = 환경 오류. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto"), {spawn,execFileSync}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const has=k=>args.includes(k);
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.4","issues","106","Mars","browser-artifacts")));
const READ_ONLY=has("--read-only")||has("--no-write");
const SHOTS=!has("--no-shots")&&!READ_ONLY;
const SECTIONS=opt("--sections","hotseat,pve,online").split(",");
const REF=opt("--ref",null);
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const SRC=REF?execFileSync("git",["show",REF+":demo/index.html"],{cwd:ROOT,maxBuffer:64*1024*1024}):fs.readFileSync(path.join(ROOT,"demo","index.html")); // 시작 시 1회 메모리 고정
const sha256=b=>crypto.createHash("sha256").update(b).digest("hex");
const SRC_SHA=sha256(SRC), SRC_BLOB=crypto.createHash("sha1").update("blob "+SRC.length+"\0").update(SRC).digest("hex"), TOOL_SHA=sha256(fs.readFileSync(__filename));
const VP={width:1280,height:1000}, NARROW={width:390,height:844};
const FXD={turnBanner:2000,contactBanner:2000,countStep:1000,roundBanner:2000,skillFx:2000,damageFx:2000,itemFx:2000,resultBanner:2500,judgeBanner:2000,autoEndGrace:1000}; // 계약 3.4
const T0=Date.now();

/* ── CDP 배선 (issue104_cdp.js 와 같은 방식) ── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i106audit-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--lang=ko-KR","--disable-background-timer-throttling","--disable-renderer-backgrounding","about:blank"],{stdio:["ignore","pipe","pipe"]});
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
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ const to=setTimeout(()=>{ if(this.pending.has(id)){ this.pending.delete(id); rej(new Error("CDP 응답 없음 30s: "+method)); } },30000); this.pending.set(id,{res:v=>{ clearTimeout(to); res(v); },rej:e=>{ clearTimeout(to); rej(e); }}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
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

/* ── 페이지 안 스크립트 (관측 전용 — 규칙·난수 무변경) ── */
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){}
  window.__errs=[]; window.addEventListener("error",e=>window.__errs.push(String(e.message))); const oe=console.error; console.error=function(){ window.__errs.push([...arguments].map(String).join(" ")); return oe.apply(console,arguments); };
  window.__sent=[]; const os_=WebSocket.prototype.send; WebSocket.prototype.send=function(m){ try{ window.__sent.push({t:Date.now(),m:JSON.parse(m)}); }catch(e){} return os_.apply(this,arguments); };
  window.__obs=[]; window.__last={};
  const push=(k,v)=>{ if(window.__last[k]===v) return; window.__last[k]=v; window.__obs.push({k,v,t:Date.now()}); };
  const snap=()=>{ try{ const fb=document.getElementById("fxBanner"); push("banner",fb&&!fb.classList.contains("hidden")?fb.className+"|"+document.getElementById("fxTitle").textContent+"|"+document.getElementById("fxSub").textContent:"");
      const mb=document.getElementById("msgBox"); push("msg",mb?mb.textContent:"");
      for(const s of ["A","D"]){ const h=document.getElementById("hpfill-"+s); push("hp"+s,h?h.style.width:""); const sh=document.getElementById("shfill-"+s); push("sh"+s,sh?sh.style.width:""); }
      push("lock",document.body.classList.contains("fx-lock")?"1":"0"); const bm=document.getElementById("bmenu"); push("menu",bm?(bm.classList.contains("hidden")?"sub":"root"):"");
    }catch(e){} };
  new MutationObserver(snap).observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true}); snap();
  window.__wr=[]; window.__wrN=0; window.__trap=()=>{ for(const id of ["hpfill-A","hpfill-D","shfill-A","shfill-D"]){ const el=document.getElementById(id); if(!el||el.style.__tr) continue; const st=el.style; Object.defineProperty(st,"__tr",{value:true});
      Object.defineProperty(st,"width",{configurable:true,get(){ return st.getPropertyValue("width"); },set(v){ window.__wr.push({id,v,t:Date.now(),seq:++window.__wrN}); st.setProperty("width",v); }}); } };
  window.__trap(); new MutationObserver(()=>window.__trap()).observe(document.documentElement,{subtree:true,childList:true});
  window.__bars=[]; let lastB=""; const sampleBars=()=>{ try{ const o={t:Date.now()}; for(const id of ["hpfill-A","hpfill-D","shfill-A","shfill-D"]){ const el=document.getElementById(id); o[id]=el?Math.round(el.getBoundingClientRect().width*10)/10:null; } const k=[o["hpfill-A"],o["hpfill-D"],o["shfill-A"],o["shfill-D"]].join(","); if(k!==lastB){ lastB=k; window.__bars.push(o); } }catch(e){} };
  setInterval(sampleBars,16); (function raf(){ sampleBars(); requestAnimationFrame(raf); })();
  return S.phase; })()`;
const HOOK_AI=`(()=>{ window.__ai=[]; const a=aiStep, b=aiBattleAction; aiStep=function(){ window.__ai.push({t:Date.now(),k:"step",locked:fxLocked()}); return a.apply(this,arguments); }; aiBattleAction=function(){ window.__ai.push({t:Date.now(),k:"battle",locked:fxLocked()}); return b.apply(this,arguments); }; return true; })()`;
const SET_CODE=code=>`(()=>{ document.getElementById("netCode").value=${JSON.stringify(code)}; return true; })()`;
const STATE=`(()=>({started:NET.started,phase:S.phase,cur:S.current,me:NET.me,turn:S.turnCount,main:S.mainUsed,battle:S.battle?{r:S.battle.round,ph:S.battle.phase,menu:S.battle.menu||null,hpA:S.battle.fa.hp,hpD:S.battle.fd.hp,shA:S.battle.fa.shield||0,shD:S.battle.fd.shield||0}:null,
  forced:S.forcedTargets.slice(),actor:netActor(),overlay:!document.getElementById("overlay").classList.contains("hidden"),ovTitle:(document.querySelector("#overlayBox h2")||{}).textContent||"",obtn:[...document.querySelectorAll("#obBtns button")].map(b=>[b.textContent.trim(),b.disabled]),
  queue:NET.queue.length,locked:fxLocked(),playing:MSGPLAYING,replaying:!!NET.replaying,sel:S.selected?S.selected.id:null,
  banner:(()=>{ const b=document.getElementById("fxBanner"); return {visible:!b.classList.contains("hidden"),cls:b.className,title:document.getElementById("fxTitle").textContent,sub:document.getElementById("fxSub").textContent}; })(),bu:S.battlesUsed,winner:S.winner}))()`;
const SNAP=`(()=>JSON.stringify({phase:S.phase,cur:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,forced:S.forcedTargets,balls:S.balls,inv:S.inv,reserve:S.reserve,
  battle:S.battle?[S.battle.attP.id,S.battle.defP.id,S.battle.round,S.battle.phase,S.battle.fa.hp,S.battle.fd.hp,S.battle.fa.shield,S.battle.fd.shield]:null,events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),seq:NET.modalSeq,
  pieces:S.pieces.map(p=>[p.id,p.owner,p.rosterId,p.r,p.c,p.alive,p.placed,p.hp,p.maxHp,p.revealed,p.immobile,!!p.healing,p.shield||0,JSON.stringify(p.cds||null)]),
  m:{battles:S.metrics.battles,judged:S.metrics.judged,ties:S.metrics.ties,autoEnds:S.metrics.autoEnds}}))()`;
const OWN_PIECES=`(()=>S.pieces.filter(x=>x.owner===0).map(x=>({id:x.id,type:x.type,r:x.r,c:x.c})))()`;
const PIECE=id=>`(()=>{ const p=S.pieces.find(x=>x.id===${id}); return p?{id:p.id,owner:p.owner,type:p.type,rosterId:p.rosterId,r:p.r,c:p.c,hp:p.hp,maxHp:p.maxHp,alive:p.alive,revealed:p.revealed}:null; })()`;
const PIECE_AT=(r,c)=>`(()=>{ const p=at(${r},${c}); return p?{id:p.id,owner:p.owner,type:p.type,rosterId:p.rosterId,r:p.r,c:p.c,hp:p.hp,maxHp:p.maxHp}:null; })()`;
const RECT=sel=>`(()=>{ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
const RECT_TEXT=(cont,text)=>`(()=>{ const c=document.querySelector(${JSON.stringify(cont)}); if(!c) return null; const b=[...c.querySelectorAll("button")].find(b=>b.textContent.trim().includes(${JSON.stringify(text)})); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,dis:!!b.disabled}; })()`;
const BTN_TEXT=sel=>`(()=>[...document.querySelectorAll(${JSON.stringify(sel)})].map(b=>[b.textContent.trim(),b.disabled]))()`;
const OBS=since=>`(()=>window.__obs.filter(e=>e.t>=${since}))()`;
const BARS_NOW=`(()=>{ const o={t:Date.now()}; for(const id of ["hpfill-A","hpfill-D","shfill-A","shfill-D"]){ const el=document.getElementById(id); o[id]=el?Math.round(el.getBoundingClientRect().width*10)/10:null; } return o; })()`;
const BARS=since=>`(()=>window.__bars.filter(e=>e.t>=${since}))()`;
const WRITES=since=>`(()=>window.__wr.filter(e=>e.t>=${since}))()`;
const SENT_A=`(()=>window.__sent.filter(e=>e.m&&e.m.t==="a").map(e=>e.m.a))()`;
const CONSOLE_ERR=`(()=>window.__errs||[])()`;
const FX_CFG=`(()=>JSON.parse(JSON.stringify(BAL.fx)))()`;
const LAYOUT=`(()=>{ const de=document.documentElement, vw=window.innerWidth; const box=document.getElementById("overlayBox"), bm=document.getElementById("bmenu");
  const vis=b=>b.offsetParent!==null; const outOf=b=>{ const r=b.getBoundingClientRect(); return r.left<-1||r.right>vw+1||r.width<=0; }, clipped=b=>b.scrollWidth>b.clientWidth+1;
  const mbtns=[...document.querySelectorAll("#bmenu button,.bsub .row button")].filter(vis), tbtns=[...document.querySelectorAll("#turnBar button")].filter(vis); const bd=document.getElementById("board").getBoundingClientRect();
  return {vw,docW:de.scrollWidth,boxOverflow:box?box.scrollWidth>box.clientWidth+1:null,boxRight:box?Math.round(box.getBoundingClientRect().right):null,menuVisible:!!bm&&vis(bm),menuBtns:mbtns.length,menuOut:mbtns.filter(outOf).length,menuClip:mbtns.filter(clipped).length,turnBtns:tbtns.length,turnOut:tbtns.filter(outOf).length,boardRight:Math.round(bd.right)}; })()`;
const SUB=k=>`(()=>{ const s=document.getElementById("bsub-${k}"); return {shown:!s.classList.contains("hidden"),root:document.getElementById("bmenu").classList.contains("hidden"),btns:[...s.querySelectorAll(".row button")].filter(b=>!/뒤로/.test(b.textContent)).map(b=>[b.textContent.trim(),b.disabled]),small:(s.querySelector("small")||{}).textContent||""}; })()`;
const FIRST_ENABLED=sel=>`(()=>{ const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>!b.disabled); return b?b.textContent.trim():null; })()`;

/* 배치 대본 (정규 좌표; P2 탭은 로컬 11~13행에 두고 매칭 시 14−r 반사). B1: P1 M-L2(번개 공격형) vs P2 M-W3(물 방어형: 수호 자세·불굴 진형) / B2: P1 M-F1(불 표준형, 응급 치유) vs P2 동료 */
const P1_SETUP={roster:["M-L2","M-F1","M-W1","M-F5","M-G4","M-G3"],pos:{minion:[[11,1],[11,5],[11,3],[11,6],[13,3],[13,6]],bomb:[[11,7],[11,2],[11,4]],ally:[[12,3],[12,5]],trap:[[13,1],[13,7]],king:[[13,4]]}};
const P2_CANON={roster:["M-W3","M-L1","M-G1","M-F4","M-W2","M-G5"],pos:{minion:[[3,1],[3,2],[3,7],[2,3],[3,6],[1,1]],bomb:[[2,4],[1,5],[1,6]],ally:[[3,5],[2,2]],trap:[[3,3],[1,7]],king:[[1,4]]}};
const P2_SETUP={roster:P2_CANON.roster,pos:Object.fromEntries(Object.entries(P2_CANON.pos).map(([k,v])=>[k,v.map(([r,c])=>[14-r,c])]))};

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const report=[], fixtures=[], timing=[], shots=[], shotsSkipped=[]; let bad=0, warns=0;
  const note=(what,r)=>{ report.push({what,...r,at:Date.now()-T0}); if(r.warn){ if(r.ok===false) warns++; } else if(r.error||r.ok===false) bad++; console.log((r.warn?(r.ok===false?"WARN ":"ok   "):(r.ok===false||r.error?"FAIL ":"ok   "))+what+(r.detail?" — "+r.detail:"")+(r.error?" — "+r.error:"")); };
  const tnote=(what,ms,expect)=>{ const lo=expect-120, hi=expect+1300; timing.push({what,ms,expect}); note(what+" 실측 "+ms+"ms (기대 "+expect+"ms · 허용 "+lo+"~"+hi+")",{ok:ms>=lo&&ms<=hi}); };
  console.log(`SOURCE demo/index.html ${REF?"git "+REF:"working tree (메모리 고정)"} sha256=${SRC_SHA} blob=${SRC_BLOB} bytes=${SRC.length}`);
  console.log(`TOOL ${path.relative(ROOT,__filename).replace(/\\/g,"/")} sha256=${TOOL_SHA} sections=${SECTIONS.join(",")} readOnly=${READ_ONLY}`);
  let server=null, chrome=null, cdp=null; const tabs=[];
  const until=async(fn,ms,label)=>{ const t0=Date.now(); for(;;){ const v=await fn(); if(v) return v; if(Date.now()-t0>ms) throw new Error("대기 시간 초과: "+label); await sleep(80); } };
  const spans=(obs,k)=>{ const out=[]; let cur=null; for(const e of obs){ if(e.k!==k) continue; if(cur) out.push({v:cur.v,t0:cur.t,t1:e.t,ms:e.t-cur.t}); cur=e.v?e:null; } if(cur) out.push({v:cur.v,t0:cur.t,ms:null}); return out; };
  const bannerSpans=obs=>spans(obs,"banner").map(s=>{ const [cls,title,sub]=s.v.split("|"); return {cls,title,sub,t0:s.t0,ms:s.ms}; });
  const seqOf=sp=>sp.map(s=>s.title+(s.sub?"/"+s.sub.split("\n").pop():"")).join(" → ");
  const cell=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;
  try{
    server=await startServer(); console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port} (접속 코드는 출력하지 않는다)`);
    chrome=await launch(); console.log(`RESOURCE chrome pid=${chrome.proc.pid} profile=${chrome.udd} (headless=new · 창 없음)`);
    cdp=await connect(chrome.ws);
    const BLANK=`http://127.0.0.1:${server.port}/qa-issue106-blank`;
    const tab=async(name,vp)=>{ const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"}); const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
      await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
      const t={sid,targetId,name,
        activate:async()=>{ try{ await cdp.send("Target.activateTarget",{targetId}); }catch(e){} },
        ev:async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("page("+name+"): "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails)); return r.result.value; },
        setVP:async v=>{ await cdp.send("Emulation.setDeviceMetricsOverride",{width:v.width,height:v.height,deviceScaleFactor:1,mobile:false},sid); await sleep(250); },
        load:async()=>{ const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url:BLANK},sid); await loaded; const {frameTree}=await cdp.send("Page.getFrameTree",{},sid);
          await cdp.send("Page.setDocumentContent",{frameId:frameTree.frame.id,html:SRC.toString("utf8")},sid); await until(()=>t.ev(`(()=>typeof S!=="undefined"&&S.phase==="menu"&&!!document.getElementById("fxBanner"))()`).catch(()=>false),10000,"소스 주입 ("+name+")"); await sleep(200); await t.ev(PREP); },
        clickXY:async(x,y)=>{ for(const type of ["mousePressed","mouseReleased"]) await cdp.send("Input.dispatchMouseEvent",{type,x,y,button:"left",clickCount:1},sid); await sleep(70); },
        click:async sel=>{ const p=await t.ev(RECT(sel)); if(!p) throw new Error("클릭 대상 없음 "+sel+" ("+name+")"); await t.clickXY(p.x,p.y); },
        clickText:async(cont,text)=>{ const p=await t.ev(RECT_TEXT(cont,text)); if(!p) throw new Error("클릭 대상 없음 "+cont+" '"+text+"' ("+name+")"); await t.clickXY(p.x,p.y); },
        shot:async label=>{ if(!SHOTS) return; let data=null; try{ await t.activate(); data=(await Promise.race([cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false},sid),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout 10s")),10000))])).data; }catch(e){ console.log("SHOT-SKIPPED "+label+" ("+e.message+") — 스크린샷은 증거이지 단언이 아니므로 계속 진행"); shotsSkipped.push(label); return; } const f=path.join(OUT,String(shots.length+1).padStart(2,"0")+"-"+label+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); const rel=path.relative(ROOT,f).replace(/\\/g,"/"); shots.push(rel); console.log("SHOT "+rel); },
        close:async()=>{ try{ await cdp.send("Target.closeTarget",{targetId}); }catch(e){} }};
      await t.setVP(vp||VP); await t.load(); tabs.push(t); return t; };
    const st=T=>T.ev(STATE);
    const unlocked=async T=>{ const s=await st(T); return !s.locked&&!s.playing&&s.queue===0&&!s.replaying; };

    /* ═══ hotseat ═══ */
    if(SECTIONS.includes("hotseat")){
      const H=await tab("HOT"); const fx=await H.ev(FX_CFG);
      note("H0 페이지 BAL.fx 기본값(계약 3.4) · 도구는 바꾸지 않는다",{ok:Object.keys(FXD).every(k=>fx[k]===FXD[k])&&fx.autoEnd===true,detail:JSON.stringify(fx)});
      await H.click('button[onclick="startMode(\'pvp\')"]'); await sleep(150); await H.click('button[onclick="autoPlace()"]'); await sleep(120); await H.click('#sidePanel button.primary'); await sleep(250);
      const h0=await st(H); note("H1 P1 배치 완료(실제 버튼) → 'P2 배치' 기기 넘김 모달 · 배너 없음",{ok:h0.overlay&&/기기를 넘기세요/.test(h0.ovTitle)&&!h0.banner.visible,detail:h0.ovTitle});
      await H.clickText("#obBtns","확인"); await sleep(150); await H.click('button[onclick="autoPlace()"]'); await sleep(120); await H.click('#sidePanel button.primary'); await sleep(300);
      const h1=await st(H); await H.shot("hotseat-handoff-before-banner");
      note("H2 플레이 시작: 턴 시작 기기 넘김 모달이 먼저 · 배너·잠금 없음",{ok:h1.phase==="play"&&h1.overlay&&/기기를 넘기세요/.test(h1.ovTitle)&&!h1.banner.visible&&!h1.locked,detail:h1.ovTitle});
      const since=Date.now(); await H.clickText("#obBtns","확인"); await sleep(200); const h2=await st(H);
      note("H3 확인 → '나의 턴!' 배너(핫시트는 항상 나의 턴) · 잠금 · 모달 닫힘",{ok:h2.banner.visible&&h2.banner.title==="나의 턴!"&&h2.locked&&!h2.overlay,detail:h2.banner.title});
      await H.shot("hotseat-my-turn-banner");
      const own=await H.ev(`(()=>{ const p=S.pieces.find(x=>x.owner===S.current&&x.placed&&x.type==="minion"); return [p.r,p.c]; })()`); await H.click(cell(own[0],own[1])); await sleep(100);
      note("H4 배너 중 자기 말 클릭 무시(선택 없음)",{ok:(await st(H)).sel===null});
      await until(()=>unlocked(H),8000,"배너 종료"); const sp=bannerSpans(await H.ev(OBS(since))); if(sp[0]&&sp[0].ms) tnote("H5 핫시트 턴 배너 시간",sp[0].ms,FXD.turnBanner);
      const tn=(await st(H)).turn; const tSkip=Date.now(); await H.click('#turnBar button:nth-child(1)'); await until(async()=>(await st(H)).turn===tn+1,12000,"자동 종료"); const tEnd=Date.now()-tSkip; await sleep(150); const h3=await st(H);
      note("H6 주 행동 생략 → 자동 턴 종료("+tEnd+"ms ≥ grace 1000) → 다음 플레이어 기기 넘김 모달이 배너보다 먼저",{ok:tEnd>=900&&h3.turn===tn+1&&h3.overlay&&/기기를 넘기세요/.test(h3.ovTitle)&&!h3.banner.visible&&!h3.locked,detail:h3.ovTitle});
      await H.clickText("#obBtns","확인"); await sleep(200); const h4=await st(H); note("H7 확인 → 다음 플레이어 '나의 턴!' 배너",{ok:h4.banner.visible&&h4.banner.title==="나의 턴!"});
      await until(()=>unlocked(H),8000,"배너 종료");
      await H.setVP(NARROW); const L=await H.ev(LAYOUT); await H.shot("hotseat-390px-board");
      note("H8 [관찰·판정 제외] 390px 보드 화면: 문서 가로 넘침 · 보드·턴바 버튼 화면 밖 — #106 범위 밖 기존 레이아웃",{warn:true,ok:L.docW<=L.vw+1&&L.boardRight<=L.vw+1&&L.turnOut===0,detail:JSON.stringify(L)});
      await H.setVP(VP); const eh=await H.ev(CONSOLE_ERR); note("H9 핫시트 콘솔 오류 0",{ok:eh.length===0,detail:JSON.stringify(eh).slice(0,200)});
      await H.close();
    }

    /* ═══ pve ═══ */
    if(SECTIONS.includes("pve")){
      const V=await tab("PVE");
      await V.click('button[onclick="startMode(\'pve\',{aiLevel:\'grade5\'})"]'); await sleep(150); await V.click('button[onclick="autoPlace()"]'); await sleep(120); await V.click('#sidePanel button.primary'); await sleep(300);
      await V.ev(HOOK_AI); const v0=await st(V);
      note("P1 PVE 시작(실제 버튼: 5급·무작위 배치·배치 완료) → 첫 턴 배너",{ok:v0.phase==="play"&&v0.banner.visible&&/턴!/.test(v0.banner.title),detail:`선공 ${v0.cur===0?"나":"AI"} '${v0.banner.title}'`});
      if(v0.cur===1){ const s0=Date.now(); await until(async()=>{ const s=await st(V); return s.cur===0&&!s.locked&&!s.battle&&!s.overlay; },60000,"내 턴");
        const steps=await V.ev(`(()=>window.__ai.filter(x=>x.k==="step"))()`), bn=bannerSpans(await V.ev(OBS(s0-3000))).filter(x=>x.title==="상대 턴!")[0];
        note("P1b AI 선공: '상대 턴!' 배너 뒤에만 aiStep (잠금 중 호출 0) → 내 턴",{ok:!!bn&&steps.length>=1&&steps.every(x=>!x.locked),detail:`steps ${steps.length}`}); }
      await until(()=>unlocked(V),15000,"idle");
      const fx=await V.ev(`(()=>{ for(const e of S.pieces.filter(p=>p.owner===1&&p.alive&&p.placed&&p.type==="minion")){ const r=e.r+2, c=e.c; if(r>13||at(r,c)||at(r-1,c)) continue; if([[r,c-1],[r,c+1],[r-1,c-1],[r-1,c+1]].some(([rr,cc])=>{ const q=at(rr,cc); return q&&q.owner===1; })) continue; const m=S.pieces.find(p=>p.owner===0&&p.alive&&p.placed&&p.type==="minion"&&p.skills); m.r=r; m.c=c; render(); return {m:m.id,e:e.id,r,c}; } return null; })()`);
      fixtures.push({label:"F-pve 내 하수인을 AI 하수인 2칸 아래로 재배치 (로컬 전용, 규칙 무변경)",value:fx}); console.log("FIXTURE F-pve "+JSON.stringify(fx));
      if(!fx) note("P2 PVE 픽스처 실패 — 전투 미측정",{ok:false});
      else {
        const since=Date.now(); await V.click(cell(fx.r,fx.c)); await sleep(120); await V.click(cell(fx.r-1,fx.c)); await sleep(200); const s1=await st(V);
        note("P2 실제 클릭 이동 → AI 하수인과 신규 인접 → 강제 전투(규칙 즉시) · 접촉 배너",{ok:!!s1.battle&&s1.banner.visible&&/접촉/.test(s1.banner.title),detail:s1.banner.title});
        await until(()=>unlocked(V),30000,"메뉴"); const sp=bannerSpans(await V.ev(OBS(since)));
        note("P3 PVE 진입 연출: 접촉 → '배틀을 시작합니다.' → 3·2·1·배틀 시작! → '나의 턴!'",{ok:sp[1]&&sp[1].sub==="배틀을 시작합니다."&&sp.slice(2,6).map(x=>x.title).join(",")==="3,2,1,배틀 시작!"&&sp[6]&&sp[6].title==="나의 턴!",detail:seqOf(sp)});
        await V.shot("pve-battle-menu-my-turn");
        let my=0; const aiGaps=[];
        for(const t0=Date.now();Date.now()-t0<300000;){ const s=await st(V); if(!s.battle) break; if(s.locked||s.playing){ await sleep(150); continue; }
          if(s.actor===0){ await V.clickText("#bmenu","⚔️ 싸우기"); await sleep(120); await V.clickText("#bsub-fight .row",await V.ev(FIRST_ENABLED("#bsub-fight .row button"))); my++; await sleep(200); if(my>20) break; }
          else { const bn=bannerSpans(await V.ev(OBS(since))).filter(x=>x.title==="상대 턴!"); const lb=bn[bn.length-1]; const n0=await V.ev(`(()=>window.__ai.filter(x=>x.k==="battle").length)()`);
            await until(async()=>{ const s2=await st(V); return !s2.battle||s2.actor===0||s2.locked||s2.playing||(await V.ev(`(()=>window.__ai.filter(x=>x.k==="battle").length)()`))>n0; },20000,"AI 행동");
            const ai=await V.ev(`(()=>window.__ai.filter(x=>x.k==="battle").slice(-1)[0])()`); if(ai&&lb&&lb.ms!==null) aiGaps.push({gap:ai.t-(lb.t0+lb.ms),locked:ai.locked}); await sleep(200); } }
        await until(async()=>{ const s=await st(V); return !s.battle&&!s.locked&&!s.playing&&!s.overlay; },120000,"PVE 전투 종료");
        const calls=await V.ev(`(()=>window.__ai.filter(x=>x.k==="battle"))()`);
        note(`P4 PVE 전투 완주 (내 클릭 ${my} · AI 행동 ${calls.length}) · AI 는 잠금 중 한 번도 행동하지 않음 · 라운드 배너 종료 후 aiDelay(650ms) 뒤 행동`,{ok:calls.length>=1&&calls.every(x=>!x.locked)&&aiGaps.length>=1&&aiGaps.every(x=>x.gap>=550),detail:`gaps ${aiGaps.map(x=>x.gap).join("/")}ms`});
        const rb=bannerSpans(await V.ev(OBS(since))).filter(x=>/result/.test(x.cls)); note("P5 결과 배너(뷰어 기준 승/패 또는 포획·도망 종료)",{ok:!!rb[0]&&/전투에서 (승리|패배)|포획 성공! 전투 종료|도망 성공 — 전투 종료/.test(rb[0].title),detail:rb[0]&&rb[0].title}); if(rb[0]&&rb[0].ms) tnote("P5b 결과 배너 시간",rb[0].ms,FXD.resultBanner);
        const tn=(await st(V)).turn; const since2=Date.now();
        try{ await until(async()=>(await st(V)).turn===tn+1,10000,"auto"); }catch(e){ await until(()=>unlocked(V),20000,"idle"); await V.click('#turnBar button.primary'); await until(async()=>(await st(V)).turn===tn+1,15000,"manual"); }
        { const t0=Date.now(); for(;;){ const s=await st(V); if(s.turn>=tn+2&&s.cur===0&&!s.battle) break; if(Date.now()-t0>240000) throw new Error("대기 시간 초과: AI 턴 완료·내 턴 복귀"); if(s.battle&&s.actor===0&&!s.locked&&!s.playing){ await V.clickText("#bmenu","⚔️ 싸우기"); await sleep(120); await V.clickText("#bsub-fight .row",await V.ev(FIRST_ENABLED("#bsub-fight .row button"))); await sleep(300); } else if(s.overlay&&!s.battle&&s.obtn.length&&!s.locked){ await V.click("#obBtns button:first-child"); await sleep(200); } else await sleep(150); } }
        const bn2=bannerSpans(await V.ev(OBS(since2))).filter(x=>x.title==="상대 턴!")[0]; const steps=await V.ev(`(()=>window.__ai.filter(x=>x.k==="step"&&x.t>=${since2}))()`);
        note("P6 AI 턴: '상대 턴!' 배너 동안 aiStep 호출 없음 → 배너 뒤 행동 → 턴 종료 → 내 턴 복귀",{ok:!!bn2&&steps.length>=1&&steps.every(x=>!x.locked&&x.t>=bn2.t0+bn2.ms-50)&&(await st(V)).cur===0,detail:`banner ${bn2&&bn2.ms}ms steps ${steps.length} firstGap ${steps[0]&&bn2?steps[0].t-(bn2.t0+bn2.ms):"?"}ms`});
        if(bn2&&bn2.ms) tnote("P7 PVE 상대 턴 배너 시간",bn2.ms,FXD.turnBanner);
        await V.shot("pve-board-after-ai-turn"); const ev=await V.ev(CONSOLE_ERR); note("P8 PVE 콘솔 오류 0",{ok:ev.length===0,detail:JSON.stringify(ev).slice(0,200)});
      }
      await V.close();
    }

    /* ═══ online ═══ */
    if(SECTIONS.includes("online")){
      const A=await tab("A"), B=await tab("B"); let P1=null,P2=null;
      for(const [T,SU] of [[A,P1_SETUP],[B,P2_SETUP]]){
        await T.ev(SET_CODE(server.code)); await T.click('button[onclick="netPrepare()"]'); await sleep(150);
        for(const rid of SU.roster){ await T.click(`.rosterCard[onclick="rosterInfo('${rid}')"]`); await sleep(80); await T.click('#obBtns button:first-child'); await sleep(80); }
        const used={}; for(const p of await T.ev(OWN_PIECES)){ const k=used[p.type]=(used[p.type]||0); used[p.type]++; const [r,c]=SU.pos[p.type][k]; await T.click(`.trayItem[onclick="selTray(${p.id})"]`); await T.click(cell(r,c)); }
        const s=await T.ev(`(()=>({placed:S.pieces.filter(x=>x.owner===0&&x.placed).length,roster:S.roster[0].slice()}))()`);
        note(`O1${T.name} 탭${T.name}: 로스터 6종 카드 클릭 · 14개 트레이→칸 클릭 배치`,{ok:s.placed===14&&s.roster.join()===SU.roster.join(),detail:`placed=${s.placed}`});
        await T.click('#sidePanel button.primary'); await sleep(200); if(T===A) await until(()=>A.ev(`(()=>NET.queued&&!!NET.ws&&NET.ws.readyState===1)()`),8000,"A 큐 진입"); }
      await until(async()=>{ const a=await st(A), b=await st(B); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"온라인 매칭·시작");
      const sa=await st(A); if(sa.me!==0) throw new Error("A 탭이 P1 이 아니다 (me="+sa.me+")"); P1=A; P2=B; P1.name="P1"; P2.name="P2";
      const bothIdle=async()=>(await unlocked(P1))&&(await unlocked(P2)); const same=async()=>(await P1.ev(SNAP))===(await P2.ev(SNAP));
      const settle=async(label,ms)=>until(async()=>(await bothIdle())&&(await same()),ms||60000,label);
      const actorTab=async()=>((await st(P1)).actor===0?P1:P2); const turnNo=async()=>(await st(P1)).turn;
      const fixture=async(label,expr)=>{ for(const T of [P1,P2]) await T.ev(expr); const ok=await same(); fixtures.push({label,same:ok}); console.log("FIXTURE "+label+(ok?"":" (양 탭 불일치!)")); if(!ok) note("FIXTURE "+label+" 양 탭 동일",{ok:false}); };
      const endTurn=async(T,label,wait)=>{ const n=await turnNo(); try{ await until(async()=>(await turnNo())===n+1,wait||12000,"auto"); return true; }catch(e){ await until(()=>unlocked(T),30000,"idle"); await T.click('#turnBar button.primary'); await until(async()=>(await turnNo())===n+1,20000,"manual "+label); return false; } finally{ await settle("turn "+label,90000); } };
      const skip=async T=>{ await until(()=>unlocked(T),60000,"idle"); await T.click('#turnBar button:nth-child(1)'); return endTurn(T,"skip"); };
      const untilActor=async T=>{ for(let g=0;g<20&&(await actorTab())!==T;g++) await skip(await actorTab()); await until(()=>unlocked(T),60000,"actor idle"); };
      const moveOnly=async(T,id,r,c)=>{ await until(()=>unlocked(T),60000,"idle"); const p0=await T.ev(PIECE(id)); await T.click(cell(p0.r,p0.c)); await sleep(120); if((await st(T)).sel!==id) throw new Error("선택 실패 "+id); await T.click(cell(r,c)); await sleep(150); const p1=await T.ev(PIECE(id)); if(p1.r!==r||p1.c!==c) throw new Error(`이동 실패 ${id} → (${r},${c})`); };
      note("O2 실제 서버 매칭 — A=P1 · B=P2 · 선공 P"+(sa.cur+1)+" · 양 탭 동일",{ok:sa.me===0&&(await st(B)).me===1});
      await settle("시작 정착");
      const idAt=async(r,c)=>(await P1.ev(PIECE_AT(r,c))); const L2=await idAt(11,1), W3=await idAt(3,1), F1=await idAt(11,5), ALLY=await idAt(3,5);
      note("O3 대본 전제: P1 M-L2 (11,1) · P2 M-W3 (3,1) · P1 M-F1 (11,5) · P2 동료 (3,5)",{ok:L2&&L2.rosterId==="M-L2"&&W3&&W3.rosterId==="M-W3"&&F1&&F1.rosterId==="M-F1"&&ALLY&&ALLY.type==="ally"});

      /* B1 */
      await untilActor(P1);
      await fixture("F-B1 P1 M-L2 를 (11,1)→(5,1) 재배치 (양 탭)",`(()=>{ const p=S.pieces.find(x=>x.id===${L2.id}); p.r=5; p.c=1; render(); return true; })()`);
      { const since=Date.now(); await moveOnly(P1,L2.id,4,1); await until(async()=>(await bothIdle())&&(await same()),120000,"B1 진입"); const m=bannerSpans(await P1.ev(OBS(since))), t=bannerSpans(await P2.ev(OBS(since)));
        note("B1a 실제 클릭 접촉 → 접촉 → '배틀을 시작합니다.' → 3·2·1·배틀 시작! → 라운드 배너 (양 탭, 거울 문구)",{ok:m[1]&&m[1].sub==="배틀을 시작합니다."&&m.slice(2,6).map(x=>x.title).join(",")==="3,2,1,배틀 시작!"&&m[6]&&/턴!/.test(m[6].title)&&t[1]&&t[1].sub==="상대가 내 하수인에게 배틀을 걸었습니다."&&t[6]&&/턴!/.test(t[6].title),detail:`${seqOf(m)} || ${seqOf(t)}`});
        for(const [i,k] of [[2,"3"],[5,"배틀 시작!"]]) if(m[i]&&m[i].ms) tnote(`B1b 카운트 '${k}' 시간`,m[i].ms,FXD.countStep); if(m[6]&&m[6].ms) tnote("B1c 라운드 배너 시간",m[6].ms,FXD.roundBanner);
        const s=await st(P1); const AT=s.actor===0?P1:P2, OT=AT===P1?P2:P1; const meL2=AT===P1;
        const bm=await AT.ev(BTN_TEXT("#bmenu button")), bmO=await OT.ev(BTN_TEXT("#bmenu button"));
        note("B1d 4카테고리 ⚔️ 싸우기 / 🎒 가방 / 🔴 포획 / 🏃 도망가기 — 행동자 활성 · 상대 탭 비활성",{ok:bm.map(b=>b[0]).join("|")==="⚔️ 싸우기|🎒 가방|🔴 포획|🏃 도망가기"&&bm.every(b=>!b[1])&&bmO.length===4&&bmO.every(b=>b[1]),detail:bm.map(b=>b[0]).join(",")});
        await AT.shot("b1-menu-root-actor"); await OT.shot("b1-menu-root-mirror");
        const n0=(await AT.ev(SENT_A)).length, snap0=await AT.ev(SNAP); const subs={};
        for(const [k,txt] of [["fight","⚔️ 싸우기"],["bag","🎒 가방"],["ball","🔴 포획"],["flee","🏃 도망가기"]]){ await AT.clickText("#bmenu",txt); await sleep(120); subs[k]=await AT.ev(SUB(k)); if(k==="fight") await AT.shot("b1-submenu-fight"); if(k==="ball") await AT.shot("b1-submenu-capture-guard"); await AT.clickText("#bsub-"+k,"← 뒤로"); await sleep(100); }
        note("B1e 하위 메뉴 4개 열고 닫기: 루트 숨김/패널 표시 전환 · 송신 프레임 0 · S 무변경",{ok:Object.values(subs).every(v=>v.shown&&v.root)&&(await AT.ev(SENT_A)).length===n0&&(await AT.ev(SNAP))===snap0,detail:`frames ${n0}`});
        note("B1f 싸우기: 기술 4슬롯 · 기본 공격 버튼 없음",{ok:subs.fight.btns.length===4&&!subs.fight.btns.some(b=>/기본 공격/.test(b[0])),detail:subs.fight.btns.map(b=>b[0]).join(" · ")});
        note("B1g 포획 가드: 상대 HP 30% 이상 → 던지기 비활성 + 사유",{ok:subs.ball.btns.length===1&&subs.ball.btns[0][1]&&/30% 미만이어야/.test(subs.ball.small),detail:subs.ball.small});
        note("B1h 도망 가드: 내 HP 50% 이상 → 도망 비활성 + 사유",{ok:subs.flee.btns.length===1&&subs.flee.btns[0][1]&&/50% 미만이어야/.test(subs.flee.small),detail:subs.flee.small});
        note("B1i 가방: 시작 아이템(D11) 목록 · 상대 탭 '상대 아이템 비공개'",{ok:subs.bag.btns.length>=1&&(await OT.ev(`(()=>/상대 아이템 비공개/.test(document.getElementById("bsub-bag").textContent))()`)),detail:subs.bag.btns.map(b=>b[0]).join(",")});
        await AT.setVP(NARROW); const L1=await AT.ev(LAYOUT); await AT.shot("b1-390px-menu-root"); await AT.clickText("#bmenu","⚔️ 싸우기"); await sleep(150); const L2x=await AT.ev(LAYOUT); await AT.shot("b1-390px-submenu-fight"); await AT.clickText("#bsub-fight","← 뒤로"); await sleep(100); await AT.setVP(VP);
        note("B1j 390px 실제 전투 화면(전투 메뉴): 모달 상자 화면 안·내부 넘침 없음 · 4카테고리/싸우기 버튼 화면 밖·잘림 0",{ok:!L1.boxOverflow&&!L2x.boxOverflow&&L1.boxRight<=L1.vw+1&&L1.menuOut===0&&L2x.menuOut===0&&L1.menuClip===0&&L2x.menuClip===0&&L1.menuVisible,detail:`root ${JSON.stringify(L1)} fight ${JSON.stringify(L2x)}`});
        note("B1j2 [관찰·판정 제외] 390px 보드 페이지(모달 뒤): 문서 가로 넘침 · 턴바 버튼 화면 밖 — #app/#board 고정 폭 CSS 는 dev HEAD 와 동일(#106 범위 밖)",{warn:true,ok:L1.docW<=L1.vw+1&&L1.turnOut===0,detail:`docW ${L1.docW} boardRight ${L1.boardRight} turnOut ${L1.turnOut}/${L1.turnBtns}`});
        // 가방 보너스 행동
        const b0=await st(AT); const since2=Date.now(); const nA=(await AT.ev(SENT_A)).length; await AT.clickText("#bmenu","🎒 가방"); await sleep(120); const item=await AT.ev(FIRST_ENABLED("#bsub-bag .row button"));
        if(item){ await AT.clickText("#bsub-bag .row",item); await sleep(150); const lk=await st(AT); await AT.clickText("#bmenu","⚔️ 싸우기").catch(()=>{}); await sleep(80); await until(()=>bothIdle(),15000,"itemFx 종료"); await sleep(150);
          const it=spans(await AT.ev(OBS(since2)),"msg").find(x=>/🧪/.test(x.v)); const b1=await st(AT); const sent=(await AT.ev(SENT_A)).slice(nA);
          note(`B1k 가방 '${item}' → 연출 중 잠금(카테고리 클릭 무시) → 같은 행동자 루트 메뉴 복귀 (round/phase 불변 · 행동 미소모) · 송신 item 1 · act 0`,{ok:lk.locked&&b1.battle&&b1.battle.r===b0.battle.r&&b1.battle.ph===b0.battle.ph&&b1.battle.menu===null&&b1.actor===b0.actor&&sent.filter(a=>a.t==="item").length===1&&!sent.some(a=>a.t==="act")&&(await same()),detail:`round ${b0.battle.r}.${b0.battle.ph}→${b1.battle&&b1.battle.r}.${b1.battle&&b1.battle.ph} actor ${b0.actor}→${b1.actor} frames ${sent.map(a=>a.t).join(",")}`});
          if(it&&it.ms) tnote("B1l 아이템 연출 시간",it.ms,FXD.itemFx); await AT.shot("b1-after-item-same-actor"); }
        else note("B1k 가방: 활성 아이템 없음 — 보너스 행동 미측정",{ok:false});
        // 전투 완주: P1 고위력 우선 / P2 R1 수호 자세 → R2 불굴 진형 → 침식 수류/기본
        const acts=[]; let shieldAct=null, absorbAct=null, ko=false;
        for(let g=0;g<40;g++){ const a=await st(P1); if(!a.battle) break; await until(()=>bothIdle(),40000,"idle"); const a2=await st(P1); if(!a2.battle) break;
          const T=a2.actor===0?P1:P2; const my=a2.actor===0; await T.clickText("#bmenu","⚔️ 싸우기"); await sleep(120); const fb=await T.ev(BTN_TEXT("#bsub-fight .row button"));
          const pick=my?(fb.find(b=>/연쇄 번개/.test(b[0])&&!b[1])||fb.find(b=>/전기탄/.test(b[0])&&!b[1])||fb.find(b=>!b[1])):((a2.battle.r===1?fb.find(b=>/수호 자세/.test(b[0])&&!b[1]):null)||(a2.battle.r===2?fb.find(b=>/불굴 진형/.test(b[0])&&!b[1]):null)||fb.find(b=>/침식 수류/.test(b[0])&&!b[1])||fb.find(b=>!b[1]));
          const pre=a2.battle; await T.activate(); const since3=Date.now(); const nBefore=(await T.ev(SENT_A)).length; await T.clickText("#bsub-fight .row",pick[0]); await sleep(150); const lk=await st(T); const nS=(await T.ev(SENT_A)).length; await T.clickText("#bmenu","🎒 가방").catch(()=>{}); await sleep(80);
          const polled=[]; { const t0=Date.now(); let lastK=""; for(;;){ const o=await T.ev(BARS_NOW); const k=[o["hpfill-A"],o["hpfill-D"],o["shfill-A"],o["shfill-D"]].join(","); if(k!==lastK){ lastK=k; polled.push(o); } const s2=await st(P1); if(!s2.battle||((await bothIdle())&&(await same()))) break; if(Date.now()-t0>60000) throw new Error("대기 시간 초과: action"); await sleep(20); } }
          const ob=await T.ev(OBS(since3)); const ms=spans(ob,"msg"); const skill=ms.find(x=>/의 [^!\n]+!/.test(x.v.split("\n")[0])&&!/피해!|쓰러졌다/.test(x.v)), dmg=ms.find(x=>/피해!/.test(x.v)), eff=ms.find(x=>/보호막/.test(x.v));
          const post=(await st(P1)).battle; const oppS=my?"D":"A", selfS=my?"A":"D"; const hpB=spans(ob,"hp"+oppS).map(x=>x.v), shB=spans(ob,"sh"+oppS).map(x=>x.v), shSelf=spans(ob,"sh"+selfS).map(x=>x.v);
          const wr=await T.ev(WRITES(since3)); const bars=(await T.ev(BARS(since3))).concat(polled).sort((a,b)=>a.t-b.t); const rec={bars,r:pre.r,ph:pre.ph,actor:a2.actor,pick:pick[0],writes:wr.map(x=>x.id+"="+x.v),skillMs:skill?skill.ms:null,dmgMs:dmg?dmg.ms:null,effMs:eff?eff.ms:null,lockedAfterClick:lk.locked,actFrames:nS-nBefore,extraFrames:(await T.ev(SENT_A)).length-nS,msgs:ms.map(x=>[x.v.split("\n")[0].slice(0,40),x.ms]),pre:{hpA:pre.hpA,hpD:pre.hpD,shA:pre.shA,shD:pre.shD},post:post&&{hpA:post.hpA,hpD:post.hpD,shA:post.shA,shD:post.shD},hpBar:hpB,shBar:shB,shSelf,dmgTxt:dmg&&dmg.v.split("\n")[0]};
          acts.push(rec); if(!shieldAct&&/수호 자세/.test(pick[0])) shieldAct=rec; if(!absorbAct&&dmg&&/흡수/.test(dmg.v)) absorbAct=rec; if(ms.some(x=>/쓰러졌다/.test(x.v))) ko=true; }
        const fa=acts.find(x=>x.dmgMs);
        note("B1m 싸우기: 기술 연출 그룹 → 피해 그룹 (첫 피해 행동)",{ok:!!fa&&fa.skillMs!==null,detail:fa?`${fa.pick}: 기술 ${fa.skillMs}ms → 피해 ${fa.dmgMs}ms`:"없음"});
        if(fa&&fa.skillMs) tnote("B1n 기술 연출 시간",fa.skillMs,FXD.skillFx); if(fa&&fa.dmgMs) tnote("B1o 피해 연출 시간",fa.dmgMs,FXD.damageFx);
        note("B1p 기술 클릭 직후 잠금 · 행동당 act 프레임 1 · 잠금 중 카테고리 클릭 송신 0 (전 행동)",{ok:acts.length>0&&acts.every(x=>x.lockedAfterClick&&x.actFrames===1&&x.extraFrames===0),detail:acts.map(x=>`${x.r}.${x.ph}:${x.actFrames}/${x.extraFrames}`).join(" ")});
        const dmgActs=acts.filter(x=>x.dmgMs!==null); note(`B1q 모든 피해 행동(${dmgActs.length}) 기술≥2초·피해≥2초 (마지막 KO 그룹은 결과 배너로 이어져 제외)`,{ok:dmgActs.length>0&&dmgActs.slice(0,-1).every(x=>x.skillMs>=FXD.skillFx-120&&x.dmgMs>=FXD.damageFx-120),detail:dmgActs.map(x=>`${x.r}.${x.ph} ${x.pick}: ${x.skillMs}/${x.dmgMs}`).join(" · ")+(dmgActs.some(x=>x.skillMs===null)?" | msgs "+JSON.stringify(dmgActs.filter(x=>x.skillMs===null).map(x=>x.msgs)):"")});
        note("B1r 방어막 바: 수호 자세 → shield 22 (=round(120×18%)) · 방어막 바 너비 갱신 · 효과 연출 2초",{ok:!!shieldAct&&shieldAct.post&&shieldAct.post.shD===22&&shieldAct.shSelf.some(v=>parseFloat(v)>17)&&shieldAct.effMs>=FXD.damageFx-120,detail:shieldAct?`shield ${shieldAct.pre.shD}→${shieldAct.post.shD} bar ${shieldAct.shSelf.join(",")} eff ${shieldAct.effMs}ms`:"미발생"});
        { const w=absorbAct?absorbAct.writes:[]; const oppS=absorbAct&&absorbAct.actor===0?"D":"A"; const iSh=w.findIndex(x=>x.startsWith("shfill-"+oppS)), iHp=w.findIndex(x=>x.startsWith("hpfill-"+oppS));
          note("B1s2 시간 순서(style.width 쓰기 시퀀스 트랩): 흡수 피해 그룹에서 방어막 바 쓰기가 HP 바 쓰기보다 먼저",{ok:iSh>=0&&iHp>=0&&iSh<iHp,detail:`writes ${w.join(" → ")}`}); }
        { const A=absorbAct; let d={}; let ok=false; if(A){ const oppS=A.actor===0?"D":"A", hk="hpfill-"+oppS, sk="shfill-"+oppS; const dmgT=A.msgs; const bs=A.bars.filter(b=>b[hk]!==null&&b[sk]!==null);
            const hp0=bs.length?bs[0][hk]:null, sh0=bs.length?bs[0][sk]:null; const iSh=bs.findIndex(b=>b[sk]<sh0-0.4), iHp=bs.findIndex(b=>b[hk]<hp0-0.4);
            const tS=iSh>=0?bs[iSh].t:null, tH=iHp>=0?bs[iHp].t:null; const hpAtS=iSh>=0?bs[iSh][hk]:null; const shEnd=bs.filter(b=>b[sk]!==sh0).slice(-1)[0], hpEnd=bs.filter(b=>b[hk]!==hp0).slice(-1)[0];
            const hpStillOld=hpAtS!==null&&Math.abs(hpAtS-hp0)<=0.5; ok=tS!==null&&tH!==null&&tS<tH&&hpStillOld&&(hpEnd?hpEnd.t-tS<=FXD.damageFx+200:false);
            d={sh0,hp0,tShieldStart:tS?tS-bs[0].t:null,tHpStart:tH?tH-bs[0].t:null,hpWidthAtShieldStart:hpAtS,shieldEnd:shEnd?shEnd.t-bs[0].t:null,hpEnd:hpEnd?hpEnd.t-bs[0].t:null,samples:bs.length}; }
          note("B1s3 실제 바 너비 시퀀스(getBoundingClientRect 16ms 샘플): 방어막 바가 먼저 줄기 시작 · 그 시점 HP 바는 옛 너비 유지 · 그 뒤 HP 바 감소 · 전체가 피해 연출 2초 안에 완료",{ok,detail:JSON.stringify(d)}); }
        note("B1s 흡수 산술: 방어막 감소 = 흡수량 · 나머지만 HP · 문구 '(흡수 N)' · 두 바 모두 갱신 (시간 순서는 B1s2)",{ok:!!absorbAct&&absorbAct.post&&absorbAct.pre.shD>absorbAct.post.shD&&absorbAct.shBar.length>=1&&absorbAct.hpBar.length>=1&&(absorbAct.pre.shD-absorbAct.post.shD)===Number((absorbAct.dmgTxt.match(/흡수 (\d+)/)||[])[1]),detail:absorbAct?`${absorbAct.dmgTxt} shield ${absorbAct.pre.shD}→${absorbAct.post.shD} hp ${absorbAct.pre.hpD}→${absorbAct.post.hpD}`:"미발생"});
        note("B1t HP바 전환(.6s)이 피해 연출 2초 안에 끝남",{ok:(await P1.ev(`(()=>{ const el=document.createElement("div"); el.className="hpbar"; const d=document.createElement("div"); el.appendChild(d); document.body.appendChild(el); const t=getComputedStyle(d).transitionDuration; el.remove(); return t; })()`)).split(",").every(x=>parseFloat(x)*1000<=FXD.damageFx)});
        await settle("B1 종료",60000); ko=spans(await P1.ev(OBS(since)),"msg").some(x=>/쓰러졌다/.test(x.v)); const l2=await P1.ev(PIECE(L2.id)), w3=await P1.ev(PIECE(W3.id)); const winner=l2.alive&&!w3.alive?0:(!l2.alive&&w3.alive?1:null);
        const ra=bannerSpans(await P1.ev(OBS(since))).filter(x=>/result/.test(x.cls)), rb=bannerSpans(await P2.ev(OBS(since))).filter(x=>/result/.test(x.cls));
        note("B1u KO('쓰러졌다!') → 결과 배너 뷰어 기준: P1 '"+(ra[0]&&ra[0].title)+"' / P2 '"+(rb[0]&&rb[0].title)+"' · 양 탭 동일",{ok:winner!==null&&ko&&ra[0]&&rb[0]&&ra[0].title===(winner===0?"전투에서 승리!":"전투에서 패배,,,")&&rb[0].title===(winner===0?"전투에서 패배,,,":"전투에서 승리!")&&(await same()),detail:`winner P${winner===null?"?":winner+1} L2 hp=${l2.hp} W3 alive=${w3.alive} acts=${acts.length}`});
        if(ra[0]&&ra[0].ms) tnote("B1v 결과 배너 시간",ra[0].ms,FXD.resultBanner);
        await P1.shot("b1-board-after-battle"); await endTurn(P1,"B1 후"); }

      /* B2: 동료 출전 선택 → 6라운드 → 동률 */
      await untilActor(P1);
      await fixture("F-B2 P1 M-F1 (11,5)→(5,5) 재배치 · M-F1·P2 동료 hp=maxHp=1000 (양 탭)",`(()=>{ const p=S.pieces.find(x=>x.id===${F1.id}); p.r=5; p.c=5; for(const id of [${F1.id},${ALLY.id}]){ const q=S.pieces.find(x=>x.id===id); q.maxHp=1000; q.hp=1000; } render(); return true; })()`);
      { const since=Date.now(); await moveOnly(P1,F1.id,4,5); await sleep(400); const d1=await st(P1), d2=await st(P2);
        note("B2a 접촉 배너 중(잠금): 방어 동료는 예비 하수인이 없어 출전 선택이 자동(본체) → 행동자 P1 에 '출전 공개' 동기 모달(전투 시작 버튼) · P2 는 대기 화면 · 양 탭 잠금",{ok:d1.locked&&d2.locked&&d1.overlay&&/출전 공개/.test(d1.ovTitle)&&d1.obtn.some(b=>/전투 시작/.test(b[0]))&&d2.overlay&&/상대 선택 대기/.test(d2.ovTitle),detail:`P1 '${d1.ovTitle}' P2 '${d2.ovTitle}'`});
        const nB=(await P1.ev(SENT_A)).length; await P1.clickText("#obBtns","전투 시작").catch(()=>{}); await sleep(150);
        note("B2b 잠금 중 소유자(P1) 모달 버튼 클릭 무시 · 송신 0 · 전투 미개시",{ok:(await P1.ev(SENT_A)).length===nB&&!(await st(P1)).battle});
        await until(()=>bothIdle(),20000,"배너 종료"); const sp=bannerSpans(await P1.ev(OBS(since))), spB=bannerSpans(await P2.ev(OBS(since)));
        note("B2c 접촉 → '배틀을 시작합니다.' / 거울 '상대가 내 동료에게 배틀을 걸었습니다.' → 잠금 해제 → 모달 재개(P1 클릭 가능)",{ok:sp[1]&&sp[1].sub==="배틀을 시작합니다."&&spB[1]&&spB[1].sub==="상대가 내 동료에게 배틀을 걸었습니다."&&(await st(P1)).overlay&&!(await st(P1)).locked,detail:`${seqOf(sp)} || ${seqOf(spB)}`});
        await P1.shot("b2-reveal-modal-owner-p1"); await P2.shot("b2-reveal-modal-wait-p2");
        const s1=await st(P1); note("B2d 출전 공개 모달 내용: 공격 하수인 vs 방어 동료 · 양측 revealed 는 모달 시점에 이미 설정",{ok:/출전 공개/.test(s1.ovTitle)&&(await P1.ev(`(()=>/공격: .+ vs 방어: 동료/.test(document.getElementById("overlayBox").textContent))()`)),detail:s1.ovTitle});
        const since2=Date.now(); await P1.clickText("#obBtns","전투 시작"); await sleep(200); note("B2d2 '전투 시작' 클릭 → modal 프레임 1 송신 → 양 탭 전투 진입",{ok:(await P1.ev(SENT_A)).slice(nB).filter(a=>a.t==="modal").length===1&&!!(await st(P2)).battle}); await until(()=>bothIdle(),30000,"카운트다운"); await settle("B2 시작"); const sp2=bannerSpans(await P1.ev(OBS(since2)));
        note("B2e 전투 시작 → 3·2·1·배틀 시작! → 라운드 배너",{ok:sp2.slice(0,4).map(x=>x.title).join(",")==="3,2,1,배틀 시작!"&&sp2[4]&&/턴!/.test(sp2[4].title),detail:seqOf(sp2)});
        let n=0, fixed=false;
        for(let g=0;g<40;g++){ const a=await st(P1); if(!a.battle) break; await until(()=>bothIdle(),40000,"idle"); const a2=await st(P1); if(!a2.battle) break;
          const T=a2.actor===0?P1:P2; const last=a2.battle.r===6&&a2.battle.ph===1; n++;
          if(last){ if(T!==P1) throw new Error("12번째 행동자가 P1 이 아니다"); await fixture("F-tie 12번째 행동 직전: 양측 hp=maxHp · P1 응급 치유 쿨 0 (양 탭)",`(()=>{ S.battle.fa.hp=S.battle.fa.maxHp; S.battle.fd.hp=S.battle.fd.maxHp; S.battle.fa.cds[2]=0; return true; })()`); fixed=true; }
          await T.clickText("#bmenu","⚔️ 싸우기"); await sleep(120); await T.clickText("#bsub-fight .row",last?"응급 치유":(T===P1?"화염탄":"기본 공격")); await sleep(150);
          await until(async()=>{ const s2=await st(P1); return !s2.battle||((await bothIdle())&&(await same())); },60000,"action"); }
        await settle("B2 종료",60000); const ob=await P1.ev(OBS(since2)); const msg=spans(ob,"msg"); const jud=msg.find(x=>/남은 HP 비율로 판별합니다!/.test(x.v)), pctLine=msg.find(x=>/100% vs .*100%/.test(x.v));
        const ra=bannerSpans(ob).filter(x=>/result/.test(x.cls)), rb=bannerSpans(await P2.ev(OBS(since2))).filter(x=>/result/.test(x.cls)); const m=JSON.parse(await P1.ev(SNAP)).m; const f1=await P1.ev(PIECE(F1.id)), al=await P1.ev(PIECE(ALLY.id));
        note(`B2f 12행동 완주(실제 클릭 ${n}) → 판정 배너 '⚖️ 남은 HP 비율로 판별합니다!' → '100% vs 100%'`,{ok:n===12&&fixed&&!!jud&&!!pctLine,detail:`${jud&&jud.v.split("\n")[0]} | ${pctLine&&pctLine.v}`});
        if(jud&&jud.ms) tnote("B2g 판정 배너 시간",jud.ms,FXD.judgeBanner);
        note("B2h 동률 → 방어자(P2 동료) 승: ties +1 · judged +1 · P1 M-F1 제거 · 동료 생존 · 결과 배너 P1 '전투에서 패배,,,' / P2 '전투에서 승리!' · 양 탭 동일",{ok:m.ties>=1&&m.judged>=1&&!f1.alive&&al.alive&&ra[0]&&ra[0].title==="전투에서 패배,,,"&&rb[0]&&rb[0].title==="전투에서 승리!"&&(await same()),detail:`ties=${m.ties} judged=${m.judged} P1 '${ra[0]&&ra[0].title}' P2 '${rb[0]&&rb[0].title}'`});
        await P1.shot("b2-board-after-tie"); }
      /* BT65: 양 탭 동일 픽스처 S.turnCount=63 → 실제 [주 행동 생략]/자동 종료 → 표시 65턴 진입: '버닝타임입니다! 2칸씩 이동 가능합니다' 2초 → 턴 배너 2초 (양 탭 같은 순서 · 행동자 endTurn 프레임 1 · rand 0) */
      { await until(()=>bothIdle(),60000,"idle"); const AT=await actorTab(); const OT=AT===P1?P2:P1;
        await fixture("F-bt65 양 탭 S.turnCount=63 (표시 64턴) · btReached false · rand() 호출 계수 래퍼(관측 전용)",`(()=>{ S.turnCount=63; S.metrics.btReached=false; S.btBannerDue=false; window.__randN=0; if(!window.__randW){ window.__randW=true; const r=rand; rand=function(){ window.__randN++; return r.apply(this,arguments); }; } render(); return S.turnCount; })()`);
        await until(()=>unlocked(AT),30000,"idle"); const since=Date.now(); const s0=[await P1.ev(SENT_A),await P2.ev(SENT_A)].map(x=>x.length);
        if(!(await st(AT)).main) await AT.click('#turnBar button:nth-child(1)');
        await until(async()=>(await st(P1)).turn===64&&(await st(P2)).turn===64,15000,"65턴 진입"); const b1=await st(P1), b2=await st(P2); await P1.shot("bt65-banner-p1"); await P2.shot("bt65-banner-p2");
        await until(()=>bothIdle(),15000,"BT 배너 종료"); await until(()=>same(),15000,"BT 정착");
        const sa=bannerSpans(await P1.ev(OBS(since))), sb=bannerSpans(await P2.ev(OBS(since))); const s1=[await P1.ev(SENT_A),await P2.ev(SENT_A)]; const mine=AT===P1?0:1; const cur=(await st(P1)).cur;
        note("T65a 65턴 진입 순간 양 탭 배너 = '버닝타임입니다! 2칸씩 이동 가능합니다' (스크린샷 시점)",{ok:b1.banner.visible&&b1.banner.title==="버닝타임입니다! 2칸씩 이동 가능합니다"&&b2.banner.visible&&b2.banner.title===b1.banner.title,detail:`P1 '${b1.banner.title}' P2 '${b2.banner.title}'`});
        note("T65b 양 탭 순서: 버닝 타임 배너 → 턴 배너(행동자 '나의 턴!' / 상대 '상대 턴!') · 각 1회",{ok:sa[0]&&sa[0].title==="버닝타임입니다! 2칸씩 이동 가능합니다"&&sa[1]&&sa[1].title===(cur===0?"나의 턴!":"상대 턴!")&&sb[0]&&sb[0].title===sa[0].title&&sb[1]&&sb[1].title===(cur===1?"나의 턴!":"상대 턴!")&&sa.filter(x=>/버닝타임/.test(x.title)).length===1&&sb.filter(x=>/버닝타임/.test(x.title)).length===1,detail:`P1 ${seqOf(sa)} || P2 ${seqOf(sb)}`});
        if(sa[0]&&sa[0].ms) tnote("T65c P1 버닝 타임 배너 시간",sa[0].ms,FXD.turnBanner); if(sb[0]&&sb[0].ms) tnote("T65d P2 버닝 타임 배너 시간",sb[0].ms,FXD.turnBanner); if(sa[1]&&sa[1].ms) tnote("T65e 이어지는 턴 배너 시간",sa[1].ms,FXD.turnBanner);
        const dA=s1[0].slice(s0[0]), dB=s1[1].slice(s0[1]); const mineD=mine===0?dA:dB, otherD=mine===0?dB:dA; const rn=[await P1.ev("window.__randN"),await P2.ev("window.__randN")];
        note("T65f 프레임: 행동자만 skipMain(있으면)+endTurn 송신 · 상대 0 · 배너로 인한 프레임 없음 · rand() 호출 0 (양 탭) · S 동일",{ok:mineD.filter(a=>a.t==="endTurn").length===1&&mineD.every(a=>a.t==="endTurn"||a.t==="skipMain")&&otherD.length===0&&rn[0]===0&&rn[1]===0&&(await same()),detail:`actor ${mineD.map(a=>a.t).join(",")} other ${otherD.length} rand ${rn.join("/")}`});
        const bt2=await P1.ev(`(()=>({reached:S.metrics.btReached,enter:S.metrics.btEnterTurn,due:S.btBannerDue,bt:isBurning()}))()`); note("T65g 규칙 상태: btReached·btEnterTurn=65 · btBannerDue 소비 · isBurning",{ok:bt2.reached&&bt2.enter===65&&!bt2.due&&bt2.bt,detail:JSON.stringify(bt2)}); }
      const e1=await P1.ev(CONSOLE_ERR), e2=await P2.ev(CONSOLE_ERR); note("O9 콘솔 오류 0 (두 탭)",{ok:e1.length===0&&e2.length===0,detail:JSON.stringify(e1.concat(e2)).slice(0,300)});
      await P1.close(); await P2.close();
    }
  }catch(e){ note("실행",{error:e.message+"\n"+(e.stack||"").split("\n").slice(1,4).join("\n")}); for(const t of tabs) try{ console.log("DIAG "+t.name+" "+JSON.stringify(await t.ev(STATE)).slice(0,500)); }catch(_){} }
  finally{
    if(chrome){ try{ chrome.proc.kill(); }catch(e){} await sleep(400); let removed=false; for(let i=0;i<5&&!removed;i++){ try{ fs.rmSync(chrome.udd,{recursive:true,force:true}); }catch(e){} removed=!fs.existsSync(chrome.udd); if(!removed) await sleep(400); } console.log("CLEANUP chrome pid="+chrome.proc.pid+" killed="+chrome.proc.killed+" profile="+chrome.udd+" removed="+removed); }
    if(server){ try{ server.proc.kill(); }catch(e){} console.log("CLEANUP qa-server pid="+server.proc.pid+" killed="+server.proc.killed); }
  }
  const summary={tool:path.relative(ROOT,__filename).replace(/\\/g,"/"),toolSha256:TOOL_SHA,source:{path:"demo/index.html",ref:REF||"working-tree",sha256:SRC_SHA,gitBlob:SRC_BLOB,bytes:SRC.length,frozenInMemory:true},fxDefaults:FXD,viewport:VP,narrow:NARROW,date:new Date().toISOString(),readOnly:READ_ONLY,sections:SECTIONS,wallMs:Date.now()-T0,shotsSkipped,pass:report.filter(r=>!r.warn&&r.ok!==false&&!r.error).length,fail:bad,warn:warns,assertions:report.length,fixtures,timing,shots,report};
  if(!READ_ONLY){ const f=path.join(OUT,"issue106_browser_audit_report.json"); fs.writeFileSync(f,JSON.stringify(summary,null,2)); console.log("REPORT "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  else console.log("SUMMARY "+JSON.stringify({pass:summary.pass,fail:summary.fail,assertions:summary.assertions,wallMs:summary.wallMs,fixtures:fixtures.map(f=>f.label),timing:timing.map(t=>[t.what,t.ms]),source:summary.source}));
  console.log(`\n=== issue106_browser_audit: pass ${summary.pass} / fail ${summary.fail} / warn(판정 제외) ${warns} · ${Math.round(summary.wallMs/1000)}s${READ_ONLY?" (read-only · 산출물 0)":""} ===`);
  process.exit(bad?1:0);
})();
