/* #146 도망·수동 대기 · #131 텔레포트 함정 차단 · #130 보호막 합산 · #128 튜토리얼 프로필 독립
   — 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 마우스 클릭 · 페이지의 실제 setTimeout)

   사용: node demo/test/milestone/v0.4.7/issues/146/issue146_cdp.js
           [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots] [--ref <sha>]

   무엇을 보는가 (헤드리스 하네스가 볼 수 없는 것만):
     1. #146 도망 — 만피 상태에서 🏃 도망가기 메뉴를 **실제로 클릭**해 버튼이 활성이고 표기가 30% 인지,
        도망의 수호자를 쓴 전투에서 70% 로 바뀌는지를 실제 DOM 에서 본다.
     2. #146 수동 대기 — 4슬롯이 전부 불가한 화면을 실제로 그려, 기본 공격 버튼이 없고 안내 문구와
        [턴 종료] 버튼만 있는지 확인한 뒤 그 버튼을 **실제 마우스로 눌러** 전투 행동이 한 번만 넘어가는지 본다.
        같은 화면에서 가방·포획·도망 메뉴가 살아 있는지도 실제 클릭으로 연다.
     3. #146 비공개 — **관찰자 시점**(PVE 의 AI 행동 차례)에서 그 안내와 [턴 종료] 버튼이 DOM 에 아예
        없는지 문자열로 확인한다 (행동자 시점과 같은 탭에서 대조).
     4. #131 텔레포트 — 함정에 걸린 말을 **실제 보드 칸 클릭**으로 골라 거부 안내가 뜨고 단계가 유지되는지,
        유효한 말을 고르면 2단계 문구로 바뀌는지 본다.
     5. #130 보호막 — 실제 렌더에서 보호막이 합산되고, 누적이 최대 HP 를 넘어도 수치는 살아 있으며
        방어막 바의 계산된 폭(getComputedStyle)이 100% 에서 포화하는지 본다.
     6. #128 튜토리얼 프로필 독립 — **같은 http origin** 을 서로 다른 Chrome user-data-dir(=독립 프로필,
        독립 PC 대용) 두 개로 열어 A 완료 → B 최초 방문 → B 재방문 → A 재방문을 실제로 재현한다.

   한계 (명시): 6번은 **같은 머신의 독립 Chrome 프로필 두 개**다. 물리적으로 다른 두 PC 로 같은 서버에
     접속한 종단간 검증이 아니다. localStorage 는 브라우저 프로필·origin 단위로 분리되므로 프로필 분리는
     기기 분리와 같은 저장소 경계를 만들지만, 그 등가성은 브라우저 계약에 근거한 **추론**이다.
     3번도 같은 탭에서 행동자만 바꿔 그 시점의 DOM 을 보는 검사이지, 두 기기·실제 릴레이의 온라인 종단간
     검증이 아니다.

   소스: **현재 작업 트리**의 demo/index.html. 6번만 그 파일을 로컬 HTTP(127.0.0.1·PORT=0)로 서빙한다
     (localStorage 는 file: 스킴에서 origin 이 브라우저마다 달라 계약을 확인할 수 없다). 나머지는 file: 로 연다.
     어떤 바이트를 봤는지 증명하려고 git blob hash(sha1 · CRLF→LF 정규화 후 = 커밋되는 바이트)를 남긴다.
     --ref <sha> 를 주면 그 커밋의 blob 과 대조하고, 다르면 ref 쪽을 임시 파일로 꺼내 촬영한다.

   --read-only: Saturn 독립 재검증용 — 산출물 0건(스크린샷·JSON 없음), stdout 만.

   RESOURCE/CLEANUP: 이 실행이 만든 것만 정리한다 — 자기가 spawn 한 Chrome 프로세스(PID 기록)와
     자기가 mkdtemp 로 만든 임시 프로필 디렉터리, 자기가 listen 한 검증용 HTTP 서버뿐이다.
     사용자가 이미 띄워 둔 브라우저·서버는 찾지도, 종료하지도 않는다.

   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 0. 종료 코드 1 = 판정 실패, 2 = 환경 오류. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), http=require("http"), crypto=require("crypto"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.7","issues","146","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const REF=opt("--ref",null);
const CHROME=opt("--chrome",[process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(ROOT,"demo","index.html"));
const VP={width:1280,height:1000};

function blobHashNormalized(file){ const raw=fs.readFileSync(file);
  const b=Buffer.from(raw.toString("utf8").replace(/\r\n/g,"\n"),"utf8");
  return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0","utf8"),b])).digest("hex"); }
function gitOut(a){ try{ return require("child_process").execFileSync("git",a,{cwd:ROOT,encoding:"utf8"}).trim(); }catch(e){ return null; } }

let pass=0,fail=0; const fails=[], notes=[];
function ok(cond,name){ if(cond){pass++; console.log("PASS "+name);} else {fail++; fails.push(name); console.error("FAIL "+name);} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* ── 이 실행이 소유한 자원만 기록·정리 ─────────────────────────────────────── */
const OWNED={procs:[],dirs:[],servers:[],tmpFiles:[]};
function cleanup(){
  for(const p of OWNED.procs){ try{ if(p&&p.pid&&!p.killed) process.kill(p.pid); }catch(e){} }
  for(const s of OWNED.servers){ try{ s.close(); }catch(e){} }
  for(const f of OWNED.tmpFiles){ try{ fs.rmSync(f,{recursive:true,force:true}); }catch(e){} }
  for(const d of OWNED.dirs){ try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} }
}

function launch(tag){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i146cdp-"+tag+"-"));
    OWNED.dirs.push(udd);
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run",
      "--no-default-browser-check","--disable-gpu","--hide-scrollbars","--lang=ko-KR",
      "--disable-background-timer-throttling","--disable-renderer-backgrounding","about:blank"],{stdio:["ignore","pipe","pipe"]});
    OWNED.procs.push(p);
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
async function connect(L){ const cdp=new CDP(new WebSocket(L.ws));
  await new Promise(r=>{ const t=setInterval(()=>{ if(cdp.ws.readyState===1){clearInterval(t);r();} },30); });
  return cdp; }
async function openTab(cdp,url){
  const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
  const {sessionId:S}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
  await cdp.send("Page.enable",{},S); await cdp.send("Runtime.enable",{},S);
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.width,height:VP.height,deviceScaleFactor:1,mobile:false},S);
  await cdp.send("Page.navigate",{url},S);
  await sleep(1000);
  const ev=async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},S);
    if(r.exceptionDetails) throw new Error("page error: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+"\nEXPR: "+expr.slice(0,300));
    return r.result.value; };
  const shot=async name=>{ if(!SHOTS) return null;
    const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},S);
    const f=path.join(OUT,name); fs.writeFileSync(f,Buffer.from(data,"base64")); return path.relative(ROOT,f).replace(/\\/g,"/"); };
  const nav=async u=>{ await cdp.send("Page.navigate",{url:u},S); await sleep(1000); };
  const at=async sel=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`);
  const clickPt=async box=>{ if(!box) return false;
    await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await sleep(160); return true; };
  const clickSel=async sel=>clickPt(await at(sel));
  /* 버튼 텍스트로 실제 클릭 — 보이는 버튼만 (숨은 하위 패널의 동명 버튼을 집지 않는다) */
  const clickText=async (txt,scope)=>clickPt(await ev(`(()=>{
      const root=document.querySelector(${JSON.stringify(scope||"body")}); if(!root) return null;
      const b=Array.prototype.slice.call(root.querySelectorAll("button"))
        .filter(x=>!x.disabled&&x.getBoundingClientRect().width>0)
        .reverse().find(x=>x.textContent.indexOf(${JSON.stringify(txt)})>=0);
      if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`));
  /* 보드 칸을 논리 좌표(r,c)로 실제 클릭 */
  const clickCell=async (r,c)=>clickPt(await ev(`(()=>{
      const cells=document.querySelectorAll("#board .cell");
      for(const el of cells){ if(+el.dataset.r===${r}&&+el.dataset.c===${c}){ const b=el.getBoundingClientRect(); return {x:b.left+b.width/2,y:b.top+b.height/2}; } }
      return null;})()`));
  /* 실제 브라우저는 개시 카운트다운(3·2·1·배틀 시작!)·라운드 배너·메시지 재생을 **정상 시간**으로 돌린다.
     사람이 버튼을 누를 수 있는 시점 = 그 연출이 끝나 입력 잠금이 풀린 때다. 연출 시간을 줄이지 않고 그대로 기다린다. */
  const settle=async (ms)=>{ const t0=Date.now(), cap=ms||20000;
    for(;;){ const busy=await ev(`(()=>{ try{ return !!fxLocked()||!!(S.battle&&S.battle.msgQ.length); }catch(e){ return false; } })()`);
      if(!busy) return true;
      if(Date.now()-t0>cap) return false;
      await sleep(150); } };
  return {S,ev,shot,nav,clickSel,clickText,clickCell,at,clickPt,settle};
}

/* 전투 고정 픽스처를 페이지 안에서 만든다 (제품 함수만 사용 — 규칙을 흉내 내지 않는다) */
const SETUP_FN=`window.__fix=(o)=>{
  o=o||{};
  try{ S&&(S.battle=null); close(); }catch(e){}   // 이전 절이 남긴 모달·오버레이를 먼저 닫는다 (실제 클릭이 오버레이에 가로막히지 않게)
  startMode("pvp");
  for(const p of S.pieces) p.placed=false;
  const k0=S.pieces.find(p=>p.owner===0&&p.type==="king"), k1=S.pieces.find(p=>p.owner===1&&p.type==="king");
  const me=S.pieces.find(p=>p.owner===0&&p.type==="minion"), em=S.pieces.find(p=>p.owner===1&&p.type==="minion");
  const put=(p,r,c)=>{p.r=r;p.c=c;p.placed=true;p.alive=true;};
  put(k0,13,1); put(k1,1,7); put(me,12,4); put(em,11,4);
  S.phase="play"; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.battle=null;
  me.hp=me.maxHp; em.hp=em.maxHp; me.shield=0; em.shield=0;
  if(me.skills) me.cds=[0,0,0,0]; if(em.skills) em.cds=[0,0,0,0];
  startRounds(me,em,me,em);
  const B=S.battle;
  if(o.skillsA) { B.fa.skills=o.skillsA.slice(); B.fa.revealedSkills=[]; }
  if(o.cdsA) B.fa.cds=o.cdsA.slice();
  if(o.skillsD) { B.fd.skills=o.skillsD.slice(); B.fd.revealedSkills=[]; }
  if(o.cdsD) B.fd.cds=o.cdsD.slice();
  if(o.boostA) B.fa.fleeBoost=true;
  B.round=o.round||1; B.phase=0;
  for(let i=0;i<2;i++){ if(actorOfPhase()===(o.side||"A")) break; B.phase=B.phase===0?1:0; }
  battleModal();
  return {actor:actorOfPhase(),round:B.round,phase:B.phase};
};1`;

/* ── #128 전용: 이 실행이 소유한 검증용 정적 HTTP 서버 (127.0.0.1 · PORT=0) ── */
const MIME={".html":"text/html; charset=utf-8",".png":"image/png",".webp":"image/webp",".json":"application/json",".js":"text/javascript",".css":"text/css"};
function serveDemo(rootDir){ return new Promise(res=>{
  const s=http.createServer((q,r)=>{
    const u=decodeURIComponent(String(q.url).split("?")[0]);
    const f=path.join(rootDir,u==="/"?"index.html":u.replace(/^\/+/,""));
    if(!path.resolve(f).startsWith(path.resolve(rootDir))){ r.writeHead(403); r.end(); return; }
    fs.readFile(f,(e,b)=>{ if(e){ r.writeHead(404); r.end("404"); return; }
      r.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream"}); r.end(b); });
  });
  OWNED.servers.push(s);
  s.listen(0,"127.0.0.1",()=>res(s)); }); }

const TUT_PROBE=`(()=>{ let stored=null,err=null;
  try{ stored=localStorage.getItem(typeof TUT_KEY!=="undefined"?TUT_KEY:"tutorialSeen"); }catch(e){ err=String(e&&e.message); }
  return {origin:location.origin,tutKey:typeof TUT_KEY!=="undefined"?TUT_KEY:null,
    autoOpen:typeof TUT!=="undefined"?TUT.open:null, seenThisLoad:typeof TUT!=="undefined"?TUT.seenThisLoad:null,
    overlayHidden:!!(document.getElementById("tutOverlay")||{classList:{contains:()=>null}}).classList.contains("hidden"),
    stored, storeErr:err, manualBtn:!!document.getElementById("tutBtn")}; })()`;

(async()=>{
  const HASH=blobHashNormalized(HTML);
  let served=HTML, servedFrom="작업 트리", refHash=null, serveDir=path.join(ROOT,"demo");
  if(REF){
    refHash=gitOut(["rev-parse",REF+":demo/index.html"]);
    if(!refHash){ console.error("--ref "+REF+" 의 demo/index.html 을 읽지 못했습니다"); process.exit(2); }
    if(refHash===HASH) servedFrom="작업 트리 (== --ref "+REF.slice(0,12)+" blob, 같은 바이트)";
    else{
      const body=require("child_process").execFileSync("git",["show",REF+":demo/index.html"],{cwd:ROOT,maxBuffer:1<<28});
      const dir=fs.mkdtempSync(path.join(os.tmpdir(),"i146ref-")); OWNED.tmpFiles.push(dir);
      served=path.join(dir,"index.html"); fs.writeFileSync(served,body); serveDir=dir;
      servedFrom="--ref "+REF.slice(0,12)+" (작업 트리와 다름 — ref 를 촬영)";
      try{ fs.symlinkSync(path.join(ROOT,"demo","assets"),path.join(dir,"assets"),"junction"); }catch(e){}
    }
  }
  console.log("SOURCE   "+path.relative(ROOT,HTML).replace(/\\/g,"/")+"  blob sha1 "+HASH);
  if(REF) console.log("REF      "+REF+"  blob "+refHash+(refHash===HASH?"  (일치)":"  (불일치 — ref 를 촬영)"));
  console.log("SERVED   "+servedFrom);
  console.log("MODE     "+(READ_ONLY?"read-only (산출물 0건)":"out="+path.relative(ROOT,OUT).replace(/\\/g,"/")));
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});

  const report={source:path.relative(ROOT,HTML).replace(/\\/g,"/"),blobSha1:HASH,ref:REF||null,refBlobSha1:refHash,servedFrom,
    at:new Date().toISOString(),tool:"demo/test/milestone/v0.4.7/issues/146/issue146_cdp.js",
    limits:["#128 절은 같은 머신의 독립 Chrome 프로필 2개다 — 물리적으로 다른 두 PC 의 종단간 검증이 아니다.",
            "비공개 절은 같은 탭에서 행동자만 바꿔 그 시점 DOM 을 보는 검사다 — 두 기기·실제 릴레이 온라인 종단간 검증이 아니다."],
    checks:[],shots:[]};
  const rec=(k,v)=>{ report.checks.push({k,v}); console.log("  · "+k+": "+(typeof v==="object"?JSON.stringify(v):v)); };
  const snap=async (T,name)=>{ const f=await T.shot(name); if(f){ report.shots.push(f); console.log("  · shot: "+f); } };

  try{
    const L=await launch("main");
    console.log("RESOURCE 헤드리스 Chrome 임시 프로필 "+L.udd+" (pid "+L.proc.pid+")");
    const cdp=await connect(L);
    const T=await openTab(cdp,"file:///"+served.replace(/\\/g,"/"));
    await T.ev(`(()=>{ try{ if(typeof TUT_KEY!=="undefined") localStorage.setItem(TUT_KEY,"1"); }catch(e){} try{tutSkip();}catch(e){} return 1; })()`);
    ok(await T.ev(`typeof BAL!=="undefined"&&typeof NO_ATTACK_MSG!=="undefined"&&typeof TELE_TRAP_MSG!=="undefined"`),"0 페이지 로드 · v0.4.7 #146/#131 심볼 존재");
    await T.ev(SETUP_FN);
    rec("BAL.fleeProb/fleeProbGuard",await T.ev(`[BAL.fleeProb,BAL.fleeProbGuard]`));

    /* ── 1. #146 도망: 만피에서 활성 · 표기 30% (실제 클릭으로 메뉴를 연다) ───────── */
    rec("1 전제",await T.ev(`__fix({})`));
    ok(await T.settle(),"1-0 개시 연출이 정상 시간으로 끝나 입력 잠금이 풀렸다");
    ok(await T.clickText("🏃 도망가기"),"1a 🏃 도망가기 메뉴를 실제 마우스로 열었다");
    const flee1=await T.ev(`(()=>{const p=document.getElementById("bsub-flee");
      const b=p&&Array.prototype.slice.call(p.querySelectorAll("button")).find(x=>x.textContent.indexOf("도망 (성공")>=0);
      return {panelVisible:!!p&&!p.classList.contains("hidden"),label:b?b.textContent.trim():null,disabled:b?!!b.disabled:null,
        text:p?p.textContent:""};})()`);
    rec("1 도망 패널",{label:flee1.label,disabled:flee1.disabled});
    ok(flee1.panelVisible,"1b 도망 하위 패널이 실제로 보인다");
    ok(flee1.disabled===false,"1c 만피(HP 100%)에서도 도망 버튼이 활성이다 — HP 게이트 폐지");
    ok(/성공 30%/.test(flee1.label||""),"1d 버튼 표기가 성공 30% 다");
    ok(!/50% 미만이어야 합니다/.test(flee1.text)&&/HP 조건 없음/.test(flee1.text),"1e 안내에 HP 조건 문구가 없다");
    ok(/추가 반격은 없고/.test(flee1.text),"1f 실패 시 추가 반격이 없다는 안내가 있다");
    await snap(T,"i146-flee-30.png");

    /* 도망의 수호자를 쓴 전투는 같은 화면이 70% 로 바뀐다 */
    rec("1 buff 전제",await T.ev(`__fix({boostA:true})`));
    await T.settle();
    await T.clickText("🏃 도망가기");
    const flee2=await T.ev(`(()=>{const p=document.getElementById("bsub-flee");
      const b=p&&Array.prototype.slice.call(p.querySelectorAll("button")).find(x=>x.textContent.indexOf("도망 (성공")>=0);
      return {label:b?b.textContent.trim():null,text:p?p.textContent:""};})()`);
    rec("1 도망 패널(수호자)",{label:flee2.label});
    ok(/성공 70%/.test(flee2.label||""),"1g 도망의 수호자를 쓴 전투원은 70% 로 표기된다");
    ok(/이 전투 도망 성공률 70%/.test(flee2.text),"1h 그 전투에만 적용된다는 안내가 있다");
    await snap(T,"i146-flee-70.png");

    /* 실제 클릭으로 도망을 시도해 본다 — 실패해도 상대의 반격 피해가 없어야 한다 */
    await T.ev(`__fix({})`);
    await T.settle();
    await T.clickText("🏃 도망가기");
    const before=await T.ev(`(()=>{const B=S.battle;return {fa:B.fa.hp,fd:B.fd.hp,round:B.round,phase:B.phase,tries:S.metrics.fleeTries};})()`);
    ok(await T.clickText("🏃 도망 (성공"),"1i 도망 버튼을 실제 마우스로 눌렀다");
    await T.settle();
    const after=await T.ev(`(()=>{const B=S.battle;return B?{over:false,fa:B.fa.hp,fd:B.fd.hp,round:B.round,phase:B.phase,tries:S.metrics.fleeTries,
      blog:B.blog.join("|")}:{over:true,tries:S.metrics.fleeTries,oks:S.metrics.fleeOks};})()`);
    rec("1 도망 결과",after);
    ok(after.tries===before.tries+1,"1j 도망 시도가 실제로 1회 집계됐다");
    if(after.over) ok(true,"1k 도망 성공 — 전투가 즉시 종료됐다");
    else{
      ok(after.fa===before.fa&&after.fd===before.fd,"1k 도망 실패 — 양측 HP 가 그대로다 (상대의 추가 반격 없음)");
      ok(!/피해!/.test(after.blog||""),"1l 전투 로그에 반격 피해가 없다");
      ok(after.phase!==before.phase||after.round!==before.round,"1m 자기 전투 행동 1회만 넘어갔다");
    }
    await snap(T,"i146-flee-result.png");

    /* ── 2. #146 수동 대기: 4슬롯 전부 불가 화면 ─────────────────────────────── */
    const NOATK={skillsA:["reaper_scythe","dragon_breath","witch_prank","sup_heal"],cdsA:[0,2,2,2],round:1};
    rec("2 전제",await T.ev(`__fix(${JSON.stringify(NOATK)})`));
    ok(await T.settle(),"2-0 개시 연출이 끝나 입력 잠금이 풀렸다");
    ok(await T.ev(`[0,1,2,3].every(i=>slotUsable(S.battle.fa,i,"A")===false)`),"2a 전제: 네 슬롯 모두 지금 쓸 수 없다");
    const view0=await T.ev(`(()=>{const box=document.getElementById("overlayBox");
      return {html:box.innerHTML.length,msg:(document.getElementById("msgBox")||{}).textContent||"",
        hasBasic:box.innerHTML.indexOf("기본 공격")>=0, hasNotice:box.innerHTML.indexOf(NO_ATTACK_MSG)>=0,
        hasPass:box.innerHTML.indexOf("__pass()")>=0,
        menus:Array.prototype.slice.call(box.querySelectorAll(".bmenu button")).map(b=>b.textContent.trim())};})()`);
    rec("2 화면",{msg:view0.msg,hasBasic:view0.hasBasic,hasNotice:view0.hasNotice,hasPass:view0.hasPass,menus:view0.menus});
    ok(view0.hasBasic===false,"2b 기본 공격 버튼이 DOM 에 없다");
    ok(view0.hasNotice===true,"2c 안내 문구가 화면에 있다");
    ok(view0.msg.indexOf("공격할 것이 없습니다")>=0,"2d 메시지 박스에 안내가 그대로 나온다");
    ok(view0.hasPass===true,"2e 명시적 수동 [턴 종료] 버튼이 있다");
    ok(view0.menus.some(t=>/가방/.test(t))&&view0.menus.some(t=>/포획/.test(t))&&view0.menus.some(t=>/도망/.test(t)),"2f 가방·포획·도망 메뉴가 그대로 있다");
    /* 2f2 (Saturn msg_31b27e86d2e2): 안내와 **같은 화면**에서 바로 누를 수 있어야 한다 — 루트 메뉴에도 [턴 종료]가 보인다 */
    const rootPass=await T.ev(`(()=>{const m=document.getElementById("bmenu"); if(!m) return null;
      const b=Array.prototype.slice.call(m.querySelectorAll("button")).find(x=>x.textContent.indexOf("턴 종료")>=0);
      if(!b) return {found:false};
      const r=b.getBoundingClientRect(); return {found:true,disabled:!!b.disabled,visible:r.width>0&&r.height>0,menuHidden:m.classList.contains("hidden")};})()`);
    rec("2 루트 [턴 종료]",rootPass);
    ok(rootPass&&rootPass.found&&rootPass.visible&&!rootPass.disabled&&!rootPass.menuHidden,"2f2 루트 전투 메뉴에 [턴 종료] 버튼이 실제로 보이고 활성이다");
    await snap(T,"i146-noattack-root.png");
    /* 2f3 루트에서 곧바로 눌러도 같은 handler 로 자기 전투 행동 1회만 넘어간다 (하위 메뉴를 열 필요가 없다) */
    {
      const b0=await T.ev(`(()=>{const B=S.battle;return {round:B.round,phase:B.phase,fa:B.fa.hp,fd:B.fd.hp,bu:S.battlesUsed,main:S.mainUsed};})()`);
      ok(await T.clickText("턴 종료","#bmenu"),"2f3 루트 메뉴의 [턴 종료]를 실제 마우스로 눌렀다");
      await T.settle();
      const a0=await T.ev(`(()=>{const B=S.battle;return B?{round:B.round,phase:B.phase,fa:B.fa.hp,fd:B.fd.hp,bu:S.battlesUsed,main:S.mainUsed}:null;})()`);
      rec("2 루트 턴 종료 전/후",{before:b0,after:a0});
      ok(!!a0&&(a0.phase!==b0.phase||a0.round!==b0.round),"2f4 루트 [턴 종료]로 자기 전투 행동 1회가 넘어간다");
      ok(!!a0&&a0.fa===b0.fa&&a0.fd===b0.fd&&a0.bu===b0.bu&&a0.main===b0.main,"2f5 공격·주 행동·전투 횟수는 그대로다");
      /* 이후 절(싸우기 패널 경로)을 위해 같은 픽스처를 다시 세운다 */
      rec("2 재설정",await T.ev(`__fix(${JSON.stringify(NOATK)})`));
      await T.settle();
    }
    /* 실제 클릭으로 싸우기 패널을 열어 안내와 버튼만 있는지 본다 */
    await T.clickText("⚔️ 싸우기");
    const fightPanel=await T.ev(`(()=>{const p=document.getElementById("bsub-fight");
      return {visible:!!p&&!p.classList.contains("hidden"),text:p?p.textContent:"",
        btns:p?Array.prototype.slice.call(p.querySelectorAll("button")).map(b=>({t:b.textContent.trim(),d:!!b.disabled})):[]};})()`);
    rec("2 싸우기 패널",fightPanel.btns);
    ok(fightPanel.visible&&fightPanel.text.indexOf("공격할 것이 없습니다")>=0,"2g 싸우기 패널에도 안내가 있다");
    ok(fightPanel.btns.some(b=>/턴 종료/.test(b.t)&&!b.d),"2h 활성 [턴 종료] 버튼");
    ok(!fightPanel.btns.some(b=>/기본 공격/.test(b.t)),"2i 기본 공격 버튼 없음");
    await snap(T,"i146-noattack-fight.png");
    /* 가방을 실제로 열어 아이템·패키지 선택이 살아 있는지 본다 */
    await T.clickText("← 뒤로"); await T.clickText("🎒 가방");
    const bag=await T.ev(`(()=>{const p=document.getElementById("bsub-bag");
      return {visible:!!p&&!p.classList.contains("hidden"),btns:p?Array.prototype.slice.call(p.querySelectorAll("button")).map(b=>b.textContent.trim()):[]};})()`);
    ok(bag.visible&&bag.btns.some(t=>/선물|버프|회복|쿨링|해독/.test(t)),"2j 그 상황에서도 가방(아이템·패키지)을 열 수 있다 — "+JSON.stringify(bag.btns));
    await snap(T,"i146-noattack-bag.png");
    /* [턴 종료]를 실제 마우스로 눌러 자기 전투 행동만 넘어가는지 본다 */
    await T.clickText("← 뒤로"); await T.clickText("⚔️ 싸우기");
    const b2=await T.ev(`(()=>{const B=S.battle;return {round:B.round,phase:B.phase,fa:B.fa.hp,fd:B.fd.hp,bu:S.battlesUsed,main:S.mainUsed,wk:B.fa.weaken};})()`);
    ok(await T.clickText("턴 종료"),"2k [턴 종료]를 실제 마우스로 눌렀다");
    await T.settle();
    const a2=await T.ev(`(()=>{const B=S.battle;return B?{round:B.round,phase:B.phase,fa:B.fa.hp,fd:B.fd.hp,bu:S.battlesUsed,main:S.mainUsed,wk:B.fa.weaken}:null;})()`);
    rec("2 턴 종료 전/후",{before:b2,after:a2});
    ok(!!a2&&(a2.phase!==b2.phase||a2.round!==b2.round),"2l 자기 전투 행동 1회가 넘어갔다 (nextPhase)");
    ok(!!a2&&a2.fa===b2.fa&&a2.fd===b2.fd,"2m 어떤 공격도 나가지 않았다 (양측 HP 불변)");
    ok(!!a2&&a2.bu===b2.bu&&a2.main===b2.main&&a2.wk===b2.wk,"2n 보드 주 행동·턴당 전투 횟수·약화 잔여 불변");
    await snap(T,"i146-noattack-after-pass.png");

    /* 하나라도 합법이면 예외 없음 */
    rec("2 예외 없음 전제",await T.ev(`__fix(${JSON.stringify({skillsA:NOATK.skillsA,cdsA:[0,2,2,0],round:1})})`));
    await T.settle();
    const legal=await T.ev(`(()=>{const box=document.getElementById("overlayBox");
      return {usable:[0,1,2,3].filter(i=>slotUsable(S.battle.fa,i,"A")),notice:box.innerHTML.indexOf(NO_ATTACK_MSG)>=0,
        pass:box.innerHTML.indexOf("__pass()")>=0,basic:box.innerHTML.indexOf("기본 공격")>=0};})()`);
    rec("2 합법 슬롯",legal);
    ok(legal.usable.length>0&&!legal.notice&&!legal.pass,"2o 보조기 하나가 합법이면 안내·[턴 종료] 없이 그 슬롯을 쓴다 (예외 없음)");
    ok(!legal.basic,"2p 그때도 기본 공격은 없다 (4슬롯 전투원)");

    /* 쿨링수 사용 후 재평가 */
    rec("2 쿨링수 전제",await T.ev(`(()=>{ __fix(${JSON.stringify({skillsA:["fire_stable","fire_effect","sup_heal","sig_atk"],cdsA:[9,2,2,2],round:1})});
      S.inv[0]=["cool"]; S.battle.itemRoundA=false; battleModal();
      return {notice:document.getElementById("overlayBox").innerHTML.indexOf(NO_ATTACK_MSG)>=0}; })()`));
    await T.settle();
    await T.clickText("🎒 가방");
    ok(await T.clickText("쿨링수"),"2q 가방에서 쿨링수를 실제로 눌렀다");
    await T.settle();
    await sleep(1800);
    const cool=await T.ev(`(()=>{const box=document.getElementById("overlayBox");
      return {cds:S.battle.fa.cds.slice(),notice:box.innerHTML.indexOf(NO_ATTACK_MSG)>=0,hasSlot0:box.innerHTML.indexOf("__act(0)")>=0};})()`);
    rec("2 쿨링수 후",cool);
    ok(JSON.stringify(cool.cds)==="[0,0,0,0]","2r 쿨링수가 4슬롯 쿨을 초기화했다");
    ok(cool.notice===false&&cool.hasSlot0===true,"2s 같은 전투 안에서 재평가돼 공격 슬롯이 되살아났다");
    await snap(T,"i146-noattack-cool-recheck.png");

    /* ── 3. #146 비공개 — 관찰자 시점에는 안내도 버튼도 없다 ─────────────────── */
    const obs=await T.ev(`(()=>{
      try{ S&&(S.battle=null); close(); }catch(e){}
      startMode("pve");
      for(const p of S.pieces) p.placed=false;
      const k0=S.pieces.find(p=>p.owner===0&&p.type==="king"), k1=S.pieces.find(p=>p.owner===1&&p.type==="king");
      const me=S.pieces.find(p=>p.owner===0&&p.type==="minion"), em=S.pieces.find(p=>p.owner===1&&p.type==="minion");
      const put=(p,r,c)=>{p.r=r;p.c=c;p.placed=true;p.alive=true;};
      put(k0,13,1); put(k1,1,7); put(me,12,4); put(em,11,4);
      S.phase="play"; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.battle=null;
      me.hp=me.maxHp; em.hp=em.maxHp;
      startRounds(me,em,me,em);
      const B=S.battle;
      B.fd.skills=["reaper_scythe","dragon_breath","witch_prank","sup_heal"]; B.fd.cds=[0,2,2,2]; B.fd.revealedSkills=[];
      B.fa.skills=["reaper_scythe","dragon_breath","witch_prank","sup_heal"]; B.fa.cds=[0,2,2,2]; B.fa.revealedSkills=[];
      B.round=1; B.phase=0;
      const out={};
      for(const want of ["A","D"]){
        for(let i=0;i<2;i++){ if(actorOfPhase()===want) break; B.phase=B.phase===0?1:0; }
        battleModal();
        const box=document.getElementById("overlayBox");
        out[want]={actor:actorOfPhase(),owner:(actorOfPhase()==="A"?B.attP.owner:B.defP.owner),
          noAtkSlots:[0,1,2,3].filter(i=>!slotUsable(actorOfPhase()==="A"?B.fa:B.fd,i,actorOfPhase())).length,
          notice:box.innerHTML.indexOf(NO_ATTACK_MSG)>=0, pass:box.innerHTML.indexOf("__pass()")>=0,
          msg:(document.getElementById("msgBox")||{}).textContent||""};
      }
      return out; })()`);
    rec("3 행동자/관찰자",obs);
    ok(obs.A.noAtkSlots===4&&obs.D.noAtkSlots===4,"3a 전제: 양측 모두 네 슬롯이 불가한 상태");
    ok(obs.A.notice===true&&obs.A.pass===true,"3b 내(행동자, PVE 사람) 차례에는 안내와 [턴 종료]가 보인다");
    ok(obs.D.notice===false&&obs.D.pass===false,"3c 상대(AI) 차례에는 안내도 [턴 종료]도 DOM 에 없다 — 미공개 기술 상태가 새지 않는다");
    ok(obs.D.msg.indexOf("공격할 것이 없습니다")<0,"3d 메시지 박스에도 누출이 없다");
    await snap(T,"i146-privacy-observer.png");

    /* ── 4. #131 텔레포트 — 실제 보드 클릭 ──────────────────────────────────── */
    const teleSetup=await T.ev(`(()=>{
      startMode("pvp");
      for(const p of S.pieces) p.placed=false;
      const k0=S.pieces.find(p=>p.owner===0&&p.type==="king"), k1=S.pieces.find(p=>p.owner===1&&p.type==="king");
      const ms=S.pieces.filter(p=>p.owner===0&&p.type==="minion");
      const put=(p,r,c)=>{p.r=r;p.c=c;p.placed=true;p.alive=true;};
      put(k0,13,1); put(k1,1,7); put(ms[0],2,2); put(ms[1],12,4); put(ms[2],12,6);
      ms[1].immobile=2;                       // 함정에 걸려 멈춘 말
      S.phase="play"; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.battle=null; S.selected=null;
      try{ close(); }catch(e){}
      render();
      return {available:teleportAvailable(0),trapped:{r:ms[1].r,c:ms[1].c},free1:{r:ms[0].r,c:ms[0].c},free2:{r:ms[2].r,c:ms[2].c}};})()`);
    rec("4 전제",teleSetup);
    await T.settle();
    ok(teleSetup.available===true,"4a 전제: 텔레포트 가능 (상대 진영에 내 말)");
    ok(await T.clickText("🌀 텔레포트"),"4b 🌀 텔레포트 버튼을 실제로 눌렀다");
    const stage1=await T.ev(`(()=>({stage:S.teleport&&S.teleport.stage,side:document.getElementById("sidePanel").textContent}))()`);
    ok(stage1.stage===1&&stage1.side.indexOf("먼저 텔레포트를 할 말을 선택해주세요! (함정에 걸린 말은 제외)")>=0,"4c 1단계 안내 문구가 계약 문자열 그대로 나온다");
    await snap(T,"i131-tele-stage1.png");
    /* 함정에 걸린 말을 실제로 클릭 → 거부 · 단계 유지 */
    const snapT=await T.ev(`(()=>{const ms=S.pieces.filter(p=>p.owner===0&&p.type==="minion");
      return JSON.stringify([ms[0].r,ms[0].c,ms[1].r,ms[1].c,S.mainUsed,S.teleUsed[0],S.metrics.teleports]);})()`);
    ok(await T.clickCell(teleSetup.trapped.r,teleSetup.trapped.c),"4d 함정에 걸린 말의 칸을 실제 마우스로 클릭했다");
    await sleep(400);
    const rej=await T.ev(`(()=>{const ms=S.pieces.filter(p=>p.owner===0&&p.type==="minion");
      return {stage:S.teleport&&S.teleport.stage,picked:!!(S.teleport&&S.teleport.piece),
        toast:(document.getElementById("toasts")||{}).textContent||"",
        log:S.log.slice(-3).map(l=>l.msg).join(" | "),
        state:JSON.stringify([ms[0].r,ms[0].c,ms[1].r,ms[1].c,S.mainUsed,S.teleUsed[0],S.metrics.teleports])};})()`);
    rec("4 거부",rej);
    ok(rej.stage===1&&rej.picked===false,"4e 거부: 단계가 그대로 1 이고 선택되지 않는다");
    ok((rej.toast+rej.log).indexOf("함정에 걸린 하수인은 텔레포트를 사용할 수 없습니다")>=0,"4f 거부 안내 문구가 계약 문자열 그대로 나온다");
    ok(rej.state===snapT,"4g 거부 시 좌표·주 행동·텔레포트 횟수·지표가 모두 불변");
    await snap(T,"i131-tele-reject.png");
    /* 유효한 첫 말 → 2단계 문구 */
    ok(await T.clickCell(teleSetup.free1.r,teleSetup.free1.c),"4h 유효한 첫 말을 실제로 클릭했다");
    await sleep(400);
    const stage2=await T.ev(`(()=>({stage:S.teleport&&S.teleport.stage,side:document.getElementById("sidePanel").textContent}))()`);
    ok(stage2.stage===2&&stage2.side.indexOf("교체할 말을 선택해주세요")>=0,"4i 2단계 안내 문구가 계약 문자열 그대로 나온다");
    await snap(T,"i131-tele-stage2.png");
    /* 2단계에서 함정 말 클릭 → 거부 · 2단계·첫 말 유지 */
    ok(await T.clickCell(teleSetup.trapped.r,teleSetup.trapped.c),"4j 2단계에서 함정에 걸린 말을 클릭했다");
    await sleep(400);
    const rej2=await T.ev(`(()=>({stage:S.teleport&&S.teleport.stage,picked:!!(S.teleport&&S.teleport.piece),
      toast:(document.getElementById("toasts")||{}).textContent||"",
      hintOpen:!!(document.getElementById("tutHint")&&!document.getElementById("tutHint").classList.contains("hidden"))}))()`);
    rec("4 2단계 거부",rej2);
    ok(rej2.stage===2&&rej2.picked===true,"4k 2단계 거부: 단계·첫 말 선택이 유지된다");
    /* 관측: 처음 거부될 때 뜨는 상황 도움말(#tutHint)은 화면 아래 가운데 고정이라 보드 마지막 줄을 덮는다.
       사람이 하듯 [알겠어요]로 먼저 닫고 다음 칸을 클릭한다 (조건을 약화하지 않는다 — 실제 조작 순서 그대로다). */
    if(rej2.hintOpen){ notes.push("상황 도움말(#tutHint)이 열려 있으면 보드 아래쪽 칸을 덮는다 — 실제 조작에서는 [알겠어요]로 닫고 클릭한다");
      ok(await T.clickText("알겠어요"),"4k2 상황 도움말을 [알겠어요]로 닫았다"); }
    /* 정상 교환 */
    rec("4 교환 직전",await T.ev(`(()=>{const ms=S.pieces.filter(p=>p.owner===0&&p.type==="minion");
      return {stage:S.teleport&&S.teleport.stage,first:S.teleport&&S.teleport.piece&&S.teleport.piece.id,
        valid:teleportSwapValid(S.teleport.piece,ms[2]),block:teleportSwapBlock(S.teleport.piece,ms[2]),
        target:{id:ms[2].id,r:ms[2].r,c:ms[2].c,immobile:ms[2].immobile},
        hintOpen:!!(document.getElementById("tutHint")&&!document.getElementById("tutHint").classList.contains("hidden"))};})()`));
    ok(await T.clickCell(teleSetup.free2.r,teleSetup.free2.c),"4l 함정에 걸리지 않은 말을 클릭해 교환했다");
    await sleep(400);
    const swapped=await T.ev(`(()=>{const ms=S.pieces.filter(p=>p.owner===0&&p.type==="minion");
      return {a:[ms[0].r,ms[0].c],c:[ms[2].r,ms[2].c],main:S.mainUsed,tele:S.metrics.teleports,
        teleUsed:S.teleUsed[0],teleport:S.teleport,cur:S.current};})()`);
    rec("4 정상 교환",swapped);
    ok(swapped.tele===1&&swapped.teleUsed===1,"4m 정상 교환이 실제로 실행됐다 — 텔레포트 지표·횟수 1 (차단이 기능을 죽이지 않았다)");
    ok(swapped.a[0]===teleSetup.free2.r&&swapped.a[1]===teleSetup.free2.c&&swapped.c[0]===teleSetup.free1.r&&swapped.c[1]===teleSetup.free1.c,
      "4m2 두 말의 좌표가 실제로 맞바뀌었다 "+JSON.stringify(swapped.a)+" ↔ "+JSON.stringify(swapped.c));
    ok(swapped.teleport===null,"4m3 선택 상태가 정리됐다");
    /* 교환으로 주 행동을 쓰고 남은 행동이 없으면 #106 T7 자동 턴 종료가 이어진다 — 그 시점에는 mainUsed 가 다음 턴 값으로 초기화된다.
       여기서는 그 뒤 상태를 함께 기록만 하고, 텔레포트 성립 여부는 위 지표·좌표로 판정한다. */
    await sleep(1600);
    rec("4 교환 후 턴 상태",await T.ev(`(()=>({main:S.mainUsed,cur:S.current,turn:S.turnCount,autoEnds:S.metrics.autoEnds}))()`));
    await snap(T,"i131-tele-swapped.png");

    /* ── 5. #130 보호막 합산 ────────────────────────────────────────────────── */
    await T.ev(`__fix({skillsA:["sup_guard","sig_def","fire_stable","fire_effect"],cdsA:[0,0,0,0]})`);
    await T.settle();
    const sh=await T.ev(`(()=>{
      const B=S.battle; const mx=B.fa.maxHp; const out={maxHp:mx,steps:[]};
      const step=(label)=>out.steps.push({label,shield:B.fa.shield});
      step("초기");
      execSlot("A",0); step("수호 자세 1회");
      B.fa.cds=[0,0,0,0]; for(let i=0;i<2;i++){ if(actorOfPhase()==="A") break; B.phase=B.phase===0?1:0; }
      execSlot("A",0); step("수호 자세 2회 (합산)");
      B.fa.shield=Math.max(0,B.fa.shield-10); step("10 소모");
      B.fa.cds=[0,0,0,0]; for(let i=0;i<2;i++){ if(actorOfPhase()==="A") break; B.phase=B.phase===0?1:0; }
      execSlot("A",1); step("불굴 진형 추가 (합산)");
      out.guardPct=SKILLS.sup_guard.shieldPct; out.defPct=SKILLS.sig_def.shieldPct;
      out.icons=stIcons(B.fa);
      return out; })()`);
    rec("5 보호막 진행",sh);
    const g=Math.round(sh.maxHp*sh.guardPct), d=Math.round(sh.maxHp*sh.defPct);
    ok(sh.steps[1].shield===g,"5a 첫 보호막 = maxHp×"+sh.guardPct+" = "+g);
    ok(sh.steps[2].shield===g*2,"5b 같은 기술 두 번 → 합산 "+g+"+"+g+"="+sh.steps[2].shield);
    ok(sh.steps[4].shield===sh.steps[3].shield+d,"5c 부분 소모 뒤에도 남은 양에 더해진다 "+sh.steps[3].shield+"+"+d+"="+sh.steps[4].shield);
    ok(sh.icons.indexOf("🛡"+sh.steps[4].shield)>=0,"5d 상태 표기가 실제 수치를 그대로 보여 준다");
    /* 누적 > maxHP 에서도 수치는 살아 있고 바 폭만 100% 에서 포화한다 (실제 CSS 계산값) */
    const over=await T.ev(`(()=>{
      const B=S.battle; let n=0;
      while(B.fa.shield<=B.fa.maxHp&&n<20){ B.fa.cds=[0,0,0,0];
        for(let i=0;i<2;i++){ if(actorOfPhase()==="A") break; B.phase=B.phase===0?1:0; }
        execSlot("A",0); n++; }
      applyFx({st:{side:"A",text:stIcons(B.fa),shield:B.fa.shield,max:B.fa.maxHp}});
      const el=document.getElementById("shfill-A");
      return {shield:B.fa.shield,maxHp:B.fa.maxHp,icons:stIcons(B.fa),
        inlineWidth:el?el.style.width:null,
        computedPct:el&&el.parentElement?Math.round(el.getBoundingClientRect().width/el.parentElement.getBoundingClientRect().width*100):null};})()`);
    rec("5 누적 초과",over);
    ok(over.shield>over.maxHp,"5e 보호막이 최대 HP("+over.maxHp+")를 넘어 "+over.shield+" 까지 쌓인다 (새 상한 없음)");
    ok(over.icons.indexOf("🛡"+over.shield)>=0,"5f 초과해도 수치 손실 없이 그대로 표시된다");
    ok(over.inlineWidth==="100%"&&over.computedPct===100,"5g 시각 영역(방어막 바)은 100% 에서 포화한다 — 실제 렌더 폭 "+over.computedPct+"%");
    await snap(T,"i130-shield-stacked.png");

    /* ── 6. #128 튜토리얼 프로필 독립 (같은 http origin · 독립 Chrome 프로필 2개) ── */
    const srv=await serveDemo(serveDir);
    const port=srv.address().port, URL0="http://127.0.0.1:"+port+"/index.html";
    console.log("RESOURCE 검증용 정적 HTTP 서버 127.0.0.1:"+port+" (이 실행 소유 · 종료 시 close)");
    const LA=await launch("profA"), LB=await launch("profB");
    console.log("RESOURCE 헤드리스 Chrome 프로필 A "+LA.udd+" (pid "+LA.proc.pid+") · B "+LB.udd+" (pid "+LB.proc.pid+")");
    const cA=await connect(LA), cB=await connect(LB);
    const PA=await openTab(cA,URL0), PB=await openTab(cB,URL0);
    const tut={};
    tut.a1=await PA.ev(TUT_PROBE);
    rec("6 A 최초 방문",tut.a1);
    ok(tut.a1.origin==="http://127.0.0.1:"+port,"6a 두 프로필이 같은 origin 을 연다 ("+tut.a1.origin+")");
    ok(tut.a1.autoOpen===true&&tut.a1.stored===null,"6b A 최초 방문: 자동 표시 · 저장 없음");
    await PA.shot&&await snap(PA,"i128-A-first.png");
    /* A 가 10단계를 실제로 넘겨 완료한다 */
    for(let i=0;i<12;i++){ if(!(await PA.clickText("다음"))) break; }
    await PA.clickText("게임 시작");
    tut.a2=await PA.ev(TUT_PROBE);
    rec("6 A 완료 직후",tut.a2);
    ok(tut.a2.autoOpen===false&&tut.a2.stored==="1","6c A 완료 → A 프로필에만 기록");
    await snap(PA,"i128-A-done.png");
    tut.b1=await PB.ev(TUT_PROBE);
    rec("6 B 최초 방문(A 완료 후)",tut.b1);
    ok(tut.b1.stored===null&&tut.b1.autoOpen===true,"6d **A 가 완료해도 B 프로필은 최초 방문으로 자동 표시된다** (프로필 독립)");
    await snap(PB,"i128-B-first.png");
    await PB.nav(URL0);
    tut.b2=await PB.ev(TUT_PROBE);
    rec("6 B 재방문(미완주)",tut.b2);
    ok(tut.b2.autoOpen===true,"6e B 재방문(미완주): 여전히 자동 표시");
    await PA.nav(URL0);
    tut.a3=await PA.ev(TUT_PROBE);
    rec("6 A 재방문(완료 후)",tut.a3);
    ok(tut.a3.autoOpen===false&&tut.a3.stored==="1","6f A 재방문: 생략된다");
    ok(tut.a3.manualBtn===true&&tut.b2.manualBtn===true,"6g 수동 재보기('?') 버튼은 두 프로필 모두 상시 존재한다");
    /* B 도 건너뛰기로 완료 → 그때부터 생략 */
    await PB.clickText("건너뛰기");
    await PB.nav(URL0);
    tut.b3=await PB.ev(TUT_PROBE);
    rec("6 B 완료 후 재방문",tut.b3);
    ok(tut.b3.autoOpen===false&&tut.b3.stored==="1","6h B 도 자기 프로필 기준으로만 생략된다");
    /* 다른 origin(localhost vs 127.0.0.1, 같은 포트)은 별도 저장 */
    const PB2=await openTab(cB,"http://localhost:"+port+"/index.html");
    tut.b4=await PB2.ev(TUT_PROBE);
    rec("6 B 다른 origin",tut.b4);
    ok(tut.b4.stored===null&&tut.b4.autoOpen===true,"6i host 가 다르면 origin 이 달라 저장도 독립이다 (scheme·host·port 별)");
    report.tutorial=tut;

    /* ── 7. 튜토리얼 10단계가 새 규칙을 담고 있다 (실제 렌더) ─────────────────── */
    const tut10=await PA.ev(`(()=>{ tutOpen(); const out=[];
      for(let i=0;i<TUT_STEPS.length;i++){ tutGo(i);
        const box=document.getElementById("tutBox");
        out.push({i,title:TUT_STEPS[i].title,cards:TUT_STEPS[i].cards.length,lines:TUT_STEPS[i].lines.length,
          text:box?box.textContent.replace(/\\s+/g," "):""}); }
      tutSkip(); return out; })()`);
    const all=tut10.map(s=>s.text).join(" ");
    ok(tut10.length===10&&tut10.every(s=>s.cards===s.lines),"7a 10단계 · 카드 수 = 문단 수");
    ok(/성공률은 30%/.test(all)&&/70%/.test(all),"7b 새 도망 규칙(30% · 도망의 수호자 70%)이 실제 렌더 텍스트에 있다");
    ok(/기본 공격도 나오지 않아요/.test(all)&&/턴 종료/.test(all),"7c 수동 대기 규칙이 실제 렌더 텍스트에 있다");
    ok(/보호막/.test(all)&&/더해져요/.test(all),"7d 보호막 합산 규칙이 실제 렌더 텍스트에 있다");
    ok(/함정/.test(all)&&/자리를 바꿀 수 없어요/.test(all),"7e 텔레포트 함정 차단 규칙이 실제 렌더 텍스트에 있다");
    ok(!/성공률 50%/.test(all)&&!/HP가 50% 아래면/.test(all),"7f 옛 도망 문구(50% · HP 조건)가 남아 있지 않다");
    report.tutorialSteps=tut10.map(s=>({i:s.i,title:s.title,cards:s.cards}));
    await PA.ev(`tutOpen(); tutGo(6); 1`); await snap(PA,"i146-tutorial-flee-step.png");
    await PA.ev(`tutGo(4); 1`); await snap(PA,"i146-tutorial-battle-step.png");
    await PA.ev(`tutGo(7); 1`); await snap(PA,"i131-tutorial-teleport-step.png");
    await PA.ev(`tutSkip(); 1`);

  }catch(e){
    fail++; fails.push("예외 "+e.message);
    console.error("FAIL(예외) "+(e.stack||e.message));
  }finally{
    report.pass=pass; report.fail=fail; report.fails=fails; report.notes=notes;
    if(!READ_ONLY){
      const f=path.join(OUT,"i146-browser-report.json");
      fs.writeFileSync(f,JSON.stringify(report,null,2),"utf8");
      console.log("REPORT   "+path.relative(ROOT,f).replace(/\\/g,"/"));
    }
    cleanup();
    console.log("CLEANUP  이 실행이 만든 Chrome 프로세스 "+OWNED.procs.length+"개 · 임시 프로필 "+OWNED.dirs.length+"개 · 검증용 HTTP 서버 "+OWNED.servers.length+"개만 정리 (사용자 브라우저·기존 서버는 건드리지 않는다)");
  }
  console.log(`\n=== issue146_cdp (#146·#131·#130·#128): pass ${pass} / fail ${fail} ===`);
  for(const l of report.limits) console.log("LIMIT    "+l);
  if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
})().catch(e=>{ console.error(e); cleanup(); process.exit(2); });
