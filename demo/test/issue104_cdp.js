/* #104 온라인 양측 말·위치 불일치 — 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 릴레이 서버 · 온라인 클라이언트 2개 · 실제 마우스 클릭)
   사용: node demo/test/issue104_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots]
   --read-only: Saturn 독립 재검증용 — 검증 산출물 0(스크린샷·보고서 JSON 없음), stdout 만. 헤드리스 Chrome 임시 프로필(os.tmpdir()/i104cdp-*)과
                검증 전용 릴레이 서버(PORT=0 임의 포트·루프백)만 실행 부수 리소스로 만들고 종료 시 정리한다(RESOURCE/CLEANUP 행).
   흐름 (제품 코드 무수정 · 메뉴/로스터/트레이/칸/턴바/전투 버튼은 전부 실제 DOM 클릭):
     1. 두 탭이 서로 다른 로스터 6종을 카드 클릭→[선택하기] 순서로 고르고, 14개를 서로 다른 비공개 배치로 트레이→칸 클릭 배치 → [배치 완료 → 매칭 시작] → 실제 서버 매칭
     2. 시작 직후 28개 말 정규 스냅샷(id·owner·rosterId·name·hp·기술·좌표) 양 탭 동일 + 각자 제출한 배치가 정규 좌표(P2 = 14−r·열 유지)로 반영 + 뷰어 DOM ↔ 자기 S 일치
     3. P1 하수인이 11→5행으로 중앙·숲 경계를 넘어 P2 쪽 숲 (5,3) 에 숨는다 (턴 교대는 실제 [주 행동 생략]·[턴 종료] 버튼) — 매 이동 뒤 양 탭 일치
     4. 65턴(버닝 타임)까지 실제 버튼으로 턴 교대 → P2 가 (3,3) 하수인을 (5,3) 으로 2칸 이동 클릭 = 행위자에게는 숨은 말 위로의 이동
        → 수정 전: P2 탭만 충돌 처리(경유 칸 정지·공개·강제 전투), P1 탭은 이동 미적용 → 영구 분기 / 수정 후: 양 탭 동일
     5. 강제 전투를 실제 전투 버튼으로 완주 → 양 탭 일치 · 스크린샷(P1 시점·P2 시점) → 턴 종료 → 재매칭(새로고침 후 재접속) 시작 일치
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome + server/node_modules(ws). 외부 패키지 없음. 종료 코드 1 = 판정 실패. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","qa","issue104")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(__dirname,"..","index.html"));
const VP={width:1280,height:1000}; // 13행이 스크롤 없이 들어온다 (#93 과 동일)

/* ── CDP 배선 (memo_cdp.js 와 같은 방식) ───────────────────────────────── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i104cdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
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
function startServer(){ // 기존 사용자 서버(8080) 무접촉 — PORT=0 임의 포트 · 루프백 · 접속 코드는 서버 stdout 에서 읽어 이 프로세스 메모리에만 둔다
  return new Promise((res,rej)=>{
    const p=spawn(process.execPath,[path.join(ROOT,"server","server.js")],{env:Object.assign({},process.env,{PORT:"0"}),stdio:["ignore","pipe","pipe"]});
    let out=""; const t=setTimeout(()=>{ try{p.kill();}catch(e){} rej(new Error("서버 기동 대기 시간 초과\n"+out)); },15000);
    const onData=d=>{ out+=d; const m=out.match(/listening on ([\d.]+):(\d+)/), c=out.match(/접속 코드: (\S+)/); if(m&&c){ clearTimeout(t); res({proc:p,host:m[1],port:Number(m[2]),code:c[1]}); } };
    p.stdout.on("data",onData); p.stderr.on("data",onData);
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("서버 종료 "+c+"\n"+out)); });
  });
}

/* ── 페이지 안 스크립트 ───────────────────────────────────────────────────── */
const SETUPS=[ // smoke_online_sync.js 와 같은 자연 배치 (로스터 토글 순서 = 배열 순서)
  {roster:["M-F2","M-W1","M-G3","M-L4","M-F5","M-W2"],pos:{minion:[[11,1],[11,2],[11,3],[11,4],[11,5],[11,6]],bomb:[[12,1],[12,7],[11,7]],ally:[[12,3],[12,5]],trap:[[13,1],[13,7]],king:[[13,4]]}},
  {roster:["M-L1","M-G2","M-W3","M-F4","M-L5","M-G1"],pos:{minion:[[11,7],[11,5],[11,3],[11,1],[12,6],[12,2]],bomb:[[11,2],[11,4],[11,6]],ally:[[13,3],[13,5]],trap:[[12,1],[12,7]],king:[[12,4]]}}];
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){} return S.phase; })()`;
const SET_CODE=code=>`(()=>{ document.getElementById("netCode").value=${JSON.stringify(code)}; return true; })()`;
const STATE=`(()=>({started:NET.started,phase:S.phase,cur:S.current,me:NET.me,turn:S.turnCount,main:S.mainUsed,battle:!!S.battle,forced:S.forcedTargets.slice(),
  actor:netActor(),overlay:!document.getElementById("overlay").classList.contains("hidden"),sync:NET.syncModal?{seq:NET.syncModal.seq,owner:NET.syncModal.owner}:null,queue:NET.queue.length,playing:MSGPLAYING,sel:S.selected?S.selected.id:null}))()`;
const CANON=`(()=>JSON.stringify(S.pieces.map(p=>({id:p.id,owner:p.owner,type:p.type,rosterId:p.rosterId,name:p.name,element:p.element,hp:p.hp,maxHp:p.maxHp,atk:p.atk,skills:p.skills,cds:p.cds,
  r:p.r,c:p.c,placed:p.placed,alive:p.alive,revealed:p.revealed,immobile:p.immobile,cap:p.cap?p.cap.element:null}))))()`;
const SNAP=`(()=>JSON.stringify({phase:S.phase,cur:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,sel:S.selected?S.selected.id:null,forced:S.forcedTargets,
  battle:S.battle?[S.battle.attP.id,S.battle.defP.id,S.battle.round,S.battle.phase]:null,events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),reveal:[...S.tempReveal].sort(),
  pieces:S.pieces.map(p=>[p.id,p.owner,p.rosterId,p.r,p.c,p.alive,p.placed,p.hp,p.revealed,p.immobile,JSON.stringify(p.skills)]),seq:NET.modalSeq,queue:NET.queue.length}))()`;
const OWN_PIECES=`(()=>S.pieces.filter(x=>x.owner===0).map(x=>({id:x.id,type:x.type,rosterId:x.rosterId,name:x.name,r:x.r,c:x.c,placed:x.placed})))()`;
const DOM_CHECK_=(bottom)=>`(()=>{ const me=NET.me, viewer=S.phase==="over"?2:me, flip=NET.mode&&me===1, cells=[...document.querySelectorAll("#board .cell")];
  if(cells.length!==91) return "cells "+cells.length; if(document.getElementById("board").dataset.flip!==(flip?"1":"0")) return "flip attr";
  for(let i=0;i<cells.length;i++){ const x=cells[i], r=+x.dataset.r, c=+x.dataset.c; if(((flip?14-r:r)-1)*7+(c-1)!==i) return "order "+r+","+c;
    const p=at(r,c), chip=x.querySelector(".pc"), vis=p&&(viewer===2||visibleTo(viewer,p)); if(!!chip!==!!vis) return "chip "+r+","+c;
    if(chip){ const known=viewer===2||p.owner===viewer||p.revealed; if(!chip.classList.contains("p"+p.owner)) return "owner "+r+","+c;
      if((p.owner===viewer)!==chip.classList.contains("own")) return "own "+r+","+c; if(known===chip.classList.contains("hiddenId")) return "known "+r+","+c; } }
  if(!${bottom?"true":"false"}) return null; // 시작 직후에만: 자기 말 14개가 화면 아래 3행
  const bottom=cells.slice(70).map(x=>x.querySelector(".pc")).filter(Boolean); return bottom.length===14&&bottom.every(ch=>ch.classList.contains("own"))?null:"own pieces not at bottom ("+bottom.length+")"; })()`;
const DOM_CHECK=DOM_CHECK_(false), DOM_CHECK_START=DOM_CHECK_(true);
const PIECE_AT=(r,c)=>`(()=>{ const p=at(${r},${c}); return p?{id:p.id,owner:p.owner,type:p.type,r:p.r,c:p.c,visMe:visibleTo(NET.me,p),visOwner:visibleTo(p.owner,p),revealed:p.revealed}:null; })()`;
const PIECE=id=>`(()=>{ const p=S.pieces.find(x=>x.id===${id}); return p?{id:p.id,r:p.r,c:p.c,alive:p.alive,revealed:p.revealed,reveal:S.tempReveal.has(p.id)}:null; })()`;
const CAN_MOVE=(id,r,c)=>`(()=>{ const p=S.pieces.find(x=>x.id===${id}); return !!p&&canMoveTo(p,${r},${c}); })()`;
const RECT=sel=>`(()=>{ const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height}; })()`;
const BTN_TEXT=sel=>`(()=>[...document.querySelectorAll(${JSON.stringify(sel)})].map(b=>[b.textContent.trim(),b.disabled]))()`;
const CONSOLE_ERR=`(()=>window.__errs||[])()`;
const INSTALL_ERR=`(()=>{ window.__errs=[]; window.addEventListener("error",e=>window.__errs.push(String(e.message))); const oe=console.error; console.error=function(){ window.__errs.push([...arguments].map(String).join(" ")); return oe.apply(console,arguments); }; return true; })()`;

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const report=[]; let bad=0; const shots=[]; let initial=null;
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
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.width,height:VP.height,deviceScaleFactor:1,mobile:false},sid);
      const t={sid,targetId,name:"",
        ev:async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("page: "+JSON.stringify(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails)); return r.result.value; },
        nav:async u=>{ const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url:u},sid); await loaded; await sleep(300); await t.ev(PREP); await t.ev(INSTALL_ERR); },
        click:async sel=>{ const p=await t.ev(RECT(sel)); if(!p) throw new Error("클릭 대상 없음 "+sel);
          for(const type of ["mousePressed","mouseReleased"]) await cdp.send("Input.dispatchMouseEvent",{type,x:p.x,y:p.y,button:"left",clickCount:1},sid); await sleep(90); return p; },
        shot:async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
          const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); const rel=path.relative(ROOT,f).replace(/\\/g,"/"); shots.push(rel); console.log("SHOT "+rel); }};
      await t.nav(url); return t; };
    const until=async(fn,ms,label)=>{ const t0=Date.now(); for(;;){ const v=await fn(); if(v) return v; if(Date.now()-t0>ms) throw new Error("대기 시간 초과: "+label); await sleep(120); } };
    const cell=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;
    const same=async(A,B)=>(await A.ev(SNAP))===(await B.ev(SNAP));
    const settled=async(A,B,label)=>until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.queue===0&&b.queue===0&&!a.playing&&!b.playing&&(await same(A,B)); },8000,label);

    /* ── 1. 자연 배치: 두 탭 서로 다른 로스터·비공개 배치, 전부 실제 클릭 ── */
    const URL=`http://127.0.0.1:${server.port}/index.html`;
    const A=await tab(URL), B=await tab(URL); A.name="A"; B.name="B";
    const intended=[];
    for(const [i,T] of [A,B].entries()){
      await T.ev(SET_CODE(server.code)); await T.click('button[onclick="netPrepare()"]'); await sleep(150);
      for(const rid of SETUPS[i].roster){ await T.click(`.rosterCard[onclick="rosterInfo('${rid}')"]`); await sleep(100); await T.click('#obBtns button:first-child'); await sleep(100); }
      const used={}; let own=await T.ev(OWN_PIECES);
      for(const p of own){ const k=used[p.type]=(used[p.type]||0); used[p.type]++; const [r,c]=SETUPS[i].pos[p.type][k];
        await T.click(`.trayItem[onclick="selTray(${p.id})"]`); await T.click(cell(r,c)); }
      own=await T.ev(OWN_PIECES); intended.push(own.map(x=>({type:x.type,rosterId:x.rosterId,name:x.name,r:x.r,c:x.c})));
      const st=await T.ev(`(()=>({placed:S.pieces.filter(x=>x.owner===0&&x.placed).length,roster:S.roster[0].slice()}))()`);
      note(`1${"ab"[i]} 탭${T.name}: 로스터 6종 카드 클릭 순서대로 선택 · 14개 트레이→칸 클릭 배치`,{ok:st.placed===14&&st.roster.join()===SETUPS[i].roster.join(),detail:`placed=${st.placed} roster=${st.roster.join(",")}`});
      await T.click('#sidePanel button.primary'); await sleep(200); // [배치 완료 → 매칭 시작]
    }
    await until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"온라인 매칭·시작");
    await settled(A,B,"시작 직후 정착");
    const sa=await A.ev(STATE), sb=await B.ev(STATE);
    const P1=sa.me===0?A:B, P2=P1===A?B:A; const I1=intended[P1===A?0:1], I2=intended[P2===A?0:1];
    note("1c 실제 서버 매칭 — 서로 다른 탭이 P1·P2",{ok:sa.me!==sb.me&&[sa.me,sb.me].sort().join()==="0,1",detail:`A me=${sa.me} B me=${sb.me} 선공 P${sa.cur+1}`});

    /* ── 2. 시작 직후: 28개 말 정규 스냅샷·제출 배치 매핑·뷰어 DOM ── */
    const c1=await P1.ev(CANON), c2=await P2.ev(CANON); initial={P1:JSON.parse(c1),P2:JSON.parse(c2),submitted:{P1:I1,P2:I2}};
    note("2a 28개 말 정규 스냅샷(id·owner·rosterId·name·hp·기술·좌표) 양 탭 동일",{ok:c1===c2,detail:c1===c2?"identical":"DIFF"});
    const mapped=(m,I)=>JSON.stringify(I.map(x=>({type:x.type,rosterId:x.rosterId,name:x.name,r:m===1?14-x.r:x.r,c:x.c})));
    for(const [m,I] of [[0,I1],[1,I2]]) for(const T of [P1,P2]){
      const got=await T.ev(`(()=>JSON.stringify(S.pieces.filter(x=>x.owner===${m}).map(x=>({type:x.type,rosterId:x.rosterId,name:x.name,r:x.r,c:x.c}))))()`);
      note(`2b P${m+1} 이 제출한 배치가 ${T===P1?"P1":"P2"} 탭 정규 좌표에 반영 (P2 = 14−r·열 유지)`,{ok:got===mapped(m,I)}); }
    note("2c P1 탭 DOM ↔ 자기 S (칩·가시성·공개·순서·자기 말 하단)",{ok:(await P1.ev(DOM_CHECK_START))===null,detail:String(await P1.ev(DOM_CHECK_START))});
    note("2d P2 탭 DOM ↔ 자기 S (행 반사 순서·자기 말 하단)",{ok:(await P2.ev(DOM_CHECK_START))===null,detail:String(await P2.ev(DOM_CHECK_START))});

    /* ── 3. P1 하수인 중앙·숲 경계 횡단 (실제 클릭·실제 턴 버튼) ── */
    const actorTab=async()=>{ const s=await P1.ev(STATE); return s.actor===0?P1:P2; };
    const passTurn=async()=>{ const T=await actorTab(); await T.click('#turnBar button:first-child'); await sleep(60); await T.click('#turnBar button.primary'); await settled(P1,P2,"턴 교대 정착"); };
    const walkerId=(await P1.ev(`(()=>S.pieces.find(x=>x.owner===0&&x.rosterId==="M-G3").id)()`));
    let walkOk=true, walkDetail=[];
    for(const [r,c] of [[10,3],[9,3],[8,3],[7,3],[6,3],[5,3]]){
      while((await actorTab())!==P1) await passTurn();
      const before=await P1.ev(PIECE(walkerId));
      await P1.click(cell(before.r,before.c)); await settled(P1,P2,"선택 정착");
      await P1.click(cell(r,c)); await settled(P1,P2,"이동 정착");
      const a1=await P1.ev(PIECE(walkerId)), a2=await P2.ev(PIECE(walkerId));
      const okStep=a1.r===r&&a1.c===c&&a2.r===r&&a2.c===c&&(await same(P1,P2)); walkOk=walkOk&&okStep; walkDetail.push(`(${r},${c})${okStep?"":"✗"}`);
      const st=await P1.ev(STATE); if(st.battle||st.forced.length) break;
      await P1.click('#turnBar button.primary'); await settled(P1,P2,"턴 종료 정착");
    }
    note("3 P1 하수인 11→5행 횡단 — 매 이동 뒤 양 탭 위치·상태 일치",{ok:walkOk,detail:walkDetail.join(" ")});

    /* ── 4. 65턴(BT)까지 실제 버튼 턴 교대 → P2 의 2칸 이동 (행위자에게 숨은 말 위로) ── */
    while((await P1.ev(STATE)).turn<64) await passTurn();
    while((await actorTab())!==P2) await passTurn();
    const hid=await P2.ev(PIECE_AT(5,3)), moverP2=await P2.ev(PIECE_AT(3,3)), hidP1=await P1.ev(PIECE_AT(5,3)), st4=await P2.ev(STATE);
    note("4a 전제: BT 진입 · P1 말이 (5,3) 에 P2 시점 비가시(P1 시점 가시) · P2 하수인 (3,3) · (4,3) 빈 칸 · P2 턴",
      {ok:st4.turn>=64&&hid&&hid.owner===0&&!hid.visMe&&hidP1&&hidP1.visMe&&moverP2&&moverP2.owner===1&&moverP2.type==="minion"&&!(await P2.ev(PIECE_AT(4,3)))&&st4.actor===1,
       detail:`turn=${st4.turn+1} hid=${JSON.stringify(hid)} mover=${JSON.stringify(moverP2)}`});
    await P2.click(cell(3,3)); await settled(P1,P2,"P2 선택 정착");
    note("4b P2 탭에서 (3,3)→(5,3) 2칸 이동은 합법 (canMoveTo)",{ok:await P2.ev(CAN_MOVE(moverP2.id,5,3))});
    await P2.click(cell(5,3)); await sleep(1500);
    await until(async()=>{ const a=await P1.ev(STATE), b=await P2.ev(STATE); return a.queue===0&&b.queue===0; },8000,"2칸 이동 릴레이 소비");
    const m1=await P1.ev(PIECE(moverP2.id)), m2=await P2.ev(PIECE(moverP2.id)), s1=await P1.ev(STATE), s2=await P2.ev(STATE);
    note("4c 행위자(P2) 탭: 경유 칸 (4,3) 정지 · 충돌 일시 공개 · 주 행동 소모 · 강제 전투 진입",{ok:m2.r===4&&m2.c===3&&m2.reveal&&s2.main&&s2.battle,detail:`P2: (${m2.r},${m2.c}) reveal=${m2.reveal} main=${s2.main} battle=${s2.battle}`});
    note("4d 상대(P1) 탭이 같은 클릭을 재생한 결과가 동일 (#104 핵심)",{ok:m1.r===m2.r&&m1.c===m2.c&&m1.reveal===m2.reveal&&s1.main===s2.main&&s1.battle===s2.battle,
      detail:`P1: (${m1.r},${m1.c}) reveal=${m1.reveal} main=${s1.main} battle=${s1.battle} / P2: (${m2.r},${m2.c}) reveal=${m2.reveal} main=${s2.main} battle=${s2.battle}`});
    note("4e 양 탭 전체 스냅샷(28개 말·전투·이벤트) 동일",{ok:await same(P1,P2)});

    /* ── 5. 강제 전투를 실제 전투 버튼으로 완주 → 일치 · 스크린샷 · 턴 종료 ── */
    let rounds=0; // 실제 클릭 수 — 메시지 재생(0.6초 간격) 대기는 세지 않고 시간 예산(120초)으로 막는다
    for(const t0=Date.now();Date.now()-t0<120000;){
      const a=await P1.ev(STATE), b=await P2.ev(STATE);
      if(a.playing||b.playing||a.queue||b.queue){ await sleep(200); continue; }
      if(!a.battle&&!b.battle&&!a.overlay&&!b.overlay) break;
      const T=a.sync&&a.overlay?(a.sync.owner===0?P1:P2):(a.actor===0?P1:P2);
      const btn=a.battle?'#overlayBox button[onclick^="window.__act("]:not([disabled])':'#obBtns button:not([disabled])';
      const list=await T.ev(BTN_TEXT(btn)); if(!list.length){ await sleep(200); continue; }
      await T.click(btn); rounds++; await sleep(250);
    }
    await settled(P1,P2,"전투 종료 정착");
    const s5a=await P1.ev(STATE), s5b=await P2.ev(STATE);
    note("5a 강제 전투를 실제 버튼으로 완주 — 양 탭 전투 종료·스냅샷 동일",{ok:!s5a.battle&&!s5b.battle&&(await same(P1,P2)),detail:`rounds=${rounds} turn=${s5a.turn+1}`});
    note("5b 전투 후 P1 탭 DOM ↔ S",{ok:(await P1.ev(DOM_CHECK))===null,detail:String(await P1.ev(DOM_CHECK))});
    note("5c 전투 후 P2 탭 DOM ↔ S",{ok:(await P2.ev(DOM_CHECK))===null,detail:String(await P2.ev(DOM_CHECK))});
    await P1.shot("http_desktop-1280_1-p1-after-hidden-collision"); await P2.shot("http_desktop-1280_2-p2-after-hidden-collision");
    const s5=await P1.ev(STATE); if(s5.phase==="play"){ await passTurn(); note("5d 턴 교대 후 양 탭 동일",{ok:await same(P1,P2)}); }
    const e1=await P1.ev(CONSOLE_ERR), e2=await P2.ev(CONSOLE_ERR);
    note("5e 콘솔 오류 0 (두 탭)",{ok:e1.length===0&&e2.length===0,detail:JSON.stringify(e1.concat(e2)).slice(0,200)});

    /* ── 6. 재매칭: 두 탭 새로고침 → 빠른 배치로 재접속 → 시작 스냅샷(id 포함) 동일 ── */
    for(const T of [A,B]){ await T.nav(URL); await until(async()=>T.ev(`(()=>!!document.getElementById("netCode")&&S.phase==="menu")()`),8000,"재접속 메뉴"); await T.ev(SET_CODE(server.code)); await T.click('button[onclick="netPrepare()"]'); await sleep(150);
      await T.ev(`(()=>{ autoPlace(); return true; })()`); await T.click('#sidePanel button.primary'); await sleep(150); }
    await until(async()=>{ const a=await A.ev(STATE), b=await B.ev(STATE); return a.started&&b.started&&a.phase==="play"&&b.phase==="play"; },15000,"재매칭 시작");
    await settled(A,B,"재매칭 정착");
    note("6 재매칭(새로고침 후 재접속) 시작 — 28개 말 정규 스냅샷(id 포함) 동일 · 양 탭 DOM ↔ S",{ok:(await A.ev(CANON))===(await B.ev(CANON))&&(await A.ev(DOM_CHECK_START))===null&&(await B.ev(DOM_CHECK_START))===null});
    for(const t of [A,B]) try{ await cdp.send("Target.closeTarget",{targetId:t.targetId}); }catch(e){}
  }catch(e){ note("실행",{error:e.message}); }
  finally{
    if(chrome){ try{ chrome.proc.kill(); }catch(e){} await sleep(300); try{ fs.rmSync(chrome.udd,{recursive:true,force:true}); console.log("CLEANUP profile="+chrome.udd); }catch(e){} }
    if(server){ try{ server.proc.kill(); }catch(e){} }
  }
  const summary={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),viewport:VP,date:new Date().toISOString(),readOnly:READ_ONLY,pass:report.filter(r=>r.ok!==false&&!r.error).length,fail:bad,shots,report,initial};
  if(!READ_ONLY){ const f=path.join(OUT,"issue104_cdp_report.json"); fs.writeFileSync(f,JSON.stringify(summary,null,2)); console.log("REPORT "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  console.log(`\n=== issue104_cdp: pass ${summary.pass} / fail ${summary.fail}${READ_ONLY?" (read-only · 산출물 0)":""} ===`);
  process.exit(bad?1:0);
})();
