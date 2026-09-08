/* #106 턴 흐름·연출 — 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 릴레이 서버 · 온라인 클라이언트 2개 + PVE 탭 · 실제 마우스 클릭 · 실제 타이머)
   사용: node demo/test/issue106_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots]
   --read-only: Saturn 독립 재검증용 — 산출물 0(스크린샷·보고서 JSON 없음), stdout 만. 헤드리스 Chrome 임시 프로필(os.tmpdir()/i106cdp-*)과
                검증 전용 릴레이 서버(PORT=0 임의 포트·루프백)만 실행 부수 리소스로 만들고 종료 시 정리한다(RESOURCE/CLEANUP 행).
   흐름 (제품 코드 무수정 · 메뉴/로스터/트레이/칸/턴바/전투 버튼은 전부 실제 DOM 클릭 · 시간은 페이지의 실제 setTimeout):
     1. 두 탭 자연 배치 → 실제 서버 매칭 → 시작 직후 양 탭 "나의 턴!/상대 턴!" 배너(2초 기본값)·입력 잠금·해제 실측
     2. 턴 교대는 [주 행동 생략] 클릭 → 자동 턴 종료(행동자 클라이언트만 endTurn 송신 — 페이지 안 ws.send 계수) 로만 진행
     3. 하수인끼리 신규 인접 → 접촉 배너 → 상황 문구 → 3·2·1·배틀 시작! → 라운드 배너 → 4카테고리 메뉴 (양 탭 순서·시간 실측) → 실제 버튼으로 전투 완주(기술 2초 → 피해 2초) → 결과 배너(승/패 뷰어 기준) → 양 탭 S 동일
     4. 생존 말 회복 지정(회복 버튼) → 자기 턴 종료 +5% → 상대 턴 종료 +5% (양 탭 동일) · 만피 말은 버튼 비활성
     5. 상대 폭탄이 이동으로 내 하수인과 새로 인접 → 폭탄 접촉 발동(둘 다 제거·폭발 표시 유지) 양 탭 동일
     6. 상대 하수인이 내 함정 옆에 도착 → 함정 발동 → 함정·걸린 말 정체 공개 양 탭 동일
     7. 65턴 진입 시 "버닝타임입니다!" 배너가 턴 배너보다 먼저 1회 (양 탭 같은 순서·66턴 재표시 없음)
     8. PVE 탭: AI 턴 "상대 턴!" 배너 동안 AI 미행동 · 좁은 폭(400px) 전투 메뉴 스크린샷
   빠른 진행 구간은 페이지 안 BAL.fx(연출 상수)를 낮춰 돌리고, 실측 구간은 기본값(2000ms 등)으로 되돌린다 — 제품 파일은 바꾸지 않는다.
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome + server/node_modules(ws). 외부 패키지 없음. 종료 코드 1 = 판정 실패. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","qa","issue106")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(__dirname,"..","index.html"));
const VP={width:1280,height:1000};

function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i106cdp-"));
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
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
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

/* ── 배치 (P1 진영 좌표 기준 — P2 는 14−r 미러). 대본이 쓰는 길: 5열(하수인 접촉 — P1 (11,5) ↑ · P2 (3,5) ↓) · 2열(P2 폭탄 ↓ vs P1 하수인 ↑) · 7열(P2 하수인 ↓ → P1 함정 (11,7)) ── */
const SETUPS=[
  {roster:["M-F2","M-W1","M-G3","M-L4","M-F5","M-W2"],pos:{minion:[[11,1],[11,2],[11,3],[11,4],[11,5],[12,6]],bomb:[[12,1],[12,7],[13,6]],ally:[[12,3],[12,5]],trap:[[13,1],[11,7]],king:[[13,4]]}},
  {roster:["M-L1","M-G2","M-W3","M-F4","M-L5","M-G1"],pos:{minion:[[11,7],[11,5],[11,3],[11,1],[12,6],[13,2]],bomb:[[11,2],[11,4],[11,6]],ally:[[13,3],[13,5]],trap:[[12,1],[12,7]],king:[[12,4]]}}];
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){} return S.phase; })()`;
const SET_CODE=code=>`(()=>{ document.getElementById("netCode").value=${JSON.stringify(code)}; return true; })()`;
const STATE=`(()=>({started:NET.started,phase:S.phase,cur:S.current,me:NET.me,turn:S.turnCount,main:S.mainUsed,battle:!!S.battle,forced:S.forcedTargets.slice(),
  actor:netActor(),overlay:!document.getElementById("overlay").classList.contains("hidden"),queue:NET.queue.length,locked:fxLocked(),playing:MSGPLAYING,sel:S.selected?S.selected.id:null,
  banner:(()=>{ const b=document.getElementById("fxBanner"); return {visible:!b.classList.contains("hidden"),cls:b.className,title:document.getElementById("fxTitle").textContent,sub:document.getElementById("fxSub").textContent}; })(),
  bodyLock:document.body.classList.contains("fx-lock"),auto:!!FX.auto,menu:S.battle?S.battle.menu||null:null,bu:S.battlesUsed}))()`;
const SNAP=`(()=>JSON.stringify({phase:S.phase,cur:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,forced:S.forcedTargets,
  battle:S.battle?[S.battle.attP.id,S.battle.defP.id,S.battle.round,S.battle.phase]:null,events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),reveal:[...S.tempReveal].sort(),
  pieces:S.pieces.map(p=>[p.id,p.owner,p.rosterId,p.r,p.c,p.alive,p.placed,p.hp,p.revealed,p.immobile,p.healing,p.shield]),seq:NET.modalSeq,queue:NET.queue.length,
  m:{heals:S.metrics.heals,healHp:S.metrics.healHp,bombContacts:S.metrics.bombContacts,autoEnds:S.metrics.autoEnds,trapTriggers:S.metrics.trapTriggers,battles:S.metrics.battles,judged:S.metrics.judged}}))()`;
const OWN_PIECES=`(()=>S.pieces.filter(x=>x.owner===0).map(x=>({id:x.id,type:x.type,rosterId:x.rosterId,name:x.name,r:x.r,c:x.c,placed:x.placed})))()`;
const FXLOG=`(()=>JSON.stringify(FX.log.map(x=>({k:x.key,title:x.title,sub:x.sub,t:x.t,shown:x.shown,ms:x.ms,turn:x.turn}))))()`;
const PIECE_AT=(r,c)=>`(()=>{ const p=at(${r},${c}); return p?{id:p.id,owner:p.owner,type:p.type,r:p.r,c:p.c,hp:p.hp,maxHp:p.maxHp,alive:p.alive,revealed:p.revealed,healing:!!p.healing,immobile:p.immobile}:null; })()`;
const PIECE=id=>`(()=>{ const p=S.pieces.find(x=>x.id===${id}); return p?{id:p.id,r:p.r,c:p.c,hp:p.hp,maxHp:p.maxHp,alive:p.alive,revealed:p.revealed,healing:!!p.healing,immobile:p.immobile,type:p.type,owner:p.owner}:null; })()`;
const RECT=sel=>`(()=>{ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`;
const BTN_TEXT=sel=>`(()=>[...document.querySelectorAll(${JSON.stringify(sel)})].map(b=>[b.textContent.trim(),b.disabled]))()`;
const CONSOLE_ERR=`(()=>window.__errs||[])()`;
const INSTALL_ERR=`(()=>{ window.__errs=[]; window.addEventListener("error",e=>window.__errs.push(String(e.message))); const oe=console.error; console.error=function(){ window.__errs.push([...arguments].map(String).join(" ")); return oe.apply(console,arguments); }; return true; })()`;
const WRAP_SEND=`(()=>{ if(!NET.ws) return false; if(NET.ws.__w) return true; const o=NET.ws.send.bind(NET.ws); NET.ws.__w=true; window.__frames=[]; NET.ws.send=m=>{ window.__frames.push(String(m)); return o(m); }; return true; })()`;
const FRAMES=`(()=>(window.__frames||[]).slice())()`;
const FAST=`(()=>{ BAL.fx.turnBanner=150; BAL.fx.contactBanner=150; BAL.fx.explosion=150; BAL.fx.trapFx=150; BAL.fx.countStep=60; BAL.fx.roundBanner=120; BAL.fx.skillFx=120; BAL.fx.damageFx=120; BAL.fx.itemFx=120; BAL.fx.captureFx=120; BAL.fx.fleeFx=120; BAL.fx.resultBanner=150; BAL.fx.judgeBanner=120; BAL.fx.pushBanner=120; BAL.fx.roundEndFx=80; BAL.fx.msgStep=60; BAL.fx.autoEndGrace=100; return true; })()`;
const REAL=`(()=>{ Object.assign(BAL.fx,{turnBanner:2000,contactBanner:2000,explosion:2000,trapFx:2000,countStep:1000,roundBanner:2000,skillFx:2000,damageFx:2000,itemFx:2000,captureFx:2000,fleeFx:2000,resultBanner:2500,judgeBanner:2000,pushBanner:2000,roundEndFx:1000,msgStep:600,autoEndGrace:1000,watchdog:1000}); return true; })()`;
const GHOSTS=`(()=>document.querySelectorAll("#board .pc.fx-ghost").length)()`;
const HEALCHIPS=`(()=>[...document.querySelectorAll("#board .pc.healing")].map(ch=>{ const c=ch.parentNode; return [+c.dataset.r,+c.dataset.c]; }))()`;

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const report=[]; let bad=0; const shots=[]; const timing={};
  const note=(what,r)=>{ report.push({what,...r}); if(r.error||r.ok===false) bad++; console.log((r.ok===false||r.error?"FAIL ":"ok   ")+what+(r.detail?" — "+r.detail:"")+(r.error?" — "+r.error:"")); };
  let server=null, chrome=null;
  try{
    server=await startServer();
    console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port} (접속 코드는 출력하지 않는다)`);
    chrome=await launch();
    console.log(`RESOURCE chrome pid=${chrome.proc.pid} profile=${chrome.udd}`);
    const cdp=await connect(chrome.ws);
    const tab=async(url,vp)=>{ const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
      const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
      await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
      const v=vp||VP; await cdp.send("Emulation.setDeviceMetricsOverride",{width:v.width,height:v.height,deviceScaleFactor:1,mobile:false},sid);
      const t={sid,targetId,name:"",
        ev:async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("page: "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails)); return r.result.value; },
        nav:async u=>{ const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url:u},sid); await loaded; await sleep(300); await t.ev(PREP); await t.ev(INSTALL_ERR); },
        click:async sel=>{ const p=await t.ev(RECT(sel)); if(!p) throw new Error("클릭 대상 없음 "+sel);
          for(const type of ["mousePressed","mouseReleased"]) await cdp.send("Input.dispatchMouseEvent",{type,x:p.x,y:p.y,button:"left",clickCount:1},sid); await sleep(60); return p; },
        vp:async(w,h)=>cdp.send("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:false},sid),
        shot:async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
          const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); const rel=path.relative(ROOT,f).replace(/\\/g,"/"); shots.push(rel); console.log("SHOT "+rel); }};
      await t.nav(url); return t; };
    const until=async(fn,ms,label)=>{ const t0=Date.now(); for(;;){ const v=await fn(); if(v) return v; if(Date.now()-t0>ms){ let dump=""; try{ dump=" P1="+JSON.stringify(await P1.ev(STATE))+" P2="+JSON.stringify(await P2.ev(STATE)); }catch(e){} throw new Error("대기 시간 초과: "+label+dump); } await sleep(100); } };
    let P1=null, P2=null;
    const cell=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;
    const same=async(A,B)=>(await A.ev(SNAP))===(await B.ev(SNAP));
    const idle=async(T)=>{ const s=await T.ev(STATE); return !s.locked&&s.queue===0&&!s.playing; };
    const settled=async(A,B,label,ms)=>until(async()=>(await idle(A))&&(await idle(B))&&(await same(A,B)),ms||30000,label);

    /* ── 1. 자연 배치 → 매칭 ── */
    const URL=`http://127.0.0.1:${server.port}/index.html`;
    const A=await tab(URL), B=await tab(URL); A.name="A"; B.name="B";
    for(const [i,T] of [A,B].entries()){
      await T.ev(SET_CODE(server.code)); await T.click('button[onclick="netPrepare()"]'); await sleep(150);
      for(const rid of SETUPS[i].roster){ await T.click(`.rosterCard[onclick="rosterInfo('${rid}')"]`); await sleep(80); await T.click('#obBtns button:first-child'); await sleep(80); }
      const used={}; let own=await T.ev(OWN_PIECES);
      for(const p of own){ const k=used[p.type]=(used[p.type]||0); used[p.type]++; const [r,c]=SETUPS[i].pos[p.type][k]; await T.click(`.trayItem[onclick="selTray(${p.id})"]`); await T.click(cell(r,c)); }
      const st=await T.ev(`(()=>({placed:S.pieces.filter(x=>x.owner===0&&x.placed).length,roster:S.roster[0].slice()}))()`);
      note(`1${"ab"[i]} 탭${T.name}: 로스터 6종·14개 수동 배치 (실제 클릭)`,{ok:st.placed===14&&st.roster.join()===SETUPS[i].roster.join(),detail:`placed=${st.placed}`});
      await T.click('#sidePanel button.primary'); await sleep(150);
    }
    const tStart=Date.now();
    await until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"온라인 매칭·시작");
    for(const T of [A,B]) await T.ev(WRAP_SEND);
    const sa=await A.ev(STATE), sb=await B.ev(STATE);
    P1=sa.me===0?A:B; P2=P1===A?B:A; P1.name="P1"; P2.name="P2";
    const act0=sa.cur; const ACT=act0===0?P1:P2, OPP=ACT===P1?P2:P1;
    note("1c 실제 서버 매칭 — 서로 다른 탭이 P1·P2",{ok:sa.me!==sb.me,detail:`선공 P${act0+1}`});
    /* 시작 직후 턴 배너 (기본값 2초): 행동자 "나의 턴!", 상대 "상대 턴!", 입력 잠금, 2초 뒤 해제 */
    const ba=await ACT.ev(STATE), bo=await OPP.ev(STATE);
    note("2a 시작 직후 행동자 탭 '나의 턴!' 배너·body.fx-lock·fxLocked",{ok:ba.banner.visible&&ba.banner.title==="나의 턴!"&&ba.locked&&ba.bodyLock,detail:JSON.stringify(ba.banner)});
    note("2b 상대 탭 '상대 턴!' 배너 (거울)",{ok:bo.banner.visible&&bo.banner.title==="상대 턴!"&&bo.locked,detail:JSON.stringify(bo.banner)});
    await ACT.shot("1-turn-banner-actor"); await OPP.shot("2-turn-banner-opponent");
    const actKing=await ACT.ev(`(()=>{ const k=S.pieces.find(p=>p.owner===NET.me&&p.type==="minion"&&p.placed); return [k.r,k.c,k.id]; })()`);
    await ACT.click(cell(actKing[0],actKing[1])); await sleep(100);
    const ba2=await ACT.ev(STATE);
    note("2c 배너 중 자기 말 클릭 무시 (선택 없음·송신 0)",{ok:ba2.sel===null&&(await ACT.ev(FRAMES)).filter(f=>/"cell"/.test(f)).length===0,detail:`sel=${ba2.sel}`});
    const tUnlock=await until(async()=>{ const s=await ACT.ev(STATE); return !s.locked?Date.now():null; },6000,"턴 배너 해제");
    const fx0=JSON.parse(await ACT.ev(FXLOG)); const tb=fx0.find(x=>x.k==="turnBanner");
    timing.turnBanner=tb?{ms:tb.ms,heldApprox:tUnlock-tb.shown}:null;
    note("2d 턴 배너 2초(기본값) 뒤 해제 · 잠금 유지 시간 실측",{ok:!!tb&&tb.ms===2000&&tUnlock-tb.shown>=1900&&tUnlock-tb.shown<=3200,detail:`held≈${tb?tUnlock-tb.shown:"?"}ms (선언 ${tb&&tb.ms})`});
    await until(async()=>idle(OPP),6000,"상대 탭 해제");
    await ACT.click(cell(actKing[0],actKing[1])); await sleep(150);
    note("2e 해제 후 같은 클릭은 선택됨 (양 탭 동일 상태)",{ok:(await ACT.ev(STATE)).sel===actKing[2]&&(await same(P1,P2))});

    /* ── 2. 턴 교대 = [주 행동 생략] 클릭 → 자동 턴 종료 (행동자만 송신) ── */
    for(const T of [A,B]) await T.ev(FAST);
    const actorTab=async()=>{ const s=await P1.ev(STATE); return s.actor===0?P1:P2; };
    const passTurn=async()=>{ const T=await actorTab(); const st=await T.ev(STATE); const n=st.turn;
      await until(async()=>idle(T),8000,"행동자 idle");
      await T.click('#turnBar button:first-child'); // 주 행동 생략
      await until(async()=>{ const a=await P1.ev(STATE), b=await P2.ev(STATE); return a.turn===n+1&&b.turn===n+1; },12000,"자동 턴 종료 "+n);
      await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"교대 정착"); };
    const endFrames=async T=>(await T.ev(FRAMES)).filter(f=>/"endTurn"/.test(f)).length;
    const freshTurn=async T=>{ for(let i=0;i<8;i++){ const a=await actorTab(); const st=await a.ev(STATE); if(a===T&&!st.main&&!st.locked) return; await passTurn(); } throw new Error("freshTurn 실패"); };
    const e0=[await P1.ev(FRAMES),await P2.ev(FRAMES)].map(f=>f.filter(x=>/"endTurn"/.test(x)).length);
    await passTurn(); await passTurn();
    const e1=[await endFrames(P1),await endFrames(P2)];
    const st3=await P1.ev(STATE);
    note("3a 자동 턴 종료 2회: 각 턴의 행동자 클라이언트만 endTurn 1프레임 송신 (P1 "+(e1[0]-e0[0])+" · P2 "+(e1[1]-e0[1])+")",{ok:e1[0]-e0[0]===1&&e1[1]-e0[1]===1&&st3.turn===2&&(await same(P1,P2)),detail:`turn=${st3.turn} autoEnds=${JSON.parse(await P1.ev(SNAP)).m.autoEnds}`});
    /* 이동 helper: 행동자 탭에서 from → to 클릭, 양 탭 정착 */
    const move=async(T,fr,fc,tr,tc)=>{ await until(async()=>idle(T),8000,"idle"); const p0=await T.ev(PIECE_AT(fr,fc)); await T.click(cell(fr,fc)); await sleep(120); const st=await T.ev(STATE); if(!p0||st.sel!==p0.id) throw new Error(`선택 실패 (${fr},${fc}) piece=${JSON.stringify(p0)} state=${JSON.stringify(st)}`); await T.click(cell(tr,tc)); await sleep(150); const p1=await T.ev(PIECE_AT(tr,tc)); if(!p1||p1.id!==p0.id){ const ok2=await T.ev(`(()=>{ const p=S.pieces.find(x=>x.id===${p0.id}); return {r:p.r,c:p.c,alive:p.alive,can:canMoveTo(p,${tr},${tc}),main:S.mainUsed}; })()`); throw new Error(`이동 실패 (${fr},${fc})→(${tr},${tc}) ${JSON.stringify(ok2)}`); } };
    const at=async(T,r,c)=>T.ev(PIECE_AT(r,c));

    /* ── 3. 하수인 접촉 → 전투 (실측 구간: 기본값) ── */
    // P1 하수인 (11,5) ↑ 5열, P2 하수인 (3,5) ↓ 5열 — 각자 자기 턴에 1칸씩. 턴 교대는 이동(주 행동) 뒤 자동 종료
    const M=await at(P1,11,5), N=await at(P2,3,5);
    note("3 전제: P1 (11,5)·P2 (3,5) 모두 하수인",{ok:M&&M.type==="minion"&&N&&N.type==="minion",detail:`${M&&M.type} / ${N&&N.type}`});
    const stepBoth=async(pairs)=>{ for(const [T,fr,fc,tr,tc] of pairs){ await freshTurn(T); const n=(await T.ev(STATE)).turn; await move(T,fr,fc,tr,tc);
      await until(async()=>{ const a=await P1.ev(STATE), b=await P2.ev(STATE); return a.turn===n+1&&b.turn===n+1; },12000,"이동 후 자동 종료"); await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"정착"); } };
    await stepBoth([[P1,11,5,10,5],[P2,3,5,4,5],[P1,10,5,9,5],[P2,4,5,5,5],[P1,9,5,8,5],[P2,5,5,6,5]]);
    const m3=await P1.ev(PIECE(M.id)), n3=await P1.ev(PIECE(N.id));
    note("3b 5열 접근 완료 (M (8,5) · N (6,5)) 양 탭 동일",{ok:m3.r===8&&n3.r===6&&(await same(P1,P2)),detail:`M (${m3.r},${m3.c}) N (${n3.r},${n3.c})`});
    await freshTurn(P1);
    for(const T of [A,B]) await T.ev(REAL);
    await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"실측 전 idle");
    for(const T of [A,B]) await T.ev(`(()=>{ FX.log.length=0; return true; })()`);
    const eB=[await endFrames(P1),await endFrames(P2)]; // 전투 직전 기준
    const tMove=Date.now();
    await P1.click(cell(8,5)); await sleep(150); await P1.click(cell(7,5)); await sleep(250);
    const c1=await P1.ev(STATE), c2=await P2.ev(STATE);
    note("4a 이동 즉시 양 탭 전투 진입(규칙 동기) · 접촉 배너 표시·잠금",{ok:c1.battle&&c2.battle&&c1.banner.visible&&/접촉/.test(c1.banner.title)&&c1.locked,detail:`P1 ${c1.banner.title} / P2 ${c2.banner.title}`});
    note("4b 상대 탭 거울 배너 '⚠️ 내 말 접촉!'",{ok:c2.banner.visible&&c2.banner.title==="⚠️ 내 말 접촉!",detail:c2.banner.title});
    await P1.shot("3-contact-banner-actor");
    await sleep(2300); const c3=await P1.ev(STATE), c4=await P2.ev(STATE);
    note("4c 2초 뒤 상황 문구 '배틀을 시작합니다.' / 거울 '상대가 내 하수인에게 배틀을 걸었습니다.'",{ok:c3.banner.sub==="배틀을 시작합니다."&&c4.banner.sub==="상대가 내 하수인에게 배틀을 걸었습니다.",detail:`${c3.banner.sub} | ${c4.banner.sub}`});
    await sleep(2300); const c5=await P1.ev(STATE);
    note("4d 그 뒤 카운트다운(3 또는 2 — 샘플 시각 오차)",{ok:c5.banner.visible&&/count/.test(c5.banner.cls)&&/^[32]$/.test(c5.banner.title),detail:JSON.stringify(c5.banner)});
    await P1.shot("4-countdown");
    // 카운트다운 중 카테고리 클릭 무시
    try{ await P1.click('#bmenu button'); }catch(e){}
    await sleep(100); note("4e 카운트다운 중 카테고리 클릭 무시 (menu null)",{ok:(await P1.ev(STATE)).menu===null});
    await until(async()=>(await idle(P1))&&(await idle(P2)),20000,"전투 메뉴 활성");
    const fxA=JSON.parse(await P1.ev(FXLOG)), fxB=JSON.parse(await P2.ev(FXLOG));
    const seqOf=fx=>fx.map((x,i)=>x.k==="contactBanner"&&i===1?x.sub:(x.title||x.sub));
    const expect=["⚠️ 상대 말 접촉!","배틀을 시작합니다.","3","2","1","배틀 시작!","나의 턴!"], expectB=["⚠️ 내 말 접촉!","상대가 내 하수인에게 배틀을 걸었습니다.","3","2","1","배틀 시작!","상대 턴!"];
    const sA=seqOf(fxA).slice(0,7), sB=seqOf(fxB).slice(0,7);
    note("4f 양 탭 연출 순서: 접촉 → 상황 → 3·2·1·배틀 시작! → 라운드 배너 (거울 문구)",{ok:JSON.stringify(sA)===JSON.stringify(expect)&&JSON.stringify(sB)===JSON.stringify(expectB),detail:`P1 ${sA.join("|")} / P2 ${sB.join("|")}`});
    const gapsA=fxA.slice(1,7).map((x,i)=>x.shown-fxA[i].shown);
    timing.contactToMenu={gaps:gapsA,total:Date.now()-tMove};
    note("4g 각 구간 실측 ≥ 선언 시간 (접촉 2000·상황 2000·카운트 1000×4·라운드 2000)",{ok:gapsA[0]>=1900&&gapsA[1]>=1900&&gapsA.slice(2,5).every(g=>g>=900)&&gapsA[5]>=900,detail:gapsA.join("/")+"ms · 총 "+(Date.now()-tMove)+"ms"});
    const bm1=await P1.ev(BTN_TEXT("#bmenu button")), bm2=await P2.ev(BTN_TEXT("#bmenu button"));
    note("4h 행동자 탭 4카테고리 활성 · 상대 탭 거울 사본 비활성",{ok:bm1.length===4&&bm1.every(b=>!b[1])&&bm2.length===4&&bm2.every(b=>b[1]),detail:bm1.map(b=>b[0]).join(",")});
    await P1.shot("5-battle-menu-actor"); await P2.shot("6-battle-menu-mirror");
    /* 전투 완주: 각 행동자 탭에서 싸우기 → 첫 활성 기술 (기술 2초 → 피해 2초 실측 1회) */
    let clicks=0, measured=null, resA=null, resB=null;
    const pollResult=async()=>{ const a=await P1.ev(STATE), b=await P2.ev(STATE); if(a.banner.visible&&/result/.test(a.banner.cls)) resA=a.banner.title; if(b.banner.visible&&/result/.test(b.banner.cls)) resB=b.banner.title; return [a,b]; };
    const battleTab=async()=>{ const s=await P1.ev(STATE); return s.actor===0?P1:P2; };
    for(const t0=Date.now();Date.now()-t0<240000;){
      const [a,b]=await pollResult();
      if(a.locked||b.locked||a.queue||b.queue){ if(a.banner.visible&&/result/.test(a.banner.cls)&&!shots.some(x=>/9-result/.test(x))) await P1.shot("9-result-banner"); await sleep(80); continue; }
      if(!a.battle&&!b.battle&&!a.overlay&&!b.overlay) break;
      if(!a.battle){ await sleep(100); continue; }
      const T=await battleTab();
      await T.click('#bmenu button'); await sleep(120); // ⚔️ 싸우기
      const before=(await T.ev(STATE)); const tAct=Date.now();
      await T.click('#bsub-fight .row button:not([disabled])'); clicks++;
      if(!measured){ // 첫 행동: 기술 그룹 → 피해 그룹 시각
        const t1=await until(async()=>{ const m=await T.ev(`(()=>document.getElementById("msgBox")&&document.getElementById("msgBox").innerHTML||"")()`); return /의 .+!/.test(m)?Date.now():null; },3000,"기술 문구");
        await T.shot("7-skill-group");
        const t2=await until(async()=>{ const m=await T.ev(`(()=>document.getElementById("msgBox")&&document.getElementById("msgBox").innerHTML||"")()`); return /피해!/.test(m)?Date.now():null; },6000,"피해 문구");
        await T.shot("8-damage-group");
        measured={skillToDamage:t2-t1};
        note("4i 싸우기: 기술 문구 → 피해 문구 간격 실측 ≈2초",{ok:t2-t1>=1900&&t2-t1<=3200,detail:`${t2-t1}ms`});
      }
      await sleep(200);
      if(clicks>60) break;
    }
    // 결과 배너 포착 (2.5초) — 전투 루프 안에서 폴링한 값 + 종료 직후 보강
    for(const t0=Date.now();Date.now()-t0<6000&&(!resA||!resB);){ const [a,b]=await pollResult(); if(!a.battle&&!b.battle&&!a.locked&&!b.locked) break; await sleep(100); }
    await settled(P1,P2,"전투 종료 정착",30000);
    const after=JSON.parse(await P1.ev(SNAP));
    const mA=await P1.ev(PIECE(M.id)), nA=await P1.ev(PIECE(N.id));
    const winner=mA.alive&&!nA.alive?0:(!mA.alive&&nA.alive?1:null);
    note("4j 전투 완주 (실제 버튼 "+clicks+"회) · 양 탭 S 동일 · 승자 확정",{ok:winner!==null&&(await same(P1,P2)),detail:`M alive=${mA.alive} hp=${mA.hp} / N alive=${nA.alive} hp=${nA.hp} judged=${after.m.judged}`});
    const wantA=winner===0?"전투에서 승리!":"전투에서 패배,,,", wantB=winner===0?"전투에서 패배,,,":"전투에서 승리!";
    note("4k 결과 배너 뷰어 기준 (P1 '"+resA+"' / P2 '"+resB+"')",{ok:resA===wantA&&resB===wantB,detail:`기대 P1 ${wantA} / P2 ${wantB}`});
    const e2=[await endFrames(P1),await endFrames(P2)];
    note("4l 전투 중 비행동자(P2) endTurn 프레임 증가 0 · 행동자(P1)는 전투 뒤 자동 종료 최대 1 (수신 측 자율 발화 없음)",{ok:e2[1]===eB[1]&&e2[0]-eB[0]<=1,detail:`P1 +${e2[0]-eB[0]} P2 +${e2[1]-eB[1]}`});

    /* ── 4. 회복 (fast) ── */
    for(const T of [A,B]) await T.ev(FAST);
    const survivor=winner===0?M:N, ownerTab=winner===0?P1:P2, otherTab=ownerTab===P1?P2:P1; const owner=winner===0?0:1;
    // 전투 후 강제 queue·선택 전투가 없으면 행동자 턴이 자동으로 넘어갔을 수 있다 — 생존 말 소유자의 턴까지 교대
    await freshTurn(ownerTab);
    const sv=await ownerTab.ev(PIECE(survivor.id));
    if(sv.hp<sv.maxHp){
      await ownerTab.click(cell(sv.r,sv.c)); await sleep(150);
      const hb=await ownerTab.ev(BTN_TEXT("#turnBar button"));
      const healBtn=hb.find(b=>/회복/.test(b[0]));
      note("5a 손상 말 선택 → 회복 버튼 활성",{ok:!!healBtn&&!healBtn[1],detail:JSON.stringify(hb)});
      const fullPiece=await ownerTab.ev(`(()=>{ const p=S.pieces.find(x=>x.owner===NET.me&&x.type==="minion"&&x.alive&&x.placed&&x.hp===x.maxHp&&x.id!==${survivor.id}); return p?[p.r,p.c]:null; })()`);
      if(fullPiece){ await ownerTab.click(cell(fullPiece[0],fullPiece[1])); await sleep(150); const hb2=await ownerTab.ev(BTN_TEXT("#turnBar button")); note("5b 만피 말 선택 → 회복 버튼 비활성",{ok:!!hb2.find(b=>/회복/.test(b[0])&&b[1])}); await ownerTab.click(cell(sv.r,sv.c)); await sleep(150); }
      const turnH=(await ownerTab.ev(STATE)).turn;
      const idx=hb.findIndex(b=>/회복/.test(b[0]));
      for(const T of [A,B]) await T.ev(`(()=>{ BAL.fx.autoEndGrace=1500; return true; })()`); // 즉시 회복 없음을 자동 종료(틱) 전에 읽기 위해 grace 를 잠시 늘린다
      await ownerTab.click(`#turnBar button:nth-child(${idx+1})`); await sleep(400);
      const h1=await ownerTab.ev(PIECE(survivor.id)), h2=await otherTab.ev(PIECE(survivor.id));
      note("5c 회복 지정 → 양 탭 healing=true · mainUsed · 즉시 회복 없음",{ok:h1.healing&&h2.healing&&h1.hp===sv.hp&&h2.hp===sv.hp,detail:`hp ${h1.hp}/${h1.maxHp}`});
      for(const T of [A,B]) await T.ev(`(()=>{ BAL.fx.autoEndGrace=100; return true; })()`);
      const chips=await ownerTab.ev(HEALCHIPS), chipsO=await otherTab.ev(HEALCHIPS);
      note("5d 소유자 화면 회복 이펙트 칩 · 상대 화면은 공개 말이면 표시(전투로 revealed)",{ok:chips.length===1&&(h1.revealed?chipsO.length===1:chipsO.length===0),detail:`owner ${JSON.stringify(chips)} other ${JSON.stringify(chipsO)} revealed=${h1.revealed}`});
      await ownerTab.shot("10-heal-effect");
      await until(async()=>{ const a=await P1.ev(STATE), b=await P2.ev(STATE); return a.turn===turnH+1&&b.turn===turnH+1; },15000,"회복 턴 자동 종료");
      await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"정착");
      const g=Math.round(sv.maxHp*0.05);
      const t1a=await P1.ev(PIECE(survivor.id)), t1b=await P2.ev(PIECE(survivor.id));
      note("5e 지정한 턴 종료에 +"+g+" (양 탭 동일)",{ok:t1a.hp===Math.min(sv.maxHp,sv.hp+g)&&t1b.hp===t1a.hp,detail:`${sv.hp} → ${t1a.hp}/${t1b.hp}`});
      await passTurn(); // 상대 턴 생략 → 자동 종료 → 두 번째 틱
      const t2a=await P1.ev(PIECE(survivor.id)), t2b=await P2.ev(PIECE(survivor.id));
      note("5f 상대 턴 종료에도 +"+g+" (한 쌍 10%) · 양 탭 동일",{ok:t2a.hp===Math.min(sv.maxHp,sv.hp+2*g)&&t2b.hp===t2a.hp&&t2a.healing,detail:`${t2a.hp}/${t2b.hp}`});
    } else note("5 회복 (전제 불충족: 생존 말이 만피 — 회복 검증은 헤드리스 smoke_turnflow 로 대체)",{ok:true,detail:`hp ${sv.hp}/${sv.maxHp}`});

    /* ── 5. 폭탄 직접 접촉: P2 폭탄 (3,2) ↓ · P1 하수인 (11,2) ↑ ── */
    const K=await at(P1,11,2), Bm=await at(P2,3,2);
    note("6a 전제: P1 하수인 (11,2) · P2 폭탄 (3,2)",{ok:K&&K.type==="minion"&&Bm&&Bm.type==="bomb"});
    await stepBoth([[P1,11,2,10,2],[P2,3,2,4,2],[P1,10,2,9,2],[P2,4,2,5,2],[P1,9,2,8,2],[P2,5,2,6,2]]);
    const k6=await P1.ev(PIECE(K.id)), b6=await P1.ev(PIECE(Bm.id));
    note("6b 접근 완료 K (8,2) · 폭탄 (6,2)",{ok:k6.r===8&&b6.r===6&&(await same(P1,P2))});
    await freshTurn(P2);
    for(const T of [A,B]) await T.ev(REAL); await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"idle");
    for(const T of [A,B]) await T.ev(`(()=>{ FX.log.length=0; return true; })()`);
    const bc0=JSON.parse(await P1.ev(SNAP)).m.bombContacts;
    await P2.click(cell(6,2)); await sleep(150); await P2.click(cell(7,2)); await sleep(300);
    const s6=await P2.ev(STATE), s6b=await P1.ev(STATE);
    note("6c 폭탄 이동 → 접촉 배너 (행동자 P2 '상대 말 접촉!' / P1 '내 말 접촉!')",{ok:s6.banner.title==="⚠️ 상대 말 접촉!"&&s6b.banner.title==="⚠️ 내 말 접촉!",detail:`${s6.banner.title} | ${s6b.banner.title}`});
    await sleep(2300); const s7=await P2.ev(STATE), s7b=await P1.ev(STATE);
    note("6d 상황 4 문구 / 거울",{ok:s7.banner.sub==="폭탄이 터져 상대 하수인과 함께 제거됩니다."&&s7b.banner.sub==="상대 폭탄이 터져 내 하수인이 제거됩니다.",detail:`${s7.banner.sub} | ${s7b.banner.sub}`});
    await sleep(2300); const gh1=await P1.ev(GHOSTS), gh2=await P2.ev(GHOSTS), kk=await P1.ev(PIECE(K.id)), bb=await P1.ev(PIECE(Bm.id));
    note("6e 폭발 연출 중: 규칙상 이미 제거(alive=false)됐지만 표시 유지(ghost 칩 2) 양 탭",{ok:!kk.alive&&!bb.alive&&gh1===2&&gh2===2,detail:`ghosts P1=${gh1} P2=${gh2}`});
    await P1.shot("11-explosion-hold");
    await until(async()=>(await idle(P1))&&(await idle(P2)),10000,"폭발 종료");
    const gh3=await P1.ev(GHOSTS); const bc1=JSON.parse(await P1.ev(SNAP)).m.bombContacts;
    note("6f 연출 종료 후 칩 소멸 · bombContacts +1 · 양 탭 동일",{ok:gh3===0&&bc1===bc0+1&&(await same(P1,P2)),detail:`bombContacts ${bc0}→${bc1}`});

    /* ── 6. 함정: P2 하수인 (3,7) ↓ 7열 → (10,7) 도착 = P1 함정 (11,7) 신규 인접 → 발동·공개 ── */
    for(const T of [A,B]) await T.ev(FAST);
    const Q=await at(P2,3,7), TR=await at(P1,11,7);
    note("7a 전제: P2 하수인 (3,7) · P1 함정 (11,7)",{ok:Q&&Q.type==="minion"&&TR&&TR.type==="trap"});
    const path7=[[3,7,4,7],[4,7,5,7],[5,7,6,7],[6,7,7,7],[7,7,8,7],[8,7,9,7]];
    for(const [fr,fc,tr,tc] of path7){ await freshTurn(P2); const n=(await P2.ev(STATE)).turn; await move(P2,fr,fc,tr,tc);
      await until(async()=>{ const a=await P1.ev(STATE), b=await P2.ev(STATE); return a.turn===n+1&&b.turn===n+1; },12000,"이동 후 자동 종료"); await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"정착"); }
    await freshTurn(P2); await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"idle");
    const rev0=await P1.ev(`(()=>S.pieces.filter(p=>p.revealed).map(p=>p.id).sort().join(","))()`);
    await move(P2,9,7,10,7); await until(async()=>(await idle(P1))&&(await idle(P2)),15000,"함정 연출 종료");
    const q7=await P1.ev(PIECE(Q.id)), t7=await P1.ev(PIECE(TR.id)), q7b=await P2.ev(PIECE(Q.id));
    const rev1=await P1.ev(`(()=>S.pieces.filter(p=>p.revealed).map(p=>p.id).sort().join(","))()`);
    const added=rev1.split(",").filter(x=>x&&!rev0.split(",").includes(x)).map(Number).sort((a,b)=>a-b);
    note("7b 함정 발동: 걸린 말·함정 revealed · immobile 2 · 함정 제거 · 양 탭 동일",{ok:q7.revealed&&t7.revealed&&!t7.alive&&q7.immobile===2&&q7b.revealed&&(await same(P1,P2)),detail:`Q revealed=${q7.revealed} immobile=${q7.immobile} / trap alive=${t7.alive} revealed=${t7.revealed}`});
    note("7c 새로 공개된 말은 그 둘뿐",{ok:JSON.stringify(added)===JSON.stringify([Q.id,TR.id].sort((a,b)=>a-b)),detail:added.join(",")});
    await P1.shot("12-trap-reveal-p1");

    /* ── 7. 65턴 버닝 타임 배너 (양 탭 같은 순서 · 1회) ── */
    while((await P1.ev(STATE)).turn<63) await passTurn();
    await until(async()=>(await idle(P1))&&(await idle(P2)),8000,"idle");
    for(const T of [A,B]) await T.ev(`(()=>{ FX.log.length=0; BAL.fx.turnBanner=600; return true; })()`);
    await passTurn(); // turnCount 63 → 64 = 표시 턴 65
    const st8=await P1.ev(STATE);
    const f8a=JSON.parse(await P1.ev(FXLOG)).filter(x=>x.k==="turnBanner"), f8b=JSON.parse(await P2.ev(FXLOG)).filter(x=>x.k==="turnBanner");
    note("8a 65턴 진입: 양 탭 '버닝타임입니다! 2칸씩 이동 가능합니다' → 턴 배너 순서",{ok:st8.turn===64&&f8a[0]&&/버닝타임입니다! 2칸씩 이동 가능합니다/.test(f8a[0].title)&&/턴!/.test((f8a[1]||{}).title||"")&&f8b[0]&&/버닝타임입니다!/.test(f8b[0].title)&&/턴!/.test((f8b[1]||{}).title||""),
      detail:`P1 ${f8a.map(x=>x.title).join(" → ")} / P2 ${f8b.map(x=>x.title).join(" → ")}`});
    await P1.shot("13-bt-banner");
    const cntBT=t=>t.filter(x=>/버닝타임/.test(x.title)).length;
    await passTurn();
    const f9a=JSON.parse(await P1.ev(FXLOG)), f9b=JSON.parse(await P2.ev(FXLOG));
    note("8b 66턴에는 재표시 없음 (경기당 1회) · 송신 프레임에 배너 없음",{ok:cntBT(f9a)===1&&cntBT(f9b)===1&&!(await P1.ev(FRAMES)).some(f=>/버닝|banner|fx/.test(f)),detail:`P1 ${cntBT(f9a)} P2 ${cntBT(f9b)}`});
    const e3=[await endFrames(P1),await endFrames(P2)]; const sn=JSON.parse(await P1.ev(SNAP));
    note("8c 전체 구간 자동 종료 프레임 = 각 탭 자기 턴 수 (수신 측 자율 발화 0) · autoEnds 양 탭 동일",{ok:e3[0]+e3[1]===sn.m.autoEnds&&JSON.parse(await P2.ev(SNAP)).m.autoEnds===sn.m.autoEnds,detail:`P1 ${e3[0]} + P2 ${e3[1]} = autoEnds ${sn.m.autoEnds}`});
    const e1c=await P1.ev(CONSOLE_ERR), e2c=await P2.ev(CONSOLE_ERR);
    note("8d 콘솔 오류 0 (두 탭)",{ok:e1c.length===0&&e2c.length===0,detail:JSON.stringify(e1c.concat(e2c)).slice(0,300)});
    for(const t of [A,B]) try{ await cdp.send("Target.closeTarget",{targetId:t.targetId}); }catch(e){}

    /* ── 8. PVE 탭: AI 턴 배너·대기 · 좁은 폭 전투 메뉴 ── */
    const V=await tab(URL); V.name="PVE"; // 배치·시작은 기본 폭(버튼이 화면 안에 있어야 클릭된다), 좁은 폭 검사는 전투 직전에 400×820 으로 전환
    await V.click('button[onclick="startMode(\'pve\',{aiLevel:\'grade5\'})"]'); await sleep(150);
    await V.ev(`(()=>{ autoPlace(); return true; })()`); await V.click('#sidePanel button.primary'); await sleep(200);
    const v0=await V.ev(STATE);
    note("9a PVE 시작: 첫 턴 배너 (선공 "+(v0.cur===0?"나":"AI")+")",{ok:v0.phase==="play"&&v0.banner.visible&&(v0.cur===0?v0.banner.title==="나의 턴!":v0.banner.title==="상대 턴!"),detail:JSON.stringify(v0.banner)});
    if(v0.cur===0){ await until(async()=>idle(V),5000,"idle"); await V.click('#turnBar button:first-child'); await until(async()=>(await V.ev(STATE)).cur===1,6000,"AI 턴"); }
    const v1=await V.ev(STATE); const tAI=Date.now();
    note("9b AI 턴 '상대 턴!' 배너·잠금",{ok:v1.cur===1&&v1.banner.visible&&v1.banner.title==="상대 턴!"&&v1.locked,detail:JSON.stringify(v1.banner)});
    await V.shot("14-pve-opponent-turn");
    await sleep(1200); const v2=await V.ev(STATE);
    note("9c 배너 중(≈1.2초) AI 미행동 (mainUsed false)",{ok:v2.cur===1&&!v2.main,detail:`main=${v2.main} locked=${v2.locked}`});
    const tAct=await until(async()=>{ const s=await V.ev(STATE); return (s.cur===0||s.main)?Date.now():null; },15000,"AI 행동");
    const shownAI=JSON.parse(await V.ev(FXLOG)).filter(x=>x.k==="turnBanner"&&x.title==="상대 턴!").pop();
    const sinceBanner=shownAI?tAct-shownAI.shown:-1; // 배너 표시 시각(페이지 시계)부터 AI 행동 감지까지 — 배너 2000ms + aiDelay 650ms 이상이어야 한다 (감지 폴링 ≤100ms)
    note("9d 배너 해제 후 AI 행동: 배너 표시부터 "+sinceBanner+"ms ≥ 2000+aiDelay(650)",{ok:sinceBanner>=2600,detail:`shown→act ${sinceBanner}ms`});
    await until(async()=>{ const s=await V.ev(STATE); return s.cur===0&&!s.locked&&!s.battle&&!s.overlay; },20000,"내 턴 복귀");
    await V.vp(400,820); await sleep(200);
    // 좁은 폭 전투 메뉴: 표시 검증용으로 페이지 안에서 전투를 직접 연다 (규칙 함수 호출 — 표시 계층 검증 전용)
    await V.ev(`(()=>{ BAL.fx.countStep=10; BAL.fx.roundBanner=10; const m=S.pieces.find(p=>p.owner===0&&p.type==="minion"&&p.alive), e=S.pieces.find(p=>p.owner===1&&p.type==="minion"&&p.alive); const o=at(7,4); if(o) o.placed=false; const o2=at(6,4); if(o2) o2.placed=false; m.r=7;m.c=4; e.r=6;e.c=4; S.current=0; S.mainUsed=false; S.battlesUsed=0; startRounds(m,e,m,e); return true; })()`);
    await until(async()=>idle(V),8000,"전투 메뉴");
    const nb=await V.ev(`(()=>{ const box=document.getElementById("overlayBox"); const w=box.scrollWidth, cw=box.clientWidth; const bm=document.getElementById("bmenu").getBoundingClientRect(); return {overflow:w>cw+1,menuW:bm.width,menuVisible:bm.width>0&&bm.height>0,docW:document.documentElement.scrollWidth,vw:window.innerWidth}; })()`);
    note("9e 400px 폭: 전투 모달 가로 넘침 없음 · 4카테고리 메뉴 표시 (페이지 자체 폭 docW 는 #106 이전부터 고정 보드 376px + 사이드 패널 min-width 300px 레이아웃 — 부채로 기록, 판정 제외)",{ok:!nb.overflow&&nb.menuVisible,detail:JSON.stringify(nb)});
    await V.shot("15-narrow-battle-menu");
    await V.click('#bmenu button'); await sleep(120);
    const nb2=await V.ev(`(()=>{ const f=document.getElementById("bsub-fight"); return {shown:!f.classList.contains("hidden"),btns:[...f.querySelectorAll(".row button")].length,rootHidden:document.getElementById("bmenu").classList.contains("hidden")}; })()`);
    note("9f 싸우기 열기 → 기술 패널 표시·루트 숨김",{ok:nb2.shown&&nb2.rootHidden&&nb2.btns>=4,detail:JSON.stringify(nb2)});
    await V.shot("16-narrow-fight-submenu");
    await V.click('#bsub-fight .row:last-child button'); await sleep(120);
    note("9g ← 뒤로 → 루트 복귀 (송신·규칙 무변경)",{ok:(await V.ev(`(()=>!document.getElementById("bmenu").classList.contains("hidden")&&S.battle.round===1&&S.battle.phase===0)()`))});
    const ev=await V.ev(CONSOLE_ERR); note("9h PVE 탭 콘솔 오류 0",{ok:ev.length===0,detail:JSON.stringify(ev).slice(0,200)});
    try{ await cdp.send("Target.closeTarget",{targetId:V.targetId}); }catch(e){}
    timing.total=Date.now()-tStart;
  }catch(e){ note("실행",{error:e.message+"\n"+(e.stack||"")}); }
  finally{
    if(chrome){ try{ chrome.proc.kill(); }catch(e){} await sleep(300); try{ fs.rmSync(chrome.udd,{recursive:true,force:true}); console.log("CLEANUP profile="+chrome.udd); }catch(e){} }
    if(server){ try{ server.proc.kill(); }catch(e){} }
  }
  const summary={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),viewport:VP,date:new Date().toISOString(),readOnly:READ_ONLY,pass:report.filter(r=>r.ok!==false&&!r.error).length,fail:bad,shots,timing,report};
  if(!READ_ONLY){ const f=path.join(OUT,"issue106_cdp_report.json"); fs.writeFileSync(f,JSON.stringify(summary,null,2)); console.log("REPORT "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  console.log(`\n=== issue106_cdp: pass ${summary.pass} / fail ${summary.fail}${READ_ONLY?" (read-only · 산출물 0)":""} ===`);
  process.exit(bad?1:0);
})();
