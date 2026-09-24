/* #237 온라인 경제 서버 권위 실서버 통합 — node demo/test/integration/smoke_public_eco_live.js
   실제 server/authoritative/server.js 를 DD_ECONOMY=1 로 임의 포트에 띄우고 demo/index.html 클라이언트 두 개(독립 V8 컨텍스트 +
   진짜 ws + 진짜 타이머)를 붙인다. 클라이언트는 제품 버튼이 부르는 진입점(window.__shop·autoPlaceCore·setupDoneCore·netAction)만 쓴다.
   검증: (1) 시작 상점이 두 좌석에 동시에 열리고 좌석 뷰가 자기 경제만 싣는다 (2) 구매는 서버 응답으로만 반영되고 산 칸은 빈칸
   (3) 지난 진열 번호(seq) 거래는 E_SHOP_STALE 로 거부되고 상태 불변 (4) 같은 requestId 재전송은 한 번만 적용 (5) 단절 중 상대 화면에
   "상대 연결 대기"·입력 E_PAUSED·게임 시계 정지, 재접속 뒤 남은 시간부터 재개 (6) 왕·동료 속성 선택 → 완료 → 비공개 배치 → 개시,
   서버 말 = 산 말 (7) 20턴 뒤 정기 상점이 양측에 열리고 소모품 구매·완료 뒤 경기 재개 (8) 상대 미공개 말·경제 비노출
   (9) 서버 재시작 → 재개는 즉시 E_EPOCH·무효 안내 (10) 클라이언트 예외 0.
   서버 의존성(server/node_modules/ws)이 필요하다. */
"use strict";
const path=require("path"), http=require("http"), { spawn }=require("child_process");
const vm=require("vm"), fs=require("fs");
const HARNESS_PATH=path.join(__dirname,"..","shared","harness.js");
const HARNESS_SCRIPT=new vm.Script(fs.readFileSync(HARNESS_PATH,"utf8"),{filename:HARNESS_PATH});
const ROOT=path.join(__dirname,"..","..","..");
const WS=require(path.join(ROOT,"server","node_modules","ws"));
const htmlPath=path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(c,n){ if(c) pass++; else { fail++; fails.push(n); console.error("FAIL: "+n); } }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,ms,label){ const end=Date.now()+ms; while(Date.now()<end){ try{ if(fn()) return true; }catch(e){} await sleep(15); } throw new Error("timeout: "+label); }
function freePort(){ return new Promise((res,rej)=>{ const s=require("net").createServer(); s.listen(0,"127.0.0.1",()=>{ const p=s.address().port; s.close(()=>res(p)); }); s.on("error",rej); }); }
function getHealth(port){ return new Promise(res=>{ http.get({host:"127.0.0.1",port,path:"/healthz"},r=>{ r.resume(); res(r.statusCode===200); }).on("error",()=>res(false)); }); }

/* 진짜 ws — 받은 프레임·오류를 기록한다(응답 변경 없음). block=true 인 동안의 새 소켓은 닫힌 포트로 간다(재접속 지연 재현). */
function mkCtor(){
  const F=function(url,protocols){ const w=new WS(F.block?"ws://127.0.0.1:9":url,protocols); F.last=w;
    w.on("error",()=>{});
    w.on("message",d=>{ try{ const m=JSON.parse(String(d)); F.frames.push(m); if(m.type==="error") F.errors.push(m.code); }catch(e){} });
    return w; };
  F.frames=[]; F.errors=[]; F.block=false; return F;
}
function mkClient(name,port){
  const sb={console,URL,URLSearchParams,setTimeout,clearTimeout,setInterval,clearInterval,Buffer};
  sb.global=sb; sb.globalThis=sb;
  const ctx=vm.createContext(sb);
  const mod={exports:{}}; sb.module=mod; sb.exports=mod.exports; sb.require=s=>require(s); sb.__filename=HARNESS_PATH; sb.__dirname=path.dirname(HARNESS_PATH);
  HARNESS_SCRIPT.runInContext(ctx);
  const ctor=mkCtor();
  const T=mod.exports.load(htmlPath,{storage:mod.exports.mkStorage({tutorialSeen:"1"}),href:`http://127.0.0.1:${port}/index.html`,realTimers:true,WebSocketCtor:ctor});
  for(const k of Object.keys(T.BAL.fx)) if(typeof T.BAL.fx[k]==="number") T.BAL.fx[k]=Math.max(1,Math.round(T.BAL.fx[k]/40));
  return {name,T,W:ctx,ctor,errors:[]};
}
async function startServer(port){
  const proc=spawn(process.execPath,[path.join(ROOT,"server","authoritative","server.js")],{env:Object.assign({},process.env,{DD_AUTH_PORT:String(port),DD_ECONOMY:"1"}),stdio:["ignore","pipe","pipe"]});
  let out=""; proc.stdout.on("data",d=>out+=d); proc.stderr.on("data",d=>out+=d);
  const end=Date.now()+15000; while(Date.now()<end){ if(await getHealth(port)) return {proc,log:()=>out}; await sleep(100); }
  proc.kill(); throw new Error("server did not start: "+out);
}
const lastState=c=>{ for(let i=c.ctor.frames.length-1;i>=0;i--){ const m=c.ctor.frames[i]; if(m.data&&(m.type==="room_state"||m.type==="room_resumed")) return m.data; } return null; };
const open0=c=>{ const S=c.T.S; return !!(S&&S.phase==="setup"&&S.eco&&S.eco.shop&&!S.eco.shop.done[0]); };
const coins=c=>c.T.S.eco.coins[c.T.S.phase==="setup"?0:c.T.NET.me];
const waitReply=async(c,n0,label)=>waitFor(()=>c.ctor.frames.length>n0&&c.ctor.frames.slice(n0).some(m=>m.requestId),5000,label);

/* S01 을 채우고 속성 하나를 고른 뒤 완료 — 모두 화면 버튼 경로(window.__shop) */
async function finishStartShop(c){
  for(let n=0;n<30&&c.T.S.eco.shop&&!c.T.S.eco.shop.done[0];n++){
    const S=c.T.S, sh=S.eco.shop, empty=S.pieces.filter(x=>x.owner===0&&x.type==="minion"&&!x.rosterId).length, n0=c.ctor.frames.length;
    if(!empty) break;
    const i=sh.slots[0].findIndex(s=>!!s&&!sh.sold[0].includes(s.key));
    c.W.__shop(i<0?"refresh":"buy",i<0?undefined:i);
    await waitReply(c,n0,c.name+" buy");
  }
  const lead=c.T.S.pieces.find(x=>x.owner===0&&x.type==="king"), n0=c.ctor.frames.length;
  c.W.__shop("lead",lead.id,"fire"); await waitReply(c,n0,c.name+" lead");
  const n1=c.ctor.frames.length; c.W.__shop("done"); await waitReply(c,n1,c.name+" done");
}

(async()=>{
  const port=await freePort();
  const srv=await startServer(port);
  const host=mkClient("host",port), guest=mkClient("guest",port), clients=[host,guest];
  try{
    host.T.netCreatePublicRoom();
    await waitFor(()=>host.T.NET.roomId!=null,5000,"room_opened");
    host.T.render();
    ok(host.T.NET.economy===true&&!/로스터 선택/.test(host.T.byId("sidePanel").innerHTML)&&/시작 상점\(90초\)이 열립니다/.test(host.T.byId("sidePanel").innerHTML),"E0 OPEN 호스트는 상대 입장 전 무료 로스터 대신 대기 안내(room_opened.economy)");
    guest.T.netJoinPublicRoom(host.T.NET.roomId);
    await waitFor(()=>open0(host)&&open0(guest),8000,"start shop opens on both seats");
    ok(true,"E1 참가 즉시 두 좌석에 시작 상점(S01)이 동시에 열린다");
    const hv=lastState(host);
    ok(hv.phase==="shop"&&typeof hv.shop.seq==="number"&&typeof hv.you.eco.coins==="number"&&(hv.units||[]).length===0,"E2 좌석 뷰는 자기 진열·자기 재화만 싣는다(상대 경제·말 없음)");
    ok(hv.clock&&hv.clock.key==="shop"&&hv.clock.leftMs>80000&&hv.clock.leftMs<=90000,"E3 서버 개인 상점 시계 90초 "+JSON.stringify(hv.clock));
    ok(/시작 상점/.test(host.T.byId("sidePanel").innerHTML)&&/⏱ \d+초/.test(host.T.byId("sidePanel").innerHTML),"E4 배치 화면 안에 시작 상점과 서버 시계가 그려진다");

    // 구매 — 서버 응답으로만 반영, 산 칸은 빈칸
    const c0=coins(host), seq0=host.T.S.eco.shop.seq[0], slot=host.T.S.eco.shop.slots[0].findIndex(s=>!!s);
    let n0=host.ctor.frames.length; host.W.__shop("buy",slot); await waitReply(host,n0,"buy");
    ok(coins(host)===c0-1&&host.T.S.eco.shop.slots[0][slot]===null&&host.T.S.eco.shop.seq[0]===seq0+1,"E5 ⭐1 구매 → 🪙-1 · 산 칸 빈칸 · 진열 번호+1");
    ok(host.T.S.pieces.filter(x=>x.owner===0&&x.type==="minion"&&x.rosterId).length===1&&host.T.S.pieces.some(x=>x.owner===0&&x.fresh),"E6 산 말이 필드 첫 칸에 신규 표시로 들어온다");

    // 지난 진열 번호 — 거부·상태 불변
    const c1=coins(host), e0=host.ctor.errors.length; n0=host.ctor.frames.length;
    host.T.netSendAction({t:"shopBuy",shop:0,seq:seq0,i:(slot+1)%5});
    await waitFor(()=>host.ctor.errors.length>e0,5000,"stale reject");
    ok(host.ctor.errors[e0]==="E_SHOP_STALE"&&coins(host)===c1,"E7 지난 seq 구매는 E_SHOP_STALE · 코인 불변");
    await waitFor(()=>host.ctor.frames.slice(n0).some(m=>m.type==="room_state"),5000,"resync after stale");

    // 같은 requestId 재전송 — 한 번만 적용 (서버 dedup)
    const N=host.T.NET, c2=coins(host), frame={v:1,requestId:"dup-237",seatToken:N.seatToken,tokenGen:N.tokenGen,t:"action",baseRevision:N.revision,
      action:{t:"shopGood",shop:0,seq:host.T.S.eco.shop.seq[0],item:"potion"}};
    n0=host.ctor.frames.length; N.ws.send(JSON.stringify(frame)); N.ws.send(JSON.stringify(frame));
    await waitFor(()=>host.ctor.frames.slice(n0).filter(m=>m.requestId==="dup-237").length===2,5000,"dup replies");
    await sleep(50);
    ok(coins(host)===c2-1,"E8 같은 requestId 두 번 → 한 번만 적용 (🪙 "+c2+"→"+coins(host)+")");

    // 단절 — 상대 화면 정지·입력 거부·시계 정지, 재접속 뒤 남은 시간부터
    host.ctor.block=true;
    try{ host.T.NET.ws._socket.destroy(); }catch(e){ host.T.NET.ws.terminate(); }
    await waitFor(()=>guest.T.NET.pause&&guest.T.NET.pause.length,8000,"guest sees pause");
    const bar=guest.T.byId("netResumeBar");
    ok(/상대 연결 대기/.test(bar.innerHTML)&&!bar.classList.contains("hidden"),"E9 상대 화면에 '상대 연결 대기'·재연결 유예 표시");
    const gClock=Object.assign({},guest.T.NET.ecoClock);
    ok(gClock.running===false,"E10 단절 동안 상대의 상점 시계도 멈춘다 "+JSON.stringify(gClock));
    const ge=guest.ctor.errors.length; n0=guest.ctor.frames.length;
    guest.W.__shop("good","potion");
    await waitFor(()=>guest.ctor.errors.length>ge,5000,"paused reject");
    ok(guest.ctor.errors[ge]==="E_PAUSED","E11 단절 중 거래는 E_PAUSED");
    await sleep(1500);
    host.ctor.block=false;
    await waitFor(()=>!host.T.NET.resuming&&host.T.NET.ws&&host.T.NET.ws.readyState===1&&!guest.T.NET.pause,20000,"resume");
    await waitFor(()=>guest.T.NET.ecoClock&&guest.T.NET.ecoClock.running,5000,"clock resumes");
    const g2=guest.T.NET.ecoClock;
    ok(g2.leftMs<=gClock.leftMs&&g2.leftMs>=gClock.leftMs-1000,"E12 재접속 뒤 남은 시간부터 재개 (정지 "+gClock.leftMs+" → 재개 "+g2.leftMs+")");
    ok(open0(host)&&host.T.S.pieces.filter(x=>x.owner===0&&x.type==="minion"&&x.rosterId).length===1,"E13 재접속한 좌석이 같은 시작 상점·산 말을 되찾는다");

    // S01 완료 → 배치 → 개시
    await finishStartShop(host); await finishStartShop(guest);
    for(const c of clients){
      const k=c.T.S.pieces.find(x=>x.owner===0&&x.type==="king");
      ok(c.T.S.eco.shop.done[0]&&k.element==="fire",`E14 ${c.name} 시작 상점 완료·왕 속성 선택 반영`);
    }
    const bought=clients.map(c=>c.T.S.roster[0].slice());
    for(const c of clients){ c.T.autoPlaceCore(); c.T.setupDoneCore(); }
    await waitFor(()=>host.T.NET.started&&guest.T.NET.started&&host.T.S.phase==="play"&&guest.T.S.phase==="play",10000,"match start");
    clients.forEach((c,k)=>{ const me=c.T.NET.me;
      const mine=c.T.S.pieces.filter(x=>x.owner===me&&x.type==="minion").map(x=>x.rosterId);
      ok(bought[k].every(r=>mine.includes(r))&&mine.length===6,`E15 ${c.name} 경기 개시 — 서버 말 = 시작 상점에서 산 6명`); });
    ok(host.T.S.pieces.filter(x=>x.owner!==host.T.NET.me&&!x.revealed).every(x=>x.type===null&&x.rosterId===null&&!x.paid&&!x.fresh),"E16 상대 미공개 말에 정체·원장·신규 표시가 없다 (등급은 E17 좌석 뷰에서 본다)");
    const pv=lastState(host);
    ok(pv.you.eco&&!("eco" in (pv.units[0]||{}))&&(pv.units||[]).every(u=>u.paid===undefined&&u.grade===undefined),"E17 경기 중 좌석 뷰도 자기 경제만(상대 말에 원장·등급 없음)");

    // 20턴까지 주 행동 생략·턴 종료로 넘긴다 → 정기 상점
    const t0=Date.now();
    while(Date.now()-t0<120000){
      if(host.T.S.phase==="shop"&&guest.T.S.phase==="shop") break;
      for(const c of clients){ const S=c.T.S;
        if(S.phase!=="play"||S.current!==c.T.NET.me||S.battle||S._pendingModal||c.T.fxLocked()) continue;
        c.T.netAction(S.mainUsed?{t:"endTurn"}:{t:"skipMain"}); }
      await sleep(40);
    }
    await waitFor(()=>host.T.S.phase==="shop"&&guest.T.S.phase==="shop",5000,"regular shop");
    ok(true,"E18 20턴 뒤 정기 상점이 두 좌석에 동시에 열린다");
    await waitFor(()=>!host.T.byId("overlay").classList.contains("hidden")&&/20턴 상점/.test(host.T.byId("overlayBox").innerHTML),5000,"shop overlay");
    ok(/🏳️ 기권/.test(host.T.byId("overlayBox").innerHTML),"E19 정기 상점 창에 서버 시계·기권 버튼");
    const hc=coins(host); n0=host.ctor.frames.length;
    host.W.__shop("good","ball"); await waitReply(host,n0,"regular good");
    ok(coins(host)===hc-1&&host.T.S.balls[host.T.NET.me]>=1,"E20 정기 상점 소모품 구매가 서버 판정으로 반영");
    n0=host.ctor.frames.length; host.W.__shop("done"); await waitReply(host,n0,"host done");
    await waitFor(()=>/상점 완료/.test(host.T.byId("overlayBox").innerHTML),5000,"host waits");
    ok(host.T.S.phase==="shop","E21 먼저 끝낸 좌석은 상대 완료까지 대기 화면");
    n0=guest.ctor.frames.length; guest.W.__shop("done"); await waitReply(guest,n0,"guest done");
    await waitFor(()=>host.T.S.phase==="play"&&guest.T.S.phase==="play",5000,"play resumes");
    await waitFor(()=>host.T.byId("overlay").classList.contains("hidden"),5000,"shop overlay closes");
    ok(true,"E22 양측 완료 → 경기 재개·상점 창 닫힘");
    const idle=clients.find(c=>c.T.S.current!==c.T.NET.me); idle.T.renderTurnBar();
    const rb=idle.T.byId("turnBar").children.find(x=>x.textContent==="기권");
    ok(rb&&rb.disabled===false,"E23 상대 차례에도 기권 버튼이 눌린다(경제 방 GDD-23 2.4)");
    // §2.8 서버 재시작 — 새 프로세스는 새 에폭이다. 재개 credential(r-<옛 에폭>)은 즉시 E_EPOCH → 무효 안내(몰수·일반 단절 문구 아님)
    const epoch0=host.T.NET.epoch, toastSeen=clients.map(()=>"");
    const exited=new Promise(r=>srv.proc.once("exit",r)); srv.proc.kill(); await exited;
    await waitFor(()=>clients.every(c=>c.T.NET.resuming),5000,"resume begins after server stop");
    Object.assign(srv,await startServer(port));
    const tr0=Date.now();
    await waitFor(()=>{ clients.forEach((c,k)=>{ toastSeen[k]+=(c.T.byId("toasts").children||[]).map(x=>x.textContent).join("|"); });
      return clients.every(c=>!c.T.NET.resuming&&c.T.S.phase==="menu"); },20000,"E_EPOCH abandon");
    clients.forEach((c,k)=>{
      ok(c.ctor.errors.includes("E_EPOCH")&&Date.now()-tr0<20000,`E24 ${c.name} 재시작 뒤 재개는 60초 유예 없이 즉시 E_EPOCH (에폭 ${epoch0})`);
      ok(/서버 재시작으로 경기가 무효 처리되었습니다/.test(toastSeen[k])&&!/연결이 끊겼습니다/.test(toastSeen[k]),`E25 ${c.name} 무효 안내 — 일반 단절 문구 아님 (${toastSeen[k].slice(0,120)})`); });
    for(const c of clients) if(c.T.errors&&c.T.errors.length) c.errors.push(...c.T.errors);
    ok(clients.every(c=>!c.errors.length),"X1 클라이언트 예외 0 "+(clients.map(c=>c.errors[0]||"").join("|")).slice(0,300));
  }catch(e){ fail++; fails.push(String(e&&e.message||e)); console.error(e);
    for(const c of clients) console.error(c.name,JSON.stringify({phase:c.T.S&&c.T.S.phase,rev:c.T.NET.revision,errors:c.ctor.errors.slice(-5),last:c.ctor.frames.slice(-2).map(m=>m.type+":"+(m.code||m.data&&m.data.phase))}));
    console.error(srv.log().slice(-2000)); }
  finally{ for(const c of clients){ try{ if(c.T.NET.ws) c.T.NET.ws.close(); }catch(e){} } srv.proc.kill(); }
  console.log(`\n=== smoke_public_eco_live (#237 실서버 경제 2클라이언트): pass ${pass} / fail ${fail} ===`);
  if(fail){ console.error("Failing: "+fails.join(" | ")); process.exit(1); }
  process.exit(0);
})();
