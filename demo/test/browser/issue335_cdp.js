/* #335 Argon 스킨 · 전설 3종 4번 기술 명중 시트 — 실제 브라우저 상태 매트릭스 (Mars 소유, demo/test/browser)
   사용: node demo/test/browser/issue335_cdp.js [--out <dir>] [--vp 390x844,1280x800] [--states T01,S03] [--no-shots] [--no-fx] [--chrome <chrome.exe>]
   기본 출력: os.tmpdir()/digitduel-issue335-evidence — 저장소 밖. --no-shots 면 이미지 0건(report.json 만).

   무엇을 띄우나 (전부 이 프로세스 소유 · 끝나면 정리):
     · 정적 HTTP 서버 127.0.0.1:임의 포트 — demo/ 만 읽기 전용으로 서빙. /api/* 는 'DB 없는 서버' 응답(503 E_ACCOUNTS_DISABLED → 계정 없는 경로). /__block/fx/ 접두는 assets/fx/ 를 404 로 돌려 '시트 미로드' 폴백을 실제로 만든다.
     · 헤드리스 Chrome + 임시 프로필(os.tmpdir) — 사용자 브라우저·8084 등 외부 프로세스는 건드리지 않는다. 운영 서버·Render 에 접속하지 않는다.

   상태를 세우는 방법(한계 그대로 보고):
     · 화면은 전부 **제품 렌더러**(render·shopShow·bagPickShow·battleModal·netResumeBarSync·acctOpen…)가 그린다. 그림을 덧칠한 fixture 가 아니다.
     · 경기 안 상태(S01~S05·B01~B08·S04)는 오프라인 PVE 엔진을 제품 함수로 진행·조정해 세운다(issue325_cdp 와 같은 방식) — 사람이 로비부터 누른 경로가 아니다.
     · 공개 방 상태(L02·L03·S01r·X01·X03)는 페이지 안 가짜 WebSocket 에 room_opened 를 넣고, 목록·준비·정지·재접속 값은 NET 필드로 세운다 — 실서버 왕복이 아니다.
     · 시트(FX)는 실제 전투 화면에서 **실제 마우스로** 싸우기 → 4번 기술을 누른다. 프레임은 같은 애니메이션을 멈춰 시각별 background-position 으로 판정한다.
   판정: 가로 넘침 0 · 스킨 ON/OFF 보드 기하 동일 · 지정 호스트에 스태킹/컨테이닝 속성 추가 0 · 튜토리얼 상자 계산 스타일 ON=OFF ·
         X01 inert·초점 · Esc=취소 · 시트 1회 8프레임(F8 투명·끝 -768px) · 표적 몸통 중심 · HUD 아래 · 미로드/움직임 줄이기 폴백 · 세대 취소. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), http=require("http"), {spawn}=require("child_process");
const args=process.argv.slice(2), opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const DEMO=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(os.tmpdir(),"digitduel-issue335-evidence")));
const SHOTS=!args.includes("--no-shots"), FXRUN=!args.includes("--no-fx");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const VPS=opt("--vp","320x640,360x640,390x844,430x932,1280x800,1920x1080").split(",").map(s=>{ const [w,h]=s.split("x").map(Number); return {w,h,tag:s}; });
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0; const report={startedAt:new Date().toISOString(),viewports:VPS.map(v=>v.tag),states:{},fx:{},fails:[]};
const ok=(c,n)=>{ if(c){pass++; console.log("PASS "+n);} else {fail++; report.fails.push(n); console.error("FAIL "+n);} };

/* ===== 정적 서버 (demo/ 읽기 전용) ===== */
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".webp":"image/webp",".json":"application/json"};
function serve(){
  return new Promise(res=>{
    const srv=http.createServer((req,rsp)=>{
      let p=decodeURIComponent(new URL(req.url,"http://x").pathname);
      if(p.startsWith("/api/")){ rsp.writeHead(503,{"Content-Type":"application/json"}); rsp.end('{"error":"E_ACCOUNTS_DISABLED"}'); return; } // DB 없는 서버 계약 = 계정 없는 경로(off)
      const block=p.startsWith("/__block/fx/"); if(block) p=p.slice("/__block/fx".length);
      if(p.endsWith("/")) p+="index.html";
      const f=path.resolve(DEMO,"."+p);
      if(!f.startsWith(DEMO+path.sep)||(block&&/[\\/]assets[\\/]fx[\\/]/.test(f))||!fs.existsSync(f)||!fs.statSync(f).isFile()){ rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"}); fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0,"127.0.0.1",()=>res(srv));
  });
}

/* ===== 페이지 안 준비물 — 가짜 WebSocket(공개 방 상태용) · fetch 스텁(계정 API 없음) ===== */
const PRELUDE=`(()=>{ window.__ddWS=[];
  window.WebSocket=class{ constructor(u,p){ this.url=u; this.protocol="digit-duel.v1"; this.readyState=0; this.sent=[]; window.__ddWS.push(this); setTimeout(()=>{ this.readyState=1; this.onopen&&this.onopen(); },0); }
    send(d){ this.sent.push(d); } close(){ this.readyState=3; this.onclose&&this.onclose({code:1000,reason:""}); } };
  window.WebSocket.OPEN=1; window.WebSocket.CONNECTING=0; window.WebSocket.CLOSED=3;
  window.__ddFeed=m=>{ const w=window.__ddWS[window.__ddWS.length-1]; w.onmessage&&w.onmessage({data:JSON.stringify(m)}); };
})()`;
/* 오프라인 PVE 판 — 시작 상점 → (선택) 배치 → 대국. 내 차례에서 멈춘다 */
const PVE=(stage)=>`(()=>{ if(typeof TUT!=="undefined"&&TUT.open) tutSkip(); UI.entered=true; startMode("pve",{aiLevel:"grade5"});
  ${stage==="S01"?"":`dispatchCoreAction({t:"shopTimeout",player:0}); UI.prep="place"; render();`}
  ${stage==="S01"||stage==="S02"?"":`netAction({t:"auto"}); netAction({t:"setupDone"}); fxReleaseAll(); S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; render();`}
  return true; })()`;
const MINE=`const mine=t=>S.pieces.filter(x=>x.owner===0&&x.type===t&&x.alive), foes=t=>S.pieces.filter(x=>x.owner===1&&x.type===t&&x.alive);`;
/* 개시 카운트다운(countStep ×4)과 남은 전투 메시지가 끝나 명령 버튼이 열릴 때까지 기다린다 */
const BATTLE_IDLE=`(async()=>{ for(let i=0;i<120;i++){ if(!FX.cur&&!FX.q.length&&!MSGPLAYING&&S.battle&&S.battle.msgQ.length) battleModal(); if(!fxLocked()&&S.battle&&!S.battle.msgQ.length) return true; await new Promise(r=>setTimeout(r,150)); } return false; })()`;
const ONLINE=`(()=>{ UI.entered=true; netCreatePublicRoom("아르곤 검수 방"); return true; })()`;
const OPENED=`(async()=>{ for(let i=0;i<60&&!window.__ddWS.length;i++) await new Promise(r=>setTimeout(r,50)); __ddFeed({v:1,type:"room_opened",epoch:"e335",roomId:335,seat:0,seatToken:"t",tokenGen:0,revision:0,seq:1,economy:true}); render(); return NET.roomState; })()`;

const STATES={
  T01:{steps:[`(()=>{ if(TUT.open) tutSkip(); AUTH.state="anon"; render(); acctRender(); return true; })()`]},
  A01:{steps:[`(()=>{ if(TUT.open) tutSkip(); AUTH.state="anon"; acctOpen(); acctView("signup"); return !!document.getElementById("acctGo"); })()`]},
  A02:{steps:[`(()=>{ if(TUT.open) tutSkip(); UI.entered=true; render(); LOBBY.assets=LOBBY.assets.map((a,i)=>Object.assign(a,{state:i?"loading":"ok"})); LOBBY.prof="loading"; render(); return !lobbyReady(); })()`]},
  L01:{steps:[`(()=>{ if(TUT.open) tutSkip(); UI.entered=true; render(); return true; })()`],wait:900},
  L02:{steps:[`(async()=>{ if(TUT.open) tutSkip(); UI.entered=true; render(); lobbyRooms(); await new Promise(r=>setTimeout(r,500)); // 목록 소켓이 열리고 lobby_ready 가 다시 그린 뒤
    NET.rooms=[{roomId:12,roomName:"초보 환영",state:"OPEN",seats:"1/2",ageSec:30,players:["달빛여우"],reps:["M-F1"]},{roomId:13,roomName:"한판 붙자",state:"IN_PROGRESS",seats:"2/2",ageSec:300,players:["파도","번개곰"],reps:["M-W2","M-L3"]},
      {roomId:14,roomName:"아주 긴 방 이름으로 줄바꿈 확인하기",state:"SETUP",seats:"2/2",ageSec:90,players:["가나다라마바사","하늘"],reps:["M-G1","M-T2"]}]; lobbyRoomsPaint(); return document.querySelectorAll(".roomRow").length; })()`],wait:600},
  L03:{steps:[ONLINE,OPENED],wait:400},
  S01:{steps:[PVE("S01")]},
  S02:{steps:[PVE("S02")]},
  S01r:{steps:[ONLINE,OPENED,`(()=>{ startMode("pve",{aiLevel:"grade5"}); NET.publicMode=true; NET.mode=true; NET.me=0; NET.started=false; NET.roomState="SETUP"; NET.readyWanted=true; NET.myReady=true; NET.peerReady=false;
    dispatchCoreAction({t:"shopTimeout",player:0}); netAction&&0; UI.prep="place"; render(); return !!document.querySelector("#left .readyPop"); })()`]},
  S03:{steps:[PVE("S03")]},
  B01:{steps:[PVE("S03"),`(()=>{ ${MINE} const m=mine("minion")[0], f=foes("minion"); for(const x of S.pieces) if(x.alive&&x!==m&&Math.abs(x.r-6)<=1&&Math.abs(x.c-3)<=1) x.r+=0;
    m.r=6; m.c=3; f[0].r=5; f[0].c=3; f[1].r=6; f[1].c=4; f[0].revealed=f[1].revealed=true; S.movedPiece=m; S.mainUsed=true; S.forcedTargets=[f[0].id,f[1].id]; render(); return document.querySelectorAll("#board .cell.hl-attack").length; })()`]},
  B02:{steps:[PVE("S03"),`(()=>{ ${MINE} const k=mine("king")[0], f=foes("minion")[0]; for(const x of S.pieces) if(x.alive&&x!==k&&x!==f&&((x.r===6&&x.c===3)||(x.r===5&&x.c===3))) x.r=7;
    k.r=6; k.c=3; f.r=5; f.c=3; f.revealed=true; S.eco.bag[0]=[Object.assign({},foes("minion")[1],{uid:"bagx",owner:0})]; return initBattle(k,f)!==false; })()`,
    `(async()=>{ for(let i=0;i<80&&(document.getElementById("overlay").classList.contains("hidden")||FX.cur||FX.q.length);i++) await new Promise(r=>setTimeout(r,100)); return document.getElementById("overlayBox").textContent.replace(/\s+/g," ").slice(0,40); })()`]},
  B03:{steps:[PVE("S03"),`(()=>{ ${MINE} const a=mine("minion")[0], d=foes("minion")[0]; a.spd=99; startRounds(a,d,a,d); return !!S.battle; })()`,BATTLE_IDLE]},
  S05:{steps:[PVE("S03"),`(()=>{ S.turnCount=20; S=ecoShopOpenState(S,0); render(); shopShow(); return S.phase; })()`],wait:600},
  B08:{steps:[PVE("S03"),`(()=>{ const u=S.eco.bag[0][0]||Object.assign({},S.pieces.find(x=>x.owner===1&&x.type==="minion"),{uid:"b08"}); while(S.eco.bag[0].length<3) S.eco.bag[0].push(Object.assign({},u,{uid:"b"+S.eco.bag[0].length}));
    S.eco.bagPick={owner:0,unit:Object.assign({},u,{uid:"new"}),token:"new"}; S.phase="bagPick"; render(); bagPickShow(); return !document.getElementById("overlay").classList.contains("hidden"); })()`]},
  S04:{steps:[PVE("S03"),`(()=>{ gameOver(0,"king"); return S.phase; })()`,`(async()=>{ for(let i=0;i<60&&(FX.cur||FX.q.length);i++) await new Promise(r=>setTimeout(r,100)); render(); return document.getElementById("app").getAttribute("data-screen"); })()`]},
  EMO:{steps:[PVE("S03"),`(()=>{ NET.publicMode=true; NET.mode=true; NET.me=0; NET.roomId=335; NET.roomState="IN_PROGRESS"; document.body.classList.add("emoteOn"); render(); try{ emoteToggle(); }catch(e){} try{ emoteShow(false,"hi"); }catch(e){} return !document.getElementById("emoteLayer").classList.contains("hidden"); })()`]},
  X01:{steps:[PVE("S03"),`(()=>{ NET.publicMode=true; NET.mode=true; NET.me=0; NET.roomState="IN_PROGRESS"; NET.pause=[{seat:1,graceLeftMs:42000,at:Date.now()}]; render(); return !document.getElementById("netResumeBar").classList.contains("hidden"); })()`]},
  X01p:{steps:[PVE("S02"),`(()=>{ NET.publicMode=true; NET.mode=true; NET.me=0; NET.roomState="SETUP"; NET.pause=[{seat:1,graceLeftMs:42000,at:Date.now()}]; render(); return !document.getElementById("netResumeBar").classList.contains("hidden"); })()`]},
  X03:{steps:[PVE("S03"),`(()=>{ NET.publicMode=true; NET.mode=true; NET.me=0; NET.roomState="IN_PROGRESS"; NET.resuming=true; NET.resumeAttempts=2; render(); return !document.getElementById("netResumeBar").classList.contains("hidden"); })()`]},
  TUT:{steps:[`(()=>{ tutOpen(); return TUT.open; })()`]},
};
const ONLY=opt("--states",null); const STATE_IDS=Object.keys(STATES).filter(k=>!ONLY||ONLY.split(",").includes(k));

const HOSTS=["html","body","#app","#screenBody","#left","#right","#overlay","#overlayBox","#boardWrap","#netResumeBar","#tutOverlay","#fxBanner"];
const MEASURE=`(()=>{ const q=s=>document.querySelector(s), cs=e=>getComputedStyle(e);
  const host={}; for(const s of ${JSON.stringify(HOSTS)}){ const e=q(s); if(!e) continue; const c=cs(e); host[s]=[c.transform,c.filter,c.contain,c.isolation,c.backdropFilter,c.opacity,c.clipPath,c.maskImage,c.willChange].join("|"); }
  const b=q("#board"), r=b&&b.getBoundingClientRect(), app=q("#app");
  const vis=e=>{ const x=e.getBoundingClientRect(); return x.width>0&&x.height>0&&cs(e).visibility!=="hidden"; };
  const imgs=[...document.images].filter(vis), broken=imgs.filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute("src"));
  const sprites=[...document.querySelectorAll(".bsprite")].filter(vis).map(i=>[i.naturalWidth,i.naturalHeight]);
  const icons=[...document.querySelectorAll("#board .pc img.icon")].filter(vis).map(i=>i.naturalWidth);
  const tb=q("#tutBox"), tcs=tb&&!q("#tutOverlay").classList.contains("hidden")?(()=>{ const c=cs(tb), r=tb.getBoundingClientRect(); return [c.backgroundColor,c.color,c.borderColor,c.fontSize,c.padding,Math.round(r.width),Math.round(r.height)].join("|")
    +"#"+[...tb.querySelectorAll("button,.tut-card,.tut-pill,.tut-lbl")].map(e=>{ const k=cs(e), x=e.getBoundingClientRect(); return [k.backgroundColor,k.color,k.borderTopColor,k.outlineStyle,k.boxShadow,Math.round(x.width),Math.round(x.height)].join(","); }).join(";"); })():null;
  return {screen:app.getAttribute("data-screen"),overflowX:document.documentElement.scrollWidth-innerWidth,host,
    board:b&&vis(b)?{cells:b.querySelectorAll(".cell").length,rect:[r.left,r.top,r.width,r.height].map(Math.round),bs:cs(b).getPropertyValue("--bs")||cs(q("#app")).getPropertyValue("--bs")}:null,
    broken,sprites,icons,tut:tcs,overlay:!q("#overlay").classList.contains("hidden"),inert:["app","overlay","emoteLayer"].filter(id=>{ const e=q("#"+id); return e&&e.hasAttribute("inert"); }),
    focus:document.activeElement?(document.activeElement.id||document.activeElement.tagName):null}; })()`;

(async()=>{
  const srv=await serve(), BASE=`http://127.0.0.1:${srv.address().port}`;
  console.log("RESOURCE 정적 서버 "+BASE+" (demo/ 읽기 전용, 이 프로세스 소유)");
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i335cdp-"));
  const proc=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu",
    "--hide-scrollbars","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
  console.log("RESOURCE Chrome pid "+proc.pid+" · 임시 프로필 "+udd);
  try{
    const wsUrl=await new Promise((res,rej)=>{ let err=""; const t=setTimeout(()=>rej(new Error("DevTools 포트 대기 초과\n"+err)),20000);
      proc.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res(m[1]); } }); });
    const ws=new WebSocket(wsUrl); await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=rej; });
    let id=0; const pend=new Map();
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data); const p=pend.get(m.id); if(p){ pend.delete(m.id); m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result); } };
    const send=(method,params,sid)=>new Promise((res,rej)=>{ const i=++id; pend.set(i,{res,rej}); ws.send(JSON.stringify({id:i,method,params:params||{},sessionId:sid})); });
    if(SHOTS) fs.mkdirSync(OUT,{recursive:true});

    const page=async(vp,url,media)=>{
      const {targetId}=await send("Target.createTarget",{url:"about:blank"}), {sessionId:sid}=await send("Target.attachToTarget",{targetId,flatten:true});
      await send("Page.enable",{},sid); await send("Runtime.enable",{},sid); await send("Emulation.setFocusEmulationEnabled",{enabled:true},sid);
      await send("Emulation.setDeviceMetricsOverride",{width:vp.w,height:vp.h,deviceScaleFactor:vp.w<600?2:1,mobile:vp.w<600},sid);
      if(media) await send("Emulation.setEmulatedMedia",{features:media},sid);
      await send("Page.addScriptToEvaluateOnNewDocument",{source:PRELUDE},sid);
      await send("Page.navigate",{url},sid); await sleep(1300);
      const ev=async expr=>{ const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid);
        if(r.exceptionDetails) throw new Error("page error: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+"\nEXPR: "+expr.slice(0,160)); return r.result.value; };
      const shot=async(name,clip)=>{ if(!SHOTS) return null; const {data}=await send("Page.captureScreenshot",Object.assign({format:"png"},clip?{clip:Object.assign({scale:1},clip)}:{}),sid);
        const f=path.join(OUT,name); fs.writeFileSync(f,Buffer.from(data,"base64")); return f.replace(/\\/g,"/"); };
      const click=async(x,y)=>{ for(const type of ["mousePressed","mouseReleased"]) await send("Input.dispatchMouseEvent",{type,x,y,button:"left",clickCount:1},sid); await sleep(120); };
      const key=async(k,code,vk,shift)=>{ for(const type of ["rawKeyDown","keyUp"]) await send("Input.dispatchKeyEvent",{type,key:k,code,windowsVirtualKeyCode:vk,modifiers:shift?8:0},sid); await sleep(80); };
      const close=()=>send("Target.closeTarget",{targetId});
      return {ev,shot,click,key,close,sid};
    };
    const skin=on=>`(()=>{ const h=document.documentElement; ${on?`h.setAttribute("data-ui-skin","argon")`:`h.removeAttribute("data-ui-skin")`}; try{ fitBoard&&fitBoard(); }catch(e){} return h.getAttribute("data-ui-skin"); })()`;

    /* ===== 1. 상태 매트릭스 ===== */
    for(const vp of VPS) for(const st of STATE_IDS){
      const P=await page(vp,BASE+"/index.html"), tag=`${st}-${vp.tag}`;
      try{
        const staged=[]; for(const s of STATES[st].steps){ staged.push(await P.ev(s)); await sleep(150); }
        await sleep(STATES[st].wait||350);
        const on=await P.ev(MEASURE), fOn=await P.shot(`${tag}-on.png`);
        await P.ev(skin(false)); await sleep(200);
        const off=await P.ev(MEASURE), fOff=await P.shot(`${tag}-off.png`);
        await P.ev(skin(true)); await sleep(120);
        report.states[tag]={staged,on,off,shots:[fOn,fOff].filter(Boolean)};
        ok(on.overflowX<=0,`[${tag}] 가로 넘침 없음 (scrollWidth-innerWidth=${on.overflowX})`);
        const added=Object.keys(on.host).filter(k=>on.host[k]!==off.host[k]);
        ok(!added.length,`[${tag}] 지정 호스트 스태킹/컨테이닝 속성 ON=OFF${added.length?" — 차이: "+added.map(k=>k+" "+on.host[k]).join(" ; "):""}`);
        /* 보드 기하(fitBoard 의 --bs · 너비 · 높이)는 스킨과 무관해야 한다. 위치(top)는 위에 놓인 카드의 테두리 두께만큼 움직일 수 있어 비교하지 않는다(결과 화면) */
        if(on.board&&off.board) ok(on.board.cells===91&&on.board.rect[2]===off.board.rect[2]&&on.board.rect[3]===off.board.rect[3]&&on.board.bs===off.board.bs,`[${tag}] 보드 91칸 · 크기·--bs ON=OFF ${JSON.stringify(on.board.rect)} / ${JSON.stringify(off.board.rect)} · bs ${on.board.bs}`);
        ok(!on.broken.length,`[${tag}] 깨진 이미지 0 ${on.broken.slice(0,3).join(",")}`);
        if(on.sprites.length) ok(on.sprites.every(s=>s[0]>=128&&s[1]>=128),`[${tag}] 전투 도트 실제 로드 ${JSON.stringify(on.sprites)}`);
        if(st==="TUT") ok(!!on.tut&&on.tut===off.tut,`[${tag}] 튜토리얼 상자 계산 스타일·크기 ON=OFF (${on.tut})`);
        if(st==="X01"||st==="X03"||st==="X01p") ok(on.inert.length===3&&on.focus==="xTitle",`[${tag}] 아래 층 inert(${on.inert.join(",")}) · 초점 #xTitle (${on.focus})`);
        if(st==="X01"||st==="X01p"){ for(let i=0;i<3;i++) await P.key("Tab","Tab",9);
          const f=await P.ev(`(()=>{ const a=document.activeElement; return {in:document.getElementById("netResumeBar").contains(a)||a===document.body,id:a.id||a.tagName,txt:(a.textContent||"").replace(/\s+/g," ").slice(0,20)}; })()`);
          ok(f.in,`[${tag}] Tab 3번 뒤 초점이 inert 층으로 새지 않는다 (${f.id} ${f.txt})`); }
      } catch(e){ ok(false,`[${tag}] 상태 세우기 실패 — ${e.message.split("\n")[0]}`); }
      await P.close();
    }

    /* ===== 2. Esc = 취소 (확인 창) ===== */
    for(const vp of VPS.slice(0,1).concat(VPS.slice(-1))){
      const P=await page(vp,BASE+"/index.html"), tag=`ESC-${vp.tag}`;
      try{
        await P.ev(PVE("S03")); for(let i=0;i<40&&await P.ev(`fxLocked()`);i++) await sleep(150);
        await P.ev(`uiBack()`); await sleep(250);
        const before=await P.ev(`(()=>({open:!document.getElementById("overlay").classList.contains("hidden"),btns:[...document.querySelectorAll("#obBtns button")].map(b=>b.textContent)}))()`);
        await P.shot(`${tag}-confirm.png`);
        await P.key("Escape","Escape",27); await sleep(200);
        const after=await P.ev(`(()=>({open:!document.getElementById("overlay").classList.contains("hidden"),phase:S.phase}))()`);
        ok(before.open&&before.btns.includes("취소")&&!after.open&&after.phase==="play",`[${tag}] 기권 확인 창 Esc = [취소] (창 닫힘 · 경기 유지) ${JSON.stringify(before.btns)}`);
      } catch(e){ ok(false,`[${tag}] ${e.message.split("\n")[0]}`); }
      await P.close();
    }

    /* ===== 3. 전설 3종 시트 — 실제 클릭 · 프레임 · 배치 · 폴백 ===== */
    if(FXRUN) for(const vp of VPS){
      for(const [leg,id] of [["dragon","L-DRAGON-4"],["witch","L-WITCH-4"],["reaper","L-REAPER-4"]]){
        for(const mode of ["live","fallback","reduce"]){
          if(mode!=="live"&&!(vp.tag==="390x844"||vp.tag==="1280x800")) continue;
          const tag=`FX-${leg}-${mode}-${vp.tag}`;
          const P=await page(vp,BASE+(mode==="fallback"?"/__block/fx/index.html":"/index.html"),mode==="reduce"?[{name:"prefers-reduced-motion",value:"reduce"}]:null);
          try{
            await P.ev(PVE("S03"));
            await P.ev(`(()=>{ ${MINE} const a=mine("minion")[0], d=foes("minion")[0]; applyLegend(a,"${leg}"); a.spd=99; startRounds(a,d,a,d); const B=S.battle; B.fd.dodge=0; B.fd.evadeDown=0;
              ${leg==="reaper"?`B.round=4; B.fa.hp=1;`:""} return true; })()`);
            /* 개시 카운트다운(countStep ×4)이 끝나고 남은 전투 메시지가 재생될 때까지 — 끝나야 명령 버튼이 열린다 */
            for(let i=0;i<120&&await P.ev(`(()=>{ if(!FX.cur&&!FX.q.length&&!MSGPLAYING&&S.battle.msgQ.length) battleModal(); return fxLocked()||S.battle.msgQ.length>0; })()`);i++) await sleep(150);
            await P.ev(`battleModal()`); await sleep(150);
            const fightBtn=await P.ev(`(()=>{ const b=[...document.querySelectorAll("#bmenu button")].find(x=>/싸우기/.test(x.textContent)); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
            await P.click(fightBtn.x,fightBtn.y); await sleep(200);
            const skBtn=await P.ev(`(()=>{ const nm=SKILLS["${id}"].ko; const b=[...document.querySelectorAll("#bsub-fight button")].find(x=>x.textContent.includes(nm)&&!x.disabled); if(!b) return null; b.scrollIntoView({block:"center"}); const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
            ok(!!skBtn,`[${tag}] 실제 4번 기술 버튼이 보이고 누를 수 있다`);
            if(!skBtn) { await P.close(); continue; }
            await P.ev(`window.__skLog=[]; window.__hit={shake:0,float:0}; new MutationObserver(ms=>{ for(const m of ms){ if(m.type==="attributes"&&m.target.classList.contains("shake")) window.__hit.shake++;
              for(const n of m.addedNodes){ if(!n.classList) continue; if(n.classList.contains("skfx")&&!n.hasAttribute("data-audit")) window.__skLog.push({t:performance.now(),side:n.parentNode.id,cls:n.className}); if(n.classList.contains("dmgfloat")) window.__hit.float++; } } })
              .observe(document.getElementById("overlayBox"),{subtree:true,childList:true,attributes:true,attributeFilter:["class"]}); window.__t0=performance.now(); true`);
            await P.click(skBtn.x,skBtn.y);
            /* 시전 그룹(skillFx 1200ms) 동안은 시트가 없다 → 피해 그룹 시작에 나타난다 */
            /* 시트가 뜨면 같은 노드의 복제본(data-audit)을 같은 토큰에 붙여 멈춘 채 프레임을 잰다 — 원본은 제품 640ms 타이머가 그대로 지운다 */
            let el=null; for(let i=0;i<60&&!el;i++){ await sleep(50); el=await P.ev(`(()=>{ const e=document.querySelector(".skfx:not([data-audit])"); if(!e) return null;
              const c=e.cloneNode(true); c.setAttribute("data-audit","1"); e.parentNode.insertBefore(c,e.nextSibling); c.getAnimations()[0].pause(); return {cls:e.className,parent:e.parentNode.id}; })()`); }
            const log=await P.ev(`window.__skLog`);
            if(mode!=="live"){
              const after=await P.ev(`(()=>Object.assign({sheet:!!document.querySelector(".skfx")},window.__hit))()`);
              ok(!el&&!log.length&&after.shake>0&&after.float>0,`[${tag}] ${mode==="fallback"?"시트 404(미로드)":"움직임 줄이기"} — 시트 없음 · 흔들림·피해 숫자는 그대로 ${JSON.stringify(after)}`);
              let free=false; for(let i=0;i<60&&!free;i++){ free=!(await P.ev(`fxLocked()`)); if(!free) await sleep(100); }
              ok(free,`[${tag}] 연출이 끝나면 잠금이 풀린다 (교착 없음)`);
              await P.shot(`${tag}.png`); await P.close(); continue;
            }
            ok(!!el&&el.parent==="tok-D"&&el.cls.includes("skfx-"+leg),`[${tag}] 표적(fx.shake=D) 토큰 안 시트 ${JSON.stringify(el)}`);
            if(!el){ await P.close(); continue; }
            const frames=await P.ev(`(()=>{ const e=document.querySelector(".skfx[data-audit]"), a=e.getAnimations()[0], out=[];
              for(const t of [0,40,79,80,120,200,280,360,440,520,559,560,600,639]){ a.currentTime=t; out.push([t,getComputedStyle(e).backgroundPositionX]); }
              a.currentTime=640; out.push([640,getComputedStyle(e).backgroundPositionX]); a.currentTime=280; return {out,dur:a.effect.getTiming().duration,iter:a.effect.getTiming().iterations,rep:getComputedStyle(e).backgroundRepeat}; })()`);
            const want=t=>t>=640?-768:-96*Math.floor(t/80);
            ok(frames.dur===640&&frames.iter===1&&/no-repeat/.test(frames.rep)&&frames.out.every(([t,x])=>parseFloat(x)===want(t)),`[${tag}] 8×80ms 1회 · 프레임 선택 정확(79→F1·80→F2·639→F8·끝 -768 투명) ${JSON.stringify(frames.out)}`);
            const geo=await P.ev(`(()=>{ const e=document.querySelector(".skfx[data-audit]"), t=e.parentNode, s=t.querySelector(".bsprite")||t, er=e.getBoundingClientRect(), sr=s.getBoundingClientRect();
              const slot=document.querySelector(".bslot.slot-op")||document.querySelector(".bslot"), zs=getComputedStyle(slot).zIndex, zt=getComputedStyle(t).zIndex;
              const fl=t.querySelector(".dmgfloat"); return {dx:Math.round(er.left+er.width/2-(sr.left+sr.width/2)),dy:Math.round(er.top+er.height/2-(sr.top+sr.height/2)),w:er.width,h:er.height,zSlot:+zs,zTok:+zt,
                floatAfter:!!fl&&(e.compareDocumentPosition(fl)&Node.DOCUMENT_POSITION_FOLLOWING)>0,pe:getComputedStyle(e).pointerEvents}; })()`);
            ok(Math.abs(geo.dx)<=1&&Math.abs(geo.dy)<=1&&geo.w===96&&geo.h===96&&geo.zTok<geo.zSlot&&geo.pe==="none",`[${tag}] 몸통 중심(0.5,0.5) · 96px · 토큰 층(z${geo.zTok}) < 정보판(z${geo.zSlot}) · 입력 통과 ${JSON.stringify(geo)}`);
            const tk=await P.ev(`(()=>{ const r=document.querySelector(".skfx[data-audit]").parentNode.getBoundingClientRect(); return {x:Math.max(0,r.left-24),y:Math.max(0,r.top-24),width:Math.min(innerWidth,r.width+48),height:r.height+48}; })()`);
            for(let k=0;k<8;k++){ await P.ev(`(()=>{ const a=document.querySelector(".skfx[data-audit]").getAnimations()[0]; a.currentTime=${k*80+40}; return true; })()`); await P.shot(`${tag}-F${k+1}.png`,tk); }
            await P.ev(`(()=>{ document.querySelector(".skfx[data-audit]").getAnimations()[0].currentTime=280; return true; })()`); await P.shot(`${tag}-battle-F4.png`,null); // F4 = 정점 프레임 (sidecar visualPeakFrame 3, 0부터)
            await P.ev(`(()=>{ const c=document.querySelector(".skfx[data-audit]"); c.parentNode.removeChild(c); return true; })()`);
            let gone=false; for(let i=0;i<30&&!gone;i++){ gone=await P.ev(`!document.querySelector(".skfx")`); if(!gone) await sleep(50); }
            const life=await P.ev(`(()=>{ const l=window.__skLog[0]; return l?Math.round(performance.now()-l.t):null; })()`);
            ok(gone,`[${tag}] 원본 시트는 제품 타이머로 스스로 사라진다 (생성 뒤 ${life}ms 시점 확인)`);
            const lk=log[0]; report.fx[tag]={el,frames,geo,log,cast:lk?Math.round(lk.t-(await P.ev(`window.__t0`))):null};
            ok(lk&&report.fx[tag].cast>=1000,`[${tag}] 시트는 시전 그룹(1200ms) 뒤 피해 그룹 시작에 뜬다 (클릭 후 ${report.fx[tag].cast}ms)`);
            /* 세대 취소 — 재생 중 새 게임 */
            if(vp.tag==="390x844"&&leg==="dragon"){
              await P.ev(`skillSheetFx("L-DRAGON-4","D")`); const had=await P.ev(`!!document.querySelector(".skfx")`);
              await P.ev(`fxReleaseAll()`); ok(had&&await P.ev(`!document.querySelector(".skfx")`),`[${tag}] 세대 취소(fxReleaseAll) 시 재생 중인 시트 즉시 제거`);
            }
          } catch(e){ ok(false,`[${tag}] ${e.message.split("\n")[0]}`); }
          await P.close();
        }
      }
    }
    ws.close();
  } finally {
    proc.kill(); srv.close(); await sleep(400);
    try{ fs.rmSync(udd,{recursive:true,force:true}); console.log("CLEANUP Chrome 종료 · 임시 프로필 삭제 "+udd+" · 정적 서버 닫음"); }catch(e){ console.log("LEFTOVER "+udd+" "+e.message); }
  }
  report.pass=pass; report.fail=fail; report.finishedAt=new Date().toISOString();
  if(SHOTS){ fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(report,null,1)); console.log("REPORT "+path.join(OUT,"report.json").replace(/\\/g,"/")); }
  console.log(`=== issue335_cdp: pass ${pass} / fail ${fail} ===`); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
