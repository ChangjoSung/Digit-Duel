/* #122 CJ QA REVISE (2026-09-10) — 좌상단 뒤로가기 · 어두운 배경 실촬영 증빙 (헤드리스 Chrome · CDP · 실제 클릭)
   사용: node tools/milestone/v0.4.6/issues/122/back_dark_shots.js [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots]

   **좁은 증빙이다.** 같은 이슈의 demo/test/milestone/v0.4.6/issues/122/ui_cdp.js 가 이미 찍어 둔 43장(세로 레이아웃 전반·
   연출 갈래·수풀·왕/동료)을 다시 찍지 않는다. 이번 REVISE 두 가지 — (1) 좌상단 뒤로가기가 화면마다 실제로 보이고
   안전한 곳으로 가는가 (2) 화면 바탕·패널·하단 행동 영역·안내창이 실제로 어두운 계열이고 글자가 읽히는가 — 만 본다.

   무엇을 실측하는가 (헤드리스 하네스가 볼 수 없는 것):
     A. 실제 계산색 — #app·#actionDock·#boardInfo·.overlay .box·#msgBox 의 background-color 가 어두운가(휘도 상한),
        그 위 글자와의 대비비(WCAG 상대휘도)가 본문 4.5:1 · 큰 글자 3:1 을 넘는가.
     B. 가로 넘침 0 — 360·390·데스크톱에서 document.scrollWidth <= innerWidth.
     C. 뒤로가기 — 실제 마우스 클릭으로 로비→타이틀 · 배치→로스터 · 서랍 닫기 · 대전 중 기권 확인 · 결과→로비.
     D. 전투 패널 제목 옆 '← 뒤로' 가 하위 메뉴를 열었을 때 실제로 보이고 화면 위쪽에 있는가.

   소스: 현재 작업 트리의 demo/index.html 을 file:// 로 직접 연다. 본 바이트는 git blob sha1(LF 정규화)로 남긴다.
   --read-only: 산출물 0건(PNG·JSON 없음), stdout 만. 그 모드에서도 헤드리스 Chrome 임시 프로필(os.tmpdir()/i122bd-*)은
                만들고 **자기가 띄운 PID·자기가 만든 정확한 절대경로만** 종료 시 정리한다 (CLEANUP 행).
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 0. 종료 코드 1 = 판정 실패, 2 = 환경 오류. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.7","issues","122","Mars","revise-back-dark","media")));
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
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i122bd-"));
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
async function openTab(cdp,url,vp){
  const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
  const {sessionId}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
  const S=sessionId;
  await cdp.send("Page.enable",{},S); await cdp.send("Runtime.enable",{},S);
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:vp.width,height:vp.height,deviceScaleFactor:1,mobile:!!vp.mobile},S);
  await cdp.send("Page.navigate",{url},S);
  await sleep(700);
  const ev=async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},S);
    if(r.exceptionDetails) throw new Error("page error: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+"\nEXPR: "+expr.slice(0,300));
    return r.result.value; };
  const shot=async name=>{ if(!SHOTS) return null;
    const {data}=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false},S);
    const f=path.join(OUT,name); fs.writeFileSync(f,Buffer.from(data,"base64")); return name; };
  const clickAt=async box=>{ if(!box) return false;
    await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await sleep(160); return true; };
  const boxOf=async sel=>{ const r=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e||e.offsetParent===null) return null;
      e.scrollIntoView({block:"center",inline:"center"}); const r=e.getBoundingClientRect();
      return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`); await sleep(80); return r; };
  const clickSel=async sel=>clickAt(await boxOf(sel));
  const clickText=async (txt,scope)=>{
    const box=await ev(`(()=>{
      const root=document.querySelector(${JSON.stringify(scope||"body")}); if(!root) return null;
      const b=Array.prototype.slice.call(root.querySelectorAll("button")).filter(x=>!x.disabled&&x.offsetParent!==null).find(x=>x.textContent.indexOf(${JSON.stringify(txt)})>=0);
      if(!b) return null; b.scrollIntoView({block:"center",inline:"center"}); const r=b.getBoundingClientRect();
      return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`);
    await sleep(80); return clickAt(box); };
  const close=async()=>{ try{ await cdp.send("Target.closeTarget",{targetId}); }catch(e){} };
  return {S,ev,shot,clickSel,clickText,close};
}

/* 실제 계산색으로 재는 대비.
   **알파를 실제로 합성한다** — 반투명 표면(예: 이름표 알약 #0b0f18e0)은 그 아래 색과 섞인 뒤의 색이 눈에 보이는 색이다.
   조상 사슬을 위로 훑어 알파 1 인 색을 만나면 멈추고, 아래에서 위로 순서대로 섞어 내려온다.
   (PD 정정 2026-09-10: 종전 판은 알파 0.6 초과면 불투명으로 취급해 밝은 바탕과의 혼합을 빠뜨렸다.)
   surfaces: [라벨, 선택자, 글자 선택자(없으면 자기 자신), 큰 글자인가] */
const CONTRAST=`(()=>{
  const num=c=>{ const m=String(c).match(/[0-9.]+/g)||[]; return m.map(Number); };
  const lum=rgb=>{ const f=v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); };
    return 0.2126*f(rgb[0])+0.7152*f(rgb[1])+0.0722*f(rgb[2]); };
  const over=(fg,bg)=>{ const a=fg.length>3?fg[3]:1; return [0,1,2].map(i=>Math.round(fg[i]*a+bg[i]*(1-a))); };
  const solidBg=el=>{ const stack=[];
    for(let e=el;e;e=e.parentElement){ const p=num(getComputedStyle(e).backgroundColor);
      if(p.length<3) continue; const a=p.length>3?p[3]:1; if(a<=0) continue;
      stack.push(p); if(a>=1) break; }
    let out=[255,255,255];                       // 아무 색도 못 찾으면 뷰포트 기본(흰 종이)
    for(let i=stack.length-1;i>=0;i--) out=over(stack[i],out);
    return out; };
  const ratio=(a,b)=>{ const l1=lum(a),l2=lum(b); return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
  const out=[];
  for(const [label,sel,tsel,big] of __SURFACES__){
    const host=document.querySelector(sel); if(!host){ out.push({label,found:false}); continue; }
    const t=tsel?host.querySelector(tsel):host;
    const bg=solidBg(host);
    const fg=t?num(getComputedStyle(t).color).slice(0,3):[0,0,0];
    out.push({label,found:true,bg,fg,bgLum:+lum(bg).toFixed(4),ratio:+ratio(bg,fg).toFixed(2),big:!!big,
      text:t?(t.textContent||"").trim().slice(0,28):""});
  }
  return out;
})()`;
const surfaces=list=>CONTRAST.replace("__SURFACES__",JSON.stringify(list));

const OVERFLOW=`({docW:document.documentElement.scrollWidth, vw:window.innerWidth, bodyW:document.body.scrollWidth})`;
const SCREEN=`(()=>{const a=document.getElementById("app"),b=document.getElementById("btnBack");
  const ob=document.getElementById("overlay");
  return {screen:a.getAttribute("data-screen"), prep:a.getAttribute("data-prep"), drawer:a.getAttribute("data-drawer")||null,
    back:b&&b.offsetParent!==null?{txt:b.textContent.trim(),title:b.getAttribute("title")||"",
      box:(r=>({l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width)}))(b.getBoundingClientRect())}:null,
    modal:ob&&!ob.classList.contains("hidden")?(document.getElementById("overlayBox").textContent||"").trim().slice(0,60):null,
    phase:typeof S!=="undefined"&&S?S.phase:null};})()`;

/* 준비·대전 픽스처 — 규칙 함수만 쓰고 표시 상태만 만든다 (난수·저장소 무관, 시드 고정) */
const PREP_READY=`(()=>{ startMode("pve",{aiLevel:"grade5"}); setSeed(2026);
  fillRosterRandom(0); autoPlaceCore(0); uiPrep("place"); render(); return S.phase; })()`;
/* 보드·전투 픽스처는 **핫시트 PVP** 로 깐다. PVE 로 깔면 촬영·클릭이 오가는 몇 초 사이에 AI 차례가 진행돼
   턴바·전투 명령이 전부 disabled(=aiActor) 로 그려지고 실제 마우스 클릭이 닿지 않는다.
   보는 것은 색과 뒤로가기 흐름이므로 모드 선택이 판정에 영향을 주지 않는다 (규칙·난수 무관, 시드 고정). */
const PLAY_READY=`(()=>{ startMode("pvp"); setSeed(2026);
  fillRosterRandom(0); fillRosterRandom(1); aiAutoPlace(0); aiAutoPlace(1); beginPlay();
  fxReleaseAll(); close(); S.current=0; render(); return S.phase; })()`;
/* 전투 픽스처는 **스스로 판을 새로 깐다** — 앞 단계에서 게임이 흘러갔을 수 있다. */
const BATTLE_READY=`(()=>{ startMode("pvp"); setSeed(2026);
  fillRosterRandom(0); fillRosterRandom(1); aiAutoPlace(0); aiAutoPlace(1); beginPlay();
  fxReleaseAll(); close(); S.battle=null;
  const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive);
  const em=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
  S.current=0; S.mainUsed=false; S.battlesUsed=0;
  startRounds(me,em,me,em); fxReleaseAll(); render(); battleModal(); return !!S.battle; })()`;
const RESULT_READY=`(()=>{ fxReleaseAll(); close(); S.battle=null; S.matchFxDone=false; gameOver(0,"king"); render(); return S.phase; })()`;

const report={tool:"back_dark_shots.js",when:new Date().toISOString(),
  source:{file:"demo/index.html",blobSha1:blobHashNormalized(HTML)},
  chrome:CHROME, readOnly:READ_ONLY, shots:[], checks:{}};

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const L=await launch();
  const cdp=new CDP(new WebSocket(L.ws));
  await new Promise(r=>{ cdp.ws.onopen=r; });
  const url="file:///"+HTML.replace(/\\/g,"/");
  try{
    /* ── 390 (기준 폭) — 화면 흐름과 어두운 표면 ─────────────────── */
    const T=await openTab(cdp,url,{width:390,height:844,mobile:true});
    await T.ev(`tutClose()`); await sleep(200);

    /* 타이틀: 이전 화면이 없으므로 뒤로가기가 없다 */
    let st=await T.ev(SCREEN);
    ok(st.screen==="title"&&!st.back,"C1 타이틀에는 뒤로가기가 없다 (상단 바 자체가 없다)");

    await T.clickText("대전 시작"); await sleep(300);
    st=await T.ev(SCREEN);
    ok(st.screen==="lobby"&&st.back&&/타이틀/.test(st.back.txt),"C2 로비 좌상단에 [← 타이틀]이 보인다");
    ok(st.back.box.l<=12,"C3 뒤로가기가 화면 좌상단이다 (left="+st.back.box.l+"px)");
    report.checks.lobbyBack=st.back;
    let sur=await T.ev(surfaces([["앱 바탕","#app",".lobbyCard h2",false],["로비 카드","#sidePanel .lobbyCard",".lobbyCard small",false],
      ["기본 버튼","#sidePanel button.big",null,true]]));
    report.checks.lobbySurfaces=sur;
    for(const s of sur){
      ok(s.found&&s.bgLum<0.22,"D1 "+s.label+" 배경이 어둡다 (휘도 "+(s.found?s.bgLum:"없음")+")");
      ok(s.found&&s.ratio>=(s.big?3:4.5),"D2 "+s.label+" 글자 대비 "+(s.found?s.ratio:"없음")+":1");
    }
    let ov=await T.ev(OVERFLOW); report.checks.overflow390=ov;
    ok(ov.docW<=ov.vw,"B1 390 로비 가로 넘침 없음 ("+ov.docW+"/"+ov.vw+")");
    report.shots.push(await T.shot("01-lobby-390.png"));

    /* 로비 → 타이틀 (실제 클릭) */
    await T.clickSel("#btnBack");
    st=await T.ev(SCREEN);
    ok(st.screen==="title","C4 로비 뒤로가기 → 타이틀");
    await T.clickText("대전 시작"); await sleep(250);

    /* 출전 준비 — 배치 단계 → 로스터 단계 (선택 보존) */
    await T.ev(PREP_READY); await sleep(300);
    st=await T.ev(SCREEN);
    ok(st.screen==="prep"&&st.prep==="place"&&/로스터/.test(st.back.txt),"C5 배치 단계 뒤로가기 = [← 로스터]");
    report.shots.push(await T.shot("02-prep-place-390.png"));
    const roster0=await T.ev(`S.roster[0].join()`);
    await T.clickSel("#btnBack");
    st=await T.ev(SCREEN);
    const roster1=await T.ev(`S.roster[0].join()`);
    ok(st.prep==="roster"&&st.screen==="prep","C6 배치 → 로스터 단계로만 돌아간다");
    ok(roster0===roster1&&roster0.length>0,"C7 고른 로스터가 그대로 남는다");
    report.shots.push(await T.shot("03-prep-roster-390.png"));

    /* 로스터 단계 뒤로가기 → 준비 취소 확인 (어두운 안내창) */
    await T.clickSel("#btnBack"); await sleep(200);
    st=await T.ev(SCREEN);
    ok(st.modal&&/로비로 돌아가기/.test(st.modal),"C8 준비한 내용이 있으면 확인창을 연다");
    ok(st.phase==="setup","C9 확인 전에는 준비가 그대로 (즉시 나가지 않는다)");
    sur=await T.ev(surfaces([["확인창","#overlay .box","h2",true],["확인창 본문","#overlay .box","p",false],["확인 버튼","#obBtns button",null,false]]));
    report.checks.confirmSurfaces=sur;
    for(const s of sur){
      ok(s.found&&s.bgLum<0.22,"D3 "+s.label+" 배경이 어둡다 (휘도 "+(s.found?s.bgLum:"없음")+")");
      ok(s.found&&s.ratio>=(s.big?3:4.5),"D4 "+s.label+" 글자 대비 "+(s.found?s.ratio:"없음")+":1");
    }
    report.shots.push(await T.shot("04-prep-confirm-390.png"));
    await T.clickText("계속 준비하기"); await sleep(200);
    ok((await T.ev(`S.roster[0].join()`))===roster0,"C10 [계속 준비하기]는 아무것도 지우지 않는다");

    /* 보드 — 어두운 판·상태 줄·하단 행동 독 */
    await T.ev(PLAY_READY); await sleep(450);
    await T.ev(`fxReleaseAll(); close(); render();`); await sleep(250);
    st=await T.ev(SCREEN);
    ok(st.screen==="board"&&st.back,"C11 보드 화면에도 좌상단 뒤로가기가 있다");
    sur=await T.ev(surfaces([["상태 줄","#boardInfo",".who",false],["하단 행동 독","#actionDock","button",false],
      ["일반 칸","#board .cell:not(.forest)",null,false]]));
    report.checks.boardSurfaces=sur;
    for(const s of sur){ ok(s.found&&s.bgLum<0.25,"D5 "+s.label+" 배경이 어둡다 (휘도 "+(s.found?s.bgLum:"없음")+")"); }
    ok(sur[0].ratio>=4.5&&sur[1].ratio>=4.5,"D6 상태 줄·행동 독 글자 대비 "+sur[0].ratio+" / "+sur[1].ratio+":1");
    ov=await T.ev(OVERFLOW); report.checks.overflowBoard390=ov;
    ok(ov.docW<=ov.vw,"B2 390 보드 가로 넘침 없음 ("+ov.docW+"/"+ov.vw+")");
    report.shots.push(await T.shot("05-board-390.png"));

    /* 서랍 우선 — 뒤로가기는 서랍부터 닫는다 */
    await T.clickSel("#btnDrawerLog"); await sleep(250);
    st=await T.ev(SCREEN);
    ok(st.drawer==="log"&&/닫기/.test(st.back.txt),"C12 서랍이 열리면 뒤로가기 문구가 [← 닫기]");
    report.shots.push(await T.shot("06-board-drawer-390.png"));
    await T.clickSel("#btnBack"); await sleep(200);
    st=await T.ev(SCREEN);
    ok(!st.drawer&&st.screen==="board"&&!st.modal,"C13 서랍만 닫고 화면·게임은 그대로 (기권 확인 없음)");

    /* 대전 중 뒤로가기 = 기존 기권 확인 */
    await T.clickSel("#btnBack"); await sleep(250);
    st=await T.ev(SCREEN);
    ok(st.modal&&/기권/.test(st.modal),"C14 대전 중 뒤로가기 → 기존 기권 확인");
    ok(st.phase==="play","C15 확인 전에는 경기가 그대로 진행 중");
    report.shots.push(await T.shot("07-resign-confirm-390.png"));
    await T.clickText("취소"); await sleep(200);
    st=await T.ev(SCREEN);
    ok(!st.modal&&st.phase==="play","C16 취소하면 경기가 이어진다");

    /* 전투 화면 — 어두운 무대·HP 판·메시지 창 + 제목 옆 '← 뒤로' */
    await T.ev(BATTLE_READY); await sleep(400);
    /* 내 전투 행동 차례에서 명령이 실제로 눌리는 상태가 될 때까지 기다린다 (연출·메시지 큐·잠금 클래스 전부) */
    for(let i=0;i<70;i++){
      const rdy=await T.ev(`(()=>{ if(!S.battle) return false; if(fxLocked()||document.body.classList.contains("fx-lock")) return false;
        if(S.battle.msgQ&&S.battle.msgQ.length) return false;
        const b=document.querySelector("#bmenu button"); return !!(b&&!b.disabled&&b.offsetParent!==null); })()`);
      if(rdy) break; await sleep(120);
    }
    await sleep(200);
    let bh=await T.ev(`(()=>{const b=document.getElementById("bmenuBack");
      return {exists:!!b, visible:!!(b&&b.offsetParent!==null), top:b?Math.round(b.getBoundingClientRect().top):null,
        left:b?Math.round(b.getBoundingClientRect().left):null};})()`);
    ok(bh.exists&&!bh.visible,"C17 하위 메뉴가 닫혀 있으면 전투 '← 뒤로'는 보이지 않는다");
    const fightClicked=await T.clickText("싸우기","#bmenu"); await sleep(250);
    ok(fightClicked,"C18a 전투 명령 [⚔️ 싸우기]를 실제 마우스로 눌렀다");
    report.checks.battleMenuProbe=await T.ev(`(()=>{const bm=document.getElementById("bmenu");
      return {bmenuCls:bm?bm.className:null, body:document.body.className, fx:document.getElementById("fxBanner").className,
        btns:bm?Array.from(bm.querySelectorAll("button")).map(b=>b.textContent.trim()+(b.disabled?"(disabled)":"")+(b.offsetParent===null?"(hidden)":"")):null,
        locked:fxLocked(), menu:S.battle?S.battle.menu:null};})()`);
    console.log("PROBE   "+JSON.stringify(report.checks.battleMenuProbe));
    bh=await T.ev(`(()=>{const b=document.getElementById("bmenuBack"), ob=document.getElementById("overlayBox");
      const r=b.getBoundingClientRect(), o=ob.getBoundingClientRect();
      return {visible:b.offsetParent!==null, top:Math.round(r.top), left:Math.round(r.left),
        fromBoxTop:Math.round(r.top-o.top), fromBoxLeft:Math.round(r.left-o.left), sub:!document.getElementById("bsub-fight").classList.contains("hidden")};})()`);
    report.checks.battleBack=bh;
    ok(bh.visible&&bh.sub,"C18 하위 메뉴를 열면 전투 패널 '← 뒤로'가 보인다");
    ok(bh.fromBoxTop<=40&&bh.fromBoxLeft<=40,"C19 그 버튼이 전투 패널 좌상단(제목 옆)에 있다 (상단 "+bh.fromBoxTop+"px · 좌측 "+bh.fromBoxLeft+"px)");
    sur=await T.ev(surfaces([["전투 무대","#bstage",null,false],["전투 HP 판",".bslot.slot-me .fighter","b",false],
      ["전투 메시지","#msgBox",null,false],["명령 버튼","#bsub-fight button",null,false]]));
    report.checks.battleSurfaces=sur;
    for(const s of sur){ ok(s.found&&s.bgLum<0.25,"D7 "+s.label+" 배경이 어둡다 (휘도 "+(s.found?s.bgLum:"없음")+")"); }
    for(const s of sur.slice(1)){ ok(s.ratio>=4.5,"D8 "+s.label+" 글자 대비 "+s.ratio+":1"); }
    ov=await T.ev(OVERFLOW); report.checks.overflowBattle390=ov;
    ok(ov.docW<=ov.vw,"B3 390 전투 가로 넘침 없음 ("+ov.docW+"/"+ov.vw+")");
    report.shots.push(await T.shot("08-battle-390.png"));
    await T.clickSel("#bmenuBack"); await sleep(200);
    ok(await T.ev(`document.getElementById("bsub-fight").classList.contains("hidden")&&!document.getElementById("bmenuBack").offsetParent`),
      "C20 전투 '← 뒤로'는 하위 메뉴만 닫는다 (전투에서 빠져나가지 않는다)");
    ok(await T.ev(`!!S.battle&&S.phase==="play"`),"C21 전투는 그대로 진행 중이다");

    /* sim 관전 종료 — **실제 브라우저의 실제 타이머**로 확인한다 (헤드리스 회귀는 가짜 타이머라 이 사실을 못 본다).
       확인창이 AI 진행에 밀리지 않고 남아 있는가 · 취소하면 관전이 이어지는가 · 확정하면 로비로 가는가. */
    await T.ev(`(()=>{ fxReleaseAll(); close(); S.battle=null; startMode("sim"); return S.phase; })()`);
    for(let i=0;i<60&&await T.ev(`S.phase!=="play"`);i++) await sleep(120);
    await sleep(300);
    await T.clickSel("#btnBack"); await sleep(300);
    let sim=await T.ev(SCREEN);
    ok(sim.modal&&/관전/.test(sim.modal),"S1 sim 관전에서 뒤로가기 → 관전 종료 확인창");
    const simTurn=await T.ev(`S.turnCount`);
    await sleep(2200);                                  // 실제 simDelay 여러 번을 흘려 보낸다
    sim=await T.ev(SCREEN);
    const simTurn2=await T.ev(`S.turnCount`);
    ok(sim.modal&&/관전/.test(sim.modal),"S2 실제 타이머가 흘러도 확인창이 AI 진행에 밀리지 않는다");
    ok(simTurn2===simTurn,"S3 확인창이 떠 있는 동안 AI 가 수를 두지 않는다 (턴 "+simTurn+" 유지)");
    report.shots.push(await T.shot("13-sim-confirm-390.png"));
    await T.clickText("계속 관전"); await sleep(2200);
    const simTurn3=await T.ev(`S.turnCount`);
    ok(await T.ev(`S.phase==="play"`),"S4 [계속 관전]이면 관전이 이어진다");
    ok(simTurn3>simTurn2,"S5 취소 뒤 AI 가 다시 둔다 (턴 "+simTurn2+" → "+simTurn3+")");
    await T.clickSel("#btnBack"); await sleep(300);
    await T.clickText("로비로 돌아가기"); await sleep(500);
    ok(await T.ev(`S.phase==="menu"`)&&(await T.ev(SCREEN)).screen==="lobby","S6 확정하면 로비로 돌아간다");
    await sleep(1200);
    ok(await T.ev(`S.phase==="menu"`),"S7 남아 있던 AI 예약이 로비를 오염시키지 않는다");

    /* 아트 폴백 전투 토큰 — 원형 바탕이 속성색(가장 밝은 번개 #ffd84d 포함)일 때 이름표가 읽히는지.
       실제 실패 경로(ART.failed)를 그대로 쓴다: 자산 폴더를 실패로 표시하면 제품이 스스로 이모지 토큰으로 되돌아간다. */
    const fb=await T.ev(`(()=>{
      fxReleaseAll(); close(); S.battle=null;
      /* 번개(가장 밝은 #ffd84d) 하수인과 불 하수인이 실제로 판에 설 때까지 시드만 바꿔 가며 정상 경로로 판을 깐다 */
      let me=null, em=null;
      for(let seed=1;seed<=60&&!(me&&em);seed++){
        startMode("pvp"); setSeed(seed);
        fillRosterRandom(0); fillRosterRandom(1); aiAutoPlace(0); aiAutoPlace(1); beginPlay();
        me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive&&x.element==="lightning")||null;
        em=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive&&x.element==="fire")||null;
      }
      if(!me) me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive);
      if(!em) em=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
      /* 두 전투원의 종 폴더를 실제 실패 집합에 넣는다 — 제품의 폴백 분기가 그대로 탄다 (자산 파일을 건드리지 않는다) */
      for(const d of [artDirOf(me),artDirOf(em)]) if(d) ART.failed.add(d);
      S.current=0; S.mainUsed=false; S.battlesUsed=0;
      startRounds(me,em,me,em); fxReleaseAll(); render(); battleModal();
      return {me:me.element||null, op:em.element||null};
    })()`);
    for(let i=0;i<70;i++){
      const rdy=await T.ev(`(()=>{ if(!S.battle) return false; if(fxLocked()||document.body.classList.contains("fx-lock")) return false;
        if(S.battle.msgQ&&S.battle.msgQ.length) return false; return !!document.querySelector("#bstage .btok"); })()`);
      if(rdy) break; await sleep(120);
    }
    await sleep(250);
    const fbTok=await T.ev(`(()=>{
      const num=c=>{const m=String(c).match(/[0-9.]+/g)||[];return m.map(Number);};
      const lum=r=>{const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
        return 0.2126*f(r[0])+0.7152*f(r[1])+0.0722*f(r[2]);};
      const over=(fg,bg)=>{const a=fg.length>3?fg[3]:1; return [0,1,2].map(i=>Math.round(fg[i]*a+bg[i]*(1-a)));};
      /* 이름표 알약은 반투명이라 **아래의 밝은 속성색과 섞인 뒤**의 색이 실제로 보이는 색이다 — 그 색으로 잰다 */
      const solid=el=>{const stack=[];
        for(let e=el;e;e=e.parentElement){const p=num(getComputedStyle(e).backgroundColor);
          if(p.length<3) continue; const a=p.length>3?p[3]:1; if(a<=0) continue; stack.push(p); if(a>=1) break;}
        let out=[255,255,255]; for(let i=stack.length-1;i>=0;i--) out=over(stack[i],out); return out;};
      const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
      return Array.prototype.slice.call(document.querySelectorAll("#bstage .btok")).map(t=>{
        const sm=t.querySelector("small");
        return {id:t.id, art:t.classList.contains("art"), circleBg:getComputedStyle(t).backgroundColor,
          label:sm?sm.textContent.trim():null, labelBg:sm?getComputedStyle(sm).backgroundColor:null,
          labelBgComposited:sm?solid(sm):null,
          ratio:sm?+ratio(solid(sm),num(getComputedStyle(sm).color).slice(0,3)).toFixed(2):null};});
    })()`);
    report.checks.fallbackTokens={picked:fb,tokens:fbTok};
    ok(fbTok.length>0&&fbTok.every(t=>!t.art),"F1 자산 실패 시 원형 이모지 폴백 토큰으로 되돌아간다");
    ok(fbTok.every(t=>t.ratio!==null&&t.ratio>=4.5),
      "F2 밝은 속성색 원형(번개 포함) 위 이름표 대비 "+fbTok.map(t=>t.label+" "+t.ratio+":1").join(" · "));
    report.shots.push(await T.shot("12-battle-fallback-390.png"));

    /* 수풀 속 양측 말 — 어두운 수풀 위에서도 반투명 말이 보이는지 (CJ 요구: 양측 수풀 반투명 유지) */
    const bush=await T.ev(`(()=>{
      fxReleaseAll(); close(); S.battle=null;
      startMode("pvp"); setSeed(2026); fillRosterRandom(0); fillRosterRandom(1); aiAutoPlace(0); aiAutoPlace(1); beginPlay();
      const mine=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive);
      const foe=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
      for(const x of S.pieces) x.placed=false;
      mine.r=9; mine.c=4; mine.placed=true;
      foe.r=9; foe.c=5; foe.placed=true;                 // 내 말과 인접 → 위치는 보이고 정체는 미공개
      const k=S.pieces.find(x=>x.owner===0&&x.type==="king"); k.r=13; k.c=1; k.placed=true;
      S.current=0; S.phase="play"; fxReleaseAll(); close(); render();
      const cell=(r,c)=>document.querySelector('#board .cell[data-r="'+r+'"][data-c="'+c+'"]');
      const chip=(r,c)=>{const e=cell(r,c); return e?e.querySelector(".pc"):null;};
      const a=chip(9,4), b=chip(9,5);
      const of=e=>{ if(!e) return null; const cs=getComputedStyle(e), pre=getComputedStyle(e,"::before");
        const ico=e.querySelector(".icon,.face");
        return {inbush:e.classList.contains("inbush"), cardOpacity:pre.opacity, bodyOpacity:ico?getComputedStyle(ico).opacity:null,
          body:ico?ico.className:null, inner:e.innerHTML.slice(0,80),
          forestBg:getComputedStyle(cell(9,4)).backgroundColor}; };
      return {mine:of(a), foe:of(b)};
    })()`);
    await sleep(250);
    report.checks.bush=bush;
    ok(bush.mine&&bush.mine.inbush&&bush.foe&&bush.foe.inbush,"E1 내 말·상대 말 모두 수풀 표시(.inbush)를 받는다");
    ok(bush.mine.cardOpacity==="0.5"&&bush.foe.cardOpacity==="0.5","E2 양측 카드 바탕 반투명 50% 불변 ("+bush.mine.cardOpacity+" / "+bush.foe.cardOpacity+")");
    /* 미공개 상대 말은 아이콘·얼굴 요소 없이 '?' 만 그리므로 본체 요소가 없을 수 있다 — 있는 쪽만 값을 확인한다 */
    const bodies=[bush.mine.bodyOpacity,bush.foe.bodyOpacity].filter(v=>v!==null);
    ok(bodies.length>0&&bodies.every(v=>v==="0.7"),"E3 수풀 속 본체 불투명 70% 불변 ("+bodies.join(" / ")+")");
    report.shots.push(await T.shot("11-bush-390.png"));

    /* 결과 화면 → 로비 */
    await T.ev(RESULT_READY); await sleep(2700);
    st=await T.ev(SCREEN);
    ok(st.screen==="result"&&/로비/.test(st.back.txt),"C22 결과 화면 뒤로가기 = [← 로비]");
    report.shots.push(await T.shot("09-result-390.png"));
    await T.clickSel("#btnBack"); await sleep(300);
    st=await T.ev(SCREEN);
    ok(st.screen==="lobby"&&st.phase==="menu","C23 결과 뒤로가기 → 같은 문서 로비");
    ok(await T.ev(`!document.getElementById("tutOverlay").classList.contains("hidden")===false`),
      "C24 로비 복귀로 튜토리얼이 다시 뜨지 않는다 (#128 정책 불변)");
    await T.close();

    /* ── 360 · 데스크톱 — 같은 어두운 화면에서 가로 넘침만 다시 실측 ─── */
    for(const vp of [{name:"360",width:360,height:800,mobile:true},{name:"desktop",width:1280,height:900,mobile:false}]){
      const V=await openTab(cdp,url,vp);
      await V.ev(`tutClose()`); await sleep(200);
      await V.ev(`uiStart()`); await sleep(200);
      let o1=await V.ev(OVERFLOW);
      ok(o1.docW<=o1.vw,"B4 "+vp.name+" 로비 가로 넘침 없음 ("+o1.docW+"/"+o1.vw+")");
      await V.ev(PLAY_READY); await sleep(450);
      await V.ev(`fxReleaseAll(); close(); render();`); await sleep(250);
      let o2=await V.ev(OVERFLOW);
      ok(o2.docW<=o2.vw,"B5 "+vp.name+" 보드 가로 넘침 없음 ("+o2.docW+"/"+o2.vw+")");
      const s2=await V.ev(SCREEN);
      ok(!!s2.back&&s2.back.box.l<=Math.round(vp.width/2),"C25 "+vp.name+" 보드에도 좌상단 뒤로가기가 보인다 (left="+(s2.back?s2.back.box.l:"없음")+"px)");
      report.checks["overflow"+vp.name]={lobby:o1,board:o2,back:s2.back};
      report.shots.push(await V.shot("10-board-"+vp.name+".png"));
      await V.close();
    }
  }catch(e){
    fail++; fails.push("예외: "+e.message);
    console.error("FAIL(예외) "+e.message+"\n"+e.stack);
  }finally{
    /* CLEANUP: 이 실행이 spawn 한 PID 와 이 실행이 mkdtemp 로 만든 **정확한 절대경로** 하나만 정리한다. */
    const pid=L.proc.pid, udd=L.udd;
    try{ L.proc.kill(); }catch(e){}
    await new Promise(r=>{ let n=0; const t=setInterval(()=>{ n++; if(L.proc.exitCode!==null||L.proc.signalCode||n>40){clearInterval(t);r();} },100); });
    let left=null;
    try{ fs.rmSync(udd,{recursive:true,force:true,maxRetries:6,retryDelay:200}); }catch(e){ left=e.message; }
    console.log("CLEANUP  Chrome PID "+pid+" 종료 "+(L.proc.exitCode!==null||L.proc.signalCode?"확인":"미확인")
      +" · 프로필 "+udd+" "+(fs.existsSync(udd)?("LEFTOVER"+(left?" ("+left+")":"")):"삭제"));
    if(!READ_ONLY){
      report.pass=pass; report.fail=fail; report.fails=fails;
      report.shots=report.shots.filter(Boolean);
      const f=path.join(OUT,"back_dark_report.json");
      fs.writeFileSync(f,JSON.stringify(report,null,2)+"\n");
      console.log("REPORT   "+path.relative(ROOT,f).replace(/\\/g,"/")+" · PNG "+report.shots.length+"장");
    }
    console.log(`=== back_dark_shots (#122 REVISE): pass ${pass} / fail ${fail} ===`+(fails.length?"\n실패: "+fails.join(" | "):""));
    process.exit(fail?1:0);
  }
})();
