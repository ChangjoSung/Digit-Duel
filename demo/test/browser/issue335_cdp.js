/* #335 Argon 스킨 · 33종 4번 대표기 시트 — 실제 브라우저 상태 매트릭스 (Mars 소유, demo/test/browser)
   사용: node demo/test/browser/issue335_cdp.js [--out <dir>] [--vp 390x844,1280x800] [--states T01,S03] [--no-shots] [--no-fx] [--fx M-F1-4,L-DRAGON-4] [--fx-vp 390x844,1280x800] [--ref <v1 demo 폴더>] [--chrome <chrome.exe>] [--focus]
   --focus = 남은 공백만 재는 짧은 실행: 320x640 · S02,B03,TUT,X01,X01p,X03 (보호 개수·도달성·z70) + 온라인 소비자(netFxApplyMsgFx) + 스킨 OFF 640ms(M-F1-4·L-DRAGON-4).
     Esc·전체 33종·폴백/움직임 줄이기/무효/세대 음성은 돌리지 않는다(종전 실행 증거 재사용). 각 쪽의 CDP 비동기 예외·로드 실패·4xx/5xx 를 센다(/api 503 계약 제외).
   기본 출력: os.tmpdir()/digitduel-issue335-evidence — 저장소 밖. --no-shots 면 이미지 0건(report.json 만 남는다).

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
const SHOTS=!args.includes("--no-shots"), FXRUN=!args.includes("--no-fx"), FOCUS=args.includes("--focus");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const VPS=opt("--vp",FOCUS?"320x640":"320x640,360x640,390x844,430x932,1280x800,1920x1080").split(",").map(s=>{ const [w,h]=s.split("x").map(Number); return {w,h,tag:s}; });
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0; const report={startedAt:new Date().toISOString(),viewports:VPS.map(v=>v.tag),states:{},fx:{},fails:[]};
const ok=(c,n)=>{ if(c){pass++; console.log("PASS "+n);} else {fail++; report.fails.push(n); console.error("FAIL "+n);} };

/* ===== 정적 서버 (demo/ 읽기 전용) — --ref <demo 폴더> 를 주면 같은 방식으로 그 기준판(v1)도 따로 서빙한다 ===== */
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".webp":"image/webp",".json":"application/json"};
const REF=opt("--ref",null)?path.resolve(opt("--ref")):null;
function serve(DEMO){
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
/* Math.random 을 고정 시드로 — 같은 상태를 v1(--ref)·v2 양쪽에서 똑같이 세우기 위해서다 (게임 rand() 는 시드가 없으면 Math.random 을 쓴다) */
const PRELUDE=`(()=>{ let s=335>>>0; Math.random=()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  window.__ddWS=[];
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
/* 33종 4번 대표기 — 목록은 data.js 에서(tools/client/fx_sheet_audit.expectedKeys), 표적 분류는 smoke_issue335 A22·A23 이 데이터와 대조한 8·7 집합 */
const SELF8=["M-W3-4","M-W6-4","M-L3-4","M-E3-4","M-E5-4","M-E6-4","M-G3-4","M-G6-4"], OPP7=["M-F5-4","M-W4-4","M-W5-4","M-L5-4","M-E4-4","M-G4-4","M-G5-4"];
const FX_CASES=require(path.join(DEMO,"..","tools","client","fx_sheet_audit.js")).expectedKeys().map(({id,key})=>({id,key,legend:/^L-/.test(id)?key:null,
  cls:SELF8.includes(id)?"자기":OPP7.includes(id)?"상대 비피해":"피해",want:SELF8.includes(id)?"A":"D",dmg:!SELF8.includes(id)&&!OPP7.includes(id)}));
const ONLY=opt("--states",FOCUS?"S02,B03,TUT,X01,X01p,X03":null); const STATE_IDS=Object.keys(STATES).filter(k=>!ONLY||ONLY.split(",").includes(k));

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

/* 같은 상태의 기하 — 주요 층 · 보이는 버튼(문서 순서) 사각형. v1(--ref) 과 v2 를 1px 안에서 대조한다 (스킨 장식이 아니라 배치가 같은지) */
const GEO_IDS=["appBar","screenBody","left","boardWrap","board","boardInfo","right","actionDock","turnBar","overlayBox","bstage","msgBox","bmenu","tok-A","tok-D","netResumeBar","titleScreen","acctPanel","tutBox","emoteBtn","fxBanner"];
const GEO=`(()=>{ const vis=e=>{ const r=e.getBoundingClientRect(); return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=="hidden"; }, R=e=>{ const r=e.getBoundingClientRect(); return [r.left,r.top,r.width,r.height].map(v=>Math.round(v)); };
  const ids={}; for(const id of ${JSON.stringify(GEO_IDS)}){ const e=document.getElementById(id); if(e&&vis(e)) ids[id]=R(e); }
  const btns=[...document.querySelectorAll("button")].filter(vis).map(b=>[(b.id||b.textContent.replace(/\\s+/g," ").trim()).slice(0,18),...R(b)]);
  const cells=[...document.querySelectorAll("#board .cell")].filter(vis); return {ids,btns,cell0:cells[0]?R(cells[0]):null,cellN:cells.length}; })()`;
const geoDiff=(a,b)=>{ const d=[]; const near=(x,y)=>x.every((v,i)=>Math.abs(v-y[i])<=1);
  for(const k of new Set(Object.keys(a.ids).concat(Object.keys(b.ids)))){ if(!a.ids[k]||!b.ids[k]) d.push(k+":"+(a.ids[k]?"v2만":"v1만")); else if(!near(a.ids[k],b.ids[k])) d.push(k+" "+JSON.stringify(b.ids[k])+"→"+JSON.stringify(a.ids[k])); }
  if(a.btns.length!==b.btns.length) d.push(`버튼 수 ${b.btns.length}→${a.btns.length}`);
  else a.btns.forEach((x,i)=>{ if(!near(x.slice(1),b.btns[i].slice(1))) d.push(`버튼[${x[0]}] ${JSON.stringify(b.btns[i].slice(1))}→${JSON.stringify(x.slice(1))}`); });
  if(a.cellN!==b.cellN||(a.cell0&&b.cell0&&!near(a.cell0,b.cell0))) d.push(`보드 칸 ${b.cellN}${JSON.stringify(b.cell0)}→${a.cellN}${JSON.stringify(a.cell0)}`);
  return d; };
/* Argon 표시 훅 — 훅이 붙은 이모지는 Argon 에서 글자 숨김 + 아이콘 칸, 스킨 OFF 는 글자. 버튼 글자(textContent)는 양쪽 같다 */
const HOOKS=`(()=>{ return [...document.querySelectorAll(".gi.emo")].filter(e=>e.getBoundingClientRect().width>0).map(e=>{ const c=getComputedStyle(e), b=e.closest("button");
  const r=e.getBoundingClientRect(), rg=document.createRange(); rg.selectNodeContents(e); const gr=rg.getBoundingClientRect(); // 글자 상자가 아이콘 상자 밖(잘림)이면 글자는 안 보인다
  return {emi:e.classList.contains("emi"),i:e.style.getPropertyValue("--i"),fs:c.fontSize,w:r.width,bg:/argon\\/icons\\/ui-icons/.test(c.backgroundImage),bgx:c.backgroundPositionX,
    glyphOut:c.overflow==="hidden"&&gr.left>=r.right-0.5,hidden:e.getAttribute("aria-hidden"),labelled:!!(b&&b.getAttribute("aria-label")),btn:b?b.textContent.replace(/\\s+/g," ").trim():null,ch:e.textContent}; }); })()`;
/* #335 남은 공백 — 보호 개수 · 도달성 (상태 매트릭스 안에서 해당 상태만) */
/* S02 트레이 = 14 고정 칸(trayHtml · 놓은 칸은 .placed 비활성) — 칸 수 · 놓은/남은 칸 · 머리 배지가 Core 말 상태와 같은지 */
const S02N=`(()=>{ const own=S.pieces.filter(x=>x.owner===0), un=own.filter(x=>!x.placed).length, it=[...document.querySelectorAll('.prepStep[data-step="place"] .trayItem')];
  return {own:own.length,un,placed:own.length-un,tray:it.length,trayPlaced:it.filter(e=>e.classList.contains("placed")).length,trayLeft:it.filter(e=>!e.classList.contains("placed")).length,
    badge:((document.querySelector('.prepStep[data-step="place"] .secHead .badge')||{}).textContent||"").trim()}; })()`;
const B03N=`[...document.querySelectorAll("#bstage .bslot")].map(s=>{ const li=[...s.querySelectorAll(".bStats > li")]; return {n:li.length,vis:li.filter(e=>e.getBoundingClientRect().width>0).length,txt:li.filter(e=>e.textContent.trim()).length}; })`;
const TUTN=`(async()=>{ const n=TUT_STEPS.length, out=[]; for(let i=0;i<n;i++){ tutGo(i); await new Promise(r=>setTimeout(r,60));
  const b=document.getElementById("tutBox").getBoundingClientRect(), dots=[...document.querySelectorAll("#tutOverlay .tut-dots span")];
  out.push({dots:dots.length,on:dots.findIndex(d=>d.classList.contains("on")),inV:b.left>=0&&b.right<=innerWidth+0.5,ox:document.documentElement.scrollWidth-innerWidth}); } tutGo(0); return {n,out}; })()`;
const REACH=sel=>`(()=>{ const e=${sel}; if(!e) return null; const dis=!!e.disabled, how=!dis&&e.tabIndex>=0?"focus":"scrollIntoView";
  if(how==="focus") e.focus(); else e.scrollIntoView({block:"nearest"}); const r=e.getBoundingClientRect(), c=getComputedStyle(e), h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return {txt:(e.getAttribute("aria-label")||e.textContent||"").replace(/\\s+/g," ").trim().slice(0,20),how,dis,tab:e.tabIndex,focused:document.activeElement===e,r:[r.left,r.top,r.right,r.bottom].map(Math.round),
    inV:r.top>=0&&r.left>=0&&r.bottom<=innerHeight+0.5&&r.right<=innerWidth+0.5,hit:!!h&&(h===e||e.contains(h)),fs:parseFloat(c.fontSize),clip:e.scrollWidth>e.clientWidth+1,
    x:r.left+r.width/2,y:r.top+r.height/2,id:((e.getAttribute("onclick")||"").match(/selTray\\((.+)\\)/)||[])[1]||null}; })()`;

(async()=>{
  const srv=await serve(DEMO), BASE=`http://127.0.0.1:${srv.address().port}`;
  console.log("RESOURCE 정적 서버 "+BASE+" (demo/ 읽기 전용, 이 프로세스 소유)");
  const rsrv=REF?await serve(REF):null, RBASE=rsrv?`http://127.0.0.1:${rsrv.address().port}`:null;
  if(rsrv) console.log("RESOURCE 기준판 정적 서버 "+RBASE+" ("+REF+" 읽기 전용)");
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i335cdp-"));
  const proc=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu",
    "--hide-scrollbars","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
  console.log("RESOURCE Chrome pid "+proc.pid+" · 임시 프로필 "+udd);
  try{
    const wsUrl=await new Promise((res,rej)=>{ let err=""; const t=setTimeout(()=>rej(new Error("DevTools 포트 대기 초과\n"+err)),20000);
      proc.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res(m[1]); } }); });
    const ws=new WebSocket(wsUrl); await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=rej; });
    let id=0; const pend=new Map();
    const diag=new Map(); // sessionId → 비동기 예외 · 로드 실패 · 4xx/5xx (Runtime.evaluate 의 예외는 ev() 가 따로 던진다)
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data), d=m.sessionId&&diag.get(m.sessionId);
      if(d&&m.method==="Runtime.exceptionThrown") d.push("exception "+((m.params.exceptionDetails.exception||{}).description||m.params.exceptionDetails.text).split("\n")[0]);
      if(d&&m.method==="Network.requestWillBeSent") d.urls[m.params.requestId]=m.params.request.url;
      if(d&&m.method==="Network.loadingFailed"){ if(m.params.canceled) d.canceled++; else d.push("loadingFailed "+m.params.errorText+" "+(d.urls[m.params.requestId]||"")); }
      if(d&&m.method==="Network.responseReceived"&&m.params.response.status>=400){ const u=m.params.response.url;
        if(!/\/api\//.test(u)&&!/\/__block\/fx\/assets\/fx\//.test(u)&&!/\/favicon\.ico$/.test(u)) d.push("http "+m.params.response.status+" "+u); } // /api 503 = DB 없는 서버 계약 · /__block 404 = 의도한 미로드 · favicon = 브라우저 자체 요청(문서에 아이콘 링크 없음)
      const p=pend.get(m.id); if(p){ pend.delete(m.id); m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result); } };
    const send=(method,params,sid)=>new Promise((res,rej)=>{ const i=++id; pend.set(i,{res,rej}); ws.send(JSON.stringify({id:i,method,params:params||{},sessionId:sid})); });
    fs.mkdirSync(OUT,{recursive:true}); // report.json 은 --no-shots 여도 남긴다 (이미지만 0건)

    const page=async(vp,url,media,tag)=>{
      const {targetId}=await send("Target.createTarget",{url:"about:blank"}), {sessionId:sid}=await send("Target.attachToTarget",{targetId,flatten:true});
      const errs=Object.assign([],{urls:{},canceled:0}); diag.set(sid,errs);
      await send("Page.enable",{},sid); await send("Runtime.enable",{},sid); await send("Network.enable",{},sid); await send("Emulation.setFocusEmulationEnabled",{enabled:true},sid);
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
      const close=async()=>{ if(tag){ report.diag=report.diag||{}; report.diag[tag]={errs:errs.slice(),canceled:errs.canceled};
          ok(!errs.length,`[${tag}] CDP 측정: 비동기 예외·로드 실패·4xx/5xx 0 (취소 ${errs.canceled}건은 세지 않음)${errs.length?" — "+errs.slice(0,4).join(" ; "):""}`); }
        diag.delete(sid); return send("Target.closeTarget",{targetId}); };
      return {ev,shot,click,key,close,sid};
    };
    const skin=on=>`(()=>{ const h=document.documentElement; ${on?`h.setAttribute("data-ui-skin","argon")`:`h.removeAttribute("data-ui-skin")`}; try{ fitBoard&&fitBoard(); }catch(e){} return h.getAttribute("data-ui-skin"); })()`;

    /* ===== 1. 상태 매트릭스 ===== */
    for(const vp of VPS) for(const st of STATE_IDS){
      const tag=`${st}-${vp.tag}`, P=await page(vp,BASE+"/index.html",null,tag);
      try{
        const staged=[]; for(const s of STATES[st].steps){ staged.push(await P.ev(s)); await sleep(150); }
        await sleep(STATES[st].wait||350);
        const on=await P.ev(MEASURE), fOn=await P.shot(`${tag}-on.png`), geo=await P.ev(GEO), hkOn=await P.ev(HOOKS);
        await P.ev(skin(false)); await sleep(200);
        const off=await P.ev(MEASURE), fOff=await P.shot(`${tag}-off.png`), hkOff=await P.ev(HOOKS);
        await P.ev(skin(true)); await sleep(120);
        report.states[tag]={staged,on,off,geo,hooks:{on:hkOn,off:hkOff},shots:[fOn,fOff].filter(Boolean)};
        const hk=hkOn.filter(h=>h.emi);
        if(hk.length) ok(hk.every(h=>h.glyphOut&&h.bg&&Math.abs(parseFloat(h.bgx)+parseFloat(h.fs)*parseInt(h.i,10))<0.5)&&hkOff.filter(h=>h.emi).every(h=>!h.glyphOut&&!h.bg)
          &&hkOn.filter(h=>h.btn).map(h=>h.btn).join("|")===hkOff.filter(h=>h.btn).map(h=>h.btn).join("|")&&hk.filter(h=>h.btn&&!h.labelled).every(h=>h.hidden===null),
          `[${tag}] 이모지 훅 ${hk.length}개 — Argon: 글자 숨김 + 같은 칸 아이콘 · OFF: 원래 글자 · 버튼 글자 동일 · 이름표 없는 버튼의 훅은 aria-hidden 없음(글자가 접근성 이름) ${JSON.stringify(hk.map(h=>h.ch+h.i))}`);
        const plain=hkOn.filter(h=>!h.emi); if(plain.length) ok(plain.every(h=>!h.glyphOut&&!h.bg),`[${tag}] 훅 없는 .gi.emo(${plain.map(h=>h.ch).join("")})는 Argon 에서도 원래 글자`);
        if(RBASE){ const R=await page(vp,RBASE+"/index.html");
          try{ for(const s of STATES[st].steps){ await R.ev(s); await sleep(150); } await sleep(STATES[st].wait||350);
            const rg=await R.ev(GEO), d=geoDiff(geo,rg); report.states[tag].geoRef=rg; report.states[tag].geoDiff=d;
            ok(!d.length,`[${tag}] 같은 상태 v1(기준판)↔v2 배치 1px 안 동일 (층 ${Object.keys(geo.ids).length} · 버튼 ${geo.btns.length} · 칸 ${geo.cellN})${d.length?" — 차이: "+d.slice(0,6).join(" ; "):""}`);
          } catch(e){ ok(false,`[${tag}] 기준판 상태 세우기 실패 — ${e.message.split("\n")[0]}`); }
          await R.close(); }
        ok(on.overflowX<=0,`[${tag}] 가로 넘침 없음 (scrollWidth-innerWidth=${on.overflowX})`);
        const added=Object.keys(on.host).filter(k=>on.host[k]!==off.host[k]);
        ok(!added.length,`[${tag}] 지정 호스트 스태킹/컨테이닝 속성 ON=OFF${added.length?" — 차이: "+added.map(k=>k+" "+on.host[k]).join(" ; "):""}`);
        /* 보드 기하(fitBoard 의 --bs · 너비 · 높이)는 스킨과 무관해야 한다. 위치(top)는 위에 놓인 카드의 테두리 두께만큼 움직일 수 있어 비교하지 않는다(결과 화면) */
        if(on.board&&off.board) ok(on.board.cells===91&&on.board.rect[2]===off.board.rect[2]&&on.board.rect[3]===off.board.rect[3]&&on.board.bs===off.board.bs,`[${tag}] 보드 91칸 · 크기·--bs ON=OFF ${JSON.stringify(on.board.rect)} / ${JSON.stringify(off.board.rect)} · bs ${on.board.bs}`);
        ok(!on.broken.length,`[${tag}] 깨진 이미지 0 ${on.broken.slice(0,3).join(",")}`);
        if(on.sprites.length) ok(on.sprites.every(s=>s[0]>=128&&s[1]>=128),`[${tag}] 전투 도트 실제 로드 ${JSON.stringify(on.sprites)}`);
        if(st==="TUT") ok(!!on.tut&&on.tut===off.tut,`[${tag}] 튜토리얼 상자 계산 스타일·크기 ON=OFF (${on.tut})`);
        if(st==="X01"||st==="X03"||st==="X01p"){ const z=await P.ev(`(()=>{ const c=getComputedStyle(document.getElementById("netResumeBar")); return c.position+" z"+c.zIndex; })()`);
          ok(on.inert.length===3&&on.focus==="xTitle"&&z==="fixed z70",`[${tag}] 계산 스타일 ${z}(fixed z70) · 아래 층 inert(${on.inert.join(",")}) · 초점 #xTitle (${on.focus})`); }
        if(st==="S02"){ const n=await P.ev(S02N);
          ok(n.own===14&&n.tray===14&&n.trayPlaced===n.placed&&n.trayLeft===n.un&&n.badge===n.placed+"/14",`[${tag}] 내 말 14 = 트레이 14칸 (놓은 ${n.trayPlaced} · 남은 ${n.trayLeft} = Core ${n.placed}/${n.un}) · 배지 '${n.badge}'`); }
        if(st==="B03"){ const n=await P.ev(B03N);
          ok(n.length===2&&n.every(x=>x.n===6&&x.vis===6&&x.txt===6),`[${tag}] 전투원 2명 × HUD 스탯 6칸 (보임·값 글자) ${JSON.stringify(n)}`); }
        if(st==="TUT"){ const t=await P.ev(TUTN), bad=t.out.filter((x,i)=>!(x.dots===10&&x.on===i&&x.inV&&x.ox<=0));
          ok(t.n===10&&!bad.length,`[${tag}] 튜토리얼 10단계 — 단계마다 점 10개 중 현재 1개 · 상자 가로 화면 안 · 넘침 0 ${JSON.stringify(bad)}`); }
        /* 도달성 — 아래쪽 명령·트레이 끝을 초점/스크롤로 화면 안에 들이고, 그 점의 실제 맨 위 요소가 자신인지 · 글자 크기 · 잘림을 본다. 첫 화면 캡처만으로 실패라 하지 않는다 */
        /* S02: 마지막 조작 [전체 회수] 를 실제로 눌러 트레이를 비운 뒤, 트레이 마지막 칸(왕)을 실제로 눌러 선택한다. B03: 아래쪽 명령 [도망가기] */
        if(st==="S02"||st==="B03"){ const T=st==="S02"?[[`[...document.querySelectorAll('.prepStep[data-step="place"] .trayActs button')].pop()`,()=>`S.pieces.filter(x=>x.owner===0).every(x=>!x.placed)`,"전체 회수 → 14칸 모두 남은 말"],
              [`[...document.querySelectorAll('.prepStep[data-step="place"] .trayItem')].pop()`,r=>`!!(S.selected&&S.selected.tray&&JSON.stringify(S.selected.id)===${JSON.stringify(r.id)})`,"트레이 말 선택"]]
            :[[`[...document.querySelectorAll("#bmenu button")].pop()`,()=>`(()=>{ const e=document.getElementById("bsub-flee"); return !!e&&!e.classList.contains("hidden")&&e.getBoundingClientRect().height>0; })()`,"도망가기 확인 단계 열림"]];
          for(const [sel,after,what] of T){ const r=await P.ev(REACH(sel));
            ok(!!r&&!r.dis&&r.inV&&r.hit&&r.fs>=12&&!r.clip&&(r.how!=="focus"||r.focused),`[${tag}] 도달성 '${r&&r.txt}' — ${r&&r.how} 뒤 화면 안 ${JSON.stringify(r&&r.r)} · 그 점의 맨 위 요소 = 자신(${r&&r.hit}) · 글자 ${r&&r.fs}px · 잘림 없음 · 활성(${r&&!r.dis})`);
            if(!r||r.dis) continue; await P.click(r.x,r.y); await sleep(200);
            ok(await P.ev(after(r)),`[${tag}] '${r.txt}' 실제 마우스 클릭이 닿는다 (${what})`); } }
        if(st==="X01"||st==="X01p"){ for(let i=0;i<3;i++) await P.key("Tab","Tab",9);
          const f=await P.ev(`(()=>{ const a=document.activeElement; return {in:document.getElementById("netResumeBar").contains(a)||a===document.body,id:a.id||a.tagName,txt:(a.textContent||"").replace(/\s+/g," ").slice(0,20)}; })()`);
          ok(f.in,`[${tag}] Tab 3번 뒤 초점이 inert 층으로 새지 않는다 (${f.id} ${f.txt})`); }
      } catch(e){ ok(false,`[${tag}] 상태 세우기 실패 — ${e.message.split("\n")[0]}`); }
      await P.close();
    }

    /* ===== 2. Esc = 취소 (확인 창) ===== */
    if(!FOCUS) for(const vp of VPS.slice(0,1).concat(VPS.slice(-1))){
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

    /* ===== 2b. 온라인 소비자 — 실제 Chrome 에서 netFxApplyMsgFx (smoke D 와 같은 준비: 전투 DOM · NET.fxDisp · NET.fxGen · battleId).
       내 자기 대상 행(M-W3-4 → tok-A) + 상대 자기 회복 행(M-E5-4 → tok-D). 시트는 제품 선택 로드(공개 전투 도트)로 실제 받은 것만 — 서버→클라이언트 계약은 서버 테스트 몫 */
    if(FXRUN){ const vp=VPS[0], tag=`NETFX-${vp.tag}`, P=await page(vp,BASE+"/index.html",null,tag);
      try{
        await P.ev(PVE("S03"));
        await P.ev(`(()=>{ ${MINE} const a=mine("minion")[0], d=foes("minion")[0]; applySpecies(a,ROSTER.find(r=>r.id==="M-W3"),4); applySpecies(d,ROSTER.find(r=>r.id==="M-E5"),4); a.spd=99; startRounds(a,d,a,d); return true; })()`);
        await P.ev(BATTLE_IDLE); await P.ev(`battleModal()`);
        for(let i=0;i<40&&!(await P.ev(`SKILL_SHEET_OK.has("water_def")&&SKILL_SHEET_OK.has("land_sustain")`));i++) await sleep(50);
        const r=await P.ev(`(async()=>{ NET.publicMode=true; NET.mode=true; NET.me=0; NET.roomState="IN_PROGRESS"; NET.fxDisp={}; const g=NET.fxGen, fd=S.battle.fd, out={};
          netFxApplyMsgFx(1,{st:{side:"A",text:"🧊"},skill:"M-W3-4"},g);
          netFxApplyMsgFx(1,{float:{side:"D",sign:"pos",amount:0},hp:{side:"D",val:fd.hp,max:fd.maxHp},skill:"M-E5-4"},g);
          const t0=performance.now(), s=sd=>{ const e=document.querySelector("#tok-"+sd+" .skfx"); if(!e) return null; const a=e.getAnimations()[0], c=getComputedStyle(e);
            return {cls:e.className,img:(c.backgroundImage.match(/[a-z_]+_96x8\\.png/)||[c.backgroundImage])[0],dur:a?a.effect.getTiming().duration:null,run:a?a.playState:null}; };
          out.A=s("A"); out.D=s("D"); out.n=document.querySelectorAll(".skfx").length; out.hp=document.getElementById("hptxt-D").textContent===String(fd.hp); out.float=!!document.querySelector("#tok-D .dmgfloat");
          while(document.querySelector(".skfx")&&performance.now()-t0<2000) await new Promise(q=>setTimeout(q,10)); out.gone=Math.round(performance.now()-t0); out.left=document.querySelectorAll(".skfx").length; return out; })()`);
        report.netfx=r;
        ok(r.n===2&&r.A&&/skfx-water_def/.test(r.A.cls)&&r.A.img==="water_def_96x8.png"&&r.D&&/skfx-land_sustain/.test(r.D.cls)&&r.D.img==="land_sustain_96x8.png"&&r.A.dur===640&&r.D.dur===640&&r.A.run==="running"&&r.hp&&r.float,
          `[${tag}] 온라인 행 2개(내 자기 대상 → tok-A · 상대 자기 회복 → tok-D) = 실제 로드된 시트 2장 · 640ms 재생 중 · HP 글자·숫자 같은 행 반영 ${JSON.stringify(r)}`);
        ok(r.left===0&&r.gone>=560&&r.gone<=1100,`[${tag}] 두 시트가 제품 타이머로 스스로 사라진다 (${r.gone}ms · 640ms 예약)`);
      } catch(e){ ok(false,`[${tag}] ${e.message.split("\n")[0]}`); }
      await P.close();
    }

    /* ===== 3. 33종 4번 대표기 시트 — 실제 클릭 · 표적 토큰 · 프레임 · 배치 · 선택 로드 · 폴백 · 음성(무효) 정리 =====
       전설 3종은 6 뷰포트 live + 2 뷰포트 fallback·reduce(종전 그대로), 일반 30종은 --fx-vp(기본 390x844,1280x800) live,
       33종 전부 390x844 에서 '환영 무도로 무효가 된 사용'(시트 0 · 잠금 해제) 음성, fire_std 는 fallback·reduce 도 본다. */
    const FXVP=opt("--fx-vp","390x844,1280x800").split(","), ONLY_FX=opt("--fx",FOCUS?"M-F1-4,L-DRAGON-4":null);
    const FX_LIST=FX_CASES.filter(c=>!ONLY_FX||ONLY_FX.split(",").includes(c.id));
    const runs=[]; for(const vp of VPS) for(const c of FX_LIST){
      const two=vp.tag==="390x844"||vp.tag==="1280x800";
      if(c.legend||FXVP.includes(vp.tag)) runs.push([vp,c,"live"]);
      if((c.legend||c.key==="fire_std")&&two){ runs.push([vp,c,"fallback"]); runs.push([vp,c,"reduce"]); }
      if(vp.tag==="390x844"&&c.id!=="L-REAPER-4") runs.push([vp,c,"nullify"]); // 사신의 낫은 행동 차단을 무시한다(즉사 계약) — 무효 음성 대상 아님
      if((c.legend||c.key==="fire_std")&&vp===VPS[0]) runs.push([vp,c,"skinoff"]); // 스킨 OFF(속성 제거)에서도 실제 클릭 → 제품 소비자 → 640ms 재생
    }
    if(FOCUS) runs.splice(0,runs.length,...runs.filter(r=>r[2]==="skinoff"));
    if(FXRUN) for(const [vp,c,mode] of runs){
          const {id,key,legend,want}=c, tag=`FX-${key}-${mode}-${vp.tag}`, live=mode==="live"||mode==="skinoff";
          const P=await page(vp,BASE+(mode==="fallback"?"/__block/fx/index.html":"/index.html"),mode==="reduce"?[{name:"prefers-reduced-motion",value:"reduce"}]:null,mode==="fallback"?null:tag);
          try{
            await P.ev(PVE("S03")); if(mode==="skinoff") await P.ev(skin(false));
            await P.ev(`(()=>{ ${MINE} const a=mine("minion")[0], d=foes("minion")[0];
              ${legend?`applyLegend(a,"${legend}")`:`applySpecies(a,ROSTER.find(r=>r.id==="${id.slice(0,-2)}"),4)`}; applySpecies(d,ROSTER.find(r=>r.id==="M-G3"),1);
              a.spd=99; startRounds(a,d,a,d); const B=S.battle; B.fd.dodge=0; B.fd.synDodge=0; B.fd.evadeBuff=0; B.fd.evadeDown=0; // 확정 명중 — 시너지 회피(synDodge)까지 0
              ${id==="M-E1-4"?"B.round=2; B.fa.burrowRound=1;":""}${id==="M-E5-4"||id==="L-REAPER-4"?"B.round=4;":""}${id==="L-REAPER-4"?"B.fa.hp=1;":""}${mode==="nullify"?"B.fa.nullifyNext=true;":""} return true; })()`);
            /* 개시 카운트다운(countStep ×4)이 끝나고 남은 전투 메시지가 재생될 때까지 — 끝나야 명령 버튼이 열린다 */
            for(let i=0;i<120&&await P.ev(`(()=>{ if(!FX.cur&&!FX.q.length&&!MSGPLAYING&&S.battle.msgQ.length) battleModal(); return fxLocked()||S.battle.msgQ.length>0; })()`);i++) await sleep(150);
            await P.ev(`battleModal()`); await sleep(150);
            /* 선택 로드: 시트 요청은 고정 3장 + 화면의 두 전투원 도트(공개)뿐이다. live 는 로드가 끝난 뒤 누른다 — 제품은 기다리지 않고 미로드면 생략한다 */
            if(live) for(let i=0;i<40&&!(await P.ev(`SKILL_SHEET_OK.has("${key}")`));i++) await sleep(50);
            const req=await P.ev(`performance.getEntriesByType("resource").map(e=>e.name).filter(n=>/\\/assets\\/fx\\//.test(n)).map(n=>n.replace(/^.*\\/assets\\/fx\\//,""))`);
            const allow=["dragon","witch","reaper",key,"grass_def"].map(k=>k+"_96x8.png"), normal=req.filter(n=>!/^(dragon|witch|reaper)_/.test(n));
            ok(req.every(n=>allow.includes(n))&&new Set(normal).size<=2,`[${tag}] 시트 요청 = 고정 3 + 공개 전투원 도트 ${new Set(normal).size}장 (숨은 말 0) ${JSON.stringify([...new Set(req)])}`);
            const fightBtn=await P.ev(`(()=>{ const b=[...document.querySelectorAll("#bmenu button")].find(x=>/싸우기/.test(x.textContent)); if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
            await P.click(fightBtn.x,fightBtn.y); await sleep(200);
            const skBtn=await P.ev(`(()=>{ const nm=SKILLS["${id}"].ko; const b=[...document.querySelectorAll("#bsub-fight button")].find(x=>x.textContent.includes(nm)&&!x.disabled); if(!b) return null; b.scrollIntoView({block:"center"}); const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
            ok(!!skBtn,`[${tag}] 실제 4번 기술 버튼(${id})이 보이고 누를 수 있다`);
            if(!skBtn) { await P.close(); continue; }
            await P.ev(`window.__skLog=[]; window.__hit={shake:0,float:0}; new MutationObserver(ms=>{ for(const m of ms){ if(m.type==="attributes"&&m.target.classList.contains("shake")) window.__hit.shake++;
              for(const n of m.addedNodes){ if(!n.classList) continue; if(n.classList.contains("skfx")&&!n.hasAttribute("data-audit")) window.__skLog.push({t:performance.now(),side:n.parentNode.id,cls:n.className}); if(n.classList.contains("dmgfloat")) window.__hit.float++; } } })
              .observe(document.getElementById("overlayBox"),{subtree:true,childList:true,attributes:true,attributeFilter:["class"]}); window.__t0=performance.now(); true`);
            await P.click(skBtn.x,skBtn.y);
            /* 시트가 뜨면 같은 노드의 복제본(data-audit)을 같은 토큰에 붙여 멈춘 채 프레임을 잰다 — 원본은 제품 640ms 타이머가 그대로 지운다 */
            let el=null; for(let i=0;i<(live?60:36)&&!el;i++){ await sleep(50); el=await P.ev(`(()=>{ const e=document.querySelector(".skfx:not([data-audit])"); if(!e) return null;
              const c=e.cloneNode(true); c.setAttribute("data-audit","1"); e.parentNode.insertBefore(c,e.nextSibling); c.getAnimations()[0].pause(); return {cls:e.className,parent:e.parentNode.id,skin:document.documentElement.getAttribute("data-ui-skin")}; })()`); }
            const log=await P.ev(`window.__skLog`);
            if(!live){
              const after=await P.ev(`(()=>Object.assign({sheet:!!document.querySelector(".skfx"),nullified:S.battle?S.battle.blog.some(t=>/환영 무도/.test(t)):null},window.__hit))()`);
              if(mode==="nullify") ok(!el&&!log.length&&after.nullified!==false,`[${tag}] 환영 무도로 무효가 된 사용 — 시트 0 ${JSON.stringify(after)}`);
              else ok(!el&&!log.length&&(c.dmg?after.shake>0&&after.float>0:true),`[${tag}] ${mode==="fallback"?"시트 404(미로드)":"움직임 줄이기"} — 시트 없음${c.dmg?" · 흔들림·피해 숫자는 그대로":""} ${JSON.stringify(after)}`);
              let free=false; for(let i=0;i<60&&!free;i++){ free=!(await P.ev(`fxLocked()`)); if(!free) await sleep(100); }
              ok(free,`[${tag}] 연출이 끝나면 잠금이 풀린다 (교착 없음)`);
              await P.shot(`${tag}.png`); await P.close(); continue;
            }
            ok(!!el&&el.parent==="tok-"+want&&el.cls.includes("skfx-"+key)&&(mode!=="skinoff"||el.skin===null),`[${tag}] 표적(${c.cls}) = tok-${want} 안 skfx-${key}${mode==="skinoff"?" · 재생 시점 스킨 속성 없음":""} ${JSON.stringify(el)}`);
            if(!el){ await P.close(); continue; }
            const frames=await P.ev(`(()=>{ const e=document.querySelector(".skfx[data-audit]"), a=e.getAnimations()[0], out=[];
              for(const t of [0,40,79,80,120,200,280,360,440,520,559,560,600,639]){ a.currentTime=t; out.push([t,getComputedStyle(e).backgroundPositionX]); }
              a.currentTime=640; out.push([640,getComputedStyle(e).backgroundPositionX]); a.currentTime=280; return {out,dur:a.effect.getTiming().duration,iter:a.effect.getTiming().iterations,rep:getComputedStyle(e).backgroundRepeat,img:getComputedStyle(e).backgroundImage}; })()`);
            const want8=t=>t>=640?-768:-96*Math.floor(t/80);
            ok(frames.dur===640&&frames.iter===1&&/no-repeat/.test(frames.rep)&&frames.img.includes(key+"_96x8.png")&&frames.out.every(([t,x])=>parseFloat(x)===want8(t)),`[${tag}] ${key}_96x8.png · 8×80ms 1회 · 프레임 선택 정확(79→F1·80→F2·639→F8·끝 -768 투명)`);
            const geo=await P.ev(`(()=>{ const e=document.querySelector(".skfx[data-audit]"), t=e.parentNode, s=t.querySelector(".bsprite")||t, er=e.getBoundingClientRect(), sr=s.getBoundingClientRect();
              const slot=document.querySelector(".bslot.slot-op")||document.querySelector(".bslot"), zs=getComputedStyle(slot).zIndex, zt=getComputedStyle(t).zIndex;
              return {dx:Math.round(er.left+er.width/2-(sr.left+sr.width/2)),dy:Math.round(er.top+er.height/2-(sr.top+sr.height/2)),w:er.width,h:er.height,zSlot:+zs,zTok:+zt,pe:getComputedStyle(e).pointerEvents}; })()`);
            ok(Math.abs(geo.dx)<=1&&Math.abs(geo.dy)<=1&&geo.w===96&&geo.h===96&&geo.zTok<geo.zSlot&&geo.pe==="none",`[${tag}] 몸통 중심(0.5,0.5) · 96px · 토큰 층(z${geo.zTok}) < 정보판(z${geo.zSlot}) · 입력 통과 ${JSON.stringify(geo)}`);
            if(legend&&mode==="live"){ const tk=await P.ev(`(()=>{ const r=document.querySelector(".skfx[data-audit]").parentNode.getBoundingClientRect(); return {x:Math.max(0,r.left-24),y:Math.max(0,r.top-24),width:Math.min(innerWidth,r.width+48),height:r.height+48}; })()`);
              for(let k=0;k<8;k++){ await P.ev(`(()=>{ const a=document.querySelector(".skfx[data-audit]").getAnimations()[0]; a.currentTime=${k*80+40}; return true; })()`); await P.shot(`${tag}-F${k+1}.png`,tk); } }
            await P.ev(`(()=>{ document.querySelector(".skfx[data-audit]").getAnimations()[0].currentTime=280; return true; })()`); await P.shot(`${tag}-battle-F4.png`,null); // F4 = 정점 프레임
            await P.ev(`(()=>{ const c=document.querySelector(".skfx[data-audit]"); c.parentNode.removeChild(c); return true; })()`);
            let gone=false; for(let i=0;i<30&&!gone;i++){ gone=await P.ev(`!document.querySelector(".skfx")`); if(!gone) await sleep(50); }
            const life=await P.ev(`(()=>{ const l=window.__skLog[0]; return l?Math.round(performance.now()-l.t):null; })()`);
            ok(gone&&log.length===1,`[${tag}] 사용 1회 = 시트 1장 · 제품 타이머로 스스로 사라진다 (생성 뒤 ${life}ms 시점 확인 · 생성 ${log.length})`);
            const lk=log[0]; report.fx[tag]={el,frames,geo,log,req,cast:lk?Math.round(lk.t-(await P.ev(`window.__t0`))):null};
            if(c.dmg) ok(lk&&report.fx[tag].cast>=1000,`[${tag}] 피해형: 시전 그룹(1200ms) 뒤 피해 그룹 t0 에 뜬다 (클릭 후 ${report.fx[tag].cast}ms)`);
            else ok(lk&&report.fx[tag].cast<1000,`[${tag}] 비피해형: 성공 행이 든 시전 그룹 안에서 뜬다 — 추가 대기 없음 (클릭 후 ${report.fx[tag].cast}ms)`);
            let free=false; for(let i=0;i<80&&!free;i++){ free=!(await P.ev(`fxLocked()`)); if(!free) await sleep(100); }
            ok(free,`[${tag}] 재생 뒤 잠금 해제 (교착 없음)`);
            /* 세대 취소 — 재생 중 새 게임 */
            if(mode==="live"&&vp.tag==="390x844"&&(key==="dragon"||key==="water_def")){
              await P.ev(`skillSheetFx("${id}","${want}")`); const had=await P.ev(`!!document.querySelector(".skfx")`);
              await P.ev(`fxReleaseAll()`); ok(had&&await P.ev(`!document.querySelector(".skfx")`),`[${tag}] 세대 취소(fxReleaseAll) 시 재생 중인 시트 즉시 제거`);
            }
          } catch(e){ ok(false,`[${tag}] ${e.message.split("\n")[0]}`); }
          await P.close();
    }
    ws.close();
  } finally {
    proc.kill(); srv.close(); if(rsrv) rsrv.close(); await sleep(400);
    try{ fs.rmSync(udd,{recursive:true,force:true}); console.log("CLEANUP Chrome 종료 · 임시 프로필 삭제 "+udd+" · 정적 서버 닫음"); }catch(e){ console.log("LEFTOVER "+udd+" "+e.message); }
  }
  report.pass=pass; report.fail=fail; report.finishedAt=new Date().toISOString();
  { fs.writeFileSync(path.join(OUT,"report.json"),JSON.stringify(report,null,1)); console.log("REPORT "+path.join(OUT,"report.json").replace(/\\/g,"/")); }
  console.log(`=== issue335_cdp: pass ${pass} / fail ${fail} ===`); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
