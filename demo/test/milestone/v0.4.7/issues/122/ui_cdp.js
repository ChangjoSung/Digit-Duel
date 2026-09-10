/* #122 · #124 · #126 — 세로 UI · 승패 연출 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 클릭 · 페이지의 실제 타이머)
   사용: node demo/test/milestone/v0.4.7/issues/122/ui_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots]

   무엇을 보는가 (헤드리스 하네스가 볼 수 없는 것만 — 실제 레이아웃·실제 CSS 계산값·실제 타이머):
     A. 세로 레이아웃 — 360·390·데스크톱에서 **문서 가로 넘침 0**, 보드가 프레임 안, 하단 행동 독과 보드가 겹치지 않음,
        칸 히트 영역이 실제로 눌리는 크기인지(getBoundingClientRect 로 실측), 32px 아이콘·속성/HP 정보행이 남아 있는지.
     B. 화면 흐름 — 타이틀 → 로비 → 로스터 → 배치 → 보드 → 전투 → 경기 결과 → 같은 문서 로비/재대전.
        각 단계에서 data-screen 이 바뀌고, **#128 자동 튜토리얼이 같은 문서 안에서는 다시 뜨지 않는지**.
     C. #126 결과 연출 — 승/패/포획/도망/경기 종료가 서로 다른 클래스로 갈리고, 파편 레이어가 실제로 만들어지며,
        CSS animation 지속 시간(getComputedStyle)이 **resultBanner 안에서 끝나는지**, 그리고 경기당 배너가 **정확히 1회**인지.
        prefers-reduced-motion 에서 움직임이 꺼져도 제목·부제 문구가 그대로 남는지.
     D. #124 훅 — 자산이 없는 현재 상태에서 왕·동료가 **현행 이모지로** 그려지고 정체 문자열이 <img>/src/alt 에 만들어지지 않는지.

   소스: 현재 작업 트리의 demo/index.html 을 file:// 로 직접 연다. 어떤 바이트를 봤는지는 git blob sha1(LF 정규화)로 남긴다.
   --read-only: 산출물 0건(스크린샷·JSON 없음), stdout 만. 그 모드에서도 헤드리스 Chrome 임시 프로필(os.tmpdir()/i122cdp-*)은
                만들고 **자기가 띄운 PID·자기가 만든 정확한 절대경로만** 종료 시 정리한다 (RESOURCE/CLEANUP 행).
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 0. 종료 코드 1 = 판정 실패, 2 = 환경 오류. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.7","issues","122","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const CHROME=opt("--chrome",[process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(ROOT,"demo","index.html"));

function blobHashNormalized(file){ const raw=fs.readFileSync(file);
  const b=Buffer.from(raw.toString("utf8").replace(/\r\n/g,"\n"),"utf8");
  return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0","utf8"),b])).digest("hex"); }

let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond){pass++; console.log("PASS "+name);} else {fail++; fails.push(name); console.error("FAIL "+name);} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i122cdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run",
      "--no-default-browser-check","--disable-gpu","--hide-scrollbars","--lang=ko-KR",
      "--disable-background-timer-throttling","--disable-renderer-backgrounding","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map();
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id);
      if(m.error) rej(new Error(m.method+" "+JSON.stringify(m.error))); else res(m.result); } }; }
  send(method,params,sessionId){ const id=++this.id;
    return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
}
async function openTab(cdp,url,vp,reduceMotion){
  const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
  const {sessionId}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
  const S=sessionId;
  await cdp.send("Page.enable",{},S); await cdp.send("Runtime.enable",{},S);
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:vp.width,height:vp.height,deviceScaleFactor:1,mobile:!!vp.mobile},S);
  if(reduceMotion) await cdp.send("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]},S);
  await cdp.send("Page.navigate",{url},S);
  await sleep(700);
  const ev=async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},S);
    if(r.exceptionDetails) throw new Error("page error: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+"\nEXPR: "+expr.slice(0,300));
    return r.result.value; };
  const shot=async name=>{ if(!SHOTS) return null;
    const {data}=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false},S);
    const f=path.join(OUT,name); fs.writeFileSync(f,Buffer.from(data,"base64")); return f; };
  const clickAt=async box=>{ if(!box) return false;
    await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:box.x,y:box.y,button:"left",clickCount:1},S);
    return true; };
  /* 세로 화면은 스크롤 컨테이너(#screenBody)를 쓴다 — 화면 밖 버튼은 좌표가 뷰포트를 벗어나 실제 마우스가 닿지 않는다.
     그래서 누르기 전에 먼저 보이는 자리로 스크롤한다 (사람이 하는 것과 같은 순서). */
  const boxOf=async sel=>{ const r=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null;
      e.scrollIntoView({block:"center",inline:"center"}); const r=e.getBoundingClientRect();
      return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`); await sleep(80); return r; };
  const clickSel=async sel=>clickAt(await boxOf(sel));
  const clickText=async (txt,scope)=>{
    const box=await ev(`(()=>{
      const root=document.querySelector(${JSON.stringify(scope||"body")}); if(!root) return null;
      const b=Array.prototype.slice.call(root.querySelectorAll("button")).filter(x=>!x.disabled&&x.offsetParent!==null).find(x=>x.textContent.indexOf(${JSON.stringify(txt)})>=0);
      if(!b) return null; b.scrollIntoView({block:"center",inline:"center"}); const r=b.getBoundingClientRect();
      return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`);
    await sleep(80);
    return clickAt(box); };
  const close=async()=>{ try{ await cdp.send("Target.closeTarget",{targetId}); }catch(e){} };
  return {S,ev,shot,clickSel,clickText,close};
}

/* 한 뷰포트에서 보는 레이아웃 계약 — 값은 전부 실제 렌더 박스에서 읽는다 */
const LAYOUT_EXPR=`(()=>{
  const de=document.documentElement, app=document.getElementById("app");
  const bw=document.getElementById("boardWrap"), bd=document.getElementById("board");
  const dock=document.getElementById("actionDock"), tb=document.getElementById("turnBar");
  const rb=bd?bd.getBoundingClientRect():null, rd=dock?dock.getBoundingClientRect():null;
  const cells=bd?Array.prototype.slice.call(bd.querySelectorAll(".cell")):[];
  const rc=cells.length?cells[Math.floor(cells.length/2)].getBoundingClientRect():null;
  const rlast=cells.length?cells[cells.length-1].getBoundingClientRect():null;   // 실제 마지막 칸 — #board 박스가 아니라 이 값이 히트 영역의 끝이다
  const rfirst=cells.length?cells[0].getBoundingClientRect():null;
  const btns=tb?Array.prototype.slice.call(tb.querySelectorAll("button")):[];
  const outside=btns.filter(b=>{const r=b.getBoundingClientRect(); return r.width&&(r.right>window.innerWidth+1||r.left<-1);}).length;
  const chip=bd?bd.querySelector(".pc"):null, rp=chip?chip.getBoundingClientRect():null;
  const ico=bd?bd.querySelector(".pc .icon,.pc .face"):null, ri=ico?ico.getBoundingClientRect():null; // 확정 표시된 말의 아이콘 상자 (미공개 ? 칸에는 없다)
  return {vw:window.innerWidth,vh:window.innerHeight,
    docW:de.scrollWidth,docH:de.scrollHeight,bodyW:document.body.scrollWidth,
    appW:app?app.getBoundingClientRect().width:0,
    bs:bw?getComputedStyle(bw).getPropertyValue("--bs").trim():null,
    boardLeft:rb?Math.round(rb.left):null,boardRight:rb?Math.round(rb.right):null,
    boardTop:rb?Math.round(rb.top):null,boardBottom:rb?Math.round(rb.bottom):null,
    dockTop:rd?Math.round(rd.top):null,dockBtns:btns.length,btnsOutside:outside,
    cellFirstTop:rfirst?Math.round(rfirst.top):null,cellLastBottom:rlast?Math.round(rlast.bottom):null,
    cellLastRight:rlast?Math.round(rlast.right):null,cellFirstLeft:rfirst?Math.round(rfirst.left):null,
    cellW:rc?+(rc.width).toFixed(2):null,cellH:rc?+(rc.height).toFixed(2):null,
    chipW:rp?+(rp.width).toFixed(2):null,icoW:ri?+(ri.width).toFixed(2):null,
    screen:app?app.getAttribute("data-screen"):null};
})()`;

(async()=>{
  const HASH=blobHashNormalized(HTML);
  console.log("SOURCE  demo/index.html  blob sha1 "+HASH);
  console.log("MODE    "+(READ_ONLY?"read-only (산출물 0건)":"out="+path.relative(ROOT,OUT).replace(/\\/g,"/")));
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const L=await launch();
  console.log("RESOURCE 헤드리스 Chrome PID "+L.proc.pid+" · 임시 프로필 "+L.udd);
  const cdp=new CDP(new WebSocket(L.ws));
  await new Promise(r=>{ const t=setInterval(()=>{ if(cdp.ws.readyState===1){clearInterval(t);r();} },30); });
  const URL="file:///"+HTML.replace(/\\/g,"/");
  const report={source:"demo/index.html",blobSha1:HASH,at:new Date().toISOString(),
    tool:"demo/test/milestone/v0.4.7/issues/122/ui_cdp.js",checks:[]};
  const rec=(k,v)=>{ report.checks.push({k,v}); console.log("  · "+k+": "+(typeof v==="object"?JSON.stringify(v):v)); };

  try{
    /* ══ A·B. 세로 화면 흐름 + 레이아웃 (390×844) ══════════════════════════ */
    const VPS=[{name:"390x844",width:390,height:844,mobile:true},
               {name:"360x844",width:360,height:844,mobile:true},
               {name:"desktop-1280x900",width:1280,height:900,mobile:false}];
    for(const vp of VPS){
      const T=await openTab(cdp,URL,vp,false);
      const tag=vp.name;
      /* 타이틀 화면 — 새 문서 로드이므로 #128 튜토리얼이 자동으로 떠 있어야 한다 */
      const tut0=await T.ev(`!document.getElementById("tutOverlay").classList.contains("hidden")`);
      ok(tut0===true,`B1.${tag} 새 문서 로드 → 튜토리얼 1단계 자동 표시 (#128 정책 그대로)`);
      await T.ev(`tutSkip()`); await sleep(120);
      ok(await T.ev(`document.getElementById("app").getAttribute("data-screen")==="title"`),`B2.${tag} 첫 화면은 타이틀`);
      const vtag=vp.name==="desktop-1280x900"?"desktop":vp.name.split("x")[0];
      await T.shot(`122-01-title-${vtag}.png`);
      /* 로비 */
      await T.clickText("대전 시작"); await sleep(200);
      ok(await T.ev(`document.getElementById("app").getAttribute("data-screen")==="lobby"`),`B3.${tag} [대전 시작] → 로비`);
      const lob=await T.ev(LAYOUT_EXPR);
      ok(lob.docW<=lob.vw+1,`A1.${tag} 로비 — 문서 가로 넘침 없음 (docW ${lob.docW} ≤ vw ${lob.vw})`);
      await T.shot(`122-02-lobby-${vtag}.png`);
      /* 로스터 선택 → 배치 */
      await T.clickText("5급"); await sleep(250);
      ok(await T.ev(`document.getElementById("app").getAttribute("data-screen")==="prep"&&document.getElementById("app").getAttribute("data-prep")==="roster"`),
        `B4.${tag} PVE 시작 → 출전 준비 · 01 로스터 선택 단계`);
      const rosterL=await T.ev(LAYOUT_EXPR);
      ok(rosterL.docW<=rosterL.vw+1,`A2.${tag} 로스터 — 문서 가로 넘침 없음 (docW ${rosterL.docW})`);
      await T.shot(`122-03-roster-${vtag}.png`);
      /* 02 배치 단계로 넘어간 뒤 [무작위 배치]로 6종·14개를 채운다 (버튼이 실제로 보이는 상태에서 실제 클릭) */
      await T.ev(`uiPrep("place")`); await sleep(200);
      await T.clickText("무작위 배치"); await sleep(300);
      const prepL=await T.ev(LAYOUT_EXPR);
      ok(await T.ev(`document.getElementById("app").getAttribute("data-prep")==="place"`),`B5.${tag} 02 비공개 배치 단계에서 말판이 보인다`);
      ok(prepL.docW<=prepL.vw+1,`A3.${tag} 배치 — 문서 가로 넘침 없음 (docW ${prepL.docW})`);
      ok(prepL.boardLeft>=-1&&prepL.boardRight<=prepL.vw+1,`A4.${tag} 배치 말판이 화면 폭 안 (left ${prepL.boardLeft} right ${prepL.boardRight})`);
      await T.shot(`122-04-place-${vtag}.png`);
      /* 보드 */
      await T.clickText("배치 완료"); await sleep(1800);
      ok(await T.ev(`document.getElementById("app").getAttribute("data-screen")==="board"`),`B6.${tag} 배치 완료 → 전략 보드`);
      const bl=await T.ev(LAYOUT_EXPR);
      rec("layout."+tag,bl);
      ok(bl.docW<=bl.vw+1,`A5.${tag} 보드 — 문서 가로 넘침 없음 (docW ${bl.docW} ≤ vw ${bl.vw})`);
      ok(bl.boardLeft>=-1&&bl.boardRight<=bl.vw+1,`A6.${tag} 말판이 화면 폭 안 (left ${bl.boardLeft} right ${bl.boardRight})`);
      ok(bl.dockTop!==null&&bl.cellLastBottom<=bl.dockTop+1,`A7.${tag} **마지막 칸** 아래끝(${bl.cellLastBottom}) ≤ 하단 행동 독 위끝(${bl.dockTop}) — 겹치지 않는다`);
      ok(Math.abs(bl.cellLastBottom-bl.boardBottom)<=2,`A7b.${tag} #board 박스(${bl.boardBottom})와 마지막 칸(${bl.cellLastBottom})이 일치 — 컨테이너만 축소되지 않았다`);
      ok(bl.cellFirstLeft>=-1&&bl.cellLastRight<=bl.vw+1,`A7c.${tag} 칸 실제 좌우 경계가 화면 안 (${bl.cellFirstLeft}~${bl.cellLastRight})`);
      ok(bl.btnsOutside===0,`A8.${tag} 턴바 버튼 ${bl.dockBtns}개가 모두 화면 안 (밖 ${bl.btnsOutside})`);
      ok(bl.cellW>=28&&bl.cellH>=28,`A9.${tag} 칸 히트 영역 ${bl.cellW}×${bl.cellH}px (실측 · 28px 이상)`);
      ok(bl.icoW>=24,`A10.${tag} 말 아이콘 실측 ${bl.icoW}px (32px 규격의 --bs 배율 결과)`);
      const infoRow=await T.ev(`!!document.querySelector("#board .pc .info")`);
      ok(infoRow===true,`A11.${tag} 말의 속성·HP 정보행 유지`);
      await T.shot(`122-05-board-${vtag}.png`);
      /* 서랍 — 상시 사이드바가 아니라 눌러서 여는 서랍 */
      const sideVisible0=await T.ev(`getComputedStyle(document.getElementById("right")).display!=="none"`);
      ok(sideVisible0===false,`B7.${tag} 보드에서 상세/기록은 상시 사이드바가 아니다 (닫힘)`);
      await T.ev(`uiDrawer("log")`); await sleep(150);
      ok(await T.ev(`document.getElementById("app").getAttribute("data-drawer")==="log"&&getComputedStyle(document.getElementById("drawerLog")).display!=="none"`),
        `B8.${tag} 공개 기록 서랍이 열린다`);
      await T.shot(`122-06-drawer-log-${vtag}.png`);
      await T.ev(`uiDrawer(null)`); await sleep(100);
      await T.close();
    }

    /* ══ C. #126 결과 연출 · 전투 화면 (390×844) ═══════════════════════════ */
    const T=await openTab(cdp,URL,{width:390,height:844,mobile:true},false);
    await T.ev(`tutSkip()`);
    /* 결정론 픽스처: 사람(P0) 하수인과 AI 하수인을 붙여 전투를 연다 */
    const setFixture=`(()=>{
      uiStart(); startMode("pve",{aiLevel:"grade5"});
      setSeed(4242);
      const p=0;
      fillRosterRandom(0); fillRosterRandom(1);
      aiAutoPlace(0); aiAutoPlace(1);
      beginPlay();
      return S.phase;
    })()`;
    await T.ev(setFixture); await sleep(1600);
    /* 전투 화면 — 실제 규칙 경로로 열지 않고 표시 계약만 보려면 startRounds 를 쓴다 (규칙 상태 전이는 제품 함수 그대로) */
    const openBattle=`(()=>{
      fxReleaseAll();
      const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive);
      const em=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
      S.current=0; S.mainUsed=false; S.battlesUsed=0;
      startRounds(me,em,me,em);
      return !!S.battle;
    })()`;
    ok(await T.ev(openBattle)===true,"C0 전투 시작 (제품 startRounds 경로)");
    /* PD 지적: 카운트다운·디밍 도중이 아니라 **연출이 끝나고 입력이 준비된 상태**에서 촬영한다 */
    for(let i=0;i<120&&await T.ev(`fxLocked()||(S.battle&&S.battle.msgQ.length>0)`);i++) await sleep(120);
    await sleep(220);
    ok(await T.ev(`!fxLocked()`),"C0b 전투 개시 연출이 끝나고 입력이 준비됐다 (촬영 시점)");
    const bt=await T.ev(`(()=>{
      const ob=document.getElementById("overlayBox"), st=document.getElementById("bstage");
      const op=document.querySelector(".bslot.slot-op"), me=document.querySelector(".bslot.slot-me");
      const tokOp=document.querySelector("#bstage .btok.tok-op"), tokMe=document.querySelector("#bstage .btok.tok-me");
      const menu=document.getElementById("bmenu");
      const r=e=>{const b=e.getBoundingClientRect(); return {l:Math.round(b.left),t:Math.round(b.top),w:Math.round(b.width),h:Math.round(b.height)};};
      const cs=menu?getComputedStyle(menu):null;
      const btns=menu?Array.prototype.slice.call(menu.querySelectorAll("button")).map(b=>b.textContent.trim()):[];
      return {battleBox:ob?ob.className:null, scene:st?st.className:null,
        stage:st?r(st):null, op:op?r(op):null, me:me?r(me):null,
        tokOp:tokOp?r(tokOp):null, tokMe:tokMe?r(tokMe):null,
        cols:cs?cs.gridTemplateColumns:null, btns,
        docW:document.documentElement.scrollWidth, vw:window.innerWidth};
    })()`);
    rec("battle",bt);
    ok(/battleBox/.test(bt.battleBox||""),"C1 전투 모달에 세로 전투 레이아웃 클래스");
    ok(/scene/.test(bt.scene||""),"C2 전투 스테이지 scene 구성");
    ok(bt.tokOp&&bt.tokMe&&bt.tokOp.t<bt.tokMe.t&&bt.tokOp.l>bt.tokMe.l,"C3 상대 토큰이 위·오른쪽, 아군 토큰이 아래·왼쪽");
    ok(bt.op&&bt.me&&bt.op.l<bt.tokOp.l&&bt.me.l>bt.tokMe.l,"C4 HP 판은 각 전투원의 반대편 (상대 판 왼쪽 · 아군 판 오른쪽)");
    ok((bt.cols||"").split(" ").length===2,"C5 명령창이 2×2 (grid 2열) — 싸우기·가방·포획·도망가기 유지");
    ok(bt.btns.filter(t=>/싸우기|가방|포획|도망가기/.test(t)).length===4,"C6 4개 명령 문구 유지: "+bt.btns.join(" / "));
    ok(bt.docW<=bt.vw+1,`C7 전투 화면 문서 가로 넘침 없음 (docW ${bt.docW})`);
    const ovl=(a,b)=>(a&&b)?Math.max(0,Math.min(a.l+a.w,b.l+b.w)-Math.max(a.l,b.l))*Math.max(0,Math.min(a.t+a.h,b.t+b.h)-Math.max(a.t,b.t)):-1;
    rec("battle.overlapPx",{opPlateVsOpTok:ovl(bt.op,bt.tokOp),mePlateVsMeTok:ovl(bt.me,bt.tokMe),opPlateVsMeTok:ovl(bt.op,bt.tokMe),mePlateVsOpTok:ovl(bt.me,bt.tokOp)});
    ok(ovl(bt.op,bt.tokOp)===0&&ovl(bt.me,bt.tokMe)===0,"C7b 각 HP 판이 자기 전투원 도트를 덮지 않는다");
    ok(ovl(bt.op,bt.tokMe)===0&&ovl(bt.me,bt.tokOp)===0,"C7c 각 HP 판이 상대 전투원 도트도 덮지 않는다");
    ok(bt.op.t+bt.op.h<=bt.stage.t+bt.stage.h&&bt.me.t>=bt.stage.t,"C7d 두 HP 판이 무대 안에 있다");
    await T.shot("122-07-battle-390.png");

    /* 승리 연출 — 전투 결과(뷰어 승리) */
    await T.ev(`(()=>{ fxReleaseAll(); const B=S.battle; if(B){ B.fd.hp=1; } return 1; })()`);
    const winFx=await T.ev(`(()=>{
      fxReleaseAll();
      fxPlay({key:"resultBanner",kind:"result",cls:"win",title:"전투에서 승리!",sub:""});
      const el=document.getElementById("fxBanner"), fl=document.getElementById("fxFx");
      const box=el.querySelector(".fxBox"), t=document.getElementById("fxTitle");
      const shards=fl?fl.querySelectorAll("i").length:0;
      const cs=getComputedStyle(box), cf=fl?getComputedStyle(fl,"::before"):null;
      const one=fl&&fl.querySelector("i")?getComputedStyle(fl.querySelector("i")):null;
      return {cls:el.className, shards, title:t.textContent,
        boxAnim:cs.animationName, boxDur:cs.animationDuration,
        flashDur:cf?cf.animationDuration:null, shardDur:one?one.animationDuration:null,
        titleColor:getComputedStyle(t).color, locked:fxLocked()};
    })()`);
    rec("fx.win",winFx);
    ok(/\bresult\b/.test(winFx.cls)&&/\bwin\b/.test(winFx.cls),"C8 승리 연출 클래스 result win");
    ok(winFx.shards===16,"C9 파편 16개가 실제로 생성됨 (난수 미사용 · 인덱스 고정)");
    ok(/fxWinIn/.test(winFx.boxAnim),"C10 승리 배너 임팩트 애니메이션 적용 ("+winFx.boxAnim+")");
    const durMs=s=>Math.max.apply(null,String(s||"0s").split(",").map(x=>parseFloat(x)*1000||0));
    const winMove=Math.max(durMs(winFx.boxDur),durMs(winFx.flashDur),durMs(winFx.shardDur)+16*14);
    rec("fx.win.moveMs",Math.round(winMove));
    ok(winMove<=1300,`C11 승리 효과 동작 구간 ${Math.round(winMove)}ms ≤ 1300ms (짧고 강한 구간)`);
    await sleep(230); await T.shot("122-08-fx-win-peak-390.png"); // 확산 정점
    await sleep(1100); await T.shot("122-08-fx-win-hold-390.png"); // 동작이 끝난 뒤 문구 홀드
    const winHold=await T.ev(`(()=>{const t=document.getElementById("fxTitle");
      return {text:t.textContent, visible:!document.getElementById("fxBanner").classList.contains("hidden"), locked:fxLocked()};})()`);
    ok(winHold.visible&&winHold.text==="전투에서 승리!","C12 동작 구간이 끝난 뒤에도 결과 문구가 읽히도록 남는다");
    await T.ev(`fxReleaseAll()`); await sleep(100);

    /* 패배 연출 */
    const loseFx=await T.ev(`(()=>{
      fxReleaseAll();
      fxPlay({key:"resultBanner",kind:"result",cls:"lose",title:"전투에서 패배,,,",sub:""});
      const el=document.getElementById("fxBanner"), fl=document.getElementById("fxFx");
      const box=el.querySelector(".fxBox"), one=fl.querySelector("i");
      return {cls:el.className, shards:fl.querySelectorAll("i").length,
        boxAnim:getComputedStyle(box).animationName, boxDur:getComputedStyle(box).animationDuration,
        crackDur:getComputedStyle(fl,"::after").animationDuration,
        shardAnim:one?getComputedStyle(one).animationName:null, shardDur:one?getComputedStyle(one).animationDuration:null,
        titleColor:getComputedStyle(document.getElementById("fxTitle")).color};
    })()`);
    rec("fx.lose",loseFx);
    ok(/\blose\b/.test(loseFx.cls)&&/fxLoseIn/.test(loseFx.boxAnim),"C13 패배 연출 클래스·낙하 임팩트 ("+loseFx.boxAnim+")");
    ok(/fxFall/.test(loseFx.shardAnim||""),"C14 패배는 파편이 아래로 떨어지는 갈래 ("+loseFx.shardAnim+")");
    const loseMove=Math.max(durMs(loseFx.boxDur),durMs(loseFx.crackDur),durMs(loseFx.shardDur)+16*18);
    rec("fx.lose.moveMs",Math.round(loseMove));
    ok(loseMove<=1400,`C15 패배 효과 동작 구간 ${Math.round(loseMove)}ms ≤ 1400ms`);
    ok(loseFx.titleColor!==winFx.titleColor,"C16 승리와 패배의 결과 문구 색이 다르다");
    await sleep(230); await T.shot("122-09-fx-lose-peak-390.png"); // 균열 정점
    await sleep(1100); await T.shot("122-09-fx-lose-hold-390.png");
    await T.ev(`fxReleaseAll()`); await sleep(100);

    /* 경기 종료 — 배너가 정확히 1회, 그리고 결과 화면으로 이어진다 */
    const matchOnce=await T.ev(`(()=>{
      fxReleaseAll(); S.battle=null; close(); S.matchFxDone=false; // 제품의 전투 종료 경로가 하는 것과 같이 전투 모달을 먼저 닫는다
      const seen=[]; const origPlay=fxPlay;
      window.__seen=seen;
      const k=S.pieces.find(x=>x.owner===1&&x.type==="king");
      FX.log.length=0;
      gameOver(0,"king"); render();
      const after=FX.log.filter(x=>x.key==="resultBanner").length;
      gameOver(0,"king"); render(); // 중복 호출로도 두 번 재생되지 않아야 한다
      const after2=FX.log.filter(x=>x.key==="resultBanner").length;
      return {first:after,second:after2,cls:document.getElementById("fxBanner").className,
        title:document.getElementById("fxTitle").textContent,sub:document.getElementById("fxSub").textContent,phase:S.phase};
    })()`);
    rec("fx.match",matchOnce);
    ok(matchOnce.first===1&&matchOnce.second===1,"C17 경기 종료 연출은 경기당 정확히 1회 (중복 호출에도 1회)");
    ok(/\bmatch\b/.test(matchOnce.cls),"C18 경기 결과 배너 클래스 match ("+matchOnce.cls+")");
    ok(/경기/.test(matchOnce.title),"C19 경기 결과 문구가 전투 결과와 구분된다: "+matchOnce.title);
    await sleep(2700);
    ok(await T.ev(`document.getElementById("app").getAttribute("data-screen")==="result"`),"B9 경기 종료 → 경기 결과 화면");
    await T.shot("122-10-result-390.png");

    /* 같은 문서 로비 복귀 — 튜토리얼이 다시 뜨지 않는다 (#128) */
    await T.clickText("로비로 돌아가기"); await sleep(400);
    const back=await T.ev(`(()=>({screen:document.getElementById("app").getAttribute("data-screen"),
      tut:!document.getElementById("tutOverlay").classList.contains("hidden"),
      overlay:document.getElementById("overlay").classList.contains("hidden"),
      obEmpty:document.getElementById("overlayBox").innerHTML==="",
      netMode:NET.mode,netStarted:NET.started,netMe:NET.me,
      fxLocked:fxLocked(),banner:document.getElementById("fxBanner").classList.contains("hidden")}))()`);
    rec("lobbyBack",back);
    ok(back.screen==="lobby","B10 [로비로 돌아가기] → 같은 문서에서 로비");
    ok(back.tut===false,"B11 같은 문서 로비 복귀에서는 튜토리얼이 다시 뜨지 않는다 (#128 정책)");
    ok(back.overlay===true&&back.obEmpty===true&&back.banner===true&&back.fxLocked===false,"B12 이전 경기의 모달·연출·잠금 잔존 0");
    ok(back.netMode===false&&back.netStarted===false&&back.netMe===null,"B13 온라인 상태 완전 해제 (다음 오프라인 경기가 온라인 게이팅을 물지 않는다)");
    await T.shot("122-11-lobby-back-390.png");

    /* 재대전 — 같은 모드로 새 경기, 튜토리얼 자동 표시 없음, 종료 연출 플래그 초기화 */
    const rem=await T.ev(`(()=>{ startMode("pve",{aiLevel:"grade5"});
      return {screen:document.getElementById("app").getAttribute("data-screen"),
        tut:!document.getElementById("tutOverlay").classList.contains("hidden"),
        matchFxDone:S.matchFxDone,phase:S.phase};})()`);
    rec("rematch",rem);
    ok(rem.screen==="prep"&&rem.phase==="setup","B14 재대전 → 같은 문서에서 출전 준비");
    ok(rem.tut===false,"B15 재대전에서도 튜토리얼 자동 표시 없음");
    ok(rem.matchFxDone===false,"B16 새 경기에서 종료 연출 플래그가 초기화된다 (다음 경기에도 1회)");

    /* ══ A+. 수풀 반투명 — 보이는 말만, 은폐 규칙 무변경 ══════════════════ */
    const bush=await T.ev(`(()=>{
      startMode("pvp"); fillRosterRandom(0); fillRosterRandom(1);
      aiAutoPlace(0); aiAutoPlace(1); beginPlay();
      // 내 말 하나와 상대 말 하나를 같은 수풀 줄에 놓고, 상대 말은 인접시켜 위치가 드러난 상태로 만든다
      const mine=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive);
      const foe=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
      const far=S.pieces.filter(x=>x.owner===1&&x.type==="minion"&&x.alive)[1];
      for(const x of S.pieces) if(x.placed){ x.placed=false; }
      mine.r=9; mine.c=4; mine.placed=true;
      foe.r=9; foe.c=5; foe.placed=true;          // 내 말과 인접 → 위치는 보이고 정체는 미공개
      far.r=10; far.c=1; far.placed=true;          // 비인접 수풀 → 아예 보이지 않아야 한다
      S.current=0; S.phase="play"; render();
      const cell=(r,c)=>document.querySelector('#board .cell[data-r="'+r+'"][data-c="'+c+'"]');
      const chip=(r,c)=>{const e=cell(r,c); return e?e.querySelector(".pc"):null;};
      const cs=e=>e?getComputedStyle(e):null;
      const mc=chip(9,4), fc=chip(9,5), hc=chip(10,1);
      const k=S.pieces.find(x=>x.owner===0&&x.type==="king"); k.r=13; k.c=1; k.placed=true;
      fxReleaseAll(); close();   // 핫시트 교대 모달·개시 연출을 걷어 화면이 가려지지 않은 상태에서 촬영·측정한다
      render();  // 모든 배치를 끝낸 뒤 한 번만 그리고, 그 다음 **살아 있는 노드**에서만 계산값을 읽는다
      const mc2=chip(9,4), fc2=chip(9,5), plain=chip(13,1);
      const icoOp=e=>{ const i=e&&e.querySelector(".icon,.face"); return i?getComputedStyle(i).opacity:null; };
      const bgOp=e=>e?getComputedStyle(e,"::before").opacity:null;
      return {mineBush:!!mc2&&/inbush/.test(mc2.className), foeBush:!!fc2&&/inbush/.test(fc2.className),
        foeHidden:!!fc2&&/hiddenId/.test(fc2.className), foeText:fc2?fc2.textContent.trim():null,
        hiddenCellEmpty:!!cell(10,1)&&cell(10,1).children.length===0, hiddenCellHtml:cell(10,1)?cell(10,1).innerHTML:null,
        mineBodyOpacity:icoOp(mc2), foeCardOpacity:bgOp(fc2), mineCardOpacity:bgOp(mc2),
        mineInfoOpacity:mc2&&mc2.querySelector(".info")?getComputedStyle(mc2.querySelector(".info")).opacity:null,
        plainBush:!!plain&&/inbush/.test(plain.className), plainBodyOpacity:icoOp(plain),
        plainCardOpacity:bgOp(plain), foeSelfOpacity:fc2?getComputedStyle(fc2).opacity:null};
    })()`);
    rec("bush",bush);
    ok(bush.mineBush===true&&bush.foeBush===true,"A12 수풀에서 보이는 말은 내 말·상대 말 모두 반투명 처리 대상");
    ok(bush.mineBodyOpacity==="0.7","A13 수풀 말의 본체(아이콘) 불투명도 0.7 (Earth v2 값)");
    ok(bush.mineCardOpacity==="0.5"&&bush.foeCardOpacity==="0.5","A13b 수풀 말의 카드 바탕 불투명도 0.5 — 내 말·상대 말 같은 원칙");
    ok(bush.mineInfoOpacity==="1"&&bush.foeSelfOpacity==="1","A14 속성·HP 정보행과 미공개 ? 는 불투명 1 로 읽기 쉽게 유지");
    ok(bush.plainBush===false&&bush.plainBodyOpacity==="1","A15 일반 칸의 말은 종전 불투명도 그대로");
    ok(bush.foeHidden===true&&bush.foeText==="?","A16 인접해 위치가 드러난 상대 수풀 말은 종전대로 미공개 ? (은폐 규칙 무변경)");
    ok(bush.hiddenCellEmpty===true&&!/pc|img|\?/.test(bush.hiddenCellHtml||""),"A17 비인접 수풀의 상대 말은 chip·img·?·메모 DOM 이 아예 없다");
    await T.shot("122-13-bush-390.png");

    /* ══ D. #124 왕·동료 아트 — 실제 로드·대리 출전·폴백·정체 은닉 ═══════ */
    const leader=await T.ev(`(()=>{
      startMode("pvp"); fillRosterRandom(0); fillRosterRandom(1); aiAutoPlace(0); aiAutoPlace(1); beginPlay();
      const k=S.pieces.find(x=>x.owner===0&&x.type==="king"), a=S.pieces.find(x=>x.owner===0&&x.type==="ally");
      k.revealed=true; a.revealed=true;
      const ek=S.pieces.find(x=>x.owner===1&&x.type==="king"), ea=S.pieces.find(x=>x.owner===1&&x.type==="ally");
      ek.revealed=false; ea.revealed=false; ek.r=1; ek.c=1; ek.placed=true; ea.r=1; ea.c=2; ea.placed=true;
      S.current=0; render();
      const bd=document.getElementById("board").innerHTML;
      const chip=(r,c)=>{const e=document.querySelector('#board .cell[data-r="'+r+'"][data-c="'+c+'"]'); return e?e.innerHTML:"";};
      return {loaded:Array.from(ART.loaded).filter(x=>/king|companion/.test(x)).sort(),
        failed:Array.from(ART.failed).filter(x=>/king|companion/.test(x)),
        kingFace:pcFaceHtml(k), allyFace:pcFaceHtml(a),
        hiddenCells:chip(1,1)+chip(1,2),
        boardHasLeader:bd.indexOf("assets/leaders/")>=0};   // 템플릿 리터럴 안에서는 정규식 이스케이프가 삼켜지므로 문자열 검색을 쓴다
    })()`);
    rec("leader",leader);
    ok(leader.loaded.length===4&&leader.failed.length===0,"D1 왕·동료 파생본 4장이 실제로 로드됐다: "+leader.loaded.join(" "));
    ok(/assets\/leaders\/king\/icon64\.png/.test(leader.kingFace)&&/class="icon leader"/.test(leader.kingFace),"D2 공개된 왕은 새 아트로 보인다 (보드)");
    ok(/assets\/leaders\/companion\/icon64\.png/.test(leader.allyFace),"D3 공개된 동료도 새 아트로 보인다 (보드)");
    ok(!/leaders\//.test(leader.hiddenCells)&&!/king|companion/i.test(leader.hiddenCells),"D4 미공개 상대 왕·동료 칸에는 정체 값이 없다 (자산이 있어도)");
    /* 전투 토큰 — 왕 본체 출전 vs 포획 하수인 대리 출전 */
    const ltok=await T.ev(`(()=>{
      const k=S.pieces.find(x=>x.owner===0&&x.type==="king");
      const em=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
      k.r=6; k.c=4; k.placed=true; em.r=6; em.c=5; em.placed=true;
      S.current=0; S.mainUsed=false; S.battlesUsed=0; fxReleaseAll();
      startRounds(k,em,k,em);
      const own=document.getElementById("overlayBox").innerHTML;
      const bodyTok=(document.getElementById("tok-A")||{}).outerHTML||"";
      // 대리 출전: 왕이 포획 하수인을 앞세우면 그 하수인 아트가 나와야 한다 (왕 아트로 바뀌지 않는다)
      const rd=ROSTER.find(r=>r.element==="water"&&r.arch==="std");
      S.battle=null; close();
      k.cap={element:"water",hp:100,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:archSkills("std","water"),cds:[0,0,0,0],revealedSkills:[],artRosterId:rd.id};
      fxReleaseAll(); S.current=0; S.mainUsed=false; S.battlesUsed=0;
      startRounds(k,em,k.cap,em);
      const capTok=(document.getElementById("tok-A")||{}).outerHTML||"";
      S.battle=null; close(); k.cap=null;
      return {bodyTok,capTok};
    })()`);
    rec("leaderTok",{body:ltok.bodyTok.slice(0,150),cap:ltok.capTok.slice(0,150)});
    ok(/assets\/leaders\/king\/battle256\.png/.test(ltok.bodyTok)&&/class="bsprite leader"/.test(ltok.bodyTok),"D5 왕 본체 출전의 전투 토큰이 새 아트");
    ok(/assets\/minions\/water_std\/battle\.png/.test(ltok.capTok)&&!/leaders\//.test(ltok.capTok),"D6 포획 하수인 대리 출전은 종전대로 그 하수인 아트 (왕 아트로 바뀌지 않는다)");
    /* 폴백 — 로드 실패로 되돌리면 현행 이모지 */
    const lfb=await T.ev(`(()=>{
      ART.failed.add("king"); ART.failed.add("companion");
      const k=S.pieces.find(x=>x.owner===0&&x.type==="king"), a=S.pieces.find(x=>x.owner===0&&x.type==="ally");
      const r={king:pcFaceHtml(k),ally:pcFaceHtml(a)};
      ART.failed.delete("king"); ART.failed.delete("companion");
      return r;
    })()`);
    ok(/👑/.test(lfb.king)&&!/leaders\//.test(lfb.king)&&/🤝/.test(lfb.ally),"D7 로드 실패 뒤에는 현행 이모지로 되돌아간다 (재요청 고리 없음)");
    await T.shot("122-14-leaders-390.png");

    /* ══ C+. prefers-reduced-motion — 움직임만 끄고 문구는 남는다 ═══════════ */
    await T.close();
    const R=await openTab(cdp,URL,{width:390,height:844,mobile:true},true);
    await R.ev(`tutSkip(); uiStart();`);
    const rm=await R.ev(`(()=>{
      fxPlay({key:"resultBanner",kind:"result",cls:"win",title:"전투에서 승리!",sub:"결과 문구는 남는다"});
      const el=document.getElementById("fxBanner"), fl=document.getElementById("fxFx");
      const box=el.querySelector(".fxBox"), one=fl.querySelector("i");
      return {motion:matchMedia("(prefers-reduced-motion: reduce)").matches,
        boxAnim:getComputedStyle(box).animationName, shardAnim:one?getComputedStyle(one).animationName:null,
        title:document.getElementById("fxTitle").textContent, sub:document.getElementById("fxSub").textContent,
        visible:!el.classList.contains("hidden"),
        titleColor:getComputedStyle(document.getElementById("fxTitle")).color};
    })()`);
    rec("reducedMotion",rm);
    ok(rm.motion===true,"C20 prefers-reduced-motion: reduce 로 렌더 중");
    ok(rm.boxAnim==="none"&&rm.shardAnim==="none","C21 움직임을 줄이라는 설정에서 배너·파편 애니메이션이 꺼진다");
    ok(rm.visible&&rm.title==="전투에서 승리!"&&rm.sub==="결과 문구는 남는다","C22 그래도 결과 문구·부제는 그대로 읽힌다");
    ok(rm.titleColor===winFx.titleColor,"C23 색으로 주는 승패 피드백도 유지된다");
    await R.shot("122-12-fx-win-reduced-390.png");
    await R.close();

    /* 나머지 폭의 전투·승패·결과 증빙 (판정은 위 390 절이 이미 했다 — 여기서는 같은 화면을 다른 폭에서 촬영만 한다) */
    for(const vp of [{name:"desktop",width:1280,height:900,mobile:false},{name:"360",width:360,height:844,mobile:true}]){
      const V=await openTab(cdp,URL,vp,false);
      await V.ev(`tutSkip()`);
      await V.ev(setFixture); await sleep(1600);
      await V.ev(openBattle);
      for(let i=0;i<120&&await V.ev(`fxLocked()||(S.battle&&S.battle.msgQ.length>0)`);i++) await sleep(120);
      await sleep(220);
      await V.shot(`122-07-battle-${vp.name}.png`);
      await V.ev(`(()=>{ fxReleaseAll(); fxPlay({key:"resultBanner",kind:"result",cls:"win",title:"전투에서 승리!",sub:""}); return 1; })()`);
      await sleep(230); await V.shot(`122-08-fx-win-peak-${vp.name}.png`);
      await V.ev(`(()=>{ fxReleaseAll(); fxPlay({key:"resultBanner",kind:"result",cls:"lose",title:"전투에서 패배,,,",sub:""}); return 1; })()`);
      await sleep(230); await V.shot(`122-09-fx-lose-peak-${vp.name}.png`);
      await V.ev(`(()=>{ fxReleaseAll(); close(); S.battle=null; S.matchFxDone=false; gameOver(0,"king"); render(); return 1; })()`);
      await sleep(2700); await V.shot(`122-10-result-${vp.name}.png`);
      await V.close();
    }

  }catch(e){
    fail++; fails.push("예외: "+e.message);
    console.error("FAIL(예외) "+e.message);
  }finally{
    /* CLEANUP: 이 실행이 spawn 한 PID 와 이 실행이 mkdtemp 로 만든 **정확한 절대경로** 하나만 정리한다.
       접두사·와일드카드로 다른 주체의 자원을 건드리지 않는다 (v0.4.4 #106 · v0.4.7 #146 절차 위반의 재발 방지). */
    const pid=L.proc.pid, udd=L.udd;
    try{ L.proc.kill(); }catch(e){}
    await new Promise(r=>{ let n=0; const t=setInterval(()=>{ n++; if(L.proc.exitCode!==null||L.proc.signalCode||n>40){clearInterval(t);r();} },100); });
    let left=null;
    try{ fs.rmSync(udd,{recursive:true,force:true,maxRetries:6,retryDelay:200}); }catch(e){ left=e.message; }
    const stillThere=fs.existsSync(udd);
    console.log("CLEANUP  Chrome PID "+pid+" 종료 "+(L.proc.exitCode!==null||L.proc.signalCode?"확인":"미확인")
      +" · 프로필 "+udd+" "+(stillThere?("LEFTOVER"+(left?" ("+left+")":"")):"삭제"));
    if(!READ_ONLY){
      report.pass=pass; report.fail=fail; report.fails=fails;
      fs.writeFileSync(path.join(OUT,"ui_cdp_report.json"),JSON.stringify(report,null,2)+"\n");
      console.log("REPORT   "+path.relative(ROOT,path.join(OUT,"ui_cdp_report.json")).replace(/\\/g,"/"));
    }
    console.log(`=== ui_cdp (#122·#124·#126): pass ${pass} / fail ${fail} ===`+(fails.length?"\n실패: "+fails.join(" | "):""));
    process.exit(fail?1:0);
  }
})();
