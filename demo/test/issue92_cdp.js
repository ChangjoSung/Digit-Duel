/* #92 속성 교차 공격기 교체 — 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 마우스 클릭 · 실제 릴레이 서버 · 온라인 클라이언트 2개)
   사용: node demo/test/issue92_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots]
   --read-only: Saturn 독립 재검증용 — 검증 산출물 0(스크린샷·보고서 JSON 없음), stdout 만. 헤드리스 Chrome 임시 프로필(os.tmpdir()/cross92cdp-*)은
                실행 부수 리소스로 mkdtemp 로 만든 정확한 경로 하나만 종료 시 정리한다(RESOURCE/CLEANUP 행). 검증 전용 릴레이 서버는 PORT=0 임의 포트·루프백.
   흐름:
     [file:// PVE] 1 하수인(불 표준형·쿨 2/1·공개 [0,1])이 숲 recruit 칸에서 실제 [탐색] 클릭 → 후보 모달(감전 침이 나오는 시드) → 실제 [공격기 1과 교체] 클릭
                 → skills[0]=감전 침·쿨 2 승계·공개 [] → 사이드 패널 ⚡표시 → 물 상대와 실제 클릭 전투 → 버튼 "⚡감전 침"·설명 "번개 속성으로 판정"
                 → 실제 버튼 클릭 → 22×1.3=29 피해·감전(화상 아님) (dmgVar 0·shockProb 1 로 고정한 표본 1회)
     [온라인 HTTP] 실제 매칭 2탭 → 행동 측 X 가 실제 클릭으로 탐색 → X 후보 모달 / 대기 측 W 잠금 화면(W DOM 변이·title·aria·URL·로그에 후보 이름 0)
                 → 슬롯0 교체 → 슬롯1 교체 → 유지, 매번 양측 skills·cds·공개·seq·난수 일치 → W 가 X 하수인을 실제 볼 투척으로 포획 → 양측 예비 하수인 동일(교체 기술 승계·쿨 0)
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome + server/node_modules(ws). 외부 패키지 없음. 종료 코드 1 = 판정 실패. memo_cdp/issue96_cdp 의 기동·측정 골격을 재사용한다. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","qa","issue92")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(__dirname,"..","index.html"));
const FILE_URL="file:///"+HTML.replace(/\\/g,"/");

/* ── CDP 배선 (memo_cdp.js 와 같은 방식) ─────────────────────────────────── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"cross92cdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.waiters=[]; this.errors=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){
        if(m.method==="Runtime.exceptionThrown") this.errors.push((m.sessionId||"")+" exception: "+((m.params.exceptionDetails.exception||{}).description||m.params.exceptionDetails.text||"").slice(0,200));
        else if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error") this.errors.push((m.sessionId||"")+" console.error: "+m.params.args.map(a=>a.value||a.description||"").join(" ").slice(0,200));
        const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=()=>rej(new Error("WS 오류 "+url)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* 기존 사용자 서버(8080)를 건드리지 않는다 — PORT=0 임의 포트 · 루프백 · 접속 코드는 서버 stdout 에서 읽는다(이 프로세스 메모리에만 둔다) */
function startServer(){
  return new Promise((res,rej)=>{
    const p=spawn(process.execPath,[path.join(ROOT,"server","server.js")],{env:Object.assign({},process.env,{PORT:"0"}),stdio:["ignore","pipe","pipe"]});
    let out=""; const t=setTimeout(()=>{ try{p.kill();}catch(e){} rej(new Error("서버 기동 대기 시간 초과\n"+out)); },15000);
    const onData=d=>{ out+=d; const m=out.match(/listening on ([\d.]+):(\d+)/), c=out.match(/접속 코드: (\S+)/); if(m&&c){ clearTimeout(t); res({proc:p,host:m[1],port:Number(m[2]),code:c[1]}); } };
    p.stdout.on("data",onData); p.stderr.on("data",onData);
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("서버 종료 "+c+"\n"+out)); });
  });
}

/* ── 페이지 안 스크립트 ───────────────────────────────────────────────────── */
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){} return S.phase; })()`;
const GIVE=`const give=(m,r)=>{ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; };
  const put=(p,r,c)=>{ const occ=S.pieces.find(x=>x.placed&&x.alive&&x.r===r&&x.c===c&&x.id!==p.id); if(occ) occ.placed=false; p.r=r; p.c=c; p.placed=true; p.alive=true; };`;
/* PVE: 불 표준형(M-F1)을 숲(10,4) recruit 칸 위에, 적 물 표준형(M-W1)은 멀리. 감전 침이 후보로 나오는 시드를 골라 둔다 (rand 는 탐색에서 1회만 소비) */
const SCENE_RECRUIT=`(()=>{ ${GIVE} try{ close(); }catch(e){}
  BAL.aiDelay=120000; newGame("pve",{aiLevel:"grade5"}); aiAutoPlace(0); aiAutoPlace(1);
  S.phase="play"; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.movedPiece=null; S.contactSet=[]; S.forcedTargets=[]; S.forcedQueue=[];
  const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"), op=S.pieces.find(x=>x.owner===1&&x.type==="minion");
  give(me,ROSTER.find(r=>r.id==="M-F1")); give(op,ROSTER.find(r=>r.id==="M-W1"));
  put(me,10,4); put(op,2,7); op.revealed=false;
  for(const x of S.pieces) if(x.owner===1&&x.placed&&x.alive&&Math.abs(x.r-10)+Math.abs(x.c-4)<=1) x.placed=false;
  me.cds=[2,1,0,0]; me.revealedSkills=[0,1];
  S.events=[{r:10,c:4,kind:"recruit",consumed:false}]; S.traces[0].add("10_4");
  const cands=recruitCandidates(me); let seed=-1; for(let s=1;s<600;s++){ setSeed(s); if(cands[Math.floor(rand()*cands.length)]==="lightning_effect"){ seed=s; break; } }
  S.selected=null; render(); if(seed>0) setSeed(seed);
  window.__92={me,op,seed};
  return {seed,cands,meAt:[me.r,me.c],cds:me.cds.slice(),rev:me.revealedSkills.slice(),skills:me.skills.slice()}; })()`;
const RECT=sel=>`(()=>{ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`;
const BTN_RECT=txt=>`(()=>{ const el=[...document.querySelectorAll("#overlayBox button, #turnBar button")].find(b=>b.textContent.trim().startsWith(${JSON.stringify(txt)})); if(!el||el.disabled) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,text:el.textContent.trim(),onclick:el.getAttribute("onclick")}; })()`;
const MODAL=`(()=>{ const ob=document.getElementById("overlayBox"), t=ob.innerText; const cand=(ob.querySelector(".fighter b")||{}).textContent||"";
  return {hidden:document.getElementById("overlay").classList.contains("hidden"),text:t.slice(0,900),cand:cand.replace("새 기술: ",""),btns:[...document.querySelectorAll("#obBtns button")].map(b=>b.textContent),
    devWords:/\\bslot\\b|\\bcds\\b|revealedSkills|\\bseq\\b|lockstep|임시 대체|기획 확정/.test(t),sent:window.__sent}; })()`;
const PIECE=`(()=>{ const p=window.__92p||(window.__92&&window.__92.me); if(!p) return null; return {id:p.id,skills:p.skills.slice(),cds:p.cds.slice(),rev:(p.revealedSkills||[]).slice(),el:p.element,alive:p.alive,hp:p.hp}; })()`;
const AFTER=`(()=>{ const {me}=window.__92; return {skills:me.skills.slice(),cds:me.cds.slice(),rev:me.revealedSkills.slice(),hidden:document.getElementById("overlay").classList.contains("hidden"),
  consumed:S.events[0].consumed,main:S.mainUsed,log:S.log.slice(-3).map(l=>l.msg),side:document.getElementById("sidePanel").innerText.slice(0,400)}; })()`;
const SCENE_BATTLE=`(()=>{ ${GIVE} const {me,op}=window.__92; try{ close(); }catch(e){}
  put(op,9,4); op.revealed=false; me.cds=[0,0,0,0]; S.mainUsed=false; S.battlesUsed=0; S.battle=null; S.selected=null; S.forcedTargets=[]; S.forcedQueue=[]; S.contactSet=[];
  BAL.dmgVar=0; BAL.shockProb=1; render(); return {opAt:[op.r,op.c],skills:me.skills.slice()}; })()`;
const BTNS=`(()=>{ const B=S.battle; if(!B) return {error:"no-battle"}; const btns=[...document.querySelectorAll("#overlayBox button")].map(b=>({text:b.textContent.trim(),title:b.title,disabled:b.disabled,onclick:b.getAttribute("onclick")}));
  return {fa:B.fa.rosterId,fd:B.fd.rosterId,round:B.round,phase:B.phase,btns,panel:document.getElementById("overlayBox").innerText.slice(0,500),playing:typeof MSGPLAYING==="undefined"?null:MSGPLAYING}; })()`;
const PLAYING=`(()=>typeof MSGPLAYING==="undefined"?null:MSGPLAYING)()`;
const HIT=`(()=>{ const B=S.battle, {me,op}=window.__92; if(!B) return {error:"no battle after act"}; const t=document.getElementById("overlayBox").innerText;
  return {blog:B.blog.slice(),opHp:op.hp,opShock:op.shock,opBurn:op.burn,rev:me.revealedSkills.slice(),cds:me.cds.slice(),
    logDmg:B.blog.some(l=>/^29 피해!/.test(l)),logShock:B.blog.some(l=>/감전 — 다음 1라운드 후공/.test(l)),logBurn:B.blog.some(l=>/화상/.test(l)),uiShock:/⚡감전1R/.test(t),queued:B.msgQ.length,text:t.slice(0,500)}; })()`;
/* 온라인 */
const JOIN=code=>`(()=>{ document.getElementById("netCode").value=${JSON.stringify(code)}; netPrepare(); autoPlace(); setupDone(); return {phase:S.phase,queued:NET.queued}; })()`;
const STATE=`(()=>({started:NET.started,phase:S.phase,cur:S.current,me:NET.me,turn:S.turnCount,battle:!!S.battle,hidden:document.getElementById("overlay").classList.contains("hidden")}))()`;
const INSTR=`(()=>{ window.__sent=0; window.__recvA=0; const ws=NET.ws; const o=ws.send.bind(ws); ws.send=m=>{ window.__sent++; return o(m); };
  const om=ws.onmessage; ws.onmessage=ev=>{ try{ const m=JSON.parse(ev.data); if(m&&m.t==="a") window.__recvA++; }catch(e){} return om.call(ws,ev); }; return true; })()`;
/* 양 탭 동일 스캐폴드: 행동 측(S.current)의 첫 하수인을 불 표준형으로, 자기 쪽 숲의 적 비인접 빈 칸에 두고 recruit 이벤트·흔적을 놓는다 (게임 상태 S 는 양측 동일하므로 결과도 동일) */
const SCAFFOLD=`(()=>{ const cur=S.current; const me=S.pieces.filter(x=>x.owner===cur&&x.type==="minion"&&x.alive&&x.placed)[0]; if(!me) return {error:"no-minion"};
  const rows=cur===0?[10,9]:[4,5]; let cell=null;
  for(const r of rows){ for(let c=1;c<=7&&!cell;c++){ if(at(r,c)) continue; if(!S.pieces.some(x=>x.owner!==cur&&x.alive&&x.placed&&Math.abs(x.r-r)+Math.abs(x.c-c)===1)) cell=[r,c]; } if(cell) break; }
  if(!cell) return {error:"no-forest-cell"};
  me.r=cell[0]; me.c=cell[1]; me.placed=true; me.movedEver=true;
  const rd=ROSTER.find(r=>r.id==="M-F1"); me.rosterId=rd.id; me.name=rd.name; me.element=rd.element; me.hp=rd.hp; me.maxHp=rd.hp; me.atk=rd.atk; me.skillAtk=rd.skill; me.cdMax=rd.cd; me.skills=archSkills(rd.arch,rd.element); me.cds=[2,1,0,0]; me.revealedSkills=[0,1];
  S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.contactSet=[]; S.movedPiece=null; S.selected=null; S.teleport=null;
  S.events=S.events.filter(e=>!(e.r===cell[0]&&e.c===cell[1])); S.events.push({r:cell[0],c:cell[1],kind:"recruit",consumed:false}); S.traces[cur].add(cell[0]+"_"+cell[1]);
  window.__92p=me; render(); return {id:me.id,r:me.r,c:me.c,cur,me:NET.me}; })()`;
const REARM=`(()=>{ const me=window.__92p; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.selected=null;
  S.events=S.events.filter(e=>!(e.r===me.r&&e.c===me.c)); S.events.push({r:me.r,c:me.c,kind:"recruit",consumed:false}); S.traces[S.current].add(me.r+"_"+me.c); render(); return {r:me.r,c:me.c}; })()`;
const OBSERVE=`(()=>{ window.__92obs=[]; const ob=document.getElementById("overlayBox");
  window.__92base={html:document.body.innerHTML,attrs:[...document.querySelectorAll("[title],[aria-label]")].map(e=>(e.getAttribute("title")||"")+"|"+(e.getAttribute("aria-label")||"")).join("|")}; // 탐색 전 기준(W 자기 로스터의 같은 이름은 원래 있을 수 있다)
  const mo=new MutationObserver(recs=>{ for(const r of recs){ for(const n of r.addedNodes) window.__92obs.push(String(n.textContent||"").slice(0,300)); if(r.type==="characterData") window.__92obs.push(String(r.target.textContent||"").slice(0,300)); } });
  mo.observe(ob,{childList:true,subtree:true,characterData:true}); window.__92mo=mo; return true; })()`;
const WVIEW=name=>`(()=>{ const ko=${JSON.stringify(name)}; const ob=document.getElementById("overlayBox"); const t=ob.innerText; const cnt=x=>String(x).split(ko).length-1; const base=window.__92base||{html:"",attrs:""};
  const attrs=[...document.querySelectorAll("[title],[aria-label]")].map(e=>(e.getAttribute("title")||"")+"|"+(e.getAttribute("aria-label")||"")).join("|");
  return {lock:/상대 선택 대기/.test(t),hidden:document.getElementById("overlay").classList.contains("hidden"),text:t.slice(0,200),
    inOverlay:t.includes(ko),inObs:(window.__92obs||[]).some(s=>s.includes(ko)),obsCount:(window.__92obs||[]).length,inTitle:document.title.includes(ko),inUrl:location.href.includes(encodeURIComponent(ko))||location.href.includes(ko),
    inAttrs:cnt(attrs)>cnt(base.attrs),inLog:S.log.some(l=>l.msg.includes(ko)),inBody:cnt(document.body.innerHTML)>cnt(base.html),inHtml:cnt(document.body.innerHTML)>cnt(base.html),baseCount:cnt(base.html),nowCount:cnt(document.body.innerHTML),sent:window.__sent,recvA:window.__recvA}; })()`;
const CMP=`(()=>{ const p=window.__92p; return JSON.stringify({sk:p.skills,cds:p.cds,rev:p.revealedSkills,seq:NET.modalSeq,sync:NET.syncModal?NET.syncModal.seq:null,hidden:document.getElementById("overlay").classList.contains("hidden"),main:S.mainUsed,cur:S.current,queue:NET.queue.length}); })()`;
const RAND=`(()=>rand())()`;
const KO2ID=ko=>`(()=>Object.keys(SKILLS).find(k=>SKILLS[k].ko===${JSON.stringify(ko)})||null)()`;
const SCAFFOLD_CAP=`(()=>{ const tgt=window.__92p; const w=1-S.current; const cap=S.pieces.filter(x=>x.owner===w&&x.type==="minion"&&x.alive&&x.placed&&x.id!==tgt.id)[0]; if(!cap) return {error:"no-capturer"};
  const adj=[[tgt.r-1,tgt.c],[tgt.r+1,tgt.c],[tgt.r,tgt.c-1],[tgt.r,tgt.c+1]].find(([r,c])=>r>=1&&r<=13&&c>=1&&c<=7&&!at(r,c)); if(!adj) return {error:"no-adj"};
  cap.r=adj[0]; cap.c=adj[1]; cap.placed=true; cap.hp=cap.maxHp; cap.immobile=0;
  tgt.hp=20; S.current=w; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.contactSet=[]; S.movedPiece=null; S.selected=null; S.teleport=null; S.balls=[3,3]; S.reserve=[null,null]; S.battle=null;
  window.__92cap=cap; render(); return {cap:[cap.r,cap.c],tgt:[tgt.r,tgt.c],cur:S.current,capId:cap.id}; })()`;
const SEED_THROW=`(()=>{ let s=1; for(;s<200;s++){ setSeed(s); if(rand()<BAL.enemyCapProb) break; } setSeed(s); return s; })()`;
const RESERVE=`(()=>{ const w=NET.me, tgt=window.__92p; const rs=[0,1].map(i=>S.reserve[i]?{skills:S.reserve[i].skills.slice(),cds:S.reserve[i].cds.slice(),rev:S.reserve[i].revealedSkills.slice(),hp:S.reserve[i].hp,maxHp:S.reserve[i].maxHp,el:S.reserve[i].element,art:S.reserve[i].artRosterId,atk:S.reserve[i].atk,alias:S.reserve[i].skills===tgt.skills}:null);
  return {reserve:rs,tgtAlive:tgt.alive,tgtSkills:tgt.skills.slice(),battle:!!S.battle,side:document.getElementById("sidePanel").innerText.slice(0,300)}; })()`;

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const report=[]; let bad=0; const shots=[];
  const note=(what,r)=>{ report.push({what,...r}); if(r.error||r.ok===false) bad++; console.log((r.ok===false||r.error?"FAIL ":"ok   ")+what+(r.detail?" — "+r.detail:"")+(r.error?" — "+r.error:"")); };
  let server=null, chrome=null, cdp=null;
  try{
    chrome=await launch();
    console.log(`RESOURCE chrome pid=${chrome.proc.pid} profile=${chrome.udd}`);
    cdp=await connect(chrome.ws);
    const tab=async url=>{ const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
      const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
      await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false},sid);
      const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url},sid); await loaded; await sleep(300);
      const t={sid,targetId,
        ev:async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("page: "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails)); return r.result.value; },
        clickAt:async p=>{ for(const type of ["mousePressed","mouseReleased"]) await cdp.send("Input.dispatchMouseEvent",{type,x:p.x,y:p.y,button:"left",clickCount:1},sid); await sleep(120); },
        click:async sel=>{ const p=await t.ev(RECT(sel)); if(!p) throw new Error("클릭 대상 없음 "+sel); await t.clickAt(p); return p; },
        clickBtn:async txt=>{ const p=await t.ev(BTN_RECT(txt)); if(!p) throw new Error("버튼 없음/비활성 "+txt); await t.clickAt(p); return p; },
        shot:async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
          const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); const rel=path.relative(ROOT,f).replace(/\\/g,"/"); shots.push(rel); console.log("SHOT "+rel); }};
      return t; };
    const until=async(fn,ms,label)=>{ const t0=Date.now(); for(;;){ const v=await fn(); if(v) return v; if(Date.now()-t0>ms) throw new Error("대기 시간 초과: "+label); await sleep(150); } };
    const idle=async t=>{ await until(async()=>(await t.ev(PLAYING))!==true,8000,"메시지 재생"); };
    const cell=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;
    const errs=()=>cdp.errors.splice(0);

    /* ══ 1. file:// PVE — 탐색 → 후보 모달 → 교체 → 사이드 패널 ══ */
    const P=await tab(FILE_URL); await P.ev(PREP);
    const s1=await P.ev(SCENE_RECRUIT);
    note("1a 전제: 불 표준형(쿨 2/1·공개 [0,1])이 숲 recruit 칸, 감전 침 후보 시드",{ok:s1.seed>0&&s1.cands.length===9&&s1.skills[0]==="fire_stable",detail:`seed=${s1.seed} at=${s1.meAt}`});
    await P.click(cell(10,4)); await sleep(150);
    const selOk=await P.ev(`(()=>S.selected&&S.selected.id===window.__92.me.id)()`);
    await P.clickBtn("탐색"); await sleep(250);
    let m=await P.ev(MODAL);
    note("1b 실제 클릭(말 선택 → [탐색]) → 후보 모달: 감전 침·번개·효과·위력·쿨·현재 공격기 비교·버튼 3개·개발 용어 0",{ok:selOk&&!m.hidden&&m.cand==="감전 침"&&/번개/.test(m.text)&&/효과/.test(m.text)&&/위력/.test(m.text)&&/화염탄/.test(m.text)&&/잔불 표식/.test(m.text)&&/남은 쿨 2/.test(m.text)&&/남은 쿨 1/.test(m.text)&&JSON.stringify(m.btns)===JSON.stringify(["공격기 1과 교체","공격기 2와 교체","유지"])&&!m.devWords,detail:`cand=${m.cand} btns=${JSON.stringify(m.btns)}`});
    await P.shot("1-pve-recruit-modal");
    await P.clickBtn("공격기 1과 교체"); await sleep(250);
    let a=await P.ev(AFTER);
    note("1c [공격기 1과 교체] 실제 클릭 → skills[0]=감전 침·쿨 [2,1,0,0] 승계·공개 [0,1]→[1]·모달 닫힘·이벤트 소모·로그 generic",{ok:a.skills[0]==="lightning_effect"&&a.skills[1]==="fire_effect"&&JSON.stringify(a.cds)==="[2,1,0,0]"&&JSON.stringify(a.rev)==="[1]"&&a.hidden&&a.consumed&&a.main&&!a.log.some(l=>/감전 침|교체/.test(l)),detail:`skills=${a.skills} cds=${a.cds} log=${JSON.stringify(a.log)}`});
    await P.click(cell(10,4)); await sleep(150); a=await P.ev(AFTER);
    note("1d 자기 말 재선택 → 사이드 패널 기술 목록에 ⚡감전 침 표시",{ok:/⚡감전 침/.test(a.side)&&/잔불 표식/.test(a.side),detail:a.side.replace(/\n/g," ").slice(0,160)});
    { const e=errs(); note("1e 콘솔 오류 0 (PVE 탐색·교체)",{ok:e.length===0,detail:e.join(" || ")}); }
    /* ══ 2. file:// PVE — 물 상대와 실제 클릭 전투: 버튼 표시·실제 사용 ══ */
    const sb=await P.ev(SCENE_BATTLE);
    await P.click(cell(10,4)); await sleep(150); await P.click(cell(9,4)); await sleep(300); await idle(P);
    let b=await P.ev(BTNS);
    const shockBtn=b.btns&&b.btns.find(x=>x.text.startsWith("⚡감전 침")), fireBtn=b.btns&&b.btns.find(x=>x.text.startsWith("잔불 표식"));
    note("2a 실제 클릭 전투 개시(불 하수인 vs 물 하수인) — 버튼 '⚡감전 침 22'·설명 '50% 확률 감전(후공 1회) · 번개 속성으로 판정' · 잔불 표식은 그대로",{ok:!b.error&&b.fa==="M-F1"&&b.fd==="M-W1"&&!!shockBtn&&shockBtn.title==="50% 확률 감전(후공 1회) · 번개 속성으로 판정"&&/^⚡감전 침 22/.test(shockBtn.text)&&!!fireBtn&&fireBtn.title==="70% 확률 화상 2R"&&/⚡감전 침 · 잔불 표식/.test(b.panel),detail:JSON.stringify({shock:shockBtn,fire:fireBtn&&fireBtn.title})});
    await P.shot("2-pve-battle-buttons");
    await P.clickBtn("⚡감전 침"); await sleep(3500); await idle(P);
    const h=await P.ev(HIT);
    note("2b [⚡감전 침] 실제 클릭 → 22×1.3=29 피해(물에 강상성)·감전 부여·화상 없음·상태 아이콘 ⚡감전1R·슬롯0 공개",{ok:!h.error&&h.logDmg&&h.opHp===71&&h.opShock===1&&h.opBurn===0&&h.logShock&&!h.logBurn&&h.uiShock&&h.rev.includes(0)&&h.cds[0]===2,detail:`opHp=${h.opHp} shock=${h.opShock} burn=${h.opBurn} uiShock=${h.uiShock} rev=${h.rev} cds=${h.cds} text=${JSON.stringify(h.text.slice(0,200))} blog=${JSON.stringify(h.blog.slice(-3))}`});
    await P.shot("3-pve-cross-skill-hit");
    { const e=errs(); note("2c 콘솔 오류 0 (PVE 전투)",{ok:e.length===0,detail:e.join(" || ")}); }

    /* ══ 3. 온라인 2클라이언트 (실제 서버·실제 코드 인증) ══ */
    server=await startServer();
    console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port} (접속 코드는 출력하지 않는다)`);
    const URL=`http://127.0.0.1:${server.port}/index.html`;
    const A=await tab(URL), B=await tab(URL);
    for(const t of [A,B]){ await t.ev(PREP); await t.ev(JOIN(server.code)); }
    await until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"온라인 매칭·시작");
    const sa=await A.ev(STATE), sb2=await B.ev(STATE);
    const X=sa.cur===sa.me?A:B, W=X===A?B:A; // X: 행동 측 · W: 대기 측
    for(const t of [A,B]) await t.ev(INSTR);
    note("3a 온라인 매칭·시작",{ok:sa.started&&sb2.started&&sa.me!==sb2.me,detail:`A me=${sa.me} B me=${sb2.me} 선공 P${sa.cur+1}`});
    const scX=await X.ev(SCAFFOLD), scW=await W.ev(SCAFFOLD);
    note("3b 양 탭 동일 스캐폴드(행동 측 하수인 불 표준형·숲 recruit 칸·쿨 2/1·공개 [0,1])",{ok:!scX.error&&!scW.error&&scX.id===scW.id&&scX.r===scW.r&&scX.c===scW.c,detail:JSON.stringify(scX)});
    await W.ev(OBSERVE);
    const doSearch=async()=>{ const s0=await X.ev(`window.__sent`);
      await X.click(cell(scX.r,scX.c)); await until(async()=>{ const w=await W.ev(`(()=>S.selected?S.selected.id:null)()`); return w===scX.id; },5000,"선택 릴레이");
      await X.clickBtn("탐색"); await until(async()=>{ const a=await X.ev(CMP), b=await W.ev(CMP); return JSON.parse(a).sync!==null&&JSON.parse(a).sync===JSON.parse(b).sync; },5000,"탐색 릴레이·모달 seq");
      return (await X.ev(`window.__sent`))-s0; };
    const sent1=await doSearch();
    const mx=await X.ev(MODAL); const cand=mx.cand; const candId=await X.ev(KO2ID(cand));
    let wv=await W.ev(WVIEW(cand));
    note("3c X 실제 클릭 탐색(송신 2: 선택+탐색) → X 후보 모달(타 속성 공격기)·양측 모달 seq 동일",{ok:sent1===2&&!mx.hidden&&!!candId&&candId.split("_")[0]!=="fire"&&JSON.stringify(mx.btns)===JSON.stringify(["공격기 1과 교체","공격기 2와 교체","유지"])&&!mx.devWords,detail:`cand=${cand}(${candId}) sent=${sent1}`});
    note("3d W 화면: 잠금 대기 화면만 — 오버레이 DOM 변이 기록·body HTML(탐색 전 대비 증가 0)·title·aria/title 속성·URL·로그 어디에도 후보 이름 없음 · W 송신 0",{ok:wv.lock&&!wv.hidden&&!wv.inOverlay&&!wv.inObs&&!wv.inTitle&&!wv.inUrl&&!wv.inAttrs&&!wv.inLog&&!wv.inBody&&!wv.inHtml&&wv.sent===0,detail:`obs=${wv.obsCount} lock=${wv.lock} bodyCount=${wv.baseCount}→${wv.nowCount}`});
    await X.shot("4-online-actor-recruit-modal"); await W.shot("5-online-waiting-view");
    const choose=async(txt,expectSlot,expectId)=>{ await X.clickBtn(txt);
      await until(async()=>(await X.ev(CMP))===(await W.ev(CMP))&&JSON.parse(await W.ev(CMP)).hidden,5000,"선택 릴레이 "+txt);
      const cx=JSON.parse(await X.ev(CMP)), cw=JSON.parse(await W.ev(CMP)); const rx=await X.ev(RAND), rw=await W.ev(RAND);
      return {cx,cw,same:JSON.stringify(cx)===JSON.stringify(cw),randSame:rx===rw,slotOk:expectSlot<0||cx.sk[expectSlot]===expectId}; };
    const c1=await choose("공격기 1과 교체",0,candId);
    note("3e [공격기 1과 교체] → 양측 skills·cds([2,1,0,0] 승계)·공개([0,1]→[1])·seq·난수 동일",{ok:c1.same&&c1.randSame&&c1.slotOk&&JSON.stringify(c1.cx.cds)==="[2,1,0,0]"&&JSON.stringify(c1.cx.rev)==="[1]"&&c1.cx.hidden,detail:JSON.stringify(c1.cx)});
    // 슬롯1 교체
    for(const t of [X,W]) await t.ev(REARM); await doSearch();
    const cand2=(await X.ev(MODAL)).cand, cand2Id=await X.ev(KO2ID(cand2)); wv=await W.ev(WVIEW(cand2));
    const c2=await choose("공격기 2와 교체",1,cand2Id);
    note("3f 2회차: 후보 "+cand2+" → [공격기 2와 교체] → 양측 동일·두 슬롯 모두 타 속성·W 화면 후보 노출 0",{ok:c2.same&&c2.randSame&&c2.slotOk&&cand2Id!==candId&&cand2Id.split("_")[0]!=="fire"&&!wv.inBody&&!wv.inObs&&JSON.stringify(c2.cx.cds)==="[2,1,0,0]",detail:JSON.stringify(c2.cx.sk)});
    // 유지
    for(const t of [X,W]) await t.ev(REARM); await doSearch();
    const cand3=(await X.ev(MODAL)).cand; const before=JSON.parse(await X.ev(CMP)).sk;
    const c3=await choose("유지",-1,null);
    note("3g 3회차: 후보 "+cand3+" → [유지] → 양측 동일·기술 불변·이벤트 소모",{ok:c3.same&&c3.randSame&&JSON.stringify(c3.cx.sk)===JSON.stringify(before)&&c3.cx.main===true&&c3.cx.seq===3,detail:`seq=${c3.cx.seq}`});
    const wsum=await W.ev(WVIEW(cand)); const wsum2=await W.ev(WVIEW(cand2));
    note("3h 3회 탐색 뒤 W body HTML(탐색 전 대비 증가 0)·변이 기록·로그에 배운 두 기술 이름 없음 · W 송신 0",{ok:!wsum.inBody&&!wsum.inHtml&&!wsum.inObs&&!wsum.inLog&&!wsum2.inBody&&!wsum2.inHtml&&!wsum2.inObs&&wsum.sent===0,detail:`W sent=${wsum.sent} recvA=${wsum.recvA} obs=${wsum.obsCount}`});
    /* ── 포획 승계: W 가 X 의 (교체된) 하수인을 실제 볼 투척으로 포획 ── */
    const kx=await X.ev(SCAFFOLD_CAP), kw=await W.ev(SCAFFOLD_CAP);
    note("3i 양 탭 동일 포획 스캐폴드(W 하수인 인접·대상 HP 20·볼 3·예비 없음·W 턴)",{ok:!kx.error&&!kw.error&&JSON.stringify(kx)===JSON.stringify(kw),detail:JSON.stringify(kx)});
    await W.click(cell(kx.cap[0],kx.cap[1])); await sleep(200); await W.click(cell(kx.tgt[0],kx.tgt[1]));
    await until(async()=>{ const a=await X.ev(STATE), b=await W.ev(STATE); return a.battle&&b.battle; },5000,"전투 개시 릴레이");
    await idle(W); await idle(X);
    const seedX=await X.ev(SEED_THROW), seedW=await W.ev(SEED_THROW);
    await until(async()=>!!(await W.ev(BTN_RECT("🔴 볼 투척"))),5000,"볼 투척 버튼 활성");
    await W.clickBtn("🔴 볼 투척");
    await until(async()=>{ const a=await X.ev(RESERVE), b=await W.ev(RESERVE); return !a.battle&&!b.battle&&a.reserve[kw.cur]&&b.reserve[kw.cur]; },8000,"포획 릴레이");
    await sleep(500);
    const ra=await X.ev(RESERVE), rb=await W.ev(RESERVE); const rv=rb.reserve[kw.cur];
    note("3j 실제 볼 투척(같은 시드 "+seedW+") → 양측 예비 하수인 동일: 교체 기술 승계·쿨 0·공개 []·HP 70/100·불·외형 M-F1·참조 비공유·대상 제거",{ok:seedX===seedW&&JSON.stringify(ra.reserve)===JSON.stringify(rb.reserve)&&!!rv&&JSON.stringify(rv.skills)===JSON.stringify(before)&&rv.skills[0]===candId&&rv.skills[1]===cand2Id&&JSON.stringify(rv.cds)==="[0,0,0,0]"&&rv.rev.length===0&&rv.hp===70&&rv.maxHp===100&&rv.el==="fire"&&rv.art==="M-F1"&&rv.atk===20&&!rv.alias&&!rb.tgtAlive,detail:JSON.stringify(rv)});
    const rr=(await X.ev(RAND))===(await W.ev(RAND));
    note("3k 포획 뒤 양측 난수 상태 동일 · W 사이드 패널 예비 하수인 배지",{ok:rr&&/예비 하수인\(불\)/.test(rb.side),detail:rb.side.replace(/\n/g," ").slice(0,120)});
    { const e=errs(); note("3l 콘솔 오류 0 (온라인 3탭 흐름 전체)",{ok:e.length===0,detail:e.join(" || ")}); }
    for(const t of [P,A,B]) try{ await cdp.send("Target.closeTarget",{targetId:t.targetId}); }catch(e){}
  }catch(e){ note("실행",{error:e.message}); }
  finally{
    if(chrome){ try{ chrome.proc.kill(); }catch(e){} await sleep(300);
      const uddAbs=path.resolve(chrome.udd), tmpAbs=path.resolve(os.tmpdir()); const safe=path.dirname(uddAbs)===tmpAbs&&/^cross92cdp-[A-Za-z0-9]+$/.test(path.basename(uddAbs)); let removed=false;
      if(safe) for(let i=0;i<10;i++){ try{ fs.rmSync(uddAbs,{recursive:true,force:true}); }catch(e){} removed=!fs.existsSync(uddAbs); if(removed) break; await sleep(150); }
      console.log(`CLEANUP chrome pid=${chrome.proc.pid} profile=${uddAbs} guard=${safe} removed=${removed}`); }
    if(server){ try{ server.proc.kill(); }catch(e){} console.log(`CLEANUP qa-server pid=${server.proc.pid}`); }
  }
  const summary={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),date:new Date().toISOString(),readOnly:READ_ONLY,pass:report.filter(r=>r.ok!==false&&!r.error).length,fail:bad,shots,report};
  if(!READ_ONLY){ const f=path.join(OUT,"issue92_cdp_report.json"); fs.writeFileSync(f,JSON.stringify(summary,null,2)); console.log("REPORT "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  console.log(`\n=== issue92_cdp: pass ${summary.pass} / fail ${summary.fail}${READ_ONLY?" (read-only · 산출물 0)":""} ===`);
  process.exit(bad?1:0);
})();
