/* #93 온라인 양측 자기 진영 아래 표시 — 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 릴레이 서버 · 온라인 클라이언트 2개 · 실제 마우스 클릭)
   사용: node demo/test/issue93_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only]
   --read-only: Saturn 독립 재검증용 — 검증 산출물 0(스크린샷·보고서 JSON 없음), stdout 만. 헤드리스 Chrome 임시 프로필(os.tmpdir()/i93cdp-*)은
                실행 부수 리소스로 mkdtemp 로 만든 정확한 경로 하나만 종료 시 정리한다(RESOURCE/CLEANUP 행). 검증 전용 릴레이 서버는 PORT=0 임의 포트·루프백.
   목적: 헤드리스 DOM 스텁으로는 알 수 없는 것 — 진짜 렌더 트리의 화면 좌표(getBoundingClientRect·elementFromPoint), 실제 마우스 클릭이 반사된
         P2 화면에서 논리 좌표로 처리되는지, 실제 릴레이를 거친 두 클라이언트의 논리 상태 일치 — 를 잰다.
   흐름: [온라인 HTTP] A(P1)·B(P2) 실제 매칭 → 배치 단계(뒤집지 않음)·대전 시작(B 만 반사) → B 화면: 내 말 전부 아래·상대 말 위 (픽셀 y)
         → P2 턴으로 → B 에서 실제 마우스로 내 말 클릭(선택 강조·전방=화면 위) → 목표 실제 클릭 → 양측 논리 좌표 동일 · A 화면은 종전 방향
         → B 에서 상대 말 실제 클릭 → 기존 메모 피커 그대로 → 저장 → 반사 위치 칸에 추측 표시.
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome + server/node_modules(ws). 외부 패키지 없음. 종료 코드 1 = 판정 실패, 2 = 실행 실패. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","qa","issue93")));
const READ_ONLY=args.includes("--read-only");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(__dirname,"..","index.html"));
const VP={w:1280,h:1000}; // 13행 보드가 스크롤 없이 한 화면에 들어오는 높이 — 픽셀 y 비교가 스크롤과 무관하도록

/* ── CDP 배선 (issue95_cdp.js 와 같은 방식) ─────────────────────────────── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i93cdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.waiters=[]; this.console=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){ if(m.method==="Runtime.exceptionThrown") this.console.push("exception "+JSON.stringify(m.params.exceptionDetails&&m.params.exceptionDetails.text));
        if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error") this.console.push("console.error "+JSON.stringify((m.params.args||[]).map(a=>a.value||a.description)));
        const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=()=>rej(new Error("WS 오류 "+url)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* 기존 사용자 서버(8080)를 건드리지 않는다 — PORT=0 임의 포트 · 루프백 · 접속 코드는 서버 stdout 에서 읽어 이 프로세스 메모리에만 둔다 */
function startServer(){
  return new Promise((res,rej)=>{
    const p=spawn(process.execPath,[path.join(ROOT,"server","server.js")],{env:Object.assign({},process.env,{PORT:"0"}),stdio:["ignore","pipe","pipe"]});
    let out=""; const t=setTimeout(()=>{ try{p.kill();}catch(e){} rej(new Error("서버 기동 대기 시간 초과\n"+out)); },15000);
    const onData=d=>{ out+=d; const m=out.match(/listening on ([\d.]+):(\d+)/), c=out.match(/접속 코드: (\S+)/); if(m&&c){ clearTimeout(t); res({proc:p,host:m[1],port:Number(m[2]),code:c[1]}); } };
    p.stdout.on("data",onData); p.stderr.on("data",onData);
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("서버 종료 "+c+"\n"+out)); });
  });
}

/* ── 페이지 안 스크립트 (제품 코드 무수정 — 읽기와 실제 사용자 버튼 경로만) ─────────────── */
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){} return S.phase; })()`;
const ENTER=code=>`(()=>{ document.getElementById("netCode").value=${JSON.stringify(code)}; const b=[...document.querySelectorAll("#sidePanel button")].find(b=>/온라인 PVP/.test(b.textContent)); b.click(); return {phase:S.phase,preparing:NET.preparing}; })()`;
const PLACE=`(()=>{ [...document.querySelectorAll("#sidePanel button")].find(b=>/무작위 배치/.test(b.textContent)).click(); return S.pieces.filter(x=>x.owner===0&&x.placed).length; })()`;
const GO=`(()=>{ const b=[...document.querySelectorAll("#sidePanel button")].find(b=>/배치 완료 → 매칭 시작/.test(b.textContent)); if(!b||b.disabled) return "no-btn"; b.click(); return {queued:NET.queued,mode:NET.mode}; })()`;
const STATE=`(()=>({started:NET.started,mode:NET.mode,phase:S.phase,cur:S.current,me:NET.me,turn:S.turnCount,setupPlayer:S.setupPlayer}))()`;
/* 보드 DOM 순서·dataset 논리 좌표·화면 y — 진짜 레이아웃 */
const BOARD=`(()=>{ const bd=document.getElementById("board"); const cs=[...bd.children]; const rc=el=>[+el.dataset.r,+el.dataset.c];
  const rect=el=>{ const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; };
  const first=rc(cs[0]), last=rc(cs[cs.length-1]);
  const order=cs.every((el,i)=>{ const [r,c]=rc(el); const disp=bd.dataset.flip==="1"?14-r:r; return (disp-1)*7+(c-1)===i; });
  const yOf=(r,c)=>rect(cs.find(el=>+el.dataset.r===r&&+el.dataset.c===c)).y;
  const own=[...bd.querySelectorAll(".cell .pc.own")].map(ch=>rect(ch.parentNode).y), foe=[...bd.querySelectorAll(".cell .pc:not(.own)")].map(ch=>rect(ch.parentNode).y);
  const b=bd.getBoundingClientRect(); const topCell=document.elementFromPoint(b.left+27,b.top+27); const topRC=topCell&&topCell.closest(".cell")?rc(topCell.closest(".cell")):null;
  return {flip:bd.dataset.flip,n:cs.length,first,last,order,y1:yOf(1,1),y13:yOf(13,1),ownN:own.length,foeN:foe.length,ownMaxAbove:own.length&&foe.length?Math.min(...own)>Math.max(...foe):null,
    ownMinY:own.length?Math.min(...own):null,foeMaxY:foe.length?Math.max(...foe):null,topLeftRC:topRC,boardTop:b.top,boardBottom:b.bottom}; })()`;
const SNAP=`(()=>JSON.stringify({phase:S.phase,cur:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,
  pieces:S.pieces.map(p=>[p.id,p.owner,p.r,p.c,p.alive,p.placed,p.hp,p.revealed,p.immobile]),events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),
  log:S.log.map(l=>l.msg).filter(m=>!/당신은 P[12]/.test(m)).map(m=>m.replace(/(나|상대)\\((P[12])\\)/g,"$2")),battle:!!S.battle,queue:NET.queue.length}))()`;
const MOVE_PLAN=`(()=>{ const v=NET.me, dir=v===0?-1:1; for(const p of S.pieces.filter(p=>p.owner===v&&p.alive&&p.placed&&p.type==="minion"&&p.immobile===0)){
  const r=p.r+dir; if(![4,5,9,10].includes(r)&&!at(r,p.c)&&canMoveTo(p,r,p.c)) return {id:p.id,r:p.r,c:p.c,tr:r,tc:p.c}; }
  for(const p of S.pieces.filter(p=>p.owner===v&&p.alive&&p.placed&&p.type==="minion"&&p.immobile===0)){ const r=p.r+dir; if(canMoveTo(p,r,p.c)) return {id:p.id,r:p.r,c:p.c,tr:r,tc:p.c,forest:true}; } return null; })()`;
const HL=`(()=>({sel:S.selected?S.selected.id:null,
  hlSel:[...document.querySelectorAll(".cell.hl-sel")].map(e=>[+e.dataset.r,+e.dataset.c]),hlMove:[...document.querySelectorAll(".cell.hl-move")].map(e=>[+e.dataset.r,+e.dataset.c]),
  hlAttack:[...document.querySelectorAll(".cell.hl-attack")].map(e=>[+e.dataset.r,+e.dataset.c])}))()`;
const PIECE=id=>`(()=>{ const p=S.pieces.find(x=>x.id===${id}); return p?{r:p.r,c:p.c,alive:p.alive,placed:p.placed}:null; })()`;
const RECT=sel=>`(()=>{ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`;
const RECT_BTN=text=>`(()=>{ const el=[...document.querySelectorAll("#turnBar button")].find(b=>b.textContent.indexOf(${JSON.stringify(text)})>=0&&!b.disabled); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;
const MEMO_TARGET=`(()=>{ const v=NET.me; const x=S.pieces.find(p=>p.owner!==v&&p.alive&&p.placed&&p.type==="minion"&&!p.revealed&&visibleTo(v,p)
  &&!S.pieces.some(y=>y.owner===v&&y.alive&&y.placed&&Math.abs(y.r-p.r)+Math.abs(y.c-p.c)===1)); return x?{id:x.id,r:x.r,c:x.c}:null; })()`;
const UI=`(()=>{ const ov=document.getElementById("overlay"), ob=document.getElementById("overlayBox");
  return {overlayHidden:ov.classList.contains("hidden"),picker:/정체 추측/.test(ob.innerHTML),ovText:ob.textContent.replace(/\\s+/g," ").slice(0,80),
    toasts:[...document.querySelectorAll("#toasts .toast")].map(t=>t.textContent),
    guessCells:[...document.querySelectorAll(".cell .pc.memo-guess")].map(ch=>[+ch.parentNode.dataset.r,+ch.parentNode.dataset.c,ch.parentNode.getBoundingClientRect().top+ch.parentNode.getBoundingClientRect().height/2]),
    memos:JSON.parse(JSON.stringify(S.memos)),badge:[...document.querySelectorAll("#turnBar .badge")].map(b=>b.textContent),log:S.log.slice(-3).map(l=>l.msg)}; })()`;
const RECT_MEMO_OPT=key=>`(()=>{ const el=document.querySelector('#memoOpts button[data-key="'+${JSON.stringify(key)}+'"]'); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`;

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const report=[]; let bad=0; const shots=[];
  const note=(what,r)=>{ report.push(Object.assign({what},r)); if(r.error||r.ok===false) bad++; console.log((r.ok===false||r.error?"FAIL ":"ok   ")+what+(r.detail?" — "+r.detail:"")+(r.error?" — "+r.error:"")); };
  let server=null, chrome=null;
  try{
    server=await startServer();
    console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port} (접속 코드는 출력하지 않는다)`);
    chrome=await launch();
    console.log(`RESOURCE chrome pid=${chrome.proc.pid} profile=${chrome.udd}`);
    const cdp=await connect(chrome.ws);
    const tab=async(url,name)=>{ const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
      const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
      await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.w,height:VP.h,deviceScaleFactor:1,mobile:false},sid);
      const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url},sid); await loaded; await sleep(300);
      const t={sid,targetId,name,
        ev:async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("page: "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails)); return r.result.value; },
        clickAt:async p=>{ for(const type of ["mousePressed","mouseReleased"]) await cdp.send("Input.dispatchMouseEvent",{type,x:p.x,y:p.y,button:"left",clickCount:1},sid); await sleep(150); return p; },
        click:async sel=>{ const p=await t.ev(RECT(sel)); if(!p) throw new Error("클릭 대상 없음 "+sel); return t.clickAt(p); },
        clickBtn:async text=>{ const p=await t.ev(RECT_BTN(text)); if(!p) throw new Error("버튼 없음/비활성 "+text); return t.clickAt(p); },
        shot:async n=>{ if(READ_ONLY) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
          const f=path.join(OUT,n+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); const rel=path.relative(ROOT,f).replace(/\\/g,"/"); shots.push(rel); console.log("SHOT "+rel); }};
      return t; };
    const until=async(fn,ms,label)=>{ const t0=Date.now(); for(;;){ const v=await fn(); if(v) return v; if(Date.now()-t0>ms) throw new Error("대기 시간 초과: "+label); await sleep(150); } };
    const cell=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;
    const same=async()=>(await A.ev(SNAP))===(await B.ev(SNAP));

    /* ── 1. 두 클라이언트 실제 매칭 — 배치·대기 단계에서는 뒤집지 않는다 ── */
    const URL=`http://127.0.0.1:${server.port}/index.html`;
    const A=await tab(URL,"A"), B=await tab(URL,"B");
    for(const t of [A,B]){ await t.ev(PREP); const e=await t.ev(ENTER(server.code)); await t.ev(PLACE);
      const bd=await t.ev(BOARD);
      note(`${t.name} 배치 단계: 뒤집지 않음 (data-flip=0 · 첫 칸 (1,1) · 내 말 전부 아래)`,{ok:e.phase==="setup"&&bd.flip==="0"&&bd.first[0]===1&&bd.order&&bd.ownN===14&&bd.y13>bd.y1,detail:JSON.stringify({phase:e.phase,flip:bd.flip,first:bd.first,own:bd.ownN,y1:bd.y1,y13:bd.y13})}); }
    const gA=await A.ev(GO); await sleep(400); // A 가 먼저 큐 → p1
    const wA=await A.ev(BOARD), sA=await A.ev(STATE);
    note("A 매칭 대기 중: NET.mode=false · 보드 그대로 (flip=0)",{ok:gA.queued===true&&sA.mode===false&&wA.flip==="0"&&wA.order,detail:JSON.stringify({queued:gA.queued,mode:sA.mode,flip:wA.flip})});
    const gB=await B.ev(GO);
    await until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"온라인 매칭·시작");
    const stA=await A.ev(STATE), stB=await B.ev(STATE);
    note("실제 서버 매칭: A=P1(me 0) · B=P2(me 1) · 양측 play",{ok:stA.me===0&&stB.me===1&&stA.mode&&stB.mode,detail:JSON.stringify({A:stA,B:stB,gB})});
    note("시작 직후 양 클라이언트 논리 상태 동일 (스냅샷)",{ok:await same()});

    /* ── 2. 대전 화면: B 만 반사, A 는 종전 — 진짜 레이아웃 y 로 확인 ── */
    const bA=await A.ev(BOARD), bB=await B.ev(BOARD);
    note("B(P2) 보드: data-flip=1 · DOM 순서 = 행 반사(열 유지) · 첫 칸 (13,1) · 마지막 (1,7)",{ok:bB.flip==="1"&&bB.order&&bB.n===91&&bB.first[0]===13&&bB.first[1]===1&&bB.last[0]===1&&bB.last[1]===7,detail:JSON.stringify({flip:bB.flip,first:bB.first,last:bB.last,order:bB.order})});
    note("B(P2) 화면 픽셀: 논리 1행이 13행보다 아래 (y1>y13) · 내 말 14개 전부가 상대 말 14개보다 아래",{ok:bB.y1>bB.y13&&bB.ownN===14&&bB.foeN===14&&bB.ownMaxAbove===true,detail:JSON.stringify({y1:bB.y1,y13:bB.y13,ownMinY:bB.ownMinY,foeMaxY:bB.foeMaxY})});
    note("B(P2) elementFromPoint: 보드 좌상단 픽셀의 칸은 논리 (13,1)",{ok:!!bB.topLeftRC&&bB.topLeftRC[0]===13&&bB.topLeftRC[1]===1,detail:JSON.stringify(bB.topLeftRC)});
    note("A(P1) 보드: data-flip=0 · 행 1→13 · 첫 칸 (1,1) · 내 말 전부 아래 (종전 그대로)",{ok:bA.flip==="0"&&bA.order&&bA.first[0]===1&&bA.last[0]===13&&bA.y13>bA.y1&&bA.ownN===14&&bA.ownMaxAbove===true&&bA.topLeftRC&&bA.topLeftRC[0]===1,detail:JSON.stringify({flip:bA.flip,first:bA.first,y1:bA.y1,y13:bA.y13,topLeft:bA.topLeftRC})});
    await B.shot("http_desktop-1280_1-p2-start-own-bottom"); await A.shot("http_desktop-1280_2-p1-start-unchanged");

    /* ── 3. P2 턴 → B 에서 실제 마우스 클릭으로 선택·이동 (반사 화면 → 논리 좌표) ── */
    if(stB.cur!==1){ await A.clickBtn("주 행동 생략"); await A.clickBtn("턴 종료"); }
    await until(async()=>{ const b=await B.ev(STATE); return b.cur===1&&!b.battle; },5000,"P2 턴");
    await until(same,5000,"턴 교대 후 상태 일치");
    const plan=await B.ev(MOVE_PLAN);
    if(!plan) note("B 전방 이동 계획",{error:"이동 가능한 내 하수인 없음"});
    else {
      const pFrom=await B.ev(RECT(cell(plan.r,plan.c))), pTo=await B.ev(RECT(cell(plan.tr,plan.tc)));
      note("B 화면 기하: 내 말(논리 r)의 전방(논리 r+1)이 화면에서 위쪽 (y 감소) · 내 말은 보드 아래 절반",{ok:pTo.y<pFrom.y&&pFrom.y>(bB.boardTop+bB.boardBottom)/2,detail:JSON.stringify({from:[plan.r,plan.c,Math.round(pFrom.y)],to:[plan.tr,plan.tc,Math.round(pTo.y)]})});
      await B.clickAt(pFrom); await sleep(200);
      const hl=await B.ev(HL);
      note("B 실제 마우스 클릭(반사 위치) → 논리 좌표의 내 말 선택 · hl-sel 그 칸 · hl-move 에 전방 칸 포함",{ok:hl.sel===plan.id&&hl.hlSel.some(x=>x[0]===plan.r&&x[1]===plan.c)&&hl.hlMove.some(x=>x[0]===plan.tr&&x[1]===plan.tc),detail:JSON.stringify(hl)});
      await B.shot("http_desktop-1280_3-p2-selected-highlights");
      await B.clickAt(pTo);
      await until(async()=>{ const a=await A.ev(PIECE(plan.id)), b=await B.ev(PIECE(plan.id)); return a&&b&&a.r===plan.tr&&a.c===plan.tc&&b.r===plan.tr&&b.c===plan.tc; },5000,"이동 릴레이 반영");
      const pa=await A.ev(PIECE(plan.id)), pb=await B.ev(PIECE(plan.id));
      note("B 목표 칸 실제 클릭 → 양 클라이언트 모두 논리 (tr,tc) 로 이동 · 스냅샷 동일",{ok:pa.r===plan.tr&&pa.c===plan.tc&&pb.r===plan.tr&&pb.c===plan.tc&&await same(),detail:JSON.stringify({A:pa,B:pb})});
      const rB=await B.ev(RECT(cell(plan.tr,plan.tc)+" .pc.own")), rA=await A.ev(RECT(cell(plan.tr,plan.tc)+" .pc"));
      const bA2=await A.ev(BOARD), bB2=await B.ev(BOARD);
      note("이동 후 화면: B 는 반사 위치에 own 칩(위로 한 칸) · A 는 종전 규칙 위치에 상대 칩(A 화면에선 아래로 한 칸) · 양쪽 DOM 순서 유지",{ok:!!rB&&Math.abs(rB.y-pTo.y)<2&&(!!rA||plan.forest)&&bA2.flip==="0"&&bA2.order&&bB2.flip==="1"&&bB2.order,detail:JSON.stringify({B:rB&&Math.round(rB.y),A:rA&&Math.round(rA.y),forest:!!plan.forest})});
      await B.shot("http_desktop-1280_4-p2-after-move");
    }

    /* ── 4. 기존 메모 흐름 보존 — B 에서 상대 말 실제 클릭 → 피커 → 저장 → 반사 위치에 추측 표시 ── */
    const mt=await B.ev(MEMO_TARGET);
    if(!mt) note("B 메모 대상",{error:"비인접·미공개·가시 상대 하수인 없음"});
    else {
      const pm=await B.ev(RECT(cell(mt.r,mt.c)));
      note("B 화면 기하: 상대 말은 보드 위 절반",{ok:pm.y<(bB.boardTop+bB.boardBottom)/2,detail:JSON.stringify({rc:[mt.r,mt.c],y:Math.round(pm.y)})});
      await B.clickAt(pm); await sleep(200);
      const u1=await B.ev(UI);
      note("상대 말 실제 클릭 → 기존 메모 피커 (제목에 논리 행·열)",{ok:u1.picker&&!u1.overlayHidden&&u1.ovText.indexOf(`${mt.r}행 ${mt.c}열`)>=0,detail:u1.ovText});
      const po=await B.ev(RECT_MEMO_OPT("king")); if(!po) throw new Error("메모 선택지 없음");
      await B.clickAt(po); await sleep(200);
      const u2=await B.ev(UI);
      note("👑 저장 → 피커 닫힘 · 추측 칩이 그 논리 칸(반사 위치 = 클릭한 픽셀 위치)에 표시 · 메모는 로컬(양측 논리 상태 여전히 동일)",{ok:u2.overlayHidden&&u2.memos[1][String(mt.id)]==="king"&&u2.guessCells.length===1&&u2.guessCells[0][0]===mt.r&&u2.guessCells[0][1]===mt.c&&Math.abs(u2.guessCells[0][2]-pm.y)<2&&await same(),detail:JSON.stringify({guess:u2.guessCells,memos:u2.memos})});
      const uA=await A.ev(UI);
      note("A 화면에는 B 의 메모 비노출",{ok:uA.guessCells.length===0&&Object.keys(uA.memos[0]).length===0&&Object.keys(uA.memos[1]).length===0});
    }
    const errs=cdp.console.filter(x=>!/favicon/.test(x));
    note("콘솔 오류 0 (두 탭)",{ok:errs.length===0,detail:errs.join(" | ")||undefined});
  } catch(e){ note("실행",{error:e.message}); console.error(e); }
  finally{
    if(chrome) try{chrome.proc.kill();}catch(e){}
    if(server) try{server.proc.kill();}catch(e){}
    if(chrome){ const uddAbs=path.resolve(chrome.udd), tmpAbs=path.resolve(os.tmpdir());
      const safe=path.dirname(uddAbs)===tmpAbs&&/^i93cdp-[A-Za-z0-9]+$/.test(path.basename(uddAbs)); let removed=false;
      if(safe) for(let i=0;i<10;i++){ try{ fs.rmSync(uddAbs,{recursive:true,force:true}); }catch(e){} removed=!fs.existsSync(uddAbs); if(removed) break; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150); }
      console.log(`CLEANUP chrome pid=${chrome.proc.pid} profile=${uddAbs} guard=${safe} removed=${removed}`+(server?` qa-server pid=${server.proc.pid}`:"")); }
  }
  const summary={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),viewport:VP,date:new Date().toISOString(),readOnly:READ_ONLY,pass:report.filter(r=>r.ok!==false&&!r.error).length,fail:bad,shots,report};
  if(!READ_ONLY){ const f=path.join(OUT,"issue93_cdp_report.json"); fs.writeFileSync(f,JSON.stringify(summary,null,2)); console.log("REPORT "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  console.log(`\n=== issue93_cdp: pass ${summary.pass} / fail ${summary.fail}${READ_ONLY?" (read-only · 산출물 0)":` · 스크린샷 ${shots.length}장`} ===`);
  process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
