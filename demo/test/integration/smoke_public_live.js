/* #217/#218 공개 방 실서버 통합 — node demo/test/integration/smoke_public_live.js [게임 수(기본 3)]
   실제 server/authoritative/server.js 를 임의 포트로 띄우고, demo/index.html 클라이언트 두 개(헤드리스 하네스 + 진짜
   WebSocket(ws) + 진짜 타이머)를 붙여 공개 로비 → 생성/참가 → 배치 → 준비 → 대국 → 전투·선택창·도망 교환 → 결과까지
   완주시킨다. 서버 응답을 흉내 내는 스텁·픽스처가 없다 — 클라이언트는 제품 코드의 공개 진입점(netCreatePublicRoom·
   netJoinPublicRoom·setupDoneCore·onCell·window.__act 등 버튼 onclick 이 부르는 바로 그 함수)만 부른다.
   봇은 **그 좌석 클라이언트가 화면에 가진 정보만** 읽는다(자기 S·보드 하이라이트). 서버 내부·상대 클라이언트 상태는 읽지 않는다.
   검증: (1) 매 게임 양측이 결과(over)에 도달하고 승자·revision 이 일치 (2) 전투·선택창이 실제로 열리고 무대가 fx 재생
   동안 유지 (3) 상대 미공개 말에 정체 필드가 없다 (4) 대국 중 강제 소켓 끊김 뒤 같은 방·같은 좌석으로 재개하고 계속 진행
   (5) 클라이언트 예외 0. 서버 의존성(server/node_modules/ws)이 필요하다 — CI 는 서버 잡(npm ci) 뒤에 실행한다. */
"use strict";
const path=require("path"), http=require("http"), { spawn }=require("child_process");
const vm=require("vm"), fs=require("fs");
/* 클라이언트마다 독립 V8 컨텍스트 — 한 프로세스의 두 브라우저 탭처럼 window·전역 함수(window.__act 등)가 섞이지 않는다 */
const HARNESS_PATH=path.join(__dirname,"..","shared","harness.js");
const HARNESS_SCRIPT=new vm.Script(fs.readFileSync(HARNESS_PATH,"utf8"),{filename:HARNESS_PATH});
function loadIsolated(opts){
  const sb={console,URL,URLSearchParams,setTimeout,clearTimeout,setInterval,clearInterval,Buffer};
  sb.global=sb; sb.globalThis=sb;
  const ctx=vm.createContext(sb);
  const mod={exports:{}}; sb.module=mod; sb.exports=mod.exports; sb.require=s=>require(s); sb.__filename=HARNESS_PATH; sb.__dirname=path.dirname(HARNESS_PATH);
  HARNESS_SCRIPT.runInContext(ctx);
  const T=mod.exports.load(htmlPath,Object.assign({storage:mod.exports.mkStorage({tutorialSeen:"1"})},opts));
  return {T,W:ctx};
}
const ROOT=path.join(__dirname,"..","..","..");
const WS=require(path.join(ROOT,"server","node_modules","ws"));
const htmlPath=path.join(__dirname,"..","..","index.html");
const GAMES=Math.max(1,Number(process.argv[2]||3));
let pass=0,fail=0; const fails=[];
function ok(c,n){ if(c) pass++; else { fail++; fails.push(n); console.error("FAIL: "+n); } }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let rngState=20260913; function rnd(){ rngState=(rngState*1103515245+12345)%2147483648; return rngState/2147483648; }

function freePort(){ return new Promise((res,rej)=>{ const s=require("net").createServer(); s.listen(0,"127.0.0.1",()=>{ const p=s.address().port; s.close(()=>res(p)); }); s.on("error",rej); }); }
function getHealth(port){ return new Promise(res=>{ http.get({host:"127.0.0.1",port,path:"/healthz"},r=>{ r.resume(); res(r.statusCode===200); }).on("error",()=>res(false)); }); }
let DUMP=null;
async function waitFor(fn,ms,label){ const end=Date.now()+ms; while(Date.now()<end){ try{ if(fn()) return true; }catch(e){} await sleep(15); } if(DUMP) try{ DUMP(); }catch(e){} throw new Error("timeout: "+label); }
function dumpClients(clients){ for(const c of clients){ const N=c.T.NET, S=c.T.S; console.error(c.name, JSON.stringify({state:N.roomState,ready:[N.myReady,N.peerReady],want:N.readyWanted,rev:N.revision,started:N.started,phase:S&&S.phase,cur:S&&S.current,battle:!!(S&&S.battle),modal:S&&S._pendingModal,flee:!!(S&&S.fleePick),fxQ:N.fxQueue.length,fxPlaying:N.fxPlaying,stage:N.stageBid,resuming:N.resuming,ws:N.ws&&N.ws.readyState,mainUsed:S&&S.mainUsed,battlesUsed:S&&S.battlesUsed,forced:S&&S.forcedTargets,moved:S&&S.movedPiece&&[S.movedPiece.id,S.movedPiece.type,S.movedPiece.owner],chainWon:S&&S.firstBattleWonByMover,tele:S&&S.teleport&&[S.teleport.stage,S.teleport.piece&&S.teleport.piece.id],sel:S&&S.selected&&S.selected.id,sent:c.ctor.sent,rejects:c.ctor.rejects,toasts:(c.T.byId("toasts").children||[]).map(x=>x.textContent),errors:c.errors.slice(0,2)})); } }

/* 하네스 WebSocket 자리에 진짜 ws 를 끼운다 — 브라우저 WebSocket 과 같은 onopen/onmessage/onclose/protocol/readyState 인터페이스. */
function mkCtor(tag){
  const log=[];
  const F=function(url,protocols){ const w=new WS(url,protocols); w.__tag=tag; log.push(w); F.last=w;
    // 진단 전용: 이 좌석 소켓이 보낸 action 과 받은 error 만 기록한다(응답 변경 없음)
    const send=w.send.bind(w); w.send=(d,...r)=>{ try{ const m=JSON.parse(d); if(m.t==="action"){ F.sent.push(JSON.stringify(m.action).slice(0,120)); if(F.sent.length>6) F.sent.shift(); } }catch(e){} return send(d,...r); };
    w.on("message",d=>{ try{ const m=JSON.parse(String(d)); if(m.type==="error"){ F.rejects.push(m.code+"@"+(F.sent[F.sent.length-1]||"")); if(F.rejects.length>6) F.rejects.shift(); } }catch(e){} });
    return w; };
  F.log=log; F.sent=[]; F.rejects=[]; return F;
}

function mkClient(name,port){
  const ctor=mkCtor(name);
  const errors=[];
  const {T,W}=loadIsolated({href:`http://127.0.0.1:${port}/index.html`,realTimers:true,WebSocketCtor:ctor});
  // 표시 시간은 실제 값의 1/40 — 순서·그룹·무대 수명 계약은 같고 통합 테스트 시간만 줄인다
  for(const k of Object.keys(T.BAL.fx)) if(typeof T.BAL.fx[k]==="number") T.BAL.fx[k]=Math.max(1,Math.round(T.BAL.fx[k]/40));
  return {name,T,W,ctor,errors,seen:{battle:0,modal:0,flee:0,stageHeld:0,acts:0,modalPicks:0,heals:0,searches:0}};
}

async function startServer(port){
  const proc=spawn(process.execPath,[path.join(ROOT,"server","authoritative","server.js")],{env:Object.assign({},process.env,{DD_AUTH_PORT:String(port)}),stdio:["ignore","pipe","pipe"]});
  let out=""; proc.stdout.on("data",d=>out+=d); proc.stderr.on("data",d=>out+=d);
  const end=Date.now()+15000; while(Date.now()<end){ if(await getHealth(port)) return {proc,log:()=>out}; await sleep(100); }
  proc.kill(); throw new Error("server did not start: "+out);
}

/* ---- 봇: 자기 화면 정보만으로 합법 입력을 고른다 ---- */
function idle(c){ const T=c.T; return !T.fxLocked()&&T.NET.ws&&T.NET.ws.readyState===1&&!T.NET.resuming; }
let lastSendAt=new Map();
function throttle(c){ const t=lastSendAt.get(c.name)||0; if(Date.now()-t<25) return false; lastSendAt.set(c.name,Date.now()); return true; }
/* CJ v0.4.10 QA: 도망 교환·텔레포트 위치 변경 직후 턴 종료 동기화 결함이 main 에 있었다 — 그 입력을 보낸 순간을 적어 두고
   양측이 같은 revision 으로 수렴한 뒤 current·turnCount 를 비교하고, 이후 대국이 실제로 계속되는지(교착 없음) 본다. */
let SYNC=null; const SYNCSTAT={fleeSwap:0,fleeSkip:0,teleOpened:0,teleSwap:0,compared:0,progressed:0};
function markSync(c,kind){ SYNCSTAT[kind]++; if(!SYNC) SYNC={kind,rev:c.T.NET.revision,t:Date.now(),by:c.name}; }
function botStep(c){
  const T=c.T, S=T.S, NET=T.NET, me=NET.me;
  if(S&&S.phase==="play"&&NET.stageBid!=null&&NET.stageBid!==NET.fxLiveBid) c.seen.stageHeld++; // 최신 스냅샷과 다른(끝났거나 이전) 전투 무대를 재생 중
  if(!S||S.phase!=="play"||!idle(c)||!throttle(c)) return;
  const m=S._pendingModal;
  if(m){ if(m.owner!==me) return; c.seen.modal++;
    const en=(m.buttons||[]).map((b,i)=>b.disabled?-1:i).filter(i=>i>=0); if(!en.length) return;
    const i=en[Math.floor(rnd()*en.length)]; c.seen.modalPicks++; T.netSendAction({t:"modal",seq:m.seq,i}); return; }
  if(S.fleePick){ if(S.fleePick.owner!==me) return; c.seen.flee++;
    if(S.fleePick.cands.length&&rnd()<0.7){ const id=S.fleePick.cands[0]; T.netAction({t:"fleeSwap",id}); markSync(c,"fleeSwap"); } else { T.netAction({t:"fleeSkip"}); markSync(c,"fleeSkip"); } return; }
  if(S.battle){ c.seen.battle++;
    if(T.netActor()!==me) return;
    const B=S.battle, side=B.attP.owner===me?"A":"D", f=side==="A"?B.fa:B.fd;
    const r=rnd();
    if(r<0.18){ c.W.__flee(); c.seen.acts++; return; } // 도망(성공 시 교환 선택)을 자주 시도해 교환 동기화 경로를 밟는다
    if(r<0.12&&S.inv[me].length&&!(side==="A"?B.itemRoundA:B.itemRoundD)){ c.W.__useItem(0); c.seen.acts++; return; }
    if(r<0.16&&S.pkgs[me]&&S.pkgs[me].itemGift>0){ c.W.__openPkg("itemGift"); c.seen.acts++; return; }
    if(f.skills){ const us=f.skills.map((_,i)=>T.slotUsable(f,i,side)?i:-1).filter(i=>i>=0);
      if(us.length) c.W.__act(us[Math.floor(rnd()*us.length)]); else c.W.__pass(); }
    else c.W.__act("basic");
    c.seen.acts++; return; }
  if(S.current!==me) return;
  const mine=S.pieces.filter(p=>p.owner===me&&p.alive), foes=S.pieces.filter(p=>p.owner!==me&&p.alive);
  /* 강제 전투 대기·연쇄 전투(이미 싸워 이긴 말의 접촉 후속)만 mainUsed 와 무관하게 최우선 이행한다. 주 행동을
     아직 안 썼다면(!mainUsed) 선제 전투도 허용한다. 그 밖(주 행동 완료 + 강제·연쇄 대상 없음)은 canBattle 이
     단독으로 true 를 돌려줘도(#122 접촉 전투는 언제나 선택 가능) 시도하지 않고 endTurn 을 우선한다 — 실제
     사용자도 이 경로에선 "싸우지 않고 종료"를 고를 수 있다(줄 1844). #217 실패1(rev 386, mainUsed=true, 진행
     0)의 정확한 인접 대상 원인은 Saturn 진단대로 로그 부족으로 미확정이며, 이 수정이 그 근본 원인이라고
     단정하지 않는다 — mainUsed+강제·연쇄 대상 없음일 때 endTurn 을 우선하도록만 바꿨다. */
  const forced=S.forcedTargets&&S.forcedTargets.length>0;
  const chaining=S.battlesUsed===1&&S.firstBattleWonByMover&&S.movedPiece&&S.movedPiece.alive;
  /* 강제 전투 대기: UI 는 강제 대상 적을 직접 클릭하면 forcedPickOk 로 전투를 연다(index.html onCellCore — 이동 말이
     폭탄이면 canBattle 대신 contactEligible). 아래 선제 전투 루프는 canBattle·비폭탄만 보므로 폭탄 강제 접촉을 이행하지
     못했고, 서버는 강제 대기 중 endTurn 을 거부해(room.js endTurn forcedPending) 대국이 멈췄다. 같은 직접 클릭을 쓴다. */
  if(forced){ const e=foes.find(x=>S.forcedTargets.includes(x.id)&&T.forcedPickOk(x)); if(e){ T.onCell(e.r,e.c); return; } }
  // 텔레포트(스왑) 진행 중 — 서버 data.turn.teleport 단계를 따라 1단계·2단계 말을 고른다(선제 전투 클릭과 섞지 않는다)
  if(S.teleport){ const movable=mine.filter(p=>p.immobile===0&&p.type!=="trap");
    if(S.teleport.stage===1){ const p=movable[Math.floor(rnd()*movable.length)]; if(p){ T.onCell(p.r,p.c); return; } }
    else { const first=S.teleport.piece; const q=movable.filter(p=>!first||p.id!==first.id); const p=q[Math.floor(rnd()*q.length)]; if(p){ T.onCell(p.r,p.c); markSync(c,"teleSwap"); return; } }
    T.netAction({t:"tele"}); return; }
  /* T3 커버리지: 텔레포트는 teleportAvailable(내 말이 상대 setup 진 zoneOf(1-me)=3줄 안에 있음)이 선 뒤 {t:"tele"}
     합법 입력으로만 연다. CI 34747682221(teleSwap 0): 선제 전투 루프가 이 게이트보다 먼저 돌아, 적 말이 밀집한
     적진에 닿은 말은 매 턴 인접 적과 싸우느라 tele 까지 가지 못했다. 스왑 미관측이고 강제·연쇄 대상이 없으면
     선제 전투보다 먼저 연다. 관측 후엔 선제 전투 뒤 기존 확률 게이트로 섞는다. */
  // battlesUsed===0: 스왑 사전 차단(teleportSwapBlock, 새 강제 전투 수 > 남은 전투)이 생길 수 없는 턴에만 연다
  const teleOk=!forced&&!chaining&&!S.mainUsed&&S.battlesUsed===0&&T.teleportAvailable(me)&&(S.teleUsed[me]||0)<T.BAL.teleMax;
  if(teleOk&&SYNCSTAT.teleSwap===0){ T.netAction({t:"tele"}); c.seen.tele=(c.seen.tele||0)+1; SYNCSTAT.teleOpened++; return; }
  if(forced||chaining||!S.mainUsed){
    for(const p of mine) for(const e of foes){ if(Math.abs(p.r-e.r)+Math.abs(p.c-e.c)===1&&T.canBattle(p,e)&&p.type!=="bomb"&&p.type!=="trap"){
      if(!S.selected||S.selected.id!==p.id){ T.onCell(p.r,p.c); return; } T.onCell(e.r,e.c); return; } }
  }
  if(S.mainUsed){ T.netAction({t:"endTurn"}); return; }
  if(teleOk&&rnd()<0.35){ T.netAction({t:"tele"}); c.seen.tele=(c.seen.tele||0)+1; SYNCSTAT.teleOpened++; return; }
  /* T3 보강: 스왑 미관측(teleSwap===0) 동안은 탐색·회복을 건너뛰고 가장 전진한 비왕 말을 계속 밀어 적진 진입
     기회를 만든다(왕은 가중 제외). 관측 후엔 기존 행동 혼합으로 돌아간다. */
  const rushing=SYNCSTAT.teleSwap===0;
  // 탐색 가능하면 가끔 탐색 (rush 중엔 생략)
  const sel=S.selected&&!S.selected.tray?S.selected:null;
  if(!rushing&&sel&&S.events.some(ev=>ev.r===sel.r&&ev.c===sel.c)&&rnd()<0.8){ T.netAction({t:"search"}); c.seen.searches++; return; }
  if(!rushing&&sel&&T.canHeal(sel)&&sel.hp<sel.maxHp*0.5&&rnd()<0.5){ T.netAction({t:"heal",id:sel.id}); c.seen.heals++; return; }
  // 전진: 상대 진영 쪽으로 움직일 수 있는 말
  const dir=me===0?-1:1; const cand=[];
  const adv=p=>me===0?(13-p.r):(p.r-1);
  for(const p of mine){ for(const [dr,dc] of [[dir,0],[0,1],[0,-1],[dir*2,0]]){ const r=p.r+dr,cc=p.c+dc; if(r<1||r>13||cc<1||cc>7) continue;
    if(T.canMoveTo(p,r,cc)) cand.push({p,r,c:cc,score:(dr===dir||dr===dir*2?3:0)+(p.type==="minion"?2:p.type==="bomb"?1:0)+adv(p)*(rushing&&p.type!=="king"?50:2)+rnd()}); } }
  if(!cand.length){ T.netAction({t:"skipMain"}); return; }
  cand.sort((a,b)=>b.score-a.score); const mv=cand[0];
  if(!sel||sel.id!==mv.p.id){ T.onCell(mv.p.r,mv.p.c); return; }
  T.onCell(mv.r,mv.c);
}

function privacyCheck(c){ // 상대 미공개 말(등급 B)은 정체 필드가 없다 — 클라이언트 표시 객체 기준
  const S=c.T.S; if(!S||S.phase!=="play") return true;
  // 등급 B(미공개 상대 말)는 정체 필드가 서버에서 오지 않는다 → 표시 객체도 type·element·name 이 null 이고 revealed=false
  return S.pieces.filter(p=>p.owner!==c.T.NET.me&&!p.revealed&&(p.type!==null||p.element!==null||p.name!==null||p.rosterId!==null)).length===0;
}

async function playGame(g,port){
  const host=mkClient("host"+g,port), guest=mkClient("guest"+g,port);
  const clients=[host,guest]; DUMP=()=>dumpClients(clients);
  host.T.netCreatePublicRoom();
  await waitFor(()=>host.T.NET.roomId!=null,5000,"room_opened");
  const rid=host.T.NET.roomId;
  guest.T.netListRooms();
  await waitFor(()=>(guest.T.NET.rooms||[]).some(r=>String(r.roomId)===String(rid)),5000,"lobby lists room");
  ok(/방 #/.test(guest.T.byId("sidePanel").innerHTML)&&!/netCode/.test(guest.T.byId("sidePanel").innerHTML),`G${g}-L1 로비 카드에 방이 보이고 코드 입력칸이 없다`);
  guest.T.netJoinPublicRoom(rid);
  await waitFor(()=>guest.T.NET.roomId===rid&&host.T.NET.roomState==="SETUP",5000,"join + host notify");
  ok(true,`G${g}-L2 참가·호스트 입장 알림`);
  // 호스트는 게스트 입장 전에 배치를 끝냈을 수도 있다 — 여기선 게스트가 먼저 준비하고 호스트가 뒤따른다
  for(const c of clients){ c.T.autoPlaceCore(); c.T.setupDoneCore(); }
  await waitFor(()=>host.T.NET.started&&guest.T.NET.started,8000,"match start");
  ok(host.T.S.phase==="play"&&guest.T.S.phase==="play",`G${g}-S1 양측 대국 시작(서버 스냅샷)`);
  let reconnected=false, turns=0; const t0=Date.now(); let lastRev=-1, lastRevT=Date.now(); SYNC=null;
  while(Date.now()-t0<180000){
    for(const c of clients){ try{ botStep(c); }catch(e){ c.errors.push(e.stack||String(e)); } if(!privacyCheck(c)) c.errors.push("privacy: unrevealed opponent identity"); }
    if(host.T.S.phase==="over"&&guest.T.S.phase==="over") break;
    { // 교환·텔레포트 직후 동기화 비교 + 교착 감시
      const hN=host.T.NET, gN=guest.T.NET, quiet=!host.T.fxLocked()&&!guest.T.fxLocked()&&!hN.resuming&&!gN.resuming;
      if(SYNC&&!SYNC.compared&&quiet&&hN.revision===gN.revision&&hN.revision>SYNC.rev){
        SYNC.compared=true; SYNCSTAT.compared++;
        const same=host.T.S.current===guest.T.S.current&&host.T.S.turnCount===guest.T.S.turnCount&&host.T.S.phase===guest.T.S.phase;
        if(!same) host.errors.push("sync mismatch after "+SYNC.kind+": host cur/turn "+host.T.S.current+"/"+host.T.S.turnCount+" guest "+guest.T.S.current+"/"+guest.T.S.turnCount);
        SYNC.cmpRev=hN.revision; SYNC.cmpT=Date.now();
      }
      if(SYNC&&SYNC.compared){
        if(hN.revision>SYNC.cmpRev||host.T.S.phase==="over"){ SYNCSTAT.progressed++; SYNC=null; }
        else if(Date.now()-SYNC.cmpT>20000&&quiet){ host.errors.push("deadlock after "+SYNC.kind+" at rev "+hN.revision); SYNC=null; }
      }
      if(quiet&&host.T.S.phase==="play"){ if(hN.revision!==lastRev){ lastRev=hN.revision; lastRevT=Date.now(); } else if(Date.now()-lastRevT>25000){ host.errors.push("no progress for 25s at rev "+hN.revision); lastRevT=Date.now(); } }
    }
    turns=Math.max(host.T.S.turnCount||0,guest.T.S.turnCount||0);
    if(!reconnected&&turns>=6&&!host.T.NET.resuming&&host.T.NET.ws){
      const pre={roomId:host.T.NET.roomId,me:host.T.NET.me,rev:host.T.NET.revision,gen:host.T.NET.tokenGen}; const oldWs=host.T.NET.ws;
      try{ host.T.NET.ws._socket.destroy(); }catch(e){ host.T.NET.ws.terminate(); } // 네트워크 단절 — 클라이언트 로직을 거치지 않는 소켓 파괴
      await waitFor(()=>host.T.NET.ws!==oldWs&&!host.T.NET.resuming&&host.T.NET.ws&&host.T.NET.ws.readyState===1&&host.T.NET.tokenGen>pre.gen,20000,"resume done");
      ok(host.T.NET.roomId===pre.roomId&&host.T.NET.me===pre.me&&host.T.NET.revision>=pre.rev,`G${g}-R1 같은 방·같은 좌석으로 재개(좌석 토큰 세대 ${pre.gen}→${host.T.NET.tokenGen}), revision 역행 없음`);
      ok((host.T.byId("toasts").children||[]).some(x=>/재접속했습니다/.test(x.textContent)),`G${g}-R1b 재접속 안내가 화면에 뜬다`);
      reconnected=true;
    }
    if(turns>400){ const cur=host.T.S.current; const c=cur===host.T.NET.me?host:guest; if(!c.T.S.battle&&!c.T.S._pendingModal&&!c.T.S.fleePick) c.T.netAction({t:"resign"}); }
    await sleep(8);
  }
  await waitFor(()=>host.T.S.phase==="over"&&guest.T.S.phase==="over",20000,"both over");
  await waitFor(()=>!host.T.fxLocked()&&!guest.T.fxLocked(),20000,"fx drained");
  ok(host.T.S.winner===guest.T.S.winner&&host.T.NET.revision===guest.T.NET.revision,`G${g}-E1 양측 결과·revision 일치 (winner ${host.T.S.winner}, rev ${host.T.NET.revision}, turn ${turns})`);
  ok(/경기 종료/.test(host.T.byId("sidePanel").innerHTML)&&/경기 종료/.test(guest.T.byId("sidePanel").innerHTML),`G${g}-E2 양측 결과 화면`);
  ok(host.T.byId("overlay").classList.contains("hidden")&&guest.T.byId("overlay").classList.contains("hidden"),`G${g}-E3 재생이 끝나면 전투 무대·선택창이 닫혀 있다`);
  ok(reconnected||turns<6,`G${g}-R2 재접속 시나리오 실행`);
  const seen={battle:host.seen.battle+guest.seen.battle,modal:host.seen.modal+guest.seen.modal,acts:host.seen.acts+guest.seen.acts,flee:host.seen.flee+guest.seen.flee,stageHeld:host.seen.stageHeld+guest.seen.stageHeld};
  console.log(`game ${g}: winner=${host.T.S.winner} winType=${host.T.S.metrics.winType} turns=${turns} seen=${JSON.stringify(seen)} errors=${host.errors.length+guest.errors.length}`);
  ok(host.errors.length+guest.errors.length===0,`G${g}-X1 클라이언트 예외·정보 누출 0 ${(host.errors.concat(guest.errors)[0]||"").slice(0,300)}`);
  for(const c of clients){ try{ c.T.toLobby&&c.T.toLobby(); }catch(e){} try{ if(c.T.NET.ws) c.T.NET.ws.close(); }catch(e){} }
  return seen;
}

(async()=>{
  const port=await freePort();
  const srv=await startServer(port);
  let total={battle:0,modal:0,acts:0,flee:0,stageHeld:0};
  try{
    for(let g=1;g<=GAMES;g++){ const s=await playGame(g,port); for(const k in total) total[k]+=s[k]; }
    ok(total.battle>0&&total.acts>0,"T1 전체 게임에서 전투가 실제로 열리고 전투 행동이 서버에 수락됐다 "+JSON.stringify(total));
    ok(total.stageHeld>0,"T2 fx 재생 동안 전투 무대가 battleId 로 유지된 순간이 관측됐다");
    console.log("sync stats "+JSON.stringify(SYNCSTAT));
    ok(SYNCSTAT.teleSwap>0&&(SYNCSTAT.fleeSwap+SYNCSTAT.fleeSkip)>0&&SYNCSTAT.compared>0&&SYNCSTAT.progressed>0,"T3 도망 교환·텔레포트 스왑 직후 양측 current·turnCount·revision 이 일치하고 이후 대국이 계속됐다(교착·중복 진행 0) "+JSON.stringify(SYNCSTAT));
  }catch(e){ fail++; fails.push(String(e&&e.message||e)); console.error(e); console.error(srv.log().slice(-2000)); }
  finally{ srv.proc.kill(); }
  console.log(`\n=== smoke_public_live (#217 실서버 2클라이언트): pass ${pass} / fail ${fail} ===`);
  if(fail){ console.error("Failing: "+fails.join(" | ")); process.exit(1); }
  process.exit(0);
})();
