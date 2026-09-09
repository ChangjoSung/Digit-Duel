/* #94 상대 턴 로컬 메모 — 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 릴레이 서버 · 온라인 클라이언트 2개 · 실제 마우스 클릭)
   사용: node demo/test/milestone/v0.4.4/issues/94/memo_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots]
   --read-only: Saturn 독립 재검증용 — 검증 산출물 0(스크린샷·보고서 JSON 없음), stdout 만. 헤드리스 Chrome 임시 프로필(os.tmpdir()/memocdp-*)은
                실행 부수 리소스로 mkdtemp 로 만든 정확한 경로 하나만 종료 시 정리한다(RESOURCE/CLEANUP 행). 검증 전용 릴레이 서버는 PORT=0 임의 포트·루프백.
   목적: 헤드리스 DOM 스텁으로는 알 수 없는 것 — 실제 WebSocket 소켓의 송신 수(연결된 소켓 send 래핑 + 상대 클라이언트의 실제 수신 프레임 수),
         실제 릴레이를 거친 두 클라이언트의 게임 상태 일치, 실제 마우스 클릭 경로(셀 → 피커 → 선택지), 오버레이·토스트·사이드 패널의 실제 표시 — 를 진짜 렌더 트리에서 잰다.
   흐름: [온라인 HTTP] W(상대 턴) 미공개 상대 말 클릭 → 피커(송신 0) → 💣 저장(송신 0·X 수신 0·X 메모 없음) → W 자기 말 클릭 차단 토스트 → X 실제 이동(송신 2) → 양측 상태 일치·W 메모 유지
         → X 턴 종료 → W 자기 턴 (b) 메모 송신 0 · 자기 말 선택 송신 1 → 추측 삭제 → [PVE file://] AI 턴 중 피커·저장.
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome + server/node_modules(ws). 외부 패키지 없음. 종료 코드 1 = 판정 실패. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.4","issues","94","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(__dirname,"..","..","..","..","..","index.html"));
const FILE_URL="file:///"+HTML.replace(/\\/g,"/");

/* ── CDP 배선 (minion_art_cdp.js 와 같은 방식) ───────────────────────────── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"memocdp-"));
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
const JOIN=code=>`(()=>{ document.getElementById("netCode").value=${JSON.stringify(code)}; netPrepare(); autoPlace(); setupDone(); return {phase:S.phase,queued:NET.queued}; })()`;
const STATE=`(()=>({started:NET.started,phase:S.phase,cur:S.current,me:NET.me,turn:S.turnCount}))()`;
/* 연결된 실제 소켓의 송신·수신 계측 — 게임 코드는 건드리지 않고 이 소켓 인스턴스의 send/onmessage 만 감싼다 */
const INSTR=`(()=>{ window.__sent=0; window.__recvA=0; const ws=NET.ws; const o=ws.send.bind(ws); ws.send=m=>{ window.__sent++; return o(m); };
  const om=ws.onmessage; ws.onmessage=ev=>{ try{ const m=JSON.parse(ev.data); if(m&&m.t==="a") window.__recvA++; }catch(e){} return om.call(ws,ev); }; return true; })()`;
/* 게임 상태 스냅샷(메모 제외·뷰어 표기 정규화) — 두 탭 일치 판정 */
const SNAP=`(()=>JSON.stringify({phase:S.phase,cur:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,
  pieces:S.pieces.map(p=>[p.id,p.r,p.c,p.alive,p.placed,p.hp,p.revealed,p.immobile]),
  log:S.log.map(l=>l.msg).filter(m=>!/당신은 P[12]/.test(m)).map(m=>m.replace(/(나|상대)\\((P[12])\\)/g,"$2")),
  sel:S.selected?S.selected.id:null,tele:!!S.teleport,forced:S.forcedTargets,battle:!!S.battle,seq:NET.modalSeq,sync:NET.syncModal?NET.syncModal.seq:null,queue:NET.queue.length}))()`;
const TARGET=`(()=>{ const v=NET.mode?NET.me:0; const x=S.pieces.find(p=>p.owner!==v&&p.alive&&p.placed&&p.type==="minion"&&!p.revealed&&visibleTo(v,p)
  &&!S.pieces.some(y=>y.owner===v&&y.alive&&y.placed&&Math.abs(y.r-p.r)+Math.abs(y.c-p.c)===1)); return x?{id:x.id,r:x.r,c:x.c}:null; })()`;
const MINE=`(()=>{ const v=NET.mode?NET.me:0; const x=S.pieces.find(p=>p.owner===v&&p.alive&&p.placed&&p.type==="minion"&&p.immobile===0); return x?{id:x.id,r:x.r,c:x.c}:null; })()`;
const MOVE_PLAN=`(()=>{ const v=NET.me, dir=v===0?-1:1; for(const p of S.pieces.filter(p=>p.owner===v&&p.alive&&p.placed&&p.type==="minion"&&p.immobile===0)){
  for(const c of [[p.r,p.c+1],[p.r,p.c-1],[p.r+dir,p.c]]) if(c[1]>=1&&c[1]<=7&&![4,5,9,10].includes(c[0])&&!at(c[0],c[1])&&canMoveTo(p,c[0],c[1])) return {id:p.id,r:p.r,c:p.c,tr:c[0],tc:c[1]}; } return null; })()`;
const UI=`(()=>{ const ov=document.getElementById("overlay"), ob=document.getElementById("overlayBox");
  return {overlayHidden:ov.classList.contains("hidden"),picker:/정체 추측/.test(ob.innerHTML),ovText:ob.textContent.slice(0,60),
    toasts:[...document.querySelectorAll("#toasts .toast")].map(t=>t.textContent),side:document.getElementById("sidePanel").textContent,
    guessCells:[...document.querySelectorAll(".cell .pc.memo-guess")].map(ch=>[+ch.parentNode.dataset.r,+ch.parentNode.dataset.c,ch.querySelector(".guess")&&ch.querySelector(".guess").textContent]),
    turnBtns:[...document.querySelectorAll("#turnBar button")].map(b=>[b.textContent,b.disabled]),badge:[...document.querySelectorAll("#turnBar .badge")].map(b=>b.textContent),
    memos:JSON.parse(JSON.stringify(S.memos)),sent:window.__sent,recvA:window.__recvA,sel:S.selected?S.selected.id:null,cur:S.current,me:NET.me}; })()`;
const RECT=sel=>`(()=>{ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`;
const CLEAR_TOASTS=`(()=>{ document.getElementById("toasts").innerHTML=""; return true; })()`;

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const report=[]; let bad=0; const shots=[];
  const note=(what,r)=>{ report.push({what,...r}); if(r.error||r.ok===false) bad++; console.log((r.ok===false||r.error?"FAIL ":"ok   ")+what+(r.detail?" — "+r.detail:"")+(r.error?" — "+r.error:"")); };
  let server=null, chrome=null;
  try{
    server=await startServer();
    console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port} (접속 코드는 출력하지 않는다)`);
    chrome=await launch();
    console.log(`RESOURCE chrome pid=${chrome.proc.pid} profile=${chrome.udd}`);
    const cdp=await connect(chrome.ws);
    const tab=async url=>{ const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
      const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
      await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false},sid);
      const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url},sid); await loaded; await sleep(300);
      const t={sid,targetId,
        ev:async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("page: "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails)); return r.result.value; },
        click:async sel=>{ const p=await t.ev(RECT(sel)); if(!p) throw new Error("클릭 대상 없음 "+sel);
          for(const type of ["mousePressed","mouseReleased"]) await cdp.send("Input.dispatchMouseEvent",{type,x:p.x,y:p.y,button:"left",clickCount:1},sid); await sleep(120); return p; },
        shot:async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
          const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); const rel=path.relative(ROOT,f).replace(/\\/g,"/"); shots.push(rel); console.log("SHOT "+rel); }};
      return t; };
    const until=async(fn,ms,label)=>{ const t0=Date.now(); for(;;){ const v=await fn(); if(v) return v; if(Date.now()-t0>ms) throw new Error("대기 시간 초과: "+label); await sleep(150); } };
    const cell=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;

    /* ── 1. 온라인 2클라이언트 매칭 (실제 서버·실제 코드 인증) ── */
    const URL=`http://127.0.0.1:${server.port}/index.html`;
    const A=await tab(URL), B=await tab(URL);
    for(const t of [A,B]){ await t.ev(PREP); await t.ev(JOIN(server.code)); }
    await until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"온라인 매칭·시작");
    const sa=await A.ev(STATE), sb=await B.ev(STATE);
    const W=sa.cur!==sa.me?A:B, X=W===A?B:A; // W: 상대 턴을 기다리는 쪽 · X: 행동 차례
    for(const t of [A,B]) await t.ev(INSTR);
    note("1 온라인 매칭·시작·양측 상태 일치",{ok:sa.started&&sb.started&&(await A.ev(SNAP))===(await B.ev(SNAP)),detail:`A me=${sa.me} B me=${sb.me} 선공 P${sa.cur+1}`});

    /* ── 2. W(상대 턴): 미공개 상대 말 실제 클릭 → 피커 · 송신 0 ── */
    const tg=await W.ev(TARGET);
    note("2a 전제: W 가 볼 수 있는 비인접 미공개 상대 하수인",{ok:!!tg,detail:JSON.stringify(tg)});
    await W.ev(CLEAR_TOASTS); await W.click(cell(tg.r,tg.c)); await sleep(200);
    let u=await W.ev(UI);
    note("2b 상대 턴 클릭 → 피커 열림 · 송신 0 · 차단 토스트 없음 · selected 없음",{ok:u.picker&&!u.overlayHidden&&u.sent===0&&!u.toasts.some(t=>/상대 턴/.test(t))&&u.sel===null,detail:`sent=${u.sent} picker=${u.picker} toasts=${JSON.stringify(u.toasts)}`});
    await W.shot("1-online-opponent-turn-picker");
    /* ── 3. 💣 실제 클릭 → 저장 · 송신 0 · X 수신 0 · X 메모 없음 ── */
    await W.click('#memoOpts button[data-key="bomb"]'); await sleep(400);
    u=await W.ev(UI); const ux=await X.ev(UI);
    const wm=u.memos[u.me]||{};
    note("3a 저장: W 메모 💣 · 보드 추측 표시 · 사이드 패널 목록 · 피커 닫힘 · 송신 0",{ok:wm[tg.id]==="bomb"&&u.guessCells.some(g=>g[0]===tg.r&&g[1]===tg.c&&g[2]==="💣")&&/추측 메모/.test(u.side)&&u.overlayHidden&&u.sent===0,detail:`sent=${u.sent} guess=${JSON.stringify(u.guessCells)}`});
    note("3b X: 실제 수신 액션 프레임 0 · 메모 없음 · 보드 추측 흔적 0",{ok:ux.recvA===0&&Object.keys(ux.memos[0]).length===0&&Object.keys(ux.memos[1]).length===0&&ux.guessCells.length===0,detail:`X recvA=${ux.recvA}`});
    note("3c 양측 게임 상태 일치(메모 제외)",{ok:(await W.ev(SNAP))===(await X.ev(SNAP))});
    note("3d 상대 턴 배지·턴바 비활성 표시",{ok:u.badge.some(b=>/상대 턴/.test(b))&&u.turnBtns.filter(b=>!/기권/.test(b[0])).every(b=>b[1]===true),detail:JSON.stringify(u.badge)});
    await W.shot("2-online-opponent-turn-memo-saved");
    await X.shot("3-online-actor-view-no-memo");
    /* ── 4. W 권한 가드: 자기 말 실제 클릭 → 차단 토스트 · 송신 0 ── */
    const mine=await W.ev(MINE); await W.ev(CLEAR_TOASTS); await W.click(cell(mine.r,mine.c)); await sleep(200);
    u=await W.ev(UI);
    note("4 상대 턴 자기 말 클릭 → 차단 토스트 · 선택 없음 · 송신 0",{ok:u.toasts.some(t=>/상대 턴/.test(t))&&u.sel===null&&u.sent===0,detail:JSON.stringify(u.toasts)});
    /* ── 5. X 실제 이동(송신 2) → 릴레이 → 양측 일치 · W 메모 유지 ── */
    const plan=await X.ev(MOVE_PLAN);
    note("5a 전제: X 이동 계획",{ok:!!plan,detail:JSON.stringify(plan)});
    await X.click(cell(plan.r,plan.c)); await X.click(cell(plan.tr,plan.tc)); await sleep(600);
    const ux2=await X.ev(UI);
    await until(async()=>(await W.ev(SNAP))===(await X.ev(SNAP)),5000,"X 이동 릴레이 반영");
    u=await W.ev(UI);
    note("5b X 선택+이동 송신 2 · W 재생 후 양측 상태 일치 · W 메모 유지",{ok:ux2.sent===2&&(u.memos[u.me]||{})[tg.id]==="bomb"&&u.sent===0,detail:`X sent=${ux2.sent} W sent=${u.sent}`});
    /* ── 6. X 턴 종료(실제 버튼) → W 자기 턴: (b) 메모 송신 0 · 자기 말 선택 송신 1 ── */
    await X.click('#turnBar button.primary'); await sleep(300);
    await until(async()=>{ const s=await W.ev(STATE); return s.cur===s.me; },5000,"턴 종료 릴레이");
    await until(async()=>(await W.ev(SNAP))===(await X.ev(SNAP)),5000,"턴 종료 후 상태 일치");
    const tg2=await W.ev(TARGET); await W.click(cell(tg2.r,tg2.c)); await sleep(200); u=await W.ev(UI);
    note("6a 자기 턴 비인접 미공개 상대 말 클릭 → 피커 · 송신 0 (원래 메모 분기도 네트워크 밖)",{ok:u.picker&&u.sent===0&&u.cur===u.me});
    await W.click('#memoOpts button[data-key="trap"]'); await sleep(300); u=await W.ev(UI);
    note("6b 자기 턴 저장 🪤 · 송신 0",{ok:(u.memos[u.me]||{})[tg2.id]==="trap"&&u.sent===0});
    const mine2=await W.ev(MINE); await W.click(cell(mine2.r,mine2.c)); await sleep(300); u=await W.ev(UI);
    await until(async()=>(await W.ev(SNAP))===(await X.ev(SNAP)),5000,"선택 릴레이");
    note("6c 자기 턴 자기 말 선택은 송신 1 (권한·우선순위 경로 불변) · 양측 일치",{ok:u.sel===mine2.id&&u.sent===1,detail:`sent=${u.sent}`});
    /* ── 7. 추측 삭제 (현재 피커의 실제 버튼) — 첫 대상(tg)은 5 단계에서 X 가 옮겼을 수 있으므로 위치가 그대로인 두 번째 대상(tg2·🪤)으로 ── */
    await W.click(cell(tg2.r,tg2.c)); await sleep(200); u=await W.ev(UI);
    note("7a 메모 있는 말 재클릭 → 피커(현재 선택 표시) · 송신 그대로 1",{ok:u.picker&&u.sent===1});
    await W.click('#obBtns button:first-child'); await sleep(300); u=await W.ev(UI);
    note("7b 추측 삭제 → 메모 제거 · 보드 물음표 복귀 · 송신 그대로 1",{ok:!((u.memos[u.me]||{})[tg2.id])&&!u.guessCells.some(g=>g[0]===tg2.r&&g[1]===tg2.c)&&u.sent===1&&u.overlayHidden,detail:`memos=${JSON.stringify(u.memos[u.me])}`});

    /* ── 8. PVE (file://) AI 턴 중 피커·저장 ── */
    const P=await tab(FILE_URL); await P.ev(PREP);
    await P.ev(`(()=>{ BAL.aiDelay=120000; startMode("pve",{aiLevel:"grade5"}); autoPlace(); setupDone(); return S.phase; })()`); await sleep(300);
    let ps=await P.ev(STATE);
    if(ps.cur!==1){ await P.click('#turnBar button.primary'); await sleep(300); ps=await P.ev(STATE); } // 사람 선공이면 턴 종료 → AI 턴(지연 120s 로 대기 상태 유지)
    const ptg=await P.ev(TARGET);
    note("8a 전제: PVE AI 턴 · 보이는 미공개 상대 하수인",{ok:ps.cur===1&&!!ptg,detail:JSON.stringify(ptg)});
    await P.click(cell(ptg.r,ptg.c)); await sleep(200); let pu=await P.ev(UI);
    note("8b AI 턴 클릭 → 피커 · AI 배지 유지 · selected 없음",{ok:pu.picker&&pu.badge.some(b=>/AI 행동 중/.test(b))&&pu.sel===null,detail:JSON.stringify(pu.badge)});
    await P.shot("4-pve-ai-turn-picker");
    await P.click('#memoOpts button[data-key="king"]'); await sleep(300); pu=await P.ev(UI);
    note("8c AI 턴 저장 👑 · 보드 표시 · 사이드 패널 목록 · current 그대로 AI",{ok:(pu.memos[0]||{})[ptg.id]==="king"&&pu.guessCells.some(g=>g[2]==="👑")&&/추측 메모/.test(pu.side)&&pu.cur===1});
    for(const t of [A,B,P]) try{ await cdp.send("Target.closeTarget",{targetId:t.targetId}); }catch(e){}
  }catch(e){ note("실행",{error:e.message}); }
  finally{
    if(chrome){ try{ chrome.proc.kill(); }catch(e){} await sleep(300); try{ fs.rmSync(chrome.udd,{recursive:true,force:true}); console.log("CLEANUP profile="+chrome.udd); }catch(e){} }
    if(server){ try{ server.proc.kill(); }catch(e){} }
  }
  const summary={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),date:new Date().toISOString(),readOnly:READ_ONLY,pass:report.filter(r=>r.ok!==false&&!r.error).length,fail:bad,shots,report};
  if(!READ_ONLY){ const f=path.join(OUT,"memo_cdp_report.json"); fs.writeFileSync(f,JSON.stringify(summary,null,2)); console.log("REPORT "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  console.log(`\n=== memo_cdp: pass ${summary.pass} / fail ${summary.fail}${READ_ONLY?" (read-only · 산출물 0)":""} ===`);
  process.exit(bad?1:0);
})();
