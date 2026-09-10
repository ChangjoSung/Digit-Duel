/* #121 · #125 · #129 — 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 DOM 클릭 · 페이지의 실제 setTimeout)
   사용: node demo/test/milestone/v0.4.6/issues/121/v047_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots] [--tutorial] [--ref <sha>]

   무엇을 보는가 (헤드리스 하네스가 볼 수 없는 것만):
     1. #125 연출 시간 — 배너·전투 연출이 **실제 브라우저 타이머**로 1.2초 유지되는지. 체감이 아니라
        performance.now() 기준 잠금 유지·해제 시각과 **CSS getComputedStyle 의 animation/transition duration** 을 읽는다.
     2. #125 보호막 → HP 2단 — 실제 CSS 전환(.35s)이 damageFx(1200ms) 안에서 끝나고, 입력 잠금이 그 전에 풀리지 않는지.
     3. #121 탐색 보상 — 실제 클릭으로 기술 교체 3단계(기술 → 대상 말 → 슬롯)를 완주하고 슬롯·쿨 승계를 확인.
     4. #121 전투 버프 — 가방에서 개봉 → 버프 적용 → **토큰 주변 CSS 효과가 실제로 계산되는지**(getComputedStyle).
     5. #129 — 탐색 완료 뒤 결과 연출 1.2초 끝점에서 턴이 **정확히 한 번** 끝나는지 (추가 1초 유예 없음).
     6. 비공개 DOM — 온라인 비소유자 시점과 PVE AI 차례에서 상대 아이템·볼·패키지가 **실제 DOM 에 없는지** 문자열로 확인한다.
        한계: 같은 탭에서 NET.me·행동자만 바꿔 **그 시점의 DOM** 을 보는 검사다. 두 기기·실제 릴레이를 통한 온라인 종단간 검증이 아니다.
     7. --tutorial-check: 제품 튜토리얼 10단계를 실제로 넘기며 **렌더 계약만** 확인한다 (카드 수 = 문단 수, 새 규칙 렌더).
        README 용 PNG 10장과 capture-manifest.json 은 이 도구가 만들지 않는다 — 기존 tools/media/readme_media_capture.js capture
        가 그 형식(env.ref/refSha·frames)을 소유하고 CI 의 verify 가 그 형식을 읽는다. 여기서 중복 캡처하지 않는다.

   소스: **현재 작업 트리**의 demo/index.html 을 file:// 로 직접 연다. 어떤 바이트를 봤는지 증명하기 위해 그 파일의
   git blob hash(sha1 · git 텍스트 필터 적용 후 = 커밋되는 바이트)를 계산해 보고서·stdout 에 남긴다.
   --ref <sha> 를 주면 그 커밋의 demo/index.html blob 과 **같은 바이트인지 대조**한다. 같으면 작업 트리를 그대로 열고
   (같은 바이트이므로 ref 캡처와 동일), 다르면 그 ref 의 내용을 임시 파일로 꺼내 **ref 쪽을 캡처**하고 그 사실을 기록한다.
   어느 경로든 보고서에 sourceSha1·refSha1·servedFrom 을 남겨 무엇을 촬영했는지 뒤에서 확인할 수 있다.

   --read-only: Saturn 독립 재검증용 — 산출물 0건(스크린샷·JSON 없음), stdout 만. 그 모드에서도 헤드리스 Chrome
                임시 프로필(os.tmpdir()/v047cdp-*)은 만들고 종료 시 스스로 정리한다(RESOURCE/CLEANUP 행).
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 0. 종료 코드 1 = 판정 실패, 2 = 환경 오류. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.7","issues","121","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const DO_TUT=args.includes("--tutorial-check")||args.includes("--tutorial"); // --tutorial 은 과거 이름 (같은 검사, 캡처 없음)
const REF=opt("--ref",null);
const CHROME=opt("--chrome",[process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(ROOT,"demo","index.html"));
const VP={width:1280,height:1000};

/* git blob hash — 이 도구가 실제로 본 바이트의 신원.
   git 은 /demo/index.html 에 `text eol=crlf` 를 걸어 두어 **작업 트리는 CRLF · 저장된 blob 은 LF** 다.
   커밋 blob 과 비교하려면 같은 정규화를 거친 바이트를 해시해야 하므로 CRLF → LF 로 맞춘 뒤 계산한다. */
function blobHashNormalized(file){ const raw=fs.readFileSync(file);
  const b=Buffer.from(raw.toString("utf8").replace(/\r\n/g,"\n"),"utf8");
  return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0","utf8"),b])).digest("hex"); }
function gitOut(a){ try{ return require("child_process").execFileSync("git",a,{cwd:ROOT,encoding:"utf8"}).trim(); }catch(e){ return null; } }

let pass=0,fail=0; const fails=[], notes=[];
function ok(cond,name){ if(cond){pass++; console.log("PASS "+name);} else {fail++; fails.push(name); console.error("FAIL "+name);} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"v047cdp-"));
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
async function openTab(cdp,url){
  const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
  const {sessionId}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
  const S=sessionId;
  await cdp.send("Page.enable",{},S); await cdp.send("Runtime.enable",{},S);
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.width,height:VP.height,deviceScaleFactor:1,mobile:false},S);
  await cdp.send("Page.navigate",{url},S);
  await sleep(900);
  const ev=async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},S);
    if(r.exceptionDetails) throw new Error("page error: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+"\nEXPR: "+expr.slice(0,300));
    return r.result.value; };
  const shot=async name=>{ if(!SHOTS) return null;
    const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},S);
    const f=path.join(OUT,name); fs.writeFileSync(f,Buffer.from(data,"base64")); return f; };
  /* 실제 마우스 클릭 (CSS 선택자의 화면 중심) — 합성 click() 이 아니라 입력 장치 경로를 탄다 */
  const clickSel=async sel=>{ const box=await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`);
    if(!box) return false;
    await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:box.x,y:box.y,button:"left",clickCount:1},S);
    return true; };
  /* 버튼 텍스트로 실제 클릭 */
  const clickText=async (txt,scope)=>{ const box=await ev(`(()=>{
      const root=document.querySelector(${JSON.stringify(scope||"body")}); if(!root) return null;
      const b=Array.prototype.slice.call(root.querySelectorAll("button")).filter(x=>!x.disabled).reverse().find(x=>x.textContent.indexOf(${JSON.stringify(txt)})>=0);
      if(!b) return null; const r=b.getBoundingClientRect(); return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`);
    if(!box) return false;
    await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:box.x,y:box.y,button:"left",clickCount:1},S);
    return true; };
  return {S,ev,shot,clickSel,clickText};
}

(async()=>{
  const HASH=blobHashNormalized(HTML);
  let served=HTML, servedFrom="작업 트리", refHash=null, tmpRef=null;
  if(REF){
    refHash=gitOut(["rev-parse",REF+":demo/index.html"]);
    if(!refHash){ console.error("--ref "+REF+" 의 demo/index.html 을 읽지 못했습니다"); process.exit(2); }
    if(refHash===HASH) servedFrom="작업 트리 (== --ref "+REF.slice(0,12)+" blob, 같은 바이트)";
    else{ /* 작업 트리가 ref 와 다르다 — 지정된 ref 쪽을 캡처한다 (증빙의 기준을 ref 로 고정) */
      const body=require("child_process").execFileSync("git",["show",REF+":demo/index.html"],{cwd:ROOT,maxBuffer:1<<28});
      tmpRef=path.join(fs.mkdtempSync(path.join(os.tmpdir(),"v047ref-")),"index.html");
      fs.writeFileSync(tmpRef,body); served=tmpRef; servedFrom="--ref "+REF.slice(0,12)+" (작업 트리와 다름 — ref 를 촬영)";
      /* 상대경로 자산(demo/assets/minions/)을 그대로 쓰기 위해 같은 폴더 구조를 흉내 낸다 */
      try{ fs.symlinkSync(path.join(ROOT,"demo","assets"),path.join(path.dirname(tmpRef),"assets"),"junction"); }catch(e){}
    }
  }
  console.log("SOURCE  "+path.relative(ROOT,HTML).replace(/\\/g,"/")+"  blob sha1 "+HASH);
  if(REF) console.log("REF     "+REF+"  blob "+refHash+(refHash===HASH?"  (일치)":"  (불일치 — ref 를 촬영)"));
  console.log("SERVED  "+servedFrom);
  console.log("MODE    "+(READ_ONLY?"read-only (산출물 0건)":"out="+path.relative(ROOT,OUT).replace(/\\/g,"/"))+(DO_TUT?" +tutorial":""));
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const L=await launch();
  console.log("RESOURCE 헤드리스 Chrome 임시 프로필 "+L.udd);
  const cdp=new CDP(new WebSocket(L.ws));
  await new Promise(r=>{ const t=setInterval(()=>{ if(cdp.ws.readyState===1){clearInterval(t);r();} },30); });
  const T=await openTab(cdp,"file:///"+served.replace(/\\/g,"/"));
  const report={source:path.relative(ROOT,HTML).replace(/\\/g,"/"),blobSha1:HASH,ref:REF||null,refBlobSha1:refHash,servedFrom,
    at:new Date().toISOString(),tool:"demo/test/milestone/v0.4.6/issues/121/v047_cdp.js",checks:[]};
  const rec=(k,v)=>{ report.checks.push({k,v}); console.log("  · "+k+": "+(typeof v==="object"?JSON.stringify(v):v)); };

  try{
    /* ── 0. 튜토리얼을 건너뛰고 PVE 시작 ─────────────────────────────────── */
    await T.ev(`(()=>{ try{localStorage.setItem("dd_tut_seen_v1","1");}catch(e){} return 1; })()`);
    const tutKey=await T.ev(`typeof TUT_KEY!=="undefined"?TUT_KEY:null`);
    await T.ev(`(()=>{ try{ if(TUT_KEY) localStorage.setItem(TUT_KEY,"1"); }catch(e){} tutSkip(); return 1; })()`);
    ok(await T.ev(`typeof BAL!=="undefined"&&typeof EVENT_KINDS!=="undefined"`),"0a 페이지 로드·v0.4.7 심볼 존재 (EVENT_KINDS)");
    rec("TUT_KEY",tutKey);

    /* ── 1. #125 연출 시간표와 CSS 가 실제 브라우저에서 일치 ──────────────── */
    const fx=await T.ev(`JSON.stringify(BAL.fx)`);
    const fxo=JSON.parse(fx);
    const twelve=["turnBanner","contactBanner","explosion","trapFx","roundBanner","skillFx","damageFx","itemFx","captureFx","fleeFx","judgeBanner","pushBanner"];
    ok(twelve.every(k=>fxo[k]===1200),"1a 연출 시간표 12키 = 1200ms (브라우저에서 읽은 값)");
    ok(fxo.barStep===350&&fxo.resultBanner===2500&&fxo.countStep===1000&&fxo.msgStep===600&&fxo.watchdog===1000,"1b barStep 350 · 유지 대상 무변경");
    rec("BAL.fx",fxo);
    /* 실제 CSS 계산값 — 애니메이션·전환 지속 시간을 브라우저가 파싱한 결과로 읽는다 (소스 문자열이 아니다) */
    const css=await T.ev(`(()=>{
      const mk=(tag,cls)=>{ const e=document.createElement(tag); e.className=cls; document.body.appendChild(e); const s=getComputedStyle(e);
        const o={animationName:s.animationName,animationDuration:s.animationDuration,transitionProperty:s.transitionProperty,transitionDuration:s.transitionDuration}; e.remove(); return o; };
      const inBar=cls=>{ const w=document.createElement("div"); w.className=cls; const d=document.createElement("div"); w.appendChild(d); document.body.appendChild(w);
        const s=getComputedStyle(d); const o={transitionProperty:s.transitionProperty,transitionDuration:s.transitionDuration}; w.remove(); return o; };
      const cell=(()=>{ const c=document.createElement("div"); c.className="cell fx-boom"; document.body.appendChild(c); const s=getComputedStyle(c);
        const o={animationName:s.animationName,animationDuration:s.animationDuration}; c.remove(); return o; })();
      const trap=(()=>{ const c=document.createElement("div"); c.className="cell fx-trap"; document.body.appendChild(c); const s=getComputedStyle(c);
        const o={animationName:s.animationName,animationDuration:s.animationDuration}; c.remove(); return o; })();
      return JSON.stringify({ghost:mk("div","pc fx-ghost"),boom:cell,trap:trap,hp:inBar("hpbar"),sh:inBar("shbar")});
    })()`);
    const C=JSON.parse(css);
    rec("computed CSS",C);
    const sec=v=>Math.round(parseFloat(v)*1000);
    ok(sec(C.ghost.animationDuration)===fxo.explosion,"1c .pc.fx-ghost 계산된 애니메이션 "+C.ghost.animationDuration+" = explosion "+fxo.explosion+"ms");
    ok(sec(C.boom.animationDuration)===fxo.explosion,"1d .cell.fx-boom 계산값 "+C.boom.animationDuration+" = explosion");
    ok(sec(C.trap.animationDuration)===fxo.trapFx,"1e .cell.fx-trap 계산값 "+C.trap.animationDuration+" = trapFx");
    ok(sec(C.hp.transitionDuration)===fxo.barStep&&sec(C.sh.transitionDuration)===fxo.barStep,"1f HP·방어막 바 전환 계산값 "+C.hp.transitionDuration+"/"+C.sh.transitionDuration+" = barStep "+fxo.barStep+"ms");
    ok(/width/.test(C.hp.transitionProperty),"1g 바 전환 속성은 width");

    /* ── 2. 실제 타이머로 관측한 1.2초 배너 잠금 ──────────────────────────── */
    await T.ev(`(()=>{ startMode("pve",{aiLevel:"grade5"}); return 1; })()`);
    await sleep(400);
    await T.ev(`(()=>{ autoPlaceCore(); return 1; })()`);
    await sleep(200);
    await T.ev(`(()=>{ setupDoneCore(); return 1; })()`);
    await sleep(300);
    /* 배너를 직접 띄워 performance.now() 로 잠금 유지·해제를 찍는다 */
    const lock=await T.ev(`(()=>new Promise(res=>{
      fxReleaseAll();
      const t0=performance.now(); const marks=[];
      fxPlay({key:"turnBanner",kind:"banner",title:"측정용 배너"});
      const tick=()=>{ const t=performance.now()-t0;
        marks.push({t:Math.round(t),locked:fxLocked(),bannerHidden:document.getElementById("fxBanner").classList.contains("hidden"),bodyLock:document.body.classList.contains("fx-lock")});
        if(!fxLocked()||t>2600) return res(JSON.stringify({t0,marks,released:Math.round(performance.now()-t0)}));
        requestAnimationFrame(tick); };
      tick();
    }))()`);
    const LK=JSON.parse(lock);
    rec("turnBanner lock (performance.now)",{released:LK.released,samples:LK.marks.length});
    const at=ms=>LK.marks.filter(m=>m.t<=ms).slice(-1)[0];
    ok(at(600)&&at(600).locked===true,"2a t≈600ms: 여전히 잠금 (실제 브라우저 타이머)");
    ok(at(1100)&&at(1100).locked===true,"2b t≈1100ms: 여전히 잠금 — 1.2초 선언 하한");
    ok(LK.released>=1200-60,"2c 잠금 유지 "+LK.released+"ms ≥ 1200ms");
    ok(LK.released<=1200+fxo.watchdog+250,"2d 잠금 해제 "+LK.released+"ms ≤ 1200+워치독");
    ok(LK.released<1900,"2e 종전 2초 회귀 음성 대조: "+LK.released+"ms < 1900ms");
    const lastMark=LK.marks[LK.marks.length-1];
    ok(lastMark&&lastMark.bannerHidden===true&&lastMark.bodyLock===false,"2f 해제 시점에 배너 숨김·body 잠금 클래스 제거");

    /* ── 3. #125 보호막 → HP 2단이 실제 CSS 전환으로 damageFx 안에서 끝난다 ── */
    const stage=await T.ev(`(()=>new Promise(res=>{
      /* 전투를 직접 열고 방어자에게 보호막을 준 뒤 공격 1회 — 바 width 쓰기 시각과 잠금 해제 시각을 실제 시간으로 찍는다 */
      fxReleaseAll(); close();
      const mine=S.pieces.filter(p=>p.owner===0&&p.type==="minion"&&p.alive)[0];
      const opp=S.pieces.filter(p=>p.owner===1&&p.type==="minion"&&p.alive)[0];
      for(const p of [mine,opp]){ p.hp=p.maxHp; }
      S.battle=null; S.battlesUsed=0; S.current=0; S.mainUsed=false;
      startRounds(mine,opp,mine,opp);
      const t0=performance.now(); const w=[];
      const B=S.battle; if(!B) return res(JSON.stringify({error:"no battle"}));
      const waitMenu=()=>{ if(!fxLocked()&&S.battle&&S.battle.phase===0){ run(); return; }
        if(performance.now()-t0>20000) return res(JSON.stringify({error:"menu timeout"}));
        setTimeout(waitMenu,30); };
      const run=()=>{
        const Bb=S.battle; const side=actorOfPhase();
        const dSide=side==="A"?"D":"A";
        (side==="A"?Bb.fd:Bb.fa).shield=12; Bb["dispSh"+dSide]=12;
        if(!document.getElementById("shfill-"+dSide)||!document.getElementById("hpfill-"+dSide)) return res(JSON.stringify({error:"no bars"}));
        /* 전투 모달은 행동 뒤 battleModal() 로 **다시 그려져 노드가 교체**된다. 그래서 잡아 둔 참조를 보면 아무 변화도 못 본다 —
           매 폴링마다 id 로 현재 노드를 다시 찾아 style.width 를 읽는다 (제품이 실제로 칠하는 바로 그 노드). */
        const t1=performance.now();
        const last={shield:null,hp:null};
        const poll=setInterval(()=>{
          for(const [name,id] of [["shield","shfill-"+dSide],["hp","hpfill-"+dSide]]){
            const el=document.getElementById(id); if(!el) continue;
            const v=el.style.width;
            if(last[name]===null){ last[name]=v; continue; }
            if(v!==last[name]){ last[name]=v; w.push({name,v,t:Math.round(performance.now()-t1)}); }
          }
        },8);
        const fa=Bb[side==="A"?"fa":"fd"];
        const slot=fa.skills.findIndex((sid,i)=>slotUsable(fa,i,side)&&SKILLS[fa.skills[i]].pow);
        execSlot(side,slot>=0?slot:-1);
        const done=()=>{ if(!fxLocked()||performance.now()-t1>12000){ clearInterval(poll);
            return res(JSON.stringify({writes:w,unlocked:Math.round(performance.now()-t1),damageFx:BAL.fx.damageFx,barStep:BAL.fx.barStep,
              dSide,usedSlot:slot,shieldLeft:(side==="A"?S.battle&&S.battle.fd.shield:S.battle&&S.battle.fa.shield)})); }
          setTimeout(done,20); };
        done();
      };
      waitMenu();
    }))()`);
    const ST=JSON.parse(stage);
    rec("shield→HP stage (실측)",ST);
    if(ST.error){ notes.push("3 보호막→HP 실측 건너뜀: "+ST.error); ok(false,"3 보호막→HP 2단 실측 ("+ST.error+")"); }
    else{
      const shW=ST.writes.filter(x=>x.name==="shield"), hpW=ST.writes.filter(x=>x.name==="hp");
      ok(shW.length>=1&&hpW.length>=1,"3a 방어막·HP 바가 모두 실제로 갱신됐다 (방어막 "+shW.length+" · HP "+hpW.length+")");
      const gap=(shW[0]&&hpW[0])?hpW[0].t-shW[0].t:null;
      ok(shW[0]&&hpW[0]&&shW[0].t<hpW[0].t,"3b 순서: 방어막 바("+(shW[0]&&shW[0].t)+"ms) → HP 바("+(hpW[0]&&hpW[0].t)+"ms)");
      ok(gap!==null&&gap>=ST.barStep-40,"3c 간격 "+gap+"ms ≥ barStep "+ST.barStep+"ms");
      ok(gap!==null&&gap<=ST.damageFx,"3d 2단이 damageFx "+ST.damageFx+"ms 안에서 시작·끝난다 (간격 "+gap+"ms)");
      ok(hpW[0]&&ST.unlocked-hpW[0].t>=ST.barStep-80,"3e 입력 잠금이 HP 전환(.35s)이 끝나기 전에 풀리지 않는다 — HP 쓰기 뒤 "+(hpW[0]?ST.unlocked-hpW[0].t:"?")+"ms 남음");
      await T.shot("v047-battle-damage-stage.png");
    }

    /* ── 4. #121 탐색 보상 — 실제 클릭으로 기술 교체 3단계 완주 ───────────── */
    await T.ev(`(()=>{ fxReleaseAll(); close(); S.battle=null; return 1; })()`);
    const prep=await T.ev(`(()=>{
      const me=S.pieces.filter(p=>p.owner===0&&p.type==="minion"&&p.alive)[0];
      for(const p of S.pieces) if(p.owner===1) { p.placed=false; }
      const k1=S.pieces.find(p=>p.owner===1&&p.type==="king"); k1.placed=true; k1.r=1; k1.c=7;
      me.r=9; me.c=3; me.placed=true;
      for(const m of S.pieces.filter(p=>p.owner===0&&p.type==="minion")) { m.alive=true; m.placed=true; m.cds=[2,1,3,0]; }
      S.events=[{r:9,c:3,kind:"recruit",consumed:false}]; S.traces[0].add("9_3");
      S.current=0; S.mainUsed=false; S.battlesUsed=0; S.selected=me; S.recruit=null;
      render();
      netAction({t:"search"});
      return JSON.stringify({open:!document.getElementById("overlay").classList.contains("hidden"),html:document.getElementById("overlayBox").innerHTML.slice(0,200)});
    })()`);
    const PR=JSON.parse(prep);
    ok(PR.open&&/기술 교체/.test(PR.html)||/숲에서 무언가/.test(PR.html),"4a 탐색 → 보상 선택 화면이 실제로 열렸다");
    await T.shot("v047-search-root.png");
    ok(await T.clickText("기술 교체","#overlayBox"),"4b [기술 교체] 실제 클릭");
    await sleep(150); await T.shot("v047-search-skill.png");
    const skillBtns=await T.ev(`JSON.stringify(Array.prototype.slice.call(document.querySelectorAll("#obBtns button")).map(b=>b.textContent))`);
    rec("기술 선택 버튼",JSON.parse(skillBtns));
    ok(/드래곤 숨결/.test(skillBtns)&&/마녀의 장난/.test(skillBtns)&&/사신의 낫/.test(skillBtns),"4c 신규 3종이 모두 제시된다");
    ok(await T.clickText("드래곤 숨결","#overlayBox"),"4d [드래곤 숨결] 실제 클릭");
    await sleep(150); await T.shot("v047-search-target.png");
    const tgtHtml=await T.ev(`document.getElementById("overlayBox").innerHTML`);
    ok(/\? \? \? \?/.test(tgtHtml),"4e 대상 고르기 전 4슬롯은 ? 로 가려진다");
    const firstTgt=await T.ev(`(()=>{const b=document.querySelectorAll("#obBtns button")[0]; return b?b.textContent:null;})()`);
    ok(await T.clickText(firstTgt,"#overlayBox"),"4f 대상 말 실제 클릭 ("+firstTgt+")");
    await sleep(150); await T.shot("v047-search-slot.png");
    const before=await T.ev(`JSON.stringify((()=>{const m=rosterMinions(0)[0]; return {sk:m.skills.slice(),cds:m.cds.slice()};})())`);
    const slotBtn=await T.ev(`(()=>{const b=Array.prototype.slice.call(document.querySelectorAll("#obBtns button")).find(x=>/슬롯 3 교체/.test(x.textContent)); return b?b.textContent:null;})()`);
    ok(!!slotBtn,"4g 4슬롯 모두 교체 버튼으로 제시된다 ("+slotBtn+")");
    ok(await T.clickText("슬롯 3 교체","#overlayBox"),"4h [슬롯 3 교체] 실제 클릭");
    await sleep(1600); // 결과 연출 1.2초 + 여유
    const after=await T.ev(`JSON.stringify((()=>{const m=rosterMinions(0)[0]; return {sk:m.skills.slice(),cds:m.cds.slice(),rev:m.revealedSkills.slice()};})())`);
    const B4=JSON.parse(before), A4=JSON.parse(after);
    rec("교체 전/후",{before:B4,after:A4});
    ok(A4.sk[2]==="dragon_breath","4i 슬롯3 이 실제로 드래곤 숨결로 바뀌었다");
    ok(A4.cds[2]===B4.cds[2],"4j 교체 슬롯의 남은 쿨 승계 ("+B4.cds[2]+" 유지)");
    ok(A4.sk[0]===B4.sk[0]&&A4.sk[1]===B4.sk[1]&&A4.sk[3]===B4.sk[3],"4k 나머지 슬롯 불변");
    await T.shot("v047-search-done.png");

    /* ── 5. #129 — 탐색 완료 뒤 정확히 한 번 종료 (실제 타이머) ───────────── */
    const endFlow=await T.ev(`(()=>new Promise(res=>{
      fxReleaseAll(); close();
      BAL.fx.autoEnd=true;
      const me=rosterMinions(0)[0];
      for(const p of S.pieces) if(p.owner===1) p.placed=false;
      const k1=S.pieces.find(p=>p.owner===1&&p.type==="king"); k1.placed=true; k1.r=1; k1.c=7;
      me.r=10; me.c=5; me.placed=true;
      S.events=[{r:10,c:5,kind:"itemGift",consumed:false}]; S.traces[0].add("10_5");
      S.current=0; S.mainUsed=false; S.battlesUsed=0; S.selected=me; S.recruit=null;
      const t0=performance.now(), turn0=S.turnCount, ends0=S.metrics.autoEnds, pkg0=S.pkgs[0].itemGift;
      render();
      netAction({t:"search"});
      const modalOpened=!document.getElementById("overlay").classList.contains("hidden");
      const tick=()=>{ if(S.turnCount!==turn0||performance.now()-t0>6000){
          return res(JSON.stringify({modalOpened,elapsed:Math.round(performance.now()-t0),turnDelta:S.turnCount-turn0,
            endsDelta:S.metrics.autoEnds-ends0,pkgDelta:S.pkgs[0].itemGift-pkg0,grace:BAL.fx.autoEndGrace,fxItem:BAL.fx.itemFx})); }
        setTimeout(tick,15); };
      tick();
    }))()`);
    const EF=JSON.parse(endFlow);
    rec("#129 탐색 완료 → 종료 (실측)",EF);
    ok(EF.pkgDelta===1,"5a 패키지 재고 +1");
    ok(EF.modalOpened===false,"5b 추가 확인 모달을 요구하지 않는다");
    ok(EF.turnDelta===1,"5c 턴이 정확히 1 올라갔다");
    ok(EF.endsDelta===1,"5d 자동 종료 지표 +1 (이중 종료 없음)");
    ok(EF.elapsed>=EF.fxItem-120,"5e 결과 연출("+EF.fxItem+"ms) 끝점 이후에 종료됐다 — 실측 "+EF.elapsed+"ms");
    ok(EF.elapsed<EF.fxItem+EF.grace,"5f **추가 "+EF.grace+"ms 유예 없이** 종료됐다 — 실측 "+EF.elapsed+"ms < "+(EF.fxItem+EF.grace)+"ms");

    /* ── 6. #121 전투 버프 — 토큰 주변 CSS 효과가 실제로 계산된다 ──────────── */
    const buff=await T.ev(`(()=>new Promise(res=>{
      fxReleaseAll(); close(); S.battle=null;
      const mine=rosterMinions(0)[0], opp=S.pieces.filter(p=>p.owner===1&&p.type==="minion")[0];
      opp.placed=true; opp.r=9; opp.c=1; opp.alive=true;
      for(const p of [mine,opp]) p.hp=p.maxHp;
      S.pkgs[0]={itemGift:1,battleBuff:1};
      S.battle=null; S.battlesUsed=0; S.current=0; S.mainUsed=false;
      startRounds(mine,opp,mine,opp);
      const t0=performance.now();
      const wait=()=>{ if(!fxLocked()&&S.battle&&S.battle.phase===0){ go(); return; }
        if(performance.now()-t0>20000) return res(JSON.stringify({error:"menu timeout"}));
        setTimeout(wait,30); };
      const go=()=>{
        const side=actorOfPhase();
        window.__openPkgCore("battleBuff");
        const btns=Array.prototype.slice.call(document.querySelectorAll("#obBtns button"));
        const b=btns.find(x=>/힘의 수호자/.test(x.textContent));
        if(!b) return res(JSON.stringify({error:"no buff button",btns:btns.map(x=>x.textContent)}));
        b.click();
        setTimeout(()=>{
          const tok=document.querySelector(".btok.buff-power");
          const cs=tok?getComputedStyle(tok):null;
          const pre=tok?getComputedStyle(tok,"::before"):null;
          res(JSON.stringify({side,applied:(S.battle?(side==="A"?S.battle.buffA:S.battle.buffD):null),
            tokenFound:!!tok,animationName:cs?cs.animationName:null,animationDuration:cs?cs.animationDuration:null,
            boxShadow:cs?(cs.boxShadow||"").slice(0,60):null,beforeContent:pre?pre.content:null,
            uiLine:/✨/.test(document.getElementById("overlayBox").innerHTML),
            pkgLeft:S.pkgs[0].battleBuff,powerFlag:!!(S.battle&&(side==="A"?S.battle.fa:S.battle.fd).powerBuff)}));
        },250);
      };
      wait();
    }))()`);
    const BF=JSON.parse(buff);
    rec("버프 표시 (계산된 CSS)",BF);
    if(BF.error){ ok(false,"6 버프 표시 실측 ("+BF.error+")"); }
    else{
      ok(BF.applied==="power"&&BF.powerFlag===true,"6a 힘의 수호자가 실제로 적용됐다");
      ok(BF.pkgLeft===0,"6b 패키지 −1");
      ok(BF.tokenFound===true,"6c 전투 토큰에 buff-power 클래스가 붙었다");
      ok(BF.animationName&&BF.animationName!=="none","6d 브라우저가 CSS 애니메이션을 실제로 적용 (animation-name "+BF.animationName+")");
      ok(BF.beforeContent&&/💪/.test(BF.beforeContent),"6e ::before 아이콘이 계산됐다 ("+BF.beforeContent+")");
      ok(BF.uiLine===true,"6f 한 전투 안 UI 표시(✨ 상태줄) 존재");
      await T.shot("v047-buff-power.png");
    }

    /* ── 6.5 비공개 DOM — 실제 브라우저에서 상대 자원이 그려지지 않는지 ──────
       계약 3.1·4.8·10: 재고·개봉 선택·기술·"대상 없음"은 비공개이고 **적용된 효과만** 공개된다.
       한계(보고에 명시): 같은 탭에서 NET.me·행동자만 바꿔 그 시점의 DOM 을 읽는다 — 두 기기 릴레이 종단간 검증이 아니다. */
    const priv=await T.ev(`(()=>{
      fxReleaseAll(); close(); S.battle=null;
      const mine=rosterMinions(0)[0], opp=S.pieces.filter(p=>p.owner===1&&p.type==="minion")[0];
      opp.placed=true; opp.r=9; opp.c=2; opp.alive=true; for(const p of [mine,opp]) p.hp=p.maxHp;
      /* 관측 대상 자원을 눈에 띄는 값으로 — 숫자가 DOM 에 새면 바로 잡힌다 */
      S.balls=[47,47]; S.pkgs[0]={itemGift:7,battleBuff:8}; S.pkgs[1]={itemGift:7,battleBuff:8};
      S.inv[0]=["potion","cool","cure"]; S.inv[1]=["potion","cool","cure"];
      const scan=()=>{ const box=document.getElementById("overlayBox").innerHTML;
        const plain=box.replace(/title="[^"]*"/g,"");      // title 은 마우스오버 텍스트 — 본문과 분리해 함께 본다
        return {ball47:/47/.test(plain),gift7:/아이템 선물 7/.test(plain),buff8:/전투 버프 8/.test(plain),
          itemNames:/회복약|쿨링수|해독제/.test(plain),maskItem:/상대 아이템 비공개/.test(box),maskPkg:/상대 패키지 비공개/.test(box),
          ballText:(box.match(/볼 [^·<]*/)||[""])[0].trim()}; };
      const out={};
      /* (a) 온라인 비소유자: 내가 2P 인데 지금은 1P 차례 */
      S.battle=null; S.battlesUsed=0; S.current=0; startRounds(mine,opp,mine,opp);
      NET.mode=true; NET.me=1; NET.started=true; S.battle.menu="bag"; battleModal(); out.onlineBagNonOwner=scan();
      S.battle.menu="ball"; battleModal(); out.onlineBallNonOwner=scan();
      /* (b) 온라인 소유자: 내가 1P (내 재고는 보여야 한다 — 과도 마스킹 음성 대조) */
      NET.me=0; S.battle.menu="bag"; battleModal(); out.onlineBagOwner=scan();
      S.battle.menu="ball"; battleModal(); out.onlineBallOwner=scan();
      NET.mode=false; NET.me=null; NET.started=false;
      /* (c) PVE 에서 AI(1) 차례 — 사람 뷰어(0)에게 AI 자원이 보이면 안 된다 */
      S.mode="pve"; S.battle=null; S.battlesUsed=0; S.current=1;
      startRounds(opp,mine,opp,mine);
      S.battle.menu="bag"; battleModal(); out.pveBagAiTurn=scan();
      S.battle.menu="ball"; battleModal(); out.pveBallAiTurn=scan();
      /* (d) PVE 에서 사람(0) 차례 — 내 재고는 보인다 */
      S.battle=null; S.battlesUsed=0; S.current=0; startRounds(mine,opp,mine,opp);
      S.battle.menu="bag"; battleModal(); out.pveBagMyTurn=scan();
      S.battle.menu="ball"; battleModal(); out.pveBallMyTurn=scan();
      out.actorPve=S.battle?S.battle.attP.owner:null;
      return JSON.stringify(out);
    })()`);
    const PV=JSON.parse(priv);
    rec("비공개 DOM 스캔",PV);
    const hidesAll=o=>o&&!o.ball47&&!o.gift7&&!o.buff8;
    ok(hidesAll(PV.onlineBagNonOwner)&&PV.onlineBagNonOwner.maskItem&&PV.onlineBagNonOwner.maskPkg&&!PV.onlineBagNonOwner.itemNames,
       "6.5a 온라인 비소유자 가방 DOM: 볼 47·선물 7·버프 8·아이템 이름 모두 없고 비공개 안내만");
    ok(hidesAll(PV.onlineBallNonOwner)&&PV.onlineBallNonOwner.ballText.indexOf("비공개")>=0,
       "6.5b 온라인 비소유자 포획 DOM: 볼 보유 수 비공개 ("+(PV.onlineBallNonOwner&&PV.onlineBallNonOwner.ballText)+")");
    ok(hidesAll(PV.pveBagAiTurn)&&PV.pveBagAiTurn.maskItem&&PV.pveBagAiTurn.maskPkg,
       "6.5c **PVE AI 차례** 가방 DOM: AI 재고가 사람 화면에 없다 (종전 NET.mode 전용 마스킹의 구멍)");
    ok(hidesAll(PV.pveBallAiTurn)&&PV.pveBallAiTurn.ballText.indexOf("비공개")>=0,
       "6.5d PVE AI 차례 포획 DOM: AI 볼 보유 수 비공개");
    ok(PV.onlineBagOwner&&PV.onlineBagOwner.gift7&&PV.onlineBagOwner.buff8&&PV.onlineBagOwner.itemNames,
       "6.5e [음성] 온라인 **소유자** 화면에는 내 재고·아이템이 그대로 보인다 (과도 마스킹 아님)");
    ok(PV.pveBallMyTurn&&PV.pveBallMyTurn.ball47,"6.5f [음성] PVE 내 차례에는 내 볼 보유 수가 보인다");
    ok(PV.actorPve===0,"6.5g 전제 확인: 마지막 스캔은 사람(0) 차례였다");
    /* 촬영 시점의 화면은 바로 위 (d) 단계가 그린 **PVE 내 차례(소유자) 대조 화면**이다 —
       "나의 턴 / 볼 47" 이 보이는 것이 정상이며 비소유자 화면이 아니다. 비소유자·AI 차례의 비공개는
       같은 실행의 6.5a~6.5d DOM 스캔 값이 근거다 (JSON 의 "비공개 DOM 스캔"). 이름을 그 사실에 맞춘다. */
    await T.shot("v047-privacy-owner-control.png");

    /* ── 7. 튜토리얼 10단계 렌더 계약 (--tutorial-check) ──────────────────── */
    if(DO_TUT){
      /* 렌더 계약만 본다 — PNG·매니페스트는 만들지 않는다 (기존 미디어 도구 소유) */
      const n=await T.ev(`(()=>{ fxReleaseAll(); close(); TUT.seenThisLoad=false; tutOpen(); return TUT_STEPS.length; })()`);
      ok(n===10,"7a 제품 튜토리얼 단계 수 = 10 (관측 "+n+")");
      const titles=[];
      for(let i=0;i<n;i++){
        const meta=await T.ev(`JSON.stringify({step:TUT.step,title:TUT_STEPS[TUT.step].title,cards:TUT_STEPS[TUT.step].cards.length,lines:TUT_STEPS[TUT.step].lines.length})`);
        const M=JSON.parse(meta); titles.push(M.title);
        if(M.cards!==M.lines) ok(false,"7b 단계 "+(i+1)+" 카드 수("+M.cards+") = 문단 수("+M.lines+")");
        if(i<n-1) await T.ev(`(()=>{ tutNext(); return TUT.step; })()`);
        await sleep(120);
      }
      ok(true,"7b 10단계 카드 수 = 문단 수 (구조 계약)");
      rec("튜토리얼 10단계 제목",titles);
      const s4=await T.ev(`(()=>{ tutGo(3); return document.getElementById("tutBox").innerHTML; })()`);
      ok(/아이템 선물/.test(s4)&&/전투 버프/.test(s4)&&/기술 교체/.test(s4),"7c 4단계에 새 선물 3종이 실제로 렌더된다");
      /* 7d 7단계(잡아오기·도망): 카드 문단은 기존 '결과 한 줄' 형식을 지키므로 여기에는 **핵심 결과만** 있다.
         버프 3종의 세부 수치·예외는 PD 지시(msg_63543c5be2cc)대로 상황 도움말(pkg·recruit)로 옮겼다 — 그 실제 렌더를 함께 본다. */
      const s7=await T.ev(`(()=>{ tutGo(6); return document.getElementById("tutBox").innerHTML; })()`);
      ok(/몬스터볼/.test(s7)&&/도망/.test(s7),"7d 7단계에 포획·도망 핵심이 렌더된다");
      ok(/한 라운드에 한 번/.test(s7)&&/한 싸움에 하나/.test(s7)&&/그 종 그대로/.test(s7),"7d' 7단계 카드 결과줄에 아이템 라운드 1회·버프 전투 1개·숲 포획 종 보존이 간결히 들어간다");
      const resLen=await T.ev(`(()=>{ const strip=h=>String(h).replace(/<[^>]*>/g,"");
        return JSON.stringify(TUT_STEPS.map(s=>s.cards.map(c=>c.res?strip(c.res).length:0))); })()`);
      const maxRes=Math.max(...JSON.parse(resLen).flat());
      ok(maxRes<=100,"7d'' 카드 결과줄이 '한 줄' 형식을 유지한다 — 최장 "+maxRes+"자 ≤ 100 (장문 몰아넣기 금지)");
      rec("카드 res 길이",JSON.parse(resLen));
      /* 새 규칙의 세부는 상황 도움말에 있고, 실제로 화면에 뜬다 */
      const hints=await T.ev(`(()=>{ TUT.hints.pkg=false; tutHint("pkg");
        const a=document.getElementById("tutHint"); const shownA=!a.classList.contains("hidden"), txtA=a.textContent;
        tutHintClose(); TUT.hints.recruit=false; tutHint("recruit");
        const shownB=!a.classList.contains("hidden"), txtB=a.textContent; tutHintClose();
        return JSON.stringify({shownA,txtA,shownB,txtB}); })()`);
      const HN=JSON.parse(hints);
      ok(HN.shownA&&/가방/.test(HN.txtA)&&/힘/.test(HN.txtA)&&/시간/.test(HN.txtA)&&/도망/.test(HN.txtA),"7e 📦 상황 도움말이 실제로 뜨고 버프 3종·가방 설명을 담는다");
      ok(HN.shownB&&/드래곤/.test(HN.txtB)&&/마녀/.test(HN.txtB)&&/사신/.test(HN.txtB)&&/4칸/.test(HN.txtB),"7f 📘 상황 도움말이 실제로 뜨고 신규 3종·4슬롯 교체를 담는다");
      await T.ev(`(()=>{ tutSkip(); return 1; })()`);
      notes.push("7 README 용 튜토리얼 PNG 10장·capture-manifest.json 은 이 도구가 만들지 않는다 — tools/media/readme_media_capture.js capture 담당");
    } else notes.push("7 튜토리얼 10단계 렌더 계약 검사는 --tutorial-check 로 실행한다 (PNG 캡처는 기존 미디어 도구)");

    /* ── 보고서 ───────────────────────────────────────────────────────────── */
    report.pass=pass; report.fail=fail; report.fails=fails; report.notes=notes;
    if(!READ_ONLY){ const f=path.join(OUT,"v047-browser-report.json");
      fs.writeFileSync(f,JSON.stringify(report,null,2)); console.log("REPORT  "+path.relative(ROOT,f).replace(/\\/g,"/")); }
  }catch(e){ console.error("EXCEPTION "+e.message); fail++; fails.push("예외: "+e.message); }
  finally{
    try{ L.proc.kill(); }catch(e){}
    await sleep(250);
    try{ fs.rmSync(L.udd,{recursive:true,force:true}); console.log("CLEANUP 임시 프로필 삭제 "+L.udd); }catch(e){ console.log("CLEANUP 임시 프로필 삭제 실패(무시) "+L.udd); }
    if(tmpRef){ try{ fs.rmSync(path.dirname(tmpRef),{recursive:true,force:true}); console.log("CLEANUP ref 임시 사본 삭제"); }catch(e){} }
  }
  for(const n of notes) console.log("NOTE    "+n);
  console.log("\n=== v047_cdp (#121·#125·#129 브라우저): pass "+pass+" / fail "+fail+" ===");
  if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
  process.exit(0);
})();
